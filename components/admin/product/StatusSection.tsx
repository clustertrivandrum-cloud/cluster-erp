import React from 'react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Label from '@/components/ui/Label'
import { Save } from 'lucide-react'

interface StatusSectionProps {
    categories: { id: string, name: string, parent_id: string | null }[]
    selectedParentId: string
    setSelectedParentId: React.Dispatch<React.SetStateAction<string>>
    selectedSubCategoryId: string
    setSelectedSubCategoryId: React.Dispatch<React.SetStateAction<string>>
    loading: boolean
    initialData?: any
}

export default function StatusSection({
    categories,
    selectedParentId,
    setSelectedParentId,
    selectedSubCategoryId,
    setSelectedSubCategoryId,
    loading,
    initialData
}: StatusSectionProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-8">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-base font-semibold text-gray-900">Organization</h3>
            </div>
            <div className="p-6 space-y-6">
                <Select
                    label="Status *"
                    name="status"
                    required
                    defaultValue={initialData?.status || 'draft'}
                >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                </Select>

                <div>
                    <Label>Category *</Label>
                    <div className="space-y-3">
                        <Select
                            value={selectedParentId}
                            onChange={(e) => {
                                setSelectedParentId(e.target.value)
                                setSelectedSubCategoryId('')
                            }}
                            required
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
                    defaultValue={initialData?.gender}
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
                    defaultValue={initialData?.hs_code}
                />
                <Input
                    label="Tags"
                    name="tags"
                    type="text"
                    placeholder="Summer, Sale, New"
                    helperText="Comma separated."
                    defaultValue={initialData?.tags?.join(', ')}
                />

                <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <input
                        type="checkbox"
                        id="is_featured"
                        name="is_featured"
                        className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                        defaultChecked={initialData?.is_customizable}
                    />
                    <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">
                        Feature this product
                    </label>
                </div>
            </div>
        </div>
    )
}
