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
  if (!address) return []
  const preferredKeys = ['name', 'line1', 'line2', 'city', 'state', 'postal_code', 'country', 'phone']
  const orderedValues = preferredKeys
    .map((key) => address[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (orderedValues.length > 0) return orderedValues
  return Object.values(address).filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

export async function renderInvoicePdf({
  order,
  settings,
}: {
  order: InvoiceOrder
  settings: AppSettings | null
}) {
  const template = normalizeInvoiceTemplate(settings?.invoice_template)
  const currency = order.currency || settings?.store_currency || 'INR'
  const billingAddress = formatAddress(order.billing_address)
  const shippingAddress = formatAddress(order.shipping_address)
  const totals = {
    subtotal: order.subtotal_amount || order.order_items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0),
    discount: order.discount_amount || 0,
    tax: order.tax_amount || 0,
    shipping: order.shipping_amount || 0,
    grand: order.total_amount || 0,
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 42, bottom: 42, left: 42, right: 42 },
    info: {
      Title: `${settings?.store_name || 'Cluster Fascination'} Invoice ${order.order_number || order.id}`,
      Author: settings?.store_name || 'Cluster Fascination',
      Subject: `Invoice ${order.order_number || order.id}`,
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

  const pageWidth = doc.page.width   // 595.28 for A4
  const pageHeight = doc.page.height // 841.89 for A4
  const ML = 42   // margin left
  const MR = 42   // margin right
  const CW = pageWidth - ML - MR    // content width ≈ 511

  // ─── Column X positions for the items table ───────────────────────────
  // Item | SKU | Price | Qty | Total
  const COL_ITEM_X   = ML
  const COL_ITEM_W   = 210
  const COL_SKU_X    = COL_ITEM_X + COL_ITEM_W + 4
  const COL_SKU_W    = 80
  const COL_PRICE_X  = COL_SKU_X + COL_SKU_W + 4
  const COL_PRICE_W  = 72
  const COL_QTY_X    = COL_PRICE_X + COL_PRICE_W + 4
  const COL_QTY_W    = 40
  const COL_TOTAL_X  = COL_QTY_X + COL_QTY_W + 4
  const COL_TOTAL_W  = CW - (COL_TOTAL_X - ML)

  // ─── Load logo once ───────────────────────────────────────────────────
  let logoPath: string | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const p = path.join(process.cwd(), 'public', 'logo.png')
    if (fs.existsSync(p)) logoPath = p
  } catch { /* ignore */ }

  // ─── Page header (repeated on every page) ────────────────────────────
  const HEADER_H = 130  // height reserved for header on every page

  const drawPageHeader = () => {
    // Accent bar at very top
    doc.save().rect(0, 0, pageWidth, 10).fill(template.accentColor).restore()

    // Logo
    const LOGO_SIZE = 40
    const LOGO_X = ML
    const LOGO_Y = 18

    if (logoPath) {
      try { doc.image(logoPath, LOGO_X, LOGO_Y, { width: LOGO_SIZE, height: LOGO_SIZE }) } catch { /* ignore */ }
    }

    const textX = logoPath ? LOGO_X + LOGO_SIZE + 10 : ML

    // Store label
    doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(7)
    doc.text(template.headerLabel.toUpperCase(), textX, 20, { characterSpacing: 1 })

    // Store name
    doc.fillColor(template.accentColor).font('Helvetica-Bold').fontSize(22)
    doc.text(settings?.store_name || 'Cluster Fascination', textX, 32, { width: CW * 0.55, lineBreak: false })

    // Store contact
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
    const contactLines: string[] = []
    if (settings?.store_address) contactLines.push(settings.store_address)
    if (settings?.store_phone) contactLines.push(`Ph: ${settings.store_phone}`)
    if (settings?.store_email) contactLines.push(`Email: ${settings.store_email}`)
    if (settings?.gstin) contactLines.push(`GSTIN: ${settings.gstin}`)
    if (contactLines.length > 0) {
      doc.text(contactLines.join('  ·  '), textX, 60, { width: CW * 0.55, lineGap: 2 })
    }

    // Invoice meta card (right side)
    const CARD_W = 160
    const CARD_X = pageWidth - MR - CARD_W
    const CARD_Y = 18
    const CARD_H = 100
    doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 10)
      .fill(template.layout === 'modern' ? template.accentColor : '#f3f4f6')

    const textColor = template.layout === 'modern' ? '#ffffff' : '#111827'
    const subColor  = template.layout === 'modern' ? '#d1d5db' : '#6b7280'

    doc.fillColor(subColor).font('Helvetica').fontSize(8)
    doc.text('INVOICE', CARD_X + 14, CARD_Y + 14, { width: CARD_W - 28 })

    doc.fillColor(textColor).font('Helvetica-Bold').fontSize(20)
    doc.text(`#${order.order_number || order.id.slice(0, 8)}`, CARD_X + 14, CARD_Y + 26, { width: CARD_W - 28 })

    doc.fillColor(subColor).font('Helvetica').fontSize(8.5)
    doc.text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`, CARD_X + 14, CARD_Y + 56, { width: CARD_W - 28 })
    doc.text(`Status: ${order.payment_status}`, CARD_X + 14, CARD_Y + 72, { width: CARD_W - 28 })

    // Divider under header
    doc.moveTo(ML, HEADER_H - 6).lineTo(pageWidth - MR, HEADER_H - 6)
      .strokeColor('#e5e7eb').lineWidth(0.5).stroke()
  }

  // ─── Ensure enough space, or add a new page ───────────────────────────
  const ensureSpace = (needed: number) => {
    if (doc.y + needed > pageHeight - MR) {
      doc.addPage()
      drawPageHeader()
      doc.y = HEADER_H + 8
    }
  }

  // ─── Draw info cards side by side without advancing doc.y ─────────────
  const drawInfoCards = (startY: number): number => {
    const cardW = (CW - 12) / 2
    const leftCardX = ML
    const rightCardX = ML + cardW + 12

    // Measure how tall each card needs to be
    const measureLines = (lines: string[], cardWidth: number) => {
      let h = 32 // title + padding
      lines.forEach((line, i) => {
        const fontSize = i === 0 ? 12 : 9.5
        const lineH = fontSize * 1.4
        // Rough chars-per-line estimate
        const charsPerLine = Math.floor((cardWidth - 32) / (fontSize * 0.55))
        const wrappedLines = Math.max(1, Math.ceil(line.length / charsPerLine))
        h += lineH * wrappedLines + (i === 0 ? 4 : 2)
      })
      return h + 16 // bottom padding
    }

    const billLines = [
      order.customer_label,
      order.customer_email || 'No email',
      order.customer_phone || 'No phone',
      ...billingAddress,
    ]
    const orderLines = [
      `Items: ${order.item_count}`,
      `Channel: ${order.sales_channel}`,
      `Payment: ${order.payment_method || 'N/A'}`,
      ...shippingAddress.slice(0, 3),
    ]

    const cardH = Math.max(
      measureLines(billLines, cardW),
      measureLines(orderLines, cardW),
      100,
    )

    // Bill To card
    doc.roundedRect(leftCardX, startY, cardW, cardH, 10).fill(template.surfaceColor)
    doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(8)
    doc.text('BILL TO', leftCardX + 14, startY + 14, { characterSpacing: 0.8 })
    let cy = startY + 30
    billLines.forEach((line, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(i === 0 ? 12 : 9.5)
        .fillColor(i === 0 ? '#111827' : '#4b5563')
      doc.text(line, leftCardX + 14, cy, { width: cardW - 28, lineGap: 1 })
      cy = doc.y + (i === 0 ? 4 : 2)
    })

    // Order Details card
    doc.roundedRect(rightCardX, startY, cardW, cardH, 10).fill('#ffffff')
    doc.strokeColor('#e5e7eb').lineWidth(0.5)
      .roundedRect(rightCardX, startY, cardW, cardH, 10).stroke()
    doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(8)
    doc.text('ORDER DETAILS', rightCardX + 14, startY + 14, { characterSpacing: 0.8 })
    cy = startY + 30
    orderLines.forEach((line, i) => {
      doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(i === 0 ? 12 : 9.5)
        .fillColor(i === 0 ? '#111827' : '#4b5563')
      doc.text(line, rightCardX + 14, cy, { width: cardW - 28, lineGap: 1 })
      cy = doc.y + (i === 0 ? 4 : 2)
    })

    return startY + cardH + 16 // return Y after both cards
  }

  // ─── Draw table header row ─────────────────────────────────────────────
  const TABLE_ROW_H = 24

  const drawTableHeader = (y: number) => {
    doc.roundedRect(ML, y, CW, TABLE_ROW_H, 6).fill(template.surfaceColor)
    doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8.5)
    doc.text('ITEM',  COL_ITEM_X  + 8, y + 8, { width: COL_ITEM_W,  lineBreak: false })
    doc.text('SKU',   COL_SKU_X,       y + 8, { width: COL_SKU_W,   lineBreak: false })
    doc.text('PRICE', COL_PRICE_X,     y + 8, { width: COL_PRICE_W, align: 'right', lineBreak: false })
    doc.text('QTY',   COL_QTY_X,       y + 8, { width: COL_QTY_W,   align: 'right', lineBreak: false })
    doc.text('TOTAL', COL_TOTAL_X,     y + 8, { width: COL_TOTAL_W, align: 'right', lineBreak: false })
    return y + TABLE_ROW_H
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD THE PDF
  // ═══════════════════════════════════════════════════════════════════════

  drawPageHeader()
  let curY = HEADER_H + 8

  // ── Info cards ──────────────────────────────────────────────────────────
  ensureSpace(120)
  curY = drawInfoCards(curY)
  doc.y = curY

  // ── Items table ─────────────────────────────────────────────────────────
  ensureSpace(60)
  curY = drawTableHeader(doc.y)

  doc.font('Helvetica').fontSize(10).fillColor('#111827')

  for (const item of order.order_items) {
    const itemTitle = item.product_variants?.products?.title || 'Item'
    const sku       = item.product_variants?.sku || '—'
    const price     = formatCurrency(item.unit_price, currency)
    const qty       = String(item.quantity)
    const total     = formatCurrency(item.total_price, currency)

    // Measure wrapped height of item title
    const titleLineH = 13
    const charsPerLine = Math.floor(COL_ITEM_W / 6.2)
    const titleLines = Math.max(1, Math.ceil(itemTitle.length / charsPerLine))
    const rowH = Math.max(TABLE_ROW_H, titleLines * titleLineH + 10)

    ensureSpace(rowH + 6)

    const rowY = doc.y

    // Item name (may wrap)
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9.5)
    doc.text(itemTitle, COL_ITEM_X + 8, rowY + 6, { width: COL_ITEM_W, lineGap: 1 })

    // Other cols pinned to rowY (single line, no wrap)
    doc.fillColor('#6b7280').font('Helvetica').fontSize(9)
    doc.text(sku,   COL_SKU_X,   rowY + 6, { width: COL_SKU_W,   lineBreak: false })
    doc.fillColor('#111827')
    doc.text(price, COL_PRICE_X, rowY + 6, { width: COL_PRICE_W, align: 'right', lineBreak: false })
    doc.text(qty,   COL_QTY_X,   rowY + 6, { width: COL_QTY_W,   align: 'right', lineBreak: false })
    doc.font('Helvetica-Bold')
    doc.text(total, COL_TOTAL_X, rowY + 6, { width: COL_TOTAL_W, align: 'right', lineBreak: false })

    // Row divider
    const divY = rowY + rowH
    doc.moveTo(ML, divY).lineTo(pageWidth - MR, divY).strokeColor('#f3f4f6').lineWidth(0.5).stroke()

    doc.y = divY + 2
    curY  = doc.y
  }

  // ── Totals block ────────────────────────────────────────────────────────
  curY += 14
  ensureSpace(160)
  doc.y = curY

  const TOTALS_W = 220
  const TOTALS_X = pageWidth - MR - TOTALS_W
  const totalsRows: [string, string, boolean][] = [
    ['Subtotal', formatCurrency(totals.subtotal, currency), false],
    ...(totals.discount > 0 ? [['Discount', `-${formatCurrency(totals.discount, currency)}`, true] as [string, string, boolean]] : []),
    ['Tax', formatCurrency(totals.tax, currency), false],
    ['Shipping', formatCurrency(totals.shipping, currency), false],
  ]

  const totalsBoxH = totalsRows.length * 20 + 44
  doc.roundedRect(TOTALS_X, doc.y, TOTALS_W, totalsBoxH, 10).fill('#f9fafb')
  doc.strokeColor('#e5e7eb').lineWidth(0.5).roundedRect(TOTALS_X, doc.y, TOTALS_W, totalsBoxH, 10).stroke()

  let ty = doc.y + 14
  totalsRows.forEach(([label, value, isDiscount]) => {
    doc.font('Helvetica').fontSize(9.5).fillColor(isDiscount ? '#dc2626' : '#6b7280')
    doc.text(label, TOTALS_X + 14, ty, { width: 90, lineBreak: false })
    doc.text(value, TOTALS_X + 100, ty, { width: TOTALS_W - 114, align: 'right', lineBreak: false })
    ty += 20
  })

  doc.moveTo(TOTALS_X + 14, ty + 2).lineTo(TOTALS_X + TOTALS_W - 14, ty + 2)
    .strokeColor('#d1d5db').lineWidth(0.5).stroke()

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11)
  doc.text('Grand Total', TOTALS_X + 14, ty + 10, { width: 90, lineBreak: false })
  doc.fontSize(13).text(formatCurrency(totals.grand, currency), TOTALS_X + 100, ty + 8, {
    width: TOTALS_W - 114, align: 'right', lineBreak: false,
  })

  doc.y = doc.y + totalsBoxH + 20
  curY = doc.y

  // ── Terms & Notes ───────────────────────────────────────────────────────
  ensureSpace(120)
  doc.y = curY

  const termsH = order.notes ? 130 : 90
  doc.roundedRect(ML, doc.y, CW, termsH, 10).fill('#ffffff')
  doc.strokeColor('#e5e7eb').lineWidth(0.5).roundedRect(ML, doc.y, CW, termsH, 10).stroke()

  doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(8)
  doc.text(template.termsTitle.toUpperCase(), ML + 16, doc.y + 14, { characterSpacing: 0.8 })
  doc.font('Helvetica').fontSize(9.5).fillColor('#4b5563')
  doc.text(template.termsBody, ML + 16, doc.y + 28, { width: CW - 32, lineGap: 2 })

  if (template.showNotes && order.notes) {
    const noteY = doc.y + 6
    doc.fillColor('#9ca3af').font('Helvetica-Bold').fontSize(8)
    doc.text('NOTES', ML + 16, noteY, { characterSpacing: 0.8 })
    doc.font('Helvetica').fontSize(9.5).fillColor('#4b5563')
    doc.text(order.notes, ML + 16, noteY + 14, { width: CW - 32, lineGap: 2 })
  }

  doc.y += termsH + 20
  ensureSpace(50)

  // ── Footer ──────────────────────────────────────────────────────────────
  doc.moveTo(ML, doc.y).lineTo(pageWidth - MR, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke()
  doc.fillColor('#9ca3af').font('Helvetica').fontSize(9)
  doc.text(template.footerNote, ML, doc.y + 12, { width: CW, align: 'center' })
  doc.text(
    `For any enquiries, contact ${settings?.store_email || 'our team'}.`,
    ML, doc.y + 26, { width: CW, align: 'center' },
  )

  doc.end()

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}
