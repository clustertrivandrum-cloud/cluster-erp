-- Migration for Jewellery & Clothing specific features
-- Run this in Supabase SQL Editor

-- 1. Enhance Products Table
alter table products 
add column if not exists gender text check (gender in ('Men', 'Women', 'Kids', 'Unisex')),
add column if not exists collection text,
add column if not exists season text,
add column if not exists is_customizable boolean default false,
add column if not exists customization_template jsonb default '{}', -- Structure for user inputs (e.g. {"Engraving": "text", "Size": "select"})
add column if not exists warranty_period text;

-- 2. Create Customers Table (Distinct from Admin Users)
create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    first_name text,
    last_name text,
    email text unique,
    phone text,
    addresses jsonb default '[]', -- Array of address objects
    preferences jsonb default '{}', -- Ring size, metal preference, etc.
    total_spent numeric(12, 2) default 0,
    orders_count integer default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 3. Enable RLS for Customers
alter table customers enable row level security;

-- 4. Policies
drop policy if exists "Authenticated users can manage customers" on customers;
create policy "Authenticated users can manage customers" on customers for all to authenticated using (true) with check (true);
