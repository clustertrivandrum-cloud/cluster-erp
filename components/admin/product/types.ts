export interface Option {
    id: string
    name: string
    values: string[]
}

export interface Variant {
    id: string
    title: string
    option_signature?: string | null
    options: Record<string, string>
    price: number
    sku: string
    quantity: number
    images: string[]
    compare_at_price?: number | null
    cost_price?: number | null
    barcode?: string | null
    weight_value?: number | null
    weight_unit?: string | null
    dimension_length?: number | null
    dimension_width?: number | null
    dimension_height?: number | null
    dimension_unit?: string | null
    reorder_point?: number | null
    bin_location?: string | null
}
