'use client'

import { useState, useEffect } from 'react'
import { getCategories, deleteCategory } from '@/lib/actions/category-actions'
import { Plus, Pencil, Trash2, Search, SlidersHorizontal, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import CategoryForm from '@/components/admin/CategoryForm'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'

interface Category {
    id: string
    name: string
    slug: string
    description: string | null
    parent_id: string | null
    image_url: string | null
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)

    const [deleteDTOpen, setDeleteDTOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchCategories = async () => {
        setLoading(true)
        const data = await getCategories()
        setCategories(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    const confirmDelete = (id: string) => {
        setDeletingId(id)
        setDeleteDTOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingId) return
        await deleteCategory(deletingId)
        setDeleteDTOpen(false)
        setDeletingId(null)
        fetchCategories()
    }

    const handleEdit = (category: Category) => {
        setEditingCategory(category)
        setIsFormOpen(true)
    }

    const handleAddNew = () => {
        setEditingCategory(null)
        setIsFormOpen(true)
    }

    const getParentName = (parentId: string | null) => {
        if (!parentId) return '-'
        return categories.find(c => c.id === parentId)?.name || 'Unknown'
    }

    // hierarchical sort or filtering
    // For now, simple list with parent column, searched
    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Optional: grouping by parent for display?
    // Let's stick to a flat table with "Parent" column for simplicity and searchability first. 
    // Or we can do a tree view. A flat table is easier for searching/pagination if we add it later.

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Categories</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage product categories and subcategories.</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                </button>
            </div>

            {/* Filters */}
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

            {/* Table */}
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
                            ) : filteredCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                                        No categories found.
                                    </td>
                                </tr>
                            ) : (
                                filteredCategories.map((category) => (
                                    <tr key={category.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {category.image_url ? (
                                                    <img src={category.image_url} alt="" className="h-8 w-8 rounded-full object-cover mr-3 bg-gray-100" />
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
                                                    {getParentName(category.parent_id)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => handleEdit(category)}
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

            {isFormOpen && (
                <CategoryForm
                    category={editingCategory}
                    categories={categories}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={() => {
                        fetchCategories()
                    }}
                />
            )}
        </div>
    )
}
