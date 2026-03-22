'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 20

export async function getReviews(status: string = 'pending', page: number = 1) {
    await requireActionPermission('manage_reviews')
    const supabase = await createClient()
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const query = supabase
        .from('reviews')
        .select('*, products(title)')
        .order('created_at', { ascending: false })
        .range(from, to)
        .eq('status', status)

    const { data, error } = await query
    if (error) {
        console.error('Error fetching reviews', error)
        return { data: [], error: error.message }
    }
    return { data: data || [], error: null }
}

export async function updateReviewStatus(id: string, status: 'approved' | 'rejected' | 'spam') {
    await requireActionPermission('manage_reviews')
    const supabase = await createClient()
    const { error } = await supabase
        .from('reviews')
        .update({ status })
        .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/admin/reviews')
    return { success: true }
}
