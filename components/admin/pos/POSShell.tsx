'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { createCustomer, createOrder } from '@/lib/actions/order-actions'
import { getPosProducts } from '@/lib/actions/pos-actions'
import POSCatalog from './POSCatalog'
import POSCart from './POSCart'
import { X, CheckCircle, CreditCard, Banknote, Printer, ChevronDown } from 'lucide-react'
import type { PosCartItem, PosCategory, PosCustomer, PosProduct, PosProductVariant, PosSettings } from '@/lib/pos-types'

// Props types
interface POSShellProps {
    initialProducts: PosProduct[]
    categories: PosCategory[]
    initialCustomers: PosCustomer[]
    settings: PosSettings | null
}

function mergeProducts(existing: PosProduct[], incoming: PosProduct[]) {
    const merged = new Map(existing.map((product) => [product.id, product]))

    for (const product of incoming) {
        merged.set(product.id, product)
    }

    return Array.from(merged.values())
}

function getVariantStock(variant: PosProductVariant) {
    return (variant.inventory_items ?? []).reduce((sum, inventoryItem) => {
        return sum + Number(inventoryItem.available_quantity ?? 0)
    }, 0)
}

function isVariantSellable(variant: PosProductVariant) {
    const sellableStatus = (variant.sellable_status ?? '').trim().toLowerCase()
    if (sellableStatus) {
        return sellableStatus === 'sellable'
    }

    return variant.is_active !== false
}

function getPreferredVariant(product: PosProduct) {
    const sellableVariants = product.product_variants.filter(isVariantSellable)

    return sellableVariants.find((variant) => getVariantStock(variant) > 0)
        ?? sellableVariants.find((variant) => variant.is_default)
        ?? sellableVariants[0]
        ?? null
}

function getPreferredVariantImage(product: PosProduct, variant: PosProductVariant | null) {
    return variant?.variant_media?.find((media) => media.media_url)?.media_url
        ?? product.product_media?.[0]?.media_url
        ?? null
}

export default function POSShell({ initialProducts, categories, initialCustomers, settings }: POSShellProps) {
    const [products, setProducts] = useState<PosProduct[]>(initialProducts)
    const [knownProducts, setKnownProducts] = useState<PosProduct[]>(initialProducts)
    const [customers, setCustomers] = useState<PosCustomer[]>(initialCustomers)
    const [cart, setCart] = useState<PosCartItem[]>([])
    const [isCatalogLoading, setIsCatalogLoading] = useState(false)

    // UI State
    const [search, setSearch] = useState('')
    const [selectedCategoryId, setSelectedCategoryId] = useState('all')
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const deferredSearch = useDeferredValue(search)

    // Checkout State
    const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null)
    const [customerDetails, setCustomerDetails] = useState({ fullName: '', email: '', phone: '' })
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
    const [discountValue, setDiscountValue] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('Cash')
    const [amountTendered, setAmountTendered] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        let cancelled = false

        const loadProducts = async () => {
            const searchTerm = deferredSearch.trim()
            const categoryId = selectedCategoryId === 'all' ? undefined : selectedCategoryId

            if (!searchTerm && !categoryId) {
                setProducts(initialProducts)
                setIsCatalogLoading(false)
                return
            }

            try {
                setIsCatalogLoading(true)
                const result = await getPosProducts({
                    searchQuery: searchTerm,
                    categoryId,
                    page: 1,
                    limit: 48,
                })

                if (!cancelled) {
                    const nextProducts = result.data || []
                    setProducts(nextProducts)
                    setKnownProducts((current) => mergeProducts(current, nextProducts))
                }
            } finally {
                if (!cancelled) {
                    setIsCatalogLoading(false)
                }
            }
        }

        loadProducts()

        return () => {
            cancelled = true
        }
    }, [deferredSearch, initialProducts, selectedCategoryId])

    useEffect(() => {
        if (!selectedCustomer) {
            return
        }

        setCustomerDetails({
            fullName: [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ').trim(),
            email: selectedCustomer.email || '',
            phone: selectedCustomer.phone || '',
        })
    }, [selectedCustomer])

    const getVariantPrice = (variant: PosProductVariant) => {
        return Number(variant.price ?? 0)
    }


    // Cart Logic
    const addToCart = (product: PosProduct) => {
        const targetVariant = getPreferredVariant(product)
        if (!targetVariant) {
            alert('No variants available')
            return
        }
        if (!isVariantSellable(targetVariant)) {
            alert('This variant is not available for sale')
            return
        }
        if (getVariantStock(targetVariant) <= 0) {
            alert('This item is out of stock')
            return
        }

        const existingItem = cart.find(item => item.variant_id === targetVariant.id)
        if (existingItem) {
            if (existingItem.quantity >= getVariantStock(targetVariant)) {
                alert('Cannot add more than available stock')
                return
            }

            setCart(cart.map(item =>
                item.variant_id === targetVariant.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            const price = getVariantPrice(targetVariant)
            setCart([...cart, {
                product_id: product.id,
                variant_id: targetVariant.id,
                title: product.title,
                variant_title: targetVariant.title && targetVariant.title !== 'Default Variant'
                    ? targetVariant.title
                    : targetVariant.sku ? `SKU ${targetVariant.sku}` : 'Default Variant',
                sku: targetVariant.sku,
                price,
                quantity: 1,
                image: getPreferredVariantImage(product, targetVariant)
            }])
        }
    }

    const updateQuantity = (variantId: string, delta: number) => {
        const variantStock = knownProducts
            .flatMap((p) => p.product_variants)
            .find((v) => v.id === variantId)
        const stock = variantStock ? getVariantStock(variantStock) : undefined

        setCart(cart.map(item => {
            if (item.variant_id === variantId) {
                const newQty = item.quantity + delta
                if (stock !== undefined && newQty > stock) {
                    return { ...item, quantity: stock }
                }
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter(item => item.quantity > 0)) // Auto remove if 0? Or safeguard 1? Ideally safeguard 1, explicit delete needed? Current code safeguards > 0
    }

    const removeFromCart = (variantId: string) => {
        setCart(cart.filter(item => item.variant_id !== variantId))
    }

    // Totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    let discountAmount = discountType === 'fixed' ? discountValue : (subtotal * discountValue) / 100
    if (discountAmount > subtotal) discountAmount = subtotal
    const taxableAmount = subtotal - discountAmount
    const taxRate = Number(settings?.tax_rate || 0)
    const taxAmount = (taxableAmount * taxRate) / 100
    const grandTotal = taxableAmount + taxAmount

    const handleCreateCustomer = async (input: {
        first_name: string
        last_name: string
        email: string
        phone: string
    }) => {
        const formData = new FormData()
        formData.append('first_name', input.first_name)
        formData.append('last_name', input.last_name)
        formData.append('email', input.email)
        formData.append('phone', input.phone)

        const result = await createCustomer(formData)
        if (result.customer) {
            setCustomers((current) => [result.customer, ...current.filter((customer) => customer.id !== result.customer.id)])
            setSelectedCustomer(result.customer)
            setCustomerDetails({
                fullName: [result.customer.first_name, result.customer.last_name].filter(Boolean).join(' ').trim(),
                email: result.customer.email || '',
                phone: result.customer.phone || '',
            })
        }

        return result
    }


    const handleCheckoutSubmit = async () => {
        if (cart.length === 0) {
            return
        }

        if (paymentMethod === 'Cash' && (Number(amountTendered || 0) < grandTotal)) {
            alert('Amount received is less than the total payable')
            return
        }
        if (!customerDetails.fullName.trim() || !customerDetails.email.trim() || !customerDetails.phone.trim()) {
            alert('Customer name, email, and phone are required for POS orders')
            return
        }

        // Open window before await to prevent popup blocker
        const invoiceWindow = window.open('about:blank', '_blank')
        setIsProcessing(true)

        const orderInput = {
            customer_id: selectedCustomer?.id ?? null,
            guest_name: customerDetails.fullName,
            guest_email: customerDetails.email,
            guest_phone: customerDetails.phone,
            payment_status: 'paid',
            total_amount: grandTotal,
            status: 'completed',
            // POS Fields
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            payment_method: paymentMethod,
            order_type: 'pos' as const,
            notes: notes,
            items: cart.map(item => ({
                variant_id: item.variant_id,
                quantity: item.quantity,
                unit_price: item.price,
                title: item.title,
                sku: item.sku ?? null,
            }))
        }

        const res = await createOrder(orderInput)

        if (res.success) {
            if (invoiceWindow) {
                invoiceWindow.location.href = `/admin/orders/${res.orderId}/invoice`
            } else {
                window.open(`/admin/orders/${res.orderId}/invoice`, '_blank') // Fallback 
            }
            setCart([])
            setAmountTendered('')
            setNotes('')
            setCustomerDetails({ fullName: '', email: '', phone: '' })
            setIsCheckoutOpen(false)
            setDiscountValue(0)
            setSelectedCustomer(null)
            setIsMobileCartOpen(false)
        } else {
            if (invoiceWindow) invoiceWindow.close()
            alert("Error: " + res.error)
        }
        setIsProcessing(false)
    }

    return (
        <div className="flex h-full w-full bg-gray-100 overflow-hidden relative">

            {/* CATALOG SECTION (Full width on mobile, 70% on desktop) */}
            <div className={`h-full w-full lg:w-[65%] xl:w-[70%] flex flex-col transition-all duration-300`}>
                <POSCatalog
                    products={products}
                    isLoading={isCatalogLoading}
                    search={search}
                    setSearch={setSearch}
                    addToCart={addToCart}
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    setSelectedCategoryId={setSelectedCategoryId}
                />
            </div>

            {/* CART SECTION (Desktop: Sidebar, Mobile: Drawer) */}
            {/* Desktop View */}
            <div className="hidden lg:flex flex-col w-[35%] xl:w-[30%] border-l border-gray-200">
                <POSCart
                    cart={cart}
                    removeFromCart={removeFromCart}
                    updateQuantity={updateQuantity}
                    subtotal={subtotal}
                    taxAmount={taxAmount}
                    discountAmount={discountAmount}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    discountValue={discountValue}
                    setDiscountValue={setDiscountValue}
                    grandTotal={grandTotal}
                    customers={customers}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
                    onCreateCustomer={handleCreateCustomer}
                    onCheckout={() => setIsCheckoutOpen(true)}
                />
            </div>

            {/* Mobile Bottom Bar (Sticky) */}
            <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30 p-4 pb-6 bg-white border-t border-gray-200 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="w-full bg-gray-900 text-white rounded-xl py-3 px-4 flex justify-between items-center font-bold shadow-lg"
                >
                    <div className="flex items-center gap-2">
                        <span className="bg-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                        <span>View Cart</span>
                    </div>
                    <span>₹{grandTotal.toFixed(2)}</span>
                </button>
            </div>

            {/* Mobile Cart Drawer (Overlay) */}
            {isMobileCartOpen && (
                <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end">
                    <div className="w-full h-[90vh] mt-[10vh] bg-white rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-20 duration-300">
                        {/* Drawer Handle */}
                        <div className="w-full flex justify-center pt-3 pb-1" onClick={() => setIsMobileCartOpen(false)}>
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2" />
                        </div>
                        <div className="px-4 pb-2 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900">Current Order</h2>
                            <button onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-gray-100 rounded-full">
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            <POSCart
                                cart={cart}
                                removeFromCart={removeFromCart}
                                updateQuantity={updateQuantity}
                                subtotal={subtotal}
                                taxAmount={taxAmount}
                                discountAmount={discountAmount}
                                discountType={discountType}
                                setDiscountType={setDiscountType}
                                discountValue={discountValue}
                                setDiscountValue={setDiscountValue}
                                grandTotal={grandTotal}
                                customers={customers}
                                selectedCustomer={selectedCustomer}
                                setSelectedCustomer={setSelectedCustomer}
                                onCreateCustomer={handleCreateCustomer}
                                onCheckout={() => {
                                    setIsMobileCartOpen(false)
                                    setIsCheckoutOpen(true)
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}


            {/* CHECKOUT MODAL (Global) */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in duration-200">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
                                <p className="text-xs text-gray-500">Complete payment to print receipt</p>
                            </div>
                            <button onClick={() => setIsCheckoutOpen(false)} className="bg-white p-2 border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Total Hero */}
                            <div className="text-center py-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Payable</p>
                                <p className="text-4xl font-black text-gray-900 tracking-tight">₹{grandTotal.toFixed(2)}</p>
                            </div>

                            {/* Payment Method Grid */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Customer Contact</label>
                                <div className="grid gap-3">
                                    <input
                                        type="text"
                                        value={customerDetails.fullName}
                                        onChange={e => setCustomerDetails((current) => ({ ...current, fullName: e.target.value }))}
                                        className="block w-full border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 sm:text-sm p-3 bg-white text-gray-900 placeholder:text-gray-400"
                                        placeholder="Customer name"
                                    />
                                    <input
                                        type="email"
                                        value={customerDetails.email}
                                        onChange={e => setCustomerDetails((current) => ({ ...current, email: e.target.value }))}
                                        className="block w-full border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 sm:text-sm p-3 bg-white text-gray-900 placeholder:text-gray-400"
                                        placeholder="Customer email"
                                    />
                                    <input
                                        type="text"
                                        value={customerDetails.phone}
                                        onChange={e => setCustomerDetails((current) => ({ ...current, phone: e.target.value }))}
                                        className="block w-full border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 sm:text-sm p-3 bg-white text-gray-900 placeholder:text-gray-400"
                                        placeholder="Customer phone"
                                    />
                                </div>
                            </div>

                            {/* Payment Method Grid */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Payment Mode</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['Cash', 'Card', 'UPI'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`flex flex-col items-center justify-center py-4 rounded-xl border-2 transition-all duration-200 ${paymentMethod === method
                                                ? 'border-gray-900 bg-gray-900 text-white shadow-md transform scale-[1.02]'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {method === 'Cash' && <Banknote className={`w-8 h-8 mb-2 ${paymentMethod === method ? 'text-white' : 'text-gray-300'}`} />}
                                            {method === 'Card' && <CreditCard className={`w-8 h-8 mb-2 ${paymentMethod === method ? 'text-white' : 'text-gray-300'}`} />}
                                            {method === 'UPI' && <CheckCircle className={`w-8 h-8 mb-2 ${paymentMethod === method ? 'text-white' : 'text-gray-300'}`} />}
                                            <span className="font-bold text-sm">{method}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cash Input */}
                            {paymentMethod === 'Cash' && (
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Amount Received</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3.5 text-gray-400 text-lg font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={amountTendered}
                                            onChange={e => setAmountTendered(e.target.value)}
                                            className="block w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 text-lg font-bold shadow-sm text-gray-900 placeholder:text-gray-400"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="mt-4 flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Change to return</span>
                                        <span className={`font-black text-xl ${(parseFloat(amountTendered) - grandTotal) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            ₹{Math.max(0, (parseFloat(amountTendered) || 0) - grandTotal).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Notes</label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="block w-full border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 sm:text-sm p-3 resize-none bg-gray-50 text-gray-900 placeholder:text-gray-400"
                                    placeholder="Optional notes..."
                                />
                            </div>

                            <button
                                onClick={handleCheckoutSubmit}
                                disabled={isProcessing}
                                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-black disabled:opacity-70 disabled:hover:bg-gray-900 shadow-xl shadow-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                {isProcessing ? (
                                    <span className="animate-pulse">Processing...</span>
                                ) : (
                                    <>
                                        <Printer className="w-5 h-5" />
                                        Complete & Print Bill
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
