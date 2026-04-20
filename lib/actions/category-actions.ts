'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'

export type CategoryRecord = {
    id: string
    name: string
    slug: string
    description: string | null
    parent_id: string | null
    image_url: string | null
    sort_order: number
    banner_kicker?: string | null
    banner_title?: string | null
    banner_description?: string | null
    banner_image_url?: string | null
    banner_mobile_image_url?: string | null
    parent_name?: string | null
}

export type CategoryOrderGroup = {
    parentId: string | null
    orderedIds: string[]
}

const CATEGORY_SELECT = 'id, name, slug, description, parent_id, image_url, sort_order, banner_kicker, banner_title, banner_description, banner_image_url, banner_mobile_image_url'

function normalizeParentId(value: FormDataEntryValue | string | null | undefined) {
    const normalized = typeof value === 'string' ? value.trim() : ''
    return normalized.length > 0 ? normalized : null
}

async function getNextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, parentId: string | null) {
    let query = supabase
        .from('categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)

    query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)

    const { data, error } = await query

    if (error) {
        throw new Error(error.message)
    }

    const currentMax = Number(data?.[0]?.sort_order ?? 0)
    return (Number.isFinite(currentMax) ? currentMax : 0) + 10
}

export async function getCategories() {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select(CATEGORY_SELECT)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching categories:', error)
        return []
    }

    return data
}

export async function getCategoryOptions() {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, parent_id, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching category options:', error)
        return []
    }

    return data ?? []
}

export async function getCategoryPage(params?: { query?: string; page?: number; limit?: number }) {
    const { query = '', page = 1, limit = 10 } = params || {}
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { from, to } = getPagination({ page, limit, defaultLimit: 10, maxLimit: 50 })
    const searchTerm = normalizeSearchTerm(query)

    let dbQuery = supabase
        .from('categories')
        .select(CATEGORY_SELECT, { count: 'exact' })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .range(from, to)

    if (searchTerm) {
        dbQuery = dbQuery.or(`name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`)
    }

    const { data, error, count } = await dbQuery

    if (error) {
        console.error('Error fetching category page:', error)
        return { data: [], count: 0, error: error.message }
    }

    const categories = (data ?? []) as CategoryRecord[]
    const parentIds = Array.from(new Set(categories.map((category) => category.parent_id).filter((value): value is string => Boolean(value))))
    const parentNameMap = new Map<string, string>()

    if (parentIds.length > 0) {
        const { data: parents, error: parentError } = await supabase
            .from('categories')
            .select('id, name')
            .in('id', parentIds)

        if (parentError) {
            console.error('Error fetching category parents:', parentError)
        } else {
            for (const parent of parents ?? []) {
                parentNameMap.set(parent.id, parent.name)
            }
        }
    }

    return {
        data: categories.map((category) => ({
            ...category,
            parent_name: category.parent_id ? parentNameMap.get(category.parent_id) ?? 'Unknown' : null,
        })),
        count: count ?? 0,
        error: null,
    }
}

export async function getCategoryOrderHierarchy() {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, parent_id, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

    if (error) {
        console.error('Error fetching category order hierarchy:', error)
        return { data: [], error: error.message }
    }

    return { data: data ?? [], error: null }
}

export async function createCategory(formData: FormData) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const parentId = normalizeParentId(formData.get('parent_id'))
    let sortOrder = 10

    try {
        sortOrder = await getNextSortOrder(supabase, parentId)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not assign category order.'
        console.error('Error assigning category order:', error)
        return { error: message }
    }

    const category = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        parent_id: parentId,
        sort_order: sortOrder,
        image_url: formData.get('image_url') as string,
        banner_kicker: formData.get('banner_kicker') as string,
        banner_title: formData.get('banner_title') as string,
        banner_description: formData.get('banner_description') as string,
        banner_image_url: formData.get('banner_image_url') as string,
        banner_mobile_image_url: formData.get('banner_mobile_image_url') as string,
    }

    const { error } = await supabase
        .from('categories')
        .insert(category)

    if (error) {
        console.error('Error creating category:', error)
        return { error: error.message }
    }

    revalidatePath('/admin/categories')
    revalidatePath('/admin/products/new') // Update product form options
    return { success: true }
}

export async function updateCategory(id: string, formData: FormData) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const parentId = normalizeParentId(formData.get('parent_id'))
    const { data: currentCategory, error: currentError } = await supabase
        .from('categories')
        .select('parent_id, sort_order')
        .eq('id', id)
        .single()

    if (currentError || !currentCategory) {
        return { error: currentError?.message || 'Category not found.' }
    }

    let sortOrder = Number(currentCategory.sort_order ?? 0)

    if ((currentCategory.parent_id ?? null) !== parentId) {
        try {
            sortOrder = await getNextSortOrder(supabase, parentId)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not assign category order.'
            console.error('Error assigning category order:', error)
            return { error: message }
        }
    }

    const category = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        parent_id: parentId,
        sort_order: sortOrder,
        image_url: formData.get('image_url') as string,
        banner_kicker: formData.get('banner_kicker') as string,
        banner_title: formData.get('banner_title') as string,
        banner_description: formData.get('banner_description') as string,
        banner_image_url: formData.get('banner_image_url') as string,
        banner_mobile_image_url: formData.get('banner_mobile_image_url') as string,
    }

    const { error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)

    if (error) {
        console.error('Error updating category:', error)
        return { error: error.message }
    }

    revalidatePath('/admin/categories')
    revalidatePath('/admin/products/new')
    return { success: true }
}

export async function updateCategoryOrder(groups: CategoryOrderGroup[]) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const groupKeys = groups.map((group) => group.parentId ?? 'top-level')
    const uniqueGroupKeys = new Set(groupKeys)
    const allIds = groups.flatMap((group) => group.orderedIds)
    const uniqueIds = new Set(allIds)

    if (groupKeys.length !== uniqueGroupKeys.size) {
        return { error: 'Each category parent group can only be submitted once.' }
    }

    if (allIds.length !== uniqueIds.size) {
        return { error: 'A category can only appear once in the submitted order.' }
    }

    if (allIds.length === 0) {
        return { success: true, updated: 0 }
    }

    const { data: categories, error } = await supabase
        .from('categories')
        .select('id, parent_id')
        .in('id', allIds)

    if (error) {
        console.error('Error validating category order:', error)
        return { error: error.message }
    }

    if ((categories ?? []).length !== allIds.length) {
        return { error: 'One or more categories could not be found.' }
    }

    const parentById = new Map((categories ?? []).map((category) => [category.id, category.parent_id ?? null]))

    for (const group of groups) {
        const parentId = group.parentId ?? null

        for (const categoryId of group.orderedIds) {
            if ((parentById.get(categoryId) ?? null) !== parentId) {
                return { error: 'Categories can only be reordered within their current parent group.' }
            }
        }
    }

    let updated = 0

    for (const group of groups) {
        for (const [index, categoryId] of group.orderedIds.entries()) {
            const { error: updateError } = await supabase
                .from('categories')
                .update({ sort_order: (index + 1) * 10 })
                .eq('id', categoryId)

            if (updateError) {
                console.error('Error updating category order:', updateError)
                return { error: updateError.message }
            }

            updated += 1
        }
    }

    revalidatePath('/admin/categories')
    revalidatePath('/admin/products')
    revalidatePath('/admin/products/new')
    return { success: true, updated }
}

export async function deleteCategory(id: string) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()

    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting category:', error)
        return { error: error.message }
    }

    revalidatePath('/admin/categories')
    revalidatePath('/admin/products/new')
    return { success: true }
}
