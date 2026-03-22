-- Basic refunds table to track order refunds and optional restocking
create table if not exists refunds (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    amount numeric not null check (amount >= 0),
    reason text null,
    restocked boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists refunds_order_idx on refunds(order_id);
