'use server'

import { revalidatePath } from 'next/cache'
import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'

type RawCouponRow = {
    id: string
    code: string
    description?: string | null
    discount_type?: 'percentage' | 'fixed' | null
    discount_value?: number | string | null
    min_order_value?: number | string | null
    max_discount?: number | string | null
    usage_limit?: number | null
    used_count?: number | null
    is_active?: boolean | null
    starts_at?: string | null
    expires_at?: string | null
    created_at?: string | null
    discount_amount?: number | string | null
    discount_percent?: number | string | null
    max_uses?: number | null
    uses?: number | null
}

export type CouponRow = {
    id: string
    code: string
    description: string | null
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    min_order_value: number
    max_discount: number | null
    usage_limit: number | null
    used_count: number
    is_active: boolean
    starts_at: string | null
    expires_at: string | null
    created_at: string
}

export type CouponInput = {
    id?: string
    code: string
    description?: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    minOrderValue?: number
    maxDiscount?: number | null
    usageLimit?: number | null
    isActive: boolean
    startsAt?: string | null
    expiresAt?: string | null
}

function normalizeNullableNumber(value: number | null | undefined) {
    if (value === null || value === undefined || value === 0) return null
    return Number(value)
}

function normalizeNullableString(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : null
}

function normalizeNumber(value: number | string | null | undefined, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback
    const normalized = Number(value)
    return Number.isFinite(normalized) ? normalized : fallback
}

function normalizeCouponRow(row: RawCouponRow): CouponRow {
    const discountType = row.discount_type || (normalizeNumber(row.discount_percent) > 0 ? 'percentage' : 'fixed')
    const discountValue = discountType === 'percentage'
        ? normalizeNumber(row.discount_value ?? row.discount_percent)
        : normalizeNumber(row.discount_value ?? row.discount_amount)

    return {
        id: row.id,
        code: row.code,
        description: normalizeNullableString(row.description),
        discount_type: discountType,
        discount_value: discountValue,
        min_order_value: normalizeNumber(row.min_order_value),
        max_discount: row.max_discount === null || row.max_discount === undefined ? null : normalizeNumber(row.max_discount),
        usage_limit: row.usage_limit ?? row.max_uses ?? null,
        used_count: normalizeNumber(row.used_count ?? row.uses),
        is_active: row.is_active ?? true,
        starts_at: row.starts_at || null,
        expires_at: row.expires_at || null,
        created_at: row.created_at || new Date(0).toISOString(),
    }
}

function validateCouponInput(input: CouponInput) {
    const code = input.code.trim().toUpperCase()
    if (!code) {
        throw new Error('Coupon code is required.')
    }

    const discountValue = Number(input.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error('Discount value must be greater than zero.')
    }

    if (input.discountType === 'percentage' && discountValue > 100) {
        throw new Error('Percentage discount cannot exceed 100.')
    }

    const minOrderValue = Math.max(0, Number(input.minOrderValue || 0))
    const maxDiscount = normalizeNullableNumber(input.maxDiscount)
    const usageLimit = normalizeNullableNumber(input.usageLimit)
    const startsAt = normalizeNullableString(input.startsAt)
    const expiresAt = normalizeNullableString(input.expiresAt)

    if (maxDiscount !== null && maxDiscount < 0) {
        throw new Error('Max discount must be zero or greater.')
    }

    if (usageLimit !== null && usageLimit < 0) {
        throw new Error('Usage limit must be zero or greater.')
    }

    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
        throw new Error('Expiry must be later than the start date.')
    }

    return {
        code,
        description: normalizeNullableString(input.description),
        discount_type: input.discountType,
        discount_value: discountValue,
        min_order_value: minOrderValue,
        max_discount: maxDiscount,
        usage_limit: usageLimit ? Math.round(usageLimit) : null,
        is_active: Boolean(input.isActive),
        starts_at: startsAt,
        expires_at: expiresAt,
    }
}

function buildLegacyCouponPayload(payload: ReturnType<typeof validateCouponInput>) {
    return {
        code: payload.code,
        description: payload.description,
        discount_amount: payload.discount_type === 'fixed' ? payload.discount_value : 0,
        discount_percent: payload.discount_type === 'percentage' ? payload.discount_value : null,
        max_uses: payload.usage_limit,
        min_order_value: payload.min_order_value,
        starts_at: payload.starts_at,
        expires_at: payload.expires_at,
    }
}

function formatCouponSchemaError(message: string) {
    if (!/column .* does not exist/i.test(message)) return message
    return `${message}. Run the coupon migration to unlock the full admin manager.`
}

function stripMissingColumn<T extends Record<string, unknown>>(payload: T, message: string): T {
    const match = message.match(/(?:Could not find the '([^']+)' column|column\s+coupons\.([a-zA-Z0-9_]+)\s+does not exist)/i)
    const missingColumn = match?.[1] || match?.[2]

    if (!missingColumn || !(missingColumn in payload)) {
        return payload
    }

    const nextPayload = { ...payload }
    delete nextPayload[missingColumn]
    return nextPayload
}

export async function getCoupons() {
    await requireActionPermission('manage_settings')
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { data: [] as CouponRow[], error: error.message }
    }

    return { data: ((data || []) as RawCouponRow[]).map(normalizeCouponRow), error: null }
}

export async function saveCoupon(input: CouponInput) {
    await requireActionPermission('manage_settings')
    const supabase = await createClient()

    try {
        const payload = validateCouponInput(input)
        const legacyPayload = buildLegacyCouponPayload(payload)

        if (input.id) {
            let primaryPayload = payload
            let primary = await supabase
                .from('coupons')
                .update(primaryPayload)
                .eq('id', input.id)
                .select('*')
                .single()

            if (primary.error && /column .* does not exist/i.test(primary.error.message)) {
                primaryPayload = stripMissingColumn(primaryPayload, primary.error.message)
                primary = await supabase
                    .from('coupons')
                    .update(primaryPayload)
                    .eq('id', input.id)
                    .select('*')
                    .single()
            }

            if (primary.error) {
                let fallbackPayload = legacyPayload
                const fallback = await supabase
                    .from('coupons')
                    .update(fallbackPayload)
                    .eq('id', input.id)
                    .select('*')
                    .single()

                if (fallback.error && /column .* does not exist/i.test(fallback.error.message)) {
                    fallbackPayload = stripMissingColumn(fallbackPayload, fallback.error.message)
                    const retriedFallback = await supabase
                        .from('coupons')
                        .update(fallbackPayload)
                        .eq('id', input.id)
                        .select('*')
                        .single()

                    if (retriedFallback.error) {
                        return { success: false, error: formatCouponSchemaError(retriedFallback.error.message) }
                    }

                    revalidatePath('/admin/coupons')
                    return { success: true, data: normalizeCouponRow(retriedFallback.data as RawCouponRow) }
                }

                if (fallback.error) {
                    return { success: false, error: formatCouponSchemaError(primary.error.message) }
                }

                revalidatePath('/admin/coupons')
                return { success: true, data: normalizeCouponRow(fallback.data as RawCouponRow) }
            }

            revalidatePath('/admin/coupons')
            return { success: true, data: normalizeCouponRow(primary.data as RawCouponRow) }
        } else {
            let primaryPayload = payload
            let primary = await supabase
                .from('coupons')
                .insert(primaryPayload)
                .select('*')
                .single()

            if (primary.error && /column .* does not exist/i.test(primary.error.message)) {
                primaryPayload = stripMissingColumn(primaryPayload, primary.error.message)
                primary = await supabase
                    .from('coupons')
                    .insert(primaryPayload)
                    .select('*')
                    .single()
            }

            if (primary.error) {
                let fallbackPayload = {
                    ...legacyPayload,
                    uses: 0,
                }
                const fallback = await supabase
                    .from('coupons')
                    .insert(fallbackPayload)
                    .select('*')
                    .single()

                if (fallback.error && /column .* does not exist/i.test(fallback.error.message)) {
                    fallbackPayload = stripMissingColumn(fallbackPayload, fallback.error.message)
                    const retriedFallback = await supabase
                        .from('coupons')
                        .insert(fallbackPayload)
                        .select('*')
                        .single()

                    if (retriedFallback.error) {
                        return { success: false, error: formatCouponSchemaError(retriedFallback.error.message) }
                    }

                    revalidatePath('/admin/coupons')
                    return { success: true, data: normalizeCouponRow(retriedFallback.data as RawCouponRow) }
                }

                if (fallback.error) {
                    return { success: false, error: formatCouponSchemaError(fallback.error.message) }
                }

                revalidatePath('/admin/coupons')
                return { success: true, data: normalizeCouponRow(fallback.data as RawCouponRow) }
            }

            revalidatePath('/admin/coupons')
            return { success: true, data: normalizeCouponRow(primary.data as RawCouponRow) }
        }
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Could not save coupon.' }
    }
}

export async function toggleCouponStatus(id: string, isActive: boolean) {
    await requireActionPermission('manage_settings')
    const supabase = await createClient()

    const { error } = await supabase
        .from('coupons')
        .update({ is_active: isActive })
        .eq('id', id)

    if (error) {
        return { success: false, error: formatCouponSchemaError(error.message) }
    }

    revalidatePath('/admin/coupons')
    return { success: true }
}

export async function deleteCoupon(id: string) {
    await requireActionPermission('manage_settings')
    const supabase = await createClient()

    const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/admin/coupons')
    return { success: true }
}
