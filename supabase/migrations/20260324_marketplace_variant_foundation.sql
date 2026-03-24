alter table public.product_variants
add column if not exists title text,
add column if not exists option_signature text,
add column if not exists sellable_status text check (sellable_status in ('draft', 'sellable', 'hidden', 'archived')) default 'draft',
add column if not exists is_default boolean default false,
add column if not exists variant_rank integer default 0;

alter table public.order_items
add column if not exists product_slug text,
add column if not exists image_url text,
add column if not exists variant_title text,
add column if not exists variant_options jsonb default '[]'::jsonb;

alter table public.preorders
add column if not exists product_title text,
add column if not exists product_slug text,
add column if not exists image_url text,
add column if not exists variant_title text,
add column if not exists variant_options jsonb default '[]'::jsonb,
add column if not exists unit_price numeric(12, 2);

with variant_metadata as (
    select
        pv.id,
        pv.product_id,
        coalesce(
            nullif(
                string_agg(pov.value, ' / ' order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value),
                ''
            ),
            'Default Variant'
        ) as variant_title,
        nullif(
            jsonb_agg(
                jsonb_build_array(lower(trim(po.name)), lower(trim(pov.value)))
                order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value
            )::text,
            '[]'
        ) as variant_signature,
        coalesce(
            jsonb_agg(
                jsonb_build_object('name', po.name, 'value', pov.value)
                order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value
            ) filter (where po.name is not null and pov.value is not null),
            '[]'::jsonb
        ) as variant_options,
        row_number() over (
            partition by pv.product_id
            order by coalesce(pv.created_at, now()), pv.id
        ) - 1 as variant_rank,
        row_number() over (
            partition by pv.product_id
            order by coalesce(pv.created_at, now()), pv.id
        ) = 1 as is_default
    from public.product_variants pv
    left join public.variant_option_values vov on vov.variant_id = pv.id
    left join public.product_option_values pov on pov.id = vov.option_value_id
    left join public.product_options po on po.id = pov.option_id
    group by pv.id, pv.product_id
)
update public.product_variants pv
set
    title = coalesce(vm.variant_title, 'Default Variant'),
    option_signature = vm.variant_signature,
    variant_rank = vm.variant_rank,
    is_default = vm.is_default,
    sellable_status = case
        when coalesce(products.status, 'draft') = 'archived' or pv.is_active = false then 'archived'
        when coalesce(products.status, 'draft') = 'active' and pv.is_active = true then 'sellable'
        else 'draft'
    end
from variant_metadata vm
join public.products on products.id = vm.product_id
where pv.id = vm.id;

update public.product_variants
set title = 'Default Variant'
where title is null or btrim(title) = '';

create unique index if not exists idx_variants_product_option_signature
on public.product_variants(product_id, option_signature)
where option_signature is not null;

create unique index if not exists idx_variants_product_default
on public.product_variants(product_id)
where is_default;

create index if not exists idx_variants_sellable
on public.product_variants(product_id, sellable_status, is_default, variant_rank);

with item_snapshots as (
    select
        oi.id,
        coalesce(products.slug, oi.product_slug) as product_slug,
        coalesce(
            (
                select vm.media_url
                from public.variant_media vm
                where vm.variant_id = pv.id
                order by vm.position asc, vm.created_at asc, vm.id asc
                limit 1
            ),
            (
                select pm.media_url
                from public.product_media pm
                where pm.product_id = products.id
                order by pm.position asc, pm.created_at asc, pm.id asc
                limit 1
            ),
            oi.image_url
        ) as image_url,
        coalesce(pv.title, oi.variant_title, 'Default Variant') as variant_title,
        coalesce(
            (
                select jsonb_agg(jsonb_build_object('name', po.name, 'value', pov.value) order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value)
                from public.variant_option_values vov
                join public.product_option_values pov on pov.id = vov.option_value_id
                join public.product_options po on po.id = pov.option_id
                where vov.variant_id = pv.id
            ),
            oi.variant_options,
            '[]'::jsonb
        ) as variant_options
    from public.order_items oi
    left join public.product_variants pv on pv.id = oi.variant_id
    left join public.products on products.id = pv.product_id
)
update public.order_items oi
set
    product_slug = item_snapshots.product_slug,
    image_url = item_snapshots.image_url,
    variant_title = item_snapshots.variant_title,
    variant_options = item_snapshots.variant_options
from item_snapshots
where oi.id = item_snapshots.id;

with preorder_snapshots as (
    select
        p.id,
        coalesce(products.title, p.product_title) as product_title,
        coalesce(products.slug, p.product_slug) as product_slug,
        coalesce(
            (
                select vm.media_url
                from public.variant_media vm
                where vm.variant_id = pv.id
                order by vm.position asc, vm.created_at asc, vm.id asc
                limit 1
            ),
            (
                select pm.media_url
                from public.product_media pm
                where pm.product_id = products.id
                order by pm.position asc, pm.created_at asc, pm.id asc
                limit 1
            ),
            p.image_url
        ) as image_url,
        coalesce(pv.title, p.variant_title, 'Default Variant') as variant_title,
        coalesce(
            (
                select jsonb_agg(jsonb_build_object('name', po.name, 'value', pov.value) order by coalesce(po.position, 0), coalesce(pov.position, 0), pov.value)
                from public.variant_option_values vov
                join public.product_option_values pov on pov.id = vov.option_value_id
                join public.product_options po on po.id = pov.option_id
                where vov.variant_id = pv.id
            ),
            p.variant_options,
            '[]'::jsonb
        ) as variant_options,
        coalesce(pv.price, p.unit_price) as unit_price
    from public.preorders p
    left join public.product_variants pv on pv.id = p.variant_id
    left join public.products on products.id = pv.product_id
)
update public.preorders p
set
    product_title = preorder_snapshots.product_title,
    product_slug = preorder_snapshots.product_slug,
    image_url = preorder_snapshots.image_url,
    variant_title = preorder_snapshots.variant_title,
    variant_options = preorder_snapshots.variant_options,
    unit_price = preorder_snapshots.unit_price
from preorder_snapshots
where p.id = preorder_snapshots.id;

create or replace function public.reserve_stock(p_variant_id uuid, p_qty integer, p_reference uuid default null)
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

create or replace function public.release_stock(p_variant_id uuid, p_qty integer, p_reference uuid default null)
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
