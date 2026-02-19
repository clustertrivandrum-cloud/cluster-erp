'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single() // Should only be one row

    if (error) {
        // If no row (shouldn't happen due to migration insert, but just in case)
        return null
    }
    return data
}

export async function updateSettings(formData: FormData) {
    const supabase = await createClient()

    // Get the ID (we assume the single row)
    const { data: current } = await supabase.from('app_settings').select('id').single()

    if (!current) return { error: "Settings not initialized" }

    const data = {
        store_name: formData.get('store_name') as string,
        store_email: formData.get('store_email') as string,
        store_phone: formData.get('store_phone') as string,
        store_address: formData.get('store_address') as string,
        store_currency: formData.get('store_currency') as string,
        tax_rate: parseFloat(formData.get('tax_rate') as string) || 0,
        gstin: formData.get('gstin') as string,
        // Logo handling would go here (upload to storage -> get URL)
        // For now we skip logo upload or handle it separately
        updated_at: new Date().toISOString()
    }

    const { error } = await supabase
        .from('app_settings')
        .update(data)
        .eq('id', current.id)

    if (error) return { error: error.message }

    revalidatePath('/admin/settings')
    return { success: true }
}
