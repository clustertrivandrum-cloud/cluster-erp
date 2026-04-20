'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import type { PosProduct } from '@/lib/pos-types'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'

type ProductRow = {
    id: string
    title: string
    status?: string | null
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
        title?: string | null
        sku?: string | null
        price?: number | string | null
        compare_at_price?: number | string | null
        is_active?: boolean | null
        is_default?: boolean | null
        variant_rank?: number | null
        sellable_status?: string | null
        variant_media?: Array<{
            media_url?: string | null
            position?: number | null
        }> | null
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
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

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
            status,
            category_id,
            categories ( name ),
            product_media ( media_url, position ),
            product_variants (
                id,
                title,
                sku,
                price,
                compare_at_price,
                is_active,
                is_default,
                variant_rank,
                sellable_status,
                variant_media ( media_url, position ),
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
        status: product.status ?? null,
        category_id: product.category_id ?? null,
        category_name: product.categories?.name ?? 'Uncategorized',
        product_media: [...(product.product_media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        product_variants: (product.product_variants ?? [])
            .slice()
            .sort((left, right) => {
                const defaultDelta = Number(right.is_default ?? false) - Number(left.is_default ?? false)
                if (defaultDelta !== 0) {
                    return defaultDelta
                }

                const rankDelta = Number(left.variant_rank ?? 0) - Number(right.variant_rank ?? 0)
                if (rankDelta !== 0) {
                    return rankDelta
                }

                return (left.title ?? '').localeCompare(right.title ?? '')
            })
            .map((variant) => ({
                id: variant.id,
                title: variant.title ?? null,
                sku: variant.sku ?? null,
                price: variant.price ?? 0,
                compare_at_price: variant.compare_at_price ?? null,
                is_active: variant.is_active ?? null,
                is_default: variant.is_default ?? null,
                variant_rank: variant.variant_rank ?? null,
                sellable_status: variant.sellable_status ?? null,
                variant_media: [...(variant.variant_media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
                inventory_items: variant.inventory_items ?? [],
            })),
    }))

    return { data: normalized, count: count ?? 0 }
}
