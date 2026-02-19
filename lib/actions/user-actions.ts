'use server'

import { createClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

export async function createUser(data: any) {
    const supabaseAdmin = createAdminClient()

    const { email, password, fullName, roleId } = data

    // 1. Create User in Auth (Auto-confirmed)
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
    })

    if (authError) return { success: false, error: authError.message }
    if (!user.user) return { success: false, error: 'User creation failed' }

    // 2. Upsert User (Update public.users)
    // We use upsert to handle both cases:
    // a) Trigger ran and created "User" role -> Update to selected role & name
    // b) Trigger didn't run -> Create new record with selected role

    const { error: upsertError } = await supabaseAdmin
        .from('users')
        .upsert({
            id: user.user.id,
            role_id: roleId,
            full_name: fullName,
            email: email, // Sync email (needs migration)
            is_active: true
        })

    if (upsertError) return { success: false, error: upsertError.message }

    revalidatePath('/admin/users')
    return { success: true }
}

export async function getUsers() {
    // Admin function: Use Service Role to bypass RLS
    const supabaseAdmin = createAdminClient()

    const { data: users, error } = await supabaseAdmin
        .from('users')
        .select(`
            *,
            roles (
                id,
                name
            )
        `)
        .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: users }
}

export async function getRoles() {
    // Public data, but using admin client ensures we get it regardless of RLS
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.from('roles').select('*').order('name')
    if (error) return { success: false, error: error.message }
    return { success: true, data }
}

export async function updateUserRole(userId: string, roleId: string) {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
        .from('users')
        .update({ role_id: roleId })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
}

export async function toggleUserStatus(userId: string, isActive: boolean) {
    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
        .from('users')
        .update({ is_active: isActive })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
}

export async function createRole(name: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('roles')
        .insert({ name: name.toLowerCase() })
        .select()
        .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/users')
    return { success: true, data }
}

export async function deleteRole(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('roles').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
}

// ==============================
// RBAC ACTIONS
// ==============================

export async function getPermissions() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('permissions').select('*').order('key')
    if (error) return { success: false, error: error.message }
    return { success: true, data }
}

export async function getRolePermissions(roleId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: data.map(p => p.permission_id) }
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
    const supabaseAdmin = createAdminClient()

    // 1. Delete existing
    const { error: deleteError } = await supabaseAdmin
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)

    if (deleteError) return { success: false, error: deleteError.message }

    // 2. Insert new (if any)
    if (permissionIds.length > 0) {
        const toInsert = permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }))
        const { error: insertError } = await supabaseAdmin
            .from('role_permissions')
            .insert(toInsert)

        if (insertError) return { success: false, error: insertError.message }
    }

    revalidatePath('/admin/users')
    return { success: true }
}

// ==============================
// USER CRUD ACTIONS
// ==============================

export async function updateUser(userId: string, data: { fullName: string, email: string }) {
    const supabaseAdmin = createAdminClient()

    // 1. Update public.users
    const { error: dbError } = await supabaseAdmin
        .from('users')
        .update({
            full_name: data.fullName,
            email: data.email
        })
        .eq('id', userId)

    if (dbError) return { success: false, error: dbError.message }

    // 2. Update auth.users (Email)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: data.email,
        user_metadata: { full_name: data.fullName } // Sync meta
    })

    if (authError) return { success: false, error: authError.message }

    revalidatePath('/admin/users')
    return { success: true }
}

export async function deleteUser(userId: string) {
    const supabaseAdmin = createAdminClient()

    // Delete from Auth (Cascades to public.users)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
}

export async function getMyPermissions() {
    const supabase = await createClient()

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // 2. Get user's role
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .single()

    if (userError || !userData) return { success: false, error: 'User profile not found' }

    // 3. Get permissions for that role
    // We join role_permissions -> permissions to get the 'key'
    const { data: permissions, error: permError } = await supabase
        .from('role_permissions')
        .select(`
            permission:permissions (
                key
            )
        `)
        .eq('role_id', userData.role_id)

    if (permError) return { success: false, error: permError.message }

    // Transform to simple array of keys ['view_dashboard', 'manage_products']
    const permissionKeys = permissions.map((p: any) => p.permission.key)

    return { success: true, data: permissionKeys }
}
