import ProductForm from '@/components/admin/ProductForm'
import { getProductById } from '@/lib/actions/product-actions'
import { notFound } from 'next/navigation'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const product = await getProductById(id)

    if (!product) {
        notFound()
    }

    return <ProductForm initialProduct={product} />
}
