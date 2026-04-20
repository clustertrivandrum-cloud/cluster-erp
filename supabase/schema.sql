-- =========================================
-- 1️⃣ ROLE & PERMISSION ENGINE
-- =========================================

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  description text
);

create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role_id uuid references roles(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ORPHAN CHECK: Ensure user role exists
-- This function can be used in triggers to validate role assignment
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, role_id)
  values (new.id, new.raw_user_meta_data->>'full_name', (select id from roles where name = 'user'));
  return new;
end;
$$ language plpgsql security definer;

-- =========================================
-- 2️⃣ PRODUCT ENGINE
-- =========================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  parent_id uuid references categories(id),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  product_type text,
  category_id uuid references categories(id),
  tags text[], 
  vendor text,
  status text check (status in ('draft','active','archived')) default 'draft',
  seo_title text,
  seo_description text,
  -- Extended attributes (aligned with ecommerce schema)
  brand text,
  hs_code text,
  origin_country text,
  material text,
  care_instructions text,
  features text[],
  is_featured boolean default false,
  rating numeric default 0,
  review_count integer default 0,
  gender text check (gender in ('Men','Women','Kids','Unisex')),
  collection text,
  is_customizable boolean default false,
  customization_template jsonb default '{}'::jsonb,
  warranty_period text,
  shipping_class text default 'standard',
  return_policy text,
  is_free_delivery boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  media_url text not null,
  media_type text check (media_type in ('image','video')) default 'image',
  position integer default 1,
  created_at timestamptz default now()
);

create table product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  position integer default 1
);

create table product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid references product_options(id) on delete cascade,
  value text not null,
  position integer default 1
);

create sequence sku_sequence start 1;

create or replace function generate_sku()
returns text as $$
declare
  next_id integer;
begin
  next_id := nextval('sku_sequence');
  return 'CF' || lpad(next_id::text, 6, '0');
end;
$$ language plpgsql;

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  title text default 'Default Variant',
  option_signature text,
  sellable_status text check (sellable_status in ('draft', 'sellable', 'hidden', 'archived')) default 'draft',
  is_default boolean default false,
  variant_rank integer default 0,
  sku text unique not null default generate_sku(),
  barcode text unique,
  price numeric(12,2) not null,
  compare_at_price numeric(12,2),
  cost_price numeric(12,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  -- Additional logistics fields
  weight_value numeric,
  weight_unit text default 'kg',
  dimension_length numeric,
  dimension_width numeric,
  dimension_height numeric,
  dimension_unit text default 'cm',
  allow_preorder boolean default false
);

create table variant_option_values (
  variant_id uuid references product_variants(id) on delete cascade,
  option_value_id uuid references product_option_values(id) on delete cascade,
  primary key (variant_id, option_value_id)
);

create table variant_media (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references product_variants(id) on delete cascade,
  media_url text not null,
  position integer default 1,
  created_at timestamptz default now()
);

-- =========================================
-- 3️⃣ INVENTORY ENGINE
-- =========================================

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references product_variants(id) on delete cascade,
  location_id uuid references locations(id),
  available_quantity integer default 0,
  reserved_quantity integer default 0,
  updated_at timestamptz default now(),
  reorder_point integer default 10,
  bin_location text,
  batch_number text,
  expiry_date date,
  unique (variant_id, location_id)
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references product_variants(id),
  location_id uuid references locations(id),
  quantity integer not null,
  movement_type text check (
    movement_type in ('sale','purchase','return','adjustment','transfer','reservation','release')
  ),
  reference_id uuid,
  created_at timestamptz default now()
);

create or replace function reserve_stock(p_variant_id uuid, p_qty integer, p_reference uuid default null)
returns boolean as $$
declare
  inventory_row record;
begin
  if p_qty is null or p_qty <= 0 then
    return true;
  end if;

  select id, location_id, available_quantity, reserved_quantity
  into inventory_row
  from public.inventory_items
  where variant_id = p_variant_id
  order by updated_at asc, id asc
  limit 1
  for update;

  if inventory_row.id is null then
    raise exception 'Inventory not found for variant %', p_variant_id;
  end if;

  if coalesce(inventory_row.available_quantity, 0) - coalesce(inventory_row.reserved_quantity, 0) < p_qty then
    return false;
  end if;

  update public.inventory_items
  set reserved_quantity = coalesce(reserved_quantity, 0) + p_qty,
      updated_at = now()
  where id = inventory_row.id;

  insert into public.inventory_movements (variant_id, location_id, quantity, movement_type, reference_id)
  values (p_variant_id, inventory_row.location_id, -p_qty, 'reservation', p_reference);

  return true;
end;
$$ language plpgsql;

create or replace function release_stock(p_variant_id uuid, p_qty integer, p_reference uuid default null)
returns boolean as $$
declare
  inventory_row record;
  release_qty integer;
begin
  if p_qty is null or p_qty <= 0 then
    return true;
  end if;

  select id, location_id, reserved_quantity
  into inventory_row
  from public.inventory_items
  where variant_id = p_variant_id
  order by updated_at asc, id asc
  limit 1
  for update;

  if inventory_row.id is null then
    raise exception 'Inventory not found for variant %', p_variant_id;
  end if;

  release_qty := least(coalesce(inventory_row.reserved_quantity, 0), p_qty);

  update public.inventory_items
  set reserved_quantity = greatest(coalesce(reserved_quantity, 0) - release_qty, 0),
      updated_at = now()
  where id = inventory_row.id;

  insert into public.inventory_movements (variant_id, location_id, quantity, movement_type, reference_id)
  values (p_variant_id, inventory_row.location_id, release_qty, 'release', p_reference);

  return true;
end;
$$ language plpgsql;

create or replace function complete_order_payment(p_order_id uuid)
returns text as $$
declare
  order_row record;
  item_row record;
  inventory_row record;
begin
  select id, payment_status, financial_status
  into order_row
  from public.orders
  where id = p_order_id
  for update;

  if order_row.id is null then
    raise exception 'Order not found.';
  end if;

  if lower(coalesce(order_row.payment_status, order_row.financial_status, '')) = 'paid' then
    return 'already_paid';
  end if;

  for item_row in
    select variant_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id
      and variant_id is not null
    group by variant_id
  loop
    select id, location_id, available_quantity, reserved_quantity
    into inventory_row
    from public.inventory_items
    where variant_id = item_row.variant_id
    order by updated_at asc, id asc
    limit 1
    for update;

    if inventory_row.id is null then
      raise exception 'Inventory not found for variant %', item_row.variant_id;
    end if;

    insert into public.inventory_movements (variant_id, location_id, quantity, movement_type, reference_id)
    values (item_row.variant_id, inventory_row.location_id, -item_row.quantity, 'sale', p_order_id);

    update public.inventory_items
    set available_quantity = greatest(coalesce(available_quantity, 0) - item_row.quantity, 0),
        reserved_quantity = greatest(coalesce(reserved_quantity, 0) - item_row.quantity, 0),
        updated_at = now()
    where id = inventory_row.id;
  end loop;

  update public.orders
  set payment_status = 'paid',
      financial_status = 'paid',
      status = 'processing',
      fulfillment_status = 'processing',
      updated_at = now()
  where id = p_order_id;

  update public.preorders
  set status = 'fulfilled'
  where order_id = p_order_id
    and coalesce(status, '') <> 'cancelled';

  return 'paid';
end;
$$ language plpgsql;

-- =========================================
-- 4️⃣ ORDER ENGINE (POS + ONLINE)
-- =========================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigserial,
  sales_channel text default 'online',
  user_id uuid,
  guest_email text,
  financial_status text,
  fulfillment_status text,
  subtotal numeric(12,2),
  discount_total numeric(12,2),
  tax_total numeric(12,2),
  shipping_total numeric(12,2),
  grand_total numeric(12,2),
  payment_request_token text unique,
  payment_request_created_at timestamptz,
  currency text default 'INR',
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  variant_id uuid references product_variants(id),
  title text,
  sku text,
  product_slug text,
  image_url text,
  variant_title text,
  variant_options jsonb default '[]'::jsonb,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null
);

create table preorders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  variant_id uuid references product_variants(id),
  order_id uuid references orders(id),
  product_title text,
  product_slug text,
  image_url text,
  variant_title text,
  variant_options jsonb default '[]'::jsonb,
  unit_price numeric(12,2),
  quantity integer,
  status text default 'pending',
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  provider text,
  provider_reference text,
  amount numeric(12,2),
  status text,
  created_at timestamptz default now()
);

create unique index payments_provider_provider_reference_uidx
  on payments(provider, provider_reference)
  where provider_reference is not null;

create table payment_request_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  provider text not null,
  recipient text not null default '',
  payment_url text not null,
  status text not null check (status in ('processing', 'sent', 'failed')),
  provider_reference text,
  error_message text,
  created_at timestamptz not null default now()
);

-- =========================================
-- 5️⃣ FINANCE ENGINE
-- =========================================

create table expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12,2) not null,
  category text,
  description text,
  expense_date date not null,
  created_at timestamptz default now()
);

-- =========================================
-- 6️⃣ PERFORMANCE INDEXES
-- =========================================

create index idx_products_slug on products(slug);
create index idx_variants_product on product_variants(product_id);
create unique index idx_variants_product_option_signature on product_variants(product_id, option_signature) where option_signature is not null;
create unique index idx_variants_product_default on product_variants(product_id) where is_default;
create index idx_variants_sellable on product_variants(product_id, sellable_status, is_default, variant_rank);
create index idx_inventory_variant on inventory_items(variant_id);
create index idx_inventory_location on inventory_items(location_id);
create index idx_orders_user on orders(user_id);
create index idx_order_items_variant on order_items(variant_id);
create index idx_expenses_date on expenses(expense_date);

-- =========================================
-- 7️⃣ ENABLE ROW LEVEL SECURITY
-- =========================================

alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_options enable row level security;
alter table product_option_values enable row level security;
alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table users enable row level security;
