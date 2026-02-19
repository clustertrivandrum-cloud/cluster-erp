'use client'

import { User, Plus, Minus, Trash2, X, ChevronUp, ShoppingBag } from 'lucide-react'
import { useState, useEffect } from 'react'

interface POSCartProps {
    cart: any[]
    removeFromCart: (vid: string) => void
    updateQuantity: (vid: string, delta: number) => void
    subtotal: number
    taxAmount: number
    discountAmount: number
    discountType: 'fixed' | 'percent'
    setDiscountType: (t: 'fixed' | 'percent') => void
    discountValue: number
    setDiscountValue: (v: number) => void
    grandTotal: number
    customers: any[]
    selectedCustomer: any
    setSelectedCustomer: (c: any) => void
    onCheckout: () => void
    isOpenDocs?: boolean // For mobile drawer state if needed externally, but maybe internal state is better or passed from parent
}

export default function POSCart({
    cart,
    removeFromCart,
    updateQuantity,
    subtotal,
    taxAmount,
    discountAmount,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    grandTotal,
    customers,
    selectedCustomer,
    setSelectedCustomer,
    onCheckout
}: POSCartProps) {
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false)
    const [custSearch, setCustSearch] = useState('')

    // Filter customers for search dropdown
    const filteredCustomers = custSearch
        ? customers.filter(c =>
            c.first_name?.toLowerCase().includes(custSearch.toLowerCase()) ||
            c.phone?.includes(custSearch)
        ).slice(0, 5)
        : []

    return (
        <div className="flex flex-col h-full bg-white shadow-xl relative z-20">
            {/* Customer Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                {selectedCustomer ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                {selectedCustomer.first_name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">{selectedCustomer.first_name} {selectedCustomer.last_name}</h4>
                                <p className="text-xs text-gray-500 font-mono">{selectedCustomer.phone}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedCustomer(null)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <button
                            onClick={() => setIsCustomerSearchOpen(!isCustomerSearchOpen)}
                            className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 text-gray-500 hover:text-indigo-600 transition-all font-medium text-sm"
                        >
                            <span className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Select Customer
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">Guest</span>
                        </button>

                        {isCustomerSearchOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                                <input
                                    type="text"
                                    placeholder="Search Name or Phone..."
                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 placeholder:text-gray-400"
                                    value={custSearch}
                                    onChange={e => setCustSearch(e.target.value)}
                                    autoFocus
                                />
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {filteredCustomers.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedCustomer(c)
                                                setIsCustomerSearchOpen(false)
                                                setCustSearch('')
                                            }}
                                            className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg text-sm flex justify-between"
                                        >
                                            <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                                            <span className="text-gray-500 text-xs">{c.phone}</span>
                                        </button>
                                    ))}
                                    {filteredCustomers.length === 0 && custSearch && (
                                        <div className="p-2 text-center text-xs text-gray-400">No matching customer</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <ShoppingBag className="w-16 h-16 mb-4 stroke-1" />
                        <p className="text-sm font-medium">Cart is empty</p>
                        <p className="text-xs">Scan or click products to add</p>
                    </div>
                ) : (
                    cart.map((item, idx) => (
                        <div key={`${item.variant_id}_${idx}`} className="group flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:shadow-sm transition-all">
                            <div className="w-14 h-14 bg-gray-50 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100">
                                {item.image && <img src={item.image} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900 truncate">{item.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.variant_title !== 'Default Variant' ? item.variant_title : 'Std'}</span>
                                    <span className="text-xs font-bold text-indigo-600">₹{item.price}</span>
                                </div>
                            </div>

                            {/* Qty Controls */}
                            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button
                                    onClick={() => updateQuantity(item.variant_id, -1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-red-500 active:scale-95 transition-all"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.variant_id, 1)}
                                    className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-indigo-600 active:scale-95 transition-all"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Calculations & Actions */}
            <div className="p-5 bg-white border-t border-gray-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-3xl z-30">
                {/* Discount Toggle */}
                <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>Discount</span>
                        <div className="flex bg-gray-100 rounded-full p-0.5">
                            <button
                                onClick={() => setDiscountType('fixed')}
                                className={`px-2 py-0.5 rounded-full transition-all ${discountType === 'fixed' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
                            >₹</button>
                            <button
                                onClick={() => setDiscountType('percent')}
                                className={`px-2 py-0.5 rounded-full transition-all ${discountType === 'percent' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
                            >%</button>
                        </div>
                    </div>
                    {/* Only show input if needed to keep clean? Or nice inline input */}
                    <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2 border border-dashed border-gray-300">
                        <span className="text-xs font-medium text-gray-600 pl-1">Apply Discount</span>
                        <input
                            type="number"
                            value={discountValue}
                            onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                            className="w-20 text-right bg-transparent border-none p-0 text-sm font-bold focus:ring-0 text-red-500 placeholder-red-200"
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Tax</span>
                        <span>₹{taxAmount.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-red-500 font-medium">
                            <span>Discount</span>
                            <span>-₹{discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline pt-2 border-t border-gray-100">
                        <span className="text-lg font-bold text-gray-900">Total</span>
                        <span className="text-2xl font-black text-indigo-600">₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>

                <button
                    onClick={onCheckout}
                    disabled={cart.length === 0}
                    className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg shadow-lg shadow-gray-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                    Checkout <span className="opacity-60 text-sm font-normal">({cart.length} items)</span>
                </button>
            </div>
        </div>
    )
}
