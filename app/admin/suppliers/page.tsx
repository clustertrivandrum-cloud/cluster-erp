'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Truck } from 'lucide-react'
import { deleteSupplier, getSupplierPage, type SupplierRecord } from '@/lib/actions/supplier-actions'
import SupplierForm from '@/components/admin/SupplierForm'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'
import PaginationBar from '@/components/ui/PaginationBar'

const PAGE_SIZE = 10

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const loadSuppliers = useCallback(async (nextPage: number, nextQuery: string) => {
        setLoading(true)
        const result = await getSupplierPage({ page: nextPage, limit: PAGE_SIZE, query: nextQuery })
        setSuppliers(result.data || [])
        setCount(result.count || 0)
        setError(result.error || null)
        setPage(nextPage)
        setLoading(false)
    }, [])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            loadSuppliers(1, searchQuery)
        }, 200)

        return () => window.clearTimeout(timeoutId)
    }, [loadSuppliers, searchQuery])

    const confirmDelete = (id: string) => {
        setDeletingId(id)
        setDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingId) return

        setIsDeleting(true)
        await deleteSupplier(deletingId)
        setDeleteDialogOpen(false)
        setDeletingId(null)
        setIsDeleting(false)
        loadSuppliers(page, searchQuery)
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Suppliers</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your vendors and supply chain partners.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingSupplier(null)
                        setIsFormOpen(true)
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Supplier
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3">Company</th>
                                <th className="px-6 py-3">Contact Person</th>
                                <th className="px-6 py-3">Contact Info</th>
                                <th className="px-6 py-3">Tax ID</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        Loading suppliers...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-red-600">
                                        {error}
                                    </td>
                                </tr>
                            ) : suppliers.length > 0 ? (
                                suppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-900 flex items-center justify-center mr-3">
                                                    <Truck className="h-4 w-4" />
                                                </div>
                                                {supplier.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {supplier.contact_person || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="flex flex-col">
                                                <span>{supplier.email}</span>
                                                <span className="text-xs text-gray-400">{supplier.phone}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {supplier.tax_id || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setEditingSupplier(supplier)
                                                        setIsFormOpen(true)
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(supplier.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Truck className="h-10 w-10 text-gray-300 mb-2" />
                                            <p className="text-base font-medium text-gray-900">No suppliers found</p>
                                            <p className="text-sm text-gray-400 mt-1">Get started by creating a new supplier.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationBar
                    page={page}
                    totalItems={count}
                    pageSize={PAGE_SIZE}
                    onPageChange={(nextPage) => loadSuppliers(nextPage, searchQuery)}
                />
            </div>

            {isFormOpen && (
                <SupplierForm
                    supplier={editingSupplier}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => {
                        loadSuppliers(page, searchQuery)
                        setIsFormOpen(false)
                    }}
                />
            )}

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setDeleteDialogOpen(false)
                        setDeletingId(null)
                    }
                }}
                onConfirm={handleDelete}
                title="Delete supplier?"
                message="This will permanently remove the supplier if it is not linked to existing purchase orders."
                confirmText="Delete"
                variant="danger"
                loading={isDeleting}
            />
        </div>
    )
}
