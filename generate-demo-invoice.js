// Demo invoice PDF generator — runs with plain Node (no TypeScript)
const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

// ── Demo data ─────────────────────────────────────────────────────────────
const order = {
  order_number: 47,
  created_at: new Date().toISOString(),
  payment_status: 'paid',
  status: 'completed',
  sales_channel: 'pos',
  payment_method: 'UPI',
  item_count: 3,
  customer_label: 'Sneha Rajan',
  customer_email: 'sneha@example.com',
  customer_phone: '+91 98765 43210',
  subtotal_amount: 897,
  discount_amount: 50,
  tax_amount: 0,
  shipping_amount: 0,
  total_amount: 847,
  notes: null,
  order_items: [
    { id: '1', quantity: 1, unit_price: 399, total_price: 399, product_variants: { sku: 'ATC22', products: { title: 'Anti-tarnish Multicolor Charm Necklace' } } },
    { id: '2', quantity: 1, unit_price: 259, total_price: 259, product_variants: { sku: 'ATC18', products: { title: 'Anti-tarnish Pearl And 4 Leaf Clover Pendant Minimalist Necklace' } } },
    { id: '3', quantity: 1, unit_price: 239, total_price: 239, product_variants: { sku: 'ATC21', products: { title: 'Anti-tarnish Casual Style Heart Pendant Necklace' } } },
  ],
}

const settings = {
  store_name:    'Cluster Fascination',
  store_address: '98/3499-3, Kallingal Rd, Kulathoor, Thiruvananthapuram, Kerala 695583',
  store_email:   'clusterfasciantion@gmail.com',
  store_phone:   '062826 60237',
  gstin:         null,
}

// ── Currency ──────────────────────────────────────────────────────────────
function fmt(amount) {
  const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0
  return `Rs.${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)}`
}

// ── Theme colours (matching your storefront) ──────────────────────────────
const C_BG      = '#f4f4f5'   // page background
const C_WHITE   = '#ffffff'
const C_BORDER  = '#e4e4e7'
const C_TEXT    = '#18181b'
const C_MUTED   = '#71717a'
const C_ACCENT  = '#2f5a37'   // brand green
const C_SURFACE = '#eef5f0'   // soft green tint
const DOT_COLORS = [C_ACCENT, '#d97706', '#6366f1', '#ec4899', '#0891b2']

// ── Logo path ─────────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, 'public', 'logo.png')
const HAS_LOGO  = fs.existsSync(LOGO_PATH)

// ── PDF setup ─────────────────────────────────────────────────────────────
const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })
const outPath = path.join(__dirname, 'demo-invoice-preview.pdf')
doc.pipe(fs.createWriteStream(outPath))

const PW  = doc.page.width    // 595.28
const PH  = doc.page.height   // 841.89
const PAD = 36                // outer page padding

// ── Layout constants ──────────────────────────────────────────────────────
const CARD_X = PAD, CARD_Y = PAD
const CARD_W  = PW - PAD * 2   // 523.28
const CARD_H  = PH - PAD * 2   // 769.89

const CX = CARD_X + 24         // content left  = 60
const CR = CARD_X + CARD_W - 24 // content right = 535
const CW = CR - CX              // content width = 475

// ── Table columns (allocated from right, avoiding overflow) ───────────────
// Amount | Price | QTY | Description
const COL_AMT_W   = 82   // "Rs.8,897.00" fits comfortably
const COL_PRICE_W = 82
const COL_QTY_W   = 32
const COL_GAP     = 8

const COL_AMT_X   = CR - COL_AMT_W
const COL_PRICE_X = COL_AMT_X   - COL_GAP - COL_PRICE_W
const COL_QTY_X   = COL_PRICE_X - COL_GAP - COL_QTY_W
const COL_DESC_X  = CX
const COL_DESC_W  = COL_QTY_X - COL_GAP - COL_DESC_X

// ── Helpers ───────────────────────────────────────────────────────────────
const card = (x, y, w, h, fill = C_WHITE) => {
  doc.roundedRect(x, y, w, h, 8).fill(fill)
  doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(x, y, w, h, 8).stroke()
}

const divider = (y, color = C_BORDER, lw = 0.4) =>
  doc.moveTo(CARD_X, y).lineTo(CARD_X + CARD_W, y).strokeColor(color).lineWidth(lw).stroke()

const metaCol = (label, value, x, y, w) => {
  doc.font('Helvetica').fontSize(7.5).fillColor(C_MUTED)
  doc.text(label, x, y, { width: w, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C_TEXT)
  doc.text(value, x, y + 12, { width: w, lineBreak: false })
}

const fieldRow = (label, value, x, y, w) => {
  doc.font('Helvetica').fontSize(7).fillColor(C_MUTED)
  doc.text(label.toUpperCase(), x, y, { width: w, characterSpacing: 0.4, lineBreak: false })
  doc.font('Helvetica').fontSize(9).fillColor(C_TEXT)
  doc.text(value, x, y + 10, { width: w, lineGap: 1 })
  return doc.y + 5
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

// 1. Page background
doc.rect(0, 0, PW, PH).fill(C_BG)

// 2. Main white card
doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).fill(C_WHITE)
doc.strokeColor(C_BORDER).lineWidth(0.5).roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 12).stroke()

let Y = CARD_Y + 22

// ── 3. TOP HEADER ─────────────────────────────────────────────────────────
// Brand logo (32×32) + store name on left
// Invoice Number | Issued | Status on right
const LOGO_SZ = 32
if (HAS_LOGO) {
  try { doc.image(LOGO_PATH, CX, Y, { width: LOGO_SZ }) } catch(e) { /* ignore */ }
}
const nameX = HAS_LOGO ? CX + LOGO_SZ + 10 : CX
doc.font('Helvetica-Bold').fontSize(13).fillColor(C_TEXT)
doc.text(settings.store_name, nameX, Y + 9, { lineBreak: false })

const META_W = 80
metaCol('Invoice Number', `#${order.order_number}`,                              CR - META_W * 3 - 20, Y + 2, META_W + 10)
metaCol('Issued',         new Date(order.created_at).toLocaleDateString('en-IN'), CR - META_W * 2 - 6,  Y + 2, META_W)
metaCol('Status',         order.payment_status.toUpperCase(),                    CR - META_W + 6,       Y + 2, META_W)

Y += LOGO_SZ + 16
divider(Y)
Y += 18

// ── 4. FROM / TO SECTION ──────────────────────────────────────────────────
const HALF_W    = (CW - 12) / 2
const LEFT_CARD = CX
const RIGHT_CARD = CX + HALF_W + 12
// Accurate height calculation
doc.font('Helvetica').fontSize(9)
const textWidth = HALF_W - 24

let fromH = 68
if (settings.store_address) fromH += 10 + doc.heightOfString(settings.store_address, { width: textWidth, lineGap: 1 }) + 4
if (settings.store_phone)   fromH += 10 + doc.heightOfString(`${settings.store_phone}${settings.gstin ? `   GSTIN: ${settings.gstin}` : ''}`, { width: textWidth, lineGap: 1 }) + 4

let toH = 68
if (order.customer_label) toH += 20
if (order.customer_email) {
  doc.fontSize(8.5)
  toH += doc.heightOfString(order.customer_email, { width: textWidth }) + 4
  doc.fontSize(9)
}
const toPhone = order.customer_phone
if (toPhone) toH += 10 + doc.heightOfString(toPhone, { width: textWidth, lineGap: 1 }) + 4
if (order.payment_method) toH += 10 + doc.heightOfString(order.payment_method, { width: textWidth, lineGap: 1 }) + 4

const FROM_TO_H = Math.max(120, fromH, toH)

// FROM card (store info)
card(LEFT_CARD, Y, HALF_W, FROM_TO_H, C_SURFACE)
doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
doc.text('From', LEFT_CARD + 12, Y + 11, { lineBreak: false })
doc.moveTo(LEFT_CARD, Y + 26).lineTo(LEFT_CARD + HALF_W, Y + 26).strokeColor(C_BORDER).lineWidth(0.3).stroke()

// Logo inside FROM card
const INNER_LOGO = 26
const INNER_Y = Y + 34
if (HAS_LOGO) {
  try { doc.image(LOGO_PATH, LEFT_CARD + 12, INNER_Y, { width: INNER_LOGO }) } catch(e) { /* ignore */ }
}
const fromTX = LEFT_CARD + 12 + (HAS_LOGO ? INNER_LOGO + 8 : 0)
doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C_TEXT)
doc.text(settings.store_name, fromTX, INNER_Y + 4, { lineBreak: false })
doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
doc.text(settings.store_email, fromTX, INNER_Y + 17, { lineBreak: false })

let fy = INNER_Y + 36
fy = fieldRow('Address', settings.store_address, LEFT_CARD + 12, fy, HALF_W - 24)
const contactStr = [settings.store_phone, settings.gstin ? `GSTIN: ${settings.gstin}` : null].filter(Boolean).join('   ')
if (contactStr) fieldRow('Contact', contactStr, LEFT_CARD + 12, fy, HALF_W - 24)

// TO card (customer info)
card(RIGHT_CARD, Y, HALF_W, FROM_TO_H, C_WHITE)
doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
doc.text('To', RIGHT_CARD + 12, Y + 11, { lineBreak: false })
doc.moveTo(RIGHT_CARD, Y + 26).lineTo(RIGHT_CARD + HALF_W, Y + 26).strokeColor(C_BORDER).lineWidth(0.3).stroke()


// Customer avatar circle
doc.circle(RIGHT_CARD + 25, INNER_Y + 13, 13).fill('#e4e4e7')
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_MUTED)
const initials = order.customer_label.split(' ').map(w => w[0]).join('').slice(0,2)
doc.text(initials, RIGHT_CARD + 18, INNER_Y + 8, { lineBreak: false })

doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C_TEXT)
doc.text(order.customer_label, RIGHT_CARD + 46, INNER_Y + 4, { lineBreak: false })
doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
doc.text(order.customer_email, RIGHT_CARD + 46, INNER_Y + 17, { lineBreak: false })

let ty2 = INNER_Y + 36
ty2 = fieldRow('Phone',   order.customer_phone, RIGHT_CARD + 12, ty2, HALF_W - 24)
fieldRow('Payment', `${order.payment_method}  ·  Channel: ${order.sales_channel}`, RIGHT_CARD + 12, ty2, HALF_W - 24)

Y += FROM_TO_H + 20

// ── 5. ITEMS TABLE ─────────────────────────────────────────────────────────
// Header row
doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
doc.text('Description', COL_DESC_X,  Y, { width: COL_DESC_W,  lineBreak: false })
doc.text('QTY',         COL_QTY_X,   Y, { width: COL_QTY_W,   align: 'center', lineBreak: false })
doc.text('Price',       COL_PRICE_X, Y, { width: COL_PRICE_W, align: 'right',  lineBreak: false })
doc.text('Amount',      COL_AMT_X,   Y, { width: COL_AMT_W,   align: 'right',  lineBreak: false })

Y += 14
divider(Y)
Y += 10

// Item rows
order.order_items.forEach((item, idx) => {
  const title  = item.product_variants.products.title
  const sku    = item.product_variants.sku
  const rowY   = Y

  // Estimate row height based on title length
  const estLines = Math.max(1, Math.ceil(title.length / Math.floor(COL_DESC_W / 6)))
  const rowH = Math.max(34, estLines * 13 + 16)

  // Coloured dot
  doc.circle(COL_DESC_X + 5, rowY + 11, 4).fill(DOT_COLORS[idx % DOT_COLORS.length])

  // Item title (may wrap — only occupies DESC column)
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_TEXT)
  doc.text(title, COL_DESC_X + 16, rowY + 4, { width: COL_DESC_W - 16, lineGap: 1 })

  // SKU below title
  doc.font('Helvetica').fontSize(7.5).fillColor(C_MUTED)
  doc.text(sku, COL_DESC_X + 16, rowY + 4 + Math.max(1, Math.ceil(title.length / Math.floor(COL_DESC_W / 6))) * 13, { lineBreak: false })

  // QTY / Price / Amount — all pinned to rowY, no wrapping
  doc.font('Helvetica').fontSize(9.5).fillColor(C_TEXT)
  doc.text(String(item.quantity), COL_QTY_X,   rowY + 4, { width: COL_QTY_W,   align: 'center', lineBreak: false })
  doc.text(fmt(item.unit_price),  COL_PRICE_X, rowY + 4, { width: COL_PRICE_W, align: 'right',  lineBreak: false })
  doc.font('Helvetica-Bold').fillColor(C_TEXT)
  doc.text(fmt(item.total_price), COL_AMT_X,   rowY + 4, { width: COL_AMT_W,   align: 'right',  lineBreak: false })

  Y += rowH
  divider(Y, '#f0f0f0', 0.3)
  Y += 4
})

Y += 14

// ── 6. TOTALS ──────────────────────────────────────────────────────────────
const TOT_LBL_X = CR - 260
const TOT_VAL_X = CR - COL_AMT_W
const TOT_VAL_W = COL_AMT_W

const totRow = (label, value, bold = false, color = C_MUTED) => {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(color)
  doc.text(label, TOT_LBL_X, Y, { lineBreak: false })
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? C_TEXT : color)
  doc.text(value, TOT_VAL_X, Y, { width: TOT_VAL_W, align: 'right', lineBreak: false })
  Y += bold ? 24 : 18
}

totRow('Subtotal', fmt(order.subtotal_amount))
if (order.discount_amount > 0) totRow('Discount', `-${fmt(order.discount_amount)}`, false, '#dc2626')
if (order.tax_amount > 0)      totRow('Tax',      fmt(order.tax_amount))
if (order.shipping_amount > 0) totRow('Shipping', fmt(order.shipping_amount))

doc.moveTo(TOT_LBL_X, Y - 2).lineTo(CR, Y - 2).strokeColor(C_BORDER).lineWidth(0.5).stroke()
Y += 8
totRow('Total', fmt(order.total_amount), true)

Y += 14

// ── 7. TERMS ───────────────────────────────────────────────────────────────
divider(Y)
Y += 16
doc.font('Helvetica-Bold').fontSize(8).fillColor(C_MUTED)
doc.text('TERMS & NOTES', CX, Y, { characterSpacing: 0.5, lineBreak: false })
Y += 13
doc.font('Helvetica').fontSize(9).fillColor(C_MUTED)
doc.text('Goods once sold will be exchanged or serviced only as per store policy.', CX, Y, { width: CW, lineGap: 2 })

// ── 8. FOOTER ──────────────────────────────────────────────────────────────
const FOOTER_Y = CARD_Y + CARD_H - 36
doc.moveTo(CARD_X, FOOTER_Y).lineTo(CARD_X + CARD_W, FOOTER_Y).strokeColor(C_BORDER).lineWidth(0.4).stroke()
doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
doc.text(`Thank you for shopping with ${settings.store_name}.`, CX, FOOTER_Y + 11, { width: CW * 0.55, lineBreak: false })

// Small logo in footer
if (HAS_LOGO) {
  try { doc.image(LOGO_PATH, CR - 110, FOOTER_Y + 6, { width: 18 }) } catch(e) { /* ignore */ }
}
doc.text(`Powered by ${settings.store_name}`, CR - 88, FOOTER_Y + 11, { width: 88, align: 'right', lineBreak: false })

doc.end()
console.log('✅  PDF saved to:', outPath)
