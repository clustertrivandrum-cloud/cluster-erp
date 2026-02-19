-- Insert default roles if they don't exist
insert into roles (name)
values 
  ('admin'),
  ('manager'),
  ('cashier'),
  ('user')
on conflict (name) do nothing;
