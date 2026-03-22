'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Link as LinkIcon,
  Mail,
  MessageSquare,
  Package,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'
import {
  getCustomers,
  getOrder,
  getOrderTimeline,
  refundOrder,
  repairOrders,
  updateOrderHeader,
  updateOrderLineItems,
  updateOrderShipment,
  updateOrderStatus,
  type EditableOrderLineInput,
  type OrderRecord,
  type OrderTimelineEntry,
} from '@/lib/actions/order-actions'
import { searchVariants } from '@/lib/actions/product-actions'
import {
  canEditOrderLineItems,
  getAllowedFulfillmentStatuses,
  getFulfillmentDisplayLabel,
  getValidFulfillmentTransitions,
  isShippingRelevant,
} from '@/lib/orders/workflow'

type OrderItem = {
  id: string
  variant_id?: string | null
  quantity: number
  unit_price: number | string
  total_price: number | string
  discount_amount?: number | string | null
  product_variants?: {
    id?: string
    sku?: string | null
    products?: {
      title?: string | null
      product_media?: Array<{ media_url?: string | null }> | null
    } | null
  } | null
}

type PaymentRequestDelivery = {
  id: string
  channel: 'email' | 'sms'
  provider: string
  recipient: string
  status: 'processing' | 'sent' | 'failed'
  provider_reference?: string | null
  error_message?: string | null
  payment_url: string
  created_at: string
}

type OrderDetail = Omit<OrderRecord, 'order_items' | 'payment_request_deliveries'> & {
  order_items: OrderItem[]
  payment_request_deliveries?: PaymentRequestDelivery[]
}

type CustomerOption = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
}

type SearchVariantResult = {
  id: string
  title: string
  sku?: string | null
  price?: number | null
  product_images?: string[]
  is_active?: boolean
  product_status?: string | null
  available_quantity?: number
}

type EditableLineItem = {
  variantId: string
  title: string
  sku?: string | null
  image?: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  availableQuantity?: number
  isActive?: boolean
  productStatus?: string | null
}

type AddressForm = {
  name: string
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
  phone: string
}

type HeaderFormState = {
  customerId: string
  customerQuery: string
  paymentMethod: string
  notes: string
  salesChannel: 'online' | 'pos'
  guestName: string
  guestEmail: string
  guestPhone: string
  tags: string
  billing: AddressForm
  shipping: AddressForm
}

type ShipmentFormState = {
  trackingId: string
  courier: string
  deliveryStatus: string
  shippedAt: string
  deliveredAt: string
  deliveryNotes: string
  shippingCharge: string
}

type PendingAction = {
  value: string
  label: string
}

const EMPTY_ADDRESS: AddressForm = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  phone: '',
}

function formatCurrency(amount: number | string | null | undefined, currency = 'INR') {
  const value = typeof amount === 'number' ? amount : Number(amount ?? 0)
  const safeValue = Number.isFinite(value) ? value : 0

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(safeValue)
  } catch {
    return `₹${safeValue.toFixed(2)}`
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not set'
  }

  return new Date(value).toLocaleString()
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
    case 'delivered':
    case 'completed':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700'
    case 'processing':
    case 'shipped':
      return 'border-sky-100 bg-sky-50 text-sky-700'
    case 'pending':
    case 'unpaid':
      return 'border-amber-100 bg-amber-50 text-amber-700'
    case 'failed':
    case 'cancelled':
    case 'returned':
    case 'refunded':
      return 'border-rose-100 bg-rose-50 text-rose-700'
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700'
  }
}

function titleCase(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function toAddressForm(address?: Record<string, unknown> | null): AddressForm {
  if (!address) {
    return { ...EMPTY_ADDRESS }
  }

  return {
    name: typeof address.name === 'string' ? address.name : '',
    line1: typeof address.line1 === 'string' ? address.line1 : '',
    line2: typeof address.line2 === 'string' ? address.line2 : '',
    city: typeof address.city === 'string' ? address.city : '',
    state: typeof address.state === 'string' ? address.state : '',
    postal_code: typeof address.postal_code === 'string' ? address.postal_code : '',
    country: typeof address.country === 'string' ? address.country : '',
    phone: typeof address.phone === 'string' ? address.phone : '',
  }
}

function toAddressPayload(address: AddressForm) {
  const entries = Object.entries(address).filter(([, value]) => value.trim().length > 0)
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

function formatAddress(address: AddressForm) {
  return Object.values(address).filter((value) => value.trim().length > 0)
}

function createHeaderForm(order: OrderDetail): HeaderFormState {
  return {
    customerId: order.customer_id || '',
    customerQuery: order.customer_label || '',
    paymentMethod: order.payment_method || '',
    notes: order.notes || '',
    salesChannel: order.sales_channel,
    guestName: order.guest_name || '',
    guestEmail: order.guest_email || '',
    guestPhone: order.guest_phone || '',
    tags: order.tags.join(', '),
    billing: toAddressForm(order.billing_address),
    shipping: toAddressForm(order.shipping_address),
  }
}

function createShipmentForm(order: OrderDetail): ShipmentFormState {
  return {
    trackingId: order.tracking_id || '',
    courier: order.courier || '',
    deliveryStatus: order.status,
    shippedAt: order.shipped_at ? order.shipped_at.slice(0, 16) : '',
    deliveredAt: order.delivered_at ? order.delivered_at.slice(0, 16) : '',
    deliveryNotes: order.delivery_notes || '',
    shippingCharge: String(order.shipping_amount || order.shipping_charge || 0),
  }
}

function createEditableItems(order: OrderDetail): EditableLineItem[] {
  return order.order_items.map((item) => ({
    variantId: item.variant_id || item.product_variants?.id || '',
    title: item.product_variants?.products?.title || 'Order item',
    sku: item.product_variants?.sku || null,
    image: item.product_variants?.products?.product_media?.[0]?.media_url ?? null,
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    discountAmount: Number(item.discount_amount ?? 0),
  }))
}

function getTimelineLabel(action: string) {
  switch (action) {
    case 'order.create':
      return 'Order created'
    case 'order.status.update':
      return 'Workflow updated'
    case 'order.header.update':
      return 'Header updated'
    case 'order.shipment.update':
      return 'Shipment updated'
    case 'order.items.update':
      return 'Line items updated'
    case 'order.refund':
      return 'Refund issued'
    case 'order.repair':
      return 'Record normalized'
    case 'order.created.record':
      return 'Legacy order imported'
    default:
      return titleCase(action.replaceAll('.', ' '))
  }
}

function summarizeTimeline(entry: OrderTimelineEntry) {
  if (entry.action === 'order.items.update') {
    return 'Product quantities or pricing changed.'
  }

  const after = entry.after
  if (!after || typeof after !== 'object' || Array.isArray(after)) {
    return 'Recorded in the order audit log.'
  }

  const keys = Object.keys(after)
  if (keys.length === 0) {
    return 'Recorded in the order audit log.'
  }

  return `Changed ${keys.slice(0, 4).map((key) => titleCase(key)).join(', ')}${keys.length > 4 ? '…' : ''}.`
}

function paymentLabel(status: string) {
  return titleCase(status)
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = Array.isArray(params.id) ? params.id[0] : (params.id as string | undefined)

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [timeline, setTimeline] = useState<OrderTimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundRestock, setRefundRestock] = useState(true)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [pageMessage, setPageMessage] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const [headerForm, setHeaderForm] = useState<HeaderFormState | null>(null)
  const [shipmentForm, setShipmentForm] = useState<ShipmentFormState | null>(null)
  const [editableItems, setEditableItems] = useState<EditableLineItem[]>([])
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [productResults, setProductResults] = useState<SearchVariantResult[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isEditingItems, setIsEditingItems] = useState(false)
  const [isEditingShipment, setIsEditingShipment] = useState(false)

  const [headerSaving, setHeaderSaving] = useState(false)
  const [shipmentSaving, setShipmentSaving] = useState(false)
  const [itemsSaving, setItemsSaving] = useState(false)
  const [headerFeedback, setHeaderFeedback] = useState<string | null>(null)
  const [shipmentFeedback, setShipmentFeedback] = useState<string | null>(null)
  const [itemsFeedback, setItemsFeedback] = useState<string | null>(null)

  const deferredCustomerQuery = useDeferredValue(headerForm?.customerQuery || '')
  const deferredProductSearch = useDeferredValue(productSearch)

  const loadOrder = useCallback(async (showRefreshState = false) => {
    if (!orderId) {
      return
    }

    if (showRefreshState) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    const [orderData, timelineData] = await Promise.all([getOrder(orderId), getOrderTimeline(orderId)])
    setOrder(orderData as OrderDetail | null)
    setTimeline(timelineData.data || [])
    setLoading(false)
    setRefreshing(false)
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (!order) {
      return
    }

    setHeaderForm(createHeaderForm(order))
    setShipmentForm(createShipmentForm(order))
    setEditableItems(createEditableItems(order))
    setCustomerOptions(order.customers?.id ? [order.customers as CustomerOption] : [])
  }, [order])

  useEffect(() => {
    let cancelled = false

    const search = async () => {
      if (!headerForm) {
        return
      }

      const query = deferredCustomerQuery.trim()
      if (!query) {
        if (!cancelled) {
          setCustomerOptions(order?.customers?.id ? [order.customers as CustomerOption] : [])
        }
        return
      }

      const result = await getCustomers({ query, page: 1, limit: 10 })
      if (!cancelled) {
        setCustomerOptions(result.data || [])
      }
    }

    search()
    return () => {
      cancelled = true
    }
  }, [deferredCustomerQuery, headerForm, order?.customers])

  useEffect(() => {
    let cancelled = false

    const search = async () => {
      const query = deferredProductSearch.trim()
      if (!query || !isEditingItems) {
        if (!cancelled) {
          setProductResults([])
        }
        return
      }

      const results = await searchVariants(query)
      if (!cancelled) {
        setProductResults(results)
      }
    }

    search()
    return () => {
      cancelled = true
    }
  }, [deferredProductSearch, isEditingItems])

  const isOnline = order ? isShippingRelevant(order.sales_channel) : false
  const canEditItems = order ? canEditOrderLineItems(order.sales_channel, order.status as never, order.payment_status as never) : false

  const totals = useMemo(() => {
    if (!order) {
      return { subtotal: 0, orderLevelDiscount: 0, lineDiscount: 0, tax: 0, shipping: 0, grand: 0 }
    }

    const currentLineDiscount = order.order_items.reduce((sum, item) => sum + Number(item.discount_amount ?? 0), 0)
    const orderLevelDiscount = Math.max(0, (order.discount_amount || 0) - currentLineDiscount)
    const editableLineDiscount = editableItems.reduce((sum, item) => sum + item.discountAmount, 0)
    const subtotal = isEditingItems
      ? editableItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
      : (order.subtotal_amount || order.order_items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0))
    const tax = order.tax_amount || 0
    const shipping = Number(shipmentForm?.shippingCharge ?? order.shipping_amount ?? 0) || 0
    const discount = orderLevelDiscount + (isEditingItems ? editableLineDiscount : currentLineDiscount)

    return {
      subtotal,
      orderLevelDiscount,
      lineDiscount: isEditingItems ? editableLineDiscount : currentLineDiscount,
      tax,
      shipping,
      grand: subtotal - discount + tax + shipping,
    }
  }, [editableItems, isEditingItems, order, shipmentForm?.shippingCharge])

  const availableTransitions = order ? getValidFulfillmentTransitions(order.sales_channel, order.status as never) : []
  const shipmentStatusOptions = order ? getAllowedFulfillmentStatuses(order.sales_channel) : []

  const refreshOrder = async () => {
    setPageMessage(null)
    setPageError(null)
    await loadOrder(true)
  }

  const requestAction = (value: string, label: string) => {
    setPendingAction({ value, label })
    setConfirmOpen(true)
  }

  const handleWorkflowConfirm = async () => {
    if (!pendingAction || !order) {
      return
    }

    setUpdating(true)
    setPageError(null)
    try {
      const result = await updateOrderStatus(order.id, pendingAction.value)
      if (result?.error) {
        setPageError(result.error)
        return
      }

      setPageMessage(`Order updated to ${pendingAction.label}.`)
      await refreshOrder()
    } finally {
      setUpdating(false)
      setConfirmOpen(false)
      setPendingAction(null)
    }
  }

  const handleRepair = async () => {
    if (!order) {
      return
    }

    setRepairing(true)
    setPageError(null)
    const result = await repairOrders([order.id])
    setRepairing(false)

    if (result.error) {
      setPageError(result.error)
      return
    }

    setPageMessage(`${result.updated || 0} repair change applied.`)
    await refreshOrder()
  }

  const handleHeaderSave = async () => {
    if (!order || !headerForm) {
      return
    }

    setHeaderSaving(true)
    setHeaderFeedback(null)

    const result = await updateOrderHeader({
      orderId: order.id,
      customerId: headerForm.customerId || null,
      paymentMethod: headerForm.paymentMethod || null,
      notes: headerForm.notes || null,
      salesChannel: headerForm.salesChannel,
      guestName: headerForm.guestName || null,
      guestEmail: headerForm.guestEmail || null,
      guestPhone: headerForm.guestPhone || null,
      tags: headerForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      billingAddress: toAddressPayload(headerForm.billing),
      shippingAddress: headerForm.salesChannel === 'online' ? toAddressPayload(headerForm.shipping) : null,
    })

    setHeaderSaving(false)

    if (result.error) {
      setHeaderFeedback(result.error)
      return
    }

    setHeaderFeedback(result.warnings?.length ? result.warnings.join(' ') : 'Header updated.')
    setIsEditingHeader(false)
    await refreshOrder()
  }

  const handleShipmentSave = async () => {
    if (!order || !shipmentForm) {
      return
    }

    setShipmentSaving(true)
    setShipmentFeedback(null)

    const result = await updateOrderShipment({
      orderId: order.id,
      trackingId: shipmentForm.trackingId || null,
      courier: shipmentForm.courier || null,
      deliveryStatus: shipmentForm.deliveryStatus || null,
      shippedAt: shipmentForm.shippedAt ? new Date(shipmentForm.shippedAt).toISOString() : null,
      deliveredAt: shipmentForm.deliveredAt ? new Date(shipmentForm.deliveredAt).toISOString() : null,
      deliveryNotes: shipmentForm.deliveryNotes || null,
      shippingCharge: shipmentForm.shippingCharge ? Number(shipmentForm.shippingCharge) : 0,
    })

    setShipmentSaving(false)

    if (result.error) {
      setShipmentFeedback(result.error)
      return
    }

    setShipmentFeedback(result.warnings?.length ? result.warnings.join(' ') : 'Shipment updated.')
    setIsEditingShipment(false)
    await refreshOrder()
  }

  const handleItemSave = async () => {
    if (!order) {
      return
    }

    setItemsSaving(true)
    setItemsFeedback(null)

    const payload: EditableOrderLineInput[] = editableItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      title: item.title,
      sku: item.sku,
    }))

    const result = await updateOrderLineItems(order.id, payload)
    setItemsSaving(false)

    if (result.error) {
      setItemsFeedback(result.error)
      return
    }

    setItemsFeedback('Line items updated.')
    setIsEditingItems(false)
    setProductSearch('')
    await refreshOrder()
  }

  const handleRefund = async () => {
    if (!order) {
      return
    }

    const parsedAmount = Number(refundAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setRefundError('Enter a valid refund amount.')
      return
    }

    setUpdating(true)
    setRefundError(null)

    const result = await refundOrder(order.id, parsedAmount, refundReason, refundRestock)
    setUpdating(false)

    if (!result.success) {
      setRefundError(result.error || 'Failed to refund order.')
      return
    }

    setRefundOpen(false)
    setPageMessage('Refund recorded.')
    await refreshOrder()
  }

  const addSearchResultToItems = (result: SearchVariantResult) => {
    if (editableItems.some((item) => item.variantId === result.id)) {
      return
    }

    setEditableItems((current) => [
      ...current,
      {
        variantId: result.id,
        title: result.title,
        sku: result.sku || null,
        image: result.product_images?.[0] || null,
        quantity: 1,
        unitPrice: Number(result.price ?? 0),
        discountAmount: 0,
        availableQuantity: result.available_quantity,
        isActive: result.is_active,
        productStatus: result.product_status || null,
      },
    ])
    setProductSearch('')
    setProductResults([])
  }

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading order...</div>
  }

  if (!order || !headerForm || !shipmentForm) {
    return <div className="p-10 text-center text-gray-500">Order not found.</div>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => router.push('/admin/orders')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </button>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black text-gray-900">Order #{order.order_number || order.id.slice(0, 8)}</h1>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadge(order.status)}`}>
                {getFulfillmentDisplayLabel(order.status as never)}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadge(order.payment_status)}`}>
                {paymentLabel(order.payment_status)}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                order.sales_channel === 'pos' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'
              }`}>
                {order.sales_channel.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Placed on {new Date(order.created_at).toLocaleString()} {order.updated_at ? `• Updated ${new Date(order.updated_at).toLocaleString()}` : ''}
            </p>
            <p className="max-w-3xl text-sm text-gray-500">
              {order.sales_channel === 'pos'
                ? 'POS orders use a compact completion workflow. Shipping controls are hidden unless the order is moved back to an online channel.'
                : 'Online orders keep fulfillment, shipment metadata, and delivery tracking together in one editor.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRepair}
            disabled={repairing}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${repairing || refreshing ? 'animate-spin' : ''}`} />
            {repairing ? 'Repairing...' : 'Repair Data'}
          </button>
          <button
            type="button"
            onClick={refreshOrder}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href={`/admin/orders/${order.id}/invoice`}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Open Invoice
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {pageMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
          {pageMessage}
        </div>
      )}
      {pageError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900 shadow-sm">
          {pageError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Grand Total</p>
          <p className="mt-3 text-3xl font-black text-gray-900">{formatCurrency(totals.grand, order.currency || 'INR')}</p>
          <p className="mt-1 text-sm text-gray-500">Payment method: {order.payment_method || 'Unknown'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Customer</p>
          <p className="mt-3 text-xl font-black text-gray-900">{order.customer_label}</p>
          <p className="mt-1 text-sm text-gray-500">{order.customer_type}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Items</p>
          <p className="mt-3 text-3xl font-black text-gray-900">{editableItems.length}</p>
          <p className="mt-1 text-sm text-gray-500">{canEditItems ? 'Editable in current workflow state' : 'Locked by fulfillment/payment state'}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Data Health</p>
          <p className="mt-3 text-3xl font-black text-gray-900">{order.data_issues.length}</p>
          <p className="mt-1 text-sm text-gray-500">{order.data_issues.length === 0 ? 'Normalized record' : 'Issues flagged for review'}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Header & Customer</h2>
                <p className="text-sm text-gray-500">Relink customers, change channel, update notes, and maintain billing or shipping details.</p>
              </div>
              <div className="flex gap-2">
                {!isEditingHeader ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingHeader(true)}
                    className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderForm(createHeaderForm(order))
                        setIsEditingHeader(false)
                        setHeaderFeedback(null)
                      }}
                      className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleHeaderSave}
                      disabled={headerSaving}
                      className="inline-flex items-center rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {headerSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {headerFeedback && <p className="mt-4 text-sm text-gray-600">{headerFeedback}</p>}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Customer search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={headerForm.customerQuery}
                    onChange={(event) => setHeaderForm((current) => current ? { ...current, customerQuery: event.target.value } : current)}
                    disabled={!isEditingHeader}
                    placeholder="Search name, email, or phone"
                    className="w-full rounded-xl border border-gray-300 px-10 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </div>
                {isEditingHeader && customerOptions.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-gray-200">
                    {customerOptions.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setHeaderForm((current) => current ? {
                          ...current,
                          customerId: customer.id,
                          customerQuery: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email || customer.phone || '',
                        } : current)}
                        className="block w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50 last:border-b-0"
                      >
                        <p className="font-medium text-gray-900">{[customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email || customer.phone || 'Customer'}</p>
                        <p className="text-xs text-gray-500">{customer.email || customer.phone || customer.id}</p>
                      </button>
                    ))}
                  </div>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Channel</span>
                <select
                  value={headerForm.salesChannel}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, salesChannel: event.target.value as 'online' | 'pos' } : current)}
                  disabled={!isEditingHeader}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="online">Online</option>
                  <option value="pos">POS</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Payment method</span>
                <input
                  type="text"
                  value={headerForm.paymentMethod}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, paymentMethod: event.target.value } : current)}
                  disabled={!isEditingHeader}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Tags</span>
                <input
                  type="text"
                  value={headerForm.tags}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, tags: event.target.value } : current)}
                  disabled={!isEditingHeader}
                  placeholder="vip, exchange, fragile"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Guest name</span>
                <input
                  type="text"
                  value={headerForm.guestName}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, guestName: event.target.value } : current)}
                  disabled={!isEditingHeader}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Guest email</span>
                <input
                  type="email"
                  value={headerForm.guestEmail}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, guestEmail: event.target.value } : current)}
                  disabled={!isEditingHeader}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Guest phone</span>
                <input
                  type="text"
                  value={headerForm.guestPhone}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, guestPhone: event.target.value } : current)}
                  disabled={!isEditingHeader}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Notes</span>
                <textarea
                  value={headerForm.notes}
                  onChange={(event) => setHeaderForm((current) => current ? { ...current, notes: event.target.value } : current)}
                  disabled={!isEditingHeader}
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {(['billing', 'shipping'] as const).map((section) => {
                if (section === 'shipping' && headerForm.salesChannel === 'pos') {
                  return null
                }

                const address = headerForm[section]
                const lines = formatAddress(address)

                return (
                  <div key={section} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">{titleCase(section)} details</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {Object.keys(EMPTY_ADDRESS).map((key) => (
                        <label key={key} className={`block ${key === 'line2' ? 'sm:col-span-2' : ''}`}>
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">{titleCase(key)}</span>
                          <input
                            type="text"
                            value={address[key as keyof AddressForm]}
                            onChange={(event) => setHeaderForm((current) => current ? {
                              ...current,
                              [section]: {
                                ...current[section],
                                [key]: event.target.value,
                              },
                            } : current)}
                            disabled={!isEditingHeader}
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                          />
                        </label>
                      ))}
                    </div>
                    {!isEditingHeader && lines.length > 0 && (
                      <div className="mt-4 space-y-1 text-sm text-gray-600">
                        {lines.map((line) => <p key={`${section}-${line}`}>{line}</p>)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Line Items</h2>
                <p className="text-sm text-gray-500">Edit quantity, price, and discounts safely. Inventory is adjusted only by the net quantity delta.</p>
              </div>
              <div className="flex gap-2">
                {!isEditingItems ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingItems(true)}
                    disabled={!canEditItems}
                    className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditableItems(createEditableItems(order))
                        setProductSearch('')
                        setProductResults([])
                        setIsEditingItems(false)
                        setItemsFeedback(null)
                      }}
                      className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleItemSave}
                      disabled={itemsSaving}
                      className="inline-flex items-center rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {itemsSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {itemsFeedback && <p className="px-6 pt-4 text-sm text-gray-600">{itemsFeedback}</p>}
            {!canEditItems && (
              <div className="px-6 pt-4 text-sm text-amber-700">
                Line editing is locked after shipment, completion, return, or refund to protect inventory integrity.
              </div>
            )}

            {isEditingItems && (
              <div className="border-b border-gray-100 px-6 py-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search products or SKU to add"
                    className="w-full rounded-xl border border-gray-300 px-10 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                  {productResults.length > 0 && (
                    <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
                      {productResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => addSearchResultToItems(result)}
                          className="flex w-full items-start justify-between gap-4 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{result.title}</p>
                            <p className="text-xs text-gray-500">
                              SKU: {result.sku || 'N/A'} • Stock: {result.available_quantity ?? 0}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>{formatCurrency(result.price || 0)}</p>
                            <p>{result.is_active === false || (result.product_status && result.product_status !== 'active') ? 'Inactive' : 'Active'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {editableItems.map((item, index) => (
                <div key={`${item.variantId}-${index}`} className="flex flex-col gap-4 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    {item.image ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-gray-100">
                        <Image src={item.image} alt={item.title} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                        <Package className="h-8 w-8" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.sku || 'SKU unavailable'}</p>
                      {isEditingItems && (item.isActive === false || (item.productStatus && item.productStatus !== 'active')) && (
                        <p className="mt-1 text-xs text-amber-700">Inactive variant. Quantity can only stay the same or decrease.</p>
                      )}
                    </div>
                    {isEditingItems ? (
                      <div className="grid gap-3 sm:grid-cols-4 lg:w-[420px]">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Qty</span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => setEditableItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: Number(event.target.value || 1) } : line))}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Unit price</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) => setEditableItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, unitPrice: Number(event.target.value || 0) } : line))}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Discount</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.discountAmount}
                            onChange={(event) => setEditableItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, discountAmount: Number(event.target.value || 0) } : line))}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditableItems((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                          className="mt-5 inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">{item.quantity} x {formatCurrency(item.unitPrice, order.currency || 'INR')}</p>
                        {item.discountAmount > 0 && <p className="text-xs text-rose-600">Discount {formatCurrency(item.discountAmount, order.currency || 'INR')}</p>}
                        <p className="text-sm font-bold text-gray-900">{formatCurrency((item.unitPrice * item.quantity) - item.discountAmount, order.currency || 'INR')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totals.subtotal, order.currency || 'INR')}</span>
                </div>
                {totals.orderLevelDiscount > 0 && (
                  <div className="flex items-center justify-between text-rose-600">
                    <span>Order discount</span>
                    <span>-{formatCurrency(totals.orderLevelDiscount, order.currency || 'INR')}</span>
                  </div>
                )}
                {totals.lineDiscount > 0 && (
                  <div className="flex items-center justify-between text-rose-600">
                    <span>Line discounts</span>
                    <span>-{formatCurrency(totals.lineDiscount, order.currency || 'INR')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatCurrency(totals.tax, order.currency || 'INR')}</span>
                </div>
                {totals.shipping > 0 && (
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{formatCurrency(totals.shipping, order.currency || 'INR')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(totals.grand, order.currency || 'INR')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-gray-400" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Timeline</h2>
                <p className="text-sm text-gray-500">Uses the existing audit log so workflow, shipment, refunds, and repairs stay visible.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {timeline.length > 0 ? timeline.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{getTimelineLabel(entry.action)}</p>
                      <p className="mt-1 text-sm text-gray-600">{summarizeTimeline(entry)}</p>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-400">{entry.actorLabel || 'System'}</p>
                </div>
              )) : (
                <p className="text-sm text-gray-500">No timeline entries yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Workflow</h2>
            <p className="mt-2 text-sm text-gray-500">
              {order.sales_channel === 'pos'
                ? 'POS workflow: pending, completed, cancelled, returned.'
                : 'Online workflow: pending, processing, shipped, delivered, cancelled, returned.'}
            </p>
            <div className="mt-4 space-y-3">
              {availableTransitions.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => requestAction(status, getFulfillmentDisplayLabel(status))}
                  disabled={updating}
                  className="flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {status === 'shipped' ? <Truck className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Mark as {getFulfillmentDisplayLabel(status)}
                </button>
              ))}
              {['processing', 'shipped', 'delivered', 'completed', 'returned', 'cancelled'].includes(order.status) && (
                <button
                  type="button"
                  onClick={() => {
                    setRefundOpen(true)
                    setRefundAmount(String(order.total_amount || ''))
                    setRefundReason('')
                    setRefundError(null)
                  }}
                  disabled={updating}
                  className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Issue Refund
                </button>
              )}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Payment State</p>
              <div className="mt-3 space-y-3">
                {order.payment_status !== 'paid' && (
                  <button
                    type="button"
                    onClick={() => requestAction('paid', 'Paid')}
                    disabled={updating}
                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Mark as Paid
                  </button>
                )}
                {order.payment_status !== 'unpaid' && order.payment_status !== 'refunded' && (
                  <button
                    type="button"
                    onClick={() => requestAction('unpaid', 'Unpaid')}
                    disabled={updating}
                    className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    Mark as Unpaid
                  </button>
                )}
                {order.payment_status !== 'failed' && order.payment_status !== 'refunded' && (
                  <button
                    type="button"
                    onClick={() => requestAction('failed', 'Failed')}
                    disabled={updating}
                    className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    Mark as Failed
                  </button>
                )}
              </div>
            </div>
          </div>

          {isOnline && (
            <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Shipment & Delivery</h2>
                  <p className="text-sm text-gray-500">Tracking, courier, shipping charge, and proof-of-delivery timestamps live here.</p>
                </div>
                <div className="flex gap-2">
                  {!isEditingShipment ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingShipment(true)}
                      className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShipmentForm(createShipmentForm(order))
                          setIsEditingShipment(false)
                          setShipmentFeedback(null)
                        }}
                        className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleShipmentSave}
                        disabled={shipmentSaving}
                        className="inline-flex items-center rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {shipmentSaving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {shipmentFeedback && <p className="mt-4 text-sm text-gray-600">{shipmentFeedback}</p>}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Tracking ID</span>
                  <input
                    type="text"
                    value={shipmentForm.trackingId}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, trackingId: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Courier</span>
                  <input
                    type="text"
                    value={shipmentForm.courier}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, courier: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Delivery status</span>
                  <select
                    value={shipmentForm.deliveryStatus}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, deliveryStatus: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  >
                    {shipmentStatusOptions.map((status) => (
                      <option key={status} value={status}>{getFulfillmentDisplayLabel(status)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Shipping charge</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={shipmentForm.shippingCharge}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, shippingCharge: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Shipped at</span>
                  <input
                    type="datetime-local"
                    value={shipmentForm.shippedAt}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, shippedAt: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Delivered at</span>
                  <input
                    type="datetime-local"
                    value={shipmentForm.deliveredAt}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, deliveredAt: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Delivery notes</span>
                  <textarea
                    value={shipmentForm.deliveryNotes}
                    onChange={(event) => setShipmentForm((current) => current ? { ...current, deliveryNotes: event.target.value } : current)}
                    disabled={!isEditingShipment}
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                </label>
              </div>

              {!isEditingShipment && (
                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                  <p>Tracking: {shipmentForm.trackingId || 'Not set'}</p>
                  <p>Courier: {shipmentForm.courier || 'Not set'}</p>
                  <p>Shipped: {formatDateTime(order.shipped_at)}</p>
                  <p>Delivered: {formatDateTime(order.delivered_at)}</p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Customer Snapshot</h2>
            <div className="mt-4 space-y-2">
              <p className="text-lg font-semibold text-gray-900">{order.customer_label}</p>
              <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {order.customer_type}
              </span>
              <p className="text-sm text-gray-500">{order.customer_email || 'No email available'}</p>
              <p className="text-sm text-gray-500">{order.customer_phone || 'No phone available'}</p>
              {order.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {order.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{tag}</span>
                  ))}
                </div>
              )}
              {order.notes && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                  {order.notes}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Payment Request Audit</h2>
            <p className="mt-1 text-sm text-gray-500">Payment-link attempts remain visible alongside the order timeline.</p>
            {order.payment_request_deliveries && order.payment_request_deliveries.length > 0 ? (
              <div className="mt-4 space-y-4">
                {order.payment_request_deliveries.map((delivery) => (
                  <div key={delivery.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                          {delivery.channel === 'email' ? <Mail className="h-4 w-4 text-gray-400" /> : <MessageSquare className="h-4 w-4 text-gray-400" />}
                          <span className="capitalize">{delivery.channel}</span>
                          <span className="text-gray-400">via</span>
                          <span className="capitalize">{delivery.provider}</span>
                        </div>
                        <p className="mt-1 break-all text-sm text-gray-600">{delivery.recipient || 'No recipient'}</p>
                        <p className="mt-1 text-xs text-gray-500">{new Date(delivery.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadge(delivery.status)}`}>
                        {delivery.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-gray-500">
                      <p className="flex items-start gap-2 break-all">
                        <LinkIcon className="mt-0.5 h-3.5 w-3.5" />
                        <span>{delivery.payment_url}</span>
                      </p>
                      {delivery.provider_reference && <p>Provider ref: {delivery.provider_reference}</p>}
                      {delivery.error_message && <p className="text-rose-600">Error: {delivery.error_message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No payment requests have been sent for this order yet.</p>
            )}
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Data Health</h2>
            {order.data_issues.length === 0 ? (
              <p className="mt-4 text-sm text-emerald-700">This order is normalized across fulfillment, payment, totals, and channel fields.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {order.data_issues.map((issue) => (
                  <div key={issue} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleWorkflowConfirm}
        title="Update Order"
        message={pendingAction ? `Are you sure you want to mark this order as ${pendingAction.label}?` : 'Confirm update'}
        confirmText="Confirm"
        loading={updating}
      />

      {refundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Issue Refund</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-700">Amount</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Reason</label>
                <textarea
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={refundRestock}
                  onChange={(event) => setRefundRestock(event.target.checked)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span>Restock items</span>
              </label>
              {refundError && <p className="text-sm text-rose-600">{refundError}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRefund}
                disabled={updating}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {updating ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
