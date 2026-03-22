export type InvoiceLayout = 'modern' | 'classic' | 'minimal'

export type InvoiceTemplateSettings = {
    layout: InvoiceLayout
    accentColor: string
    surfaceColor: string
    headerLabel: string
    heroTitle: string
    heroMessage: string
    footerNote: string
    termsTitle: string
    termsBody: string
    showPaymentStatus: boolean
    showCustomerType: boolean
    showNotes: boolean
}

export const defaultInvoiceTemplate: InvoiceTemplateSettings = {
    layout: 'modern',
    accentColor: '#111827',
    surfaceColor: '#f5f1ea',
    headerLabel: 'Order Invoice',
    heroTitle: 'Thanks for shopping with us',
    heroMessage: 'Welcome to Cluster Fascination. Discover our trending products and enjoy every purchase.',
    footerNote: 'Thank you for shopping with Cluster Fascination.',
    termsTitle: 'Terms & Notes',
    termsBody: 'Goods once sold will be exchanged or serviced only as per store policy.',
    showPaymentStatus: true,
    showCustomerType: true,
    showNotes: true,
}

function normalizeText(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback
}

function normalizeColor(value: unknown, fallback: string) {
    if (typeof value !== 'string') {
        return fallback
    }

    const normalized = value.trim()
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : fallback
}

export function normalizeInvoiceTemplate(value: unknown): InvoiceTemplateSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...defaultInvoiceTemplate }
    }

    const record = value as Record<string, unknown>
    const layout = record.layout === 'classic' || record.layout === 'minimal' || record.layout === 'modern'
        ? record.layout
        : defaultInvoiceTemplate.layout

    return {
        layout,
        accentColor: normalizeColor(record.accentColor, defaultInvoiceTemplate.accentColor),
        surfaceColor: normalizeColor(record.surfaceColor, defaultInvoiceTemplate.surfaceColor),
        headerLabel: normalizeText(record.headerLabel, defaultInvoiceTemplate.headerLabel),
        heroTitle: normalizeText(record.heroTitle, defaultInvoiceTemplate.heroTitle),
        heroMessage: normalizeText(record.heroMessage, defaultInvoiceTemplate.heroMessage),
        footerNote: normalizeText(record.footerNote, defaultInvoiceTemplate.footerNote),
        termsTitle: normalizeText(record.termsTitle, defaultInvoiceTemplate.termsTitle),
        termsBody: normalizeText(record.termsBody, defaultInvoiceTemplate.termsBody),
        showPaymentStatus: normalizeBoolean(record.showPaymentStatus, defaultInvoiceTemplate.showPaymentStatus),
        showCustomerType: normalizeBoolean(record.showCustomerType, defaultInvoiceTemplate.showCustomerType),
        showNotes: normalizeBoolean(record.showNotes, defaultInvoiceTemplate.showNotes),
    }
}
