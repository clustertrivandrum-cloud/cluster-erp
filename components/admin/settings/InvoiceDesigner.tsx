'use client'

import type { InvoiceTemplateSettings } from '@/lib/invoice-template'

type InvoiceDesignerProps = {
    value: InvoiceTemplateSettings
    onChange: (value: InvoiceTemplateSettings) => void
}

function updateField<K extends keyof InvoiceTemplateSettings>(
    current: InvoiceTemplateSettings,
    key: K,
    value: InvoiceTemplateSettings[K]
) {
    return { ...current, [key]: value }
}

export default function InvoiceDesigner({ value, onChange }: InvoiceDesignerProps) {
    const sampleAccent = { backgroundColor: value.accentColor }
    const sampleSurface = { backgroundColor: value.surfaceColor }

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
                <h3 className="text-lg font-medium text-gray-900">Invoice Designer</h3>
                <p className="mt-1 text-sm text-gray-500">Control how printed and PDF invoices look in the admin panel.</p>
            </div>

            <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Layout</label>
                            <select
                                value={value.layout}
                                onChange={(event) => onChange(updateField(value, 'layout', event.target.value as InvoiceTemplateSettings['layout']))}
                                className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                            >
                                <option value="modern">Modern</option>
                                <option value="classic">Classic</option>
                                <option value="minimal">Minimal</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Header Label</label>
                            <input
                                value={value.headerLabel}
                                onChange={(event) => onChange(updateField(value, 'headerLabel', event.target.value))}
                                className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                placeholder="Order Invoice"
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Accent Color</label>
                            <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 py-2.5">
                                <input
                                    type="color"
                                    value={value.accentColor}
                                    onChange={(event) => onChange(updateField(value, 'accentColor', event.target.value))}
                                    className="h-10 w-14 rounded border border-gray-200 bg-white"
                                />
                                <span className="text-sm font-medium text-gray-600">{value.accentColor}</span>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Surface Color</label>
                            <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 py-2.5">
                                <input
                                    type="color"
                                    value={value.surfaceColor}
                                    onChange={(event) => onChange(updateField(value, 'surfaceColor', event.target.value))}
                                    className="h-10 w-14 rounded border border-gray-200 bg-white"
                                />
                                <span className="text-sm font-medium text-gray-600">{value.surfaceColor}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Hero Title</label>
                        <input
                            value={value.heroTitle}
                            onChange={(event) => onChange(updateField(value, 'heroTitle', event.target.value))}
                            className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                            placeholder="Thanks for shopping with us"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Hero Message</label>
                        <textarea
                            rows={3}
                            value={value.heroMessage}
                            onChange={(event) => onChange(updateField(value, 'heroMessage', event.target.value))}
                            className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                            placeholder="Add the opening message shown on the invoice."
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Terms Title</label>
                            <input
                                value={value.termsTitle}
                                onChange={(event) => onChange(updateField(value, 'termsTitle', event.target.value))}
                                className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                placeholder="Terms & Notes"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Footer Note</label>
                            <input
                                value={value.footerNote}
                                onChange={(event) => onChange(updateField(value, 'footerNote', event.target.value))}
                                className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                placeholder="Thank you for shopping with Cluster Fascination."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Terms Body</label>
                        <textarea
                            rows={3}
                            value={value.termsBody}
                            onChange={(event) => onChange(updateField(value, 'termsBody', event.target.value))}
                            className="block w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                            placeholder="Add invoice notes, service policy, or other terms."
                        />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
                            <input
                                type="checkbox"
                                checked={value.showPaymentStatus}
                                onChange={(event) => onChange(updateField(value, 'showPaymentStatus', event.target.checked))}
                                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            Show payment status
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
                            <input
                                type="checkbox"
                                checked={value.showCustomerType}
                                onChange={(event) => onChange(updateField(value, 'showCustomerType', event.target.checked))}
                                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            Show customer type
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
                            <input
                                type="checkbox"
                                checked={value.showNotes}
                                onChange={(event) => onChange(updateField(value, 'showNotes', event.target.checked))}
                                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                            />
                            Show order notes
                        </label>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Live Preview</h4>
                        <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500">
                            {value.layout}
                        </div>
                    </div>

                    <div className={`overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm ${value.layout === 'minimal' ? 'p-6' : ''}`}>
                        <div
                            className={`p-6 text-white ${value.layout === 'classic' ? 'border-b border-gray-200' : ''}`}
                            style={value.layout === 'minimal' ? undefined : sampleAccent}
                        >
                            <p className={`text-xs uppercase tracking-[0.3em] ${value.layout === 'minimal' ? 'text-gray-500' : 'text-white/70'}`}>
                                {value.headerLabel}
                            </p>
                            <div className={`mt-4 ${value.layout === 'classic' ? 'grid gap-4 md:grid-cols-[1fr_auto]' : 'grid gap-4 md:grid-cols-[1fr_auto]'}`}>
                                <div className={value.layout === 'minimal' ? 'text-gray-900' : ''}>
                                    <h5 className="text-2xl font-black">{value.heroTitle}</h5>
                                    <p className={`mt-2 max-w-md text-sm leading-6 ${value.layout === 'minimal' ? 'text-gray-600' : 'text-white/80'}`}>
                                        {value.heroMessage}
                                    </p>
                                </div>
                                <div className={`rounded-2xl px-4 py-3 ${value.layout === 'minimal' ? 'border border-gray-200 bg-gray-50 text-gray-900' : 'bg-white/10 text-white backdrop-blur'}`}>
                                    <p className={`text-xs uppercase tracking-[0.2em] ${value.layout === 'minimal' ? 'text-gray-500' : 'text-white/70'}`}>Invoice</p>
                                    <p className="mt-2 text-xl font-black">#1042</p>
                                    {value.showPaymentStatus && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em]">Paid</p>}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 p-6 md:grid-cols-2">
                            <div className="rounded-2xl border border-gray-200 p-4" style={sampleSurface}>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Bill To</p>
                                <p className="mt-2 text-lg font-bold text-gray-900">Ananya Joseph</p>
                                <p className="text-sm text-gray-600">ananya@example.com</p>
                                <p className="text-sm text-gray-600">+91 98765 43210</p>
                                {value.showCustomerType && <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Registered Customer</p>}
                            </div>
                            <div className="rounded-2xl border border-gray-200 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Summary</p>
                                <div className="mt-3 space-y-2 text-sm text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span>Subtotal</span>
                                        <span className="font-semibold">₹1,299.00</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Tax</span>
                                        <span className="font-semibold">₹233.82</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                                        <span>Total</span>
                                        <span>₹1,532.82</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-6">
                            <div className="overflow-hidden rounded-2xl border border-gray-200">
                                <div className="grid grid-cols-[1.5fr_0.8fr_0.4fr_0.8fr] gap-3 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500" style={sampleSurface}>
                                    <span>Item</span>
                                    <span>Price</span>
                                    <span>Qty</span>
                                    <span className="text-right">Total</span>
                                </div>
                                <div className="grid grid-cols-[1.5fr_0.8fr_0.4fr_0.8fr] gap-3 px-4 py-4 text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Gold Plated Anti-Tarnish Ring</span>
                                    <span>₹699.00</span>
                                    <span>2</span>
                                    <span className="text-right font-semibold text-gray-900">₹1,398.00</span>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{value.termsTitle}</p>
                                <p className="mt-2 text-sm leading-6 text-gray-600">{value.termsBody}</p>
                            </div>

                            {value.showNotes && (
                                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                                    Sample order note: Packed and handed over at the billing counter.
                                </div>
                            )}

                            <div className="mt-4 text-center text-sm text-gray-500">
                                {value.footerNote}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
