import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seed() {
    console.log('Seeding database...')

    // 1. Create Roles
    const roles = ['super_admin', 'admin', 'editor', 'viewer']
    for (const role of roles) {
        const { error } = await supabase
            .from('roles')
            .upsert({ name: role }, { onConflict: 'name' })
        if (error) console.error(`Error creating role ${role}:`, error.message)
        else console.log(`Role ${role} created/verified.`)
    }

    // 2. Create Permissions (Example)
    const permissions = [
        { key: 'manage_users', description: 'Can manage all users' },
        { key: 'manage_products', description: 'Can create/edit/delete products' },
        { key: 'view_reports', description: 'Can view financial reports' },
    ]

    for (const perm of permissions) {
        const { error } = await supabase
            .from('permissions')
            .upsert(perm, { onConflict: 'key' })
        if (error) console.error(`Error creating permission ${perm.key}:`, error.message)
    }

    // 3. Assign Permissions to Super Admin Role
    const { data: superAdminRole } = await supabase.from('roles').select('id').eq('name', 'super_admin').single()
    const { data: allPermissions } = await supabase.from('permissions').select('id')

    if (superAdminRole && allPermissions) {
        const rolePermissions = allPermissions.map(p => ({
            role_id: superAdminRole.id,
            permission_id: p.id
        }))

        const { error } = await supabase.from('role_permissions').upsert(rolePermissions, { onConflict: 'role_id, permission_id' })
        if (error) console.error('Error assigning permissions to super_admin:', error.message)
        else console.log('Assigned all permissions to super_admin.')
    }

    console.log('Seeding completed.')
}

seed().catch(console.error)
