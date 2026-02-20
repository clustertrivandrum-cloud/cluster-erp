'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCustomers, createCustomer, createOrder } from '@/lib/actions/order-actions'
import { searchVariants } from '@/lib/actions/product-actions'
import { Plus, Search, Trash2, ArrowLeft, UserPlus, Check } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

export default function NewOrderPage() {
    const router = useRouter()

    // Logic: 
    // 1. Select Customer (Search existing or Quick Create)
    // 2. Add Items (Search products)
    // 3. Review & Submit

    // State
    const [customers, setCustomers] = useState<any[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [customerSearch, setCustomerSearch] = useState('')

    // New Customer Inline
    const [showNewCustomer, setShowNewCustomer] = useState(false)
    const [newCustomerForm, setNewCustomerForm] = useState({ first_name: '', last_name: '', phone: '' })

    // Items
    const [lineItems, setLineItems] = useState<any[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])

    // Order Details
    const [paymentStatus, setPaymentStatus] = useState('paid') // Default to paid for manual orders typically?

    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        getCustomers().then(setCustomers)
    }, [])

    // --- Customer Logic ---
    const filteredCustomers = customers.filter(c =>
        (c.first_name + ' ' + c.last_name).toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.includes(customerSearch)
    )

    const handleCreateCustomer = async () => {
        if (!newCustomerForm.first_name || !newCustomerForm.phone) return alert("Name and Phone required")

        const fd = new FormData()
        fd.append('first_name', newCustomerForm.first_name)
        fd.append('last_name', newCustomerForm.last_name)
        fd.append('phone', newCustomerForm.phone)

        const res = await createCustomer(fd)
        if (res.customer) {
            setCustomers([res.customer, ...customers])
            setSelectedCustomer(res.customer.id)
            setShowNewCustomer(false)
            setNewCustomerForm({ first_name: '', last_name: '', phone: '' })
        }
    }

    // --- Product Logic --- 
    useEffect(() => {
        if (productSearch.length > 2) {
            searchVariants(productSearch).then(setSearchResults)
        } else {
            setSearchResults([])
        }
    }, [productSearch])

    const addItem = (variant: any) => {
        const existing = lineItems.find(i => i.variant_id === variant.id)
        if (existing) return; // Prevent dupes for now

        setLineItems([...lineItems, {
            variant_id: variant.id,
            title: variant.title,
            image: variant.product_images?.[0],
            sku: variant.sku,
            unit_price: variant.price || 0, // Sell Price
            quantity: 1
        }])
        setProductSearch('')
        setSearchResults([])
    }

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...lineItems]
        newItems[index] = { ...newItems[index], [field]: value }
        setLineItems(newItems)
    }

    const removeItem = (index: number) => {
        const newItems = [...lineItems]
        newItems.splice(index, 1)
        setLineItems(newItems)
    }

    const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

    const handleSubmit = async () => {
        if (!selectedCustomer) return alert("Select a customer")
        if (lineItems.length === 0) return alert("Add items to order")

        setSubmitting(true)
        const res = await createOrder({
            customer_id: selectedCustomer,
            payment_status: paymentStatus,
            total_amount: totalAmount,
            items: lineItems
        })

        if (res.success) {
            router.push(`/admin/orders/${res.orderId}`)
        } else {
            alert(res.error)
            setSubmitting(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="flex items-center mb-8">
                <button onClick={() => router.back()} className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Manual Order</h1>
                    <p className="text-sm text-gray-500">Record an offline sale or phone order.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COL: Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Order Items</h3>

                        {/* Search */}
                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products to add..."
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder:text-gray-400"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                            />
                            {/* Dropdown Results */}
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {searchResults.map(result => (
                                        <div
                                            key={result.id}
                                            onClick={() => addItem(result)}
                                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center border-b border-gray-100 last:border-0"
                                        >
                                            {result.product_images?.[0] && (
                                                <img src={result.product_images[0]} className="w-8 h-8 object-cover rounded mr-3" />
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{result.title}</div>
                                                <div className="text-xs text-gray-500">SKU: {result.sku} • ₹{result.price || 0}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* List */}
                        {lineItems.length > 0 ? (
                            <div className="space-y-4">
                                {lineItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        {item.image ? (
                                            <img src={item.image} className="w-12 h-12 object-cover rounded-md" />
                                        ) : <div className="w-12 h-12 bg-gray-200 rounded-md"></div>}

                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</div>
                                            <div className="text-xs text-gray-500">{item.sku}</div>
                                        </div>

                                        <div className="w-20">
                                            <label className="text-xs text-gray-500">Price</label>
                                            <input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                                                className="block w-full text-sm border-gray-300 rounded focus:ring-gray-900 focus:border-gray-900 py-1 text-gray-900 placeholder:text-gray-400"
                                            />
                                        </div>

                                        <div className="w-16">
                                            <label className="text-xs text-gray-500">Qty</label>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))}
                                                className="block w-full text-sm border-gray-300 rounded focus:ring-gray-900 focus:border-gray-900 py-1 text-gray-900 placeholder:text-gray-400"
                                            />
                                        </div>

                                        <div className="w-20 text-right font-medium text-sm pt-4">
                                            ₹{item.quantity * item.unit_price}
                                        </div>

                                        <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 pt-4">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex justify-end pt-4 border-t border-gray-200">
                                    <div className="text-lg font-bold text-gray-900">Total: ₹{totalAmount}</div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8 text-sm">No items added yet.</p>
                        )}
                    </div>
                </div>

                {/* RIGHT COL: Customer & Payment */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Customer</h3>

                        {!showNewCustomer ? (
                            <>
                                <Select
                                    label="Select Customer"
                                    name="customer"
                                    value={selectedCustomer}
                                    onChange={e => setSelectedCustomer(e.target.value)}
                                >
                                    <option value="">-- Search or Select --</option>
                                    {filteredCustomers.map(c => (
                                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.phone})</option>
                                    ))}
                                </Select>

                                <div className="mt-4 text-center">
                                    <span className="text-xs text-gray-500">or </span>
                                    <button
                                        onClick={() => setShowNewCustomer(true)}
                                        className="text-gray-900 hover:text-black text-sm font-medium"
                                    >
                                        Create New Customer
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-900">New Customer</h4>
                                <Input label="First Name" value={newCustomerForm.first_name} onChange={e => setNewCustomerForm({ ...newCustomerForm, first_name: e.target.value })} />
                                <Input label="Last Name" value={newCustomerForm.last_name} onChange={e => setNewCustomerForm({ ...newCustomerForm, last_name: e.target.value })} />
                                <Input label="Phone" value={newCustomerForm.phone} onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })} />
                                <div className="flex gap-2 pt-2">
                                    <button onClick={handleCreateCustomer} className="flex-1 bg-gray-900 text-white py-1.5 rounded text-sm font-medium">Save</button>
                                    <button onClick={() => setShowNewCustomer(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-1.5 rounded text-sm">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Payment</h3>
                        <Select
                            label="Payment Status"
                            name="payment_status"
                            value={paymentStatus}
                            onChange={e => setPaymentStatus(e.target.value)}
                        >
                            <option value="unpaid">Unpaid (Cash on Delivery)</option>
                            <option value="paid">Paid (Cash / UPI)</option>
                        </Select>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-lg shadow-lg flex justify-center items-center disabled:opacity-70"
                    >
                        {submitting ? 'Creating...' : 'Create Order'}
                    </button>
                </div>
            </div>
        </div>
    )
}
