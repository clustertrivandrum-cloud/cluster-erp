'use client'

import { User, Plus, Minus, Trash2, X, ChevronUp, ShoppingBag, CreditCard, Banknote, Tag } from 'lucide-react'
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
                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm group hover:border-gray-300 transition-colors cursor-pointer" onClick={() => setIsCustomerSearchOpen(true)}> {/* Allow re-select */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 font-bold text-lg">
                                {selectedCustomer.first_name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</h4>
                                <p className="text-xs text-gray-500 font-mono">{selectedCustomer.phone}</p>
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
                            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <button
                            onClick={() => setIsCustomerSearchOpen(!isCustomerSearchOpen)}
                            className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-400 hover:shadow-md text-gray-600 hover:text-gray-900 transition-all font-bold group"
                        >
                            <span className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                                    <User className="w-4 h-4" />
                                </div>
                                Select Customer
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-medium group-hover:bg-gray-200 group-hover:text-gray-900">Guest</span>
                        </button>

                        {isCustomerSearchOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                                <input
                                    type="text"
                                    placeholder="Search Name or Phone..."
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 text-gray-900 placeholder:text-gray-400 font-medium"
                                    value={custSearch}
                                    onChange={e => setCustSearch(e.target.value)}
                                    autoFocus
                                />
                                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                    {filteredCustomers.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedCustomer(c)
                                                setIsCustomerSearchOpen(false)
                                                setCustSearch('')
                                            }}
                                            className="w-full text-left p-3 hover:bg-gray-50 rounded-xl flex justify-between items-center transition-colors group"
                                        >
                                            <span className="font-bold text-gray-900 group-hover:text-black">{c.first_name} {c.last_name}</span>
                                            <span className="text-gray-500 text-xs font-mono bg-white px-1.5 py-0.5 rounded border border-gray-100">{c.phone}</span>
                                        </button>
                                    ))}
                                    {filteredCustomers.length === 0 && custSearch && (
                                        <div className="p-4 text-center text-sm text-gray-400">No matching customer found</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-200">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <ShoppingBag className="w-8 h-8 stroke-1" />
                        </div>
                        <p className="text-lg font-bold">Cart is empty</p>
                        <p className="text-sm">Scan or tap products to add</p>
                    </div>
                ) : (
                    cart.map((item, idx) => (
                        <div key={`${item.variant_id}_${idx}`} className="group flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md transition-all">
                            {/* Image */}
                            <div className="w-16 h-16 bg-gray-50 rounded-xl flex-shrink-0 overflow-hidden border border-gray-100 relative">
                                {item.image ? (
                                    <img src={item.image} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ShoppingBag className="w-6 h-6 text-gray-200" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900 truncate">{item.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{item.variant_title !== 'Default Variant' ? item.variant_title : 'Std'}</span>
                                    <span className="text-sm font-bold text-gray-900">₹{item.price * item.quantity}</span>
                                </div>
                            </div>

                            {/* Qty Controls (Large Targets) */}
                            <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 border border-gray-100">
                                <button
                                    onClick={() => updateQuantity(item.variant_id, -1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-black hover:bg-gray-100 active:scale-90 transition-all"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center text-sm font-black text-gray-900">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.variant_id, 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 hover:text-black hover:bg-gray-100 active:scale-90 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Calculations & Actions */}
            <div className="px-5 pt-5 pb-3 bg-white border-t border-gray-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-3xl z-30">
                {/* Discount Toggle */}
                <div className="mb-4">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Discount</span>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex bg-gray-100 rounded-lg p-1 flex-1">
                            <button
                                onClick={() => setDiscountType('fixed')}
                                className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${discountType === 'fixed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                            >₹ Fixed</button>
                            <button
                                onClick={() => setDiscountType('percent')}
                                className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${discountType === 'percent' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                            >% Percentage</button>
                        </div>
                        <div className="w-24 relative">
                            <input
                                type="number"
                                value={discountValue || ''}
                                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-3 pr-2 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all placeholder:text-gray-300"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100/50">
                    <div className="flex justify-between text-sm text-gray-500 font-medium">
                        <span>Subtotal</span>
                        <span className="text-gray-900">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 font-medium">
                        <span>Tax</span>
                        <span className="text-gray-900">₹{taxAmount.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-red-500 font-bold">
                            <span>Discount</span>
                            <span>-₹{discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline pt-3 border-t border-gray-200/50 mt-1">
                        <span className="text-base font-bold text-gray-900">Total Payable</span>
                        <span className="text-2xl font-black text-gray-900">₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>

                <button
                    onClick={onCheckout}
                    disabled={cart.length === 0}
                    className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg shadow-xl shadow-gray-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                    Proceed to Checkout
                    <span className="bg-gray-800 px-2 py-0.5 rounded text-sm group-hover:bg-gray-900">({cart.length})</span>
                </button>
            </div>
        </div>
    )
}
