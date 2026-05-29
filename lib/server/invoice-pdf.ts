import PDFDocument from 'pdfkit'
import { normalizeInvoiceTemplate } from '@/lib/invoice-template'
import type { OrderRecord } from '@/lib/actions/order-actions'

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

function fmt(amount: number | string | null | undefined) {
  const value = typeof amount === 'number' ? amount : Number(amount ?? 0)
  const safe  = Number.isFinite(value) ? value : 0
  // No space between Rs. and number prevents line-wrap in narrow PDF columns
  return `Rs.${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)}`
}

function formatAddress(address?: Record<string, unknown> | null): string[] {
  if (!address) return []
  const keys = ['line1', 'line2', 'city', 'state', 'postal_code', 'country']
  const vals = keys.map(k => address[k]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return vals.length > 0 ? vals : Object.values(address).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

export async function renderInvoicePdf({
  order,
  settings,
}: {
  order: InvoiceOrder
  settings: AppSettings | null
}) {
  const template = normalizeInvoiceTemplate(settings?.invoice_template)
  const currency  = order.currency || settings?.store_currency || 'INR'
  void currency // used via fmt()

  const billingAddress  = formatAddress(order.billing_address)
  const shippingAddress = formatAddress(order.shipping_address)

  const totals = {
    subtotal: order.subtotal_amount  || order.order_items.reduce((s, i) => s + Number(i.total_price ?? 0), 0),
    discount: order.discount_amount  || 0,
    tax:      order.tax_amount       || 0,
    shipping: order.shipping_amount  || 0,
    grand:    order.total_amount     || 0,
  }

  // ── PDFKit doc ───────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title:   `Invoice #${order.order_number || order.id}`,
      Author:  settings?.store_name || 'Cluster Fascination',
      Subject: `Invoice ${order.order_number || order.id}`,
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (c) => chunks.push(Buffer.from(c)))

  const PW = doc.page.width   // 595.28
  const PH = doc.page.height  // 841.89
  const PAD = 40              // outer page padding

  // ── Colours ──────────────────────────────────────────────────────────────
  const C_BG       = '#f4f4f5'   // page background
  const C_WHITE    = '#ffffff'
  const C_BORDER   = '#e4e4e7'
  const C_TEXT     = '#18181b'
  const C_MUTED    = '#71717a'
  const C_ACCENT   = template.accentColor || '#2f5a37'
  const C_SURFACE  = template.surfaceColor || '#f1f5f3'

  // ── Helpers ──────────────────────────────────────────────────────────────
  /** Draw a rounded white card with a light border */
  const card = (x: number, y: number, w: number, h: number, fill = C_WHITE) => {
    doc.roundedRect(x, y, w, h, 8).fill(fill)
    doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(x, y, w, h, 8).stroke()
  }

  /** Single-line label+value row */
  const metaCol = (label: string, value: string, x: number, y: number, w: number) => {
    doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
    doc.text(label, x, y, { width: w, lineBreak: false })
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C_TEXT)
    doc.text(value, x, y + 13, { width: w, lineBreak: false })
  }

  /** Draw a small labelled field (like the From/To address rows) */
  const fieldRow = (label: string, value: string, x: number, y: number, w: number): number => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C_MUTED)
    doc.text(label.toUpperCase(), x, y, { width: w, characterSpacing: 0.5, lineBreak: false })
    doc.font('Helvetica').fontSize(9.5).fillColor(C_TEXT)
    doc.text(value, x, y + 11, { width: w, lineGap: 1 })
    return doc.y + 6
  }

  // ── Load logo ─────────────────────────────────────────────────────────────
  let logoPath: string | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs   = require('fs')   as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const p = path.join(process.cwd(), 'public', 'logo.png')
    if (fs.existsSync(p)) logoPath = p
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAW PAGE
  // ═══════════════════════════════════════════════════════════════════════════

  // Full-page light background
  doc.rect(0, 0, PW, PH).fill(C_BG)

  // ── Main white card (covers whole content area) ───────────────────────────
  const CARD_X = PAD
  const CARD_Y = PAD
  const CARD_W = PW - PAD * 2
  const CARD_H = PH - PAD * 2

  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).fill(C_WHITE)
  doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).stroke()

  const CX  = CARD_X + 28   // content left
  const CR  = CARD_X + CARD_W - 28  // content right
  const CW  = CR - CX       // content width ≈ 455

  let Y = CARD_Y + 26  // current Y cursor (manual, no doc.y)

  // ── TOP HEADER ROW ────────────────────────────────────────────────────────
  // [Logo + Store name]    [Invoice No.]  [Issued]  [Status]
  const LOGO_SZ = 32
  if (logoPath) {
    try { doc.image(logoPath, CX, Y, { width: LOGO_SZ, height: LOGO_SZ }) } catch { /* ignore */ }
  }
  const nameX = logoPath ? CX + LOGO_SZ + 10 : CX
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C_TEXT)
  doc.text(settings?.store_name || 'Cluster Fascination', nameX, Y + 9, { lineBreak: false })

  // Right-side meta columns
  const META_COL_W = 90
  const metaY = Y + 2
  metaCol('Invoice Number', String(order.order_number || `#${order.id.slice(0, 6)}`), CR - META_COL_W * 3, metaY, META_COL_W)
  metaCol('Issued', new Date(order.created_at).toLocaleDateString('en-IN'), CR - META_COL_W * 2, metaY, META_COL_W)
  metaCol('Status', order.payment_status.toUpperCase(), CR - META_COL_W, metaY, META_COL_W)

  Y += LOGO_SZ + 20

  // Divider
  doc.moveTo(CARD_X, Y).lineTo(CARD_X + CARD_W, Y).strokeColor(C_BORDER).lineWidth(0.5).stroke()
  Y += 20

  // ── FROM / TO SECTION ─────────────────────────────────────────────────────
  const HALF_W = (CW - 14) / 2
  const LEFT_X = CX
  const RIGHT_X = CX + HALF_W + 14

  // Measure card height
  const billLines   = [order.customer_label, order.customer_email || '', order.customer_phone || '', ...billingAddress]
  const orderLines  = [
    `Items: ${order.item_count}`,
    `Channel: ${order.sales_channel}`,
    `Payment: ${order.payment_method || 'N/A'}`,
    ...shippingAddress.slice(0, 3),
  ]
  const estimateH = (lines: string[]) => Math.max(110, 30 + lines.filter(Boolean).length * 18 + 14)
  const fromToH = Math.max(estimateH(billLines), estimateH(orderLines))

  // From card
  card(LEFT_X, Y, HALF_W, fromToH, C_SURFACE)
  doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
  doc.text('↑  From', LEFT_X + 14, Y + 12, { lineBreak: false })
  doc.moveTo(LEFT_X, Y + 28).lineTo(LEFT_X + HALF_W, Y + 28).strokeColor(C_BORDER).lineWidth(0.4).stroke()

  let fy = Y + 38
  if (logoPath) {
    try { doc.image(logoPath, LEFT_X + 14, fy, { width: 28, height: 28 }) } catch { /* ignore */ }
  }
  const fromTextX = logoPath ? LEFT_X + 50 : LEFT_X + 14
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C_TEXT)
  doc.text(settings?.store_name || 'Cluster Fascination', fromTextX, fy + 6, { lineBreak: false })
  if (settings?.store_email) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
    doc.text(settings.store_email, fromTextX, fy + 21, { lineBreak: false })
  }

  fy += 40
  if (settings?.store_address) fy = fieldRow('Address', settings.store_address, LEFT_X + 14, fy, HALF_W - 28)
  const contactBits: string[] = []
  if (settings?.store_phone) contactBits.push(settings.store_phone)
  if (settings?.gstin) contactBits.push(`GSTIN: ${settings.gstin}`)
  if (contactBits.length > 0) fieldRow('Contact', contactBits.join('  ·  '), LEFT_X + 14, fy, HALF_W - 28)

  // To card
  card(RIGHT_X, Y, HALF_W, fromToH, C_WHITE)
  doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
  doc.text('↓  To', RIGHT_X + 14, Y + 12, { lineBreak: false })
  doc.moveTo(RIGHT_X, Y + 28).lineTo(RIGHT_X + HALF_W, Y + 28).strokeColor(C_BORDER).lineWidth(0.4).stroke()

  let ty2 = Y + 38
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C_TEXT)
  doc.text(order.customer_label || 'Guest', RIGHT_X + 14, ty2 + 6, { lineBreak: false })
  if (order.customer_email) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
    doc.text(order.customer_email, RIGHT_X + 14, ty2 + 21, { lineBreak: false })
  }
  ty2 += 40

  if (billingAddress.length > 0) ty2 = fieldRow('Address', billingAddress.join(', '), RIGHT_X + 14, ty2, HALF_W - 28)
  if (order.customer_phone) ty2 = fieldRow('Phone', order.customer_phone, RIGHT_X + 14, ty2, HALF_W - 28)

  Y += fromToH + 22

  // ── ITEMS TABLE ────────────────────────────────────────────────────────────
  // ─── Column positions allocated from right to prevent overflow ────────
  const COL_GAP     = 8
  const COL_AMT_W   = 88   // wide enough for "Rs.12,999.00"
  const COL_PRICE_W = 88
  const COL_QTY_W   = 34
  const COL_AMT_X   = CR  - COL_AMT_W
  const COL_PRICE_X = COL_AMT_X   - COL_GAP - COL_PRICE_W
  const COL_QTY_X   = COL_PRICE_X - COL_GAP - COL_QTY_W
  const COL_ITEM_X  = CX
  const COL_ITEM_W  = COL_QTY_X - COL_GAP - COL_ITEM_X

  // Table header
  doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
  doc.text('Description', COL_ITEM_X,  Y, { width: COL_ITEM_W, lineBreak: false })
  doc.text('QTY',         COL_QTY_X,   Y, { width: COL_QTY_W,   align: 'center', lineBreak: false })
  doc.text('Price',       COL_PRICE_X, Y, { width: COL_PRICE_W, align: 'right',  lineBreak: false })
  doc.text('Amount',      COL_AMT_X,   Y, { width: COL_AMT_W,   align: 'right',  lineBreak: false })

  Y += 16
  doc.moveTo(CARD_X, Y).lineTo(CARD_X + CARD_W, Y).strokeColor(C_BORDER).lineWidth(0.4).stroke()
  Y += 10

  // Dot colours for items
  const DOT_COLORS = [C_ACCENT, '#f59e0b', '#6366f1', '#ec4899', '#14b8a6']

  order.order_items.forEach((item, idx) => {
    const title  = item.product_variants?.products?.title || 'Item'
    const sku    = item.product_variants?.sku
    const price  = fmt(item.unit_price)
    const amount = fmt(item.total_price)
    const qty    = String(item.quantity)

    // Estimate row height based on description column width
    const charsPerLine = Math.floor(COL_ITEM_W / 6.5)
    const lines = Math.max(1, Math.ceil(title.length / charsPerLine))
    const rowH = Math.max(34, lines * 13 + 16)

    // Page overflow guard
    if (Y + rowH > PH - PAD - 160) {
      doc.addPage()
      doc.rect(0, 0, PW, PH).fill(C_BG)
      doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).fill(C_WHITE)
      doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).stroke()
      Y = CARD_Y + 26
    }

    // Coloured dot
    doc.circle(COL_ITEM_X + 5, Y + 10, 4).fill(DOT_COLORS[idx % DOT_COLORS.length])

    // Item title (may wrap within desc column only)
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_TEXT)
    doc.text(title, COL_ITEM_X + 16, Y + 4, { width: COL_ITEM_W - 16, lineGap: 1 })

    // SKU sub-label
    if (sku) {
      doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
      doc.text(sku, COL_ITEM_X + 16, Y + 4 + lines * 13, { lineBreak: false })
    }

    // QTY / Price / Amount — all pinned to rowY (no wrapping)
    doc.font('Helvetica').fontSize(9.5).fillColor(C_TEXT)
    doc.text(qty,    COL_QTY_X,   Y + 4, { width: COL_QTY_W,   align: 'center', lineBreak: false })
    doc.text(price,  COL_PRICE_X, Y + 4, { width: COL_PRICE_W, align: 'right',  lineBreak: false })
    doc.font('Helvetica-Bold')
    doc.text(amount, COL_AMT_X,   Y + 4, { width: COL_AMT_W,   align: 'right',  lineBreak: false })

    Y += rowH
    doc.moveTo(CARD_X, Y).lineTo(CARD_X + CARD_W, Y).strokeColor(C_BORDER).lineWidth(0.3).stroke()
    Y += 2
  })

  Y += 18

  // ── TOTALS ─────────────────────────────────────────────────────────────────
  const TOT_LABEL_X = CR - 260
  const TOT_VAL_X   = COL_AMT_X
  const TOT_VAL_W   = COL_AMT_W

  const totRow = (label: string, value: string, bold = false, color = C_MUTED) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(color)
    doc.text(label, TOT_LABEL_X, Y, { lineBreak: false })
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(bold ? C_TEXT : color)
    doc.text(value, TOT_VAL_X, Y, { width: TOT_VAL_W, align: 'right', lineBreak: false })
    Y += bold ? 22 : 18
  }

  totRow('Subtotal', fmt(totals.subtotal))
  if (totals.discount > 0) totRow('Discount', `-${fmt(totals.discount)}`, false, '#dc2626')
  if (totals.tax > 0)      totRow('Tax',      fmt(totals.tax))
  if (totals.shipping > 0) totRow('Shipping', fmt(totals.shipping))

  // Divider before grand total
  doc.moveTo(TOT_LABEL_X, Y).lineTo(CR, Y).strokeColor(C_BORDER).lineWidth(0.5).stroke()
  Y += 10
  totRow('Total', fmt(totals.grand), true)

  Y += 14

  // ── TERMS & NOTES ─────────────────────────────────────────────────────────
  if (template.termsBody || (template.showNotes && order.notes)) {
    doc.moveTo(CARD_X, Y).lineTo(CARD_X + CARD_W, Y).strokeColor(C_BORDER).lineWidth(0.4).stroke()
    Y += 16

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_MUTED)
    doc.text((template.termsTitle || 'Terms & Notes').toUpperCase(), CX, Y, { characterSpacing: 0.5, lineBreak: false })
    Y += 14

    doc.font('Helvetica').fontSize(9).fillColor(C_MUTED)
    doc.text(template.termsBody, CX, Y, { width: CW, lineGap: 2 })
    Y = doc.y + 8

    if (template.showNotes && order.notes) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_MUTED)
      doc.text('ORDER NOTES', CX, Y, { characterSpacing: 0.5, lineBreak: false })
      Y += 14
      doc.font('Helvetica').fontSize(9).fillColor(C_MUTED)
      doc.text(order.notes, CX, Y, { width: CW, lineGap: 2 })
      Y = doc.y + 8
    }
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  const FOOTER_Y = CARD_Y + CARD_H - 38
  doc.moveTo(CARD_X, FOOTER_Y).lineTo(CARD_X + CARD_W, FOOTER_Y).strokeColor(C_BORDER).lineWidth(0.4).stroke()

  doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
  doc.text(template.footerNote || `Thank you for shopping with ${settings?.store_name || 'us'}.`, CX, FOOTER_Y + 10, {
    width: CW / 2, lineBreak: false,
  })
  doc.text(
    `Powered by ${settings?.store_name || 'Cluster Fascination'}`,
    CR - 160, FOOTER_Y + 10,
    { width: 160, align: 'right', lineBreak: false },
  )

  doc.end()

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}