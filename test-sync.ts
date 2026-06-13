import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
    const { data: prod } = await supabase.from('products').select('*').eq('slug', 'antique-lotus-layered-jhumka').single()
    const productId = prod.id;
    console.log('Product ID:', productId)

    const options = [
        { name: 'Color', values: ['Green', 'Maroon'] }
    ]
    const variants = [
        {
            title: 'Green',
            options: { Color: 'Green' },
            price: 289,
            sku: 'CF000018',
            allow_preorder: false
        },
        {
            title: 'Maroon',
            options: { Color: 'Maroon' },
            price: 289,
            sku: 'CF000019',
            allow_preorder: false
        }
    ]

    console.log('Variants before:', variants);

    // I will just copy the logic
    const optionValueLookup = new Map<string, string>()

    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        const option = options[optionIndex]
        const { data: savedOption } = await supabase
            .from('product_options')
            .upsert({ product_id: productId, name: option.name, position: optionIndex + 1 })
            .select('id, name')
            .single()

        for (let valueIndex = 0; valueIndex < option.values.length; valueIndex += 1) {
            const value = option.values[valueIndex]
            const { data: savedValue } = await supabase
                .from('product_option_values')
                .upsert({ option_id: savedOption.id, value, position: valueIndex + 1 })
                .select('id, value')
                .single()

            optionValueLookup.set(`${savedOption.name}::${savedValue.value}`, savedValue.id)
        }
    }

    console.log('Lookup:', optionValueLookup)

    for (const [variantIndex, variant] of variants.entries()) {
        const optionLinks = Object.entries(variant.options || {})
            .map(([optionName, optionValue]) => optionValueLookup.get(`${optionName}::${optionValue}`))
            .filter((valueId): valueId is string => Boolean(valueId))
            .map((valueId) => ({
                option_value_id: valueId,
            }))
        
        console.log(`Variant ${variant.title} links:`, optionLinks)
    }
}
run()
