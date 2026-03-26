const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bkkzrtedpkotqrvywllr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJra3pydGVkcGtvdHFydnl3bGxyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM1NDIxMCwiZXhwIjoyMDg2OTMwMjEwfQ.y4lK34BYRPDj0qBRad3EjXmo1p21Q52pyYvWdMuAWQ8'
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
