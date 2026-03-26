'use server'

import { cache } from 'react'
import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { buildOrderInvoiceUrl, sendCustomerWelcomeEmail, sendPosOrderThankYouEmail } from '@/lib/server/customer-email'
import { notifyLowStock, notifyNewOrder, notifyPaymentFailure } from '@/lib/notify'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'
import {
    canEditOrderLineItems,
    canTransitionFulfillmentStatus,
    getDefaultFulfillmentStatus,
    getLegacyFulfillmentWriteValue,
    getValidFulfillmentTransitions,
    isOrderPaymentStatus,
    isShippingRelevant,
    normalizeOrderChannel,
    normalizeOrderFulfillmentStatus,
    normalizeOrderPaymentStatus,
    type OrderChannel,
    type OrderFulfillmentStatus,
    type OrderPaymentStatus,
} from '@/lib/orders/workflow'

type CustomerSummary = {
    id?: string | null
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
}

type RawOrderRow = Record<string, unknown> & {
    id: string
    order_number?: string | number | null
    created_at: string
    guest_email?: string | null
    guest_phone?: string | null
    order_items?: Array<Record<string, unknown>> | null
}

type OrderDetailRow = RawOrderRow & {
    customers?: CustomerSummary | null
    order_addresses?: {
        id: string
        full_name?: string | null
        phone?: string | null
        address_line?: string | null
        city?: string | null
        state?: string | null
        pincode?: string | null
    }[] | null
    payment_request_deliveries?: {
        id: string
        channel: 'email' | 'sms'
        provider: string
        recipient: string
        status: 'processing' | 'sent' | 'failed'
        provider_reference?: string | null
        error_message?: string | null
        payment_url: string
        created_at: string
    }[]
    order_items?: {
        id: string
        variant_id?: string | null
        quantity: number
        unit_price: number | string
        total_price: number | string
        discount_amount?: number | string | null
        product_variants?: {
            id: string
            sku?: string | null
            products?: {
                title?: string | null
                product_media?: Array<{ media_url?: string | null }> | null
            } | null
        } | null
    }[]
}

type LegacyOrderAddressRow = {
    id: string
    full_name?: string | null
    phone?: string | null
    address_line?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
}

type OrderInsertCandidate = Record<string, string | number | null>
type OrderItemInsertCandidate = Record<string, string | number | null | Array<unknown>>
type OrderStatusUpdateCandidate = Record<string, string>
type OrderUpdateCandidate = Record<string, string | number | null | string[] | Record<string, unknown>>

type OrderItemSchemaCapabilities = {
    hasDiscountAmount: boolean
    hasProductSlug: boolean
    hasImageUrl: boolean
    hasVariantTitle: boolean
    hasVariantOptions: boolean
}

export type EditableOrderHeaderInput = {
    orderId: string
    customerId?: string | null
    paymentMethod?: string | null
    notes?: string | null
    salesChannel?: OrderChannel
    guestName?: string | null
    guestEmail?: string | null
    guestPhone?: string | null
    billingAddress?: Record<string, unknown> | null
    shippingAddress?: Record<string, unknown> | null
    tags?: string[]
}

export type EditableShipmentInput = {
    orderId: string
    trackingId?: string | null
    courier?: string | null
    deliveryStatus?: string | null
    shippedAt?: string | null
    deliveredAt?: string | null
    deliveryNotes?: string | null
    shippingCharge?: number | null
}

export type EditableOrderLineInput = {
    variantId: string
    quantity: number
    unitPrice: number
    discountAmount?: number
    title?: string
    sku?: string | null
    productSlug?: string | null
    imageUrl?: string | null
    variantTitle?: string | null
    variantOptions?: Array<{ name: string; value: string }>
}

export type OrderTimelineEntry = {
    id: string
    action: string
    entityId: string
    actorId?: string | null
    actorLabel?: string | null
    before?: unknown
    after?: unknown
    createdAt: string
}

type OrderContactDetails = {
    fullName: string
    email: string
    phone: string
}

type OrderSchemaCapabilities = {
    hasCustomerId: boolean
    hasUserId: boolean
    hasSubtotal: boolean
    hasDiscountAmount: boolean
    hasDiscountTotal: boolean
    hasTaxAmount: boolean
    hasTaxTotal: boolean
    hasShippingTotal: boolean
    hasStatus: boolean
    hasFulfillmentStatus: boolean
    hasPaymentStatus: boolean
    hasFinancialStatus: boolean
    hasTotalAmount: boolean
    hasGrandTotal: boolean
    hasSalesChannel: boolean
    hasOrderType: boolean
    hasGuestEmail: boolean
    hasGuestPhone: boolean
    hasPaymentMethod: boolean
    hasNotes: boolean
    hasUpdatedAt: boolean
    hasCurrency: boolean
    hasGuestName: boolean
    hasTrackingId: boolean
    hasDeliveryStatus: boolean
    hasShippingCharge: boolean
    hasShippingAddress: boolean
    hasBillingAddress: boolean
    hasTags: boolean
    hasCourier: boolean
    hasShippedAt: boolean
    hasDeliveredAt: boolean
    hasDeliveryNotes: boolean
}

export type OrderRecord = {
    id: string
    order_number?: string | number | null
    created_at: string
    updated_at?: string | null
    status: string
    payment_status: string
    total_amount: number
    sales_channel: 'online' | 'pos'
    payment_method?: string | null
    order_type?: string | null
    item_count: number
    customer_id?: string | null
    customer_type: 'registered' | 'guest' | 'walk-in'
    customer_label: string
    customer_name?: string | null
    customer_email?: string | null
    customer_phone?: string | null
    guest_email?: string | null
    guest_phone?: string | null
    notes?: string | null
    currency?: string | null
    subtotal_amount: number
    discount_amount: number
    tax_amount: number
    shipping_amount: number
    shipping_address?: Record<string, unknown> | null
    billing_address?: Record<string, unknown> | null
    data_issues: string[]
    payment_request_token?: string | null
    guest_name?: string | null
    tracking_id?: string | null
    delivery_status?: string | null
    shipping_charge?: number
    tags: string[]
    courier?: string | null
    shipped_at?: string | null
    delivered_at?: string | null
    delivery_notes?: string | null
    customers?: CustomerSummary | null
    order_items?: OrderDetailRow['order_items']
    payment_request_deliveries?: OrderDetailRow['payment_request_deliveries']
}

type GetOrdersParams = {
    query?: string
    page?: number
    limit?: number
    status?: string
    fulfillmentStatus?: string
    paymentStatus?: string
    salesChannel?: 'all' | 'pos' | 'online'
    customerType?: 'all' | 'registered' | 'guest' | 'walk-in'
    paymentMethod?: string
    dateFrom?: string
    dateTo?: string
    minAmount?: number
    maxAmount?: number
    sortBy?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
}

const ORDER_COLUMN_PROBES = [
    'customer_id',
    'user_id',
    'subtotal',
    'discount_amount',
    'discount_total',
    'tax_amount',
    'tax_total',
    'shipping_total',
    'status',
    'fulfillment_status',
    'payment_status',
    'financial_status',
    'total_amount',
    'grand_total',
    'sales_channel',
    'order_type',
    'guest_email',
    'guest_phone',
    'payment_method',
    'notes',
    'updated_at',
    'currency',
    'guest_name',
    'tracking_id',
    'delivery_status',
    'shipping_charge',
    'shipping_address',
    'billing_address',
    'tags',
    'courier',
    'shipped_at',
    'delivered_at',
    'delivery_notes',
] as const

const ORDER_ITEM_COLUMN_PROBES = [
    'discount_amount',
    'product_slug',
    'image_url',
    'variant_title',
    'variant_options',
] as const

const getOrderSchemaCapabilities = cache(async (): Promise<OrderSchemaCapabilities> => {
    const admin = createAdminClient()
    const results = await Promise.all(
        ORDER_COLUMN_PROBES.map(async (column) => {
            const { error } = await admin.from('orders').select(column).limit(1)
            return [column, !error] as const
        })
    )

    const available = new Set(results.filter(([, exists]) => exists).map(([column]) => column))

    return {
        hasCustomerId: available.has('customer_id'),
        hasUserId: available.has('user_id'),
        hasSubtotal: available.has('subtotal'),
        hasDiscountAmount: available.has('discount_amount'),
        hasDiscountTotal: available.has('discount_total'),
        hasTaxAmount: available.has('tax_amount'),
        hasTaxTotal: available.has('tax_total'),
        hasShippingTotal: available.has('shipping_total'),
        hasStatus: available.has('status'),
        hasFulfillmentStatus: available.has('fulfillment_status'),
        hasPaymentStatus: available.has('payment_status'),
        hasFinancialStatus: available.has('financial_status'),
        hasTotalAmount: available.has('total_amount'),
        hasGrandTotal: available.has('grand_total'),
        hasSalesChannel: available.has('sales_channel'),
        hasOrderType: available.has('order_type'),
        hasGuestEmail: available.has('guest_email'),
        hasGuestPhone: available.has('guest_phone'),
        hasPaymentMethod: available.has('payment_method'),
        hasNotes: available.has('notes'),
        hasUpdatedAt: available.has('updated_at'),
        hasCurrency: available.has('currency'),
        hasGuestName: available.has('guest_name'),
        hasTrackingId: available.has('tracking_id'),
        hasDeliveryStatus: available.has('delivery_status'),
        hasShippingCharge: available.has('shipping_charge'),
        hasShippingAddress: available.has('shipping_address'),
        hasBillingAddress: available.has('billing_address'),
        hasTags: available.has('tags'),
        hasCourier: available.has('courier'),
        hasShippedAt: available.has('shipped_at'),
        hasDeliveredAt: available.has('delivered_at'),
        hasDeliveryNotes: available.has('delivery_notes'),
    }
})

const getOrderItemSchemaCapabilities = cache(async (): Promise<OrderItemSchemaCapabilities> => {
    const admin = createAdminClient()
    const results = await Promise.all(
        ORDER_ITEM_COLUMN_PROBES.map(async (column) => {
            const { error } = await admin.from('order_items').select(column).limit(1)
            return [column, !error] as const
        })
    )

    const available = new Set(results.filter(([, exists]) => exists).map(([column]) => column))

    return {
        hasDiscountAmount: available.has('discount_amount'),
        hasProductSlug: available.has('product_slug'),
        hasImageUrl: available.has('image_url'),
        hasVariantTitle: available.has('variant_title'),
        hasVariantOptions: available.has('variant_options'),
    }
})

function getStringField(order: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
        const value = order[key]
        if (typeof value === 'string' && value.trim().length > 0) {
            return value
        }
    }

    return null
}

function buildVariantOptionSnapshot(
    variantOptionValues?: Array<{
        product_option_values?: {
            value?: string | null
            product_options?: { name?: string | null } | Array<{ name?: string | null }> | null
        } | Array<{
            value?: string | null
            product_options?: { name?: string | null } | Array<{ name?: string | null }> | null
        }> | null
    }> | null
) {
    return (variantOptionValues || [])
        .map((entry) => {
            const optionValueRow = Array.isArray(entry.product_option_values)
                ? entry.product_option_values[0]
                : entry.product_option_values
            const optionRow = Array.isArray(optionValueRow?.product_options)
                ? optionValueRow?.product_options[0]
                : optionValueRow?.product_options
            const optionName = optionRow?.name
            const optionValue = optionValueRow?.value

            if (!optionName || !optionValue) {
                return null
            }

            return { name: optionName, value: optionValue }
        })
        .filter((entry): entry is { name: string; value: string } => Boolean(entry))
}

function buildVariantLabelFromSnapshot(variantTitle?: string | null, options: Array<{ name: string; value: string }> = []) {
    if (variantTitle && variantTitle !== 'Default Variant') {
        return variantTitle
    }

    if (options.length === 0) {
        return 'Default Variant'
    }

    return options.map((option) => `${option.name}: ${option.value}`).join(' / ')
}

function getObjectField(order: Record<string, unknown>, key: string) {
    const value = order[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>
        const hasMeaningfulValue = Object.values(record).some((entry) => {
            if (typeof entry === 'string') {
                return entry.trim().length > 0
            }

            return entry !== null && entry !== undefined
        })

        return hasMeaningfulValue ? record : null
    }

    return null
}

function getNumberField(order: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
        const value = order[key]
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value
        }

        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) {
                return parsed
            }
        }
    }

    return null
}

function getOrderTotal(order: Record<string, unknown>) {
    const totalAmount = getNumberField(order, 'total_amount')
    const grandTotal = getNumberField(order, 'grand_total')

    if (typeof totalAmount === 'number' && totalAmount > 0) {
        return totalAmount
    }

    if (typeof grandTotal === 'number' && grandTotal > 0) {
        return grandTotal
    }

    const subtotal = getNumberField(order, 'subtotal', 'subtotal_amount') ?? 0
    const discount = getOrderDiscount(order)
    const tax = getOrderTax(order)
    const shipping = getOrderShipping(order)
    const fallback = subtotal - discount + tax + shipping

    return Number.isFinite(fallback) ? fallback : 0
}

function getOrderSubtotal(order: Record<string, unknown>) {
    return getNumberField(order, 'subtotal', 'subtotal_amount') ?? getOrderTotal(order)
}

function getOrderDiscount(order: Record<string, unknown>) {
    return getNumberField(order, 'discount_amount', 'discount_total') ?? 0
}

function getOrderTax(order: Record<string, unknown>) {
    return getNumberField(order, 'tax_amount', 'tax_total') ?? 0
}

function getOrderShipping(order: Record<string, unknown>) {
    return getNumberField(order, 'shipping_amount', 'shipping_total', 'shipping_charge') ?? 0
}

function getFulfillmentStatus(order: Record<string, unknown>): OrderFulfillmentStatus {
    const channel = inferSalesChannel(order)
    const canonicalRaw = getStringField(order, 'status')
    const legacyRaw = getStringField(order, 'fulfillment_status')
    const canonical = normalizeOrderFulfillmentStatus(channel, canonicalRaw)
    const legacy = legacyRaw ? normalizeOrderFulfillmentStatus(channel, legacyRaw) : null

    if (canonicalRaw) {
        return canonical
    }

    return legacy ?? getDefaultFulfillmentStatus(channel)
}

function getFinancialStatus(order: Record<string, unknown>): OrderPaymentStatus {
    const canonicalRaw = getStringField(order, 'payment_status')
    const legacyRaw = getStringField(order, 'financial_status')
    const canonical = canonicalRaw ? normalizeOrderPaymentStatus(canonicalRaw) : null
    const legacy = legacyRaw ? normalizeOrderPaymentStatus(legacyRaw) : null

    if (canonical) {
        return canonical
    }

    return legacy ?? 'unpaid'
}

function normalizeCustomer(
    customer?: CustomerSummary | null,
    guestName?: string | null,
    guestEmail?: string | null,
    guestPhone?: string | null,
    userId?: string | null
) {
    if (customer) {
        return customer
    }

    if (userId && (guestName || guestEmail || guestPhone)) {
        const parts = normalizeNullableString(guestName)?.split(/\s+/) ?? []
        const [firstName = 'Registered', ...rest] = parts

        return {
            id: userId,
            first_name: firstName,
            last_name: rest.join(' ') || null,
            email: guestEmail ?? null,
            phone: guestPhone ?? null,
        }
    }

    if (guestEmail || guestPhone) {
        return {
            first_name: 'Guest',
            last_name: '',
            email: guestEmail ?? null,
            phone: guestPhone ?? null,
        }
    }

    return null
}

function getCustomerType(
    customer: CustomerSummary | null,
    guestEmail?: string | null,
    guestPhone?: string | null,
    channel?: string | null,
    userId?: string | null
) {
    if (customer?.id) {
        return 'registered' as const
    }

    if (userId) {
        return 'registered' as const
    }

    if (guestEmail || guestPhone) {
        return 'guest' as const
    }

    if (channel === 'pos') {
        return 'walk-in' as const
    }

    return 'guest' as const
}

function inferSalesChannel(order: Record<string, unknown>): OrderChannel {
    const guestEmail = getStringField(order, 'guest_email')
    const guestPhone = getStringField(order, 'guest_phone')
    const paymentToken = getStringField(order, 'payment_request_token')
    const salesChannel = normalizeOrderChannel(getStringField(order, 'sales_channel'))
    const orderType = normalizeOrderChannel(getStringField(order, 'order_type'))

    if (salesChannel === 'pos' || orderType === 'pos') {
        return 'pos'
    }

    if (salesChannel === 'online' || orderType === 'online') {
        return 'online'
    }

    if (paymentToken) {
        return 'online'
    }

    if (getStringField(order, 'payment_method')) {
        return 'pos'
    }

    if (guestEmail || guestPhone) {
        return 'online'
    }

    return getStringField(order, 'customer_id', 'user_id') ? 'online' : 'pos'
}

function getItemCount(order: RawOrderRow) {
    if (!Array.isArray(order.order_items)) {
        return 0
    }

    const [firstItem] = order.order_items
    if (firstItem && 'count' in firstItem) {
        const relationCount = Number(firstItem.count ?? 0)
        return Number.isFinite(relationCount) ? relationCount : 0
    }

    return order.order_items.length
}

function areNumbersDifferent(left: number | null, right: number | null) {
    if (left === null || right === null) {
        return false
    }

    return Math.abs(left - right) > 0.009
}

function normalizeNullableString(value: string | null | undefined) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function normalizeEmail(value: string | null | undefined) {
    const normalized = normalizeNullableString(value)?.toLowerCase() ?? null
    if (!normalized) {
        return null
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

function normalizePhone(value: string | null | undefined) {
    const normalized = normalizeNullableString(value)
    if (!normalized) {
        return null
    }

    const digits = normalized.replace(/\D/g, '')
    return digits.length >= 10 ? normalized : null
}

async function resolveMandatoryOrderContact(
    admin: ReturnType<typeof createAdminClient>,
    input: {
        customerId?: string | null
        guestName?: string | null
        guestEmail?: string | null
        guestPhone?: string | null
    }
): Promise<{ data: OrderContactDetails | null; error: string | null; customer: CustomerSummary | null }> {
    let customer: CustomerSummary | null = null

    if (input.customerId) {
        const { data, error } = await admin
            .from('customers')
            .select('id, first_name, last_name, email, phone')
            .eq('id', input.customerId)
            .single()

        if (error || !data) {
            return { data: null, error: 'Selected customer could not be found.', customer: null }
        }

        customer = data
    }

    const fallbackFullName = [customer?.first_name, customer?.last_name]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(' ')
        .trim()
    const fullName = normalizeNullableString(input.guestName) ?? (fallbackFullName || null)
    const email = normalizeEmail(input.guestEmail) ?? normalizeEmail(customer?.email)
    const phone = normalizePhone(input.guestPhone) ?? normalizePhone(customer?.phone)

    if (!fullName || !email || !phone) {
        return {
            data: null,
            error: 'Customer name, email, and phone are required for both POS and online orders.',
            customer,
        }
    }

    return {
        data: { fullName, email, phone },
        error: null,
        customer,
    }
}

function normalizeNullableNumber(value: number | null | undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null
    }

    return Number(value.toFixed(2))
}

function sanitizeTags(tags?: string[] | null) {
    return Array.from(
        new Set(
            (tags ?? [])
                .map((tag) => tag.trim())
                .filter(Boolean)
        )
    )
}

function sanitizeAddress(value?: Record<string, unknown> | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }

    const nextEntries = Object.entries(value).flatMap(([key, rawValue]) => {
        if (typeof rawValue !== 'string') {
            return []
        }

        const normalized = rawValue.trim()
        return normalized ? [[key, normalized] as const] : []
    })

    if (nextEntries.length === 0) {
        return null
    }

    return Object.fromEntries(nextEntries)
}

function buildFulfillmentWritePayload(
    capabilities: OrderSchemaCapabilities,
    channel: OrderChannel,
    status: OrderFulfillmentStatus
) {
    const payload: OrderUpdateCandidate = {}
    const writeValue = getLegacyFulfillmentWriteValue(channel, status)

    if (capabilities.hasStatus) {
        payload.status = writeValue
    }

    if (capabilities.hasFulfillmentStatus) {
        payload.fulfillment_status = writeValue
    }

    if (capabilities.hasDeliveryStatus && channel === 'online') {
        payload.delivery_status = writeValue
    }

    return payload
}

function buildPaymentWritePayload(capabilities: OrderSchemaCapabilities, status: string) {
    const payload: OrderUpdateCandidate = {}

    if (capabilities.hasPaymentStatus) {
        payload.payment_status = status
    }

    if (capabilities.hasFinancialStatus) {
        payload.financial_status = status
    }

    return payload
}

function buildChannelWritePayload(capabilities: OrderSchemaCapabilities, channel: OrderChannel) {
    const payload: OrderUpdateCandidate = {}

    if (capabilities.hasSalesChannel) {
        payload.sales_channel = channel
    }

    if (capabilities.hasOrderType) {
        payload.order_type = channel
    }

    return payload
}

function buildAmountWritePayload(
    capabilities: OrderSchemaCapabilities,
    values: {
        subtotal: number
        discountTotal: number
        taxTotal: number
        shippingTotal: number
        grandTotal: number
    }
) {
    const payload: OrderUpdateCandidate = {}

    if (capabilities.hasSubtotal) {
        payload.subtotal = values.subtotal
    }

    if (capabilities.hasDiscountTotal) {
        payload.discount_total = values.discountTotal
    }

    if (capabilities.hasTaxTotal) {
        payload.tax_total = values.taxTotal
    }

    if (capabilities.hasShippingTotal) {
        payload.shipping_total = values.shippingTotal
    }

    if (capabilities.hasTotalAmount) {
        payload.total_amount = values.grandTotal
    }

    if (capabilities.hasGrandTotal) {
        payload.grand_total = values.grandTotal
    }

    if (capabilities.hasDiscountAmount) {
        payload.discount_amount = values.discountTotal
    }

    if (capabilities.hasTaxAmount) {
        payload.tax_amount = values.taxTotal
    }

    if (capabilities.hasShippingCharge) {
        payload.shipping_charge = values.shippingTotal
    }

    return payload
}

async function revalidateOrderPaths(orderId: string) {
    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath(`/admin/orders/${orderId}/invoice`)
}

function getOrderDataIssues(order: RawOrderRow, customer: CustomerSummary | null, channel: 'online' | 'pos') {
    const issues: string[] = []
    const rawStatusValue = getStringField(order, 'status')
    const rawFulfillmentValue = getStringField(order, 'fulfillment_status')
    const rawStatus = rawStatusValue ? normalizeOrderFulfillmentStatus(channel, rawStatusValue) : null
    const rawFulfillment = rawFulfillmentValue ? normalizeOrderFulfillmentStatus(channel, rawFulfillmentValue) : null
    const rawPayment = getStringField(order, 'payment_status') ? normalizeOrderPaymentStatus(getStringField(order, 'payment_status')) : null
    const rawFinancial = getStringField(order, 'financial_status') ? normalizeOrderPaymentStatus(getStringField(order, 'financial_status')) : null
    const rawChannel = normalizeOrderChannel(getStringField(order, 'sales_channel'))
    const rawOrderType = normalizeOrderChannel(getStringField(order, 'order_type'))
    const rawCustomerId = getStringField(order, 'customer_id')
    const userId = getStringField(order, 'user_id')
    const guestEmail = getStringField(order, 'guest_email')
    const guestPhone = getStringField(order, 'guest_phone')

    if (rawStatus && rawFulfillment && rawStatus !== rawFulfillment) {
        issues.push('Fulfillment fields are out of sync')
    }

    if (rawPayment && rawFinancial && rawPayment !== rawFinancial) {
        issues.push('Payment fields are out of sync')
    }

    if (areNumbersDifferent(getNumberField(order, 'total_amount'), getNumberField(order, 'grand_total'))) {
        issues.push('Amount fields are out of sync')
    }

    if (rawChannel && rawOrderType && rawChannel !== rawOrderType) {
        issues.push('Channel fields are out of sync')
    }

    if (channel === 'online' && !customer?.id && !userId && !guestEmail && !guestPhone) {
        issues.push('Online order has no customer contact')
    }

    if (rawCustomerId && !customer?.id) {
        issues.push('Customer link points to a missing customer record')
    }

    if (getOrderTotal(order) <= 0) {
        issues.push('Order total is zero')
    }

    if (getItemCount(order) === 0) {
        issues.push('Order has no items')
    }

    return issues
}

function getFulfillmentFilterValues(channel: OrderChannel, status: string) {
    const normalized = normalizeOrderFulfillmentStatus(channel, status)

    if (channel === 'pos') {
        switch (normalized) {
            case 'completed':
                return ['completed', 'delivered', 'shipped', 'fulfilled']
            default:
                return [normalized]
        }
    }

    switch (normalized) {
        case 'delivered':
            return ['delivered', 'completed', 'fulfilled']
        case 'shipped':
            return ['shipped', 'in_transit']
        case 'pending':
            return ['pending', 'unfulfilled']
        default:
            return [normalized]
    }
}

function normalizeOrderSummary(order: RawOrderRow, customer?: CustomerSummary | null): OrderRecord {
    const channel = inferSalesChannel(order)
    const guestName = getStringField(order, 'guest_name')
    const guestEmail = getStringField(order, 'guest_email')
    const guestPhone = getStringField(order, 'guest_phone')
    const userId = getStringField(order, 'user_id')
    const normalizedCustomer = normalizeCustomer(customer, guestName, guestEmail, guestPhone, userId)
    const customerName = [normalizedCustomer?.first_name, normalizedCustomer?.last_name].filter(Boolean).join(' ').trim()
    const dataIssues = getOrderDataIssues(order, customer ?? null, channel)

    return {
        id: order.id,
        order_number: order.order_number ?? null,
        created_at: order.created_at,
        updated_at: getStringField(order, 'updated_at'),
        status: getFulfillmentStatus(order),
        payment_status: getFinancialStatus(order),
        total_amount: getOrderTotal(order),
        sales_channel: channel,
        payment_method: getStringField(order, 'payment_method'),
        order_type: getStringField(order, 'order_type'),
        item_count: getItemCount(order),
        customer_id: getStringField(order, 'customer_id'),
        customer_type: getCustomerType(customer ?? null, guestEmail, guestPhone, channel, userId),
        customer_label: customerName || guestName || normalizedCustomer?.email || normalizedCustomer?.phone || (channel === 'pos' ? 'Walk-in POS' : 'Guest Checkout'),
        customer_name: customerName || guestName || null,
        customer_email: normalizedCustomer?.email ?? null,
        customer_phone: normalizedCustomer?.phone ?? guestPhone ?? null,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        notes: getStringField(order, 'notes'),
        currency: getStringField(order, 'currency'),
        subtotal_amount: getOrderSubtotal(order),
        discount_amount: getOrderDiscount(order),
        tax_amount: getOrderTax(order),
        shipping_amount: getOrderShipping(order),
        shipping_address: getObjectField(order, 'shipping_address'),
        billing_address: getObjectField(order, 'billing_address'),
        data_issues: dataIssues,
        payment_request_token: getStringField(order, 'payment_request_token'),
        guest_name: getStringField(order, 'guest_name'),
        tracking_id: getStringField(order, 'tracking_id'),
        delivery_status: getStringField(order, 'delivery_status'),
        shipping_charge: getOrderShipping(order),
        tags: Array.isArray(order.tags) ? order.tags.filter((value): value is string => typeof value === 'string') : [],
        courier: getStringField(order, 'courier'),
        shipped_at: getStringField(order, 'shipped_at'),
        delivered_at: getStringField(order, 'delivered_at'),
        delivery_notes: getStringField(order, 'delivery_notes'),
        customers: normalizedCustomer,
    }
}

function normalizeOrderDetail(order: OrderDetailRow, customer?: CustomerSummary | null) {
    const normalized = normalizeOrderSummary(order, customer)
    const legacyAddress = mapLegacyOrderAddress(order.order_addresses?.[0] ?? null)

    return {
        ...normalized,
        billing_address: normalized.billing_address ?? legacyAddress,
        shipping_address: normalized.shipping_address ?? legacyAddress,
        order_items: order.order_items ?? [],
        payment_request_deliveries: order.payment_request_deliveries ?? [],
    }
}

function mapLegacyOrderAddress(address?: LegacyOrderAddressRow | null) {
    if (!address) {
        return null
    }

    const normalized = {
        name: typeof address.full_name === 'string' ? address.full_name.trim() : '',
        line1: typeof address.address_line === 'string' ? address.address_line.trim() : '',
        line2: '',
        city: typeof address.city === 'string' ? address.city.trim() : '',
        state: typeof address.state === 'string' ? address.state.trim() : '',
        postal_code: typeof address.pincode === 'string' ? address.pincode.trim() : '',
        country: 'India',
        phone: typeof address.phone === 'string' ? address.phone.trim() : '',
    }

    return Object.values(normalized).some((value) => value.length > 0) ? normalized : null
}

async function loadCustomerMap(customerIds: string[]) {
    const uniqueCustomerIds = Array.from(new Set(customerIds.filter(Boolean)))
    const customerMap = new Map<string, CustomerSummary>()

    if (uniqueCustomerIds.length === 0) {
        return customerMap
    }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('customers')
        .select('id, first_name, last_name, email, phone')
        .in('id', uniqueCustomerIds)

    if (error) {
        console.error('Error fetching order customers:', error)
        return customerMap
    }

    for (const customer of data ?? []) {
        customerMap.set(customer.id, customer)
    }

    return customerMap
}

async function findMatchingCustomerIds(searchTerm: string) {
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('customers')
        .select('id')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(50)

    if (error) {
        console.error('Error searching customers for orders:', error)
        return []
    }

    return (data ?? []).map((row) => row.id).filter(Boolean)
}

async function findUniqueCustomerMatch(admin: ReturnType<typeof createAdminClient>, guestEmail?: string | null, guestPhone?: string | null) {
    const email = guestEmail?.trim().toLowerCase()
    const phone = guestPhone?.trim()
    const emailMatches = new Set<string>()
    const phoneMatches = new Set<string>()

    if (email) {
        const { data } = await admin
            .from('customers')
            .select('id, email')
            .ilike('email', email)
            .limit(3)

        for (const customer of data ?? []) {
            if (customer.email?.trim().toLowerCase() === email) {
                emailMatches.add(customer.id)
            }
        }
    }

    if (phone) {
        const { data } = await admin
            .from('customers')
            .select('id, phone')
            .eq('phone', phone)
            .limit(3)

        for (const customer of data ?? []) {
            if (customer.phone?.trim() === phone) {
                phoneMatches.add(customer.id)
            }
        }
    }

    if (emailMatches.size === 1 && phoneMatches.size === 0) {
        return Array.from(emailMatches)[0]
    }

    if (phoneMatches.size === 1 && emailMatches.size === 0) {
        return Array.from(phoneMatches)[0]
    }

    if (emailMatches.size === 1 && phoneMatches.size === 1) {
        const [emailId] = Array.from(emailMatches)
        const [phoneId] = Array.from(phoneMatches)
        return emailId === phoneId ? emailId : null
    }

    return null
}

async function tryInsertOrder(
    supabase: Awaited<ReturnType<typeof createClient>>,
    candidates: OrderInsertCandidate[]
) {
    let lastError: { message: string } | null = null

    for (const candidate of candidates) {
        const { data, error } = await supabase.from('orders').insert(candidate).select().single()
        if (!error) {
            return { data, error: null }
        }

        lastError = error
    }

    return { data: null, error: lastError }
}

async function tryInsertOrderItems(
    supabase: Awaited<ReturnType<typeof createClient>>,
    candidates: OrderItemInsertCandidate[][]
) {
    let lastError: { message: string } | null = null

    for (const candidate of candidates) {
        const { error } = await supabase.from('order_items').insert(candidate)
        if (!error) {
            return { error: null }
        }

        lastError = error
    }

    return { error: lastError }
}

async function tryUpdateOrderStatus(
    supabase: Awaited<ReturnType<typeof createClient>>,
    id: string,
    candidates: OrderStatusUpdateCandidate[]
) {
    let lastError: { message: string } | null = null

    for (const candidate of candidates) {
        const { error } = await supabase.from('orders').update(candidate).eq('id', id)
        if (!error) {
            return { error: null }
        }

        lastError = error
    }

    return { error: lastError }
}

async function tryUpdateOrder(
    supabase: Awaited<ReturnType<typeof createClient>>,
    id: string,
    candidates: OrderUpdateCandidate[]
) {
    let lastError: { message: string } | null = null

    for (const candidate of candidates) {
        const { error } = await supabase.from('orders').update(candidate).eq('id', id)
        if (!error) {
            return { error: null }
        }

        lastError = error
    }

    return { error: lastError }
}

async function getStoreMailContext(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data } = await supabase
        .from('app_settings')
        .select('store_name, store_email')
        .single()

    return {
        storeName: data?.store_name || 'Cluster Fascination',
        replyTo: data?.store_email || null,
    }
}

// --- CUSTOMERS ---

export async function getCustomers(params?: { query?: string; page?: number; limit?: number }) {
    const { query = '', page = 1, limit = 20 } = params || {}
    await requireActionPermission(['manage_orders', 'manage_customers', 'access_pos'])
    const supabase = await createClient()
    const { from, to } = getPagination({ page, limit, defaultLimit: 20, maxLimit: 50 })
    const searchTerm = normalizeSearchTerm(query)
    let dbQuery = supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchTerm) {
        dbQuery = dbQuery.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
    }

    const { data, error, count } = await dbQuery
    if (error) {
        console.error('Error fetching customers:', error)
        return { data: [], count: 0, error: error.message }
    }
    return { data: data || [], count: count || 0, error: null }
}

export async function createCustomer(formData: FormData) {
    await requireActionPermission(['manage_orders', 'manage_customers', 'access_pos'])
    const supabase = await createClient()
    const email = normalizeEmail(formData.get('email') as string | null)
    const phone = normalizePhone(formData.get('phone') as string | null)
    const firstName = normalizeNullableString(formData.get('first_name') as string | null)

    if (!firstName || !email || !phone) {
        return { error: 'Customer first name, email, and phone are required.' }
    }

    const data = {
        first_name: firstName,
        last_name: normalizeNullableString(formData.get('last_name') as string | null),
        email,
        phone,
        addresses: [], // Can handle complex address logic later if needed
    }

    const { data: newCustomer, error } = await supabase.from('customers').insert(data).select().single()

    if (error) return { error: error.message }

    try {
        const mailContext = await getStoreMailContext(supabase)
        await sendCustomerWelcomeEmail({
            to: email,
            customerName: [newCustomer.first_name, newCustomer.last_name].filter(Boolean).join(' ').trim() || newCustomer.first_name || 'Customer',
            storeName: mailContext.storeName,
            replyTo: mailContext.replyTo,
        })
    } catch (mailError) {
        console.error('Customer welcome email failed:', mailError)
    }

    return { success: true, customer: newCustomer }
}

// --- ORDERS ---

export async function getOrders({
    query = '',
    page = 1,
    limit = 20,
    status,
    fulfillmentStatus,
    paymentStatus,
    salesChannel = 'all',
    customerType = 'all',
    paymentMethod,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    sortBy = 'newest',
}: GetOrdersParams) {
    await requireActionPermission(['manage_orders', 'access_pos'])
    const capabilities = await getOrderSchemaCapabilities()
    const admin = createAdminClient()
    const { from, to } = getPagination({ page, limit, defaultLimit: 20, maxLimit: 50 })
    const searchTerm = normalizeSearchTerm(query)
    const normalizedFulfillmentStatus = normalizeSearchTerm(fulfillmentStatus ?? status)
    const normalizedPaymentStatus = normalizeSearchTerm(paymentStatus)
    const normalizedPaymentMethod = normalizeSearchTerm(paymentMethod)
    const amountColumn = capabilities.hasTotalAmount ? 'total_amount' : capabilities.hasGrandTotal ? 'grand_total' : null
    const fulfillmentColumn = capabilities.hasStatus ? 'status' : capabilities.hasFulfillmentStatus ? 'fulfillment_status' : null
    const paymentColumn = capabilities.hasPaymentStatus ? 'payment_status' : capabilities.hasFinancialStatus ? 'financial_status' : null
    const channelColumn = capabilities.hasSalesChannel ? 'sales_channel' : capabilities.hasOrderType ? 'order_type' : null

    let dbQuery = admin
        .from('orders')
        .select('*, order_items(count)', { count: 'exact' })
        .range(from, to)

    if (sortBy === 'oldest') {
        dbQuery = dbQuery.order('created_at', { ascending: true })
    } else if (sortBy === 'amount_asc' && amountColumn) {
        dbQuery = dbQuery.order(amountColumn, { ascending: true, nullsFirst: false })
    } else if (sortBy === 'amount_desc' && amountColumn) {
        dbQuery = dbQuery.order(amountColumn, { ascending: false, nullsFirst: false })
    } else {
        dbQuery = dbQuery.order('created_at', { ascending: false })
    }

    if (searchTerm) {
        if (!isNaN(Number(searchTerm))) {
            dbQuery = dbQuery.eq('order_number', Number(searchTerm))
        } else {
            const customerIds = capabilities.hasCustomerId ? await findMatchingCustomerIds(searchTerm) : []
            const searchClauses: string[] = []

            if (capabilities.hasGuestEmail) {
                searchClauses.push(`guest_email.ilike.%${searchTerm}%`)
            }

            if (capabilities.hasGuestPhone) {
                searchClauses.push(`guest_phone.ilike.%${searchTerm}%`)
            }

            if (capabilities.hasTrackingId) {
                searchClauses.push(`tracking_id.ilike.%${searchTerm}%`)
            }

            if (capabilities.hasNotes) {
                searchClauses.push(`notes.ilike.%${searchTerm}%`)
            }

            if (capabilities.hasCustomerId && customerIds.length > 0) {
                searchClauses.push(`customer_id.in.(${customerIds.join(',')})`)
            }

            if (searchClauses.length === 0) {
                return { data: [], count: 0, error: null }
            }

            dbQuery = dbQuery.or(searchClauses.join(','))
        }
    }

    if (normalizedFulfillmentStatus) {
        if (fulfillmentColumn) {
            if (salesChannel !== 'all') {
                const filterValues = getFulfillmentFilterValues(salesChannel, normalizedFulfillmentStatus)
                dbQuery = filterValues.length === 1
                    ? dbQuery.eq(fulfillmentColumn, filterValues[0])
                    : dbQuery.in(fulfillmentColumn, filterValues)
            } else {
                dbQuery = dbQuery.in(fulfillmentColumn, Array.from(new Set([
                    ...getFulfillmentFilterValues('online', normalizedFulfillmentStatus),
                    ...getFulfillmentFilterValues('pos', normalizedFulfillmentStatus),
                ])))
            }
        }
    }

    if (normalizedPaymentStatus) {
        if (paymentColumn) {
            dbQuery = dbQuery.eq(paymentColumn, normalizedPaymentStatus)
        }
    }

    if (salesChannel !== 'all') {
        if (channelColumn) {
            dbQuery = dbQuery.eq(channelColumn, salesChannel)
        }
    }

    if (customerType !== 'all' && (capabilities.hasCustomerId || capabilities.hasUserId)) {
        if (customerType === 'registered') {
            if (capabilities.hasCustomerId && capabilities.hasUserId) {
                dbQuery = dbQuery.or('customer_id.not.is.null,user_id.not.is.null')
            } else if (capabilities.hasCustomerId) {
                dbQuery = dbQuery.not('customer_id', 'is', null)
            } else if (capabilities.hasUserId) {
                dbQuery = dbQuery.not('user_id', 'is', null)
            }
        } else if (customerType === 'guest') {
            if (capabilities.hasCustomerId) dbQuery = dbQuery.is('customer_id', null)
            if (capabilities.hasUserId) dbQuery = dbQuery.is('user_id', null)
            if (capabilities.hasGuestEmail) {
                dbQuery = dbQuery.not('guest_email', 'is', null)
            } else if (capabilities.hasGuestPhone) {
                dbQuery = dbQuery.not('guest_phone', 'is', null)
            }
        } else if (customerType === 'walk-in') {
            if (capabilities.hasCustomerId) dbQuery = dbQuery.is('customer_id', null)
            if (capabilities.hasUserId) dbQuery = dbQuery.is('user_id', null)
            if (capabilities.hasGuestEmail) dbQuery = dbQuery.is('guest_email', null)
            if (capabilities.hasGuestPhone) dbQuery = dbQuery.is('guest_phone', null)
        }
    }

    if (normalizedPaymentMethod && capabilities.hasPaymentMethod) {
        dbQuery = dbQuery.ilike('payment_method', `%${normalizedPaymentMethod}%`)
    }

    if (dateFrom) {
        dbQuery = dbQuery.gte('created_at', `${dateFrom}T00:00:00.000Z`)
    }

    if (dateTo) {
        dbQuery = dbQuery.lte('created_at', `${dateTo}T23:59:59.999Z`)
    }

    if (typeof minAmount === 'number' && Number.isFinite(minAmount) && amountColumn) {
        dbQuery = dbQuery.gte(amountColumn, minAmount)
    }

    if (typeof maxAmount === 'number' && Number.isFinite(maxAmount) && amountColumn) {
        dbQuery = dbQuery.lte(amountColumn, maxAmount)
    }

    const { data, error, count } = await dbQuery
    if (error) {
        console.error('Error fetching orders:', error)
        return { data: [], count: 0, error: error.message }
    }

    const rows = (data ?? []) as RawOrderRow[]
    const customerIds = capabilities.hasCustomerId
        ? rows.map((row) => getStringField(row, 'customer_id')).filter((value): value is string => Boolean(value))
        : []
    const customerMap = await loadCustomerMap(customerIds)

    return {
        data: rows.map((row) => normalizeOrderSummary(row, customerMap.get(getStringField(row, 'customer_id') || '') ?? null)),
        count: count ?? 0,
        error: null,
    }
}

export async function getOrder(id: string) {
    await requireActionPermission(['manage_orders', 'access_pos'])
    const capabilities = await getOrderSchemaCapabilities()
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('orders')
        .select(`
            *,
            order_addresses (
                id,
                full_name,
                phone,
                address_line,
                city,
                state,
                pincode
            ),
            payment_request_deliveries (
                id,
                channel,
                provider,
                recipient,
                status,
                provider_reference,
                error_message,
                payment_url,
                created_at
            ),
            order_items (
                *,
                product_variants (
                    id,
                    sku,
                    products (title, product_media(media_url))
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error || !data) {
        console.error('Error fetching order:', error)
        return null
    }

    const rawOrder = data as OrderDetailRow
    const customerId = capabilities.hasCustomerId ? getStringField(rawOrder, 'customer_id') : null
    const customerMap = await loadCustomerMap(customerId ? [customerId] : [])
    return normalizeOrderDetail(rawOrder, customerId ? customerMap.get(customerId) ?? null : null)
}

async function loadEditableVariantMap(variantIds: string[]) {
    const uniqueVariantIds = Array.from(new Set(variantIds.filter(Boolean)))
    const variantMap = new Map<string, {
        id: string
        sku?: string | null
        title?: string | null
        price?: number | null
        is_active?: boolean | null
        products?: { title?: string | null; slug?: string | null; status?: string | null; product_media?: Array<{ media_url?: string | null }> | null } | null
        inventory_items?: Array<{ available_quantity?: number | null; reserved_quantity?: number | null }> | null
        variant_media?: Array<{ media_url?: string | null; position?: number | null }> | null
        variant_option_values?: Array<{
            product_option_values?: {
                value?: string | null
                product_options?: { name?: string | null } | Array<{ name?: string | null }> | null
            } | Array<{
                value?: string | null
                product_options?: { name?: string | null } | Array<{ name?: string | null }> | null
            }> | null
        }> | null
    }>()

    if (uniqueVariantIds.length === 0) {
        return variantMap
    }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('product_variants')
        .select(`
            id,
            sku,
            title,
            price,
            is_active,
            products (
                title,
                slug,
                status,
                product_media ( media_url )
            ),
            variant_media ( media_url, position ),
            variant_option_values (
                product_option_values (
                    value,
                    product_options ( name )
                )
            ),
            inventory_items (
                available_quantity,
                reserved_quantity
            )
        `)
        .in('id', uniqueVariantIds)

    if (error) {
        throw new Error(error.message)
    }

    for (const row of data ?? []) {
        const productRow = Array.isArray(row.products) ? row.products[0] : row.products
        variantMap.set(row.id, {
            id: row.id,
            sku: row.sku,
            title: row.title,
            price: row.price,
            is_active: row.is_active,
            products: productRow
                ? {
                    title: productRow.title,
                    slug: productRow.slug,
                    status: productRow.status,
                    product_media: productRow.product_media ?? [],
                }
                : null,
            inventory_items: row.inventory_items ?? [],
            variant_media: row.variant_media ?? [],
            variant_option_values: row.variant_option_values ?? [],
        })
    }

    return variantMap
}

async function compensateStockChanges(
    supabaseAdmin: ReturnType<typeof createAdminClient>,
    operations: Array<{ variantId: string; quantity: number; kind: 'reserve' | 'release' }>,
    reference: string
) {
    for (const operation of operations.slice().reverse()) {
        const rpcName = operation.kind === 'reserve' ? 'release_stock' : 'reserve_stock'
        await supabaseAdmin.rpc(rpcName, {
            p_variant_id: operation.variantId,
            p_qty: operation.quantity,
            p_reference: reference,
        })
    }
}

function buildOrderItemInsertSets(
    orderId: string,
    items: Array<EditableOrderLineInput & { title: string; sku: string | null }>,
    capabilities: OrderItemSchemaCapabilities
) {
    const baseRows = items.map((item) => ({
        order_id: orderId,
        variant_id: item.variantId,
        title: item.title,
        sku: item.sku || '',
        ...(capabilities.hasProductSlug ? { product_slug: item.productSlug ?? null } : {}),
        ...(capabilities.hasImageUrl ? { image_url: item.imageUrl ?? null } : {}),
        ...(capabilities.hasVariantTitle ? { variant_title: item.variantTitle ?? null } : {}),
        ...(capabilities.hasVariantOptions ? { variant_options: item.variantOptions ?? [] } : {}),
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: Number((item.unitPrice * item.quantity).toFixed(2)),
        ...(capabilities.hasDiscountAmount ? { discount_amount: normalizeNullableNumber(item.discountAmount ?? 0) ?? 0 } : {}),
    }))

    return [
        baseRows,
        items.map((item) => ({
            order_id: orderId,
            variant_id: item.variantId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: Number((item.unitPrice * item.quantity).toFixed(2)),
            ...(capabilities.hasDiscountAmount ? { discount_amount: normalizeNullableNumber(item.discountAmount ?? 0) ?? 0 } : {}),
        })),
    ]
}

export async function updateOrderHeader(input: EditableOrderHeaderInput) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const supabase = await createClient()
    const admin = createAdminClient()
    const capabilities = await getOrderSchemaCapabilities()

    const { data: order, error } = await admin
        .from('orders')
        .select('*')
        .eq('id', input.orderId)
        .single()

    if (error || !order) {
        return { error: error?.message || 'Order not found.' }
    }

    const rawOrder = order as RawOrderRow
    const currentChannel = inferSalesChannel(rawOrder)
    const nextChannel = input.salesChannel ?? currentChannel
    const payload: OrderUpdateCandidate = {}
    const warnings: string[] = []

    if (input.customerId !== undefined && capabilities.hasCustomerId) {
        const customerId = normalizeNullableString(input.customerId)

        if (customerId) {
            const { data: customer, error: customerError } = await admin
                .from('customers')
                .select('id')
                .eq('id', customerId)
                .single()

            if (customerError || !customer) {
                return { error: 'Selected customer could not be found.' }
            }
        }

        payload.customer_id = customerId
    } else if (input.customerId !== undefined) {
        warnings.push('Customer relink is unavailable on the current schema.')
    }

    if (input.paymentMethod !== undefined) {
        if (capabilities.hasPaymentMethod) {
            payload.payment_method = normalizeNullableString(input.paymentMethod)
        } else {
            warnings.push('Payment method cannot be edited until the current schema is migrated.')
        }
    }

    if (input.notes !== undefined) {
        if (capabilities.hasNotes) {
            payload.notes = normalizeNullableString(input.notes)
        } else {
            warnings.push('Notes cannot be edited until the current schema is migrated.')
        }
    }

    if (input.salesChannel !== undefined) {
        Object.assign(payload, buildChannelWritePayload(capabilities, nextChannel))

        const currentStatus = getFulfillmentStatus(rawOrder)
        const nextStatus = normalizeOrderFulfillmentStatus(nextChannel, currentStatus)
        Object.assign(payload, buildFulfillmentWritePayload(capabilities, nextChannel, nextStatus))
    }

    if (input.guestName !== undefined) {
        if (capabilities.hasGuestName) {
            payload.guest_name = normalizeNullableString(input.guestName)
        } else {
            warnings.push('Guest name cannot be edited until the current schema is migrated.')
        }
    }

    if (input.guestEmail !== undefined) {
        if (capabilities.hasGuestEmail) {
            payload.guest_email = normalizeNullableString(input.guestEmail)?.toLowerCase() ?? null
        } else {
            warnings.push('Guest email cannot be edited until the current schema is migrated.')
        }
    }

    if (input.guestPhone !== undefined) {
        if (capabilities.hasGuestPhone) {
            payload.guest_phone = normalizeNullableString(input.guestPhone)
        } else {
            warnings.push('Guest phone cannot be edited until the current schema is migrated.')
        }
    }

    if (input.billingAddress !== undefined) {
        if (capabilities.hasBillingAddress) {
            payload.billing_address = sanitizeAddress(input.billingAddress)
        } else {
            warnings.push('Billing address cannot be edited until the current schema is migrated.')
        }
    }

    if (input.shippingAddress !== undefined) {
        if (capabilities.hasShippingAddress) {
            payload.shipping_address = sanitizeAddress(input.shippingAddress)
        } else {
            warnings.push('Shipping address cannot be edited until the current schema is migrated.')
        }
    }

    if (input.tags !== undefined) {
        if (capabilities.hasTags) {
            payload.tags = sanitizeTags(input.tags)
        } else {
            warnings.push('Order tags cannot be edited until the current schema is migrated.')
        }
    }

    if (capabilities.hasUpdatedAt) {
        payload.updated_at = new Date().toISOString()
    }

    if (Object.keys(payload).length === 0) {
        return { success: true, warnings }
    }

    const { error: updateError } = await tryUpdateOrder(supabase, input.orderId, [payload])

    if (updateError) {
        return { error: updateError.message }
    }

    await logAudit({
        actorId: access.user?.id,
        action: 'order.header.update',
        entityType: 'order',
        entityId: input.orderId,
        before: {
            customer_id: getStringField(rawOrder, 'customer_id'),
            payment_method: getStringField(rawOrder, 'payment_method'),
            notes: getStringField(rawOrder, 'notes'),
            sales_channel: inferSalesChannel(rawOrder),
            guest_name: getStringField(rawOrder, 'guest_name'),
            guest_email: getStringField(rawOrder, 'guest_email'),
            guest_phone: getStringField(rawOrder, 'guest_phone'),
            billing_address: getObjectField(rawOrder, 'billing_address'),
            shipping_address: getObjectField(rawOrder, 'shipping_address'),
            tags: Array.isArray(rawOrder.tags) ? rawOrder.tags : [],
        },
        after: payload,
    })

    await revalidateOrderPaths(input.orderId)
    return { success: true, warnings }
}

export async function updateOrderShipment(input: EditableShipmentInput) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const supabase = await createClient()
    const admin = createAdminClient()
    const capabilities = await getOrderSchemaCapabilities()

    const { data: order, error } = await admin
        .from('orders')
        .select('*')
        .eq('id', input.orderId)
        .single()

    if (error || !order) {
        return { error: error?.message || 'Order not found.' }
    }

    const rawOrder = order as RawOrderRow
    const channel = inferSalesChannel(rawOrder)

    if (!isShippingRelevant(channel)) {
        return { error: 'Shipment updates are only available for online orders.' }
    }

    const payload: OrderUpdateCandidate = {}
    const warnings: string[] = []
    const currentFulfillment = getFulfillmentStatus(rawOrder)
    let nextFulfillment = currentFulfillment

    if (input.trackingId !== undefined) {
        if (capabilities.hasTrackingId) {
            payload.tracking_id = normalizeNullableString(input.trackingId)
        } else {
            warnings.push('Tracking ID cannot be saved until the current schema is migrated.')
        }
    }

    if (input.courier !== undefined) {
        if (capabilities.hasCourier) {
            payload.courier = normalizeNullableString(input.courier)
        } else {
            warnings.push('Courier cannot be saved until the current schema is migrated.')
        }
    }

    if (input.deliveryNotes !== undefined) {
        if (capabilities.hasDeliveryNotes) {
            payload.delivery_notes = normalizeNullableString(input.deliveryNotes)
        } else {
            warnings.push('Delivery notes cannot be saved until the current schema is migrated.')
        }
    }

    if (input.shippedAt !== undefined) {
        if (capabilities.hasShippedAt) {
            payload.shipped_at = normalizeNullableString(input.shippedAt)
        } else {
            warnings.push('Shipped date cannot be saved until the current schema is migrated.')
        }
    }

    if (input.deliveredAt !== undefined) {
        if (capabilities.hasDeliveredAt) {
            payload.delivered_at = normalizeNullableString(input.deliveredAt)
        } else {
            warnings.push('Delivered date cannot be saved until the current schema is migrated.')
        }
    }

    if (input.deliveryStatus !== undefined) {
        const requestedStatus = normalizeOrderFulfillmentStatus(channel, input.deliveryStatus)

        if (!canTransitionFulfillmentStatus(channel, currentFulfillment, requestedStatus)) {
            const allowed = getValidFulfillmentTransitions(channel, currentFulfillment)
            return {
                error: allowed.length > 0
                    ? `Invalid shipment transition. Allowed: ${allowed.join(', ')}.`
                    : `Order cannot move from ${currentFulfillment} to ${requestedStatus}.`,
            }
        }

        nextFulfillment = requestedStatus
        Object.assign(payload, buildFulfillmentWritePayload(capabilities, channel, requestedStatus))
    }

    if (input.shippingCharge !== undefined) {
        const shippingTotal = normalizeNullableNumber(input.shippingCharge) ?? 0
        const totalsPayload = buildAmountWritePayload(capabilities, {
            subtotal: getOrderSubtotal(rawOrder),
            discountTotal: getOrderDiscount(rawOrder),
            taxTotal: getOrderTax(rawOrder),
            shippingTotal,
            grandTotal: Number((getOrderSubtotal(rawOrder) - getOrderDiscount(rawOrder) + getOrderTax(rawOrder) + shippingTotal).toFixed(2)),
        })

        Object.assign(payload, totalsPayload)
    }

    if (nextFulfillment === 'shipped' && capabilities.hasShippedAt && !payload.shipped_at && !getStringField(rawOrder, 'shipped_at')) {
        payload.shipped_at = new Date().toISOString()
    }

    if (nextFulfillment === 'delivered') {
        if (capabilities.hasShippedAt && !payload.shipped_at && !getStringField(rawOrder, 'shipped_at')) {
            payload.shipped_at = new Date().toISOString()
        }

        if (capabilities.hasDeliveredAt && !payload.delivered_at && !getStringField(rawOrder, 'delivered_at')) {
            payload.delivered_at = new Date().toISOString()
        }
    }

    if (capabilities.hasUpdatedAt) {
        payload.updated_at = new Date().toISOString()
    }

    if (Object.keys(payload).length === 0) {
        return { success: true, warnings }
    }

    const { error: updateError } = await tryUpdateOrder(supabase, input.orderId, [payload])

    if (updateError) {
        return { error: updateError.message }
    }

    await logAudit({
        actorId: access.user?.id,
        action: 'order.shipment.update',
        entityType: 'order',
        entityId: input.orderId,
        before: {
            tracking_id: getStringField(rawOrder, 'tracking_id'),
            courier: getStringField(rawOrder, 'courier'),
            delivery_status: getStringField(rawOrder, 'delivery_status'),
            shipped_at: getStringField(rawOrder, 'shipped_at'),
            delivered_at: getStringField(rawOrder, 'delivered_at'),
            delivery_notes: getStringField(rawOrder, 'delivery_notes'),
            shipping_charge: getOrderShipping(rawOrder),
            status: currentFulfillment,
        },
        after: payload,
    })

    await revalidateOrderPaths(input.orderId)
    return { success: true, warnings }
}

export async function updateOrderLineItems(orderId: string, items: EditableOrderLineInput[]) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const supabase = await createClient()
    const admin = createAdminClient()
    const capabilities = await getOrderSchemaCapabilities()
    const itemCapabilities = await getOrderItemSchemaCapabilities()

    const { data: order, error } = await admin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

    if (error || !order) {
        return { error: error?.message || 'Order not found.' }
    }

    const rawOrder = order as RawOrderRow & {
        order_items?: Array<{
            id: string
            variant_id?: string | null
            quantity?: number | null
            unit_price?: number | string | null
            total_price?: number | string | null
            discount_amount?: number | string | null
            title?: string | null
            sku?: string | null
            product_slug?: string | null
            image_url?: string | null
            variant_title?: string | null
            variant_options?: Array<{ name?: string; value?: string }> | null
        }>
    }
    const channel = inferSalesChannel(rawOrder)
    const fulfillmentStatus = getFulfillmentStatus(rawOrder)
    const paymentStatus = getFinancialStatus(rawOrder)

    if (!canEditOrderLineItems(channel, fulfillmentStatus, paymentStatus)) {
        return { error: 'Line items can only be edited on pending POS orders or pending/processing online orders.' }
    }

    const normalizedItems = items.map((item) => ({
        variantId: item.variantId,
        quantity: Math.trunc(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount ?? 0),
        title: normalizeNullableString(item.title) ?? '',
        sku: normalizeNullableString(item.sku),
        productSlug: normalizeNullableString(item.productSlug),
        imageUrl: normalizeNullableString(item.imageUrl),
        variantTitle: normalizeNullableString(item.variantTitle),
        variantOptions: Array.isArray(item.variantOptions) ? item.variantOptions.filter((option) => option?.name && option?.value) : [],
    }))

    if (normalizedItems.length === 0) {
        return { error: 'At least one line item is required.' }
    }

    for (const item of normalizedItems) {
        if (!item.variantId) {
            return { error: 'Each line item must include a product variant.' }
        }

        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            return { error: 'Each line item quantity must be greater than zero.' }
        }

        if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
            return { error: 'Each line item price must be zero or greater.' }
        }

        if (!Number.isFinite(item.discountAmount) || item.discountAmount < 0) {
            return { error: 'Each line item discount must be zero or greater.' }
        }

        if (item.discountAmount > item.unitPrice * item.quantity) {
            return { error: 'Line item discount cannot exceed the line subtotal.' }
        }
    }

    if (new Set(normalizedItems.map((item) => item.variantId)).size !== normalizedItems.length) {
        return { error: 'Each variant can only appear once in the editor.' }
    }

    const currentItems = (rawOrder.order_items ?? []) as Array<{
        variant_id?: string | null
        quantity?: number | null
        unit_price?: number | string | null
        discount_amount?: number | string | null
        title?: string | null
        sku?: string | null
        product_slug?: string | null
        image_url?: string | null
        variant_title?: string | null
        variant_options?: Array<{ name?: string; value?: string }> | null
    }>
    const currentQuantities = new Map<string, number>()
    const currentLineDiscountTotal = currentItems.reduce((sum, item) => {
        const variantId = item.variant_id ?? ''
        const quantity = Number(item.quantity ?? 0)
        if (variantId) {
            currentQuantities.set(variantId, (currentQuantities.get(variantId) ?? 0) + quantity)
        }

        return sum + (itemCapabilities.hasDiscountAmount ? Number(item.discount_amount ?? 0) : 0)
    }, 0)

    const existingOrderLevelDiscount = Math.max(0, Number((getOrderDiscount(rawOrder) - currentLineDiscountTotal).toFixed(2)))
    const variantMap = await loadEditableVariantMap(normalizedItems.map((item) => item.variantId))

    const stockDeltas = new Map<string, number>()
    const hydratedItems: Array<EditableOrderLineInput & { title: string; sku: string | null }> = []

    for (const item of normalizedItems) {
        const variant = variantMap.get(item.variantId)
        if (!variant) {
            return { error: 'One or more selected variants no longer exist.' }
        }

        const currentQuantity = currentQuantities.get(item.variantId) ?? 0
        const productStatus = variant.products?.status?.trim().toLowerCase() ?? null
        const isVariantActive = variant.is_active !== false

        if ((!isVariantActive || (productStatus && productStatus !== 'active')) && item.quantity > currentQuantity) {
            return { error: `Variant ${variant.sku || variant.id.slice(0, 8)} is archived or inactive and cannot be increased.` }
        }

        const availableQuantity = (variant.inventory_items ?? []).reduce((sum, inventoryItem) => {
            const available = Number(inventoryItem.available_quantity ?? 0)
            const reserved = Number(inventoryItem.reserved_quantity ?? 0)
            return sum + Math.max(0, available - reserved)
        }, 0)
        const delta = item.quantity - currentQuantity

        if (delta > 0 && availableQuantity < delta) {
            return { error: `Insufficient stock for ${variant.products?.title || variant.sku || 'the selected variant'}.` }
        }

        stockDeltas.set(item.variantId, delta)
        const variantOptions = buildVariantOptionSnapshot(variant.variant_option_values)
        const imageUrl = variant.variant_media
            ?.slice()
            .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
            .find((media) => media.media_url)?.media_url
            || variant.products?.product_media?.find((media) => media.media_url)?.media_url
            || null
        hydratedItems.push({
            ...item,
            title: item.title || variant.products?.title || 'Order item',
            sku: item.sku ?? variant.sku ?? null,
            productSlug: item.productSlug ?? variant.products?.slug ?? null,
            imageUrl: item.imageUrl ?? imageUrl,
            variantTitle: item.variantTitle ?? buildVariantLabelFromSnapshot(variant.title, variantOptions),
            variantOptions: item.variantOptions && item.variantOptions.length > 0 ? item.variantOptions : variantOptions,
        })
    }

    const stockOperations: Array<{ variantId: string; quantity: number; kind: 'reserve' | 'release' }> = []
    const restorePreviousItems = async () => {
        const previousItems = currentItems
            .filter((item) => item.variant_id && Number(item.quantity ?? 0) > 0)
            .map((item) => ({
                variantId: item.variant_id as string,
                quantity: Number(item.quantity ?? 0),
                unitPrice: Number(item.unit_price ?? 0),
                discountAmount: itemCapabilities.hasDiscountAmount ? Number(item.discount_amount ?? 0) : 0,
                title: normalizeNullableString(item.title) ?? 'Order item',
                sku: normalizeNullableString(item.sku),
                productSlug: itemCapabilities.hasProductSlug ? normalizeNullableString(item.product_slug) : null,
                imageUrl: itemCapabilities.hasImageUrl ? normalizeNullableString(item.image_url) : null,
                variantTitle: itemCapabilities.hasVariantTitle ? normalizeNullableString(item.variant_title) : null,
                variantOptions: itemCapabilities.hasVariantOptions && Array.isArray(item.variant_options)
                    ? item.variant_options.filter((option) => option?.name && option?.value).map((option) => ({ name: String(option?.name), value: String(option?.value) }))
                    : [],
            }))

        if (previousItems.length === 0) {
            return
        }

        await tryInsertOrderItems(supabase, buildOrderItemInsertSets(orderId, previousItems, itemCapabilities))
    }

    for (const [variantId, delta] of stockDeltas.entries()) {
        if (delta === 0) {
            continue
        }

        const rpcName = delta > 0 ? 'reserve_stock' : 'release_stock'
        const quantity = Math.abs(delta)
        const { data: ok, error: stockError } = await admin.rpc(rpcName, {
            p_variant_id: variantId,
            p_qty: quantity,
            p_reference: orderId,
        })

        if (stockError || ok === false) {
            await compensateStockChanges(admin, stockOperations, orderId)
            return { error: stockError?.message || 'Unable to update stock for the edited line items.' }
        }

        stockOperations.push({ variantId, quantity, kind: delta > 0 ? 'reserve' : 'release' })
    }

    const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId)

    if (deleteError) {
        await compensateStockChanges(admin, stockOperations, orderId)
        return { error: deleteError.message }
    }

    const itemInsertSets = buildOrderItemInsertSets(orderId, hydratedItems, itemCapabilities)
    const { error: itemInsertError } = await tryInsertOrderItems(supabase, itemInsertSets)

    if (itemInsertError) {
        await compensateStockChanges(admin, stockOperations, orderId)
        await restorePreviousItems()
        return { error: itemInsertError.message }
    }

    const subtotal = Number(hydratedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2))
    const lineDiscountTotal = Number(hydratedItems.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0).toFixed(2))
    const discountTotal = Number((existingOrderLevelDiscount + lineDiscountTotal).toFixed(2))
    const taxTotal = Number(getOrderTax(rawOrder).toFixed(2))
    const shippingTotal = Number(getOrderShipping(rawOrder).toFixed(2))
    const grandTotal = Number((subtotal - discountTotal + taxTotal + shippingTotal).toFixed(2))
    const orderPayload = buildAmountWritePayload(capabilities, {
        subtotal,
        discountTotal,
        taxTotal,
        shippingTotal,
        grandTotal,
    })

    if (capabilities.hasUpdatedAt) {
        orderPayload.updated_at = new Date().toISOString()
    }

    const { error: orderUpdateError } = await tryUpdateOrder(supabase, orderId, [orderPayload])

    if (orderUpdateError) {
        await supabase.from('order_items').delete().eq('order_id', orderId)
        await restorePreviousItems()
        await compensateStockChanges(admin, stockOperations, orderId)
        return { error: orderUpdateError.message }
    }

    await logAudit({
        actorId: access.user?.id,
        action: 'order.items.update',
        entityType: 'order',
        entityId: orderId,
        before: currentItems,
        after: hydratedItems,
    })

    await revalidateOrderPaths(orderId)
    return { success: true }
}

export async function getOrderTimeline(orderId: string) {
    await requireActionPermission(['manage_orders', 'access_pos'])
    const admin = createAdminClient()

    const [{ data: order }, { data: audits, error }] = await Promise.all([
        admin.from('orders').select('id, created_at').eq('id', orderId).single(),
        admin
            .from('audit_logs')
            .select('id, actor_id, action, entity_id, before, after, created_at')
            .eq('entity_type', 'order')
            .eq('entity_id', orderId)
            .order('created_at', { ascending: false })
            .limit(100),
    ])

    if (error) {
        return { data: [], error: error.message }
    }

    const timeline: OrderTimelineEntry[] = (audits ?? []).map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityId: entry.entity_id,
        actorId: entry.actor_id,
        actorLabel: entry.actor_id ? 'Staff' : 'System',
        before: entry.before,
        after: entry.after,
        createdAt: entry.created_at,
    }))

    if (order?.created_at && !timeline.some((entry) => entry.action === 'order.create')) {
        timeline.push({
            id: `${orderId}-created`,
            action: 'order.created.record',
            entityId: orderId,
            actorId: null,
            actorLabel: 'System',
            createdAt: order.created_at,
            before: null,
            after: { created_from_legacy_record: true },
        })
    }

    timeline.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

    return { data: timeline, error: null }
}

export type CreateOrderInput = {
    customer_id?: string | null
    guest_name?: string | null
    guest_email?: string | null
    guest_phone?: string | null
    payment_status: string
    total_amount: number
    status?: string // Allow overriding status (e.g. 'delivered' for POS)
    items: {
        variant_id: string
        quantity: number
        unit_price: number
        title?: string
        sku?: string | null
    }[]
    // POS Fields
    discount_amount?: number
    tax_amount?: number
    payment_method?: string
    order_type?: 'online' | 'pos'
    notes?: string
}

export async function createOrder(input: CreateOrderInput) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    const capabilities = await getOrderSchemaCapabilities()
    const itemCapabilities = await getOrderItemSchemaCapabilities()
    const channel = normalizeOrderChannel(input.order_type) ?? 'pos'
    const paymentStatus = normalizeOrderPaymentStatus(input.payment_status)
    const fulfillmentStatus = normalizeOrderFulfillmentStatus(channel, input.status ?? getDefaultFulfillmentStatus(channel))
    const statusWriteValue = getLegacyFulfillmentWriteValue(channel, fulfillmentStatus)
    const contactResult = await resolveMandatoryOrderContact(supabaseAdmin, {
        customerId: input.customer_id ?? null,
        guestName: input.guest_name ?? null,
        guestEmail: input.guest_email ?? null,
        guestPhone: input.guest_phone ?? null,
    })

    // Basic validation
    if (!input.items || input.items.length === 0) {
        return { error: 'At least one line item is required.' }
    }
    if (input.items.some(item => item.quantity <= 0 || item.unit_price < 0)) {
        return { error: 'Quantities must be > 0 and prices must be ≥ 0.' }
    }
    if (contactResult.error || !contactResult.data) {
        return { error: contactResult.error || 'Customer contact is required.' }
    }

    const variantMap = await loadEditableVariantMap(input.items.map((item) => item.variant_id))

    const contact = contactResult.data
    const guestFields = {
        ...(capabilities.hasGuestName ? { guest_name: contact.fullName } : {}),
        ...(capabilities.hasGuestEmail ? { guest_email: contact.email } : {}),
        ...(capabilities.hasGuestPhone ? { guest_phone: contact.phone } : {}),
    }

    const subtotal = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const discountTotal = input.discount_amount ?? 0
    const taxTotal = input.tax_amount ?? 0
    const grandTotal = Number.isFinite(input.total_amount) ? input.total_amount : subtotal - discountTotal + taxTotal

    const orderCandidates: OrderInsertCandidate[] = [
        {
            customer_id: input.customer_id || null,
            payment_status: paymentStatus,
            status: statusWriteValue,
            total_amount: grandTotal,
            discount_amount: discountTotal,
            tax_amount: taxTotal,
            payment_method: input.payment_method || 'Cash',
            order_type: channel,
            notes: input.notes || null,
            financial_status: paymentStatus,
            fulfillment_status: statusWriteValue,
            subtotal,
            discount_total: discountTotal,
            tax_total: taxTotal,
            shipping_total: 0,
            grand_total: grandTotal,
            sales_channel: channel,
            currency: 'INR',
            ...guestFields,
        },
        {
            financial_status: paymentStatus,
            fulfillment_status: statusWriteValue,
            subtotal,
            discount_total: discountTotal,
            tax_total: taxTotal,
            shipping_total: 0,
            grand_total: grandTotal,
            sales_channel: channel,
            currency: 'INR',
            ...guestFields,
        },
        {
            customer_id: input.customer_id || null,
            payment_status: paymentStatus,
            status: statusWriteValue,
            total_amount: grandTotal,
            discount_amount: discountTotal,
            tax_amount: taxTotal,
            payment_method: input.payment_method || 'Cash',
            order_type: channel,
            notes: input.notes || null,
            ...guestFields,
        },
    ]

    // Reserve stock atomically before creating the order to prevent oversell
    const reserved: { variant_id: string; quantity: number }[] = []
    for (const item of input.items) {
        const { data: ok, error: reserveError } = await supabaseAdmin.rpc('reserve_stock', {
            p_variant_id: item.variant_id,
            p_qty: item.quantity,
            p_reference: null
        })

        if (reserveError || ok === false) {
            // Release any previous reservations
            for (const r of reserved) {
                await supabaseAdmin.rpc('release_stock', {
                    p_variant_id: r.variant_id,
                    p_qty: r.quantity,
                    p_reference: null
                })
            }

            const message = reserveError?.message?.includes('stock') ? reserveError.message : 'Insufficient stock for one or more items.'
            return { error: message }
        }

        reserved.push({ variant_id: item.variant_id, quantity: item.quantity })
    }

    // 1. Create Order
    const { data: order, error: orderError } = await tryInsertOrder(supabase, orderCandidates)

    if (orderError || !order) {
        // roll back reservations
        for (const r of reserved) {
            await supabaseAdmin.rpc('release_stock', {
                p_variant_id: r.variant_id,
                p_qty: r.quantity,
                p_reference: null
            })
        }
        return { error: orderError?.message || 'Failed to create order.' }
    }

    // 2. Create Order Items
    const hydratedItems = input.items.map((item) => {
        const variant = variantMap.get(item.variant_id)
        const variantOptions = buildVariantOptionSnapshot(variant?.variant_option_values)
        const imageUrl = variant?.variant_media
            ?.slice()
            .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
            .find((media) => media.media_url)?.media_url
            || variant?.products?.product_media?.find((media) => media.media_url)?.media_url
            || null

        return {
            variantId: item.variant_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            title: item.title || variant?.products?.title || 'Order item',
            sku: item.sku ?? variant?.sku ?? null,
            productSlug: variant?.products?.slug ?? null,
            imageUrl,
            variantTitle: buildVariantLabelFromSnapshot(variant?.title, variantOptions),
            variantOptions,
        }
    })

    const itemCandidates = buildOrderItemInsertSets(order.id, hydratedItems, itemCapabilities)

    const { error: itemsError } = await tryInsertOrderItems(supabase, itemCandidates)

    if (itemsError) {
        // roll back reservations and the order shell
        for (const r of reserved) {
            await supabaseAdmin.rpc('release_stock', {
                p_variant_id: r.variant_id,
                p_qty: r.quantity,
                p_reference: order.id
            })
        }
        await supabase.from('orders').delete().eq('id', order.id)
        console.error('Error creating items:', itemsError)
        return { error: 'Order creation failed while adding items; stock has been released.' }
    }

    // If we reach here, reservations stand and items are created
    await logAudit({
        actorId: access.user?.id,
        action: 'order.create',
        entityType: 'order',
        entityId: order.id,
        after: {
            status: statusWriteValue,
            payment_status: paymentStatus,
            sales_channel: channel,
            item_count: input.items.length,
            guest_name: contact.fullName,
            guest_email: contact.email,
            guest_phone: contact.phone,
        }
    })
    await notifyNewOrder(order.id, grandTotal)
    // fire low-stock alerts where applicable
    for (const item of input.items) {
        await notifyLowStock(item.variant_id)
    }

    if (channel === 'pos') {
        try {
            const mailContext = await getStoreMailContext(supabase)
            await sendPosOrderThankYouEmail({
                to: contact.email,
                customerName: contact.fullName,
                orderNumber: typeof order.order_number === 'number' || typeof order.order_number === 'string' ? order.order_number : null,
                grandTotal,
                currency: 'INR',
                invoiceUrl: buildOrderInvoiceUrl(order.id),
                storeName: mailContext.storeName,
                replyTo: mailContext.replyTo,
            })
        } catch (mailError) {
            console.error('POS thank-you email failed:', mailError)
        }
    }

    revalidatePath('/admin/orders')
    return { success: true, orderId: order.id }
}

export async function refundOrder(orderId: string, amount: number, reason?: string, restock: boolean = true) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    if (amount <= 0) return { error: 'Refund amount must be greater than zero.' }

    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*, order_items (variant_id, quantity)')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { error: orderError?.message || 'Order not found' }
    }

    const rawOrder = order as RawOrderRow & {
        order_items?: Array<{ variant_id?: string | null; quantity?: number | null }>
    }
    const total = getOrderTotal(rawOrder)
    if (amount > total) return { error: 'Refund amount exceeds order total.' }
    if (getFinancialStatus(rawOrder).toLowerCase() === 'refunded') {
        return { error: 'Order already refunded.' }
    }

    if (restock) {
        const items = rawOrder.order_items || []
        for (const item of items) {
            if (!item.variant_id || !item.quantity) continue
            await supabaseAdmin.rpc('release_stock', {
                p_variant_id: item.variant_id,
                p_qty: item.quantity,
                p_reference: orderId
            })
        }
    }

    const { error: refundError } = await supabase
        .from('refunds')
        .insert({
            order_id: orderId,
            amount,
            reason: reason || null,
            restocked: restock
        })

    if (refundError) {
        return { error: refundError.message }
    }

    const refundCandidates: OrderStatusUpdateCandidate[] = [
        {
            financial_status: 'refunded',
            payment_status: 'refunded',
            status: 'returned',
            fulfillment_status: 'returned'
        },
        {
            payment_status: 'refunded',
            status: 'returned',
        },
        {
            financial_status: 'refunded',
            fulfillment_status: 'returned'
        },
        {
            payment_status: 'refunded'
        }
    ]

    const { error: updateError } = await tryUpdateOrderStatus(supabase, orderId, refundCandidates)

    if (updateError) {
        return { error: updateError.message }
    }

    await logAudit({
        actorId: access.user?.id,
        action: 'order.refund',
        entityType: 'order',
        entityId: orderId,
        after: { amount, reason, restock }
    })

    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/orders')
    return { success: true }
}

export async function updateOrderStatus(id: string, status: string) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    const capabilities = await getOrderSchemaCapabilities()

    // Load current status and items for potential stock release
    const { data: orderWithItems, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*, order_items (variant_id, quantity)')
        .eq('id', id)
        .single()

    if (fetchError || !orderWithItems) {
        return { error: fetchError?.message || 'Order not found' }
    }

    const rawOrder = orderWithItems as RawOrderRow & {
        order_items?: Array<{ variant_id?: string | null; quantity?: number | null }>
    }
    const channel = inferSalesChannel(rawOrder)
    const currentFulfillment = getFulfillmentStatus(rawOrder)
    const currentPayment = getFinancialStatus(rawOrder)
    const payload: OrderUpdateCandidate = {}
    const now = new Date().toISOString()

    if (isOrderPaymentStatus(status)) {
        const nextPayment = normalizeOrderPaymentStatus(status)
        Object.assign(payload, buildPaymentWritePayload(capabilities, nextPayment))

        if (nextPayment === 'refunded') {
            Object.assign(payload, buildFulfillmentWritePayload(capabilities, channel, 'returned'))
        }
    } else {
        const nextFulfillment = normalizeOrderFulfillmentStatus(channel, status)

        if (!canTransitionFulfillmentStatus(channel, currentFulfillment, nextFulfillment)) {
            const allowed = getValidFulfillmentTransitions(channel, currentFulfillment)
            return {
                error: allowed.length > 0
                    ? `Invalid ${channel.toUpperCase()} fulfillment transition. Allowed: ${allowed.join(', ')}.`
                    : `Order cannot move from ${currentFulfillment} to ${nextFulfillment}.`,
            }
        }

        Object.assign(payload, buildFulfillmentWritePayload(capabilities, channel, nextFulfillment))

        if (channel === 'online') {
            if (nextFulfillment === 'shipped' && capabilities.hasShippedAt && !getStringField(rawOrder, 'shipped_at')) {
                payload.shipped_at = now
            }

            if (nextFulfillment === 'delivered') {
                if (capabilities.hasShippedAt && !getStringField(rawOrder, 'shipped_at')) {
                    payload.shipped_at = now
                }

                if (capabilities.hasDeliveredAt && !getStringField(rawOrder, 'delivered_at')) {
                    payload.delivered_at = now
                }
            }

            if (nextFulfillment === 'cancelled' && capabilities.hasDeliveryStatus) {
                payload.delivery_status = 'cancelled'
            }
        }
    }

    if (capabilities.hasUpdatedAt) {
        payload.updated_at = now
    }

    if (Object.keys(payload).length === 0) {
        return { success: true }
    }

    const resultingFulfillmentRaw = typeof payload.status === 'string'
        ? payload.status
        : typeof payload.fulfillment_status === 'string'
            ? payload.fulfillment_status
            : null
    const resultingFulfillment = resultingFulfillmentRaw
        ? normalizeOrderFulfillmentStatus(channel, resultingFulfillmentRaw)
        : currentFulfillment

    if (['cancelled', 'returned'].includes(resultingFulfillment) && currentFulfillment !== resultingFulfillment) {
        const items = rawOrder.order_items || []
        for (const item of items) {
            if (!item.variant_id || !item.quantity) continue
            await supabaseAdmin.rpc('release_stock', {
                p_variant_id: item.variant_id,
                p_qty: item.quantity,
                p_reference: id
            })
        }
    }

    const { error } = await tryUpdateOrder(supabase, id, [payload])

    if (error) return { error: error.message }
    await logAudit({
        actorId: access.user?.id,
        action: 'order.status.update',
        entityType: 'order',
        entityId: id,
        before: { status: currentFulfillment, payment_status: currentPayment },
        after: payload
    })
    if (isOrderPaymentStatus(status) && normalizeOrderPaymentStatus(status) === 'failed') {
        await notifyPaymentFailure(id)
    }
    await revalidateOrderPaths(id)
    return { success: true }
}

export async function repairOrders(ids: string[]) {
    const access = await requireActionPermission(['manage_orders', 'access_pos'])
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))

    if (uniqueIds.length === 0) {
        return { error: 'Select at least one order to repair.' }
    }

    const admin = createAdminClient()
    const supabase = await createClient()
    const capabilities = await getOrderSchemaCapabilities()
    const { data, error } = await admin
        .from('orders')
        .select('*, order_items(count)')
        .in('id', uniqueIds)

    if (error) {
        return { error: error.message }
    }

    const failures: Array<{ id: string; error: string }> = []
    let updated = 0
    let linkedCustomers = 0

    for (const row of (data ?? []) as RawOrderRow[]) {
        const customerId = getStringField(row, 'customer_id')
        const matchedCustomerId = !customerId && capabilities.hasCustomerId
            ? await findUniqueCustomerMatch(admin, getStringField(row, 'guest_email'), getStringField(row, 'guest_phone'))
            : null
        const normalizedStatus = getFulfillmentStatus(row)
        const normalizedPayment = getFinancialStatus(row)
        const normalizedChannel = inferSalesChannel(row)
        const normalizedTotal = getOrderTotal(row)
        const payload: Record<string, string | number> = {}

        if (capabilities.hasStatus && getStringField(row, 'status') !== normalizedStatus) {
            payload.status = normalizedStatus
        }

        if (capabilities.hasFulfillmentStatus && getStringField(row, 'fulfillment_status') !== normalizedStatus) {
            payload.fulfillment_status = normalizedStatus
        }

        if (capabilities.hasPaymentStatus && getStringField(row, 'payment_status') !== normalizedPayment) {
            payload.payment_status = normalizedPayment
        }

        if (capabilities.hasFinancialStatus && getStringField(row, 'financial_status') !== normalizedPayment) {
            payload.financial_status = normalizedPayment
        }

        if (capabilities.hasTotalAmount && (getNumberField(row, 'total_amount') === null || areNumbersDifferent(getNumberField(row, 'total_amount'), normalizedTotal))) {
            payload.total_amount = normalizedTotal
        }

        if (capabilities.hasGrandTotal && (getNumberField(row, 'grand_total') === null || areNumbersDifferent(getNumberField(row, 'grand_total'), normalizedTotal))) {
            payload.grand_total = normalizedTotal
        }

        if (capabilities.hasSalesChannel && getStringField(row, 'sales_channel') !== normalizedChannel) {
            payload.sales_channel = normalizedChannel
        }

        if (capabilities.hasOrderType && getStringField(row, 'order_type') !== normalizedChannel) {
            payload.order_type = normalizedChannel
        }

        if (capabilities.hasCustomerId && matchedCustomerId) {
            payload.customer_id = matchedCustomerId
        }

        if (Object.keys(payload).length === 0) {
            continue
        }

        if (capabilities.hasUpdatedAt) {
            payload.updated_at = new Date().toISOString()
        }

        const { error: updateError } = await supabase
            .from('orders')
            .update(payload)
            .eq('id', row.id)

        if (updateError) {
            failures.push({ id: row.id, error: updateError.message })
            continue
        }

        updated += 1
        if (matchedCustomerId) {
            linkedCustomers += 1
        }

        await logAudit({
            actorId: access.user?.id,
            action: 'order.repair',
            entityType: 'order',
            entityId: row.id,
            before: {
                status: getStringField(row, 'status'),
                fulfillment_status: getStringField(row, 'fulfillment_status'),
                payment_status: getStringField(row, 'payment_status'),
                financial_status: getStringField(row, 'financial_status'),
                total_amount: getNumberField(row, 'total_amount'),
                grand_total: getNumberField(row, 'grand_total'),
                sales_channel: getStringField(row, 'sales_channel'),
                order_type: getStringField(row, 'order_type'),
                customer_id: customerId,
            },
            after: payload,
        })
    }

    revalidatePath('/admin/orders')

    return {
        success: failures.length < uniqueIds.length,
        updated,
        linkedCustomers,
        failures,
        error: failures.length === uniqueIds.length ? failures[0]?.error || 'No orders could be repaired.' : null,
    }
}

export async function batchUpdateOrders(input: {
    ids: string[]
    fulfillmentStatus?: string
    paymentStatus?: string
}) {
    await requireActionPermission(['manage_orders', 'access_pos'])

    const uniqueIds = Array.from(new Set(input.ids.filter(Boolean)))
    if (uniqueIds.length === 0) {
        return { error: 'Select at least one order.' }
    }

    if (!input.fulfillmentStatus && !input.paymentStatus) {
        return { error: 'Choose a batch action first.' }
    }

    const failures: Array<{ id: string; error: string }> = []

    for (const id of uniqueIds) {
        if (input.paymentStatus) {
            const result = await updateOrderStatus(id, input.paymentStatus)
            if (result?.error) {
                failures.push({ id, error: result.error })
                continue
            }
        }

        if (input.fulfillmentStatus) {
            const result = await updateOrderStatus(id, input.fulfillmentStatus)
            if (result?.error) {
                failures.push({ id, error: result.error })
            }
        }
    }

    if (failures.length > 0) {
        return {
            success: failures.length < uniqueIds.length,
            updated: uniqueIds.length - failures.length,
            failures,
            error: failures.length === uniqueIds.length ? failures[0]?.error || 'Batch update failed.' : null,
        }
    }

    revalidatePath('/admin/orders')
    return { success: true, updated: uniqueIds.length, failures: [] }
}

export async function getCustomer(id: string) {
    await requireActionPermission(['manage_customers', 'manage_orders'])
    const supabase = await createClient()

    // Fetch customer profile
    const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()

    if (error) return null

    // Fetch order history
    const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(count)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })

    return { ...customer, orders: orders || [] }
}

export async function updateCustomer(id: string, formData: FormData) {
    await requireActionPermission(['manage_customers', 'manage_orders'])
    const supabase = await createClient()
    const data = {
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        email: formData.get('email') as string || null,
        phone: formData.get('phone') as string,
    }

    const { error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath(`/admin/customers/${id}`)
    revalidatePath('/admin/customers')
    revalidatePath('/admin/orders')

    return { success: true }
}

export async function deleteCustomer(id: string) {
    await requireActionPermission('manage_customers')
    const supabase = await createClient()

    const { error } = await supabase.from('customers').delete().eq('id', id)

    if (error) {
        console.error("Error deleting customer", error)
        return { error: 'Failed to delete customer. They may have related orders.' }
    }

    revalidatePath('/admin/customers')
    return { success: true }
}
