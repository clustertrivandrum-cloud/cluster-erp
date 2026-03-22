'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'

export type SupplierRecord = {
    id: string
    name: string
    contact_person: string | null
    email: string | null
    phone: string | null
    address: string | null
    tax_id: string | null
}

export async function getSuppliers(query?: string) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()
    const searchTerm = normalizeSearchTerm(query)
    let dbQuery = supabase
        .from('suppliers')
        .select('id, name, contact_person, email, phone, address, tax_id')
        .order('created_at', { ascending: false })

    if (searchTerm) {
        dbQuery = dbQuery.ilike('name', `%${searchTerm}%`)
    }

    const { data, error } = await dbQuery

    if (error) {
        console.error('Error fetching suppliers:', error)
        return []
    }

    return data
}

export async function getSupplierPage(params?: { query?: string; page?: number; limit?: number }) {
    const { query = '', page = 1, limit = 10 } = params || {}
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()
    const { from, to } = getPagination({ page, limit, defaultLimit: 10, maxLimit: 50 })
    const searchTerm = normalizeSearchTerm(query)

    let dbQuery = supabase
        .from('suppliers')
        .select('id, name, contact_person, email, phone, address, tax_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchTerm) {
        dbQuery = dbQuery.or(`name.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,tax_id.ilike.%${searchTerm}%`)
    }

    const { data, error, count } = await dbQuery

    if (error) {
        console.error('Error fetching supplier page:', error)
        return { data: [], count: 0, error: error.message }
    }

    return {
        data: (data ?? []) as SupplierRecord[],
        count: count ?? 0,
        error: null,
    }
}

export async function getSupplier(id: string) {
    await requireActionPermission('manage_suppliers')
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
    await requireActionPermission('manage_suppliers')
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
    await requireActionPermission('manage_suppliers')
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
    await requireActionPermission('manage_suppliers')
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
