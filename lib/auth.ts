import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import type { PermissionKey } from '@/lib/permissions';

type UserProfile = {
  id: string;
  role_id: string | null;
  is_active: boolean;
};

type PermissionRow = {
  permission:
    | {
        key: PermissionKey;
      }
    | Array<{
        key: PermissionKey;
      }>
    | null;
};

export async function getCurrentAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null, permissions: [] as PermissionKey[] };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role_id, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.role_id) {
    return { user, profile: profile as UserProfile | null, permissions: [] as PermissionKey[] };
  }

  const { data: permissionRows } = await supabase
    .from('role_permissions')
    .select(`
      permission:permissions (
        key
      )
    `)
    .eq('role_id', profile.role_id);

  const permissions = ((permissionRows || []) as unknown as PermissionRow[])
    .flatMap((row) => {
      if (Array.isArray(row.permission)) {
        return row.permission.map((item) => item.key);
      }

      return row.permission?.key ? [row.permission.key] : [];
    })
    .filter((value): value is PermissionKey => Boolean(value));

  return { user, profile: profile as UserProfile, permissions };
}

export async function requireAuthenticatedAdmin() {
  const access = await getCurrentAccess();

  if (!access.user) {
    redirect('/login');
  }

  if (!access.profile?.is_active) {
    redirect('/login');
  }

  return access;
}

export async function requirePagePermission(permission: PermissionKey | PermissionKey[]) {
  const access = await requireAuthenticatedAdmin();
  const required = Array.isArray(permission) ? permission : [permission];

  if (!required.some((item) => access.permissions.includes(item))) {
    redirect('/admin/unauthorized');
  }

  return access;
}

export async function requireActionPermission(permission: PermissionKey | PermissionKey[]) {
  const access = await requireAuthenticatedAdmin();
  const required = Array.isArray(permission) ? permission : [permission];

  if (!required.some((item) => access.permissions.includes(item))) {
    throw new Error('Unauthorized');
  }

  return access;
}
