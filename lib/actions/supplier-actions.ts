'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getSuppliers(query?: string) {
    const supabase = await createClient()
    let dbQuery = supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })

    if (query) {
        dbQuery = dbQuery.ilike('name', `%${query}%`)
    }

    const { data, error } = await dbQuery

    if (error) {
        console.error('Error fetching suppliers:', error)
        return []
    }

    return data
}

export async function getSupplier(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching supplier:', error)
        return null
    }

    return data
}

export async function createSupplier(formData: FormData) {
    const supabase = await createClient()

    const supplier = {
        name: formData.get('name') as string,
        contact_person: formData.get('contact_person') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        tax_id: formData.get('tax_id') as string,
        is_active: true
    }

    const { error } = await supabase
        .from('suppliers')
        .insert(supplier)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/admin/suppliers')
    return { success: true }
}

export async function updateSupplier(id: string, formData: FormData) {
    const supabase = await createClient()

    const supplier = {
        name: formData.get('name') as string,
        contact_person: formData.get('contact_person') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        tax_id: formData.get('tax_id') as string,
    }

    const { error } = await supabase
        .from('suppliers')
        .update(supplier)
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/admin/suppliers')
    return { success: true }
}

export async function deleteSupplier(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/admin/suppliers')
    return { success: true }
}
