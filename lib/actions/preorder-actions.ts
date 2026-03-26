'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { sendPaymentRequestEmail, sendPaymentRequestSms } from '@/lib/server/payment-request-delivery'
import { logAudit } from '@/lib/audit'

const ALLOWED_PREORDER_STATUSES = ['pending', 'payment_pending', 'fulfilled', 'cancelled'] as const

export type PreorderStatus = (typeof ALLOWED_PREORDER_STATUSES)[number]
type PaymentRequestChannel = 'email' | 'sms'

function getOrderPaymentState(order?: { payment_status?: string | null; financial_status?: string | null } | null) {
    return String(order?.payment_status ?? order?.financial_status ?? '').trim().toLowerCase()
}

function getStorefrontSiteUrl() {
    const siteUrl =
        process.env.ECOMMERCE_SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL

    if (!siteUrl) {
        return null
    }

    return siteUrl.startsWith('http') ? siteUrl.replace(/\/$/, '') : `https://${siteUrl.replace(/\/$/, '')}`
}

function normalizeRequiredEmail(value?: string | null) {
    const normalized = value?.trim().toLowerCase() ?? ''
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

function normalizeRequiredPhone(value?: string | null) {
    const normalized = value?.trim() ?? ''
    const digits = normalized.replace(/\D/g, '')
    return digits.length >= 10 ? normalized : null
}

async function reserveOrderStock(supabase: Awaited<ReturnType<typeof createClient>>, variantId: string, quantity: number, orderId: string) {
    const { data: reserved, error } = await supabase.rpc('reserve_stock', {
        p_variant_id: variantId,
        p_qty: quantity,
        p_reference: orderId,
    })

    if (error) {
        console.error('Reserve Stock RPC Error:', error)
        throw new Error(error.message || 'Error executing reserve_stock RPC')
    }

    if (reserved === false) {
        throw new Error('Insufficient stock is available to convert this preorder into an order.')
    }
}

async function releaseOrderStock(supabase: Awaited<ReturnType<typeof createClient>>, variantId: string, quantity: number, orderId: string) {
    const { error } = await supabase.rpc('release_stock', {
        p_variant_id: variantId,
        p_qty: quantity,
        p_reference: orderId,
    })

    if (error) {
        throw error
    }
}

export async function getPreorders(status: PreorderStatus | 'all' = 'all') {
    await requireActionPermission('manage_orders')
    const supabase = await createClient()

    let query = supabase
        .from('preorders')
        .select(`
            id,
            customer_id,
            variant_id,
            order_id,
            product_title,
            product_slug,
            image_url,
            variant_title,
            variant_options,
            unit_price,
            quantity,
            status,
            created_at,
            orders ( id, order_number, payment_status, financial_status ),
            customers ( id, first_name, last_name, email, phone ),
            product_variants (
                id,
                price,
                products ( id, title, slug, product_media ( media_url, position ) ),
                variant_option_values (
                    product_option_values (
                        value,
                        product_options ( name )
                    )
                )
            )
        `)
        .order('created_at', { ascending: false })

    if (status !== 'all') {
        query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching preorders:', error)
        return []
    }

    return data || []
}

export async function updatePreorderStatus(id: string, status: PreorderStatus) {
    const access = await requireActionPermission('manage_orders')

    if (!ALLOWED_PREORDER_STATUSES.includes(status)) {
        return { error: 'Invalid preorder status.' }
    }

    const supabase = await createClient()
    const { data: currentPreorder, error: fetchError } = await supabase
        .from('preorders')
        .select('id, status, order_id, orders ( payment_status, financial_status )')
        .eq('id', id)
        .single()

    if (fetchError || !currentPreorder) {
        return { error: fetchError?.message || 'Preorder not found.' }
    }

    const linkedOrder = Array.isArray(currentPreorder.orders)
        ? currentPreorder.orders[0]
        : currentPreorder.orders
    const linkedOrderPaid = getOrderPaymentState(linkedOrder) === 'paid'

    if (currentPreorder.order_id && status === 'pending') {
        return { error: 'Preorders linked to orders cannot be moved back to pending.' }
    }

    if (status === 'fulfilled' && !linkedOrderPaid) {
        return { error: 'Only paid preorder orders can be marked fulfilled.' }
    }

    if (status === 'payment_pending' && !currentPreorder.order_id) {
        return { error: 'Preorders must be linked to an order before they can await payment.' }
    }

    const { error } = await supabase
        .from('preorders')
        .update({ status })
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    await logAudit({
        actorId: access.user?.id,
        action: 'preorder.status.update',
        entityType: 'preorder',
        entityId: id,
        before: {
            status: currentPreorder.status || 'pending',
            order_id: currentPreorder.order_id || null,
            order_financial_status: linkedOrder?.payment_status || linkedOrder?.financial_status || null,
        },
        after: {
            status,
        },
    })

    revalidatePath('/admin/preorders')
    revalidatePath('/admin/customers')

    return { success: true }
}

export async function createPaymentOrderFromPreorder(id: string) {
    const access = await requireActionPermission('manage_orders')
    const supabase = await createClient()

    const { data: preorder, error } = await supabase
        .from('preorders')
        .select(`
            id,
            customer_id,
            variant_id,
            order_id,
            product_title,
            product_slug,
            image_url,
            variant_title,
            variant_options,
            unit_price,
            quantity,
            status,
            orders ( payment_status, financial_status ),
            customers (
                id,
                first_name,
                last_name,
                email,
                phone
            ),
            product_variants (
                id,
                sku,
                title,
                price,
                products (
                    title,
                    slug,
                    product_media ( media_url, position )
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error || !preorder) {
        return { error: error?.message || 'Preorder not found.' }
    }

    if (preorder.status === 'cancelled') {
        return { error: 'Cancelled preorders must be reopened before creating an order.' }
    }

    if (preorder.order_id) {
        const linkedOrder = Array.isArray(preorder.orders)
            ? preorder.orders[0]
            : preorder.orders
        const preorderStatus = getOrderPaymentState(linkedOrder) === 'paid' ? 'fulfilled' : 'payment_pending'
        return { success: true, orderId: preorder.order_id, alreadyExists: true, preorderStatus }
    }

    if (!preorder.customer_id || !preorder.variant_id) {
        return { error: 'Preorder is missing customer or variant data.' }
    }

    const variant = Array.isArray(preorder.product_variants)
        ? preorder.product_variants[0]
        : preorder.product_variants
    const customer = Array.isArray(preorder.customers)
        ? preorder.customers[0]
        : preorder.customers
    const product = Array.isArray(variant?.products)
        ? variant.products[0]
        : variant?.products

    const unitPrice = Number(preorder.unit_price || variant?.price || 0)
    const quantity = preorder.quantity || 1
    const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim()
    const customerEmail = normalizeRequiredEmail(customer?.email)
    const customerPhone = normalizeRequiredPhone(customer?.phone)

    if (unitPrice <= 0) {
        return { error: 'Preorder variant has no valid price.' }
    }
    if (!customerName || !customerEmail || !customerPhone) {
        return { error: 'Preorder customer must have name, email, and phone before creating an online order.' }
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            customer_id: preorder.customer_id,
            guest_email: customerEmail,
            guest_name: customerName,
            guest_phone: customerPhone,
            payment_status: 'pending',
            financial_status: 'pending',
            status: 'pending',
            fulfillment_status: 'unfulfilled',
            total_amount: unitPrice * quantity,
            subtotal: unitPrice * quantity,
            discount_total: 0,
            tax_total: 0,
            shipping_total: 0,
            grand_total: unitPrice * quantity,
            sales_channel: 'online',
            payment_method: 'Payment Request',
            order_type: 'online',
            notes: `Created from preorder ${preorder.id}`,
        })
        .select('id, order_number')
        .single()

    if (orderError || !order) {
        return { error: orderError?.message || 'Could not create order from preorder.' }
    }

    try {
        await reserveOrderStock(supabase, preorder.variant_id, quantity, order.id)
    } catch (reservationError) {
        await supabase
            .from('orders')
            .delete()
            .eq('id', order.id)

        return {
            error: reservationError instanceof Error
                ? reservationError.message
                : 'Could not reserve stock for this preorder order.'
        }
    }

    const { error: orderItemError } = await supabase
        .from('order_items')
        .insert({
            order_id: order.id,
            variant_id: preorder.variant_id,
            title: preorder.product_title || product?.title || 'Preorder item',
            sku: variant?.sku || preorder.variant_id,
            product_slug: preorder.product_slug || product?.slug || null,
            image_url: preorder.image_url || null,
            variant_title: preorder.variant_title || variant?.title || 'Default Variant',
            variant_options: preorder.variant_options || [],
            quantity,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
        })

    if (orderItemError) {
        await releaseOrderStock(supabase, preorder.variant_id, quantity, order.id).catch(() => undefined)
        await supabase
            .from('orders')
            .delete()
            .eq('id', order.id)
        return { error: orderItemError.message }
    }

    const { error: updateError } = await supabase
        .from('preorders')
        .update({
            status: 'payment_pending',
            order_id: order.id,
        })
        .eq('id', preorder.id)

    if (updateError) {
        await releaseOrderStock(supabase, preorder.variant_id, quantity, order.id).catch(() => undefined)
        await supabase
            .from('orders')
            .delete()
            .eq('id', order.id)
        return { error: updateError.message }
    }

    revalidatePath('/admin/preorders')
    revalidatePath('/admin/orders')

    await logAudit({
        actorId: access.user?.id,
        action: 'preorder.order.create',
        entityType: 'preorder',
        entityId: preorder.id,
        before: {
            order_id: preorder.order_id || null,
            status: preorder.status || 'pending',
        },
        after: {
            order_id: order.id,
            order_number: order.order_number || null,
            status: 'payment_pending',
            quantity,
            unit_price: unitPrice,
        },
    })

    if (customerEmail) {
        try {
            await sendOrderPaymentRequest(order.id, 'email')
        } catch (err) {
            console.error('Failed to auto-send payment email:', err)
        }
    }

    return { success: true, orderId: order.id, orderNumber: order.order_number, alreadyExists: false, preorderStatus: 'payment_pending' as const }
}

export async function getOrderPaymentRequest(orderId: string) {
    await requireActionPermission('manage_orders')
    const supabase = await createClient()

    const siteUrl = getStorefrontSiteUrl()
    if (!siteUrl) {
        return { error: 'Storefront URL is not configured. Set ECOMMERCE_SITE_URL or NEXT_PUBLIC_SITE_URL.' }
    }

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, order_number, guest_email, guest_phone, payment_status, financial_status, payment_request_token')
        .eq('id', orderId)
        .single()

    if (error || !order) {
        return { error: error?.message || 'Order not found.' }
    }

    if (getOrderPaymentState(order) === 'paid') {
        return { error: 'This order is already paid.' }
    }

    let paymentRequestToken = order.payment_request_token

    if (!paymentRequestToken) {
        paymentRequestToken = randomUUID()
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                payment_request_token: paymentRequestToken,
                payment_request_created_at: new Date().toISOString(),
            })
            .eq('id', orderId)

        if (updateError) {
            return { error: updateError.message }
        }
    }

    const paymentUrl = `${siteUrl}/pay/${paymentRequestToken}`
    const emailRecipient = order.guest_email || ''
    const smsRecipient = order.guest_phone || ''

    return {
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        paymentUrl,
        emailRecipient,
        smsRecipient,
    }
}

async function createPaymentRequestDeliveryLog({
    supabase,
    orderId,
    channel,
    provider,
    recipient,
    paymentUrl,
}: {
    supabase: Awaited<ReturnType<typeof createClient>>
    orderId: string
    channel: PaymentRequestChannel
    provider: string
    recipient: string
    paymentUrl: string
}) {
    const { data, error } = await supabase
        .from('payment_request_deliveries')
        .insert({
            order_id: orderId,
            channel,
            provider,
            recipient,
            payment_url: paymentUrl,
            status: 'processing',
        })
        .select('id')
        .single()

    if (error || !data) {
        throw error || new Error('Could not create delivery log.')
    }

    return data.id as string
}

async function updatePaymentRequestDeliveryLog({
    supabase,
    id,
    status,
    providerReference,
    errorMessage,
}: {
    supabase: Awaited<ReturnType<typeof createClient>>
    id: string
    status: 'sent' | 'failed'
    providerReference?: string | null
    errorMessage?: string | null
}) {
    const { error } = await supabase
        .from('payment_request_deliveries')
        .update({
            status,
            provider_reference: providerReference || null,
            error_message: errorMessage || null,
        })
        .eq('id', id)

    if (error) {
        throw error
    }
}

export async function sendOrderPaymentRequest(orderId: string, channel: PaymentRequestChannel) {
    const access = await requireActionPermission('manage_orders')
    const supabase = await createClient()

    const paymentRequest = await getOrderPaymentRequest(orderId)
    if (!paymentRequest.success || !paymentRequest.paymentUrl) {
        return { error: paymentRequest.error || 'Could not generate payment request.' }
    }

    const { data: settings } = await supabase
        .from('app_settings')
        .select('store_name, store_email')
        .single()

    const storeName = settings?.store_name || 'Cluster Fascination'
    const replyTo = settings?.store_email || null
    const provider = channel === 'email' ? 'resend' : 'twilio'
    const recipient = channel === 'email'
        ? (paymentRequest.emailRecipient || '')
        : (paymentRequest.smsRecipient || '')

    const deliveryLogId = await createPaymentRequestDeliveryLog({
        supabase,
        orderId,
        channel,
        provider,
        recipient,
        paymentUrl: paymentRequest.paymentUrl,
    })

    try {
        if (channel === 'email') {
            if (!paymentRequest.emailRecipient) {
                await updatePaymentRequestDeliveryLog({
                    supabase,
                    id: deliveryLogId,
                    status: 'failed',
                    errorMessage: 'Order does not have an email address for delivery.',
                })
                revalidatePath(`/admin/orders/${orderId}`)
                return { error: 'Order does not have an email address for delivery.' }
            }

            const delivery = await sendPaymentRequestEmail({
                to: paymentRequest.emailRecipient,
                paymentUrl: paymentRequest.paymentUrl,
                orderNumber: paymentRequest.orderNumber || null,
                storeName,
                replyTo,
            })

            await updatePaymentRequestDeliveryLog({
                supabase,
                id: deliveryLogId,
                status: 'sent',
                providerReference: delivery.deliveryId,
            })
            revalidatePath(`/admin/orders/${orderId}`)

            await logAudit({
                actorId: access.user?.id,
                action: 'preorder.payment_request.send',
                entityType: 'order',
                entityId: orderId,
                after: {
                    channel,
                    recipient: paymentRequest.emailRecipient,
                    payment_url: paymentRequest.paymentUrl,
                },
            })

            return {
                success: true,
                channel,
                paymentUrl: paymentRequest.paymentUrl,
                deliveryId: delivery.deliveryId,
                recipient: paymentRequest.emailRecipient,
            }
        }

        if (!paymentRequest.smsRecipient) {
            await updatePaymentRequestDeliveryLog({
                supabase,
                id: deliveryLogId,
                status: 'failed',
                errorMessage: 'Order does not have a phone number for SMS delivery.',
            })
            revalidatePath(`/admin/orders/${orderId}`)
            return { error: 'Order does not have a phone number for SMS delivery.' }
        }

        const delivery = await sendPaymentRequestSms({
            to: paymentRequest.smsRecipient,
            paymentUrl: paymentRequest.paymentUrl,
            orderNumber: paymentRequest.orderNumber || null,
            storeName,
        })

        await updatePaymentRequestDeliveryLog({
            supabase,
            id: deliveryLogId,
            status: 'sent',
            providerReference: delivery.deliveryId,
        })
        revalidatePath(`/admin/orders/${orderId}`)

        await logAudit({
            actorId: access.user?.id,
            action: 'preorder.payment_request.send',
            entityType: 'order',
            entityId: orderId,
            after: {
                channel,
                recipient: paymentRequest.smsRecipient,
                payment_url: paymentRequest.paymentUrl,
            },
        })

        return {
            success: true,
            channel,
            paymentUrl: paymentRequest.paymentUrl,
            deliveryId: delivery.deliveryId,
            recipient: paymentRequest.smsRecipient,
        }
    } catch (error) {
        await updatePaymentRequestDeliveryLog({
            supabase,
            id: deliveryLogId,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Could not send payment request.',
        })
        revalidatePath(`/admin/orders/${orderId}`)
        return {
            error: error instanceof Error ? error.message : 'Could not send payment request.',
        }
    }
}
