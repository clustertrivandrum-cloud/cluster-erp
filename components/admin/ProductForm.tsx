'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from './ImageUpload'
import { createProduct, getCategories } from '@/lib/actions/product-actions'
import { Plus, Trash2, X, Image as ImageIcon, ChevronRight, AlertCircle, Save, ArrowLeft } from 'lucide-react'
import KeyValueEditor from './KeyValueEditor'
import CustomizationBuilder from './CustomizationBuilder'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Label from '@/components/ui/Label'

interface Option {
    id: string
    name: string
    values: string[]
}

interface Variant {
    id: string
    title: string
    options: Record<string, string>
    price: number
    sku: string
    quantity: number
    images: string[]
    compare_at_price?: number
    cost_price?: number
    barcode?: string
    weight_value?: number
    weight_unit?: string
    dimension_length?: number
    dimension_width?: number
    dimension_height?: number
    dimension_unit?: string
    reorder_point?: number
    bin_location?: string
}

export default function ProductForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [images, setImages] = useState<string[]>([])
    const [options, setOptions] = useState<Option[]>([])
    const [variants, setVariants] = useState<Variant[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string, parent_id: string | null }[]>([])
    const [selectedParentId, setSelectedParentId] = useState<string>('')
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('')
    const [activeVariantTab, setActiveVariantTab] = useState('general')
    const [specifications, setSpecifications] = useState<Record<string, string>>({})
    const [customizationTemplate, setCustomizationTemplate] = useState<Record<string, string | string[]>>({})

    useEffect(() => {
        getCategories().then(setCategories)
    }, [])

    // Modal state for editing variant images
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null)

    // Helper to generate combinations
    useEffect(() => {
        if (options.length === 0) {
            setVariants([])
            return
        }

        const generateCombinations = (opts: Option[], currentCombo: Record<string, string> = {}): Record<string, string>[] => {
            if (opts.length === 0) {
                return [currentCombo]
            }

            const [first, ...rest] = opts
            const combinations: Record<string, string>[] = []

            for (const value of first.values) {
                combinations.push(...generateCombinations(rest, { ...currentCombo, [first.name]: value }))
            }

            return combinations
        }

        // Only generate if all options have at least one value
        if (options.some(opt => opt.values.length === 0)) return

        const combos = generateCombinations(options)

        // Map combos to variants, preserving existing data if possible
        const newVariants = combos.map((combo, index) => {
            const title = Object.values(combo).join(' / ')
            // specific logic to try and keep existing values could go here, 
            // but for now we regenerate. 
            // Improve: look for existing variant with same options to preserve price/sku
            const existing = variants.find(v =>
                JSON.stringify(v.options) === JSON.stringify(combo)
            )

            return existing || {
                id: crypto.randomUUID(),
                title,
                options: combo,
                price: 0,
                sku: '',
                quantity: 0,
                images: [],
                compare_at_price: 0,
                cost_price: 0,
                barcode: '',
                weight_value: 0,
                weight_unit: 'g',
                dimension_length: 0,
                dimension_width: 0,
                dimension_height: 0,
                dimension_unit: 'cm',
                reorder_point: 10,
                bin_location: '',
            }
        })

        setVariants(newVariants)
    }, [options]) // Watch options to regenerate variants

    const addOption = () => {
        setOptions([...options, { id: crypto.randomUUID(), name: '', values: [] }])
    }

    const removeOption = (index: number) => {
        const newOptions = [...options]
        newOptions.splice(index, 1)
        setOptions(newOptions)
    }

    const updateOptionName = (index: number, name: string) => {
        const newOptions = [...options]
        newOptions[index].name = name
        setOptions(newOptions)
    }

    const addOptionValue = (index: number, value: string) => {
        if (!value.trim()) return
        const newOptions = [...options]
        if (!newOptions[index].values.includes(value)) {
            newOptions[index].values.push(value)
            setOptions(newOptions)
        }
    }

    const removeOptionValue = (optionIndex: number, valueIndex: number) => {
        const newOptions = [...options]
        newOptions[optionIndex].values.splice(valueIndex, 1)
        setOptions(newOptions)
    }

    const updateVariant = (index: number, field: keyof Variant, value: any) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], [field]: value }
        setVariants(newVariants)
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)
        const formData = new FormData(event.currentTarget)

        // Validation for variants
        if (options.length > 0 && variants.length === 0) {
            alert("Please add at least one option value to generate variants.")
            setLoading(false)
            return
        }

        // Pass complex data as JSON strings
        formData.append('options', JSON.stringify(options))
        formData.append('variants', JSON.stringify(variants))
        formData.append('images', JSON.stringify(images))

        const result = await createProduct(formData)

        if (result?.error) {
            alert(result.error)
        }

        setLoading(false)
    }

    return (
        <div className="max-w-5xl mx-auto pb-10">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add New Product</h1>
                        <p className="text-sm text-gray-500 mt-1">Create a new product with details, variants, and inventory.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Main Details */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Basic Info Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Product Information</h3>
                        </div>
                        <div className="p-4 md:p-6 space-y-6">
                            <div className="space-y-4">
                                <Input
                                    label="Title"
                                    required
                                    name="title"
                                    type="text"
                                    placeholder="e.g. Premium Cotton T-Shirt"
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Slug (URL Handle)"
                                        required
                                        name="slug"
                                        type="text"
                                        placeholder="premium-cotton-t-shirt"
                                    />

                                </div>
                                <Textarea
                                    label="Description"
                                    name="description"
                                    rows={4}
                                    placeholder="Describe your product..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Media Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Media</h3>
                        </div>
                        <div className="p-4 md:p-6">
                            <ImageUpload
                                value={images}
                                onChange={(urls) => setImages(urls)}
                                onRemove={(url) => setImages(images.filter((current) => current !== url))}
                            />
                            <p className="text-sm text-gray-500 mt-2">Upload general product images here. Variant-specific images can be added in the variants section.</p>
                        </div>
                    </div>

                    {/* Product Details (ERP/Jewellery) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Product Details</h3>
                        </div>
                        <div className="p-4 md:p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Brand"
                                    name="brand"
                                    type="text"
                                    placeholder="e.g. Tanishq, Gucci"
                                />
                                <Input
                                    label="Material"
                                    name="material"
                                    type="text"
                                    placeholder="e.g. Gold 22k, Cotton"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    placeholder="e.g. India"
                                />
                                <Input
                                    label="Collection"
                                    name="collection"
                                    type="text"
                                    placeholder="e.g. Bridal 2024"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Season"
                                    name="season"
                                    type="text"
                                    placeholder="e.g. SS24, FW24"
                                />
                                <Input
                                    label="Warranty Period"
                                    name="warranty_period"
                                    type="text"
                                    placeholder="e.g. 1 Year, Lifetime"
                                />
                            </div>
                            <Textarea
                                label="Care Instructions"
                                name="care_instructions"
                                rows={3}
                                placeholder="e.g. Keep away from water, Dry clean only..."
                            />

                            <div>
                                <Label>Features (Bullet Points)</Label>
                                <p className="text-xs text-gray-500 mb-2">Enter each feature on a new line.</p>
                                <Textarea
                                    name="features"
                                    rows={5}
                                    placeholder="- Handcrafted&#10;- Hypoallergenic&#10;- Certified Gemstones"
                                />
                            </div>

                            <div>
                                <Label>Specifications</Label>
                                <p className="text-xs text-gray-500 mb-2">Technical specs like Purity or Gemstone.</p>
                                <KeyValueEditor
                                    initialValue={specifications}
                                    onChange={setSpecifications}
                                />
                                <input
                                    type="hidden"
                                    name="specifications"
                                    value={JSON.stringify(specifications)}
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex items-center space-x-3 mb-4">
                                    <input
                                        type="checkbox"
                                        id="is_customizable"
                                        name="is_customizable"
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="is_customizable" className="text-sm font-medium text-gray-700">
                                        Is Customizable? (e.g. Engraving, Sizing)
                                    </label>
                                </div>

                                <div>
                                    <Label>Customization Options</Label>
                                    <p className="text-xs text-gray-500 mb-2">Define options for customers (e.g. Ring Size, Engraving).</p>
                                    <CustomizationBuilder
                                        initialValue={customizationTemplate}
                                        onChange={setCustomizationTemplate}
                                    />
                                    <input
                                        type="hidden"
                                        name="customization_template"
                                        value={JSON.stringify(customizationTemplate)}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Select
                                    label="Shipping Class"
                                    name="shipping_class"
                                >
                                    <option value="standard">Standard Shipping</option>
                                    <option value="express">Express / Air</option>
                                    <option value="insured-high-value">Insured (High Value)</option>
                                </Select>
                                <Textarea
                                    label="Return Policy"
                                    name="return_policy"
                                    rows={1}
                                    placeholder="e.g. No Returns for Custom Items"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Variants Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-base font-semibold text-gray-900">Variants</h3>
                            <button
                                type="button"
                                onClick={addOption}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Option
                            </button>
                        </div>
                        <div className="p-4 md:p-6 space-y-6">

                            {/* Options List */}
                            {options.length > 0 ? (
                                <div className="space-y-4">
                                    {options.map((option, index) => (
                                        <div key={option.id} className="relative group bg-white border border-gray-200 rounded-lg p-5 hover:border-indigo-300 transition-colors">
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(index)}
                                                    className="text-gray-400 hover:text-red-600 p-1"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                                <div className="md:col-span-4">
                                                    <Input
                                                        label="Option Name"
                                                        type="text"
                                                        value={option.name}
                                                        onChange={(e) => updateOptionName(index, e.target.value)}
                                                        placeholder="e.g. Size, Color"
                                                    />
                                                </div>
                                                <div className="md:col-span-8">
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Option Values</label>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {option.values.map((val, vIndex) => (
                                                            <span key={vIndex} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                {val}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeOptionValue(index, vIndex)}
                                                                    className="ml-1.5 text-indigo-400 hover:text-indigo-900"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Type value & hit Enter..."
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        addOptionValue(index, e.currentTarget.value)
                                                                        e.currentTarget.value = ''
                                                                    }
                                                                }}
                                                                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs py-1.5"
                                                            />
                                                            <span className="absolute right-2 top-1.5 text-xs text-gray-400 pointer-events-none">↵</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                                    <p className="text-sm text-gray-500">No options added. Add options like Size or Color to generate variants.</p>
                                </div>
                            )}

                            {/* Generated Variants Table */}
                            {variants.length > 0 && (
                                <div className="mt-8">
                                    <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
                                        <ChevronRight className="w-4 h-4 text-indigo-600 mr-1" />
                                        Preview & Edit Variants
                                    </h4>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider pl-6">Variant</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Price</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">SKU</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Qty</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Images</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {variants.map((variant, index) => (
                                                        <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 pl-6 border-r border-transparent">
                                                                {variant.title}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                <div className="relative rounded-md shadow-sm">
                                                                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                                        <span className="text-gray-500 sm:text-xs">₹</span>
                                                                    </div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={variant.price}
                                                                        onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value))}
                                                                        className="block w-full pl-6 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-1"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                <input
                                                                    type="text"
                                                                    value={variant.sku}
                                                                    onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                                                    className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-1"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                <input
                                                                    type="number"
                                                                    value={variant.quantity}
                                                                    onChange={(e) => updateVariant(index, 'quantity', parseInt(e.target.value))}
                                                                    className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-1"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingVariantId(variant.id)}
                                                                    className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${variant.images.length > 0
                                                                        ? 'border-transparent text-indigo-700 bg-indigo-100 hover:bg-indigo-200'
                                                                        : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                                                                    {variant.images.length > 0 ? `${variant.images.length}` : 'Add'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingVariantId(variant.id)}
                                                                    className="ml-2 text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                                                                >
                                                                    Edit Details
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SEO Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Search Engine Optimization</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <Input
                                label="SEO Title"
                                name="seo_title"
                                type="text"
                                helperText="Optimal length is 50-60 characters."
                            />
                            <Textarea
                                label="SEO Description"
                                name="seo_description"
                                rows={3}
                                helperText="Optimal length is 150-160 characters."
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Organization & Status */}
                <div className="lg:col-span-1 space-y-8">

                    {/* Status Card */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Organization</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <Select
                                label="Status"
                                name="status"
                            >
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="archived">Archived</option>
                            </Select>



                            <div>
                                <Label>Category</Label>
                                <div className="space-y-3">
                                    <Select
                                        value={selectedParentId}
                                        onChange={(e) => {
                                            setSelectedParentId(e.target.value)
                                            setSelectedSubCategoryId('')
                                        }}
                                    >
                                        <option value="">Select Main Category</option>
                                        {categories.filter(c => !c.parent_id).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </Select>

                                    {/* Subcategory Select - Show only if parent selected */}
                                    {selectedParentId && (
                                        <Select
                                            value={selectedSubCategoryId}
                                            onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                                        >
                                            <option value="">Select Subcategory (Optional)</option>
                                            {categories.filter(c => c.parent_id === selectedParentId).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </Select>
                                    )}

                                    {/* Hidden input for form submission - prioritize subcategory if selected */}
                                    <input
                                        type="hidden"
                                        name="category_id"
                                        value={selectedSubCategoryId || selectedParentId}
                                    />
                                </div>
                            </div>

                            <Select
                                label="Gender / Target Audience"
                                name="gender"
                            >
                                <option value="">Select Gender</option>
                                <option value="Women">Women</option>
                                <option value="Men">Men</option>
                                <option value="Kids">Kids</option>
                                <option value="Unisex">Unisex</option>
                            </Select>

                            <Input
                                label="HSN Code"
                                name="hs_code"
                                type="text"
                                placeholder="e.g. 7113"
                                helperText="Harmonized System of Nomenclature for GST."
                            />
                            <Input
                                label="Tags"
                                name="tags"
                                type="text"
                                placeholder="Summer, Sale, New"
                                helperText="Comma separated."
                            />

                            <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <input
                                    type="checkbox"
                                    id="is_featured"
                                    name="is_featured"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">
                                    Feature this product
                                </label>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-gray-100"></div>

                            {/* If Simple Product (No Variants) - Show Base Pricing/Inventory Here or Main Column?
                                Better to keep consistent. If no variants, show fields in main column or here.
                                Let's put them here for simple access in sidebar or creating a separate card if lengthy.
                                Actually, for better UX, let's put them in a separate card in the main column if strictly needed, 
                                but fitting them in the sidebar is tight. Let's move them to a main column card if no variants.
                            */}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Product
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Simple Product Support (Pricing/Inventory) - Show if no variants */}
                {options.length === 0 && (
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-base font-semibold text-gray-900">Pricing & Inventory</h3>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pricing</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Price"
                                            required
                                            name="price"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                        <Input
                                            label="Compare at"
                                            name="compare_at_price"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                        />
                                        <div className="col-span-2">
                                            <Input
                                                label="Cost per item"
                                                name="cost_price"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                helperText="Customers won’t see this."
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Inventory</h4>
                                    <div className="space-y-4">
                                        <Input
                                            label="SKU (Stock Keeping Unit)"
                                            name="sku"
                                            type="text"
                                            placeholder="Auto-generated if blank"
                                            helperText="Leave blank to auto-generate (Starts with CF-)."
                                        />
                                        <Input
                                            label="Barcode (ISBN, UPC, GTIN, etc.)"
                                            name="barcode"
                                            type="text"
                                        />
                                        <div className="grid grid-cols-3 gap-4">
                                            <Input
                                                label="Quantity"
                                                name="quantity"
                                                type="number"
                                                defaultValue={0}
                                            />
                                            <Input
                                                label="Reorder Point"
                                                name="reorder_point"
                                                type="number"
                                                defaultValue={10}
                                                helperText="Low stock alert level"
                                            />
                                            <Input
                                                label="Bin Location"
                                                name="bin_location"
                                                type="text"
                                                placeholder="e.g. A-12"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </form>

            {/* Variant Image Modal */}
            {editingVariantId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 md:mx-auto flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 md:p-6 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    Variant Images
                                </h3>
                                <p className="text-sm text-gray-500 max-w-sm truncate">
                                    {variants.find(v => v.id === editingVariantId)?.title}
                                </p>
                            </div>
                            <button onClick={() => setEditingVariantId(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex border-b border-gray-100 px-6">
                            {['general', 'pricing', 'inventory', 'shipping'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveVariantTab(tab)}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${activeVariantTab === tab
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {activeVariantTab === 'general' && (
                                <div className="space-y-6">
                                    <ImageUpload
                                        value={variants.find(v => v.id === editingVariantId)?.images || []}
                                        onChange={(urls) => {
                                            const index = variants.findIndex(v => v.id === editingVariantId)
                                            if (index !== -1) updateVariant(index, 'images', urls)
                                        }}
                                        onRemove={(url) => {
                                            const index = variants.findIndex(v => v.id === editingVariantId)
                                            if (index !== -1) {
                                                const currentImages = variants[index].images
                                                updateVariant(index, 'images', currentImages.filter(img => img !== url))
                                            }
                                        }}
                                    />
                                    <Input
                                        label="Barcode/ISBN"
                                        type="text"
                                        value={variants.find(v => v.id === editingVariantId)?.barcode || ''}
                                        onChange={(e) => {
                                            const index = variants.findIndex(v => v.id === editingVariantId)
                                            if (index !== -1) updateVariant(index, 'barcode', e.target.value)
                                        }}
                                        helperText="Universal Product Code"
                                    />
                                </div>
                            )}

                            {activeVariantTab === 'pricing' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Cost Price"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.cost_price || ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) updateVariant(index, 'cost_price', parseFloat(e.target.value))
                                            }}
                                            helperText="Your purchase cost"
                                        />
                                        <Input
                                            label="Compare At Price"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.compare_at_price || ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) updateVariant(index, 'compare_at_price', parseFloat(e.target.value))
                                            }}
                                            helperText="Original price (strikethrough)"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeVariantTab === 'inventory' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Reorder Point"
                                        type="number"
                                        value={variants.find(v => v.id === editingVariantId)?.reorder_point || 10}
                                        onChange={(e) => {
                                            const index = variants.findIndex(v => v.id === editingVariantId)
                                            if (index !== -1) updateVariant(index, 'reorder_point', parseInt(e.target.value))
                                        }}
                                        helperText="Alert when stock is low"
                                    />
                                    <Input
                                        label="Bin Location"
                                        type="text"
                                        value={variants.find(v => v.id === editingVariantId)?.bin_location || ''}
                                        onChange={(e) => {
                                            const index = variants.findIndex(v => v.id === editingVariantId)
                                            if (index !== -1) updateVariant(index, 'bin_location', e.target.value)
                                        }}
                                        placeholder="e.g. Rack A-12"
                                    />
                                </div>
                            )}

                            {activeVariantTab === 'shipping' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Weight"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.weight_value || ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) updateVariant(index, 'weight_value', parseFloat(e.target.value))
                                            }}
                                        />
                                        <Select
                                            label="Unit"
                                            value={variants.find(v => v.id === editingVariantId)?.weight_unit || 'g'}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) updateVariant(index, 'weight_unit', e.target.value)
                                            }}
                                        >
                                            <option value="g">g (Grams)</option>
                                            <option value="ct">ct (Carats)</option>
                                            <option value="kg">kg (Kilograms)</option>
                                        </Select>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Dimensions (L x W x H)</label>
                                        <div className="grid grid-cols-4 gap-4">
                                            <Input
                                                label="Length"
                                                type="number"
                                                step="0.01"
                                                value={variants.find(v => v.id === editingVariantId)?.dimension_length || ''}
                                                onChange={(e) => {
                                                    const index = variants.findIndex(v => v.id === editingVariantId)
                                                    if (index !== -1) updateVariant(index, 'dimension_length', parseFloat(e.target.value))
                                                }}
                                            />
                                            <Input
                                                label="Width"
                                                type="number"
                                                step="0.01"
                                                value={variants.find(v => v.id === editingVariantId)?.dimension_width || ''}
                                                onChange={(e) => {
                                                    const index = variants.findIndex(v => v.id === editingVariantId)
                                                    if (index !== -1) updateVariant(index, 'dimension_width', parseFloat(e.target.value))
                                                }}
                                            />
                                            <Input
                                                label="Height"
                                                type="number"
                                                step="0.01"
                                                value={variants.find(v => v.id === editingVariantId)?.dimension_height || ''}
                                                onChange={(e) => {
                                                    const index = variants.findIndex(v => v.id === editingVariantId)
                                                    if (index !== -1) updateVariant(index, 'dimension_height', parseFloat(e.target.value))
                                                }}
                                            />
                                            <Select
                                                label="Unit"
                                                value={variants.find(v => v.id === editingVariantId)?.dimension_unit || 'cm'}
                                                onChange={(e) => {
                                                    const index = variants.findIndex(v => v.id === editingVariantId)
                                                    if (index !== -1) updateVariant(index, 'dimension_unit', e.target.value)
                                                }}
                                            >
                                                <option value="cm">cm</option>
                                                <option value="in">in</option>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-xl flex justify-end">
                            <button
                                type="button"
                                onClick={() => setEditingVariantId(null)}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
