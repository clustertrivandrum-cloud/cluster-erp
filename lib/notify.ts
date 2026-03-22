'use server'

import { createAdminClient } from '@/lib/supabase-admin'

type NotificationPayload = {
  type: 'low_stock' | 'payment_failure' | 'new_order'
  subject: string
  body: string
  meta?: Record<string, any>
}

const NOTIFY_ENABLED = process.env.NOTIFY_WEBHOOK_URL || process.env.NOTIFY_EMAIL;

async function deliver(payload: NotificationPayload) {
  // Simple placeholder delivery: logs to console; extend to email/webhook later.
  console.info('[notify]', payload.type, payload.subject, payload.meta || {})
  if (!NOTIFY_ENABLED) return

  if (process.env.NOTIFY_WEBHOOK_URL) {
    await fetch(process.env.NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((e) => console.error('notify webhook failed', e))
  }
  // Email delivery can be wired similarly if configured.
}

export async function notifyLowStock(variantId: string) {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('inventory_items')
      .select('available_quantity,reorder_point,variant_id,locations(id),product_variants(id, sku, products(title))')
      .eq('variant_id', variantId)
      .limit(1)
      .single()

    if (!data) return
    const qty = data.available_quantity ?? 0
    const reorder = data.reorder_point ?? 0
    if (qty > reorder) return

    await deliver({
      type: 'low_stock',
      subject: 'Low stock alert',
      body: `Variant ${data.product_variants?.sku || variantId} is at ${qty} (reorder ${reorder}).`,
      meta: { variantId, qty, reorder },
    })
  } catch (e) {
    console.error('notifyLowStock failed', e)
  }
}

export async function notifyPaymentFailure(orderId: string, reason?: string) {
  await deliver({
    type: 'payment_failure',
    subject: `Payment failed for order ${orderId}`,
    body: reason || 'Payment failed.',
    meta: { orderId },
  })
}

export async function notifyNewOrder(orderId: string, amount: number) {
  await deliver({
    type: 'new_order',
    subject: `New order ${orderId}`,
    body: `A new order has been placed. Total: ${amount}`,
    meta: { orderId, amount },
  })
}
