type MailContext = {
    storeName: string
    replyTo?: string | null
}

type WelcomeEmailPayload = MailContext & {
    to: string
    customerName: string
}

type OrderThankYouPayload = MailContext & {
    to: string
    customerName: string
    orderNumber?: number | string | null
    grandTotal: number
    currency?: string | null
    invoiceUrl?: string | null
}

function getResendConfig() {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail =
        process.env.CUSTOMER_EMAIL_FROM ||
        process.env.PAYMENT_REQUEST_FROM_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        null

    if (!apiKey || !fromEmail) {
        return null
    }

    return { apiKey, fromEmail }
}

function getAdminSiteUrl() {
    const siteUrl =
        process.env.ERP_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.VERCEL_URL

    if (!siteUrl) {
        return null
    }

    const normalized = siteUrl.replace(/\/$/, '')
    return normalized.startsWith('http') ? normalized : `https://${normalized}`
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function formatCurrency(amount: number, currency = 'INR') {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount)
    } catch {
        return `₹${amount.toFixed(2)}`
    }
}

async function sendResendEmail({
    to,
    subject,
    html,
    text,
    storeName,
    replyTo,
}: {
    to: string
    subject: string
    html: string
    text: string
    storeName: string
    replyTo?: string | null
}) {
    const config = getResendConfig()
    if (!config) {
        return { sent: false as const, reason: 'missing-config' }
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${storeName} <${config.fromEmail}>`,
            to: [to],
            reply_to: replyTo || undefined,
            subject,
            html,
            text,
        }),
    })

    const result = await response.json() as { id?: string; message?: string }
    if (!response.ok) {
        throw new Error(result.message || 'Resend email send failed.')
    }

    return {
        sent: true as const,
        deliveryId: result.id || null,
    }
}

function buildWelcomeHtml({ customerName, storeName }: WelcomeEmailPayload) {
    return `
      <div style="background:#f7f4ef;padding:40px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#111827;padding:28px 32px;color:#f9fafb;">
            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.8;">${escapeHtml(storeName)}</div>
            <h1 style="margin:12px 0 0;font-size:32px;line-height:1.2;">Welcome to Cluster Fascination</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(customerName)},</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
              Welcome to Cluster Fascination. We are excited to share our trending products, fresh collections, and standout jewellery picks with you.
            </p>
            <p style="margin:0;font-size:16px;line-height:1.7;">
              We look forward to making every shopping experience with us smooth, stylish, and memorable.
            </p>
          </div>
        </div>
      </div>
    `
}

function buildThankYouHtml({ customerName, storeName, orderNumber, grandTotal, currency, invoiceUrl }: OrderThankYouPayload) {
    const orderLabel = orderNumber ? `#${orderNumber}` : 'your recent order'
    const invoiceBlock = invoiceUrl
        ? `
            <p style="margin:24px 0 0;">
              <a href="${invoiceUrl}" style="display:inline-block;padding:14px 22px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">
                View Invoice
              </a>
            </p>
          `
        : ''

    return `
      <div style="background:#fffaf3;padding:40px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #f3e8d8;">
          <div style="background:#f5e9d6;padding:28px 32px;color:#111827;">
            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.8;">${escapeHtml(storeName)}</div>
            <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">Thank you for shopping with us</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(customerName)},</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
              Your purchase for ${escapeHtml(orderLabel)} was completed successfully. We appreciate you choosing Cluster Fascination.
            </p>
            <div style="padding:18px 20px;background:#f9fafb;border-radius:18px;border:1px solid #e5e7eb;">
              <p style="margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;">Order Total</p>
              <p style="margin:0;font-size:26px;font-weight:700;color:#111827;">${escapeHtml(formatCurrency(grandTotal, currency || 'INR'))}</p>
            </div>
            <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#4b5563;">
              We hope you love your new picks. Keep an eye on our trending products for your next favourite piece.
            </p>
            ${invoiceBlock}
          </div>
        </div>
      </div>
    `
}

export function buildOrderInvoiceUrl(orderId: string) {
    const siteUrl = getAdminSiteUrl()
    return siteUrl ? `${siteUrl}/admin/orders/${orderId}/invoice` : null
}

export async function sendCustomerWelcomeEmail(payload: WelcomeEmailPayload) {
    return sendResendEmail({
        to: payload.to,
        subject: `Welcome to ${payload.storeName}`,
        html: buildWelcomeHtml(payload),
        text: `Hi ${payload.customerName}, welcome to Cluster Fascination. Explore our trending products and enjoy shopping with us.`,
        storeName: payload.storeName,
        replyTo: payload.replyTo,
    })
}

export async function sendPosOrderThankYouEmail(payload: OrderThankYouPayload) {
    const orderLabel = payload.orderNumber ? `#${payload.orderNumber}` : 'your recent order'
    const invoiceLine = payload.invoiceUrl ? ` View invoice: ${payload.invoiceUrl}` : ''

    return sendResendEmail({
        to: payload.to,
        subject: `Thank you for shopping with ${payload.storeName}`,
        html: buildThankYouHtml(payload),
        text: `Hi ${payload.customerName}, your purchase for ${orderLabel} was completed successfully. Total: ${formatCurrency(payload.grandTotal, payload.currency || 'INR')}.${invoiceLine}`,
        storeName: payload.storeName,
        replyTo: payload.replyTo,
    })
}
