'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getCustomers, createCustomer, createOrder } from '@/lib/actions/order-actions'
import { searchVariants } from '@/lib/actions/product-actions'
import { Search, Trash2, ArrowLeft } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

type CustomerOption = {
    id: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
}

type SearchVariantResult = {
    id: string
    title: string
    sku?: string | null
    price?: number | null
    product_images?: string[]
}

type LineItem = {
    variant_id: string
    title: string
    image?: string
    sku?: string | null
    unit_price: number
    quantity: number
}

export default function NewOrderClient({ initialCustomers }: { initialCustomers: CustomerOption[] }) {
    const router = useRouter()
    const [customers, setCustomers] = useState<CustomerOption[]>(initialCustomers)
    const [customerQuery, setCustomerQuery] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [showNewCustomer, setShowNewCustomer] = useState(false)
    const [newCustomerForm, setNewCustomerForm] = useState({ first_name: '', last_name: '', email: '', phone: '' })
    const [customerContact, setCustomerContact] = useState({ full_name: '', email: '', phone: '' })

    const [lineItems, setLineItems] = useState<LineItem[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [searchResults, setSearchResults] = useState<SearchVariantResult[]>([])
    const [paymentStatus, setPaymentStatus] = useState('paid')
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; message: string } | null>(null)
    const deferredProductSearch = useDeferredValue(productSearch)
    const deferredCustomerQuery = useDeferredValue(customerQuery)

    useEffect(() => {
        let cancelled = false

        const loadProducts = async () => {
            if (deferredProductSearch.length > 2) {
                const results = await searchVariants(deferredProductSearch)
                if (!cancelled) {
                    setSearchResults(results)
                }
            } else if (!cancelled) {
                setSearchResults([])
            }
        }

        loadProducts()

        return () => {
            cancelled = true
        }
    }, [deferredProductSearch])

    useEffect(() => {
        let cancelled = false

        const loadCustomers = async () => {
            const query = deferredCustomerQuery.trim()
            if (!query) {
                setCustomers(initialCustomers)
                return
            }

            const result = await getCustomers({ query, page: 1, limit: 20 })
            if (!cancelled) {
                setCustomers(result.data || [])
            }
        }

        loadCustomers()

        return () => {
            cancelled = true
        }
    }, [deferredCustomerQuery, initialCustomers])

    const applySelectedCustomer = (customerId: string) => {
        setSelectedCustomer(customerId)
        const selected = customers.find((customer) => customer.id === customerId)
            ?? initialCustomers.find((customer) => customer.id === customerId)

        if (!selected) {
            return
        }

        setCustomerContact({
            full_name: [selected.first_name, selected.last_name].filter(Boolean).join(' ').trim(),
            email: selected.email || '',
            phone: selected.phone || '',
        })
    }

    const handleCreateCustomer = async () => {
        if (!newCustomerForm.first_name || !newCustomerForm.email || !newCustomerForm.phone) {
            setFeedback({ tone: 'error', message: 'Name, email, and phone are required.' })
            return
        }

        const fd = new FormData()
        fd.append('first_name', newCustomerForm.first_name)
        fd.append('last_name', newCustomerForm.last_name)
        fd.append('email', newCustomerForm.email)
        fd.append('phone', newCustomerForm.phone)

        const res = await createCustomer(fd)
        if (res.customer) {
            setCustomers([res.customer, ...customers])
            applySelectedCustomer(res.customer.id)
            setShowNewCustomer(false)
            setNewCustomerForm({ first_name: '', last_name: '', email: '', phone: '' })
            setFeedback({ tone: 'success', message: 'Customer created and selected.' })
        } else if (res.error) {
            setFeedback({ tone: 'error', message: res.error })
        }
    }

    const addItem = (variant: SearchVariantResult) => {
        const existing = lineItems.find(i => i.variant_id === variant.id)
        if (existing) return
        setLineItems([...lineItems, {
            variant_id: variant.id,
            title: variant.title,
            image: variant.product_images?.[0],
            sku: variant.sku,
            unit_price: variant.price || 0,
            quantity: 1
        }])
        setProductSearch('')
        setSearchResults([])
    }

    const updateItem = (index: number, field: keyof LineItem, value: LineItem[keyof LineItem]) => {
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
        if (!selectedCustomer) {
            setFeedback({ tone: 'error', message: 'Select a customer before creating the order.' })
            return
        }
        if (!customerContact.full_name.trim() || !customerContact.email.trim() || !customerContact.phone.trim()) {
            setFeedback({ tone: 'error', message: 'Customer name, email, and phone are required.' })
            return
        }
        if (lineItems.length === 0) {
            setFeedback({ tone: 'error', message: 'Add at least one item to the order.' })
            return
        }
        setSubmitting(true)
        setFeedback(null)
        const res = await createOrder({
            customer_id: selectedCustomer,
            guest_name: customerContact.full_name,
            guest_email: customerContact.email,
            guest_phone: customerContact.phone,
            payment_status: paymentStatus,
            total_amount: totalAmount,
            items: lineItems
        })
        if (res.success) {
            router.push(`/admin/orders/${res.orderId}`)
        } else {
            setFeedback({ tone: 'error', message: res.error || 'Failed to create order.' })
            setSubmitting(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto pb-20">
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
                <div className="lg:col-span-2 space-y-6">
                    {feedback && (
                        <div className={`p-3 rounded-lg border text-sm ${feedback.tone === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                            {feedback.message}
                        </div>
                    )}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Order Items</h3>

                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products to add..."
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder:text-gray-400"
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {searchResults.map(result => (
                                        <div
                                            key={result.id}
                                            onClick={() => addItem(result)}
                                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center border-b border-gray-100 last:border-0"
                                        >
                                            {result.product_images?.[0] && (
                                                <div className="relative mr-3 h-8 w-8 overflow-hidden rounded">
                                                    <Image src={result.product_images[0]} alt="" fill sizes="32px" className="object-cover" />
                                                </div>
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

                        {lineItems.length > 0 ? (
                            <div className="space-y-4">
                                {lineItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        {item.image ? (
                                            <div className="relative h-12 w-12 overflow-hidden rounded-md">
                                                <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
                                            </div>
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

                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Customer</h3>

                        {!showNewCustomer ? (
                            <div className="space-y-3">
                                <label className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Select Customer</label>
                                <input
                                    type="text"
                                    value={customerQuery}
                                    onChange={(e) => setCustomerQuery(e.target.value)}
                                    placeholder="Search by name, email, or phone..."
                                    className="w-full px-4 py-3 rounded-lg border-[1.5px] border-gray-300 text-sm focus:ring-2 focus:ring-gray-900/25 focus:border-gray-900 bg-white"
                                />
                                <select
                                    value={selectedCustomer}
                                    onChange={e => applySelectedCustomer(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border-[1.5px] border-gray-300 text-sm focus:ring-2 focus:ring-gray-900/25 focus:border-gray-900 bg-white"
                                >
                                    <option value="">-- Select --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email || c.phone})</option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-1 gap-3 pt-2">
                                    <Input label="Customer Name" value={customerContact.full_name} onChange={e => setCustomerContact({ ...customerContact, full_name: e.target.value })} required />
                                    <Input label="Customer Email" type="email" value={customerContact.email} onChange={e => setCustomerContact({ ...customerContact, email: e.target.value })} required />
                                    <Input label="Customer Phone" value={customerContact.phone} onChange={e => setCustomerContact({ ...customerContact, phone: e.target.value })} required />
                                </div>
                                <div className="text-center pt-2">
                                    <span className="text-xs text-gray-500">or </span>
                                    <button
                                        onClick={() => setShowNewCustomer(true)}
                                        className="text-gray-900 hover:text-black text-sm font-medium"
                                    >
                                        Create New Customer
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-900">New Customer</h4>
                                <Input label="First Name" value={newCustomerForm.first_name} onChange={e => setNewCustomerForm({ ...newCustomerForm, first_name: e.target.value })} />
                                <Input label="Last Name" value={newCustomerForm.last_name} onChange={e => setNewCustomerForm({ ...newCustomerForm, last_name: e.target.value })} />
                                <Input label="Email" type="email" value={newCustomerForm.email} onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })} />
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
