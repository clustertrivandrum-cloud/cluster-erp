'use client'

import { useState, useEffect, useRef } from 'react'
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
import type { StatusSectionInitialData } from './product/StatusSection'

type Category = {
    id: string
    name: string
    parent_id: string | null
}

type ProductMediaRow = {
    media_url?: string | null
    position?: number | null
}

type ProductOptionValueRow = {
    id?: string
    value?: string | null
    position?: number | null
}

type ProductOptionMetaRow = {
    name?: string | null
    position?: number | null
}

type VariantOptionValueLinkRow = {
    product_option_values?: (ProductOptionValueRow & {
        product_options?: ProductOptionMetaRow | null
    }) | null
}

type ProductOptionRow = {
    id: string
    name?: string | null
    position?: number | null
    values?: string[] | null
    product_option_values?: ProductOptionValueRow[] | null
}

type InventoryItemRow = {
    available_quantity?: number | null
    reorder_point?: number | null
    bin_location?: string | null
}

type ProductVariantRow = {
    id: string
    title?: string | null
    option_signature?: string | null
    sku?: string | null
    barcode?: string | null
    price?: number | null
    compare_at_price?: number | null
    cost_price?: number | null
    quantity?: number | null
    reorder_point?: number | null
    bin_location?: string | null
    weight_value?: number | null
    weight_unit?: string | null
    dimension_length?: number | null
    dimension_width?: number | null
    dimension_height?: number | null
    dimension_unit?: string | null
    images?: string[] | null
    inventory_items?: InventoryItemRow[] | null
    variant_media?: ProductMediaRow[] | null
    variant_option_values?: VariantOptionValueLinkRow[] | null
    allow_preorder?: boolean | null
}

type InitialProduct = {
    id: string
    category_id?: string | null
    product_media?: ProductMediaRow[] | null
    product_options?: ProductOptionRow[] | null
    product_variants?: ProductVariantRow[] | null
    customization_template?: Record<string, string | string[]> | null
    brand?: string | null
    hs_code?: string | null
    is_featured?: boolean | null
    material?: string | null
    origin_country?: string | null
    collection?: string | null
    warranty_period?: string | null
    care_instructions?: string | null
    features?: string[] | null
    is_customizable?: boolean | null
    shipping_class?: string | null
    return_policy?: string | null
    seo_title?: string | null
    seo_description?: string | null
} & StatusSectionInitialData

const sortByPosition = <T extends { position?: number | null }>(left: T, right: T) => {
    return (left.position || 0) - (right.position || 0)
}

const getOrderedVariantEntries = (
    optionValues: Record<string, string> = {},
    optionOrder: string[] = Object.keys(optionValues)
) => {
    const normalizedOptionLookup = new Map<string, string>()

    Object.entries(optionValues).forEach(([name, value]) => {
        const trimmedName = name.trim()
        const trimmedValue = value.trim()

        if (!trimmedName || !trimmedValue) {
            return
        }

        normalizedOptionLookup.set(trimmedName, trimmedValue)
    })

    return optionOrder
        .map((name) => {
            const trimmedName = name.trim()
            const value = normalizedOptionLookup.get(trimmedName)

            if (!trimmedName || !value) {
                return null
            }

            return [trimmedName, value] as const
        })
        .filter(Boolean) as Array<readonly [string, string]>
}

const buildVariantOptionSignature = (
    options: Record<string, string> = {},
    optionOrder: string[] = Object.keys(options)
) => {
    const sortedEntries = getOrderedVariantEntries(options, optionOrder)
        .map(([name, value]) => [name.trim().toLowerCase(), value.trim().toLowerCase()] as const)

    return sortedEntries.length > 0 ? JSON.stringify(sortedEntries) : null
}

const buildVariantValueSignature = (values: Array<string | null | undefined> = []) => {
    const normalizedValues = values
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))

    return normalizedValues.length > 0 ? JSON.stringify(normalizedValues) : null
}

const hydrateOptions = (initialProduct?: InitialProduct): Option[] => {
    if (!initialProduct?.product_options) {
        return []
    }

    return initialProduct.product_options
        .slice()
        .sort(sortByPosition)
        .map((option) => ({
            id: option.id,
            name: option.name || '',
            values: (option.values || option.product_option_values?.slice().sort(sortByPosition).map((value) => value.value || ''))
                ?.filter(Boolean) || [],
        }))
}

const hydrateVariants = (initialProduct?: InitialProduct): Variant[] => {
    if (!initialProduct?.product_variants) {
        return []
    }

    return initialProduct.product_variants.map((variant) => {
        const orderedOptionEntries = (variant.variant_option_values || [])
            .slice()
            .sort((left, right) => {
                const leftOptionPosition = left.product_option_values?.product_options?.position || 0
                const rightOptionPosition = right.product_option_values?.product_options?.position || 0

                if (leftOptionPosition !== rightOptionPosition) {
                    return leftOptionPosition - rightOptionPosition
                }

                return (left.product_option_values?.position || 0) - (right.product_option_values?.position || 0)
            })
            .map((link) => {
                const optionName = link.product_option_values?.product_options?.name
                const optionValue = link.product_option_values?.value

                if (!optionName || !optionValue) {
                    return null
                }

                return [optionName, optionValue] as const
            })
            .filter(Boolean) as Array<readonly [string, string]>

        const optionMap = Object.fromEntries(orderedOptionEntries)
        const optionOrder = orderedOptionEntries.map(([name]) => name)
        const title = variant.title || orderedOptionEntries.map(([, value]) => value).join(' / ') || variant.sku || 'Variant'

        return {
            id: variant.id,
            title,
            option_signature: buildVariantOptionSignature(optionMap, optionOrder) || variant.option_signature || null,
            options: optionMap,
            sku: variant.sku ?? '',
            barcode: variant.barcode ?? '',
            price: Number(variant.price ?? 0),
            compare_at_price: variant.compare_at_price ?? null,
            cost_price: variant.cost_price ?? null,
            quantity: Number(variant.inventory_items?.[0]?.available_quantity ?? variant.quantity ?? 0),
            reorder_point: Number(variant.inventory_items?.[0]?.reorder_point ?? variant.reorder_point ?? 10),
            bin_location: variant.inventory_items?.[0]?.bin_location || variant.bin_location || '',
            images: variant.variant_media
                ?.slice()
                .sort(sortByPosition)
                .map((media) => media.media_url)
                .filter((url): url is string => Boolean(url)) || variant.images?.filter(Boolean) || [],
            weight_value: variant.weight_value ?? 0,
            weight_unit: variant.weight_unit ?? 'g',
            dimension_length: variant.dimension_length ?? 0,
            dimension_width: variant.dimension_width ?? 0,
            dimension_height: variant.dimension_height ?? 0,
            dimension_unit: variant.dimension_unit ?? 'cm',
            allow_preorder: variant.allow_preorder ?? false,
        }
    })
}

const generateCombinations = (
    optionList: Option[],
    currentCombo: Record<string, string> = {}
): Record<string, string>[] => {
    if (optionList.length === 0) {
        return [currentCombo]
    }

    const [first, ...rest] = optionList
    const combinations: Record<string, string>[] = []

    for (const value of first.values) {
        combinations.push(...generateCombinations(rest, { ...currentCombo, [first.name]: value }))
    }

    return combinations
}

const regenerateVariants = (nextOptions: Option[], currentVariants: Variant[]): Variant[] => {
    if (nextOptions.length === 0) {
        return []
    }

    if (nextOptions.some((option) => !option.name.trim() || option.values.length === 0)) {
        return currentVariants
    }

    const combos = generateCombinations(nextOptions)
    const optionOrder = nextOptions.map((option) => option.name)

    return combos.map((combo) => {
        const title = Object.values(combo).join(' / ')
        const optionSignature = buildVariantOptionSignature(combo, optionOrder)
        const valueSignature = buildVariantValueSignature(Object.values(combo))
        const existing = currentVariants.find((variant) => {
            const existingSignature = variant.option_signature || buildVariantOptionSignature(variant.options, optionOrder)
            if (existingSignature === optionSignature) {
                return true
            }

            const existingValueSignature = buildVariantValueSignature(Object.values(variant.options))
            if (existingValueSignature && existingValueSignature === valueSignature) {
                return true
            }

            return variant.title.trim().toLowerCase() === title.trim().toLowerCase()
        })

        if (existing) {
            return {
                ...existing,
                title,
                option_signature: optionSignature,
                options: combo,
            }
        }

        return {
            id: crypto.randomUUID(),
            title,
            option_signature: optionSignature,
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
            allow_preorder: false,
        }
    })
}

export default function ProductForm({ initialProduct }: { initialProduct?: InitialProduct }) {
    const router = useRouter()
    const formRef = useRef<HTMLFormElement | null>(null)
    const initialPrimaryVariant = initialProduct?.product_variants?.[0]
    const initialPrimaryInventory = initialPrimaryVariant?.inventory_items?.[0]
    const [loading, setLoading] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const [images, setImages] = useState<string[]>(
        initialProduct?.product_media?.map((media) => media.media_url).filter((url): url is string => Boolean(url)) || []
    )
    const [options, setOptions] = useState<Option[]>(() => hydrateOptions(initialProduct))
    const [variants, setVariants] = useState<Variant[]>(() => hydrateVariants(initialProduct))
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedParentId, setSelectedParentId] = useState<string>('')
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>('')
    const [activeVariantTab, setActiveVariantTab] = useState('general')
    const [customizationTemplate, setCustomizationTemplate] = useState<Record<string, string | string[]>>(initialProduct?.customization_template || {})

    // Quick rollups to keep parent-level messaging clear when variants are present
    const totalVariantQuantity = variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0)
    const lowestReorderPoint = variants.reduce((min: number | null, variant) => {
        const value = Number(variant.reorder_point)
        if (Number.isNaN(value)) return min
        if (min === null) return value
        return Math.min(min, value)
    }, null)

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

    const syncOptionsAndVariants = (nextOptions: Option[]) => {
        setOptions(nextOptions)
        setVariants((currentVariants) => regenerateVariants(nextOptions, currentVariants))
    }

    const addOption = () => {
        syncOptionsAndVariants([...options, { id: crypto.randomUUID(), name: '', values: [] }])
    }

    const removeOption = (index: number) => {
        const newOptions = [...options]
        newOptions.splice(index, 1)
        syncOptionsAndVariants(newOptions)
    }

    const updateOptionName = (index: number, name: string) => {
        const newOptions = [...options]
        newOptions[index].name = name
        syncOptionsAndVariants(newOptions)
    }

    const addOptionValue = (index: number, value: string) => {
        if (!value.trim()) return
        const newOptions = [...options]
        if (!newOptions[index].values.includes(value)) {
            newOptions[index].values.push(value)
            syncOptionsAndVariants(newOptions)
        }
    }

    const removeOptionValue = (optionIndex: number, valueIndex: number) => {
        const newOptions = [...options]
        newOptions[optionIndex].values.splice(valueIndex, 1)
        syncOptionsAndVariants(newOptions)
    }

    const updateVariant = (index: number, field: keyof Variant, value: Variant[keyof Variant]) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], [field]: value }
        setVariants(newVariants)
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (currentStep !== steps.length || loading) {
            return
        }

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

    const handlePrimaryAction = () => {
        if (loading) {
            return
        }

        if (currentStep < steps.length) {
            nextStep()
            return
        }

        formRef.current?.requestSubmit()
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

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-8 mt-[4.5rem]">

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
                            <p className="text-sm text-blue-700">This product has variants, so parent-level price, SKU, and quantity are ignored. Use the table in Step 4 to set each variant’s on-hand stock.</p>

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                                <div className="rounded-lg border border-blue-100 bg-white/70 px-4 py-3">
                                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Variants</p>
                                    <p className="text-lg font-bold text-blue-900">{variants.length}</p>
                                    <p className="text-xs text-blue-700 mt-1">Total variants generated</p>
                                </div>
                                <div className="rounded-lg border border-blue-100 bg-white/70 px-4 py-3">
                                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">On-hand Qty (sum)</p>
                                    <p className="text-lg font-bold text-blue-900">{totalVariantQuantity}</p>
                                    <p className="text-xs text-blue-700 mt-1">Across all variants</p>
                                </div>
                                <div className="rounded-lg border border-blue-100 bg-white/70 px-4 py-3">
                                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Lowest Reorder Point</p>
                                    <p className="text-lg font-bold text-blue-900">{lowestReorderPoint ?? '—'}</p>
                                    <p className="text-xs text-blue-700 mt-1">Alert level among variants</p>
                                </div>
                            </div>

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
                                            defaultValue={initialPrimaryVariant?.price ?? undefined}
                                        />
                                        <Input
                                            label="Compare at"
                                            name="compare_at_price"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            defaultValue={initialPrimaryVariant?.compare_at_price ?? undefined}
                                        />
                                        <div className="md:col-span-2">
                                            <Input
                                                label="Cost per item"
                                                name="cost_price"
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                helperText="Customers won’t see this."
                                                defaultValue={initialPrimaryVariant?.cost_price ?? undefined}
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
                                                defaultValue={initialPrimaryVariant?.sku ?? undefined}
                                            />
                                            <Input
                                                label="Barcode (ISBN, UPC, GTIN, etc.)"
                                                name="barcode"
                                                type="text"
                                                defaultValue={initialPrimaryVariant?.barcode ?? undefined}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <Input
                                                label="Quantity *"
                                                required
                                                name="quantity"
                                                type="number"
                                                defaultValue={initialPrimaryInventory?.available_quantity ?? 0}
                                            />
                                            <Input
                                                label="Reorder Point"
                                                name="reorder_point"
                                                type="number"
                                                defaultValue={initialPrimaryInventory?.reorder_point ?? 10}
                                                helperText="Low stock alert level"
                                            />
                                            <Input
                                                label="Bin Location"
                                                name="bin_location"
                                                type="text"
                                                placeholder="e.g. A-12"
                                                defaultValue={initialPrimaryInventory?.bin_location ?? undefined}
                                            />
                                        </div>
                                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900">Allow Preorders</h4>
                                                <p className="text-sm text-gray-500">Allow customers to purchase this item when it is out of stock.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    name="allow_preorder" 
                                                    className="sr-only peer"
                                                    defaultChecked={initialPrimaryVariant?.allow_preorder ?? false}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                                            </label>
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
                                    defaultValue={initialProduct?.seo_title ?? undefined}
                                />
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700">SEO Description</label>
                                    <textarea
                                        name="seo_description"
                                        rows={3}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm p-3"
                                        placeholder="Optimal length is 150-160 characters."
                                        defaultValue={initialProduct?.seo_description ?? undefined}
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

                    <button
                        type="button"
                        onClick={handlePrimaryAction}
                        disabled={loading}
                        className={`inline-flex justify-center items-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed ${currentStep < steps.length ? 'bg-gray-900 hover:bg-black focus:ring-gray-900' : 'bg-[#0f9d58] hover:bg-[#0b8043] focus:ring-[#0f9d58]'} focus:outline-none focus:ring-2 focus:ring-offset-2`}
                    >
                        {currentStep < steps.length ? (
                            <>
                                Next
                                <ChevronRight className="w-4 h-4 ml-2" />
                            </>
                        ) : loading ? (
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
                                        onChange={(url) => {
                                            const index = variants.findIndex(v => v.id === editingVariantId)
                                            if (index !== -1) {
                                                const currentImages = variants[index].images || []
                                                updateVariant(index, 'images', [...currentImages, url])
                                            }
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
                                    <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                                        <p className="text-sm font-medium text-amber-900">Selling price is edited in the variants table.</p>
                                        <p className="text-xs text-amber-800 mt-1">This tab is only for internal cost and optional original/MRP display price.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Cost Price (Internal)"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.cost_price ?? ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? null : parseFloat(e.target.value)
                                                    updateVariant(index, 'cost_price', next)
                                                }
                                            }}
                                            helperText="Internal purchase cost. Customers do not see this."
                                        />
                                        <Input
                                            label="Original / Compare At Price"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.compare_at_price ?? ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? null : parseFloat(e.target.value)
                                                    updateVariant(index, 'compare_at_price', next)
                                                }
                                            }}
                                            helperText="Optional strikethrough or MRP-style display price."
                                        />
                                    </div>
                                </div>
                            )}

                            {activeVariantTab === 'inventory' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Reorder Point"
                                            type="number"
                                            value={variants.find(v => v.id === editingVariantId)?.reorder_point || 10}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? 0 : parseInt(e.target.value)
                                                    updateVariant(index, 'reorder_point', isNaN(next) ? 0 : next)
                                                }
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
                                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900">Allow Preorders</h4>
                                            <p className="text-sm text-gray-500">Allow customers to purchase this variant when it is out of stock.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={variants.find(v => v.id === editingVariantId)?.allow_preorder ?? false}
                                                onChange={(e) => {
                                                    const index = variants.findIndex(v => v.id === editingVariantId)
                                                    if (index !== -1) updateVariant(index, 'allow_preorder', e.target.checked)
                                                }}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                                        </label>
                                    </div>
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
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? null : parseFloat(e.target.value)
                                                    updateVariant(index, 'weight_value', next)
                                                }
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
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? null : parseFloat(e.target.value)
                                                    updateVariant(index, 'dimension_length', next)
                                                }
                                            }}
                                        />
                                            <Input
                                            label="Width"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.dimension_width || ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? null : parseFloat(e.target.value)
                                                    updateVariant(index, 'dimension_width', next)
                                                }
                                            }}
                                        />
                                            <Input
                                            label="Height"
                                            type="number"
                                            step="0.01"
                                            value={variants.find(v => v.id === editingVariantId)?.dimension_height || ''}
                                            onChange={(e) => {
                                                const index = variants.findIndex(v => v.id === editingVariantId)
                                                if (index !== -1) {
                                                    const next = e.target.value === '' ? null : parseFloat(e.target.value)
                                                    updateVariant(index, 'dimension_height', next)
                                                }
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
