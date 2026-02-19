'use client';

import { CldUploadWidget } from 'next-cloudinary';
import { ImagePlus, X } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
    value: string[];
    onChange: (value: string[]) => void;
    onRemove: (value: string) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
    value,
    onChange,
    onRemove
}) => {
    const onUpload = (result: any) => {
        onChange([...value, result.info.secure_url]);
    };

    return (
        <div>
            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {value.map((url) => (
                    <div key={url} className="relative aspect-square rounded-lg overflow-hidden group border border-gray-200">
                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                type="button"
                                onClick={() => onRemove(url)}
                                className="bg-white/90 text-red-600 p-1.5 rounded-full hover:bg-red-50 transition shadow-sm border border-gray-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <Image
                            fill
                            className="object-cover"
                            alt="Image"
                            src={url}
                        />
                    </div>
                ))}
            </div>
            <CldUploadWidget
                uploadPreset="cluster-erp-preset"
                onSuccess={onUpload}
            >
                {({ open }) => {
                    const onClick = () => {
                        open();
                    };

                    return (
                        <button
                            type="button"
                            onClick={onClick}
                            className="relative block w-full border-2 border-gray-300 border-dashed rounded-lg p-12 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <div className="flex flex-col items-center justify-center">
                                <ImagePlus className="mx-auto h-12 w-12 text-gray-400 group-hover:text-indigo-500" />
                                <span className="mt-2 block text-sm font-medium text-gray-900">
                                    Upload Images
                                </span>
                                <span className="mt-1 block text-xs text-gray-500">
                                    Click to upload or drag and drop
                                </span>
                            </div>
                        </button>
                    );
                }}
            </CldUploadWidget>
        </div>
    );
}

export default ImageUpload;
