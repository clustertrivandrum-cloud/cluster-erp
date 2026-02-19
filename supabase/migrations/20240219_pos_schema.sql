-- POS Enhancements for Orders Table
alter table orders
add column if not exists discount_amount numeric default 0,
add column if not exists tax_amount numeric default 0,
add column if not exists payment_method text default 'Card', -- Cash, Card, UPI, Split
add column if not exists order_type text default 'online', -- pos, online
add column if not exists notes text;

-- Add index for order_type for reporting
create index if not exists idx_orders_type on orders(order_type);
