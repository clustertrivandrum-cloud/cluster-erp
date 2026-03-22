import { NextResponse } from 'next/server'
import { getCurrentAccess } from '@/lib/auth'
import { getOrder } from '@/lib/actions/order-actions'
import { getSettings } from '@/lib/actions/settings-actions'
import { renderInvoicePdf } from '@/lib/server/invoice-pdf'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await getCurrentAccess()

  if (!access.user || !access.profile?.is_active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasInvoiceAccess = access.permissions.includes('manage_orders') || access.permissions.includes('access_pos')
  if (!hasInvoiceAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const [order, settings] = await Promise.all([getOrder(id), getSettings()])

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const pdf = await renderInvoicePdf({
    order: order as Parameters<typeof renderInvoicePdf>[0]['order'],
    settings,
  })

  const fileName = `${settings?.store_name || 'Cluster Fascination'}-invoice-${order.order_number || order.id.slice(0, 8)}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store',
    },
  })
}
