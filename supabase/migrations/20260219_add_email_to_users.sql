-- 1. Add email column to public.users
alter table public.users 
add column if not exists email text;

-- 2. Update the trigger function to include email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, role_id, email)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    (select id from roles where name = 'user'),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email; -- syncing email on conflict
  return new;
end;
$$ language plpgsql security definer;

-- 3. Backfill emails for existing users
update public.users pu
set email = au.email
from auth.users au
where pu.id = au.id
and pu.email is null;
