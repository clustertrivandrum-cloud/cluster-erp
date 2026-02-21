import React from 'react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Plus, Trash2, X, Image as ImageIcon, ChevronRight } from 'lucide-react'
import { Option, Variant } from './types'

interface VariantsSectionProps {
    options: Option[]
    variants: Variant[]
    addOption: () => void
    removeOption: (index: number) => void
    updateOptionName: (index: number, name: string) => void
    addOptionValue: (index: number, value: string) => void
    removeOptionValue: (optionIndex: number, valueIndex: number) => void
    updateVariant: (index: number, field: keyof Variant, value: any) => void
    setEditingVariantId: React.Dispatch<React.SetStateAction<string | null>>
}

export default function VariantsSection({
    options,
    variants,
    addOption,
    removeOption,
    updateOptionName,
    addOptionValue,
    removeOptionValue,
    updateVariant,
    setEditingVariantId
}: VariantsSectionProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-base font-semibold text-gray-900">Variants</h3>
                <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-gray-900 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
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
                            <div key={option.id} className="relative group bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-400 transition-colors">
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
                                            label="Option Name *"
                                            type="text"
                                            value={option.name}
                                            onChange={(e) => updateOptionName(index, e.target.value)}
                                            placeholder="e.g. Size, Color"
                                        />
                                    </div>
                                    <div className="md:col-span-8">
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Option Values *</label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {option.values.map((val, vIndex) => (
                                                <span key={vIndex} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-900 border border-gray-200">
                                                    {val}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOptionValue(index, vIndex)}
                                                        className="ml-1.5 text-gray-400 hover:text-gray-900"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}

                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Add value & hit Enter..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            const val = e.currentTarget.value.trim()
                                                            if (val) {
                                                                addOptionValue(index, val)
                                                                e.currentTarget.value = ''
                                                            }
                                                        }
                                                    }}
                                                    className="block w-48 bg-white text-gray-900 placeholder:text-gray-400 rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 text-xs py-1.5 pl-3 pr-8"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">↵</span>
                                            </div>
```
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
                            <ChevronRight className="w-4 h-4 text-gray-900 mr-1" />
                            Preview & Edit Variants
                        </h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider pl-6">Variant</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Price *</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">SKU</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Qty *</th>
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
                                                            required
                                                            value={variant.price}
                                                            onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value))}
                                                            className="block w-full pl-6 rounded-md border-gray-300 focus:border-gray-900 focus:ring-gray-900 sm:text-sm py-1"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    <input
                                                        type="text"
                                                        value={variant.sku}
                                                        onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                                        className="block w-full rounded-md border-gray-300 focus:border-gray-900 focus:ring-gray-900 sm:text-sm py-1"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                    <input
                                                        type="number"
                                                        required
                                                        value={variant.quantity}
                                                        onChange={(e) => updateVariant(index, 'quantity', parseInt(e.target.value))}
                                                        className="block w-full rounded-md border-gray-300 focus:border-gray-900 focus:ring-gray-900 sm:text-sm py-1"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingVariantId(variant.id)}
                                                        className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 ${variant.images.length > 0
                                                            ? 'border-transparent text-gray-900 bg-gray-100 hover:bg-gray-200'
                                                            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                                                        {variant.images.length > 0 ? `${variant.images.length}` : 'Add'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingVariantId(variant.id)}
                                                        className="ml-2 text-gray-900 hover:text-black text-xs font-medium"
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
    )
}
