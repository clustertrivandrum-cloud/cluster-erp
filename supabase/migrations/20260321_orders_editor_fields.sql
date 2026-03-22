alter table public.orders
add column if not exists tags text[] default '{}'::text[],
add column if not exists shipping_address jsonb default '{}'::jsonb,
add column if not exists billing_address jsonb default '{}'::jsonb,
add column if not exists courier text,
add column if not exists shipped_at timestamptz,
add column if not exists delivered_at timestamptz,
add column if not exists delivery_notes text;

alter table public.order_items
add column if not exists discount_amount numeric(12, 2) default 0;
