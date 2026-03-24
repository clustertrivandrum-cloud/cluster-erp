'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'

const NullishOptionalStringSchema = z.preprocess(
    (value) => (value === null || value === undefined ? undefined : value),
    z.string().trim().optional()
)

const NullishUuidSchema = z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    z.string().uuid().nullable().optional()
)

const normalizeProductSlug = (value?: string | null) => {
    return (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

const BaseProductSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    slug: z.preprocess(
        (value) => normalizeProductSlug(typeof value === 'string' ? value : null),
        z.string().min(1, 'Slug is required')
    ),
    price: z.coerce.number().nonnegative('Price must be ≥ 0'),
    compare_at_price: z.coerce.number().nonnegative().nullable().optional(),
    cost_price: z.coerce.number().nonnegative().nullable().optional(),
    quantity: z.coerce.number().int().nonnegative().default(0),
    reorder_point: z.coerce.number().int().nonnegative().default(10),
    category_id: NullishUuidSchema,
    sku: NullishOptionalStringSchema,
})

const normalizeSku = (value?: string | null) => {
    const trimmed = (value || '').trim()
    return trimmed.length > 0 ? trimmed : undefined
}

const normalizeVariantIdentityToken = (value?: string | null) => {
    return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const getVariantSellableStatus = (productStatus?: string | null) => {
    switch ((productStatus || '').trim().toLowerCase()) {
        case 'active':
            return 'sellable'
        case 'archived':
            return 'archived'
        default:
            return 'draft'
    }
}

const getVariantIsActive = (productStatus?: string | null) => {
    return (productStatus || '').trim().toLowerCase() === 'active'
}

const buildVariantIdentity = (
    optionDefinitions: ProductOptionInput[] = [],
    variantOptions: Record<string, string> = {}
) => {
    const normalizedOptionLookup = new Map<string, string>()

    Object.entries(variantOptions).forEach(([name, value]) => {
        const trimmedName = name.trim()
        const trimmedValue = value?.trim()

        if (!trimmedName || !trimmedValue) {
            return
        }

        normalizedOptionLookup.set(trimmedName, trimmedValue)
    })

    const orderedSelections = optionDefinitions
        .map((option) => {
            const optionName = option.name?.trim()
            const optionValue = optionName ? normalizedOptionLookup.get(optionName) : undefined

            if (!optionName || !optionValue) {
                return null
            }

            return [optionName, optionValue] as const
        })
        .filter(Boolean) as Array<readonly [string, string]>

    if (orderedSelections.length === 0) {
        return {
            title: 'Default Variant',
            optionSignature: null as string | null,
        }
    }

    return {
        title: orderedSelections.map(([, value]) => value).join(' / '),
        optionSignature: JSON.stringify(
            orderedSelections.map(([name, value]) => [
                normalizeVariantIdentityToken(name),
                normalizeVariantIdentityToken(value),
            ])
        ),
    }
}

const toFloat = (value?: string | number | null) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0
    }

    const parsed = Number.parseFloat(value || '0')
    return Number.isFinite(parsed) ? parsed : 0
}

const toNullableFloat = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const parsed = toFloat(value)
    return Number.isFinite(parsed) ? parsed : null
}

const toInt = (value?: string | number | null, fallback = 0) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.trunc(value) : fallback
    }

    const parsed = Number.parseInt(value || '', 10)
    return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeOptions = (options: ProductOptionInput[] = []) => {
    return options
        .map((option) => ({
            id: option.id,
            name: (option.name || '').trim(),
            values: Array.isArray(option.values)
                ? option.values.map((value) => (value || '').trim()).filter(Boolean)
                : [],
        }))
        .filter((option) => option.name.length > 0 && option.values.length > 0)
}

const normalizeVariants = (variants: ProductVariantInput[] = []) => {
    return variants.map((variant) => ({
        ...variant,
        sku: typeof variant.sku === 'string' ? variant.sku : null,
        barcode: typeof variant.barcode === 'string' ? variant.barcode : null,
        bin_location: typeof variant.bin_location === 'string' ? variant.bin_location : null,
        weight_unit: typeof variant.weight_unit === 'string' ? variant.weight_unit : null,
        dimension_unit: typeof variant.dimension_unit === 'string' ? variant.dimension_unit : null,
        images: Array.isArray(variant.images)
            ? variant.images.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
            : [],
    }))
}

const parseProductPayload = (formData: FormData) => {
    const optionsJSON = formData.get('options')
    const variantsJSON = formData.get('variants')

    let options: ProductOptionInput[] = []
    let variants: ProductVariantInput[] = []

    try {
        if (typeof optionsJSON === 'string' && optionsJSON) {
            options = normalizeOptions(JSON.parse(optionsJSON))
        }

        if (typeof variantsJSON === 'string' && variantsJSON) {
            variants = normalizeVariants(JSON.parse(variantsJSON))
        }
    } catch (error) {
        console.error('Error parsing options/variants JSON', error)
    }

    return { options, variants }
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message
    }

    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        return error.message
    }

    return fallback
}

const getDefaultLocationId = async (supabase: Awaited<ReturnType<typeof createClient>>) => {
    const { data: location, error } = await supabase.from('locations').select('id').limit(1).single()

    if (error) {
        console.error('Error fetching default location:', error)
        return null
    }

    return location?.id ?? null
}

async function syncVariantInventory(
    supabase: Awaited<ReturnType<typeof createClient>>,
    variantId: string,
    locationId: string | null,
    quantity: string | number | null | undefined,
    reorderPoint: string | number | null | undefined,
    binLocation: string | null | undefined
) {
    if (!locationId) {
        return
    }

    const { data: existingInventory, error: existingInventoryError } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('variant_id', variantId)
        .eq('location_id', locationId)
        .single()

    if (existingInventoryError && existingInventoryError.code !== 'PGRST116') {
        throw existingInventoryError
    }

    const inventoryPayload = {
        variant_id: variantId,
        location_id: locationId,
        available_quantity: toInt(quantity, 0),
        reorder_point: toInt(reorderPoint, 10),
        bin_location: binLocation || null,
    }

    if (existingInventory?.id) {
        const { error } = await supabase
            .from('inventory_items')
            .update({
                available_quantity: inventoryPayload.available_quantity,
                reorder_point: inventoryPayload.reorder_point,
                bin_location: inventoryPayload.bin_location,
            })
            .eq('id', existingInventory.id)

        if (error) {
            throw error
        }

        return
    }

    const { error } = await supabase.from('inventory_items').insert(inventoryPayload)

    if (error) {
        throw error
    }
}

async function syncVariantMedia(
    supabase: Awaited<ReturnType<typeof createClient>>,
    variantId: string,
    images: string[] = []
) {
    const { error: deleteError } = await supabase.from('variant_media').delete().eq('variant_id', variantId)

    if (deleteError) {
        throw deleteError
    }

    if (images.length === 0) {
        return
    }

    const mediaInserts = images.map((url, index) => ({
        variant_id: variantId,
        media_url: url,
        position: index + 1,
    }))

    const { error } = await supabase.from('variant_media').insert(mediaInserts)

    if (error) {
        throw error
    }
}

async function syncProductOptionsAndVariants(
    supabase: Awaited<ReturnType<typeof createClient>>,
    productId: string,
    options: ProductOptionInput[],
    variants: ProductVariantInput[],
    productStatus?: string | null
) {
    if (options.length > 0 && variants.length === 0) {
        throw new Error('At least one variant is required when product options are defined.')
    }

    const { data: existingOptions, error: existingOptionsError } = await supabase
        .from('product_options')
        .select(`
            id,
            name,
            product_option_values (
                id,
                value
            )
        `)
        .eq('product_id', productId)

    if (existingOptionsError) {
        throw existingOptionsError
    }

    const { data: existingVariants, error: existingVariantsError } = await supabase
        .from('product_variants')
        .select('id, option_signature, title')
        .eq('product_id', productId)

    if (existingVariantsError) {
        throw existingVariantsError
    }

    const optionRows = (existingOptions || []) as ExistingOptionRow[]
    const variantRows = (existingVariants || []) as ExistingVariantRow[]
    const optionValueLookup = new Map<string, string>()
    const syncedOptionIds = new Set<string>()
    const syncedVariantIds = new Set<string>()
    const locationId = await getDefaultLocationId(supabase)

    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        const option = options[optionIndex]
        const matchingOption = optionRows.find((row) => row.id === option.id) || optionRows.find((row) => row.name === option.name)

        const optionPayload = {
            ...(matchingOption?.id ? { id: matchingOption.id } : {}),
            product_id: productId,
            name: option.name,
            position: optionIndex + 1,
        }

        const { data: savedOption, error: optionError } = await supabase
            .from('product_options')
            .upsert(optionPayload)
            .select('id, name')
            .single()

        if (optionError || !savedOption) {
            throw optionError || new Error(`Unable to save option ${option.name}.`)
        }

        syncedOptionIds.add(savedOption.id)

        const existingValues = matchingOption?.product_option_values || []
        const syncedValueIds = new Set<string>()

        for (let valueIndex = 0; valueIndex < option.values.length; valueIndex += 1) {
            const value = option.values[valueIndex]
            const matchingValue = existingValues.find((row) => row.value === value)
            const valuePayload = {
                ...(matchingValue?.id ? { id: matchingValue.id } : {}),
                option_id: savedOption.id,
                value,
                position: valueIndex + 1,
            }

            const { data: savedValue, error: valueError } = await supabase
                .from('product_option_values')
                .upsert(valuePayload)
                .select('id, value')
                .single()

            if (valueError || !savedValue) {
                throw valueError || new Error(`Unable to save option value ${value}.`)
            }

            syncedValueIds.add(savedValue.id)
            optionValueLookup.set(`${savedOption.name}::${savedValue.value}`, savedValue.id)
        }

        const removedValueIds = existingValues
            .map((row) => row.id)
            .filter((id) => !syncedValueIds.has(id))

        if (removedValueIds.length > 0) {
            const { error } = await supabase.from('product_option_values').delete().in('id', removedValueIds)
            if (error) {
                throw error
            }
        }
    }

    const removedOptionIds = optionRows
        .map((row) => row.id)
        .filter((id) => !syncedOptionIds.has(id))

    if (removedOptionIds.length > 0) {
        const { error } = await supabase.from('product_options').delete().in('id', removedOptionIds)
        if (error) {
            throw error
        }
    }

    const { error: resetDefaultError } = await supabase
        .from('product_variants')
        .update({ is_default: false })
        .eq('product_id', productId)
        .eq('is_default', true)

    if (resetDefaultError) {
        throw resetDefaultError
    }

    for (const [variantIndex, variant] of variants.entries()) {
        const variantIdentity = buildVariantIdentity(options, variant.options || {})
        const matchingVariant = variantRows.find((row) => row.id === variant.id)
            || variantRows.find((row) => row.option_signature && row.option_signature === variantIdentity.optionSignature)
            || variantRows.find((row) => row.title && row.title === variantIdentity.title)
        const variantPayload = {
            ...(matchingVariant?.id ? { id: matchingVariant.id } : {}),
            product_id: productId,
            title: variantIdentity.title,
            option_signature: variantIdentity.optionSignature,
            sellable_status: getVariantSellableStatus(productStatus),
            is_default: variantIndex === 0,
            variant_rank: variantIndex,
            sku: normalizeSku(variant.sku),
            barcode: variant.barcode || null,
            price: Math.max(0, toFloat(variant.price)),
            compare_at_price: toNullableFloat(variant.compare_at_price),
            cost_price: toNullableFloat(variant.cost_price),
            weight_value: toNullableFloat(variant.weight_value),
            weight_unit: variant.weight_unit || 'g',
            dimension_length: toNullableFloat(variant.dimension_length),
            dimension_width: toNullableFloat(variant.dimension_width),
            dimension_height: toNullableFloat(variant.dimension_height),
            dimension_unit: variant.dimension_unit || 'cm',
            is_active: getVariantIsActive(productStatus),
        }

        const { data: savedVariant, error: variantError } = await supabase
            .from('product_variants')
            .upsert(variantPayload)
            .select('id')
            .single()

        if (variantError || !savedVariant) {
            throw variantError || new Error(`Unable to save variant ${variant.id || variant.sku || ''}.`)
        }

        syncedVariantIds.add(savedVariant.id)

        const { error: deleteLinksError } = await supabase
            .from('variant_option_values')
            .delete()
            .eq('variant_id', savedVariant.id)

        if (deleteLinksError) {
            throw deleteLinksError
        }

        const optionLinks = Object.entries(variant.options || {})
            .map(([optionName, optionValue]) => optionValueLookup.get(`${optionName}::${optionValue}`))
            .filter((valueId): valueId is string => Boolean(valueId))
            .map((valueId) => ({
                variant_id: savedVariant.id,
                option_value_id: valueId,
            }))

        if (optionLinks.length > 0) {
            const { error } = await supabase.from('variant_option_values').insert(optionLinks)
            if (error) {
                throw error
            }
        }

        await syncVariantInventory(
            supabase,
            savedVariant.id,
            locationId,
            variant.quantity,
            variant.reorder_point,
            variant.bin_location
        )

        await syncVariantMedia(supabase, savedVariant.id, variant.images)
    }

    const removedVariantIds = variantRows
        .map((row) => row.id)
        .filter((id) => !syncedVariantIds.has(id))

    if (removedVariantIds.length > 0) {
        const { error } = await supabase.from('product_variants').delete().in('id', removedVariantIds)
        if (error) {
            throw error
        }
    }
}

type ProductOptionInput = {
    id?: string
    name: string
    values: string[]
}

type ProductVariantInput = {
    id?: string
    sku?: string | null
    barcode?: string | null
    price?: string | number | null
    compare_at_price?: string | number | null
    cost_price?: string | number | null
    quantity?: string | number | null
    reorder_point?: string | number | null
    bin_location?: string | null
    options?: Record<string, string>
    weight_value?: string | number | null
    weight_unit?: string | null
    dimension_length?: string | number | null
    dimension_width?: string | number | null
    dimension_height?: string | number | null
    dimension_unit?: string | null
    images?: string[]
}

type ExistingOptionRow = {
    id: string
    name: string
    product_option_values?: Array<{
        id: string
        value: string
    }> | null
}

type ExistingVariantRow = {
    id: string
    option_signature?: string | null
    title?: string | null
}

type SearchVariantsProductRow = {
    id: string
    title: string
    status?: string | null
    product_variants?: Array<{
        id: string
        title?: string | null
        sku?: string | null
        cost_price?: number | null
        price?: number | null
        is_active?: boolean | null
        inventory_items?: Array<{ available_quantity?: number | null }> | null
        variant_media?: Array<{ media_url?: string | null; position?: number | null }> | null
    }> | null
    product_media?: Array<{ media_url?: string | null; position?: number | null }> | null
}

type SearchVariantsSkuRow = {
    id: string
    title?: string | null
    sku?: string | null
    cost_price?: number | null
    price?: number | null
    is_active?: boolean | null
    inventory_items?: Array<{ available_quantity?: number | null }> | null
    variant_media?: Array<{ media_url?: string | null; position?: number | null }> | null
    products?: {
        id: string
        title?: string | null
        status?: string | null
        product_media?: Array<{ media_url?: string | null; position?: number | null }> | null
    } | null
}

type SearchVariantResult = {
    id: string
    title: string
    sku?: string | null
    price: number
    cost_price: number
    product_images: string[]
    is_active: boolean
    product_status: string | null
    available_quantity: number
}

export async function getCategories() {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { data, error } = await supabase.from('categories').select('id, name, parent_id').order('name')
    if (error) {
        console.error('Error fetching categories:', error)
        return []
    }
    return data
}

export async function getProducts(searchQuery: string = '', page: number = 1, limit: number = 10) {
    await requireActionPermission(['manage_products', 'access_pos'])
    const supabase = await createClient()
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('products')
        .select(`
            *,
            product_media ( media_url, position ),
            product_variants(price, sku, available_quantity:inventory_items(available_quantity))
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`)
    }

    const { data, error, count } = await query

    if (error) {
        console.error('Error fetching products:', error)
        return { data: [], count: 0, error: error.message }
    }

    return { data, count, error: null }
}

export async function deleteProduct(id: string) {
    const access = await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) return { success: false, error: error.message }

    await logAudit({
        actorId: access.user?.id,
        action: 'product.delete',
        entityType: 'product',
        entityId: id,
    })

    revalidatePath('/admin/products')
    return { success: true }
}

export async function createProduct(formData: FormData) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { options, variants } = parseProductPayload(formData)

    if (options.length > 0 && variants.length === 0) {
        return { error: 'At least one variant is required when product options are defined.' }
    }

    const parsed = BaseProductSchema.safeParse({
        title: formData.get('title'),
        slug: formData.get('slug'),
        price: formData.get('price'),
        compare_at_price: formData.get('compare_at_price'),
        cost_price: formData.get('cost_price'),
        quantity: formData.get('quantity'),
        reorder_point: formData.get('reorder_point'),
        category_id: formData.get('category_id') || null,
        sku: formData.get('sku'),
    })

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message || 'Invalid product data' }
    }

    const product = {
        title: formData.get('title') as string,
        slug: parsed.data.slug,
        description: formData.get('description') as string,

        category_id: formData.get('category_id') as string || null,
        tags: formData.get('tags') ? (formData.get('tags') as string).split(',').map(t => t.trim()) : [],
        vendor: formData.get('vendor') as string,
        status: formData.get('status') as string || 'draft',
        seo_title: formData.get('seo_title') as string,
        seo_description: formData.get('seo_description') as string,
        // ERP / Jewellery / Clothes Fields
        brand: formData.get('brand') as string,
        origin_country: formData.get('origin_country') as string,
        material: formData.get('material') as string,
        care_instructions: formData.get('care_instructions') as string,
        is_featured: formData.get('is_featured') === 'on',
        features: formData.get('features') ? (formData.get('features') as string).split('\n').filter(f => f.trim() !== '') : [],
        // Jewellery & Clothing Specifics
        gender: formData.get('gender') as string,
        collection: formData.get('collection') as string,
        is_customizable: formData.get('is_customizable') === 'on',
        customization_template: formData.get('customization_template') ? JSON.parse(formData.get('customization_template') as string) : {},
        warranty_period: formData.get('warranty_period') as string,
        // Shipping
        shipping_class: formData.get('shipping_class') as string || 'standard',
        return_policy: formData.get('return_policy') as string,
    }

    // 1. Create Product
    const { data: newProduct, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()

    if (error) {
        console.error('Error creating product:', error)
        return { error: error.message }
    }

    // Basic logic: If we have options, we create them and the variants.
    // If NOT, we create a default single variant (Simple Product).

    if (options.length > 0 && variants.length > 0) {
        try {
            await syncProductOptionsAndVariants(supabase, newProduct.id, options, variants, product.status)
        } catch (error: unknown) {
            console.error('Error creating product variants:', error)
            await supabase.from('products').delete().eq('id', newProduct.id)
            return { error: getErrorMessage(error, 'Unable to save product variants.') }
        }
    } else {
        // --- SIMPLE PRODUCT (DEFAULT VARIANT) ---
        const variant = {
            product_id: newProduct.id,
            title: 'Default Variant',
            option_signature: null,
            sellable_status: getVariantSellableStatus(product.status),
            is_default: true,
            variant_rank: 0,
            sku: normalizeSku(parsed.data.sku),
            barcode: (formData.get('barcode') as string) || null,
            price: parsed.data.price,
            compare_at_price: parsed.data.compare_at_price || null,
            cost_price: parsed.data.cost_price || null,
            is_active: getVariantIsActive(product.status)
        }

        const { data: newVariant, error: variantError } = await supabase
            .from('product_variants')
            .insert(variant)
            .select()
            .single()

        if (variantError) {
            console.error('Error creating variant:', variantError)
        } else {
            // Inventory
            const quantity = parsed.data.quantity
            const reorderPoint = parsed.data.reorder_point
            const binLocation = formData.get('bin_location') as string
            const { data: location } = await supabase.from('locations').select('id').limit(1).single()

            if (location) {
                const { error: inventoryError } = await supabase
                    .from('inventory_items')
                    .insert({
                        variant_id: newVariant.id,
                        location_id: location.id,
                        available_quantity: quantity,
                        reorder_point: reorderPoint,
                        bin_location: binLocation || null
                    })
                if (inventoryError) console.error('Error creating inventory:', inventoryError)
            }
        }
    }

    // 4. Handle Images (Product Level for now)
    const imagesJSON = formData.get('images') as string
    if (imagesJSON) {
        try {
            const images = JSON.parse(imagesJSON) as string[]
            if (images.length > 0) {
                const mediaInserts = images.map((url, index) => ({
                    product_id: newProduct.id,
                    media_url: url,
                    position: index + 1,
                    media_type: 'image'
                }))

                const { error: mediaError } = await supabase
                    .from('product_media')
                    .insert(mediaInserts)

                if (mediaError) {
                    console.error('Error adding media:', mediaError)
                }
            }
        } catch (e) {
            console.error('Error parsing images JSON:', e)
        }
    }

    revalidatePath('/admin/products')
    redirect('/admin/products')
}

export async function searchVariants(query: string) {
    await requireActionPermission(['manage_products', 'manage_orders', 'manage_suppliers', 'access_pos'])
    const supabase = await createClient()

    const searchTerm = query.trim()
    if (!searchTerm) {
        return []
    }

    const [productResult, skuResult] = await Promise.all([
        supabase
            .from('products')
            .select(`
                id,
                title,
                status,
                product_variants (
                    id, title, sku, cost_price, price, is_active, inventory_items(available_quantity), variant_media(media_url, position)
                ),
                product_media (media_url, position)
            `)
            .ilike('title', `%${searchTerm}%`)
            .limit(10),
        supabase
            .from('product_variants')
            .select(`
                id,
                title,
                sku,
                cost_price,
                price,
                is_active,
                inventory_items(available_quantity),
                variant_media(media_url, position),
                products (
                    id,
                    title,
                    status,
                    product_media (media_url, position)
                )
            `)
            .ilike('sku', `%${searchTerm}%`)
            .limit(10),
    ])

    if (productResult.error) {
        console.error('Error searching variants by product:', productResult.error)
        return []
    }

    if (skuResult.error) {
        console.error('Error searching variants by sku:', skuResult.error)
    }

    const results: SearchVariantResult[] = []
    const seen = new Set<string>()

    ;(productResult.data as SearchVariantsProductRow[] | null)?.forEach((p) => {
        p.product_variants?.forEach((v) => {
            if (seen.has(v.id)) {
                return
            }

            seen.add(v.id)
            const variantLabel = v.title && v.title !== 'Default Variant' ? ` - ${v.title}` : ''
            results.push({
                id: v.id,
                title: `${p.title}${variantLabel}${v.sku ? ` (${v.sku})` : ''}`,
                sku: v.sku,
                price: v.price || 0,
                cost_price: v.cost_price || 0,
                product_images: v.variant_media
                    ?.slice()
                    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
                    .map((media) => media.media_url)
                    .filter((value): value is string => Boolean(value))
                    || p.product_media
                        ?.slice()
                        .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
                        .map((m) => m.media_url)
                        .filter((value): value is string => Boolean(value))
                    || [],
                is_active: v.is_active !== false,
                product_status: p.status || null,
                available_quantity: (v.inventory_items || []).reduce((sum, item) => sum + Number(item.available_quantity || 0), 0),
            })
        })
    })

    ;(skuResult.data as SearchVariantsSkuRow[] | null)?.forEach((variant) => {
        if (seen.has(variant.id)) {
            return
        }

        seen.add(variant.id)
        const variantLabel = variant.title && variant.title !== 'Default Variant' ? ` - ${variant.title}` : ''
        results.push({
            id: variant.id,
            title: `${variant.products?.title || 'Variant'}${variantLabel}${variant.sku ? ` (${variant.sku})` : ''}`,
            sku: variant.sku,
            price: variant.price || 0,
            cost_price: variant.cost_price || 0,
            product_images: variant.variant_media
                ?.slice()
                .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
                .map((media) => media.media_url)
                .filter((value): value is string => Boolean(value))
                || variant.products?.product_media
                    ?.slice()
                    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
                    .map((media) => media.media_url)
                    .filter((value): value is string => Boolean(value))
                || [],
            is_active: variant.is_active !== false,
            product_status: variant.products?.status || null,
            available_quantity: (variant.inventory_items || []).reduce((sum, item) => sum + Number(item.available_quantity || 0), 0),
        })
    })

    return results
}

export async function getProductById(id: string) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { data: product, error } = await supabase
        .from('products')
        .select(`
            *,
            product_media (*),
            product_options (
                *,
                product_option_values (*)
            ),
            product_variants (
                *,
                inventory_items (*),
                variant_media (*),
                variant_option_values (
                    option_value_id,
                    product_option_values (
                        id,
                        value,
                        position,
                        option_id,
                        product_options (
                            name,
                            position
                        )
                    )
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching product:', error)
        return null
    }

    if (product.product_options) {
        product.product_options.sort((a: { position?: number | null }, b: { position?: number | null }) => (a.position || 0) - (b.position || 0))
    }
    if (product.product_media) {
        product.product_media.sort((a: { position?: number | null }, b: { position?: number | null }) => (a.position || 0) - (b.position || 0))
    }
    if (product.product_variants) {
        product.product_variants.sort(
            (
                a: { is_default?: boolean | null; variant_rank?: number | null; created_at?: string | null },
                b: { is_default?: boolean | null; variant_rank?: number | null; created_at?: string | null }
            ) => {
                const defaultDelta = Number(b.is_default ?? false) - Number(a.is_default ?? false)
                if (defaultDelta !== 0) {
                    return defaultDelta
                }

                const rankDelta = (a.variant_rank || 0) - (b.variant_rank || 0)
                if (rankDelta !== 0) {
                    return rankDelta
                }

                return (a.created_at || '').localeCompare(b.created_at || '')
            }
        )

        product.product_variants.forEach((variant: {
            variant_media?: Array<{ position?: number | null }>
            variant_option_values?: Array<{
                product_option_values?: {
                    position?: number | null
                    product_options?: { position?: number | null } | null
                } | null
            }>
        }) => {
            if (variant.variant_media) {
                variant.variant_media.sort((a, b) => (a.position || 0) - (b.position || 0))
            }

            if (variant.variant_option_values) {
                variant.variant_option_values.sort((left, right) => {
                    const leftOptionPosition = left.product_option_values?.product_options?.position || 0
                    const rightOptionPosition = right.product_option_values?.product_options?.position || 0

                    if (leftOptionPosition !== rightOptionPosition) {
                        return leftOptionPosition - rightOptionPosition
                    }

                    return (left.product_option_values?.position || 0) - (right.product_option_values?.position || 0)
                })
            }
        })
    }

    return product
}

export async function updateProduct(id: string, formData: FormData) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()
    const { options, variants } = parseProductPayload(formData)

    if (options.length > 0 && variants.length === 0) {
        return { error: 'At least one variant is required when product options are defined.' }
    }

    const parsed = BaseProductSchema.safeParse({
        title: formData.get('title'),
        slug: formData.get('slug'),
        price: formData.get('price'),
        compare_at_price: formData.get('compare_at_price'),
        cost_price: formData.get('cost_price'),
        quantity: formData.get('quantity'),
        reorder_point: formData.get('reorder_point'),
        category_id: formData.get('category_id') || null,
        sku: formData.get('sku'),
    })

    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message || 'Invalid product data' }
    }

    const product = {
        title: formData.get('title') as string,
        slug: parsed.data.slug,
        description: formData.get('description') as string,
        category_id: formData.get('category_id') as string || null,
        tags: formData.get('tags') ? (formData.get('tags') as string).split(',').map(t => t.trim()) : [],
        vendor: formData.get('vendor') as string,
        status: formData.get('status') as string || 'draft',
        seo_title: formData.get('seo_title') as string,
        seo_description: formData.get('seo_description') as string,
        brand: formData.get('brand') as string,
        origin_country: formData.get('origin_country') as string,
        material: formData.get('material') as string,
        care_instructions: formData.get('care_instructions') as string,
        is_featured: formData.get('is_featured') === 'on',
        features: formData.get('features') ? (formData.get('features') as string).split('\n').filter(f => f.trim() !== '') : [],
        gender: formData.get('gender') as string,
        collection: formData.get('collection') as string,
        is_customizable: formData.get('is_customizable') === 'on',
        customization_template: formData.get('customization_template') ? JSON.parse(formData.get('customization_template') as string) : {},
        warranty_period: formData.get('warranty_period') as string,
        shipping_class: formData.get('shipping_class') as string || 'standard',
        return_policy: formData.get('return_policy') as string,
        updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('products').update(product).eq('id', id)
    if (error) return { error: error.message }

    if (options.length > 0) {
        try {
            await syncProductOptionsAndVariants(supabase, id, options, variants, product.status)
        } catch (error: unknown) {
            console.error('Error updating product variants:', error)
            return { error: getErrorMessage(error, 'Unable to update product variants.') }
        }
    } else {
        // Simple product
        await supabase.from('product_options').delete().eq('product_id', id)
        // Keep the first variant, delete the rest
        const { data: existingVariants } = await supabase
            .from('product_variants')
            .select('id')
            .eq('product_id', id)
            .order('is_default', { ascending: false })
            .order('variant_rank', { ascending: true })
            .order('created_at', { ascending: true })
        const mainVariantId = existingVariants && existingVariants.length > 0 ? existingVariants[0].id : crypto.randomUUID()

        if (existingVariants && existingVariants.length > 1) {
            const idsToDelete = existingVariants.slice(1).map(ev => ev.id)
            await supabase.from('product_variants').delete().in('id', idsToDelete)
        }

        await supabase
            .from('product_variants')
            .update({ is_default: false })
            .eq('product_id', id)
            .eq('is_default', true)

        const variant = {
            id: mainVariantId,
            product_id: id,
            title: 'Default Variant',
            option_signature: null,
            sellable_status: getVariantSellableStatus(product.status),
            is_default: true,
            variant_rank: 0,
            sku: normalizeSku(formData.get('sku') as string),
            barcode: (formData.get('barcode') as string) || null,
            price: parseFloat(formData.get('price') as string) || 0,
            compare_at_price: formData.get('compare_at_price') ? parseFloat(formData.get('compare_at_price') as string) : null,
            cost_price: formData.get('cost_price') ? parseFloat(formData.get('cost_price') as string) : null,
            is_active: getVariantIsActive(product.status)
        }

        const { data: upsertedVariant, error: variantError } = await supabase.from('product_variants').upsert(variant).select().single()

        if (!variantError && upsertedVariant) {
            const quantity = parsed.data.quantity
            const reorderPoint = parsed.data.reorder_point
            const binLocation = formData.get('bin_location') as string
            const { data: location } = await supabase.from('locations').select('id').limit(1).single()

            if (location) {
                const { data: existingInv } = await supabase.from('inventory_items').select('id').eq('variant_id', upsertedVariant.id).eq('location_id', location.id).single()
                if (existingInv) {
                    await supabase.from('inventory_items').update({
                        available_quantity: quantity, reorder_point: reorderPoint, bin_location: binLocation || null
                    }).eq('id', existingInv.id)
                } else {
                    await supabase.from('inventory_items').insert({
                        variant_id: upsertedVariant.id, location_id: location.id, available_quantity: quantity, reorder_point: reorderPoint, bin_location: binLocation || null
                    })
                }
            }
        }
    }

    // Handle Images
    const imagesJSON = formData.get('images') as string
    if (imagesJSON) {
        try {
            const images = JSON.parse(imagesJSON) as string[]
            await supabase.from('product_media').delete().eq('product_id', id)
            if (images.length > 0) {
                const mediaInserts = images.map((url, index) => ({
                    product_id: id,
                    media_url: url,
                    position: index + 1,
                    media_type: 'image'
                }))
                await supabase.from('product_media').insert(mediaInserts)
            }
        } catch (e) {
            console.error('Error parsing images JSON:', e)
        }
    }

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}`)
    redirect('/admin/products')
}
