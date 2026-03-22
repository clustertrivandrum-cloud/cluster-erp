create table if not exists reviews (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    user_id uuid null,
    rating int check (rating >= 1 and rating <= 5),
    title text null,
    body text not null,
    status text not null default 'pending' check (status in ('pending','approved','rejected','spam')),
    created_at timestamptz not null default now()
);

create index if not exists reviews_status_idx on reviews(status);
create index if not exists reviews_product_idx on reviews(product_id);
