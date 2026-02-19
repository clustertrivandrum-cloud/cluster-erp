'use client'

import { Search, ShoppingCart, Filter } from 'lucide-react'
import { useState } from 'react'

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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Header / Search */}
            <div className="p-4 bg-white border-b border-gray-100 flex gap-3 sticky top-0 z-10 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Scan Barcode or Search..."
                        className="block w-full pl-10 pr-4 py-2.5 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-900 placeholder:text-gray-400"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                {/* Category Filter Button (Mobile mainly, or logic for dropdown) */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    {categories.slice(0, 3).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${selectedCategory === cat
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {products.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Search className="w-12 h-12 mb-3 opacity-20" />
                        <p>No products found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-24 md:pb-4">
                        {products.map(product => {
                            const variant = product.product_variants?.[0]
                            const price = variant?.price || 0
                            const hasStock = (variant?.inventory_items?.[0]?.available_quantity || 0) > 0

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="group bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all text-left flex flex-col h-full relative overflow-hidden active:scale-95 duration-75"
                                >
                                    <div className="aspect-square bg-gray-50 rounded-xl mb-3 relative overflow-hidden">
                                        {product.product_media?.[0]?.media_url ? (
                                            <img
                                                src={product.product_media[0].media_url}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                alt={product.title}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <ShoppingCart className="w-8 h-8 opacity-20" />
                                            </div>
                                        )}
                                        {!hasStock && (
                                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
                                                <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full border border-red-100 uppercase tracking-wide">
                                                    Out of Stock
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-1 leading-snug group-hover:text-indigo-600 transition-colors">
                                        {product.title}
                                    </h3>
                                    <div className="mt-auto flex justify-between items-end">
                                        <span className="text-base font-bold text-gray-900">₹{price}</span>
                                        {variant?.sku && (
                                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                                {variant.sku}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
