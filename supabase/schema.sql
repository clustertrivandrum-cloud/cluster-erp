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
  sku text unique not null default generate_sku(),
  barcode text unique,
  price numeric(12,2) not null,
  compare_at_price numeric(12,2),
  cost_price numeric(12,2),
  is_active boolean default true,
  created_at timestamptz default now()
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
  currency text default 'INR',
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  variant_id uuid references product_variants(id),
  title text,
  sku text,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null
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
