'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getPagination, normalizeSearchTerm } from '@/lib/server/pagination'

const PurchaseOrderItemSchema = z.object({
    variant_id: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
    unit_cost: z.coerce.number().positive(),
})

const PurchaseOrderSchema = z.object({
    supplier_id: z.string().uuid({ message: "Supplier is required" }),
    expected_date: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(PurchaseOrderItemSchema).min(1, { message: "At least one item is required" })
})

export type PurchaseOrderState = {
    error?: string
    success?: boolean
}

export async function getPurchaseOrders(query?: string, page: number = 1, limit: number = 20) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()
    const { from, to } = getPagination({ page, limit, defaultLimit: 20, maxLimit: 50 })
    const searchTerm = normalizeSearchTerm(query)

    let dbQuery = supabase
        .from('purchase_orders')
        .select(`
            id, 
            order_number, 
            status, 
            total_amount, 
            expected_date, 
            created_at,
            suppliers (name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchTerm) {
        // Search by order number or supplier name
        // Note: searching localized relation fields (suppliers.name) in Supabase is tricky with simple ilike
        // We'll stick to order_number for now or filtering in memory if needed, 
        // but for simple text search on ID/Order Number:
        if (!isNaN(Number(searchTerm))) {
            dbQuery = dbQuery.eq('order_number', Number(searchTerm))
        }
    }

    const { data, error, count } = await dbQuery

    if (error) {
        console.error('Error fetching purchase orders:', error)
        return { data: [], count: 0, error: error.message }
    }

    return { data, count: count || 0, error: null }
}

export async function getPurchaseOrder(id: string) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
            *,
            suppliers (*),
            purchase_order_items (
                *,
                product_variants (
                    id,
                    sku,
                    products (title, product_media (media_url))
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching purchase order:', error)
        return null
    }

    return data
}

export async function createPurchaseOrder(prevState: PurchaseOrderState, formData: FormData): Promise<PurchaseOrderState> {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()

    // 1. Parse Data
    const rawItems = formData.get('items') as string
    const items = rawItems ? JSON.parse(rawItems) : []

    const validatedFields = PurchaseOrderSchema.safeParse({
        supplier_id: formData.get('supplier_id'),
        expected_date: formData.get('expected_date'),
        notes: formData.get('notes'),
        items: items
    })

    if (!validatedFields.success) {
        return {
            error: validatedFields.error.flatten().fieldErrors.supplier_id?.[0] ||
                validatedFields.error.flatten().fieldErrors.items?.[0] ||
                "Invalid data"
        }
    }

    const { supplier_id, expected_date, notes, items: validItems } = validatedFields.data

    // Calculate total
    const total_amount = validItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)

    // 2. Insert PO
    const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
            supplier_id,
            total_amount,
            expected_date: expected_date || null,
            notes,
            status: 'draft'
        })
        .select()
        .single()

    if (poError) {
        console.error('Error creating PO:', poError)
        return { error: 'Failed to create Purchase Order' }
    }

    // 3. Insert Items
    const itemsData = validItems.map(item => ({
        purchase_order_id: poData.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost
    }))

    const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsData)

    if (itemsError) {
        console.error('Error creating PO items:', itemsError)
        // Ideally rollback PO here, but Supabase doesn't support transactions via client easily without RPC
        // For this MVP, we'll delete the PO if items fail (manual "rollback")
        await supabase.from('purchase_orders').delete().eq('id', poData.id)
        return { error: 'Failed to add items to Purchase Order' }
    }

    revalidatePath('/admin/purchase-orders')
    return { success: true }
}

export async function approvePurchaseOrder(id: string) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()

    const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'approved' })
        .eq('id', id)
        .in('status', ['draft'])

    if (error) return { error: 'Failed to approve order' }

    revalidatePath('/admin/purchase-orders')
    revalidatePath(`/admin/purchase-orders/${id}`)
    return { success: true }
}

export async function markPurchaseOrderInvoiced(id: string) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()

    const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'invoiced' })
        .eq('id', id)
        .in('status', ['received'])

    if (error) return { error: 'Failed to mark invoiced' }

    revalidatePath('/admin/purchase-orders')
    revalidatePath(`/admin/purchase-orders/${id}`)
    return { success: true }
}

export async function receivePurchaseOrder(id: string) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()

    // 1. Fetch PO items
    const { data: po, error: fetchError } = await supabase
        .from('purchase_orders')
        .select(`
            *,
            purchase_order_items (*)
        `)
        .eq('id', id)
        .single()

    if (fetchError || !po) {
        return { error: 'Purchase Order not found' }
    }

    if (po.status !== 'approved') {
        return { error: 'Order must be approved before receiving' }
    }

    // 2. Update Inventory (This should ideally be an RPC for atomicity)
    const { data: location } = await supabase.from('locations').select('id').limit(1).single()

    for (const item of po.purchase_order_items) {
        if (!location) break

        // Upsert inventory per variant/location
        const { data: existingInv } = await supabase
            .from('inventory_items')
            .select('id, available_quantity')
            .eq('variant_id', item.variant_id)
            .eq('location_id', location.id)
            .single()

        if (existingInv) {
            await supabase
                .from('inventory_items')
                .update({ available_quantity: (existingInv.available_quantity || 0) + item.quantity })
                .eq('id', existingInv.id)
        } else {
            await supabase
                .from('inventory_items')
                .insert({
                    variant_id: item.variant_id,
                    location_id: location.id,
                    available_quantity: item.quantity
                })
        }

        // Mark item as received (full qty)
        await supabase
            .from('purchase_order_items')
            .update({ received_quantity: item.quantity })
            .eq('id', item.id)
    }

    // 3. Update PO Status
    const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'received' })
        .eq('id', id)

    if (updateError) {
        return { error: 'Failed to update order status' }
    }

    revalidatePath('/admin/purchase-orders')
    revalidatePath(`/admin/purchase-orders/${id}`)
    return { success: true }
}

export async function deletePurchaseOrder(id: string) {
    await requireActionPermission('manage_suppliers')
    const supabase = await createClient()

    // Prevent delete if already received/invoiced/approved
    const { data: po } = await supabase
        .from('purchase_orders')
        .select('status')
        .eq('id', id)
        .single()

    if (po && ['received', 'invoiced', 'approved'].includes(po.status)) {
        return { error: 'Cannot delete an approved/received/invoiced PO' }
    }

    // Ensure not referenced by items (safety if FK absent)
    const { count: itemCount } = await supabase
        .from('purchase_order_items')
        .select('id', { count: 'exact', head: true })
        .eq('purchase_order_id', id)

    if ((itemCount ?? 0) > 0) {
        return { error: 'Cannot delete PO with items; remove items first.' }
    }

    const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: 'Failed to delete order' }
    }

    revalidatePath('/admin/purchase-orders')
    return { success: true }
}
