'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { notifyLowStock } from '@/lib/notify'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'

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

type InventoryVariantRow = {
    id: string
    sku?: string | null
    products?: {
        title?: string | null
        product_media?: Array<{ media_url?: string | null }> | null
    } | null
    inventory_items?: Array<{
        available_quantity?: number | null
        reorder_point?: number | null
        bin_location?: string | null
    }> | null
}

type InventoryStatRow = {
    available_quantity?: number | null
    reorder_point?: number | null
}

export async function getInventoryItems(query: string = '', page: number = 1, limit: number = 20) {
    await requireActionPermission('manage_inventory')
    const supabase = await createClient()
    const { from, to } = getPagination({ page, limit, defaultLimit: 20, maxLimit: 50 })
    const searchTerm = normalizeSearchTerm(query)

    // 1. Fetch Variants with Inventory and Product info
    // We assume 1 location for now (MVP)
    let dbQuery = supabase
        .from('product_variants')
        .select(`
            id,
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
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchTerm) {
        dbQuery = dbQuery.ilike('sku', `%${searchTerm}%`)
    }

    const { data, error, count } = await dbQuery

    if (error) {
        console.error('Error fetching inventory:', error)
        return { items: [], count: 0, error: error.message }
    }

    // 2. Transform Data
    const items: InventoryItem[] = ((data ?? []) as InventoryVariantRow[]).map((variant) => {
        const inventory = variant.inventory_items?.[0] || { available_quantity: 0, reorder_point: 10, bin_location: '' }
        const quantity = inventory.available_quantity || 0
        const reorderPoint = inventory.reorder_point || 10

        let status: InventoryItem['status'] = 'in_stock'
        if (quantity === 0) status = 'out_of_stock'
        else if (quantity <= reorderPoint) status = 'low_stock'

        return {
            id: variant.id,
            title: variant.products?.title || variant.sku || 'Variant',
            sku: variant.sku || '',
            product_title: variant.products?.title || '',
            product_image: variant.products?.product_media?.[0]?.media_url || null,
            quantity,
            reorder_point: reorderPoint,
            bin_location: inventory.bin_location || null,
            status
        }
    })

    // Filter if needed (handled by DB query for text, but here for safety/flexibility)
    return { items, count: count || items.length, error: null }
}

export async function updateStock(variantId: string, newQuantity: number, reason?: string) {
    const access = await requireActionPermission('manage_inventory')
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    if (newQuantity < 0) {
        return { error: 'Quantity cannot be negative.' }
    }

    // Get current quantity to compute delta
    const { data: current } = await supabase
        .from('inventory_items')
        .select('available_quantity')
        .eq('variant_id', variantId)
        .limit(1)
        .single()

    const currentQty = current?.available_quantity ?? 0
    const delta = newQuantity - currentQty

    if (delta === 0) {
        return { success: true }
    }

    const rpcName = delta < 0 ? 'reserve_stock' : 'release_stock'
    const qty = Math.abs(delta)

    const { data: ok, error } = await supabaseAdmin.rpc(rpcName, {
        p_variant_id: variantId,
        p_qty: qty,
        p_reference: null
    })

    if (error || ok === false) {
        return { error: error?.message || 'Stock update failed (concurrent change or insufficient stock).' }
    }

    await logAudit({
        actorId: access.user?.id,
        action: 'inventory.update',
        entityType: 'variant',
        entityId: variantId,
        after: { quantity: newQuantity, reason: reason || null }
    })
    if (newQuantity <= (currentQty ?? 0)) {
        await notifyLowStock(variantId)
    }

    revalidatePath('/admin/inventory')
    return { success: true }
}

export async function updateBinLocation(variantId: string, binLocation: string) {
    await requireActionPermission('manage_inventory')
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
    await requireActionPermission('manage_inventory')
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_inventory_stats')

    if (!error && Array.isArray(data) && data[0]) {
        return {
            totalItems: Number(data[0].total_items || 0),
            lowStock: Number(data[0].low_stock || 0),
            outOfStock: Number(data[0].out_of_stock || 0),
        }
    }

    console.warn('Falling back to client-side inventory stats aggregation:', error?.message)

    const { count: totalItems } = await supabase
        .from('product_variants')
        .select('*', { count: 'exact', head: true })

    const { data: inventory } = await supabase
        .from('inventory_items')
        .select('available_quantity, reorder_point')

    let lowStockCount = 0
    let outOfStockCount = 0

    ;(inventory as InventoryStatRow[] | null)?.forEach((item) => {
        const availableQuantity = item.available_quantity ?? 0
        const reorderPoint = item.reorder_point ?? 10

        if (availableQuantity === 0) outOfStockCount++
        else if (availableQuantity <= reorderPoint) lowStockCount++
    })

    return {
        totalItems: totalItems || 0,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
    }
}
