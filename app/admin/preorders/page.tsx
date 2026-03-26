'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, CheckCircle2, Copy, Mail, MessageSquare, XCircle } from 'lucide-react'
import PaginationBar from '@/components/ui/PaginationBar'
import { createPaymentOrderFromPreorder, getOrderPaymentRequest, getPreorders, sendOrderPaymentRequest, updatePreorderStatus, type PreorderStatus } from '@/lib/actions/preorder-actions'

type PreorderRecord = {
    id: string
    quantity: number | null
    status: string | null
    created_at: string
    customer_id?: string | null
    variant_id?: string | null
    order_id?: string | null
    product_title?: string | null
    product_slug?: string | null
    image_url?: string | null
    variant_title?: string | null
    variant_options?: Array<{
        name?: string | null
        value?: string | null
    }> | null
    unit_price?: number | null
    orders?: {
        id?: string | null
        order_number?: number | null
        financial_status?: string | null
    } | null
    customers?: {
        id?: string
        first_name?: string | null
        last_name?: string | null
        email?: string | null
        phone?: string | null
    } | null
    product_variants?: {
        id?: string
        price?: number | null
        products?: {
            id?: string
            title?: string | null
            slug?: string | null
            product_media?: Array<{
                media_url?: string | null
                position?: number | null
            }> | null
        } | null
        variant_option_values?: Array<{
            product_option_values?: {
                value?: string | null
                product_options?: {
                    name?: string | null
                } | null
            } | null
        }> | null
    } | null
}

type PaymentRequestState = {
    paymentUrl: string
    emailRecipient: string
    smsRecipient: string
}

const statusFilters: Array<{ label: string; value: PreorderStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Payment Pending', value: 'payment_pending' },
    { label: 'Fulfilled', value: 'fulfilled' },
    { label: 'Cancelled', value: 'cancelled' },
]

const statusClasses: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    payment_pending: 'bg-blue-100 text-blue-800',
    fulfilled: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
}

function formatVariantLabel(preorder: PreorderRecord) {
    const snapshotParts = (preorder.variant_options || [])
        .map((item) => {
            return item?.name && item?.value ? `${item.name}: ${item.value}` : null
        })
        .filter((value): value is string => Boolean(value))

    if (snapshotParts.length > 0) {
        return snapshotParts.join(' / ')
    }

    if (preorder.variant_title && preorder.variant_title !== 'Default Variant') {
        return preorder.variant_title
    }

    const parts = (preorder.product_variants?.variant_option_values || [])
        .map((item) => {
            const optionName = item?.product_option_values?.product_options?.name
            const optionValue = item?.product_option_values?.value
            return optionName && optionValue ? `${optionName}: ${optionValue}` : null
        })
        .filter((value): value is string => Boolean(value))

    return parts.length > 0 ? parts.join(' / ') : null
}

export default function AdminPreordersPage() {
    const [preorders, setPreorders] = useState<PreorderRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedStatus, setSelectedStatus] = useState<PreorderStatus | 'all'>('all')
    const [activeMutationId, setActiveMutationId] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
    const [paymentRequests, setPaymentRequests] = useState<Record<string, PaymentRequestState>>({})
    const [page, setPage] = useState(1)
    const PAGE_SIZE = 10

    useEffect(() => {
        let cancelled = false

        async function load() {
            setLoading(true)
            const data = await getPreorders(selectedStatus)
            if (!cancelled) {
                setPreorders(data as PreorderRecord[])
                setLoading(false)
            }
        }

        load()

        return () => {
            cancelled = true
        }
    }, [selectedStatus])

    const pendingCount = useMemo(
        () => preorders.filter((preorder) => (preorder.status || 'pending') === 'pending').length,
        [preorders]
    )

    const totalPages = Math.max(1, Math.ceil(preorders.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const pageStart = (currentPage - 1) * PAGE_SIZE
    const visiblePreorders = preorders.slice(pageStart, pageStart + PAGE_SIZE)

    const handleStatusUpdate = async (id: string, status: PreorderStatus) => {
        setActiveMutationId(id)
        setFeedback(null)

        const result = await updatePreorderStatus(id, status)

        if (!result.success) {
            setFeedback({
                type: 'error',
                text: result.error || 'Could not update preorder status.',
            })
            setActiveMutationId(null)
            return
        }

        setPreorders((current) =>
            current.map((preorder) =>
                preorder.id === id ? { ...preorder, status } : preorder
            )
        )
        setFeedback({
            type: 'success',
            text: `Preorder marked ${status}.`,
        })
        setActiveMutationId(null)
    }

    const handleCreateOrder = async (preorderId: string) => {
        setActiveMutationId(preorderId)
        setFeedback(null)

        const result = await createPaymentOrderFromPreorder(preorderId)

        if (!result.success || !result.orderId) {
            setFeedback({
                type: 'error',
                text: result.error || 'Could not create payment order.',
            })
            setActiveMutationId(null)
            return
        }

        setPreorders((current) =>
            current.map((preorder) =>
                preorder.id === preorderId
                    ? {
                        ...preorder,
                        status: result.preorderStatus || 'payment_pending',
                        order_id: result.orderId,
                        orders: {
                            ...(preorder.orders || {}),
                            id: result.orderId,
                            order_number: result.orderNumber || preorder.orders?.order_number || null,
                            financial_status: preorder.orders?.financial_status || 'pending',
                        },
                    }
                    : preorder
            )
        )

        const paymentRequestResult = await getOrderPaymentRequest(result.orderId)
        if (paymentRequestResult.success && paymentRequestResult.paymentUrl) {
            setPaymentRequests((current) => ({
                ...current,
                [preorderId]: {
                    paymentUrl: paymentRequestResult.paymentUrl,
                    emailRecipient: paymentRequestResult.emailRecipient || '',
                    smsRecipient: paymentRequestResult.smsRecipient || '',
                },
            }))
        }

        setFeedback({
            type: 'success',
            text: result.alreadyExists
                ? 'Existing payment order is ready to share.'
                : 'Payment order created and payment link generated.',
        })
        setActiveMutationId(null)
    }

    const handleLoadPaymentRequest = async (preorderId: string, orderId: string) => {
        setActiveMutationId(preorderId)
        setFeedback(null)

        const result = await getOrderPaymentRequest(orderId)
        if (!result.success || !result.paymentUrl) {
            setFeedback({
                type: 'error',
                text: result.error || 'Could not generate payment request link.',
            })
            setActiveMutationId(null)
            return
        }

        setPaymentRequests((current) => ({
            ...current,
            [preorderId]: {
                paymentUrl: result.paymentUrl,
                emailRecipient: result.emailRecipient || '',
                smsRecipient: result.smsRecipient || '',
            },
        }))
        setActiveMutationId(null)
    }

    const handleCopyPaymentLink = async (preorderId: string, orderId: string) => {
        const existing = paymentRequests[preorderId]
        const paymentRequest = existing || (await (async () => {
            const result = await getOrderPaymentRequest(orderId)
            if (!result.success || !result.paymentUrl) {
                setFeedback({
                    type: 'error',
                    text: result.error || 'Could not generate payment request link.',
                })
                return null
            }

            const nextState = {
                paymentUrl: result.paymentUrl,
                emailRecipient: result.emailRecipient || '',
                smsRecipient: result.smsRecipient || '',
            }
            setPaymentRequests((current) => ({ ...current, [preorderId]: nextState }))
            return nextState
        })())

        if (!paymentRequest) {
            return
        }

        await navigator.clipboard.writeText(paymentRequest.paymentUrl)
        setFeedback({
            type: 'success',
            text: 'Payment link copied to clipboard.',
        })
    }

    const handleSendPaymentRequest = async (preorderId: string, orderId: string, channel: 'email' | 'sms') => {
        setActiveMutationId(preorderId)
        setFeedback(null)

        const result = await sendOrderPaymentRequest(orderId, channel)
        if (!result.success) {
            setFeedback({
                type: 'error',
                text: result.error || `Could not send ${channel} payment request.`,
            })
            setActiveMutationId(null)
            return
        }

        setFeedback({
            type: 'success',
            text: `${channel === 'email' ? 'Email' : 'SMS'} payment request sent to ${result.recipient}.`,
        })
        setActiveMutationId(null)
    }

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Preorders</h1>
                    <p className="text-sm text-gray-500 mt-1">Review preorder reservations and move them through fulfillment.</p>
                </div>
                <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm">
                    <ClipboardList className="w-4 h-4 mr-2 text-gray-400" />
                    {pendingCount} pending reservations
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                    <button
                        key={filter.value}
                        type="button"
                        onClick={() => {
                            setSelectedStatus(filter.value)
                            setPage(1)
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            selectedStatus === filter.value
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {feedback && (
                <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                    feedback.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-green-200 bg-green-50 text-green-700'
                }`}>
                    {feedback.text}
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reserved</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading preorders...</td>
                            </tr>
                        ) : preorders.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No preorders found for this filter.</td>
                            </tr>
                        ) : (
                            visiblePreorders.map((preorder) => {
                                const customerName = [preorder.customers?.first_name, preorder.customers?.last_name].filter(Boolean).join(' ')
                                const variantLabel = formatVariantLabel(preorder)
                                const productName = preorder.product_title || preorder.product_variants?.products?.title || 'Product unavailable'
                                const productId = preorder.product_variants?.products?.id
                                const paymentRequest = paymentRequests[preorder.id]
                                const displayPrice = preorder.unit_price ?? preorder.product_variants?.price ?? null

                                return (
                                    <tr key={preorder.id} className="hover:bg-gray-50 transition-colors align-top">
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {productId ? (
                                                    <Link href={`/admin/products/${productId}`} className="text-sm font-medium text-gray-900 hover:text-black">
                                                        {productName}
                                                    </Link>
                                                ) : (
                                                    <div className="text-sm font-medium text-gray-900">{productName}</div>
                                                )}
                                                {variantLabel && <div className="text-xs text-gray-500">{variantLabel}</div>}
                                                <div className="text-xs text-gray-500">Qty {preorder.quantity || 1}</div>
                                                {displayPrice ? (
                                                    <div className="text-xs text-gray-500">₹{Number(displayPrice).toFixed(2)}</div>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900">{customerName || preorder.customers?.email || 'Guest customer'}</div>
                                            <div className="text-xs text-gray-500 mt-1">{preorder.customers?.email || '-'}</div>
                                            <div className="text-xs text-gray-500">{preorder.customers?.phone || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(preorder.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusClasses[preorder.status || 'pending'] || 'bg-gray-100 text-gray-800'}`}>
                                                {preorder.status || 'pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {!preorder.order_id && preorder.status !== 'cancelled' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCreateOrder(preorder.id)}
                                                        disabled={activeMutationId === preorder.id}
                                                        className="inline-flex items-center rounded-lg border border-green-200 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                                        Create Payment Order
                                                    </button>
                                                )}
                                                {preorder.order_id && (
                                                    <Link
                                                        href={`/admin/orders/${preorder.order_id}`}
                                                        className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                    >
                                                        View Order
                                                    </Link>
                                                )}
                                                {preorder.order_id && !paymentRequest && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadPaymentRequest(preorder.id, preorder.order_id!)}
                                                        disabled={activeMutationId === preorder.id}
                                                        className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                    >
                                                        Generate Payment Link
                                                    </button>
                                                )}
                                                {preorder.order_id && paymentRequest && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyPaymentLink(preorder.id, preorder.order_id!)}
                                                            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                        >
                                                            <Copy className="w-4 h-4 mr-1.5" />
                                                            Copy Link
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendPaymentRequest(preorder.id, preorder.order_id!, 'email')}
                                                            disabled={activeMutationId === preorder.id || !paymentRequest.emailRecipient}
                                                            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                        >
                                                            <Mail className="w-4 h-4 mr-1.5" />
                                                            Send Email
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendPaymentRequest(preorder.id, preorder.order_id!, 'sms')}
                                                            disabled={activeMutationId === preorder.id || !paymentRequest.smsRecipient}
                                                            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                        >
                                                            <MessageSquare className="w-4 h-4 mr-1.5" />
                                                            Send SMS
                                                        </button>
                                                    </>
                                                )}
                                                {!preorder.order_id && preorder.status !== 'cancelled' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStatusUpdate(preorder.id, 'cancelled')}
                                                        disabled={activeMutationId === preorder.id || preorder.status === 'cancelled'}
                                                        className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        <XCircle className="w-4 h-4 mr-1.5" />
                                                        Cancel
                                                    </button>
                                                )}
                                                {!preorder.order_id && preorder.status === 'cancelled' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStatusUpdate(preorder.id, 'pending')}
                                                        disabled={activeMutationId === preorder.id}
                                                        className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                    >
                                                        Reopen
                                                    </button>
                                                )}
                                            </div>
                                            {paymentRequest && (
                                                <p className="mt-3 text-right text-xs text-gray-500 break-all">
                                                    {paymentRequest.paymentUrl}
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <PaginationBar
                page={currentPage}
                totalItems={preorders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
            />
        </div>
    )
}
