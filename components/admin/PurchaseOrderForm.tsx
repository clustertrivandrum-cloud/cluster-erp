'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPurchaseOrder } from '@/lib/actions/purchase-order-actions'
import { getSuppliers } from '@/lib/actions/supplier-actions' // Assuming this exists
import { getProducts, searchVariants } from '@/lib/actions/product-actions' // Need to fetch variants
import { Search, Plus, Trash2, Save, ArrowLeft, Loader2 } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'

interface Variant {
    id: string
    title: string // Product Title + Variant Options
    sku: string
    cost_price: number
    product_images: string[]
}

interface OrderItem {
    variant_id: string
    title: string
    quantity: number
    unit_cost: number
    total_cost: number
}

export default function PurchaseOrderForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [suppliers, setSuppliers] = useState<any[]>([])

    // Form State
    const [supplierId, setSupplierId] = useState('')
    const [expectedDate, setExpectedDate] = useState('')
    const [notes, setNotes] = useState('')
    const [items, setItems] = useState<OrderItem[]>([])

    // Item Adding State
    const [isAddingItem, setIsAddingItem] = useState(false)
    const [variantSearch, setVariantSearch] = useState('')
    const [searchResults, setSearchResults] = useState<Variant[]>([])
    const [searchingVariants, setSearchingVariants] = useState(false)

    useEffect(() => {
        // Load suppliers
        getSuppliers().then(setSuppliers)
    }, [])

    useEffect(() => {
        // Debounce search variants
        const timer = setTimeout(() => {
            if (variantSearch.length > 1) {
                searchVariantsHandler(variantSearch)
            } else {
                setSearchResults([])
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [variantSearch])

    const searchVariantsHandler = async (query: string) => {
        setSearchingVariants(true)
        try {
            const results = await searchVariants(query)
            setSearchResults(results)
        } catch (error) {
            console.error("Search error:", error)
            setSearchResults([])
        }
        setSearchingVariants(false)
    }

    // Temporary mocked implementation until I add the server action
    const handleSearchVariantsMock = async () => {
        // This needs to be real. I will add `searchVariants` to `product-actions.ts` in standard step.
    }

    const addItem = (variant: Variant) => {
        const existing = items.find(i => i.variant_id === variant.id)
        if (existing) {
            alert("Item already added to order")
            return
        }

        setItems([...items, {
            variant_id: variant.id,
            title: variant.title,
            quantity: 1,
            unit_cost: variant.cost_price || 0,
            total_cost: variant.cost_price || 0
        }])
        setIsAddingItem(false)
        setVariantSearch('')
    }

    const updateItem = (index: number, field: keyof OrderItem, value: number) => {
        const newItems = [...items]
        const item = newItems[index]

        if (field === 'quantity') item.quantity = value
        if (field === 'unit_cost') item.unit_cost = value

        item.total_cost = item.quantity * item.unit_cost
        setItems(newItems)
    }

    const removeItem = (index: number) => {
        const newItems = [...items]
        newItems.splice(index, 1)
        setItems(newItems)
    }

    const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!supplierId) {
            alert("Please select a supplier")
            return
        }
        if (items.length === 0) {
            alert("Please add at least one item")
            return
        }

        setLoading(true)
        const formData = new FormData()
        formData.append('supplier_id', supplierId)
        formData.append('expected_date', expectedDate)
        formData.append('notes', notes)
        formData.append('items', JSON.stringify(items))

        const result = await createPurchaseOrder({}, formData)

        if (result.error) {
            alert(result.error)
            setLoading(false)
        } else {
            router.push('/admin/purchase-orders')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto pb-10">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <button type="button" onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Purchase Order</h1>
                        <p className="text-sm text-gray-500 mt-1">Order stock from your suppliers.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gray-900 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Order
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Order Infos */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-base font-semibold text-gray-900">Order Items</h3>
                            <button
                                type="button"
                                onClick={() => setIsAddingItem(true)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-gray-900 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Item
                            </button>
                        </div>

                        {/* Empty State / List */}
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <Search className="w-12 h-12 text-gray-300 mb-3" />
                                <h3 className="text-lg font-medium text-gray-900">No items added</h3>
                                <p className="text-gray-500 max-w-sm mt-1">Search and add products to this purchase order using the button above.</p>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingItem(true)}
                                    className="mt-6 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
                                >
                                    Add Products
                                </button>
                            </div>
                        ) : (
                            <div className="p-0">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Cost</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Total</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {items.map((item, index) => (
                                            <tr key={item.variant_id} className="group hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                                    {item.title}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="w-full text-right bg-transparent border-none p-0 focus:ring-0 text-sm text-gray-900 placeholder:text-gray-400"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="relative">
                                                        <span className="absolute left-0 top-0 text-gray-400">₹</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.unit_cost}
                                                            onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                            className="w-full text-right bg-transparent border-none p-0 pl-4 focus:ring-0 text-sm text-gray-900 placeholder:text-gray-400"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium">
                                                    ₹{item.total_cost.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 border-t border-gray-200">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total Amount</td>
                                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">₹{totalAmount.toFixed(2)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Supplier & Settings */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-3">Supplier Details</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                            <select
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm text-gray-900"
                                value={supplierId}
                                onChange={(e) => setSupplierId(e.target.value)}
                            >
                                <option value="">Select Supplier</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} {s.contact_person ? `(${s.contact_person})` : ''}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-900 hover:text-black cursor-pointer text-right">
                                <a href="/admin/suppliers/new" target="_blank">+ Create New Supplier</a>
                            </p>
                        </div>

                        <Input
                            label="Expected Date"
                            type="date"
                            value={expectedDate}
                            onChange={(e) => setExpectedDate(e.target.value)}
                        />

                        <Textarea
                            label="Notes"
                            rows={3}
                            placeholder="Invoice #, Delivery instructions..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Item Search Modal */}
            {isAddingItem && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <Search className="w-5 h-5 text-gray-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search products..."
                                className="flex-1 border-none focus:ring-0 text-lg placeholder-gray-400 text-gray-900"
                                value={variantSearch}
                                onChange={(e) => setVariantSearch(e.target.value)}
                            />
                            <button onClick={() => setIsAddingItem(false)} className="text-gray-400 hover:text-gray-600">
                                <Trash2 className="w-5 h-5 rotate-45" /> {/* Use X icon ideally, reusing Trash for now or import X */}
                            </button>
                        </div>
                        <div className="overflow-y-auto p-2">
                            {searchingVariants ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Searching...
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="space-y-1">
                                    {searchResults.map(variant => (
                                        <button
                                            key={variant.id}
                                            onClick={() => addItem(variant)}
                                            className="w-full text-left p-3 hover:bg-gray-50 rounded-lg flex items-center justify-between group transition-colors"
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900">{variant.title}</div>
                                                <div className="text-xs text-gray-500">SKU: {variant.sku}</div>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900">
                                                Cost: ₹{variant.cost_price}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : variantSearch.length > 1 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No products found.
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    Type to search products
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </form>
    )
}
