'use client'

import { Search, ShoppingCart, Tag, Package } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface POSCatalogProps {
    products: any[]
    search: string
    setSearch: (s: string) => void
    addToCart: (product: any) => void
    categories: string[]
    selectedCategory: string
    setSelectedCategory: (c: string) => void
}

export default function POSCatalog({
    products,
    search,
    setSearch,
    addToCart,
    categories,
    selectedCategory,
    setSelectedCategory
}: POSCatalogProps) {
    const categoryScrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to selected category if needed (optional polish)

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-100 shadow-sm z-10 sticky top-0">
                {/* Search Bar */}
                <div className="p-4 pb-2">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-gray-900 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search products or scan barcode..."
                            className="block w-full pl-11 pr-4 py-3.5 bg-gray-100/50 border-none rounded-2xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition-all font-medium text-lg"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Categories (Horizontal Scroll) */}
                <div className="px-4 pb-4 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2" ref={categoryScrollRef}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${selectedCategory === cat
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-md shadow-gray-200 transform scale-105'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {products.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Package className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">No products found</h3>
                        <p className="text-gray-500">Try adjusting your search or category filter</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-32 lg:pb-4">
                        {products.map(product => {
                            const variant = product.product_variants?.[0]
                            const price = variant?.price || 0
                            const compareAt = variant?.compare_at_price
                            const stock = variant?.inventory_items?.[0]?.available_quantity || 0
                            const hasStock = stock > 0
                            const image = product.product_media?.[0]?.media_url

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="group relative bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left flex flex-col h-full active:scale-95"
                                >
                                    {/* Image Container */}
                                    <div className="aspect-[4/3] bg-gray-50 rounded-2xl mb-3 relative overflow-hidden">
                                        {image ? (
                                            <img
                                                src={image}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                alt={product.title}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-8 h-8 text-gray-200" />
                                            </div>
                                        )}

                                        {/* Stock Badge */}
                                        {!hasStock ? (
                                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                                <span className="bg-red-50 text-red-600 text-xs font-bold px-3 py-1 rounded-full border border-red-100">
                                                    Out of Stock
                                                </span>
                                            </div>
                                        ) : (
                                            stock <= 5 && (
                                                <div className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">
                                                    Only {stock} left
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight mb-2 group-hover:text-gray-700 transition-colors">
                                            {product.title}
                                        </h3>

                                        <div className="mt-auto flex items-end justify-between">
                                            <div>
                                                {compareAt > price && (
                                                    <div className="text-xs text-gray-400 line-through font-medium">₹{compareAt}</div>
                                                )}
                                                <div className="text-lg font-black text-gray-900">
                                                    ₹{price}
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all shadow-sm">
                                                <ShoppingCart className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* SKU Overlay on Hover (Desktop) */}
                                    {variant?.sku && (
                                        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="bg-black/70 backdrop-blur text-white text-[10px] font-mono px-2 py-1 rounded-lg">
                                                {variant.sku}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
