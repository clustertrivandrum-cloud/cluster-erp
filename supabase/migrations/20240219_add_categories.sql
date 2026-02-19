
-- Migration to add categories and tags
-- Run this in your Supabase SQL Editor

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  image_url text,
  parent_id uuid references categories(id),
  created_at timestamptz default now()
);

alter table products 
add column if not exists category_id uuid references categories(id),
add column if not exists tags text[];

alter table categories enable row level security;

create policy "Enable read access for all users" on "public"."categories"
as permissive for select
to public
using (true);

create policy "Enable insert for authenticated users only" on "public"."categories"
as permissive for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users only" on "public"."categories"
as permissive for update
to authenticated
using (true);

create policy "Enable delete for authenticated users only" on "public"."categories"
as permissive for delete
to authenticated
using (true);

