'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getCategories() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

    if (error) {
        console.error('Error fetching categories:', error)
        return []
    }

    return data
}

export async function createCategory(formData: FormData) {
    const supabase = await createClient()

    const category = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        parent_id: formData.get('parent_id') ? formData.get('parent_id') as string : null,
        image_url: formData.get('image_url') as string,
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
    const supabase = await createClient()

    const category = {
        name: formData.get('name') as string,
        slug: formData.get('slug') as string,
        description: formData.get('description') as string,
        parent_id: formData.get('parent_id') ? formData.get('parent_id') as string : null,
        image_url: formData.get('image_url') as string,
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
