'use client';

import { CldUploadWidget } from 'next-cloudinary';
import { GripVertical, ImagePlus, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

interface ImageUploadProps {
    value: string | string[];
    onChange: (value: string) => void;
    onRemove: (value: string) => void;
    onReorder?: (newOrder: string[]) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ value, onChange, onRemove, onReorder }) => {
    const images = Array.isArray(value) ? value : value ? [value] : [];

    // Drag state
    const dragIndex = useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

    const onUpload = (result: any) => {
        onChange(result.info.secure_url);
    };

    // --- Drag handlers ---
    function handleDragStart(e: React.DragEvent, index: number) {
        dragIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(index);
    }

    function handleDrop(e: React.DragEvent, dropIndex: number) {
        e.preventDefault();
        const from = dragIndex.current;
        if (from === null || from === dropIndex) {
            setDragOver(null);
            dragIndex.current = null;
            return;
        }
        const reordered = [...images];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(dropIndex, 0, moved);
        onReorder?.(reordered);
        dragIndex.current = null;
        setDragOver(null);
    }

    function handleDragEnd() {
        dragIndex.current = null;
        setDragOver(null);
    }

    // Move image left/right with buttons (for touch/mobile fallback)
    function moveImage(fromIndex: number, toIndex: number) {
        const reordered = [...images];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        onReorder?.(reordered);
    }

    return (
        <div>
            {images.length > 0 && (
                <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5" />
                        Drag to reorder · First image is the cover photo
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {images.map((url, index) => (
                            <div
                                key={url}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`relative aspect-square rounded-lg overflow-hidden group border-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                                    dragOver === index
                                        ? 'border-blue-500 scale-105 shadow-lg'
                                        : index === 0
                                        ? 'border-gray-900'
                                        : 'border-gray-200 hover:border-gray-400'
                                }`}
                            >
                                {/* Cover badge */}
                                {index === 0 && (
                                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-gray-900 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
                                        <Star className="w-2.5 h-2.5 fill-white" />
                                        Cover
                                    </div>
                                )}

                                {/* Position badge */}
                                {index > 0 && (
                                    <div className="absolute top-2 left-2 z-10 bg-white/90 text-gray-600 text-[10px] font-semibold w-5 h-5 rounded-full flex items-center justify-center shadow border border-gray-200">
                                        {index + 1}
                                    </div>
                                )}

                                {/* Drag handle overlay */}
                                <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="bg-black/40 backdrop-blur-sm rounded-full p-2">
                                        <GripVertical className="w-5 h-5 text-white" />
                                    </div>
                                </div>

                                {/* Remove button */}
                                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        onClick={() => onRemove(url)}
                                        className="bg-white/90 text-red-600 p-1.5 rounded-full hover:bg-red-50 transition shadow-sm border border-gray-200"
                                        title="Remove image"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Arrow controls (mobile-friendly) */}
                                <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => moveImage(index, index - 1)}
                                            className="bg-white/90 text-gray-700 text-xs px-2 py-0.5 rounded-full hover:bg-white shadow border border-gray-200"
                                            title="Move left"
                                        >
                                            ←
                                        </button>
                                    )}
                                    {index < images.length - 1 && (
                                        <button
                                            type="button"
                                            onClick={() => moveImage(index, index + 1)}
                                            className="bg-white/90 text-gray-700 text-xs px-2 py-0.5 rounded-full hover:bg-white shadow border border-gray-200"
                                            title="Move right"
                                        >
                                            →
                                        </button>
                                    )}
                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => moveImage(index, 0)}
                                            className="bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full hover:bg-gray-700 shadow"
                                            title="Set as cover"
                                        >
                                            ★
                                        </button>
                                    )}
                                </div>

                                <Image
                                    fill
                                    className="object-cover pointer-events-none"
                                    alt={index === 0 ? 'Cover image' : `Image ${index + 1}`}
                                    src={url}
                                    draggable={false}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload button */}
            <CldUploadWidget
                uploadPreset="cluster-erp-preset"
                onSuccess={onUpload}
                options={{ multiple: true }}
            >
                {({ open }) => (
                    <button
                        type="button"
                        onClick={() => open()}
                        className="relative block w-full border-2 border-gray-300 border-dashed rounded-lg p-10 text-center hover:border-gray-900 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                    >
                        <div className="flex flex-col items-center justify-center">
                            <ImagePlus className="mx-auto h-10 w-10 text-gray-400" />
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                                {images.length > 0 ? 'Add More Images' : 'Upload Images'}
                            </span>
                            <span className="mt-1 block text-xs text-gray-500">
                                Click to upload · Multiple allowed
                            </span>
                        </div>
                    </button>
                )}
            </CldUploadWidget>
        </div>
    );
};

export default ImageUpload;
