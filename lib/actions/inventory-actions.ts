'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export type InventoryItem = {
    id: string // variant_id
    title: string
    sku: string
    product_title: string
    product_image: string | null
    quantity: number
    reorder_point: number
    bin_location: string | null
    status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

export async function getInventoryItems(query: string = '') {
    const supabase = await createClient()

    // 1. Fetch Variants with Inventory and Product info
    // We assume 1 location for now (MVP)
    let dbQuery = supabase
        .from('product_variants')
        .select(`
            id,
            title,
            sku,
            product_id,
            products!inner (
                title,
                product_media (media_url)
            ),
            inventory_items (
                available_quantity,
                reorder_point,
                bin_location
            )
        `)
        .order('created_at', { ascending: false })

    if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,sku.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery

    if (error) {
        console.error('Error fetching inventory:', error)
        return []
    }

    // 2. Transform Data
    const items: InventoryItem[] = data.map((variant: any) => {
        const inventory = variant.inventory_items?.[0] || { available_quantity: 0, reorder_point: 10, bin_location: '' }
        const quantity = inventory.available_quantity || 0
        const reorderPoint = inventory.reorder_point || 10

        let status: InventoryItem['status'] = 'in_stock'
        if (quantity === 0) status = 'out_of_stock'
        else if (quantity <= reorderPoint) status = 'low_stock'

        return {
            id: variant.id,
            title: variant.title,
            sku: variant.sku,
            product_title: variant.products?.title,
            product_image: variant.products?.product_media?.[0]?.media_url || null,
            quantity,
            reorder_point: reorderPoint,
            bin_location: inventory.bin_location,
            status
        }
    })

    // Filter if needed (handled by DB query for text, but here for safety/flexibility)
    return items
}

export async function updateStock(variantId: string, newQuantity: number, reason?: string) {
    const supabase = await createClient()

    // Get default location
    const { data: location } = await supabase.from('locations').select('id').limit(1).single()
    if (!location) return { error: 'No location found' }

    // Update or Insert Inventory Item
    // We use upsert to be safe, though item should exist
    const { error } = await supabase
        .from('inventory_items')
        .upsert({
            variant_id: variantId,
            location_id: location.id,
            available_quantity: newQuantity,
            updated_at: new Date().toISOString()
        }, { onConflict: 'variant_id, location_id' })

    if (error) {
        console.error('Error updating stock:', error)
        return { error: 'Failed to update stock' }
    }

    revalidatePath('/admin/inventory')
    return { success: true }
}

export async function updateBinLocation(variantId: string, binLocation: string) {
    const supabase = await createClient()
    const { data: location } = await supabase.from('locations').select('id').limit(1).single()

    const { error } = await supabase
        .from('inventory_items')
        .update({ bin_location: binLocation })
        .eq('variant_id', variantId)
        .eq('location_id', location?.id) // Safety check

    if (error) {
        return { error: 'Failed to update bin location' }
    }

    revalidatePath('/admin/inventory')
    return { success: true }
}

export async function getInventoryStats() {
    const supabase = await createClient()

    // Total Items
    const { count: totalItems } = await supabase
        .from('product_variants')
        .select('*', { count: 'exact', head: true })

    // Low Stock (Needs computed query or fetch all)
    // For large DBs, this shouldn't be done in JS, but for MVP it's fine
    // Or write a specific query
    const { data: inventory } = await supabase
        .from('inventory_items')
        .select('available_quantity, reorder_point')

    let lowStockCount = 0
    let outOfStockCount = 0

    inventory?.forEach((item: any) => {
        if (item.available_quantity === 0) outOfStockCount++
        else if (item.available_quantity <= (item.reorder_point || 10)) lowStockCount++
    })

    return {
        totalItems: totalItems || 0,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount
    }
}
