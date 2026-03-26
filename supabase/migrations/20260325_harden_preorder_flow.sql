update public.preorders set quantity = 1 where quantity is null or quantity < 1;

update public.preorders set quantity = 10 where quantity > 10;

alter table public.preorders alter column quantity set default 1;

alter table public.preorders alter column quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'preorders_quantity_range_check'
  ) then
    alter table public.preorders
      add constraint preorders_quantity_range_check
      check (quantity between 1 and 10);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'preorders_customer_id_fkey'
  ) then
    alter table public.preorders
      add constraint preorders_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
end $$;

create index if not exists preorders_customer_id_idx on public.preorders(customer_id);

create index if not exists preorders_variant_status_idx on public.preorders(variant_id, status);

create unique index if not exists preorders_pending_customer_variant_idx
  on public.preorders(customer_id, variant_id)
  where status = 'pending' and customer_id is not null and variant_id is not null;

update public.preorders p
set status = case
  when lower(coalesce(o.financial_status, '')) = 'paid' then 'fulfilled'
  else 'payment_pending'
end
from public.orders o
where p.order_id = o.id
  and coalesce(p.status, 'pending') <> 'cancelled';
