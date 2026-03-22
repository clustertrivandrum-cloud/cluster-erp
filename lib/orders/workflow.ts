export const ORDER_CHANNELS = ['online', 'pos'] as const

export type OrderChannel = typeof ORDER_CHANNELS[number]

export const ORDER_PAYMENT_STATUSES = ['paid', 'unpaid', 'pending', 'failed', 'refunded'] as const

export type OrderPaymentStatus = typeof ORDER_PAYMENT_STATUSES[number]

export const ONLINE_FULFILLMENT_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const
export const POS_FULFILLMENT_STATUSES = ['pending', 'completed', 'cancelled', 'returned'] as const

export type OnlineFulfillmentStatus = typeof ONLINE_FULFILLMENT_STATUSES[number]
export type PosFulfillmentStatus = typeof POS_FULFILLMENT_STATUSES[number]
export type OrderFulfillmentStatus = OnlineFulfillmentStatus | PosFulfillmentStatus

export const FULFILLMENT_STATUSES_BY_CHANNEL: Record<OrderChannel, readonly OrderFulfillmentStatus[]> = {
    online: ONLINE_FULFILLMENT_STATUSES,
    pos: POS_FULFILLMENT_STATUSES,
}

const FULFILLMENT_LABELS: Record<OrderFulfillmentStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    returned: 'Returned',
}

const FULFILLMENT_TRANSITIONS: Record<OrderChannel, Record<OrderFulfillmentStatus, readonly OrderFulfillmentStatus[]>> = {
    pos: {
        pending: ['completed', 'cancelled'],
        completed: ['returned'],
        cancelled: [],
        returned: [],
        processing: [],
        shipped: [],
        delivered: [],
    },
    online: {
        pending: ['processing', 'cancelled'],
        processing: ['shipped', 'cancelled'],
        shipped: ['delivered', 'returned'],
        delivered: ['returned'],
        cancelled: [],
        returned: [],
        completed: [],
    },
}

export function isOrderChannel(value: string | null | undefined): value is OrderChannel {
    return value === 'online' || value === 'pos'
}

export function normalizeOrderChannel(value?: string | null) {
    const normalized = value?.trim().toLowerCase()
    return isOrderChannel(normalized) ? normalized : null
}

export function getAllowedFulfillmentStatuses(channel: OrderChannel) {
    return FULFILLMENT_STATUSES_BY_CHANNEL[channel]
}

export function getFulfillmentDisplayLabel(status: OrderFulfillmentStatus) {
    return FULFILLMENT_LABELS[status] ?? status
}

export function isOrderPaymentStatus(value?: string | null): value is OrderPaymentStatus {
    return ORDER_PAYMENT_STATUSES.includes((value ?? '') as OrderPaymentStatus)
}

export function normalizeOrderPaymentStatus(value?: string | null): OrderPaymentStatus {
    const normalized = value?.trim().toLowerCase()

    switch (normalized) {
        case 'authorized':
        case 'partially_paid':
            return 'pending'
        case 'paid':
        case 'unpaid':
        case 'pending':
        case 'failed':
        case 'refunded':
            return normalized
        default:
            return 'unpaid'
    }
}

export function normalizeOrderFulfillmentStatus(channel: OrderChannel, value?: string | null): OrderFulfillmentStatus {
    const normalized = value?.trim().toLowerCase()

    if (channel === 'pos') {
        switch (normalized) {
            case 'completed':
            case 'delivered':
            case 'fulfilled':
            case 'shipped':
                return 'completed'
            case 'cancelled':
                return 'cancelled'
            case 'returned':
                return 'returned'
            default:
                return 'pending'
        }
    }

    switch (normalized) {
        case 'fulfilled':
            return 'delivered'
        case 'unfulfilled':
            return 'pending'
        case 'in_transit':
            return 'shipped'
        case 'processing':
        case 'shipped':
        case 'delivered':
        case 'cancelled':
        case 'returned':
            return normalized
        case 'completed':
            return 'delivered'
        default:
            return 'pending'
    }
}

export function getDefaultFulfillmentStatus(channel: OrderChannel): OrderFulfillmentStatus {
    return channel === 'pos' ? 'pending' : 'pending'
}

export function getValidFulfillmentTransitions(channel: OrderChannel, currentStatus: OrderFulfillmentStatus) {
    return FULFILLMENT_TRANSITIONS[channel][currentStatus] ?? []
}

export function canTransitionFulfillmentStatus(channel: OrderChannel, currentStatus: OrderFulfillmentStatus, nextStatus: OrderFulfillmentStatus) {
    if (currentStatus === nextStatus) {
        return true
    }

    return getValidFulfillmentTransitions(channel, currentStatus).includes(nextStatus)
}

export function isShippingRelevant(channel: OrderChannel) {
    return channel === 'online'
}

export function canEditOrderLineItems(channel: OrderChannel, fulfillmentStatus: OrderFulfillmentStatus, paymentStatus: OrderPaymentStatus) {
    if (paymentStatus === 'refunded') {
        return false
    }

    if (channel === 'pos') {
        return fulfillmentStatus === 'pending'
    }

    return fulfillmentStatus === 'pending' || fulfillmentStatus === 'processing'
}

export function getLegacyFulfillmentWriteValue(channel: OrderChannel, status: OrderFulfillmentStatus) {
    if (channel === 'pos' && status === 'completed') {
        return 'completed'
    }

    return status
}
