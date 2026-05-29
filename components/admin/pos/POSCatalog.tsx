'use client'

import { Search, ShoppingCart, Package, X } from 'lucide-react'
import { useRef, useState } from 'react'
import Image from 'next/image'
import type { PosCategory, PosProduct } from '@/lib/pos-types'

interface POSCatalogProps {
    products: PosProduct[]
    isLoading?: boolean
    search: string
    setSearch: (s: string) => void
    addToCart: (product: PosProduct, variant: PosProduct['product_variants'][0]) => void
    categories: PosCategory[]
    selectedCategoryId: string
    setSelectedCategoryId: (categoryId: string) => void
}

export default function POSCatalog({
    products,
    isLoading = false,
    search,
    setSearch,
    addToCart,
    categories,
    selectedCategoryId,
    setSelectedCategoryId
}: POSCatalogProps) {
    const categoryScrollRef = useRef<HTMLDivElement>(null)
    const [selectedProductForVariants, setSelectedProductForVariants] = useState<PosProduct | null>(null)

    const getVariantStock = (variant: PosProduct['product_variants'][number]) => {
        return (variant.inventory_items ?? []).reduce((sum, inventoryItem) => {
            const available = Number(inventoryItem.available_quantity ?? 0)
            const reserved = Number(inventoryItem.reserved_quantity ?? 0)
            return sum + Math.max(0, available - reserved)
        }, 0)
    }

    const isVariantSellable = (variant: PosProduct['product_variants'][number]) => {
        const sellableStatus = (variant.sellable_status ?? '').trim().toLowerCase()
        if (sellableStatus) {
            return sellableStatus === 'sellable'
        }

        return variant.is_active !== false
    }

    const getPreferredVariant = (product: PosProduct) => {
        const sellableVariants = product.product_variants.filter(isVariantSellable)

        return sellableVariants.find((variant) => getVariantStock(variant) > 0)
            ?? sellableVariants.find((variant) => variant.is_default)
            ?? sellableVariants[0]
            ?? null
    }

    // Auto-scroll to selected category if needed (optional polish)

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-100 shadow-sm z-10 sticky top-0">
                {/* Search Bar */}
                <div className="p-3 md:p-4 pb-2">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-gray-900 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search products or scan barcode..."
                            className="block w-full pl-10 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3.5 bg-gray-100/50 border-none rounded-2xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition-all font-medium text-base md:text-lg"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Categories (Horizontal Scroll) */}
                <div className="px-4 pb-4 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2" ref={categoryScrollRef}>
                        <button
                            onClick={() => setSelectedCategoryId('all')}
                            className={`flex-shrink-0 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all border ${selectedCategoryId === 'all'
                                ? 'bg-gray-900 text-white border-gray-900 shadow-md shadow-gray-200 transform scale-105'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            All
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategoryId(category.id)}
                                className={`flex-shrink-0 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all border ${selectedCategoryId === category.id
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-md shadow-gray-200 transform scale-105'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {category.name}
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
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{isLoading ? 'Loading products...' : 'No products found'}</h3>
                        <p className="text-gray-500">{isLoading ? 'Fetching a smaller catalog slice from the server.' : 'Try adjusting your search or category filter'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-32 lg:pb-4">
                        {products.filter(p => p.product_variants.some(v => getVariantStock(v) > 0)).length === 0 ? (
                            <div className="col-span-full h-full flex flex-col items-center justify-center text-center p-8">
                                <h3 className="text-lg font-bold text-gray-900 mb-1">No products in stock</h3>
                                <p className="text-gray-500">All matching products are out of stock</p>
                            </div>
                        ) : (
                            products.filter(p => p.product_variants.some(v => getVariantStock(v) > 0)).map(product => {
                                const variant = getPreferredVariant(product)

                            const price = Number(variant?.price ?? 0)
                            const compareAt = Number(variant?.compare_at_price ?? 0)
                            const preferredStock = variant ? getVariantStock(variant) : 0
                            const hasStock = product.product_variants.some(v => getVariantStock(v) > 0)
                            const image = variant?.variant_media?.find((media) => media.media_url)?.media_url
                                ?? product.product_media?.[0]?.media_url
                            const skuLabel = variant?.sku ? `SKU ${variant.sku}` : 'Default variant'

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => {
                                        const sellableVariants = product.product_variants.filter(isVariantSellable)
                                        if (sellableVariants.length > 1) {
                                            setSelectedProductForVariants(product)
                                        } else {
                                            const targetVariant = getPreferredVariant(product)
                                            if (targetVariant) addToCart(product, targetVariant)
                                        }
                                    }}
                                    disabled={!hasStock}
                                    className="group relative bg-white rounded-2xl md:rounded-3xl p-2 md:p-3 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left flex flex-col h-full active:scale-95 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                                >
                                    {/* Image Container */}
                                    <div className="aspect-[4/3] bg-gray-50 rounded-2xl mb-3 relative overflow-hidden">
                                        {image ? (
                                            <Image
                                                src={image}
                                                alt={product.title}
                                                fill
                                                sizes="(max-width: 768px) 50vw, (max-width: 1536px) 25vw, 20vw"
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
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
                                            preferredStock <= 5 && (
                                                <div className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">
                                                    Only {preferredStock} left
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="text-xs md:text-sm font-bold text-gray-900 line-clamp-2 leading-tight mb-2 group-hover:text-gray-700 transition-colors">
                                            {product.title}
                                        </h3>
                                        <p className="text-[11px] font-medium text-gray-500 mb-3">{skuLabel} · Stock: {Math.max(preferredStock, 0)}</p>

                                        <div className="mt-auto flex items-end justify-between">
                                            <div>
                                                {compareAt > price && (
                                                    <div className="text-xs text-gray-400 line-through font-medium">₹{compareAt}</div>
                                                )}
                                                <div className="text-base md:text-lg font-black text-gray-900">
                                                    ₹{price}
                                                </div>
                                            </div>
                                            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all shadow-sm">
                                                <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4" />
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
                        })
                        )}
                    </div>
                )}
            </div>

            {/* Variant Selection Modal */}
            {selectedProductForVariants && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Select Variant</h2>
                                <p className="text-xs text-gray-500">{selectedProductForVariants.title}</p>
                            </div>
                            <button onClick={() => setSelectedProductForVariants(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-2 bg-gray-50 flex-1">
                            {selectedProductForVariants.product_variants.filter(isVariantSellable).map(variant => {
                                const stock = getVariantStock(variant)
                                const hasStock = stock > 0
                                const title = variant.title && variant.title !== 'Default Variant' ? variant.title : 'Standard'
                                return (
                                    <button
                                        key={variant.id}
                                        disabled={!hasStock}
                                        onClick={() => {
                                            addToCart(selectedProductForVariants, variant)
                                            setSelectedProductForVariants(null)
                                        }}
                                        className="w-full bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:border-gray-900 hover:shadow-md transition-all text-left flex items-center justify-between group disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:shadow-sm"
                                    >
                                        <div>
                                            <h4 className="font-bold text-gray-900 group-hover:text-black">{title}</h4>
                                            <p className="text-xs text-gray-500 font-mono mt-1">{variant.sku ? `SKU: ${variant.sku}` : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-gray-900 text-base md:text-lg">₹{Number(variant.price ?? 0)}</p>
                                            <p className={`text-xs font-bold mt-1 ${hasStock ? 'text-green-600' : 'text-red-500'}`}>
                                                {hasStock ? `${stock} in stock` : 'Out of stock'}
                                            </p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
