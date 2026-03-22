-- Backfill missing/blank SKUs and rely on generate_sku() default going forward

-- Replace empty strings with NULL so default can populate on next write if needed
update product_variants
set sku = null
where sku = '';

-- Generate SKUs for any rows that are NULL
update product_variants
set sku = generate_sku()
where sku is null;

-- Ensure future inserts without SKU continue to auto-generate (already defined in schema)
