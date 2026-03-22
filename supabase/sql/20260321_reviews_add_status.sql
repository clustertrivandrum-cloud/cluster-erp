-- Ensure reviews table has status column even if table pre-existed
do $$
begin
    if exists (select 1 from information_schema.columns where table_name = 'reviews' and column_name = 'status') then
        -- already present
        null;
    else
        alter table reviews add column status text not null default 'pending';
    end if;
exception when undefined_table then
    -- table not present; nothing to alter
    null;
end$$;

-- Add constraint if missing
do $$
begin
    alter table reviews
    add constraint reviews_status_check check (status in ('pending','approved','rejected','spam'));
exception when duplicate_table then
    null;
end$$;
