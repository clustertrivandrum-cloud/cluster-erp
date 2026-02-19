import { getUsers, getRoles } from '@/lib/actions/user-actions'
import UserList from '@/components/admin/users/UserList'
import CreateUserModal from '@/components/admin/users/CreateUserModal'
import CreateRoleModal from '@/components/admin/users/CreateRoleModal'
import { Users } from 'lucide-react'

export default async function UsersPage() {
    const [usersRes, rolesRes] = await Promise.all([
        getUsers(),
        getRoles()
    ])

    const users = usersRes.success ? usersRes.data || [] : []
    const roles = rolesRes.success ? rolesRes.data || [] : []

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500 mt-1">Manage staff access and roles.</p>
                </div>
                <div className="flex items-center gap-3">
                    <CreateRoleModal />
                    <CreateUserModal roles={roles} />
                </div>
            </div>

            <UserList users={users} roles={roles} />
        </div>
    )
}
