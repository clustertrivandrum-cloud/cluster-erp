import ImageUpload from '../ImageUpload'

interface MediaSectionProps {
    images: string[]
    setImages: React.Dispatch<React.SetStateAction<string[]>>
}

export default function MediaSection({ images, setImages }: MediaSectionProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-base font-semibold text-gray-900">Media</h3>
            </div>
            <div className="p-4 md:p-6">
                <ImageUpload
                    value={images}
                    onChange={(url) => setImages((prev) => [...prev, url])}
                    onRemove={(url) => setImages((prev) => prev.filter((current) => current !== url))}
                />
                <p className="text-sm text-gray-500 mt-2">Upload general product images here. Variant-specific images can be added in the variants section.</p>
            </div>
        </div>
    )
}
