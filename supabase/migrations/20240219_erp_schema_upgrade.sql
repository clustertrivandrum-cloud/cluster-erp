-- Migration to add ERP features: Logistics, Suppliers, Inventory, Product Details
-- Run this in your Supabase SQL Editor

-- 1. Suppliers Table
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  tax_id text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Purchase Orders Table
create table if not exists purchase_orders (
    id uuid primary key default gen_random_uuid(),
    order_number bigserial,
    supplier_id uuid references suppliers(id),
    status text check (status in ('draft', 'ordered', 'received', 'cancelled')) default 'draft',
    total_amount numeric(12, 2) default 0,
    expected_date date,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 3. Purchase Order Items Table
create table if not exists purchase_order_items (
    id uuid primary key default gen_random_uuid(),
    purchase_order_id uuid references purchase_orders(id) on delete cascade,
    variant_id uuid references product_variants(id),
    quantity integer not null,
    unit_cost numeric(12, 2) not null,
    total_cost numeric(12, 2) not null,
    received_quantity integer default 0
);

-- 4. Enhance Product Variants for Logistics
alter table product_variants 
add column if not exists weight_value numeric,
add column if not exists weight_unit text default 'kg',
add column if not exists dimension_length numeric,
add column if not exists dimension_width numeric,
add column if not exists dimension_height numeric,
add column if not exists dimension_unit text default 'cm';

-- 5. Enhance Inventory Items for Control
alter table inventory_items
add column if not exists reorder_point integer default 10,
add column if not exists bin_location text,
add column if not exists batch_number text,
add column if not exists expiry_date date;

-- 6. Enhance Products for Details
alter table products
add column if not exists brand text,
add column if not exists hs_code text, -- Harmonized System Code for international shipping
add column if not exists origin_country text,
add column if not exists material text, -- Common for Jewellery (Gold) and Clothes (Silk)
add column if not exists care_instructions text,
add column if not exists features text[],
add column if not exists specifications jsonb default '{}', -- For specific details like "Purity", "Gemstone type"
add column if not exists is_featured boolean default false,
add column if not exists rating numeric(3, 2) default 0,
add column if not exists review_count integer default 0;

-- 7. Advanced: Manufacturing / BOM (Basic structure for future)
-- Not adding yet to keep scope manageable, but good for ERP context.

-- 8. Enable RLS
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

-- Policies (Simplified for admin access)
drop policy if exists "Authenticated users can manage suppliers" on suppliers;
create policy "Authenticated users can manage suppliers" on suppliers for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage purchase orders" on purchase_orders;
create policy "Authenticated users can manage purchase orders" on purchase_orders for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage purchase order items" on purchase_order_items;
create policy "Authenticated users can manage purchase order items" on purchase_order_items for all to authenticated using (true) with check (true);
