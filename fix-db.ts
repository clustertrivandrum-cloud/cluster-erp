import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data: prod } = await supabase.from('products').select('*').eq('slug', 'antique-lotus-layered-jhumka').single()
  const productId = prod.id;

  const { data: options } = await supabase.from('product_options').select('id, name').eq('product_id', productId)
  const colorOptionId = options?.find(o => o.name === 'Color')?.id;

  const { data: optionValues } = await supabase.from('product_option_values').select('id, value').eq('option_id', colorOptionId)

  const skuToColor: Record<string, string> = {
    'CF000018': 'Green',
    'CF000019': 'Maroon',
    'CF000020': 'Pink',
    'CF000021': 'Yellow',
    'CF000022': 'Black',
    'CF000023': 'Blue'
  };

  const { data: variants } = await supabase.from('product_variants').select('id, sku').eq('product_id', productId);

  for (const variant of variants || []) {
    const color = skuToColor[variant.sku];
    if (color) {
      const valueId = optionValues?.find(v => v.value === color)?.id;
      if (valueId) {
        // Update variant title and option signature
        const optionSignature = JSON.stringify([["color", color.toLowerCase()]]);
        await supabase.from('product_variants').update({
          title: color,
          option_signature: optionSignature
        }).eq('id', variant.id);

        // Insert variant option value link
        await supabase.from('variant_option_values').upsert({
          variant_id: variant.id,
          option_value_id: valueId
        });
        console.log(`Updated variant ${variant.sku} to ${color}`);
      }
    }
  }
}
run()
