-- App Settings Table (Singleton)
create table if not exists app_settings (
    id uuid primary key default gen_random_uuid(),
    store_name text default 'Cluster ERP',
    store_email text,
    store_phone text,
    store_address text,
    store_currency text default 'INR',
    tax_rate numeric(5, 2) default 18.00, -- GST
    gstin text, -- Tax ID
    logo_url text,
    updated_at timestamptz default now()
);

-- Enable RLS
alter table app_settings enable row level security;

-- Policies
create policy "Authenticated users can manage settings" on app_settings for all to authenticated using (true) with check (true);

-- Insert default row if not exists
insert into app_settings (store_name)
select 'Cluster ERP'
where not exists (select 1 from app_settings);
