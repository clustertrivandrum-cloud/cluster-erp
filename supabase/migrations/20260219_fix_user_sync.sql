-- 1. Ensure the trigger function exists (it was defined in schema.sql but good to be sure)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, role_id)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    (select id from roles where name = 'user')
  )
  on conflict (id) do nothing; -- Handle potential race conditions
  return new;
end;
$$ language plpgsql security definer;

-- 2. Create the Trigger on auth.users
-- Check if trigger exists first to avoid error, or drop and recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Backfill missing users
-- Insert any auth.users that are NOT in public.users
insert into public.users (id, full_name, role_id)
select 
  au.id, 
  au.raw_user_meta_data->>'full_name', 
  (select id from roles where name = 'user')
from auth.users au
where au.id not in (select id from public.users)
on conflict (id) do nothing;
