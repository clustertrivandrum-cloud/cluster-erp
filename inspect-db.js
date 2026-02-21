import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_schema_info'); // or something similar if available
    console.log("Direct try to select missing column:");
    const { data: d2, error: e2 } = await supabase.from('orders').select('customer_id');
    console.log(e2);
}
checkSchema();
