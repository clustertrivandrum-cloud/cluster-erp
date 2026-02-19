-- 1. Insert Permissions
insert into permissions (key, description) values
    ('view_dashboard', 'Access to the main dashboard'),
    ('manage_users', 'Create, update, and delete staff users'),
    ('manage_roles', 'Create and update roles and permissions'),
    ('manage_products', 'Create, update, delete products and categories'),
    ('manage_inventory', 'View and adjust inventory levels'),
    ('manage_orders', 'View and manage sales orders'),
    ('manage_customers', 'View and manage customer data'),
    ('manage_suppliers', 'View and manage suppliers and purchase orders'),
    ('manage_finance', 'View financial reports and expenses'),
    ('manage_settings', 'Configure system settings'),
    ('access_pos', 'Access the Point of Sale system')
on conflict (key) do nothing;

-- 2. Grant Permissions to Roles

-- ADMIN: All Permissions
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'admin'
on conflict do nothing;

-- MANAGER: All except Settings and Roles
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'manager' 
  and p.key not in ('manage_settings', 'manage_roles')
on conflict do nothing;

-- CASHIER: POS, Orders, Customers, Dashboard
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'cashier' 
  and p.key in ('access_pos', 'manage_orders', 'manage_customers', 'view_dashboard')
on conflict do nothing;

-- USER: Dashboard only
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'user' 
  and p.key in ('view_dashboard')
on conflict do nothing;
