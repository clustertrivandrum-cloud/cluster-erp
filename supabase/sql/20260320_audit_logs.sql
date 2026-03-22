-- Audit log table for both ERP and ecommerce apps
create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid null,
    action text not null,
    entity_type text not null,
    entity_id text not null,
    before jsonb null,
    after jsonb null,
    created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_idx on audit_logs(created_at desc);
