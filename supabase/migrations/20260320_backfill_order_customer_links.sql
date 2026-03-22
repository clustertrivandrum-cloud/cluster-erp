with unique_email_matches as (
    select
        o.id as order_id,
        (array_agg(c.id order by c.id))[1] as customer_id,
        count(*) as match_count
    from public.orders o
    join public.customers c
        on lower(trim(c.email)) = lower(trim(o.guest_email))
    where o.customer_id is null
      and coalesce(trim(o.guest_email), '') <> ''
    group by o.id
),
email_backfill as (
    update public.orders o
    set customer_id = m.customer_id
    from unique_email_matches m
    where o.id = m.order_id
      and m.match_count = 1
      and o.customer_id is null
    returning o.id
),
unique_phone_matches as (
    select
        o.id as order_id,
        (array_agg(c.id order by c.id))[1] as customer_id,
        count(*) as match_count
    from public.orders o
    join public.customers c
        on regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(o.guest_phone, ''), '\D', '', 'g')
    where o.customer_id is null
      and coalesce(trim(o.guest_phone), '') <> ''
    group by o.id
)
update public.orders o
set customer_id = m.customer_id
from unique_phone_matches m
where o.id = m.order_id
  and m.match_count = 1
  and o.customer_id is null;
