const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('orders').select(`
    *,
    customers:customer_id (*)
  `).limit(1);
  console.log("customers:customer_id ->", error?.message || "Success");

  const { data: d2, error: e2 } = await supabase.from('orders').select(`
    *,
    users:user_id (*)
  `).limit(1);
  console.log("users:user_id ->", e2?.message || "Success");
}
test();
