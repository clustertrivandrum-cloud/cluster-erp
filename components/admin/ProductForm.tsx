'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from './ImageUpload'
import { createProduct, updateProduct, getCategories } from '@/lib/actions/product-actions'
import { ArrowLeft, X, Save, Check, ChevronRight } from 'lucide-react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Dialog from '@/components/ui/Dialog'
import BasicInfoSection from './product/BasicInfoSection'
import MediaSection from './product/MediaSection'
import DetailsSection from './product/DetailsSection'
import VariantsSection from './product/VariantsSection'
import StatusSection from './product/StatusSection'
import { Option, Variant } from './product/types'

export default function ProductForm({ initialProduct }: { initialProduct?: any }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const [images, setImages] = useState<string[]>(initialProduct?.product_media?.map((m: any) => m.media_url) || [])
    const [options, setOptions] = useState<Option[]>(initialProduct?.product_options || [])
    const [variants, setVariants] = useState<Variant[]>(() => {
        if (!initialProduct) return []
        return initialProduct.product_variants?.map((v: any) => ({
            ...v,
            quantity: v.inventory_items?.[0]?.available_quantity || 0,
            reorder_point: v.inventory_items?.[0]?.reorder_point || 10,
            bin_location: v.inventory_items?.[0]?.bin_location || '',
            images: v.variant_media?.map((m: any) => m.media_url) || []
        })) || []
    })
    const [categories, setCategories] = useState<{ id: string, name: string, parent_id: string | null }[]>([])
    const [selectedParentId, setSelectedParentId] = useState<string>('')
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('')
    const [activeVariantTab, setActiveVariantTab] = useState('general')
    const [customizationTemplate, setCustomizationTemplate] = useState<Record<string, string | string[]>>(initialProduct?.customization_template || {})

    useEffect(() => {
        getCategories().then(cats => {
            setCategories(cats)
            if (initialProduct?.category_id) {
                const cat = cats.find(c => c.id === initialProduct.category_id)
                if (cat?.parent_id) {
                    setSelectedParentId(cat.parent_id)
                    setSelectedSubCategoryId(cat.id)
                } else if (cat) {
                    setSelectedParentId(cat.id)
                }
            }
        })
    }, [initialProduct])

    // Modal state for editing variant images
    const [editingVariantId, setEditingVariantId] = useState<string | null>(null)

    // Alert Dialog State
    const [alertOpen, setAlertOpen] = useState(false)
    const [alertMessage, setAlertMessage] = useState('')

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
            setAlertMessage("Please add at least one option value to generate variants.")
            setAlertOpen(true)
            setLoading(false)
            return
        }

        // Pass complex data as JSON strings
        formData.append('options', JSON.stringify(options))
        formData.append('variants', JSON.stringify(variants))
        formData.append('images', JSON.stringify(images))

        const result = initialProduct
            ? await updateProduct(initialProduct.id, formData)
            : await createProduct(formData)

        if (result?.error) {
            setAlertMessage(result.error)
            setAlertOpen(true)
        }

        setLoading(false)
    }

    const steps = [
        { id: 1, name: 'Basic Info' },
        { id: 2, name: 'Media' },
        { id: 3, name: 'Details' },
        { id: 4, name: 'Variants' },
        { id: 5, name: 'Pricing & Stock' },
        { id: 6, name: 'Publish' }
    ]

    const nextStep = () => {
        if (currentStep < steps.length) {
            setCurrentStep(prev => prev + 1)
            window.scrollTo(0, 0)
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1)
            window.scrollTo(0, 0)
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <button type="button" onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add New Product</h1>
                        <p className="text-sm text-gray-500 mt-1">Create a new product with details, variants, and inventory.</p>
                    </div>
                </div>
            </div>

            {/* Stepper */}
            <div className="mb-10 px-4 mt-6">
                <nav aria-label="Progress">
                    <ol role="list" className="flex items-center w-full shadow-sm bg-white rounded-lg px-6 py-10 sm:px-10 border border-gray-100 relative z-0">
                        {steps.map((step, stepIdx) => (
                            <li key={step.name} className={`relative flex items-center ${stepIdx !== steps.length - 1 ? 'flex-1' : ''}`}>
                                <div className="flex flex-col items-center relative z-10 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(step.id)}
                                        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-colors ${currentStep > step.id ? 'border-gray-900 bg-gray-900' :
                                            currentStep === step.id ? 'border-gray-900' : 'border-gray-300'
                                            }`}
                                    >
                                        {currentStep > step.id ? (
                                            <Check className="h-4 w-4 text-white" aria-hidden="true" />
                                        ) : (
                                            <span className={`h-2.5 w-2.5 rounded-full ${currentStep === step.id ? 'bg-gray-900' : 'bg-transparent'}`} aria-hidden="true" />
                                        )}
                                    </button>
                                    <span className={`mt-4 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-center absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'} ${currentStep === step.id ? 'block' : 'hidden sm:block'}`}>
                                        {step.name}
                                    </span>
                                </div>
                                {stepIdx !== steps.length - 1 && (
                                    <div className={`flex-1 h-[3px] mx-1 sm:mx-3 ${currentStep > step.id ? 'bg-gray-900' : 'bg-gray-200'}`} />
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 mt-[4.5rem]">

                {/* Step 1: Basic Info */}
                <div className={currentStep === 1 ? 'block' : 'hidden'}>
                    <BasicInfoSection initialData={initialProduct} />
                </div>

                {/* Step 2: Media */}
                <div className={currentStep === 2 ? 'block' : 'hidden'}>
                    <MediaSection images={images} setImages={setImages} />
                </div>

                {/* Step 3: Details */}
                <div className={currentStep === 3 ? 'block' : 'hidden'}>
                    <DetailsSection customizationTemplate={customizationTemplate} setCustomizationTemplate={setCustomizationTemplate} initialData={initialProduct} />
                </div>

                {/* Step 4: Variants */}
                <div className={currentStep === 4 ? 'block' : 'hidden'}>
                    <VariantsSection
                        options={options}
                        variants={variants}
                        addOption={addOption}
                        removeOption={removeOption}
                        updateOptionName={updateOptionName}
                        addOptionValue={addOptionValue}
                        removeOptionValue={removeOptionValue}
                        updateVariant={updateVariant}
                        setEditingVariantId={setEditingVariantId}
                    />
                </div>

                {/* Step 5: Pricing & Inventory */}
                <div className={currentStep === 5 ? 'block' : 'hidden'}>
                    {options.length > 0 ? (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-8 text-center">
                            <h3 className="text-lg font-medium text-blue-900 mb-2">Pricing & Inventory Handled by Variants</h3>
                            <p className="text-sm text-blue-700">Because this product has multiple variants (e.g. Size, Color), you manage the individual pricing, SKU, and quantities for each variant in the previous step.</p>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                className="mt-6 inline-flex justify-center items-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Go Back to Variants
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Pricing Card */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                    <h3 className="text-base font-semibold text-gray-900">Pricing</h3>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input
                                            label="Price *"
                                            required
                                            name="price"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            defaultValue={initialProduct?.product_variants?.[0]?.price}
                                        />
                                        <Input
                                            label="Compare at"
                                            name="compare_at_price"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            defaultValue={initialProduct?.product_variants?.[0]?.compare_at_price}
                                        />
                                        <div className="md:col-span-2">
                                            <Input
                                                label="Cost per item"
                                                name="cost_price"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                helperText="Customers won’t see this."
                                                defaultValue={initialProduct?.product_variants?.[0]?.cost_price}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Card */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                    <h3 className="text-base font-semibold text-gray-900">Inventory</h3>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Input
                                                label="SKU (Stock Keeping Unit) *"
                                                required
                                                name="sku"
                                                type="text"
                                                placeholder="Auto-generated if blank"
                                                helperText="Leave blank to auto-generate (Starts with CF-)."
                                                defaultValue={initialProduct?.product_variants?.[0]?.sku}
                                            />
                                            <Input
                                                label="Barcode (ISBN, UPC, GTIN, etc.)"
                                                name="barcode"
                                                type="text"
                                                defaultValue={initialProduct?.product_variants?.[0]?.barcode}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <Input
                                                label="Quantity *"
                                                required
                                                name="quantity"
                                                type="number"
                                                defaultValue={initialProduct?.product_variants?.[0]?.inventory_items?.[0]?.available_quantity || 0}
                                            />
                                            <Input
                                                label="Reorder Point"
                                                name="reorder_point"
                                                type="number"
                                                defaultValue={initialProduct?.product_variants?.[0]?.inventory_items?.[0]?.reorder_point || 10}
                                                helperText="Low stock alert level"
                                            />
                                            <Input
                                                label="Bin Location"
                                                name="bin_location"
                                                type="text"
                                                placeholder="e.g. A-12"
                                                defaultValue={initialProduct?.product_variants?.[0]?.inventory_items?.[0]?.bin_location}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 6: Publish / Organization */}
                <div className={currentStep === 6 ? 'block' : 'hidden'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <StatusSection
                            categories={categories}
                            selectedParentId={selectedParentId}
                            setSelectedParentId={setSelectedParentId}
                            selectedSubCategoryId={selectedSubCategoryId}
                            setSelectedSubCategoryId={setSelectedSubCategoryId}
                            loading={loading}
                            initialData={initialProduct}
                        />
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-base font-semibold text-gray-900">Search Engine Optimization</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <Input
                                    label="SEO Title"
                                    name="seo_title"
                                    type="text"
                                    helperText="Optimal length is 50-60 characters."
                                    defaultValue={initialProduct?.seo_title}
                                />
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">SEO Description</label>
                                    <textarea
                                        name="seo_description"
                                        rows={3}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm p-3"
                                        placeholder="Optimal length is 150-160 characters."
                                        defaultValue={initialProduct?.seo_description}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="pt-8 flex justify-between items-center bg-transparent mt-10 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className={`inline-flex justify-center items-center py-2.5 px-6 border shadow-sm text-sm font-medium rounded-lg transition-all ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900'}`}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </button>

                    {currentStep < steps.length ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="inline-flex justify-center items-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-gray-900 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all"
                        >
                            Next
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex justify-center items-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#0f9d58] hover:bg-[#0b8043] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0f9d58] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Publishing...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    {initialProduct ? 'Save Changes' : 'Publish Product'}
                                </>
                            )}
                        </button>
                    )}
                </div>
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
                                        ? 'border-gray-900 text-gray-900'
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
                                className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-black shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Simple Alert Dialog */}
            <Dialog
                isOpen={alertOpen}
                onClose={() => setAlertOpen(false)}
                title="Error"
            >
                <div className="mt-2">
                    <p className="text-sm text-gray-500">
                        {alertMessage}
                    </p>
                </div>

                <div className="mt-4">
                    <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                        onClick={() => setAlertOpen(false)}
                    >
                        Got it, thanks!
                    </button>
                </div>
            </Dialog>
        </div>
    )
}
