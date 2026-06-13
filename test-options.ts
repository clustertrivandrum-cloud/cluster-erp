import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
  const { data } = await supabase.from('product_options').select('id, name, product_id').eq('product_id', '1f1edaa9-c099-4f8d-acff-cc26951f26b5');
  console.log('Options:', data);
  const { data: vals } = await supabase.from('product_option_values').select('id, option_id, value').in('option_id', data?.map(d => d.id) || []);
  console.log('Values:', vals);
}
run()
