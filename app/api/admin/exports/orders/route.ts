import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-admin'
import { toCsv } from '@/lib/server/csv'
import { userHasPermission } from '@/lib/server/rbac'

const ORDER_COLUMN_PROBES = [
  'customer_id',
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
] as const

type CustomerSummary = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
}

type RawOrderRow = Record<string, unknown> & {
  id: string
  order_number?: string | number | null
  created_at: string
  order_items?: Array<{ count?: number | null }> | null
}

async function getCapabilities(admin: ReturnType<typeof createAdminClient>) {
  const probes = await Promise.all(
    ORDER_COLUMN_PROBES.map(async (column) => {
      const { error } = await admin.from('orders').select(column).limit(1)
      return [column, !error] as const
    })
  )

  const columns = new Set(probes.filter(([, exists]) => exists).map(([column]) => column))
  return {
    hasCustomerId: columns.has('customer_id'),
    hasStatus: columns.has('status'),
    hasFulfillmentStatus: columns.has('fulfillment_status'),
    hasPaymentStatus: columns.has('payment_status'),
    hasFinancialStatus: columns.has('financial_status'),
    hasTotalAmount: columns.has('total_amount'),
    hasGrandTotal: columns.has('grand_total'),
    hasSalesChannel: columns.has('sales_channel'),
    hasOrderType: columns.has('order_type'),
    hasGuestEmail: columns.has('guest_email'),
    hasGuestPhone: columns.has('guest_phone'),
    hasPaymentMethod: columns.has('payment_method'),
  }
}

function getStringField(order: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = order[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
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

  return 0
}

function inferChannel(order: Record<string, unknown>) {
  const raw = getStringField(order, 'sales_channel', 'order_type')
  if (raw === 'pos' || raw === 'online') {
    return raw
  }

  return getStringField(order, 'guest_email') ? 'online' : 'pos'
}

async function loadCustomerMap(admin: ReturnType<typeof createAdminClient>, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  const customerMap = new Map<string, CustomerSummary>()

  if (uniqueIds.length === 0) {
    return customerMap
  }

  const { data } = await admin
    .from('customers')
    .select('id, first_name, last_name, email, phone')
    .in('id', uniqueIds)

  for (const customer of data ?? []) {
    customerMap.set(customer.id, customer)
  }

  return customerMap
}

async function searchCustomerIds(admin: ReturnType<typeof createAdminClient>, searchTerm: string) {
  const { data } = await admin
    .from('customers')
    .select('id')
    .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
    .limit(50)

  return (data ?? []).map((row) => row.id).filter(Boolean)
}

function parseOptionalNumber(value: string | null) {
  if (!value || value.trim().length === 0) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !(await userHasPermission(user.id, 'manage_orders'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const searchTerm = (url.searchParams.get('query') || '').trim()
  const fulfillmentStatus = (url.searchParams.get('status') || '').trim()
  const paymentStatus = (url.searchParams.get('paymentStatus') || '').trim()
  const salesChannel = (url.searchParams.get('salesChannel') || 'all').trim()
  const customerType = (url.searchParams.get('customerType') || 'all').trim()
  const paymentMethod = (url.searchParams.get('paymentMethod') || '').trim()
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const minAmount = parseOptionalNumber(url.searchParams.get('minAmount'))
  const maxAmount = parseOptionalNumber(url.searchParams.get('maxAmount'))
  const limit = Math.min(Number(url.searchParams.get('limit') || 5000), 10000)

  const admin = createAdminClient()
  const capabilities = await getCapabilities(admin)
  const amountColumn = capabilities.hasTotalAmount ? 'total_amount' : capabilities.hasGrandTotal ? 'grand_total' : null
  const fulfillmentColumn = capabilities.hasStatus ? 'status' : capabilities.hasFulfillmentStatus ? 'fulfillment_status' : null
  const paymentColumn = capabilities.hasPaymentStatus ? 'payment_status' : capabilities.hasFinancialStatus ? 'financial_status' : null
  const channelColumn = capabilities.hasSalesChannel ? 'sales_channel' : capabilities.hasOrderType ? 'order_type' : null

  let query = admin
    .from('orders')
    .select('*, order_items(count)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`)
  if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`)
  if (fulfillmentStatus && fulfillmentColumn) query = query.eq(fulfillmentColumn, fulfillmentStatus)
  if (paymentStatus && paymentColumn) query = query.eq(paymentColumn, paymentStatus)
  if (salesChannel && channelColumn) query = query.eq(channelColumn, salesChannel)
  if (paymentMethod && capabilities.hasPaymentMethod) query = query.ilike('payment_method', `%${paymentMethod}%`)
  if (typeof minAmount === 'number' && amountColumn) query = query.gte(amountColumn, minAmount)
  if (typeof maxAmount === 'number' && amountColumn) query = query.lte(amountColumn, maxAmount)

  if (customerType !== 'all' && capabilities.hasCustomerId) {
    if (customerType === 'registered') {
      query = query.not('customer_id', 'is', null)
    } else if (customerType === 'guest') {
      query = query.is('customer_id', null)
      if (capabilities.hasGuestEmail) query = query.not('guest_email', 'is', null)
      else if (capabilities.hasGuestPhone) query = query.not('guest_phone', 'is', null)
    } else if (customerType === 'walk-in') {
      query = query.is('customer_id', null)
      if (capabilities.hasGuestEmail) query = query.is('guest_email', null)
      if (capabilities.hasGuestPhone) query = query.is('guest_phone', null)
    }
  }

  if (searchTerm) {
    if (!isNaN(Number(searchTerm))) {
      query = query.eq('order_number', Number(searchTerm))
    } else {
      const customerIds = capabilities.hasCustomerId ? await searchCustomerIds(admin, searchTerm) : []
      const orClauses: string[] = []
      if (capabilities.hasGuestEmail) orClauses.push(`guest_email.ilike.%${searchTerm}%`)
      if (capabilities.hasGuestPhone) orClauses.push(`guest_phone.ilike.%${searchTerm}%`)
      if (capabilities.hasCustomerId && customerIds.length > 0) orClauses.push(`customer_id.in.(${customerIds.join(',')})`)

      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','))
      }
    }
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as RawOrderRow[]
  const customerIds = capabilities.hasCustomerId
    ? rows.map((row) => getStringField(row, 'customer_id')).filter((value): value is string => Boolean(value))
    : []
  const customerMap = await loadCustomerMap(admin, customerIds)

  const normalized = rows.map((row) => {
    const customerId = getStringField(row, 'customer_id')
    const customer = customerId ? customerMap.get(customerId) ?? null : null
    const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim()
    const guestEmail = getStringField(row, 'guest_email')
    const guestPhone = getStringField(row, 'guest_phone')

    return {
      order_number: row.order_number ?? row.id.slice(0, 8),
      created_at: row.created_at,
      channel: inferChannel(row),
      fulfillment_status: getStringField(row, 'status', 'fulfillment_status') ?? 'pending',
      payment_status: getStringField(row, 'payment_status', 'financial_status') ?? 'unpaid',
      total_amount: getNumberField(row, 'total_amount', 'grand_total'),
      customer_label: customerName || customer?.email || guestEmail || guestPhone || 'Walk-in POS',
      customer_email: customer?.email ?? guestEmail ?? null,
      customer_phone: customer?.phone ?? guestPhone ?? null,
      payment_method: getStringField(row, 'payment_method') ?? 'Unknown',
      item_count: Array.isArray(row.order_items) ? Number(row.order_items[0]?.count ?? 0) : 0,
    }
  })

  const csv = toCsv(normalized)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="orders.csv"',
    },
  })
}
