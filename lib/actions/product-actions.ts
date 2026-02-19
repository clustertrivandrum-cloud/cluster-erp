'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getCategories() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('categories').select('id, name, parent_id').order('name')
    if (error) {
        console.error('Error fetching categories:', error)
        return []
    }
    return data
}

export async function getProducts(searchQuery: string = '', page: number = 1, limit: number = 10) {
    const supabase = await createClient()
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
        .from('products')
        .select('*, product_variants(price, sku, available_quantity:inventory_items(available_quantity))', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`)
    }

    const { data, error, count } = await query

    if (error) {
        console.error('Error fetching products:', error)
        throw new Error('Failed to fetch products')
    }

    return { data, count }
}

export async function createProduct(formData: FormData) {
    const supabase = await createClient()

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
        specifications: formData.get('specifications') ? JSON.parse(formData.get('specifications') as string) : {},
        // Jewellery & Clothing Specifics
        gender: formData.get('gender') as string,
        collection: formData.get('collection') as string,
        season: formData.get('season') as string,
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

    let options: any[] = []
    let variants: any[] = []

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
                sku: v.sku || undefined, // Let DB gen if empty/undefined logic
                barcode: v.barcode || null,
                price: parseFloat(v.price) || 0,
                compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
                cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
                // Logistics
                weight_value: v.weight_value ? parseFloat(v.weight_value) : null,
                weight_unit: v.weight_unit || 'g',
                dimension_length: v.dimension_length ? parseFloat(v.dimension_length) : null,
                dimension_width: v.dimension_width ? parseFloat(v.dimension_width) : null,
                dimension_height: v.dimension_height ? parseFloat(v.dimension_height) : null,
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
            for (const [optName, optVal] of Object.entries(v.options)) {
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

            // D. Inventory
            if (location) {
                await supabase.from('inventory_items').insert({
                    variant_id: newVariant.id,
                    location_id: location.id,
                    available_quantity: parseInt(v.quantity) || 0,
                    reorder_point: parseInt(v.reorder_point) || 10,
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
            sku: (formData.get('sku') as string) || undefined,
            barcode: (formData.get('barcode') as string) || null,
            price: parseFloat(formData.get('price') as string) || 0,
            compare_at_price: formData.get('compare_at_price') ? parseFloat(formData.get('compare_at_price') as string) : null,
            cost_price: formData.get('cost_price') ? parseFloat(formData.get('cost_price') as string) : null,
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
            const quantity = parseInt(formData.get('quantity') as string) || 0
            const reorderPoint = parseInt(formData.get('reorder_point') as string) || 10
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
    const supabase = await createClient()

    // 1. Search products by title
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            title,
            product_variants (
                id, sku, cost_price, price
            ),
            product_media (media_url)
        `)
        .ilike('title', `%${query}%`)
        .limit(10)

    if (error) {
        console.error('Error searching variants:', error)
        return []
    }

    const results: any[] = []

    products?.forEach((p: any) => {
        p.product_variants?.forEach((v: any) => {
            // Basic formatting to distinguish variants? 
            // Ideally we need option names (Color: Red) but simplified for now:
            results.push({
                id: v.id,
                title: `${p.title} ${v.sku ? `(${v.sku})` : ''}`,
                sku: v.sku,
                cost_price: v.cost_price || 0,
                product_images: p.product_media?.map((m: any) => m.media_url) || []
            })
        })
    })

    return results
}
