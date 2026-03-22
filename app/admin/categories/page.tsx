'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { deleteCategory, getCategoryOptions, getCategoryPage, type CategoryRecord } from '@/lib/actions/category-actions'
import { Plus, Pencil, Trash2, Search, Folder, FolderOpen } from 'lucide-react'
import CategoryForm from '@/components/admin/CategoryForm'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'
import PaginationBar from '@/components/ui/PaginationBar'

type CategoryOption = {
    id: string
    name: string
    parent_id: string | null
}

const PAGE_SIZE = 10

export default function CategoriesPage() {
    const [categories, setCategories] = useState<CategoryRecord[]>([])
    const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const loadCategories = useCallback(async (nextPage: number, nextQuery: string) => {
        setLoading(true)
        const result = await getCategoryPage({ page: nextPage, limit: PAGE_SIZE, query: nextQuery })
        setCategories(result.data || [])
        setCount(result.count || 0)
        setError(result.error || null)
        setPage(nextPage)
        setLoading(false)
    }, [])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            loadCategories(1, searchQuery)
        }, 200)

        return () => window.clearTimeout(timeoutId)
    }, [loadCategories, searchQuery])

    const openCategoryForm = async (category: CategoryRecord | null) => {
        setEditingCategory(category)
        setIsFormOpen(true)

        const options = await getCategoryOptions()
        setCategoryOptions(options)
    }

    const confirmDelete = (id: string) => {
        setDeletingId(id)
        setDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingId) return

        setIsDeleting(true)
        await deleteCategory(deletingId)
        setDeleteDialogOpen(false)
        setDeletingId(null)
        setIsDeleting(false)
        loadCategories(page, searchQuery)
    }

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Categories</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage product categories and subcategories.</p>
                </div>
                <button
                    onClick={() => openCategoryForm(null)}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Category</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                                        Loading categories...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-red-600">
                                        {error}
                                    </td>
                                </tr>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                                        No categories found.
                                    </td>
                                </tr>
                            ) : (
                                categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {category.image_url ? (
                                                    <div className="relative h-8 w-8 rounded-full overflow-hidden mr-3 bg-gray-100">
                                                        <Image src={category.image_url} alt="" fill sizes="32px" className="object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center mr-3 text-gray-900">
                                                        {category.parent_id ? <Folder className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{category.name}</div>
                                                    {category.description && <div className="text-xs text-gray-500 max-w-xs truncate">{category.description}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {category.slug}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {category.parent_id ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {category.parent_name || 'Unknown'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => openCategoryForm(category)}
                                                    className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(category.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PaginationBar
                page={page}
                totalItems={count}
                pageSize={PAGE_SIZE}
                onPageChange={(nextPage) => loadCategories(nextPage, searchQuery)}
            />

            {isFormOpen && (
                <CategoryForm
                    category={editingCategory}
                    categories={categoryOptions}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => {
                        loadCategories(page, searchQuery)
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
                title="Delete category?"
                message="This will permanently remove the category if it has no dependent records."
                confirmText="Delete"
                variant="danger"
                loading={isDeleting}
            />
        </div>
    )
}
