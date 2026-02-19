import ProductForm from '@/components/admin/ProductForm'

export default function CreateProductPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Product</h1>
            <ProductForm />
        </div>
    )
}
