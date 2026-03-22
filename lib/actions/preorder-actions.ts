'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { sendPaymentRequestEmail, sendPaymentRequestSms } from '@/lib/server/payment-request-delivery'

const ALLOWED_PREORDER_STATUSES = ['pending', 'fulfilled', 'cancelled'] as const

export type PreorderStatus = (typeof ALLOWED_PREORDER_STATUSES)[number]
type PaymentRequestChannel = 'email' | 'sms'

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
            quantity,
            status,
            created_at,
            orders ( id, order_number, financial_status ),
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
    await requireActionPermission('manage_orders')

    if (!ALLOWED_PREORDER_STATUSES.includes(status)) {
        return { error: 'Invalid preorder status.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
        .from('preorders')
        .update({ status })
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/admin/preorders')
    revalidatePath('/admin/customers')

    return { success: true }
}

export async function createPaymentOrderFromPreorder(id: string) {
    await requireActionPermission('manage_orders')
    const supabase = await createClient()

    const { data: preorder, error } = await supabase
        .from('preorders')
        .select(`
            id,
            customer_id,
            variant_id,
            order_id,
            quantity,
            status,
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
                price,
                products (
                    title
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
        return { success: true, orderId: preorder.order_id, alreadyExists: true }
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

    const unitPrice = Number(variant?.price || 0)
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
            guest_email: customerEmail,
            guest_name: customerName,
            guest_phone: customerPhone,
            financial_status: 'pending',
            fulfillment_status: 'unfulfilled',
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

    const { error: orderItemError } = await supabase
        .from('order_items')
        .insert({
            order_id: order.id,
            variant_id: preorder.variant_id,
            title: product?.title || 'Preorder item',
            sku: variant?.sku || preorder.variant_id,
            quantity,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
        })

    if (orderItemError) {
        return { error: orderItemError.message }
    }

    const { error: updateError } = await supabase
        .from('preorders')
        .update({
            status: 'fulfilled',
            order_id: order.id,
        })
        .eq('id', preorder.id)

    if (updateError) {
        return { error: updateError.message }
    }

    revalidatePath('/admin/preorders')
    revalidatePath('/admin/orders')

    return { success: true, orderId: order.id, orderNumber: order.order_number, alreadyExists: false }
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
        .select('id, order_number, guest_email, guest_phone, financial_status, payment_request_token')
        .eq('id', orderId)
        .single()

    if (error || !order) {
        return { error: error?.message || 'Order not found.' }
    }

    if (order.financial_status === 'paid') {
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
    await requireActionPermission('manage_orders')
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
