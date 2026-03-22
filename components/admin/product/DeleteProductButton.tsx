'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteProduct } from '@/lib/actions/product-actions'

type Props = {
    id: string
    title: string
}

export default function DeleteProductButton({ id, title }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
        startTransition(async () => {
            const res = await deleteProduct(id)
            if (!res.success) {
                alert(res.error || 'Failed to delete product.')
                return
            }
            router.refresh()
        })
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded disabled:opacity-50"
            aria-label="Delete product"
        >
            <Trash2 className="w-5 h-5" />
        </button>
    )
}
