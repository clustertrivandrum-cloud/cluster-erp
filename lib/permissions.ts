export type PermissionKey =
  | 'view_dashboard'
  | 'manage_users'
  | 'manage_roles'
  | 'manage_products'
  | 'manage_inventory'
  | 'manage_orders'
  | 'manage_customers'
  | 'manage_suppliers'
  | 'manage_finance'
  | 'manage_settings'
  | 'manage_reviews'
  | 'access_pos';

const routePermissionMatchers: Array<{ prefix: string; permission: PermissionKey | PermissionKey[] | null }> = [
  { prefix: '/admin/unauthorized', permission: null },
  { prefix: '/admin/users', permission: ['manage_users', 'manage_roles'] },
  { prefix: '/admin/categories', permission: 'manage_products' },
  { prefix: '/admin/products', permission: 'manage_products' },
  { prefix: '/admin/inventory', permission: 'manage_inventory' },
  { prefix: '/admin/orders', permission: 'manage_orders' },
  { prefix: '/admin/preorders', permission: 'manage_orders' },
  { prefix: '/admin/customers', permission: 'manage_customers' },
  { prefix: '/admin/suppliers', permission: 'manage_suppliers' },
  { prefix: '/admin/purchase-orders', permission: 'manage_suppliers' },
  { prefix: '/admin/finance', permission: 'manage_finance' },
  { prefix: '/admin/reviews', permission: 'manage_reviews' },
  { prefix: '/admin/settings', permission: 'manage_settings' },
  { prefix: '/admin/pos', permission: 'access_pos' },
  { prefix: '/admin', permission: 'view_dashboard' },
];

export function getRequiredPermissionForPath(pathname: string): PermissionKey | PermissionKey[] | null {
  const match = routePermissionMatchers.find(({ prefix }) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });

  return match?.permission ?? null;
}
