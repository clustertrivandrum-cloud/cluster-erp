alter table public.categories
add column if not exists sort_order integer not null default 0;

with ranked_categories as (
  select
    id,
    row_number() over (
      partition by parent_id
      order by name asc, id asc
    ) * 10 as next_sort_order
  from public.categories
)
update public.categories categories
set sort_order = ranked_categories.next_sort_order
from ranked_categories
where categories.id = ranked_categories.id
  and coalesce(categories.sort_order, 0) = 0;

create index if not exists categories_parent_sort_order_name_idx
on public.categories (parent_id, sort_order, name);
