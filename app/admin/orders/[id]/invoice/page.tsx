'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, CheckCircle, Download, Printer } from 'lucide-react'
import { getOrder, type OrderRecord } from '@/lib/actions/order-actions'
import { getSettings } from '@/lib/actions/settings-actions'
import { normalizeInvoiceTemplate } from '@/lib/invoice-template'

type InvoiceOrder = Omit<OrderRecord, 'order_items'> & {
  order_items: Array<{
    id: string
    quantity: number
    unit_price: number | string
    total_price: number | string
    product_variants?: {
      sku?: string | null
      products?: {
        title?: string | null
      } | null
    } | null
  }>
}

type AppSettings = {
  store_name?: string | null
  store_address?: string | null
  store_email?: string | null
  store_phone?: string | null
  store_currency?: string | null
  gstin?: string | null
  invoice_template?: unknown
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

function formatAddress(address?: Record<string, unknown> | null) {
  if (!address) {
    return []
  }

  const preferredKeys = ['name', 'line1', 'line2', 'city', 'state', 'postal_code', 'country', 'phone']
  const orderedValues = preferredKeys
    .map((key) => address[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  if (orderedValues.length > 0) {
    return orderedValues
  }

  return Object.values(address).filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

export default function InvoicePage() {
  const params = useParams()
  const [order, setOrder] = useState<InvoiceOrder | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id) {
      return
    }

    Promise.all([getOrder(params.id as string), getSettings()])
      .then(([orderData, settingsData]) => {
        setOrder(orderData as InvoiceOrder | null)
        setSettings(settingsData as AppSettings | null)
      })
      .finally(() => setLoading(false))
  }, [params.id])

  const currency = order?.currency || settings?.store_currency || 'INR'
  const billingAddress = formatAddress(order?.billing_address)
  const shippingAddress = formatAddress(order?.shipping_address)
  const template = useMemo(() => normalizeInvoiceTemplate(settings?.invoice_template), [settings?.invoice_template])

  const totals = useMemo(() => {
    if (!order) {
      return { subtotal: 0, discount: 0, tax: 0, shipping: 0, grand: 0 }
    }

    const subtotal = order.subtotal_amount || order.order_items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0)
    const discount = order.discount_amount || 0
    const tax = order.tax_amount || 0
    const shipping = order.shipping_amount || 0

    return {
      subtotal,
      discount,
      tax,
      shipping,
      grand: order.total_amount || subtotal - discount + tax + shipping,
    }
  }, [order])

  const handlePrintOrDownload = () => {
    const previousTitle = document.title
    const invoiceLabel = `${settings?.store_name || 'Cluster Fascination'}-invoice-${order?.order_number || order?.id.slice(0, 8) || 'order'}`
    document.title = invoiceLabel
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 300)
  }

  if (loading) {
    return <div className="p-10 text-center">Loading invoice...</div>
  }

  if (!order) {
    return <div className="p-10 text-center">Order not found.</div>
  }

  return (
    <div className="invoice-page min-h-screen bg-gray-100 p-4 sm:p-6 print:bg-white print:p-0">
      <div className={`invoice-shell mx-auto max-w-[920px] overflow-hidden bg-white print:rounded-none print:shadow-none ${
        template.layout === 'classic'
          ? 'border border-gray-300 shadow-lg'
          : template.layout === 'minimal'
            ? 'rounded-2xl border border-gray-200 shadow-sm'
            : 'rounded-2xl shadow-xl'
      }`}>
        <div className="mb-8 flex items-center justify-between print:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{template.headerLabel}</p>
            <h1 className="text-2xl font-black text-gray-900">#{order.order_number || order.id.slice(0, 8)}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/admin/orders/${order.id}/invoice/download`}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:border-gray-900 hover:text-gray-900"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
            <button
              type="button"
              onClick={handlePrintOrDownload}
              className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-white transition hover:bg-black"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div
          className="invoice-hero border-b border-gray-200 px-6 py-6 sm:px-8"
          style={template.layout === 'minimal' ? undefined : { borderTop: `8px solid ${template.accentColor}` }}
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{template.headerLabel}</p>
              <h2 className="text-[30px] font-black leading-tight text-gray-900">{settings?.store_name || 'Cluster ERP'}</h2>
              {settings?.store_address && <p className="max-w-xl whitespace-pre-line text-sm leading-6 text-gray-600">{settings.store_address}</p>}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                {settings?.store_phone && <p>Phone: {settings.store_phone}</p>}
                {settings?.store_email && <p>Email: {settings.store_email}</p>}
                {settings?.gstin && <p>GSTIN: {settings.gstin}</p>}
              </div>
              <div className="pt-2">
                <h3 className="text-lg font-bold text-gray-900">{template.heroTitle}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">{template.heroMessage}</p>
              </div>
            </div>
            <div
              className={`min-w-[250px] rounded-2xl border px-5 py-4 text-sm ${
                template.layout === 'classic'
                  ? 'border-gray-300 bg-stone-50'
                  : template.layout === 'minimal'
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-transparent text-white'
              }`}
              style={template.layout === 'modern' ? { backgroundColor: template.accentColor } : undefined}
            >
              <div className="flex items-center justify-between gap-8">
                <span className={`font-semibold ${template.layout === 'modern' ? 'text-white' : 'text-gray-800'}`}>Invoice</span>
                <span className="font-bold">#{order.order_number || order.id.slice(0, 8)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-8">
                <span className={`font-semibold ${template.layout === 'modern' ? 'text-white' : 'text-gray-800'}`}>Invoice Date</span>
                <span>{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              {template.showPaymentStatus && (
                <div className="mt-2 flex items-center justify-between gap-8">
                  <span className={`font-semibold ${template.layout === 'modern' ? 'text-white' : 'text-gray-800'}`}>Payment Status</span>
                  <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                    order.payment_status === 'paid'
                      ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                      : order.payment_status === 'unpaid'
                        ? 'border border-amber-100 bg-amber-50 text-amber-700'
                        : 'border border-gray-200 bg-gray-100 text-gray-700'
                  }`}>
                    {order.payment_status}
                    {order.payment_status === 'paid' ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-8">
                <span className={`font-semibold ${template.layout === 'modern' ? 'text-white' : 'text-gray-800'}`}>Fulfillment</span>
                <span className="capitalize">{order.status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-8">
                <span className={`font-semibold ${template.layout === 'modern' ? 'text-white' : 'text-gray-800'}`}>Channel</span>
                <span className="capitalize">{order.sales_channel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-8">
                <span className={`font-semibold ${template.layout === 'modern' ? 'text-white' : 'text-gray-800'}`}>Payment Mode</span>
                <span className="capitalize">{order.payment_method || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="invoice-summary-cards grid gap-5 border-b border-gray-200 px-6 py-6 sm:grid-cols-2 sm:px-8">
          <div className="rounded-2xl border border-gray-100 p-5" style={{ backgroundColor: template.surfaceColor }}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Bill To</h3>
            <p className="text-lg font-bold text-gray-900">{order.customer_label}</p>
            <p className="text-gray-600">{order.customer_email || 'No email'}</p>
            <p className="text-gray-600">{order.customer_phone || 'No phone'}</p>
            {template.showCustomerType && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{order.customer_type}</p>
            )}
            {billingAddress.length > 0 && (
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                {billingAddress.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Order Details</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex justify-between gap-4">
                <span>Order</span>
                <span className="font-semibold">#{order.order_number || order.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Items</span>
                <span className="font-semibold">{order.item_count}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Date</span>
                <span className="font-semibold">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              {shippingAddress.length > 0 && (
                <div className="pt-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Shipping Address</p>
                  {shippingAddress.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="invoice-table-wrap px-6 py-6 sm:px-8">
          <div className="overflow-hidden rounded-2xl border border-gray-100">
          <table className="w-full">
            <colgroup>
              <col style={{ width: '42%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead style={{ backgroundColor: template.surfaceColor }}>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Item</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-600">Price</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-600">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-4">
                    <p className="font-bold text-gray-900">{item.product_variants?.products?.title || 'Item'}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.product_variants?.sku || '—'}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{formatCurrency(item.unit_price, currency)}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">{formatCurrency(item.total_price, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="grid gap-5 px-6 pb-6 sm:grid-cols-[minmax(0,1fr)_320px] sm:px-8">
          <div className="invoice-terms rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-600">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{template.termsTitle}</p>
            <p className="mt-3 whitespace-pre-line leading-6">{template.termsBody}</p>

            {template.showNotes && order.notes && (
              <div className="invoice-notes mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                {order.notes}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-700">
              <span>Subtotal</span>
              <span className="font-semibold">{formatCurrency(totals.subtotal, currency)}</span>
              </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-rose-600">
                <span>Discount</span>
                <span>-{formatCurrency(totals.discount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-700">
              <span>Tax</span>
              <span>{formatCurrency(totals.tax, currency)}</span>
            </div>
            {totals.shipping > 0 && (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Shipping</span>
                <span>{formatCurrency(totals.shipping, currency)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-3">
              <span className="text-base font-bold text-gray-900">Grand Total</span>
              <span className="text-2xl font-black text-gray-900">{formatCurrency(totals.grand, currency)}</span>
            </div>
            <p className="text-right text-xs text-gray-500">Amounts in {currency}</p>
          </div>
        </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-5 text-center text-sm text-gray-500 sm:px-8">
          <p>{template.footerNote}</p>
          <p className="mt-1">For any enquiries, contact {settings?.store_email || 'our team'}.</p>
        </div>
      </div>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .invoice-page,
          .invoice-shell {
            background: #ffffff !important;
          }

          .invoice-shell {
            width: 100% !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .invoice-shell,
          .invoice-shell * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .invoice-hero,
          .invoice-summary-cards,
          .invoice-table-wrap,
          .invoice-terms,
          .invoice-notes {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .invoice-table-wrap table {
            table-layout: fixed;
          }

          .invoice-table-wrap th,
          .invoice-table-wrap td {
            padding: 7px 8px !important;
            font-size: 11px !important;
            vertical-align: top;
          }

          .invoice-hero {
            padding: 0 0 14px !important;
            margin: 0 0 14px !important;
          }

          .invoice-summary-cards,
          .invoice-table-wrap {
            padding-left: 0 !important;
            padding-right: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 14px !important;
          }

          .invoice-summary-cards {
            gap: 12px !important;
          }

          .invoice-table-wrap p,
          .invoice-shell p,
          .invoice-shell span,
          .invoice-shell div {
            overflow-wrap: anywhere;
          }
        }
      `}</style>
    </div>
  )
}
