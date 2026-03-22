'use client'

import { useEffect, useState } from 'react'
import { Save, Store, Truck } from 'lucide-react'
import InvoiceDesigner from '@/components/admin/settings/InvoiceDesigner'
import Input from '@/components/ui/Input'
import { defaultInvoiceTemplate, normalizeInvoiceTemplate, type InvoiceTemplateSettings } from '@/lib/invoice-template'
import { getSettings, updateSettings } from '@/lib/actions/settings-actions'

type SettingsFormState = {
    store_name: string
    store_email: string
    store_phone: string
    store_address: string
    store_currency: string
    tax_rate: number | string
    gstin: string
    free_shipping_threshold: number | string
    kerala_shipping_charge: number | string
    other_states_shipping_charge: number | string
    invoice_template: InvoiceTemplateSettings
}

type TextareaProps = {
    label: string
    name: keyof SettingsFormState
    value: string
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
    rows?: number
}

function Textarea({ label, name, value, onChange, rows = 3 }: TextareaProps) {
    return (
        <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
            <textarea
                name={name}
                rows={rows}
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                value={value}
                onChange={onChange}
            />
        </div>
    )
}

const defaultSettings: SettingsFormState = {
    store_name: '',
    store_email: '',
    store_phone: '',
    store_address: '',
    store_currency: 'INR',
    tax_rate: 18,
    gstin: '',
    free_shipping_threshold: 799,
    kerala_shipping_charge: 49,
    other_states_shipping_charge: 59,
    invoice_template: defaultInvoiceTemplate,
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState<SettingsFormState>(defaultSettings)

    useEffect(() => {
        getSettings().then((data) => {
            if (data) {
                setSettings({
                    store_name: data.store_name || '',
                    store_email: data.store_email || '',
                    store_phone: data.store_phone || '',
                    store_address: data.store_address || '',
                    store_currency: data.store_currency || 'INR',
                    tax_rate: data.tax_rate || 0,
                    gstin: data.gstin || '',
                    free_shipping_threshold: data.free_shipping_threshold ?? 799,
                    kerala_shipping_charge: data.kerala_shipping_charge ?? 49,
                    other_states_shipping_charge: data.other_states_shipping_charge ?? 59,
                    invoice_template: normalizeInvoiceTemplate(data.invoice_template),
                })
            }
            setLoading(false)
        })
    }, [])

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target
        setSettings((prev) => ({ ...prev, [name]: value }))
    }

    const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = event.target
        setSettings((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async () => {
        setSaving(true)

        const fd = new FormData()
        Object.entries(settings).forEach(([key, value]) => {
            if (key === 'invoice_template') {
                fd.append(key, JSON.stringify(value))
                return
            }

            fd.append(key, String(value ?? ''))
        })

        const res = await updateSettings(fd)
        if (res.success) {
            alert('Settings saved!')
        } else {
            alert(res.error)
        }
        setSaving(false)
    }

    if (loading) return <div className="p-10 text-center">Loading settings...</div>

    return (
        <div className="mx-auto max-w-6xl pb-10">
            <div className="mb-8 flex items-center">
                <div className="mr-4 rounded-lg bg-gray-900 p-2">
                    <Store className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Store Settings</h1>
                    <p className="text-sm text-gray-500">Configure company details, tax settings, and ecommerce delivery rules.</p>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="space-y-6 p-6 md:p-8">
                    <div>
                        <h3 className="mb-4 text-lg font-medium leading-6 text-gray-900">General Information</h3>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Input label="Store Name" name="store_name" value={settings.store_name} onChange={handleInputChange} placeholder="e.g. My Jewellery Shop" />
                            <Input label="Support Email" name="store_email" value={settings.store_email} onChange={handleInputChange} placeholder="support@example.com" />
                            <Input label="Support Phone" name="store_phone" value={settings.store_phone} onChange={handleInputChange} placeholder="+91 98765 43210" />
                            <Input label="Currency" name="store_currency" value={settings.store_currency} onChange={handleInputChange} />
                        </div>
                        <div className="mt-4">
                            <Textarea label="Store Address" name="store_address" value={settings.store_address} onChange={handleTextareaChange} />
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    <div>
                        <h3 className="mb-4 text-lg font-medium leading-6 text-gray-900">Tax & Legal</h3>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <Input label="GSTIN / Tax ID" name="gstin" value={settings.gstin} onChange={handleInputChange} placeholder="22AAAAA0000A1Z5" />
                            <Input label="Default Tax Rate (%)" name="tax_rate" type="number" value={settings.tax_rate} onChange={handleInputChange} />
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    <div>
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-lg bg-gray-100 p-2">
                                <Truck className="h-5 w-5 text-gray-700" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium leading-6 text-gray-900">Delivery Rules</h3>
                                <p className="text-sm text-gray-500">These values are used by the ecommerce checkout to calculate delivery charges.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <Input
                                label="Free Delivery Threshold"
                                name="free_shipping_threshold"
                                type="number"
                                value={settings.free_shipping_threshold}
                                onChange={handleInputChange}
                                helperText="Orders at or above this amount ship free."
                            />
                            <Input
                                label="Kerala Delivery Charge"
                                name="kerala_shipping_charge"
                                type="number"
                                value={settings.kerala_shipping_charge}
                                onChange={handleInputChange}
                                helperText="Applied below the free-delivery threshold."
                            />
                            <Input
                                label="Other States Delivery Charge"
                                name="other_states_shipping_charge"
                                type="number"
                                value={settings.other_states_shipping_charge}
                                onChange={handleInputChange}
                                helperText="Applied below the free-delivery threshold."
                            />
                        </div>
                    </div>
                </div>
                <div className="px-6 pb-8 md:px-8">
                    <InvoiceDesigner
                        value={settings.invoice_template}
                        onChange={(invoiceTemplate) => setSettings((prev) => ({ ...prev, invoice_template: invoiceTemplate }))}
                    />
                </div>
                <div className="flex justify-end bg-gray-50 px-6 py-4">
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center rounded-md border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
