'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import type { PosProduct } from '@/lib/pos-types'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'

type ProductRow = {
    id: string
    title: string
    category_id?: string | null
    categories?: {
        name?: string | null
    } | null
    product_media?: Array<{
        media_url: string
        position?: number | null
    }> | null
    product_variants?: Array<{
        id: string
        sku?: string | null
        price?: number | string | null
        compare_at_price?: number | string | null
        inventory_items?: Array<{
            available_quantity?: number | string | null
        }> | null
    }> | null
}

type GetPosProductsParams = {
    searchQuery?: string
    page?: number
    limit?: number
    categoryId?: string
}

export async function getPosCategories() {
    await requireActionPermission(['manage_products', 'access_pos'])
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name')

    if (error) {
        console.error('Error fetching POS categories:', error)
        return []
    }

    return data ?? []
}

export async function getPosProducts(params: GetPosProductsParams = {}) {
    await requireActionPermission(['manage_products', 'access_pos'])
    const supabase = await createClient()
    const {
        searchQuery = '',
        page = 1,
        limit = 48,
        categoryId,
    } = params
    const { from, to } = getPagination({ page, limit, defaultLimit: 48, maxLimit: 60 })
    const searchTerm = normalizeSearchTerm(searchQuery)

    let query = supabase
        .from('products')
        .select(`
            id,
            title,
            category_id,
            categories ( name ),
            product_media ( media_url, position ),
            product_variants (
                id,
                sku,
                price,
                compare_at_price,
                inventory_items ( available_quantity )
            )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`)
    }

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    }

    const { data, error, count } = await query

    if (error) {
        console.error('Error fetching POS products:', error)
        throw new Error('Failed to fetch POS products')
    }

    const normalized = ((data ?? []) as ProductRow[]).map((product): PosProduct => ({
        id: product.id,
        title: product.title,
        category_id: product.category_id ?? null,
        category_name: product.categories?.name ?? 'Uncategorized',
        product_media: [...(product.product_media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        product_variants: (product.product_variants ?? []).map((variant) => ({
            id: variant.id,
            sku: variant.sku ?? null,
            price: variant.price ?? 0,
            compare_at_price: variant.compare_at_price ?? null,
            inventory_items: variant.inventory_items ?? [],
        })),
    }))

    return { data: normalized, count: count ?? 0 }
}
