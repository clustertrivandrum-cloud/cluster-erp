-- 20240220_products_rls.sql
-- Missing RLS Policies for Product and Inventory tables

-- 1. Products
drop policy if exists "Enable read access for all users" on public.products;
create policy "Enable read access for all users" on public.products for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.products;
create policy "Enable all access for authenticated users" on public.products for all to authenticated using (true) with check (true);

-- 2. Product Variants
drop policy if exists "Enable read access for all users" on public.product_variants;
create policy "Enable read access for all users" on public.product_variants for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.product_variants;
create policy "Enable all access for authenticated users" on public.product_variants for all to authenticated using (true) with check (true);

-- 3. Product Options
drop policy if exists "Enable read access for all users" on public.product_options;
create policy "Enable read access for all users" on public.product_options for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.product_options;
create policy "Enable all access for authenticated users" on public.product_options for all to authenticated using (true) with check (true);

-- 4. Product Option Values
drop policy if exists "Enable read access for all users" on public.product_option_values;
create policy "Enable read access for all users" on public.product_option_values for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.product_option_values;
create policy "Enable all access for authenticated users" on public.product_option_values for all to authenticated using (true) with check (true);

-- 5. Product Media
drop policy if exists "Enable read access for all users" on public.product_media;
create policy "Enable read access for all users" on public.product_media for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.product_media;
create policy "Enable all access for authenticated users" on public.product_media for all to authenticated using (true) with check (true);

-- 6. Variant Media
drop policy if exists "Enable read access for all users" on public.variant_media;
create policy "Enable read access for all users" on public.variant_media for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.variant_media;
create policy "Enable all access for authenticated users" on public.variant_media for all to authenticated using (true) with check (true);

-- 7. Variant Option Values
drop policy if exists "Enable read access for all users" on public.variant_option_values;
create policy "Enable read access for all users" on public.variant_option_values for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.variant_option_values;
create policy "Enable all access for authenticated users" on public.variant_option_values for all to authenticated using (true) with check (true);

-- 8. Inventory Items
drop policy if exists "Enable read access for all users" on public.inventory_items;
create policy "Enable read access for all users" on public.inventory_items for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.inventory_items;
create policy "Enable all access for authenticated users" on public.inventory_items for all to authenticated using (true) with check (true);

-- 9. Locations
drop policy if exists "Enable read access for all users" on public.locations;
create policy "Enable read access for all users" on public.locations for select using (true);

drop policy if exists "Enable all access for authenticated users" on public.locations;
create policy "Enable all access for authenticated users" on public.locations for all to authenticated using (true) with check (true);
