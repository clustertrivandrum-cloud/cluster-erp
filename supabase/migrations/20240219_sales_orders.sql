-- 1. Customers Table (Already created in 20240219_jewellery_schema.sql)
-- If it didn't exist, we would create it here.
-- create table if not exists customers ...

-- 2. Orders Table
create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    order_number bigserial,
    customer_id uuid references customers(id),
    status text check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')) default 'pending',
    payment_status text check (payment_status in ('unpaid', 'paid', 'refunded', 'failed')) default 'unpaid',
    total_amount numeric(12, 2) default 0,
    shipping_address jsonb default '{}',
    billing_address jsonb default '{}',
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 3. Order Items Table
create table if not exists order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references orders(id) on delete cascade,
    variant_id uuid references product_variants(id),
    quantity integer not null,
    unit_price numeric(12, 2) not null,
    total_price numeric(12, 2) not null
);

-- 4. Enable RLS
-- alter table customers enable row level security; -- Already persisted
alter table orders enable row level security;
alter table order_items enable row level security;

-- Policies (Admin Access)
-- Drop if exists to be safe
drop policy if exists "Authenticated users can manage orders" on orders;
create policy "Authenticated users can manage orders" on orders for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage order items" on order_items;
create policy "Authenticated users can manage order items" on order_items for all to authenticated using (true) with check (true);
