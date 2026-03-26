type EmailPayload = {
    to: string
    paymentUrl: string
    orderNumber: number | null
    storeName: string
    replyTo?: string | null
}

type SmsPayload = {
    to: string
    paymentUrl: string
    orderNumber: number | null
    storeName: string
}

function getResendConfig() {
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail =
        process.env.PAYMENT_REQUEST_FROM_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        'onboarding@resend.dev'

    if (!apiKey) {
        return { error: 'RESEND_API_KEY is not configured.' }
    }

    return { apiKey, fromEmail }
}

function getTwilioConfig() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_SMS_FROM || null
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || null

    if (!accountSid || !authToken) {
        return { error: 'Twilio credentials are not configured.' }
    }

    if (!fromNumber && !messagingServiceSid) {
        return { error: 'TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID must be configured.' }
    }

    return {
        accountSid,
        authToken,
        fromNumber,
        messagingServiceSid,
    }
}

function buildEmailHtml({ paymentUrl, orderNumber, storeName }: EmailPayload) {
    const orderLabel = orderNumber ? `#${orderNumber}` : 'your order'

    return `
      <div style="background:#0b0b0b;padding:40px 20px;font-family:Georgia,serif;color:#f5f1ea;">
        <div style="max-width:560px;margin:0 auto;background:#151515;border:1px solid #2a2a2a;padding:40px;">
          <div style="font-size:18px;letter-spacing:6px;text-align:center;padding-bottom:24px;">${storeName}</div>
          <h1 style="font-size:34px;line-height:1.2;margin:0 0 16px;">Complete your payment</h1>
          <p style="font-size:16px;line-height:1.7;color:#c7c1b8;margin:0 0 28px;">
            Your preorder is ready. Use the secure link below to complete payment for ${orderLabel}.
          </p>
          <p style="margin:0 0 28px;">
            <a href="${paymentUrl}" style="display:inline-block;padding:14px 24px;background:#c9a96e;color:#0b0b0b;text-decoration:none;font-weight:700;letter-spacing:1px;">
              Pay Now
            </a>
          </p>
          <p style="font-size:14px;line-height:1.7;color:#8f887d;margin:0;">
            If the button does not open, copy this link:
          </p>
          <p style="font-size:14px;line-height:1.7;color:#c9a96e;word-break:break-all;margin:8px 0 0;">
            ${paymentUrl}
          </p>
        </div>
      </div>
    `
}

export async function sendPaymentRequestEmail(payload: EmailPayload) {
    const cfg = getResendConfig()
    if ('error' in cfg) {
        throw new Error(cfg.error)
    }
    const { apiKey, fromEmail } = cfg
    const orderLabel = payload.orderNumber ? `#${payload.orderNumber}` : 'your order'

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${payload.storeName} <${fromEmail}>`,
            to: [payload.to],
            reply_to: payload.replyTo || undefined,
            subject: `Complete payment for ${orderLabel}`,
            html: buildEmailHtml(payload),
            text: `Complete payment for ${orderLabel}: ${payload.paymentUrl}`,
        }),
    })

    const result = await response.json() as { id?: string; message?: string }
    if (!response.ok) {
        throw new Error(result.message || 'Resend email send failed.')
    }

    return {
        provider: 'resend',
        deliveryId: result.id || null,
    }
}

export async function sendPaymentRequestSms(payload: SmsPayload) {
    const cfg = getTwilioConfig()
    if ('error' in cfg) {
        throw new Error(cfg.error)
    }
    const { accountSid, authToken, fromNumber, messagingServiceSid } = cfg
    const orderLabel = payload.orderNumber ? `#${payload.orderNumber}` : 'your order'
    const body = `${payload.storeName}: complete payment for ${orderLabel} using this secure link ${payload.paymentUrl}`

    const params = new URLSearchParams({
        To: payload.to,
        Body: body,
    })

    if (messagingServiceSid) {
        params.set('MessagingServiceSid', messagingServiceSid)
    } else if (fromNumber) {
        params.set('From', fromNumber)
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    })

    const result = await response.json() as { sid?: string; message?: string }
    if (!response.ok) {
        throw new Error(result.message || 'Twilio SMS send failed.')
    }

    return {
        provider: 'twilio',
        deliveryId: result.sid || null,
    }
}
