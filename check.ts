import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, status,
      product_options ( id, name, position ),
      product_variants (
        id, title, option_signature, sellable_status,
        variant_option_values ( option_value_id, product_option_values ( value, product_options (name) ) )
      )
    `)
    .eq('slug', 'antique-lotus-layered-jhumka')
    .single();
  console.log(JSON.stringify(data, null, 2))
}
run()
