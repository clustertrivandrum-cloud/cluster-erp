create table if not exists payment_request_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  provider text not null,
  recipient text not null default '',
  payment_url text not null,
  status text not null check (status in ('processing', 'sent', 'failed')),
  provider_reference text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists payment_request_deliveries_order_created_idx
  on payment_request_deliveries(order_id, created_at desc);
