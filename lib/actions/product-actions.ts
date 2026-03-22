'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'

const BaseProductSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    slug: z.string().min(1, 'Slug is required'),
    price: z.coerce.number().nonnegative('Price must be ≥ 0'),
    compare_at_price: z.coerce.number().nonnegative().nullable().optional(),
    cost_price: z.coerce.number().nonnegative().nullable().optional(),
    quantity: z.coerce.number().int().nonnegative().default(0),
    reorder_point: z.coerce.number().int().nonnegative().default(10),
    category_id: z.string().uuid().nullable().optional(),
    sku: z.string().trim().min(0).optional(),
})

const normalizeSku = (value?: string | null) => {
    const trimmed = (value || '').trim()
    return trimmed.length > 0 ? trimmed : undefined
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

type SearchVariantsProductRow = {
    id: string
    title: string
    status?: string | null
    product_variants?: Array<{
        id: string
        sku?: string | null
        cost_price?: number | null
        price?: number | null
        is_active?: boolean | null
        inventory_items?: Array<{ available_quantity?: number | null }> | null
    }> | null
    product_media?: Array<{ media_url?: string | null }> | null
}

type SearchVariantsSkuRow = {
    id: string
    sku?: string | null
    cost_price?: number | null
    price?: number | null
    is_active?: boolean | null
    inventory_items?: Array<{ available_quantity?: number | null }> | null
    products?: {
        id: string
        title?: string | null
        status?: string | null
        product_media?: Array<{ media_url?: string | null }> | null
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
        slug: formData.get('slug') as string,
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

    // Parse Options and Variants
    const optionsJSON = formData.get('options') as string
    const variantsJSON = formData.get('variants') as string

    let options: ProductOptionInput[] = []
    let variants: ProductVariantInput[] = []

    try {
        if (optionsJSON) options = JSON.parse(optionsJSON)
        if (variantsJSON) variants = JSON.parse(variantsJSON)
    } catch (e) {
        console.error("Error parsing options/variants JSON", e)
    }

    // Basic logic: If we have options, we create them and the variants.
    // If NOT, we create a default single variant (Simple Product).

    if (options.length > 0 && variants.length > 0) {
        // --- COMPLEX PRODUCT WITH VARIANTS ---

        // A. Insert Options & Values
        // Map: OptionName -> { option_id, valueMap: { ValueName -> value_id } }
        const optionMap: Record<string, { id: string, values: Record<string, string> }> = {}

        for (const opt of options) {
            // Create Option
            const { data: newOption, error: optError } = await supabase
                .from('product_options')
                .insert({ product_id: newProduct.id, name: opt.name })
                .select()
                .single()

            if (optError || !newOption) {
                console.error("Error creating option:", optError)
                continue
            }

            optionMap[opt.name] = { id: newOption.id, values: {} }

            // Create Values for this Option
            for (const val of opt.values) {
                const { data: newVal, error: valError } = await supabase
                    .from('product_option_values')
                    .insert({ option_id: newOption.id, value: val })
                    .select()
                    .single()

                if (valError || !newVal) {
                    console.error("Error creating option value:", valError)
                    continue
                }

                optionMap[opt.name].values[val] = newVal.id
            }
        }

        // B. Insert Variants
        // Use a default location for inventory
        const { data: location } = await supabase.from('locations').select('id').limit(1).single()

        for (const v of variants) {
            const variantData = {
                product_id: newProduct.id,
                sku: normalizeSku(v.sku), // Let DB generate if blank
                barcode: v.barcode || null,
                price: toFloat(v.price),
                compare_at_price: toNullableFloat(v.compare_at_price),
                cost_price: toNullableFloat(v.cost_price),
                // Logistics
                weight_value: toNullableFloat(v.weight_value),
                weight_unit: v.weight_unit || 'g',
                dimension_length: toNullableFloat(v.dimension_length),
                dimension_width: toNullableFloat(v.dimension_width),
                dimension_height: toNullableFloat(v.dimension_height),
                dimension_unit: v.dimension_unit || 'cm',
                is_active: true
            }

            const { data: newVariant, error: varError } = await supabase
                .from('product_variants')
                .insert(variantData)
                .select()
                .single()

            if (varError || !newVariant) {
                console.error("Error creating variant:", varError)
                continue
            }

            // C. Link Variant to Option Values
            // v.options is like { "Color": "Red", "Size": "S" }
            const linkInserts = []
            for (const [optName, optVal] of Object.entries(v.options || {})) {
                // Find value_id
                const valueId = optionMap[optName]?.values[optVal as string]
                if (valueId) {
                    linkInserts.push({
                        variant_id: newVariant.id,
                        option_value_id: valueId
                    })
                }
            }

            if (linkInserts.length > 0) {
                await supabase.from('variant_option_values').insert(linkInserts)
            }

        // D. Inventory (default location only for now)
        if (location) {
            await supabase.from('inventory_items').insert({
                variant_id: newVariant.id,
                location_id: location.id,
                available_quantity: toInt(v.quantity, 0),
                reorder_point: toInt(v.reorder_point, 10),
                bin_location: v.bin_location || null
            })
        }

            // E. Variant Images
            if (v.images && v.images.length > 0) {
                const mediaInserts = v.images.map((url: string, index: number) => ({
                    variant_id: newVariant.id,
                    media_url: url,
                    position: index + 1
                }))

                const { error: mediaError } = await supabase
                    .from('variant_media')
                    .insert(mediaInserts)

                if (mediaError) {
                    console.error('Error adding variant media:', mediaError)
                }
            }
        }


    } else {
        // --- SIMPLE PRODUCT (DEFAULT VARIANT) ---
        const variant = {
            product_id: newProduct.id,
            sku: normalizeSku(parsed.data.sku),
            barcode: (formData.get('barcode') as string) || null,
            price: parsed.data.price,
            compare_at_price: parsed.data.compare_at_price || null,
            cost_price: parsed.data.cost_price || null,
            is_active: product.status === 'active'
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
                    id, sku, cost_price, price, is_active, inventory_items(available_quantity)
                ),
                product_media (media_url)
            `)
            .ilike('title', `%${searchTerm}%`)
            .limit(10),
        supabase
            .from('product_variants')
            .select(`
                id,
                sku,
                cost_price,
                price,
                is_active,
                inventory_items(available_quantity),
                products (
                    id,
                    title,
                    status,
                    product_media (media_url)
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
            results.push({
                id: v.id,
                title: `${p.title} ${v.sku ? `(${v.sku})` : ''}`,
                sku: v.sku,
                price: v.price || 0,
                cost_price: v.cost_price || 0,
                product_images: p.product_media?.map((m) => m.media_url).filter((value): value is string => Boolean(value)) || [],
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
        results.push({
            id: variant.id,
            title: `${variant.products?.title || 'Variant'} ${variant.sku ? `(${variant.sku})` : ''}`,
            sku: variant.sku,
            price: variant.price || 0,
            cost_price: variant.cost_price || 0,
            product_images: variant.products?.product_media?.map((media) => media.media_url).filter((value): value is string => Boolean(value)) || [],
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
            product_options (*),
            product_variants (
                *,
                inventory_items (*)
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

    return product
}

export async function updateProduct(id: string, formData: FormData) {
    await requireActionPermission('manage_products')
    const supabase = await createClient()

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
        slug: formData.get('slug') as string,
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

    const optionsJSON = formData.get('options') as string
    const variantsJSON = formData.get('variants') as string
    let options: ProductOptionInput[] = []
    let variants: ProductVariantInput[] = []

    try {
        if (optionsJSON) options = JSON.parse(optionsJSON)
        if (variantsJSON) variants = JSON.parse(variantsJSON)
    } catch (e) {
        console.error("Error parsing options/variants JSON", e)
    }

    if (options.length > 0) {
        const optionInserts = options.map((opt, index: number) => ({
            id: opt.id,
            product_id: id,
            name: opt.name,
            position: index + 1,
            values: opt.values
        }))

        // Delete removed options
        const optionIds = options.map(o => o.id).filter(Boolean)
        if (optionIds.length > 0) {
            await supabase.from('product_options').delete().eq('product_id', id).not('id', 'in', `(${optionIds.join(',')})`)
        } else {
            await supabase.from('product_options').delete().eq('product_id', id)
        }
        await supabase.from('product_options').upsert(optionInserts)

        // Delete removed variants
        const variantIds = variants.map(v => v.id).filter(Boolean)
        if (variantIds.length > 0) {
            await supabase.from('product_variants').delete().eq('product_id', id).not('id', 'in', `(${variantIds.join(',')})`)
        } else {
            await supabase.from('product_variants').delete().eq('product_id', id)
        }

        for (const v of variants) {
            const variantUpsert = {
                id: v.id,
                product_id: id,
                sku: normalizeSku(v.sku),
                barcode: v.barcode || null,
                price: Math.max(0, toFloat(v.price)),
                compare_at_price: v.compare_at_price ? Math.max(0, toFloat(v.compare_at_price)) : null,
                cost_price: v.cost_price ? Math.max(0, toFloat(v.cost_price)) : null,
                options: v.options,
                weight_value: toNullableFloat(v.weight_value),
                weight_unit: v.weight_unit || 'g',
            }

            const { data: upsertedVariant, error: variantError } = await supabase
                .from('product_variants')
                .upsert(variantUpsert)
                .select()
                .single()

            if (variantError || !upsertedVariant) continue

            if (v.quantity !== undefined && v.quantity !== null) {
                const { data: location } = await supabase.from('locations').select('id').limit(1).single()
                if (location) {
                    // Check if inventory exists
                    const { data: existingInv } = await supabase.from('inventory_items').select('id').eq('variant_id', upsertedVariant.id).eq('location_id', location.id).single()

                    if (existingInv) {
                        await supabase.from('inventory_items').update({
                            available_quantity: v.quantity,
                            reorder_point: v.reorder_point || 10,
                            bin_location: v.bin_location || null
                        }).eq('id', existingInv.id)
                    } else {
                        await supabase.from('inventory_items').insert({
                            variant_id: upsertedVariant.id,
                            location_id: location.id,
                            available_quantity: v.quantity,
                            reorder_point: v.reorder_point || 10,
                            bin_location: v.bin_location || null
                        })
                    }
                }
            }
        }
    } else {
        // Simple product
        await supabase.from('product_options').delete().eq('product_id', id)
        // Keep the first variant, delete the rest
        const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', id)
        const mainVariantId = existingVariants && existingVariants.length > 0 ? existingVariants[0].id : crypto.randomUUID()

        if (existingVariants && existingVariants.length > 1) {
            const idsToDelete = existingVariants.slice(1).map(ev => ev.id)
            await supabase.from('product_variants').delete().in('id', idsToDelete)
        }

        const variant = {
            id: mainVariantId,
            product_id: id,
            sku: normalizeSku(formData.get('sku') as string),
            barcode: (formData.get('barcode') as string) || null,
            price: parseFloat(formData.get('price') as string) || 0,
            compare_at_price: formData.get('compare_at_price') ? parseFloat(formData.get('compare_at_price') as string) : null,
            cost_price: formData.get('cost_price') ? parseFloat(formData.get('cost_price') as string) : null,
            is_active: product.status === 'active'
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
