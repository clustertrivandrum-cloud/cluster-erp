export type PosInventoryItem = {
    available_quantity?: number | string | null
}

export type PosVariantMedia = {
    media_url?: string | null
    position?: number | null
}

export type PosProductVariant = {
    id: string
    title?: string | null
    sku?: string | null
    price?: number | string | null
    compare_at_price?: number | string | null
    is_active?: boolean | null
    is_default?: boolean | null
    variant_rank?: number | null
    sellable_status?: string | null
    inventory_items?: PosInventoryItem[] | null
    variant_media?: PosVariantMedia[] | null
}

export type PosProduct = {
    id: string
    title: string
    status?: string | null
    category_id?: string | null
    category_name?: string | null
    product_media?: Array<{
        media_url: string
        position?: number | null
    }> | null
    product_variants: PosProductVariant[]
}

export type PosCategory = {
    id: string
    name: string
}

export type PosCustomer = {
    id: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
}

export type PosCartItem = {
    product_id: string
    variant_id: string
    title: string
    variant_title: string
    sku?: string | null
    price: number
    quantity: number
    image?: string | null
}

export type PosSettings = {
    store_currency?: string | null
    tax_rate?: number | string | null
}
