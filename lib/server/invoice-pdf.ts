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

function wrapText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, options?: PDFKit.Mixins.TextOptions) {
  doc.text(text, x, y, { width, ...options })
  return doc.y
}

function drawInfoCard(doc: PDFKit.PDFDocument, {
  x,
  y,
  width,
  height,
  title,
  lines,
  fillColor,
}: {
  x: number
  y: number
  width: number
  height: number
  title: string
  lines: string[]
  fillColor: string
}) {
  doc.save()
  doc.roundedRect(x, y, width, height, 12).fill(fillColor)
  doc.restore()

  doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9)
  doc.text(title.toUpperCase(), x + 16, y + 14, { width: width - 32 })

  let cursorY = y + 32
  lines.forEach((line, index) => {
    doc.font(index === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === 0 ? 13 : 10.5).fillColor(index === 0 ? '#111827' : '#4b5563')
    cursorY = wrapText(doc, line, x + 16, cursorY, width - 32, { lineGap: 2 })
    cursorY += index === 0 ? 4 : 2
  })
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
      Title: `${settings?.store_name || 'Cluster Fascination'} invoice ${order.order_number || order.id}`,
      Author: settings?.store_name || 'Cluster Fascination',
      Subject: `Invoice ${order.order_number || order.id}`,
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const left = 42
  const right = pageWidth - 42
  const contentWidth = right - left

  const drawPageHeader = () => {
    doc.save()
    doc.rect(0, 0, pageWidth, 12).fill(template.accentColor)
    doc.restore()

    doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9)
    doc.text(template.headerLabel.toUpperCase(), left, 28)

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(24)
    doc.text(settings?.store_name || 'Cluster ERP', left, 44, { width: contentWidth * 0.58 })

    doc.font('Helvetica').fontSize(10).fillColor('#4b5563')
    let infoY = 74
    if (settings?.store_address) {
      infoY = wrapText(doc, settings.store_address, left, infoY, contentWidth * 0.58, { lineGap: 2 })
      infoY += 4
    }
    const storeMeta = [settings?.store_phone ? `Phone: ${settings.store_phone}` : '', settings?.store_email ? `Email: ${settings.store_email}` : '', settings?.gstin ? `GSTIN: ${settings.gstin}` : ''].filter(Boolean)
    if (storeMeta.length > 0) {
      wrapText(doc, storeMeta.join('   '), left, infoY, contentWidth * 0.58, { lineGap: 2 })
    }

    const metaX = left + contentWidth * 0.63
    doc.roundedRect(metaX, 28, contentWidth * 0.37, 92, 12).fill(template.layout === 'modern' ? template.accentColor : '#f9fafb')
    doc.fillColor(template.layout === 'modern' ? '#ffffff' : '#111827').font('Helvetica-Bold').fontSize(10)
    doc.text('Invoice', metaX + 16, 42)
    doc.fontSize(18).text(`#${order.order_number || order.id.slice(0, 8)}`, metaX + 16, 58)
    doc.font('Helvetica').fontSize(10)
    const metaColor = template.layout === 'modern' ? '#e5e7eb' : '#4b5563'
    doc.fillColor(metaColor).text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, metaX + 16, 84)
    doc.text(`Status: ${order.payment_status}`, metaX + 16, 98)
  }

  const ensureSpace = (requiredHeight: number) => {
    if (doc.y + requiredHeight <= pageHeight - 42) {
      return
    }

    doc.addPage()
    drawPageHeader()
    doc.y = 138
  }

  const drawTableHeader = (tableTop: number) => {
    doc.save()
    doc.roundedRect(left, tableTop, contentWidth, 24, 8).fill(template.surfaceColor)
    doc.restore()
    doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(9)
    doc.text('Item', left + 12, tableTop + 8, { width: 220 })
    doc.text('SKU', left + 240, tableTop + 8, { width: 84 })
    doc.text('Price', left + 330, tableTop + 8, { width: 70, align: 'right' })
    doc.text('Qty', left + 408, tableTop + 8, { width: 46, align: 'right' })
    doc.text('Total', left + 458, tableTop + 8, { width: 80, align: 'right' })
  }

  drawPageHeader()
  doc.y = 138

  drawInfoCard(doc, {
    x: left,
    y: doc.y,
    width: (contentWidth - 16) / 2,
    height: 118,
    title: 'Bill To',
    lines: [
      order.customer_label,
      order.customer_email || 'No email',
      order.customer_phone || 'No phone',
      ...billingAddress,
    ],
    fillColor: template.surfaceColor,
  })

  drawInfoCard(doc, {
    x: left + (contentWidth - 16) / 2 + 16,
    y: doc.y,
    width: (contentWidth - 16) / 2,
    height: 118,
    title: 'Order Details',
    lines: [
      `Items: ${order.item_count}`,
      `Channel: ${order.sales_channel}`,
      `Payment: ${order.payment_method || 'N/A'}`,
      ...shippingAddress.slice(0, 4),
    ],
    fillColor: '#ffffff',
  })

  doc.y += 142
  ensureSpace(60)

  drawTableHeader(doc.y)
  doc.y += 34

  doc.font('Helvetica').fontSize(10).fillColor('#111827')
  for (const item of order.order_items) {
    const rowHeight = 22
    ensureSpace(rowHeight + 8)

    doc.text(item.product_variants?.products?.title || 'Item', left + 12, doc.y, { width: 220 })
    doc.fillColor('#4b5563').text(item.product_variants?.sku || '—', left + 240, doc.y, { width: 84 })
    doc.fillColor('#111827').text(formatCurrency(item.unit_price, currency), left + 330, doc.y, { width: 70, align: 'right' })
    doc.text(String(item.quantity), left + 408, doc.y, { width: 46, align: 'right' })
    doc.text(formatCurrency(item.total_price, currency), left + 458, doc.y, { width: 80, align: 'right' })

    const lineY = doc.y + rowHeight - 4
    doc.moveTo(left, lineY).lineTo(right, lineY).strokeColor('#e5e7eb').lineWidth(1).stroke()
    doc.y += rowHeight
  }

  doc.y += 14
  ensureSpace(170)

  const totalsX = left + contentWidth - 220
  doc.roundedRect(totalsX, doc.y, 220, 112, 12).fill('#ffffff')
  doc.strokeColor('#e5e7eb').roundedRect(totalsX, doc.y, 220, 112, 12).stroke()
  let totalsY = doc.y + 16
  const totalsRows = [
    ['Subtotal', formatCurrency(totals.subtotal, currency)],
    ...(totals.discount > 0 ? [['Discount', `-${formatCurrency(totals.discount, currency)}`]] as string[][] : []),
    ['Tax', formatCurrency(totals.tax, currency)],
    ['Shipping', formatCurrency(totals.shipping, currency)],
  ]
  totalsRows.forEach(([label, value]) => {
    doc.fillColor(label === 'Discount' ? '#dc2626' : '#4b5563').font('Helvetica').fontSize(10)
    doc.text(label, totalsX + 14, totalsY, { width: 90 })
    doc.text(value, totalsX + 100, totalsY, { width: 100, align: 'right' })
    totalsY += 18
  })
  doc.moveTo(totalsX + 14, totalsY + 4).lineTo(totalsX + 206, totalsY + 4).strokeColor('#e5e7eb').stroke()
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12)
  doc.text('Grand Total', totalsX + 14, totalsY + 14, { width: 90 })
  doc.text(formatCurrency(totals.grand, currency), totalsX + 100, totalsY + 14, { width: 100, align: 'right' })

  doc.y = Math.max(doc.y + 128, totalsY + 44)
  ensureSpace(150)

  doc.roundedRect(left, doc.y, contentWidth, order.notes ? 120 : 92, 12).fill('#ffffff')
  doc.strokeColor('#e5e7eb').roundedRect(left, doc.y, contentWidth, order.notes ? 120 : 92, 12).stroke()
  doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9)
  doc.text(template.termsTitle.toUpperCase(), left + 16, doc.y + 14)
  doc.font('Helvetica').fontSize(10).fillColor('#4b5563')
  wrapText(doc, template.termsBody, left + 16, doc.y + 30, contentWidth - 32, { lineGap: 2 })

  if (template.showNotes && order.notes) {
    doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9)
    doc.text('NOTES', left + 16, doc.y + 18)
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563')
    wrapText(doc, order.notes, left + 16, doc.y + 34, contentWidth - 32, { lineGap: 2 })
  }

  doc.y += order.notes ? 136 : 108
  ensureSpace(50)

  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#e5e7eb').stroke()
  doc.fillColor('#6b7280').font('Helvetica').fontSize(10)
  doc.text(template.footerNote, left, doc.y + 12, { width: contentWidth, align: 'center' })
  doc.text(`For any enquiries, contact ${settings?.store_email || 'our team'}.`, left, doc.y + 28, { width: contentWidth, align: 'center' })

  doc.end()

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}
