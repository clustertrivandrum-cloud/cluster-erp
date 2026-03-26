'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowUpDown, CalendarRange, ChevronDown, ChevronUp, Download, Filter, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { batchUpdateOrders, getOrders, type OrderRecord } from '@/lib/actions/order-actions'
import PaginationBar from '@/components/ui/PaginationBar'
import { getAllowedFulfillmentStatuses, getFulfillmentDisplayLabel } from '@/lib/orders/workflow'

const PAGE_SIZE = 12

type OrdersFilterState = {
  query: string
  fulfillmentStatus: string
  paymentStatus: string
  salesChannel: 'all' | 'pos' | 'online'
  customerType: 'all' | 'registered' | 'guest' | 'walk-in'
  paymentMethod: string
  dateFrom: string
  dateTo: string
  minAmount: string
  maxAmount: string
  sortBy: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
}

const DEFAULT_FILTERS: OrdersFilterState = {
  query: '',
  fulfillmentStatus: '',
  paymentStatus: '',
  salesChannel: 'all',
  customerType: 'all',
  paymentMethod: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'newest',
}

const PAYMENT_OPTIONS = ['paid', 'unpaid', 'pending', 'failed', 'refunded']
const BATCH_FULFILLMENT_OPTIONS = ['processing', 'shipped', 'delivered', 'completed', 'cancelled', 'returned']
const BATCH_PAYMENT_OPTIONS = ['paid', 'unpaid', 'failed', 'refunded']

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return {
    date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
    case 'delivered':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    case 'processing':
    case 'shipped':
      return 'bg-sky-50 text-sky-700 border-sky-100'
    case 'pending':
    case 'unpaid':
      return 'bg-amber-50 text-amber-700 border-amber-100'
    case 'failed':
    case 'cancelled':
    case 'returned':
    case 'refunded':
      return 'bg-rose-50 text-rose-700 border-rose-100'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function buildExportUrl(filters: OrdersFilterState) {
  const params = new URLSearchParams()
  if (filters.fulfillmentStatus) params.set('status', filters.fulfillmentStatus)
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
  if (filters.salesChannel !== 'all') params.set('salesChannel', filters.salesChannel)
  if (filters.customerType !== 'all') params.set('customerType', filters.customerType)
  if (filters.query) params.set('query', filters.query)
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod)
  if (filters.dateFrom) params.set('from', filters.dateFrom)
  if (filters.dateTo) params.set('to', filters.dateTo)
  if (filters.minAmount) params.set('minAmount', filters.minAmount)
  if (filters.maxAmount) params.set('maxAmount', filters.maxAmount)
  return `/api/admin/exports/orders?${params.toString()}`
}

function countActiveFilters(filters: OrdersFilterState) {
  return [
    filters.query,
    filters.fulfillmentStatus,
    filters.paymentStatus,
    filters.salesChannel !== 'all' ? filters.salesChannel : '',
    filters.customerType !== 'all' ? filters.customerType : '',
    filters.paymentMethod,
    filters.dateFrom,
    filters.dateTo,
    filters.minAmount,
    filters.maxAmount,
    filters.sortBy !== 'newest' ? filters.sortBy : '',
  ].filter(Boolean).length
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [filters, setFilters] = useState<OrdersFilterState>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchFulfillmentStatus, setBatchFulfillmentStatus] = useState('')
  const [batchPaymentStatus, setBatchPaymentStatus] = useState('')
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [isBatchWorking, startBatchTransition] = useTransition()
  const [, startTransition] = useTransition()

  const loadOrders = useCallback(async (nextPage: number, nextFilters: OrdersFilterState) => {
    setLoading(true)
    setError(null)

    const result = await getOrders({
      page: nextPage,
      limit: PAGE_SIZE,
      query: nextFilters.query,
      fulfillmentStatus: nextFilters.fulfillmentStatus || undefined,
      paymentStatus: nextFilters.paymentStatus || undefined,
      salesChannel: nextFilters.salesChannel,
      customerType: nextFilters.customerType,
      paymentMethod: nextFilters.paymentMethod || undefined,
      dateFrom: nextFilters.dateFrom || undefined,
      dateTo: nextFilters.dateTo || undefined,
      minAmount: nextFilters.minAmount ? Number(nextFilters.minAmount) : undefined,
      maxAmount: nextFilters.maxAmount ? Number(nextFilters.maxAmount) : undefined,
      sortBy: nextFilters.sortBy,
    })

    setOrders(result.data || [])
    setCount(result.count || 0)
    setError(result.error || null)
    setPage(nextPage)
    setSelectedIds([])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadOrders(1, filters)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [filters, loadOrders])

  const matchedSummary = useMemo(() => {
    return {
      totalAmount: orders.reduce((sum, order) => sum + order.total_amount, 0),
      paid: orders.filter((order) => order.payment_status === 'paid').length,
      online: orders.filter((order) => order.sales_channel === 'online').length,
      attention: orders.filter((order) => ['pending', 'failed', 'unpaid', 'returned'].includes(order.status) || ['failed', 'unpaid', 'refunded'].includes(order.payment_status)).length,
      schemaIssues: orders.filter((order) => order.data_issues.length > 0).length,
    }
  }, [orders])

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters])
  const hasAdvancedFiltersApplied = useMemo(() => (
    filters.customerType !== 'all'
    || Boolean(filters.paymentMethod || filters.dateFrom || filters.dateTo || filters.minAmount || filters.maxAmount)
  ), [filters])

  const fulfillmentOptions = useMemo(() => {
    if (filters.salesChannel === 'pos') {
      return getAllowedFulfillmentStatuses('pos')
    }

    if (filters.salesChannel === 'online') {
      return getAllowedFulfillmentStatuses('online')
    }

    return Array.from(new Set([
      ...getAllowedFulfillmentStatuses('online'),
      ...getAllowedFulfillmentStatuses('pos'),
    ]))
  }, [filters.salesChannel])

  const allPageSelected = orders.length > 0 && selectedIds.length === orders.length

  const handleBatchApply = (mode: 'fulfillment' | 'payment') => {
    const fulfillmentStatus = mode === 'fulfillment' ? batchFulfillmentStatus : undefined
    const paymentStatus = mode === 'payment' ? batchPaymentStatus : undefined

    startBatchTransition(async () => {
      const result = await batchUpdateOrders({
        ids: selectedIds,
        fulfillmentStatus,
        paymentStatus,
      })

      if (result.error) {
        setBatchMessage(result.error)
      } else {
        setBatchMessage(`${result.updated || 0} orders updated.`)
        if (mode === 'fulfillment') setBatchFulfillmentStatus('')
        if (mode === 'payment') setBatchPaymentStatus('')
        await loadOrders(page, filters)
      }
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      <div className="flex flex-col gap-4 rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-400">Commerce Control</p>
          <div>
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Orders Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              One production queue for POS and online orders. Search, filter, and update live records without fighting the layout.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-auto">
          <a
            href={buildExportUrl(filters)}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
          <button
            type="button"
            onClick={() => startTransition(() => loadOrders(page, filters))}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/admin/orders/new"
            className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: 'Matched Orders', value: count, helper: 'Across current filters' },
          { label: 'Page Revenue', value: formatCurrency(matchedSummary.totalAmount), helper: 'Visible rows only' },
          { label: 'Paid Orders', value: matchedSummary.paid, helper: 'Current page snapshot' },
          { label: 'Need Attention', value: matchedSummary.attention, helper: 'Pending, unpaid, failed, returned' },
          { label: 'Data Issues', value: matchedSummary.schemaIssues, helper: 'Visible rows needing review' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 sm:text-xs">{card.label}</p>
            <p className="mt-3 text-2xl font-black text-gray-900 sm:text-3xl">{card.value}</p>
            <p className="mt-1 text-sm text-gray-500">{card.helper}</p>
          </div>
        ))}
      </div>

      {matchedSummary.schemaIssues > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm sm:px-5 sm:py-4">
          {matchedSummary.schemaIssues} orders on this page still have incomplete contact or field consistency checks. Review the flagged rows before final fulfillment or payment follow-up.
        </div>
      )}

      <div className="rounded-[28px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <Filter className="mt-0.5 h-4 w-4 text-gray-400" />
            <div>
              <span className="text-sm font-semibold text-gray-900">Order filters</span>
              <p className="mt-1 text-sm text-gray-500">Keep the common filters visible and tuck the rest away on smaller screens.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterCount > 0 && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
                {activeFilterCount} active
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:hidden"
            >
              {showAdvancedFilters || hasAdvancedFiltersApplied ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              Advanced filters
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters(DEFAULT_FILTERS)
                setShowAdvancedFilters(false)
              }}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))]">
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Order number, contact, tracking, notes"
                className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Fulfillment</span>
            <select
              value={filters.fulfillmentStatus}
              onChange={(event) => setFilters((current) => ({ ...current, fulfillmentStatus: event.target.value }))}
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            >
              <option value="">All fulfillment states</option>
              {fulfillmentOptions.map((option) => (
                <option key={option} value={option}>{getFulfillmentDisplayLabel(option)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Payment</span>
            <select
              value={filters.paymentStatus}
              onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            >
              <option value="">All payment states</option>
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Channel</span>
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border-[1.5px] border-gray-300 bg-gray-50 p-1 text-sm shadow-sm">
              {(['all', 'pos', 'online'] as const).map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setFilters((current) => ({
                    ...current,
                    salesChannel: channel,
                    fulfillmentStatus: current.fulfillmentStatus && !(
                      channel === 'all'
                        ? Array.from(new Set([...getAllowedFulfillmentStatuses('online'), ...getAllowedFulfillmentStatuses('pos')]))
                        : getAllowedFulfillmentStatuses(channel)
                    ).includes(current.fulfillmentStatus as never)
                      ? ''
                      : current.fulfillmentStatus,
                  }))}
                  className={`rounded-lg px-3 py-2 font-medium transition ${
                    filters.salesChannel === channel ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  {channel === 'all' ? 'All' : channel.toUpperCase()}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className={`${showAdvancedFilters || hasAdvancedFiltersApplied ? 'mt-4 grid' : 'hidden'} gap-4 lg:mt-4 lg:grid lg:grid-cols-6`}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Customer Type</span>
            <select
              value={filters.customerType}
              onChange={(event) => setFilters((current) => ({ ...current, customerType: event.target.value as OrdersFilterState['customerType'] }))}
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            >
              <option value="all">All customers</option>
              <option value="registered">Registered</option>
              <option value="guest">Guest checkout</option>
              <option value="walk-in">Walk-in POS</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Payment Method</span>
            <input
              type="text"
              value={filters.paymentMethod}
              onChange={(event) => setFilters((current) => ({ ...current, paymentMethod: event.target.value }))}
              placeholder="Cash, Card, UPI..."
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">To</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Min Amount</span>
            <input
              type="number"
              min="0"
              value={filters.minAmount}
              onChange={(event) => setFilters((current) => ({ ...current, minAmount: event.target.value }))}
              placeholder="0"
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Max Amount</span>
            <input
              type="number"
              min="0"
              value={filters.maxAmount}
              onChange={(event) => setFilters((current) => ({ ...current, maxAmount: event.target.value }))}
              placeholder="50000"
              className="w-full rounded-xl border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/15"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            Live orders are shown with channel, payment, and fulfillment values normalized into one admin view.
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <select
              value={filters.sortBy}
              onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value as OrdersFilterState['sortBy'] }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none sm:w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount_desc">Amount high to low</option>
              <option value="amount_asc">Amount low to high</option>
            </select>
          </label>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-2xl border border-gray-900 bg-gray-900 p-4 text-white shadow-lg">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Bulk actions</p>
              <p className="mt-1 text-lg font-bold">{selectedIds.length} orders selected</p>
              {batchMessage && <p className="mt-1 text-sm text-gray-300">{batchMessage}</p>}
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,220px)_120px_minmax(0,220px)_120px_auto]">
              <select
                value={batchFulfillmentStatus}
                onChange={(event) => setBatchFulfillmentStatus(event.target.value)}
                className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Update fulfillment</option>
                {BATCH_FULFILLMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{getFulfillmentDisplayLabel(option as Parameters<typeof getFulfillmentDisplayLabel>[0])}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleBatchApply('fulfillment')}
                disabled={!batchFulfillmentStatus || isBatchWorking}
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>

              <select
                value={batchPaymentStatus}
                onChange={(event) => setBatchPaymentStatus(event.target.value)}
                className="rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Update payment</option>
                {BATCH_PAYMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleBatchApply('payment')}
                disabled={!batchPaymentStatus || isBatchWorking}
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-gray-700 px-4 py-3 text-sm font-medium text-white"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Orders Ledger</h2>
              <p className="text-sm text-gray-500">One queue for online, guest, and walk-in POS orders.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarRange className="h-4 w-4" />
              Page {page} of {Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {loading ? (
            <div className="px-4 py-16 text-center text-sm text-gray-500">Loading orders...</div>
          ) : error ? (
            <div className="px-4 py-16 text-center text-sm text-red-600">{error}</div>
          ) : orders.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-gray-500">No orders match these filters.</div>
          ) : (
            orders.map((order) => {
              const created = formatDateTime(order.created_at)
              const isSelected = selectedIds.includes(order.id)

              return (
                <div key={order.id} className={`space-y-4 px-4 py-4 ${isSelected ? 'bg-gray-50' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/orders/${order.id}`} className="text-sm font-bold text-gray-900 hover:text-black">
                          #{order.order_number || order.id.slice(0, 8)}
                        </Link>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadge(order.payment_status)}`}>
                          {order.payment_status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{order.customer_label}</p>
                      <p className="text-sm text-gray-500">{order.customer_email || order.customer_phone || 'No direct contact'}</p>
                      <p className="mt-1 text-xs text-gray-400">{created.date} at {created.time}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        setSelectedIds((current) => {
                          if (event.target.checked) {
                            return [...current, order.id]
                          }

                          return current.filter((value) => value !== order.id)
                        })
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Channel</p>
                      <p className="mt-1 font-semibold text-gray-900">{order.sales_channel.toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{order.payment_method || 'Method unknown'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Amount</p>
                      <p className="mt-1 font-semibold text-gray-900">{formatCurrency(order.total_amount)}</p>
                      <p className="text-xs text-gray-500">{order.item_count} item{order.item_count === 1 ? '' : 's'}</p>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {order.data_issues.length === 0 ? (
                        <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Healthy
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                            {order.data_issues.length} issue{order.data_issues.length > 1 ? 's' : ''}
                          </span>
                          <p className="text-xs text-gray-500">{order.data_issues[0]}</p>
                        </div>
                      )}
                    </div>
                    <Link href={`/admin/orders/${order.id}`} className="text-sm font-semibold text-gray-500 hover:text-gray-900">
                      Open
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(event) => setSelectedIds(event.target.checked ? orders.map((order) => order.id) : [])}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Order</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Customer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Channel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Payment</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Fulfillment</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Data Health</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Items</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Amount</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-gray-500">Loading orders...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-red-600">{error}</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-gray-500">No orders match these filters.</td>
                </tr>
              ) : (
                orders.map((order) => {
                  const created = formatDateTime(order.created_at)
                  const isSelected = selectedIds.includes(order.id)

                  return (
                    <tr key={order.id} className={`transition ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50/80'}`}>
                      <td className="px-5 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => {
                            setSelectedIds((current) => {
                              if (event.target.checked) {
                                return [...current, order.id]
                              }

                              return current.filter((value) => value !== order.id)
                            })
                          }}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/admin/orders/${order.id}`} className="text-sm font-bold text-gray-900 hover:text-black">
                              #{order.order_number || order.id.slice(0, 8)}
                            </Link>
                            {order.payment_request_token && (
                              <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                                Payment Link
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{created.date}</div>
                          <div className="text-xs text-gray-400">{created.time}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-900">{order.customer_label}</p>
                          <div className="text-xs text-gray-500">
                            {order.customer_email || order.customer_phone || 'No direct contact'}
                          </div>
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            {order.customer_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                            order.sales_channel === 'pos' ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                          }`}>
                            {order.sales_channel}
                          </span>
                          <div className="text-xs text-gray-500">{order.payment_method || 'Method unknown'}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadge(order.payment_status)}`}>
                            {order.payment_status}
                          </span>
                          <div className="text-xs text-gray-500">{order.currency || 'INR'}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {order.data_issues.length === 0 ? (
                          <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Healthy
                          </span>
                        ) : (
                          <div className="space-y-2">
                            <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                              {order.data_issues.length} issue{order.data_issues.length > 1 ? 's' : ''}
                            </span>
                            <div className="space-y-1">
                              {order.data_issues.slice(0, 2).map((issue) => (
                                <p key={issue} className="max-w-[220px] text-xs text-gray-500">
                                  {issue}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right align-top text-sm font-semibold text-gray-900">
                        {order.item_count}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <div className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</div>
                        {order.notes && <div className="mt-1 line-clamp-2 text-xs text-gray-400">{order.notes}</div>}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <Link href={`/admin/orders/${order.id}`} className="text-sm font-semibold text-gray-500 hover:text-gray-900">
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalItems={count}
          pageSize={PAGE_SIZE}
          onPageChange={(nextPage) => startTransition(() => loadOrders(nextPage, filters))}
        />
      </div>
    </div>
  )
}
