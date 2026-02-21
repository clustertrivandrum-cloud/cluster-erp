const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                product_variants (
                    id, 
                    title, 
                    sku, 
                    products (title, product_media(media_url))
                )
            )
        `)
        .eq('id', 'bb3b5410-c7d7-4999-8359-ae7b19146a11') // from screenshot
        .single();
        
  console.log("Error:", error);
  console.log("Data order_items:", data?.order_items?.length);
}
test();
