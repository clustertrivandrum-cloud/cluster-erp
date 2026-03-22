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
    banner_kicker?: string | null
    banner_title?: string | null
    banner_description?: string | null
    banner_image_url?: string | null
    banner_mobile_image_url?: string | null
    parent_name?: string | null
}

export async function getCategories() {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, description, parent_id, image_url, banner_kicker, banner_title, banner_description, banner_image_url, banner_mobile_image_url')
        .order('name')

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
        .select('id, name, parent_id')
        .order('name')

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
        .select('id, name, slug, description, parent_id, image_url, banner_kicker, banner_title, banner_description, banner_image_url, banner_mobile_image_url', { count: 'exact' })
        .order('name')
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

export async function createCategory(formData: FormData) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()

    const category = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        parent_id: formData.get('parent_id') ? formData.get('parent_id') as string : null,
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

    const category = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        parent_id: formData.get('parent_id') ? formData.get('parent_id') as string : null,
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
