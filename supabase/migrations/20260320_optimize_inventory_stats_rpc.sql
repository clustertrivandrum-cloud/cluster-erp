create or replace function public.get_inventory_stats()
returns table (
    total_items bigint,
    low_stock bigint,
    out_of_stock bigint
)
language sql
stable
security definer
set search_path = public
as $$
    with variant_totals as (
        select count(*)::bigint as total_items
        from public.product_variants
    ),
    inventory_totals as (
        select
            count(*) filter (where coalesce(available_quantity, 0) = 0)::bigint as out_of_stock,
            count(*) filter (
                where coalesce(available_quantity, 0) > 0
                  and coalesce(available_quantity, 0) <= coalesce(reorder_point, 10)
            )::bigint as low_stock
        from public.inventory_items
    )
    select
        variant_totals.total_items,
        inventory_totals.low_stock,
        inventory_totals.out_of_stock
    from variant_totals
    cross join inventory_totals;
$$;

revoke all on function public.get_inventory_stats() from public;
grant execute on function public.get_inventory_stats() to authenticated;
grant execute on function public.get_inventory_stats() to service_role;
