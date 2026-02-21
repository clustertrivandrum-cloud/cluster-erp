export interface Option {
    id: string
    name: string
    values: string[]
}

export interface Variant {
    id: string
    title: string
    options: Record<string, string>
    price: number
    sku: string
    quantity: number
    images: string[]
    compare_at_price?: number
    cost_price?: number
    barcode?: string
    weight_value?: number
    weight_unit?: string
    dimension_length?: number
    dimension_width?: number
    dimension_height?: number
    dimension_unit?: string
    reorder_point?: number
    bin_location?: string
}
