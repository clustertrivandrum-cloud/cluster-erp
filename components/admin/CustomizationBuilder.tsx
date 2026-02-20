import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';

interface CustomizationBuilderProps {
    initialValue: Record<string, string | string[]>;
    onChange: (value: Record<string, string | string[]>) => void;
}

interface CustomizationField {
    label: string;
    type: 'text' | 'options';
    optionsString: string; // Comma separated for UI
}

export default function CustomizationBuilder({ initialValue, onChange }: CustomizationBuilderProps) {
    const [fields, setFields] = useState<CustomizationField[]>([]);

    useEffect(() => {
        if (initialValue && Object.keys(initialValue).length > 0) {
            const loadedFields: CustomizationField[] = Object.entries(initialValue).map(([key, value]) => {
                const isArray = Array.isArray(value);
                return {
                    label: key,
                    type: isArray ? 'options' : 'text',
                    optionsString: isArray ? (value as string[]).join(', ') : ''
                };
            });
            setFields(loadedFields);
        } else {
            setFields([{ label: '', type: 'text', optionsString: '' }]);
        }
    }, []);

    useEffect(() => {
        const newValue: Record<string, string | string[]> = {};
        fields.forEach(field => {
            if (field.label.trim()) {
                if (field.type === 'text') {
                    newValue[field.label] = 'text';
                } else {
                    // Split by comma, trim, filter empty
                    const opts = field.optionsString.split(',').map(s => s.trim()).filter(s => s !== '');
                    newValue[field.label] = opts;
                }
            }
        });
        onChange(newValue);
    }, [fields, onChange]);

    const addField = () => {
        setFields([...fields, { label: '', type: 'text', optionsString: '' }]);
    };

    const removeField = (index: number) => {
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
    };

    const updateField = (index: number, key: keyof CustomizationField, value: string) => {
        const newFields = [...fields];
        // @ts-ignore
        newFields[index][key] = value;
        setFields(newFields);
    };

    return (
        <div className="space-y-4">
            {fields.map((field, index) => (
                <div key={index} className="bg-gray-50/50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex justify-between items-start">
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center">
                            <Settings className="w-3 h-3 mr-1" />
                            Custom Field {index + 1}
                        </h4>
                        <button
                            type="button"
                            onClick={() => removeField(index)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Field Label</label>
                            <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(index, 'label', e.target.value)}
                                placeholder="e.g. Engraving Text"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm px-3 py-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Input Type</label>
                            <select
                                value={field.type}
                                onChange={(e) => updateField(index, 'type', e.target.value as 'text' | 'options')}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm px-3 py-2 border"
                            >
                                <option value="text">Text Input</option>
                                <option value="options">Selection Options</option>
                            </select>
                        </div>
                    </div>

                    {field.type === 'options' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Options (Comma Separated)</label>
                            <input
                                type="text"
                                value={field.optionsString}
                                onChange={(e) => updateField(index, 'optionsString', e.target.value)}
                                placeholder="e.g. Size 6, Size 7, Size 8"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm px-3 py-2 border"
                            />
                        </div>
                    )}
                </div>
            ))}
            <button
                type="button"
                onClick={addField}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-gray-900 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
                <Plus className="w-3 h-3 mr-1" />
                Add Custom Field
            </button>
        </div>
    );
}
