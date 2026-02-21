'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createOrder } from '@/lib/actions/order-actions'
import POSCatalog from './POSCatalog'
import POSCart from './POSCart'
import { ShoppingBag, X, CheckCircle, CreditCard, Banknote, Printer, ChevronDown } from 'lucide-react'

// Props types
interface POSShellProps {
    initialProducts: any[]
    initialCustomers: any[]
    settings: any
}

export default function POSShell({ initialProducts, initialCustomers, settings }: POSShellProps) {
    // Data State
    const [products, setProducts] = useState(initialProducts)
    const [cart, setCart] = useState<any[]>([])

    // UI State
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

    // Checkout State
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
    const [discountValue, setDiscountValue] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('Cash')
    const [amountTendered, setAmountTendered] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)

    // Derived Categories
    const categories = ['All', ...Array.from(new Set(initialProducts.map((p: any) => p.category_id || 'Uncategorized')))] as string[]

    // Filter Logic
    useEffect(() => {
        let result = initialProducts
        if (selectedCategory !== 'All') {
            result = result.filter(p => p.category_id === selectedCategory)
        }
        if (search) {
            const lowerQuery = search.toLowerCase()
            result = result.filter(p =>
                p.title.toLowerCase().includes(lowerQuery) ||
                p.product_variants?.some((v: any) => v.sku?.toLowerCase().includes(lowerQuery))
            )
        }
        setProducts(result)
    }, [search, selectedCategory, initialProducts])


    // Cart Logic
    const addToCart = (product: any) => {
        const targetVariant = product.product_variants?.[0]
        if (!targetVariant) return alert("No variants available")

        const existingItem = cart.find(item => item.variant_id === targetVariant.id)
        if (existingItem) {
            setCart(cart.map(item =>
                item.variant_id === targetVariant.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            const price = targetVariant.price || product.price || 0
            setCart([...cart, {
                product_id: product.id,
                variant_id: targetVariant.id,
                title: product.title,
                variant_title: targetVariant.title,
                sku: targetVariant.sku,
                price: parseFloat(price),
                quantity: 1,
                image: product.product_media?.[0]?.media_url
            }])
        }
    }

    const updateQuantity = (variantId: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.variant_id === variantId) {
                const newQty = item.quantity + delta
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
    const taxRate = settings?.tax_rate || 0
    const taxAmount = (taxableAmount * taxRate) / 100
    const grandTotal = taxableAmount + taxAmount


    const handleCheckoutSubmit = async () => {
        setIsProcessing(true)

        // Open window before await to prevent popup blocker
        const invoiceWindow = window.open('about:blank', '_blank')

        let customerId = selectedCustomer?.id

        // Logic for Walk-in / Guest to be improved, but simplified here
        if (!customerId) {
            // If schema allows null, great. If strictly requires ID, we need a fallback.
            // Assuming schema allows null for Guest or we have logic elsewhere.
            // For now passing null if valid, or alert.
            // Actually database `customer_id` is uuid referencing customers. It IS nullable?. 
            // Let's assume nullable for Guest orders in POS.
        }

        const orderInput = {
            customer_id: customerId, // undefined/null
            payment_status: 'paid',
            total_amount: grandTotal,
            status: 'delivered', // Complete
            // POS Fields
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            payment_method: paymentMethod,
            order_type: 'pos' as const,
            notes: notes,
            items: cart.map(item => ({
                variant_id: item.variant_id,
                quantity: item.quantity,
                unit_price: item.price
            }))
        }

        const res = await createOrder(orderInput as any) // TypeScript cast for now

        if (res.success) {
            if (invoiceWindow) {
                invoiceWindow.location.href = `/admin/orders/${res.orderId}/invoice`
            } else {
                window.open(`/admin/orders/${res.orderId}/invoice`, '_blank') // Fallback 
            }
            setCart([])
            setAmountTendered('')
            setNotes('')
            setIsCheckoutOpen(false)
            setDiscountValue(0)
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
                    search={search}
                    setSearch={setSearch}
                    addToCart={addToCart}
                    categories={categories}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
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
                    customers={initialCustomers}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
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
                                customers={initialCustomers}
                                selectedCustomer={selectedCustomer}
                                setSelectedCustomer={setSelectedCustomer}
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
