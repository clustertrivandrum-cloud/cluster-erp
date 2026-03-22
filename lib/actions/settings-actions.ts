'use server'

import { requireActionPermission } from '@/lib/auth'
import { normalizeInvoiceTemplate } from '@/lib/invoice-template'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
    await requireActionPermission(['manage_settings', 'access_pos', 'manage_orders'])
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
    await requireActionPermission('manage_settings')
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
        free_shipping_threshold: parseFloat(formData.get('free_shipping_threshold') as string) || 0,
        kerala_shipping_charge: parseFloat(formData.get('kerala_shipping_charge') as string) || 0,
        other_states_shipping_charge: parseFloat(formData.get('other_states_shipping_charge') as string) || 0,
        invoice_template: normalizeInvoiceTemplate(
            (() => {
                const raw = formData.get('invoice_template') as string | null
                if (!raw) {
                    return null
                }

                try {
                    return JSON.parse(raw)
                } catch {
                    return null
                }
            })()
        ),
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
    revalidatePath('/admin/orders')
    revalidatePath('/admin/pos')
    return { success: true }
}
