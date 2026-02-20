import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface KeyValueEditorProps {
    initialValue: Record<string, string>;
    onChange: (value: Record<string, string>) => void;
}

export default function KeyValueEditor({ initialValue, onChange }: KeyValueEditorProps) {
    const [rows, setRows] = useState<{ key: string; value: string }[]>([]);

    useEffect(() => {
        if (initialValue && Object.keys(initialValue).length > 0) {
            setRows(Object.entries(initialValue).map(([key, value]) => ({ key, value })));
        } else {
            setRows([{ key: '', value: '' }]);
        }
    }, []); // Only run once on mount effectively, but we handle updates via internal state

    // Notify parent of changes whenever rows change
    useEffect(() => {
        const newValue: Record<string, string> = {};
        rows.forEach(row => {
            if (row.key.trim()) {
                newValue[row.key] = row.value;
            }
        });
        onChange(newValue);
    }, [rows, onChange]);

    const addRow = () => {
        setRows([...rows, { key: '', value: '' }]);
    };

    const removeRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    const updateRow = (index: number, field: 'key' | 'value', text: string) => {
        const newRows = [...rows];
        newRows[index][field] = text;
        setRows(newRows);
    };

    return (
        <div className="space-y-3">
            {rows.map((row, index) => (
                <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={row.key}
                            onChange={(e) => updateRow(index, 'key', e.target.value)}
                            placeholder="Data (e.g. Color)"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm px-3 py-2 border"
                        />
                    </div>
                    <div className="flex-1">
                        <input
                            type="text"
                            value={row.value}
                            onChange={(e) => updateRow(index, 'value', e.target.value)}
                            placeholder="Value (e.g. Red)"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-900 focus:ring-gray-900 sm:text-sm px-3 py-2 border"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-gray-900 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
                <Plus className="w-3 h-3 mr-1" />
                Add Specification
            </button>
        </div>
    );
}
