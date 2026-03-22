'use client'

import { useState } from 'react'
import { createCategory, updateCategory } from '@/lib/actions/category-actions'
import { X } from 'lucide-react'
import ImageUpload from '@/components/admin/ImageUpload'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Label from '@/components/ui/Label'

interface Category {
    id: string
    name: string
    slug: string
    description: string | null
    parent_id: string | null
    image_url: string | null
    banner_kicker?: string | null
    banner_title?: string | null
    banner_description?: string | null
    banner_image_url?: string | null
    banner_mobile_image_url?: string | null
}

interface CategoryOption {
    id: string
    name: string
    parent_id: string | null
}

interface CategoryFormProps {
    category?: Category | null
    categories: CategoryOption[]
    onClose: () => void
    onSuccess: () => void
}

export default function CategoryForm({ category, categories, onClose, onSuccess }: CategoryFormProps) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState(category?.name || '')
    const [slug, setSlug] = useState(category?.slug || '')
    const [parentId, setParentId] = useState(category?.parent_id || '')
    const [description, setDescription] = useState(category?.description || '')
    const [image, setImage] = useState<string>(category?.image_url || '')
    const [bannerKicker, setBannerKicker] = useState(category?.banner_kicker || '')
    const [bannerTitle, setBannerTitle] = useState(category?.banner_title || '')
    const [bannerDescription, setBannerDescription] = useState(category?.banner_description || '')
    const [bannerImage, setBannerImage] = useState<string>(category?.banner_image_url || '')
    const [bannerMobileImage, setBannerMobileImage] = useState<string>(category?.banner_mobile_image_url || '')

    const generateSlug = (val: string) => {
        return val.toLowerCase()
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, '')
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setName(val)
        if (!category) { // Only auto-gen slug on create
            setSlug(generateSlug(val))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData()
        formData.append('name', name)
        formData.append('slug', slug)
        formData.append('description', description)
        if (parentId) formData.append('parent_id', parentId)
        if (image) formData.append('image_url', image)
        if (bannerKicker) formData.append('banner_kicker', bannerKicker)
        if (bannerTitle) formData.append('banner_title', bannerTitle)
        if (bannerDescription) formData.append('banner_description', bannerDescription)
        if (bannerImage) formData.append('banner_image_url', bannerImage)
        if (bannerMobileImage) formData.append('banner_mobile_image_url', bannerMobileImage)

        let result
        if (category) {
            result = await updateCategory(category.id, formData)
        } else {
            result = await createCategory(formData)
        }

        setLoading(false)

        if (result?.error) {
            alert(result.error)
        } else {
            onSuccess()
            onClose()
        }
    }

    // Filter out self and children from parent selection to avoid cycles (simple check)
    const validParents = categories.filter(c => {
        if (!category) return true
        return c.id !== category.id // Basic check, ideally check recursive children too
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">
                        {category ? 'Edit Category' : 'Add New Category'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    <Input
                        label="Name"
                        required
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                    />

                    <Input
                        label="Slug"
                        required
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                    />

                    <Select
                        label="Parent Category"
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                    >
                        <option value="">None (Top Level)</option>
                        {validParents.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.parent_id ? '- ' : ''}{c.name}
                            </option>
                        ))}
                    </Select>

                    <Textarea
                        label="Description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <div>
                        <Label>Image</Label>
                        <div className="mt-1">
                            <ImageUpload
                                value={image ? [image] : []}
                                onChange={(url) => setImage(url)}
                                onRemove={() => setImage('')}
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-900">Category Banner</h4>
                            <p className="mt-1 text-xs text-gray-500">Used on the storefront category detail page.</p>
                        </div>

                        <div className="space-y-5">
                            <Input
                                label="Banner Kicker"
                                type="text"
                                value={bannerKicker}
                                onChange={(e) => setBannerKicker(e.target.value)}
                                placeholder="New arrivals"
                            />

                            <Input
                                label="Banner Title"
                                type="text"
                                value={bannerTitle}
                                onChange={(e) => setBannerTitle(e.target.value)}
                                placeholder={name || 'Category name'}
                            />

                            <Textarea
                                label="Banner Description"
                                rows={4}
                                value={bannerDescription}
                                onChange={(e) => setBannerDescription(e.target.value)}
                            />

                            <div>
                                <Label>Banner Image</Label>
                                <div className="mt-1">
                                    <ImageUpload
                                        value={bannerImage ? [bannerImage] : []}
                                        onChange={(url) => setBannerImage(url)}
                                        onRemove={() => setBannerImage('')}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Mobile Banner Image</Label>
                                <div className="mt-1">
                                    <ImageUpload
                                        value={bannerMobileImage ? [bannerMobileImage] : []}
                                        onChange={(url) => setBannerMobileImage(url)}
                                        onRemove={() => setBannerMobileImage('')}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-xl flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black font-medium text-sm transition-colors shadow-sm disabled:opacity-70"
                    >
                        {loading ? 'Saving...' : 'Save Category'}
                    </button>
                </div>
            </div>
        </div>
    )
}
