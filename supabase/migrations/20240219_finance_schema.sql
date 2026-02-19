-- Create expenses table if it doesn't exist
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(12,2) not null,
  category text, -- 'Rent', 'Salary', 'Utility', 'Marketing', 'Other'
  description text,
  expense_date date not null default CURRENT_DATE,
  created_at timestamptz default now()
);

-- Enable RLS
alter table expenses enable row level security;

-- Create policy for authenticated users (admins) to manage expenses
create policy "Admins can manage expenses"
  on expenses
  for all
  to authenticated
  using (true)
  with check (true);

-- Index for date filtering
create index if not exists idx_expenses_date on expenses(expense_date);
