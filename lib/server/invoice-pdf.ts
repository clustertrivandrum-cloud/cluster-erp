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

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(amount: number | string | null | undefined) {
  const value = typeof amount === 'number' ? amount : Number(amount ?? 0)
  const safe  = Number.isFinite(value) ? value : 0
  return `Rs.${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)}`
}

function fmtInvoiceNumber(order: InvoiceOrder): string {
  const year = new Date(order.created_at).getFullYear()
  const num  = String(order.order_number || '').padStart(4, '0')
  return `CF-${year}-${num}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export async function renderInvoicePdf({
  order,
  settings,
}: {
  order: InvoiceOrder
  settings: AppSettings | null
}) {
  const template = normalizeInvoiceTemplate(settings?.invoice_template)

  const totals = {
    subtotal: Number(order.subtotal_amount)  || order.order_items.reduce((s, i) => s + Number(i.total_price ?? 0), 0),
    discount: Number(order.discount_amount)  || 0,
    tax:      Number(order.tax_amount)       || 0,
    shipping: Number(order.shipping_amount)  || 0,
    grand:    Number(order.total_amount)     || 0,
  }

  const storeName    = settings?.store_name    || 'Cluster Fascination'
  const storeAddr    = settings?.store_address || '98/3499-3, Kallingal Rd, Kulathoor, Thiruvananthapuram, Kerala 695583'
  const storePhone   = settings?.store_phone   || '062826 60237'
  const storeEmail   = settings?.store_email   || 'clusterfasciantion@gmail.com'
  const customerName = order.customer_name || order.guest_name || (order.customer_label !== 'Guest Checkout' && order.customer_label !== 'Walk-in POS' ? order.customer_label : null) || null
  const paymentRef   = order.tracking_id || null

  // ── PDFKit doc ─────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title:   `Invoice ${fmtInvoiceNumber(order)}`,
      Author:  storeName,
      Subject: `Invoice ${fmtInvoiceNumber(order)}`,
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (c) => chunks.push(Buffer.from(c)))

  const PW  = doc.page.width    // 595.28
  const PH  = doc.page.height   // 841.89
  const PAD = 36

  const CARD_X = PAD
  const CARD_Y = PAD
  const CARD_W = PW - PAD * 2

  const CX = CARD_X + 24
  const CR = CARD_X + CARD_W - 24
  const CW = CR - CX

  // Table column widths (allocated from right)
  const COL_AMT_W   = 88
  const COL_PRICE_W = 88
  const COL_QTY_W   = 34
  const COL_GAP     = 8
  const COL_AMT_X   = CR - COL_AMT_W
  const COL_PRICE_X = COL_AMT_X   - COL_GAP - COL_PRICE_W
  const COL_QTY_X   = COL_PRICE_X - COL_GAP - COL_QTY_W
  const COL_ITEM_X  = CX
  const COL_ITEM_W  = COL_QTY_X - COL_GAP - COL_ITEM_X

  // ── Theme ──────────────────────────────────────────────────────────────
  const C_BG      = '#f4f4f5'
  const C_WHITE   = '#ffffff'
  const C_BORDER  = '#e4e4e7'
  const C_TEXT    = '#18181b'
  const C_MUTED   = '#71717a'
  const C_ACCENT  = template.accentColor || '#2f5a37'
  const C_SURFACE = template.surfaceColor || '#eef5f0'
  const DOT_COLORS = [C_ACCENT, '#d97706', '#6366f1', '#ec4899', '#0891b2']

  // ── Logo ───────────────────────────────────────────────────────────────
  let logoPath: string | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs   = require('fs')   as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const p = path.join(process.cwd(), 'public', 'logo.png')
    if (fs.existsSync(p)) logoPath = p
  } catch { /* ignore */ }

  // ── Drawing helpers ────────────────────────────────────────────────────
  const roundedCard = (x: number, y: number, w: number, h: number, fill = C_WHITE) => {
    doc.roundedRect(x, y, w, h, 8).fill(fill)
    doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(x, y, w, h, 8).stroke()
  }

  const hRule = (y: number, x1 = CARD_X, x2 = CARD_X + CARD_W, lw = 0.4) =>
    doc.moveTo(x1, y).lineTo(x2, y).strokeColor(C_BORDER).lineWidth(lw).stroke()

  const metaCol = (label: string, value: string, x: number, y: number, w: number) => {
    doc.font('Helvetica').fontSize(7.5).fillColor(C_MUTED)
    doc.text(label, x, y, { width: w, lineBreak: false })
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C_TEXT)
    doc.text(value, x, y + 12, { width: w, lineBreak: false })
  }

  const bodyText = (text: string, x: number, y: number, w: number, opts: object = {}) => {
    doc.font('Helvetica').fontSize(9).fillColor(C_TEXT)
    doc.text(text, x, y, { width: w, lineGap: 1, ...opts })
    return doc.y
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  // Page background (white for printing)
  doc.rect(0, 0, PW, PH).fill(C_WHITE)

  let Y = CARD_Y + 22

  // ── HEADER ────────────────────────────────────────────────────────────
  // [Logo + store name]    [Invoice No.]  [Date]  [Status]
  const LOGO_SZ = 32
  if (logoPath) {
    try { doc.image(logoPath, CX, Y, { width: LOGO_SZ }) } catch { /* ignore */ }
  }
  const nameX = logoPath ? CX + LOGO_SZ + 10 : CX
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C_TEXT)
  doc.text(storeName, nameX, Y + 9, { lineBreak: false })

  const META_W  = 88
  metaCol('Invoice No.',  fmtInvoiceNumber(order),              CR - META_W * 3 - 14, Y + 2, META_W + 10)
  metaCol('Date',         fmtDate(order.created_at),            CR - META_W * 2,      Y + 2, META_W)
  metaCol('Status',       (order.payment_status).toUpperCase(), CR - META_W + 6,      Y + 2, META_W - 6)

  Y += LOGO_SZ + 18
  hRule(Y)
  Y += 18

  // ── FROM / TO SECTION ────────────────────────────────────────────────
  const HALF_W  = (CW - 12) / 2
  const LEFT_X  = CX
  const RIGHT_X = CX + HALF_W + 12

  // Accurate height calculation
  doc.font('Helvetica').fontSize(9)
  const textWidth = HALF_W - 28
  
  let fromH = 68 // base padding and header
  if (storeAddr)  fromH += doc.heightOfString(storeAddr, { width: textWidth, lineGap: 1 }) + 8
  if (storePhone) fromH += doc.heightOfString(storePhone, { width: textWidth, lineGap: 1 }) + 8
  if (storeEmail) fromH += doc.heightOfString(storeEmail, { width: textWidth, lineGap: 1 }) + 8

  let toH = 68
  if (customerName) toH += 20
  if (order.customer_email) {
    doc.fontSize(8.5)
    toH += doc.heightOfString(order.customer_email, { width: textWidth }) + 8
    doc.fontSize(9)
  }
  const toPhone = order.customer_phone || order.guest_phone || ''
  if (toPhone) toH += doc.heightOfString(toPhone, { width: textWidth, lineGap: 1 }) + 8
  if (order.payment_method) toH += doc.heightOfString(order.payment_method, { width: textWidth, lineGap: 1 }) + 8
  if (paymentRef) toH += doc.heightOfString(paymentRef, { width: textWidth, lineGap: 1 }) + 8

  const cardH = Math.max(120, fromH, toH)

  // FROM card
  roundedCard(LEFT_X, Y, HALF_W, cardH, C_SURFACE)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED)
  doc.text('FROM', LEFT_X + 14, Y + 11, { characterSpacing: 0.8, lineBreak: false })
  hRule(Y + 26, LEFT_X, LEFT_X + HALF_W, 0.3)

  const INNER_Y = Y + 34
  if (logoPath) {
    try { doc.image(logoPath, LEFT_X + 14, INNER_Y, { width: 26 }) } catch { /* ignore */ }
  }
  const fromTX = LEFT_X + 14 + (logoPath ? 34 : 0)
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C_TEXT)
  doc.text(storeName, fromTX, INNER_Y + 5, { lineBreak: false })

  let fy = INNER_Y + 22
  fy = bodyText(storeAddr, LEFT_X + 14, fy, HALF_W - 28) + 8

  if (storePhone) {
    fy = bodyText(storePhone, LEFT_X + 14, fy, HALF_W - 28) + 8
  }
  if (storeEmail) {
    bodyText(storeEmail, LEFT_X + 14, fy, HALF_W - 28)
  }

  // TO card
  roundedCard(RIGHT_X, Y, HALF_W, cardH, C_WHITE)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED)
  doc.text('TO', RIGHT_X + 14, Y + 11, { characterSpacing: 0.8, lineBreak: false })
  hRule(Y + 26, RIGHT_X, RIGHT_X + HALF_W, 0.3)

  let ty = INNER_Y
  if (customerName) {
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C_TEXT)
    doc.text(customerName, RIGHT_X + 14, ty + 5, { width: HALF_W - 28, lineBreak: false })
    ty += 20
  }
  if (order.customer_email) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
    doc.text(order.customer_email, RIGHT_X + 14, ty, { lineBreak: false })
    ty += 14
  }
  if (order.customer_phone || order.guest_phone) {
    ty = bodyText(order.customer_phone || order.guest_phone || '', RIGHT_X + 14, ty, HALF_W - 28) + 8
  }
  if (order.payment_method) {
    ty = bodyText(order.payment_method, RIGHT_X + 14, ty, HALF_W - 28) + 8
  }
  if (paymentRef) {
    bodyText(paymentRef, RIGHT_X + 14, ty, HALF_W - 28)
  }

  Y += cardH + 20

  // ── ITEMS TABLE ───────────────────────────────────────────────────────
  doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
  doc.text('Description', COL_ITEM_X,  Y, { width: COL_ITEM_W, lineBreak: false })
  doc.text('QTY',         COL_QTY_X,   Y, { width: COL_QTY_W,   align: 'center', lineBreak: false })
  doc.text('Price',       COL_PRICE_X, Y, { width: COL_PRICE_W, align: 'right',  lineBreak: false })
  doc.text('Amount',      COL_AMT_X,   Y, { width: COL_AMT_W,   align: 'right',  lineBreak: false })

  Y += 14
  hRule(Y)
  Y += 10

  order.order_items.forEach((item, idx) => {
    const title = item.product_variants?.products?.title || 'Item'
    const sku   = item.product_variants?.sku
    const charsPerLine = Math.floor(COL_ITEM_W / 6)
    const lines = Math.max(1, Math.ceil(title.length / charsPerLine))
    const rowH  = Math.max(34, lines * 13 + 16)

    // Page overflow guard
    if (Y + rowH > PH - PAD - 180) {
      doc.addPage()
      doc.rect(0, 0, PW, PH).fill(C_WHITE)
      Y = PAD + 26
    }

    // Coloured dot
    doc.circle(COL_ITEM_X + 5, Y + 10, 4).fill(DOT_COLORS[idx % DOT_COLORS.length])

    // Title
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_TEXT)
    doc.text(title, COL_ITEM_X + 16, Y + 4, { width: COL_ITEM_W - 16, lineGap: 1 })

    // SKU
    if (sku) {
      doc.font('Helvetica').fontSize(7.5).fillColor(C_MUTED)
      doc.text(sku, COL_ITEM_X + 16, Y + 4 + lines * 13, { lineBreak: false })
    }

    // Qty / Price / Amount (pinned to row top, no wrap)
    doc.font('Helvetica').fontSize(9.5).fillColor(C_TEXT)
    doc.text(String(item.quantity), COL_QTY_X,   Y + 4, { width: COL_QTY_W,   align: 'center', lineBreak: false })
    doc.text(fmt(item.unit_price),  COL_PRICE_X, Y + 4, { width: COL_PRICE_W, align: 'right',  lineBreak: false })
    doc.font('Helvetica-Bold')
    doc.text(fmt(item.total_price), COL_AMT_X,   Y + 4, { width: COL_AMT_W,   align: 'right',  lineBreak: false })

    Y += rowH
    hRule(Y, CARD_X, CARD_X + CARD_W, 0.3)
    Y += 2
  })

  Y += 16

  // ── TOTALS ────────────────────────────────────────────────────────────
  const TOT_LBL_X = CR - 260
  const TOT_VAL_X = COL_AMT_X
  const TOT_VAL_W = COL_AMT_W

  const totRow = (label: string, value: string, bold = false, color = C_MUTED) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(color)
    doc.text(label, TOT_LBL_X, Y, { lineBreak: false })
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? C_TEXT : color)
    doc.text(value, TOT_VAL_X, Y, { width: TOT_VAL_W, align: 'right', lineBreak: false })
    Y += bold ? 24 : 18
  }

  totRow('Subtotal', fmt(totals.subtotal))
  if (totals.discount > 0) totRow('Discount', `-${fmt(totals.discount)}`, false, '#dc2626')
  if (totals.tax > 0)      totRow('Tax',      fmt(totals.tax))
  if (totals.shipping > 0) totRow('Shipping', fmt(totals.shipping))

  hRule(Y - 2, TOT_LBL_X, CR)
  Y += 8
  totRow('Total', fmt(totals.grand), true)

  Y += 16



  if (template.showNotes && order.notes) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C_MUTED)
    doc.text('ORDER NOTES', CX, Y, { characterSpacing: 0.5, lineBreak: false })
    Y += 13
    doc.font('Helvetica').fontSize(9).fillColor(C_MUTED)
    doc.text(order.notes, CX, Y, { width: CW, lineGap: 2 })
    Y = doc.y + 10
  }

  Y += 4

  // ── FOOTER ─────────────────────────────────────────────────────────────
  // Footer sits just below the last content, not forced to bottom
  hRule(Y)
  Y += 12

  const supportLine = [storeEmail && `Support: ${storeEmail}`, storePhone].filter(Boolean).join('  |  ')
  doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
  doc.text(supportLine || `Thank you for shopping with ${storeName}.`, CX, Y, {
    width: CW * 0.6, lineGap: 2,
  })
  doc.text(`Returns & exchanges subject to store policy.`, CX, doc.y + 2, {
    width: CW * 0.6, lineBreak: false,
  })

  if (logoPath) {
    try { doc.image(logoPath, CR - 100, Y, { width: 18 }) } catch { /* ignore */ }
  }
  doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
  doc.text(storeName, CR - 78, Y + 2, { width: 78, align: 'right', lineBreak: false })

  const FINAL_Y = doc.y + 20

  // ── Main card drawn AFTER content so height is dynamic ────────────────
  const CARD_H = FINAL_Y - CARD_Y + PAD / 2
  // Draw only the border, DO NOT fill white, otherwise it covers the content
  doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).stroke()

  // Re-render all content on top of the card
  // Since we can't move layers in PDFKit, we render content AFTER the card by starting over.
  // Solution: draw card background FIRST at page render time with estimated height,
  // then draw content. We'll use a pre-estimated max height.
  doc.end()

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}