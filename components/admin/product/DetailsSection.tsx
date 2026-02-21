'use client'

import React from 'react'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Label from '@/components/ui/Label'
import CustomizationBuilder from '../CustomizationBuilder'

interface DetailsSectionProps {
    customizationTemplate: Record<string, string | string[]>
    setCustomizationTemplate: React.Dispatch<React.SetStateAction<Record<string, string | string[]>>>
    initialData?: any
}

export default function DetailsSection({ customizationTemplate, setCustomizationTemplate, initialData }: DetailsSectionProps) {
    return (
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
                        defaultValue={initialData?.brand}
                    />
                    <Input
                        label="Material"
                        name="material"
                        type="text"
                        placeholder="e.g. Gold 22k, Cotton"
                        defaultValue={initialData?.material}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Origin"
                        name="origin"
                        type="text"
                        placeholder="e.g. India"
                        defaultValue={initialData?.origin_country}
                    />
                    <Input
                        label="Collection"
                        name="collection"
                        type="text"
                        placeholder="e.g. Bridal 2024"
                        defaultValue={initialData?.collection}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Warranty Period"
                        name="warranty_period"
                        type="text"
                        placeholder="e.g. 1 Year, Lifetime"
                        defaultValue={initialData?.warranty_period}
                    />
                </div>
                <Textarea
                    label="Care Instructions"
                    name="care_instructions"
                    rows={3}
                    placeholder="e.g. Keep away from water, Dry clean only..."
                    defaultValue={initialData?.care_instructions}
                />

                <div>
                    <Label>Features (Bullet Points)</Label>
                    <p className="text-xs text-gray-500 mb-2">Enter each feature on a new line.</p>
                    <Textarea
                        name="features"
                        rows={5}
                        placeholder="- Handcrafted&#10;- Hypoallergenic&#10;- Certified Gemstones"
                        defaultValue={initialData?.features?.join('\n')}
                    />
                </div>

                <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-3 mb-4">
                        <input
                            type="checkbox"
                            id="is_customizable"
                            name="is_customizable"
                            className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                            defaultChecked={initialData?.is_customizable}
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
                        defaultValue={initialData?.shipping_class || 'standard'}
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
                        defaultValue={initialData?.return_policy}
                    />
                </div>
            </div>
        </div>
    )
}
