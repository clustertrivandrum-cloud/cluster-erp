create or replace function public.get_financial_chart(p_period text default 'daily')
returns table (
    date_key text,
    label text,
    revenue numeric,
    expense numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    amount_expr text;
    status_expr text;
    bucket_expr text;
    start_expr text;
    sql text;
begin
    select
        case
            when exists (
                select 1
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'orders'
                  and column_name = 'total_amount'
            ) then 'coalesce(orders.total_amount, 0)'
            else 'coalesce(orders.grand_total, 0)'
        end,
        case
            when exists (
                select 1
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'orders'
                  and column_name = 'payment_status'
            ) then 'lower(coalesce(orders.payment_status, ''''))'
            else 'lower(coalesce(orders.financial_status, ''''))'
        end
    into amount_expr, status_expr;

    bucket_expr := case
        when p_period = 'daily' then 'day'
        when p_period = 'monthly' then 'month'
        else 'year'
    end;

    start_expr := case
        when p_period = 'daily' then 'now() - interval ''30 days'''
        when p_period = 'monthly' then 'now() - interval ''1 year'''
        else 'null'
    end;

    sql := format(
        $query$
            with config as (
                select %1$L::text as bucket, %2$s as start_at
            ),
            revenue_rows as (
                select
                    date_trunc(config.bucket, orders.created_at) as bucket_at,
                    sum(%3$s)::numeric as revenue
                from public.orders
                cross join config
                where %4$s = 'paid'
                  and (config.start_at is null or orders.created_at >= config.start_at)
                group by 1
            ),
            expense_rows as (
                select
                    date_trunc(config.bucket, expenses.expense_date::timestamp) as bucket_at,
                    sum(coalesce(expenses.amount, 0))::numeric as expense
                from public.expenses
                cross join config
                where config.start_at is null or expenses.expense_date::timestamp >= config.start_at
                group by 1
            ),
            buckets as (
                select
                    coalesce(revenue_rows.bucket_at, expense_rows.bucket_at) as bucket_at,
                    coalesce(revenue_rows.revenue, 0)::numeric as revenue,
                    coalesce(expense_rows.expense, 0)::numeric as expense
                from revenue_rows
                full outer join expense_rows on revenue_rows.bucket_at = expense_rows.bucket_at
            )
            select
                case
                    when %1$L = 'day' then to_char(bucket_at, 'YYYY-MM-DD')
                    when %1$L = 'month' then to_char(bucket_at, 'YYYY-MM')
                    else to_char(bucket_at, 'YYYY')
                end as date_key,
                case
                    when %1$L = 'day' then to_char(bucket_at, 'DD Mon')
                    when %1$L = 'month' then to_char(bucket_at, 'Mon YY')
                    else to_char(bucket_at, 'YYYY')
                end as label,
                revenue,
                expense
            from buckets
            order by bucket_at asc
        $query$,
        bucket_expr,
        start_expr,
        amount_expr,
        status_expr
    );

    return query execute sql;
end;
$$;

create or replace function public.get_admin_dashboard_summary()
returns table (
    products_count bigint,
    orders_count bigint,
    users_count bigint,
    revenue_ytd numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    amount_expr text;
    status_expr text;
    sql text;
begin
    select
        case
            when exists (
                select 1
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'orders'
                  and column_name = 'total_amount'
            ) then 'coalesce(total_amount, 0)'
            else 'coalesce(grand_total, 0)'
        end,
        case
            when exists (
                select 1
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'orders'
                  and column_name = 'payment_status'
            ) then 'lower(coalesce(payment_status, ''''))'
            else 'lower(coalesce(financial_status, ''''))'
        end
    into amount_expr, status_expr;

    sql := format(
        $query$
            select
                (select count(*)::bigint from public.products) as products_count,
                (select count(*)::bigint from public.orders) as orders_count,
                (select count(*)::bigint from public.users) as users_count,
                (
                    select coalesce(sum(%1$s), 0)::numeric
                    from public.orders
                    where %2$s = 'paid'
                      and created_at >= date_trunc('year', now())
                ) as revenue_ytd
        $query$,
        amount_expr,
        status_expr
    );

    return query execute sql;
end;
$$;

revoke all on function public.get_financial_chart(text) from public;
grant execute on function public.get_financial_chart(text) to authenticated;
grant execute on function public.get_financial_chart(text) to service_role;

revoke all on function public.get_admin_dashboard_summary() from public;
grant execute on function public.get_admin_dashboard_summary() to authenticated;
grant execute on function public.get_admin_dashboard_summary() to service_role;
