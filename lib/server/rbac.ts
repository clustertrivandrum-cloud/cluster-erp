import { createAdminClient } from '@/lib/supabase-admin'

export async function userHasPermission(userId: string, permission: string) {
  const supabase = createAdminClient()
  const { data: user } = await supabase
    .from('users')
    .select('role_id')
    .eq('id', userId)
    .maybeSingle()

  if (!user?.role_id) return false

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permission:permissions(key)')
    .eq('role_id', user.role_id)

  const keys = (perms || []).flatMap((p: any) =>
    Array.isArray(p.permission) ? p.permission.map((x: any) => x.key) : p.permission?.key ? [p.permission.key] : []
  )
  return keys.includes(permission)
}
