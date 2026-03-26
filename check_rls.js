require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log("Creating RLS policies for inventory_movements...")
    const { error } = await supabase.rpc('pgrst_ddl_statement', {
      query: `
        drop policy if exists "Enable read access for all users" on public.inventory_movements;
        create policy "Enable read access for all users" on public.inventory_movements for select using (true);
        
        drop policy if exists "Enable all access for authenticated users" on public.inventory_movements;
        create policy "Enable all access for authenticated users" on public.inventory_movements for all to authenticated using (true) with check (true);
      `
    })

    // wait, supabase JS doesn't have an arbitrary SQL executor unless using a trick.
    // I can just insert through a custom JS using postgres driver or another RPC.
}

run()
