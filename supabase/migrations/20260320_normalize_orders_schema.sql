alter table public.orders
add column if not exists customer_id uuid references public.customers(id),
add column if not exists guest_phone text,
add column if not exists sales_channel text default 'online',
add column if not exists payment_status text default 'unpaid',
add column if not exists status text default 'pending',
add column if not exists total_amount numeric(12, 2) default 0,
add column if not exists updated_at timestamptz default now();

alter table public.orders
add column if not exists discount_amount numeric default 0,
add column if not exists tax_amount numeric default 0,
add column if not exists payment_method text default 'Card',
add column if not exists order_type text default 'online',
add column if not exists notes text;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'financial_status'
    ) then
        execute $sql$
            update public.orders
            set payment_status = coalesce(nullif(payment_status, ''), financial_status, 'unpaid')
            where payment_status is null or payment_status = ''
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_status'
    ) and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'financial_status'
    ) then
        execute $sql$
            update public.orders
            set financial_status = coalesce(nullif(financial_status, ''), payment_status, 'unpaid')
            where financial_status is null or financial_status = ''
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'fulfillment_status'
    ) then
        execute $sql$
            update public.orders
            set status = coalesce(nullif(status, ''), fulfillment_status, 'pending')
            where status is null or status = ''
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'fulfillment_status'
    ) and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'status'
    ) then
        execute $sql$
            update public.orders
            set fulfillment_status = coalesce(nullif(fulfillment_status, ''), status, 'pending')
            where fulfillment_status is null or fulfillment_status = ''
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'grand_total'
    ) then
        execute $sql$
            update public.orders
            set total_amount = coalesce(total_amount, grand_total, 0)
            where total_amount is null
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'grand_total'
    ) and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'total_amount'
    ) then
        execute $sql$
            update public.orders
            set grand_total = coalesce(grand_total, total_amount, 0)
            where grand_total is null
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'order_type'
    ) then
        execute $sql$
            update public.orders
            set sales_channel = coalesce(nullif(sales_channel, ''), order_type, 'online')
            where sales_channel is null or sales_channel = ''
        $sql$;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'order_type'
    ) and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'orders' and column_name = 'sales_channel'
    ) then
        execute $sql$
            update public.orders
            set order_type = coalesce(nullif(order_type, ''), sales_channel, 'online')
            where order_type is null or order_type = ''
        $sql$;
    end if;

    execute $sql$
        update public.orders
        set updated_at = coalesce(updated_at, created_at, now())
        where updated_at is null
    $sql$;
end $$;

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_order_number on public.orders(order_number desc);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_sales_channel on public.orders(sales_channel);
create index if not exists idx_orders_guest_email on public.orders(guest_email);
create index if not exists idx_orders_guest_phone on public.orders(guest_phone);
