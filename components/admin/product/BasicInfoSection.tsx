import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'

export default function BasicInfoSection({ initialData }: { initialData?: any }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-base font-semibold text-gray-900">Product Information</h3>
            </div>
            <div className="p-4 md:p-6 space-y-6">
                <div className="space-y-4">
                    <Input
                        label="Title *"
                        required
                        name="title"
                        type="text"
                        placeholder="e.g. Premium Cotton T-Shirt"
                        defaultValue={initialData?.title}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Slug (URL Handle) *"
                            required
                            name="slug"
                            type="text"
                            placeholder="premium-cotton-t-shirt"
                            defaultValue={initialData?.slug}
                        />
                    </div>
                    <Textarea
                        label="Description"
                        name="description"
                        rows={4}
                        placeholder="Describe your product..."
                        defaultValue={initialData?.description}
                    />
                </div>
            </div>
        </div>
    )
}
