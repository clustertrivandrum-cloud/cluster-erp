'use client'

import { useState, useEffect } from 'react'
import { getInventoryItems, getInventoryStats, updateStock, updateBinLocation, type InventoryItem } from '@/lib/actions/inventory-actions'
import { Search, Filter, AlertTriangle, Package, XCircle, Edit2, Check, X, MapPin } from 'lucide-react'
import Input from '@/components/ui/Input'

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([])
    const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, outOfStock: 0 })
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<{ quantity: number, bin: string }>({ quantity: 0, bin: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async (query?: string) => {
        setLoading(true)
        const [itemsData, statsData] = await Promise.all([
            getInventoryItems(query),
            getInventoryStats()
        ])
        setItems(itemsData)
        setStats(statsData)
        setLoading(false)
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        loadData(searchQuery)
    }

    const startEdit = (item: InventoryItem) => {
        setEditingId(item.id)
        setEditForm({ quantity: item.quantity, bin: item.bin_location || '' })
    }

    const cancelEdit = () => {
        setEditingId(null)
    }

    const saveEdit = async () => {
        if (!editingId) return
        setSaving(true)

        // Parallel updates
        await Promise.all([
            updateStock(editingId, editForm.quantity),
            updateBinLocation(editingId, editForm.bin)
        ])

        await loadData(searchQuery) // Reload to get fresh state
        setEditingId(null)
        setSaving(false)
    }

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-6">Inventory Management</h1>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div className="p-3 bg-gray-50 rounded-full mr-4">
                        <Package className="w-6 h-6 text-gray-900" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Variants</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div className="p-3 bg-yellow-50 rounded-full mr-4">
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Low Stock</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div className="p-3 bg-red-50 rounded-full mr-4">
                        <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Out of Stock</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.outOfStock}</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Product Name or SKU..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-gray-900 focus:border-gray-900 sm:text-sm text-gray-900 placeholder:text-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors">
                        Search
                    </button>
                </form>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product / Variant</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bin Loc</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock Level</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading inventory...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No products found.</td></tr>
                        ) : (
                            items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {item.product_image && (
                                                <img src={item.product_image} alt="" className="h-10 w-10 rounded-md object-cover mr-3" />
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{item.product_title}</div>
                                                <div className="text-sm text-gray-500">{item.title !== 'Default Variant' ? item.title : ''}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {item.sku || '-'}
                                    </td>

                                    {/* Editable Fields Logic */}
                                    {editingId === item.id ? (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <MapPin className="w-4 h-4 text-gray-400 mr-1" />
                                                    <input
                                                        type="text"
                                                        value={editForm.bin}
                                                        onChange={(e) => setEditForm({ ...editForm, bin: e.target.value })}
                                                        className="w-20 p-1 text-sm border border-gray-300 rounded focus:ring-gray-900 focus:border-gray-900 text-gray-900 placeholder:text-gray-400"
                                                        placeholder="A-01"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <input
                                                    type="number"
                                                    value={editForm.quantity}
                                                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                                                    className="w-24 p-1 text-sm border border-gray-300 rounded focus:ring-gray-900 focus:border-gray-900 text-right text-gray-900 placeholder:text-gray-400"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-xs text-gray-400 italic">Editing...</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end space-x-2">
                                                    <button onClick={saveEdit} disabled={saving} className="text-green-600 hover:text-green-900 p-1">
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={cancelEdit} disabled={saving} className="text-gray-400 hover:text-gray-600 p-1">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {item.bin_location ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        {item.bin_location}
                                                    </span>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {item.status === 'out_of_stock' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        Out of Stock
                                                    </span>
                                                )}
                                                {item.status === 'low_stock' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        Low Stock
                                                    </span>
                                                )}
                                                {item.status === 'in_stock' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        In Stock
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => startEdit(item)} className="text-gray-900 hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
