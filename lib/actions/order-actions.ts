'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// --- CUSTOMERS ---

export async function getCustomers(query: string = '') {
    const supabase = await createClient()
    let dbQuery = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

    if (query) {
        dbQuery = dbQuery.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery
    if (error) {
        console.error('Error fetching customers:', error)
        return []
    }
    return data
}

export async function createCustomer(formData: FormData) {
    const supabase = await createClient()
    const data = {
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        email: formData.get('email') as string || null,
        phone: formData.get('phone') as string,
        addresses: [], // Can handle complex address logic later if needed
    }

    const { data: newCustomer, error } = await supabase.from('customers').insert(data).select().single()

    if (error) return { error: error.message }
    return { success: true, customer: newCustomer }
}

// --- ORDERS ---

export async function getOrders(query: string = '') {
    const supabase = await createClient()
    let dbQuery = supabase
        .from('orders')
        .select(`
            *,
            customers (first_name, last_name, email),
            order_items (count)
        `)
        .order('created_at', { ascending: false })

    // Build query filter if needed (complex for relations, simple for main table)
    if (query) {
        // Search by order number usually
        // Note: order_number is BigInt, ilike might fail. casting needed or exact match.
        // For string search, we might fallback to filtered clientside or just exact ID match
        if (!isNaN(Number(query))) {
            dbQuery = dbQuery.eq('order_number', query)
        }
    }

    const { data, error } = await dbQuery
    if (error) {
        console.error('Error fetching orders:', error)
        return []
    }
    return data
}

export async function getOrder(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                product_variants (
                    id, 
                    sku, 
                    products (title, product_media(media_url))
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error) return null
    return data
}

export type CreateOrderInput = {
    customer_id: string
    payment_status: string
    total_amount: number
    status?: string // Allow overriding status (e.g. 'delivered' for POS)
    items: {
        variant_id: string
        quantity: number
        unit_price: number
    }[]
    // POS Fields
    discount_amount?: number
    tax_amount?: number
    payment_method?: string
    order_type?: 'online' | 'pos'
    notes?: string
}

export async function createOrder(input: CreateOrderInput) {
    const supabase = await createClient()

    // 1. Create Order
    // NOTE: POS fields (customer_id, discount_amount, tax_amount, payment_method, order_type) 
    // Mapping POS frontend data to correct DB columns based on actual schema
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            user_id: input.customer_id || null, // customer_id maps to user_id (optional)
            financial_status: input.payment_status === 'paid' ? 'paid' : 'pending',
            fulfillment_status: input.status === 'delivered' ? 'fulfilled' : 'unfulfilled',
            grand_total: input.total_amount, // total_amount maps to grand_total
            subtotal: input.total_amount - (input.tax_amount || 0) + (input.discount_amount || 0),

            // Expected columns from recent DB check
            discount_amount: input.discount_amount || 0,
            tax_amount: input.tax_amount || 0,
            payment_method: input.payment_method || 'Cash',
            order_type: input.order_type || 'pos',
            notes: input.notes
        })
        .select()
        .single()

    if (orderError) return { error: orderError.message }

    // 2. Create Order Items
    const itemsData = input.items.map(item => ({
        order_id: order.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(itemsData)

    if (itemsError) {
        console.error('Error creating items:', itemsError)
        return { error: 'Order created but failed to add items.' }
    }

    // 3. Update Inventory (Immediate deduction)
    for (const item of input.items) {
        const { data: inventory } = await supabase
            .from('inventory_items')
            .select('available_quantity, id')
            .eq('variant_id', item.variant_id)
            .single()

        if (inventory) {
            await supabase
                .from('inventory_items')
                .update({ available_quantity: inventory.available_quantity - item.quantity })
                .eq('id', inventory.id)
        }
    }

    revalidatePath('/admin/orders')
    return { success: true, orderId: order.id }
}

export async function updateOrderStatus(id: string, status: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath(`/admin/orders/${id}`)
    revalidatePath('/admin/orders')
    return { success: true }
}

export async function getCustomer(id: string) {
    const supabase = await createClient()

    // Fetch customer profile
    const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()

    if (error) return null

    // Fetch order history
    const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(count)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })

    return { ...customer, orders: orders || [] }
}

export async function updateCustomer(id: string, formData: FormData) {
    const supabase = await createClient()
    const data = {
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        email: formData.get('email') as string || null,
        phone: formData.get('phone') as string,
    }

    const { error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath(`/admin/customers/${id}`)
    revalidatePath('/admin/customers')
    revalidatePath('/admin/orders')

    return { success: true }
}

export async function deleteCustomer(id: string) {
    const supabase = await createClient()

    const { error } = await supabase.from('customers').delete().eq('id', id)

    if (error) {
        console.error("Error deleting customer", error)
        return { error: 'Failed to delete customer. They may have related orders.' }
    }

    revalidatePath('/admin/customers')
    return { success: true }
}
