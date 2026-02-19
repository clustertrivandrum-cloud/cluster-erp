-- Enable RLS on tables (if not already enabled)
alter table public.roles enable row level security;
alter table public.users enable row level security;

-- POLICIES FOR 'ROLES'
-- Allow all authenticated users to read roles
create policy "Allow read access for authenticated users"
on public.roles
for select
to authenticated
using (true);

-- POLICIES FOR 'USERS'
-- Allow all authenticated users to read all user profiles
-- (This is necessary for the User List to work for any staff member)
create policy "Allow read access for all users"
on public.users
for select
to authenticated
using (true);

-- Allow users to update their own profile
create policy "Allow users to update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id);

-- Allow admins to update any profile
-- Note: This requires a check to avoid recursion if we query users inside the policy.
-- A safer way is to define a security definer function or just rely on the fact 
-- that 'admin' server actions might use the service role key if we change implementation.
-- But for now, let's enable update for admins if possible.
-- Complex policy skipped for now to avoid recursion errors usually found in Supabase.
-- We will rely on "Allow users to update own profile" for self-edits.
-- For Admin edits (Role changes), we might need to use the Service Role client
-- inside the Server Action if we want to bypass RLS for administrative tasks.
