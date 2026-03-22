create table if not exists coupons (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    description text,
    discount_type text check (discount_type in ('percentage', 'fixed')),
    discount_value numeric not null default 0,
    min_order_value numeric default 0,
    max_discount numeric,
    usage_limit integer,
    used_count integer default 0,
    is_active boolean default true,
    starts_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz default now()
);

alter table coupons
    add column if not exists description text,
    add column if not exists discount_type text,
    add column if not exists discount_value numeric default 0,
    add column if not exists min_order_value numeric default 0,
    add column if not exists max_discount numeric,
    add column if not exists usage_limit integer,
    add column if not exists used_count integer default 0,
    add column if not exists is_active boolean default true,
    add column if not exists starts_at timestamptz,
    add column if not exists expires_at timestamptz,
    add column if not exists created_at timestamptz default now();

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'coupons'
          and column_name = 'discount_percent'
    ) then
        update coupons
        set
            discount_type = coalesce(
                discount_type,
                case
                    when discount_percent is not null and discount_percent > 0 then 'percentage'
                    else 'fixed'
                end
            ),
            discount_value = case
                when (discount_value is null or discount_value = 0)
                    then case
                        when discount_percent is not null and discount_percent > 0 then discount_percent
                        else coalesce(discount_amount, 0)
                    end
                else discount_value
            end,
            usage_limit = coalesce(usage_limit, max_uses),
            used_count = coalesce(used_count, uses),
            min_order_value = coalesce(min_order_value, 0),
            is_active = coalesce(is_active, true);
    else
        update coupons
        set
            discount_type = coalesce(discount_type, 'fixed'),
            discount_value = coalesce(discount_value, 0),
            min_order_value = coalesce(min_order_value, 0),
            used_count = coalesce(used_count, 0),
            is_active = coalesce(is_active, true);
    end if;
end $$;

alter table coupons
    alter column discount_type set default 'fixed',
    alter column min_order_value set default 0,
    alter column used_count set default 0,
    alter column is_active set default true;

create index if not exists coupons_code_idx on coupons (lower(code));

create table if not exists coupon_usages (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid references coupons(id),
    order_id uuid references orders(id),
    user_id uuid,
    used_at timestamptz default now()
);
