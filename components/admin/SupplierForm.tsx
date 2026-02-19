'use client'

import { useState } from 'react'
import { createSupplier, updateSupplier } from '@/lib/actions/supplier-actions'
import { X } from 'lucide-react'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'

interface Supplier {
    id: string
    name: string
    contact_person: string | null
    email: string | null
    phone: string | null
    address: string | null
    tax_id: string | null
}

interface SupplierFormProps {
    supplier?: Supplier | null
    onClose: () => void
    onSuccess: () => void
}

export default function SupplierForm({ supplier, onClose, onSuccess }: SupplierFormProps) {
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)

        let result
        if (supplier) {
            result = await updateSupplier(supplier.id, formData)
        } else {
            result = await createSupplier(formData)
        }

        setLoading(false)

        if (result?.error) {
            alert(result.error)
        } else {
            onSuccess()
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">
                        {supplier ? 'Edit Supplier' : 'Add New Supplier'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    <Input
                        label="Company Name"
                        name="name"
                        required
                        type="text"
                        defaultValue={supplier?.name}
                        placeholder="e.g. Acme Supplies Ltd."
                    />

                    <Input
                        label="Contact Person"
                        name="contact_person"
                        type="text"
                        defaultValue={supplier?.contact_person || ''}
                        placeholder="e.g. John Doe"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Email"
                            name="email"
                            type="email"
                            defaultValue={supplier?.email || ''}
                            placeholder="contact@acme.com"
                        />
                        <Input
                            label="Phone"
                            name="phone"
                            type="tel"
                            defaultValue={supplier?.phone || ''}
                            placeholder="+1 (555) 000-0000"
                        />
                    </div>

                    <Input
                        label="GSTIN (Tax ID)"
                        name="tax_id"
                        type="text"
                        defaultValue={supplier?.tax_id || ''}
                        placeholder="e.g. 29ABCDE1234F1Z5"
                    />

                    <Textarea
                        label="Address"
                        name="address"
                        rows={3}
                        defaultValue={supplier?.address || ''}
                        placeholder="Full billing address..."
                    />

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-all shadow-sm disabled:opacity-70"
                        >
                            {loading ? 'Saving...' : 'Save Supplier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
