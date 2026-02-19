'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

export async function getPurchaseOrders(query?: string) {
    const supabase = await createClient()

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
        `)
        .order('created_at', { ascending: false })

    if (query) {
        // Search by order number or supplier name
        // Note: searching localized relation fields (suppliers.name) in Supabase is tricky with simple ilike
        // We'll stick to order_number for now or filtering in memory if needed, 
        // but for simple text search on ID/Order Number:
        dbQuery = dbQuery.textSearch('order_number', query)
    }

    const { data, error } = await dbQuery

    if (error) {
        console.error('Error fetching purchase orders:', error)
        return []
    }

    return data
}

export async function getPurchaseOrder(id: string) {
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
                    title,
                    sku,
                    products (title, images)
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
            status: 'ordered' // Direct to ordered for now, or 'draft' if we add draft logic
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

export async function receivePurchaseOrder(id: string) {
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

    if (po.status === 'received') {
        return { error: 'Order already received' }
    }

    // 2. Update Inventory (This should ideally be an RPC for atomicity)
    // We will loop through items and update inventory one by one for now
    for (const item of po.purchase_order_items) {
        // Fetch current variant to get current quantity
        const { data: variant } = await supabase
            .from('product_variants')
            .select('quantity')
            .eq('id', item.variant_id)
            .single()

        if (variant) {
            await supabase
                .from('product_variants')
                .update({ quantity: (variant.quantity || 0) + item.quantity })
                .eq('id', item.variant_id)
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
    const supabase = await createClient()

    // Only allow delete if not received (simple check)
    // The foreign key constraint on items is ON DELETE CASCADE according to schema? 
    // Let's check schema: "purchase_order_id uuid references purchase_orders(id) on delete cascade" -> Yes.

    const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id)
        .neq('status', 'received') // Prevent deleting received orders for audit

    if (error) {
        return { error: 'Failed to delete order (cannot delete Received orders)' }
    }

    revalidatePath('/admin/purchase-orders')
    return { success: true }
}
