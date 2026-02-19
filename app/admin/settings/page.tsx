'use client'

import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '@/lib/actions/settings-actions'
import Input from '@/components/ui/Input' // Assuming we have this reusable component
import { Save, Store } from 'lucide-react'

// Simple Textarea if not already in UI library
function Textarea({ label, name, value, onChange, rows = 3 }: any) {
    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <textarea
                name={name}
                rows={rows}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                value={value}
                onChange={onChange}
            />
        </div>
    )
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState<any>({
        store_name: '',
        store_email: '',
        store_phone: '',
        store_address: '',
        store_currency: 'INR',
        tax_rate: 18,
        gstin: ''
    })

    useEffect(() => {
        getSettings().then(data => {
            if (data) setSettings(data)
            setLoading(false)
        })
    }, [])

    const handleChange = (e: any) => {
        const { name, value } = e.target
        setSettings((prev: any) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async () => {
        setSaving(true)
        const fd = new FormData()
        Object.keys(settings).forEach(key => {
            fd.append(key, settings[key] || '')
        })

        const res = await updateSettings(fd)
        if (res.success) {
            alert("Settings saved!")
        } else {
            alert(res.error)
        }
        setSaving(false)
    }

    if (loading) return <div className="p-10 text-center">Loading settings...</div>

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="flex items-center mb-8">
                <div className="bg-indigo-600 p-2 rounded-lg mr-4">
                    <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Store Settings</h1>
                    <p className="text-sm text-gray-500">Configure your company details, tax settings, and invoice preferences.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 md:p-8 space-y-6">
                    {/* General Info */}
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">General Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Store Name" name="store_name" value={settings.store_name} onChange={handleChange} placeholder="e.g. My Jewellery Shop" />
                            <Input label="Support Email" name="store_email" value={settings.store_email} onChange={handleChange} placeholder="support@example.com" />
                            <Input label="Support Phone" name="store_phone" value={settings.store_phone} onChange={handleChange} placeholder="+91 98765 43210" />
                            <Input label="Currency" name="store_currency" value={settings.store_currency} onChange={handleChange} />
                        </div>
                        <div className="mt-4">
                            <Textarea label="Store Address" name="store_address" value={settings.store_address} onChange={handleChange} />
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Tax & Legal */}
                    <div>
                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Tax & Legal</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="GSTIN / Tax ID" name="gstin" value={settings.gstin} onChange={handleChange} placeholder="22AAAAA0000A1Z5" />
                            <Input label="Default Tax Rate (%)" name="tax_rate" type="number" value={settings.tax_rate} onChange={handleChange} />
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
