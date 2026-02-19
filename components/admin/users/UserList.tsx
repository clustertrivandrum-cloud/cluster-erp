'use client'

import { useState } from 'react'
import { updateUserRole, toggleUserStatus, deleteUser } from '@/lib/actions/user-actions'
import { MoreHorizontal, Shield, User as UserIcon, CheckCircle, XCircle, Trash2, Edit2, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import RolePermissionModal from './RolePermissionModal'
import EditUserModal from './EditUserModal'

interface User {
    id: string
    full_name: string
    role_id: string
    is_active: boolean
    email?: string
    roles: {
        id: string
        name: string
    } | null
    created_at: string
}

interface Role {
    id: string
    name: string
}

interface UserListProps {
    users: User[]
    roles: Role[]
}

export default function UserList({ users, roles }: UserListProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const router = useRouter()

    // Modal States
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    const [editingRole, setEditingRole] = useState<Role | null>(null)
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)

    const handleRoleChange = async (userId: string, newRoleId: string) => {
        setLoadingId(userId)
        await updateUserRole(userId, newRoleId)
        setLoadingId(null)
    }

    const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
        if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) return
        setLoadingId(userId)
        await toggleUserStatus(userId, !currentStatus)
        setLoadingId(null)
    }

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
        setLoadingId(userId)
        await deleteUser(userId)
        setLoadingId(null)
    }

    const openEditUser = (user: User) => {
        setEditingUser(user)
        setIsEditModalOpen(true)
    }

    const openRoleSettings = (roleId: string) => {
        const role = roles.find(r => r.id === roleId)
        if (role) {
            setEditingRole(role)
            setIsRoleModalOpen(true)
        }
    }

    return (
        <div className="space-y-6">
            {/* Role Management Tip */}
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm text-indigo-900 font-medium">Configure module access for each role.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                {user.full_name?.charAt(0).toUpperCase() || <UserIcon className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{user.full_name || 'Unknown User'}</div>
                                                <div className="text-xs text-gray-500">{user.email || 'No Email'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={user.role_id || ''}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                disabled={loadingId === user.id}
                                                className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1"
                                            >
                                                {roles.map(role => (
                                                    <option key={role.id} value={role.id}>
                                                        {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => openRoleSettings(user.role_id)}
                                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded"
                                                title="Configure Role Permissions"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(user.created_at).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleStatusToggle(user.id, user.is_active)}
                                                disabled={loadingId === user.id}
                                                className={`p-2 rounded-lg transition-colors ${user.is_active
                                                    ? 'text-amber-600 hover:bg-amber-50'
                                                    : 'text-green-600 hover:bg-green-50'
                                                    }`}
                                                title={user.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                            </button>

                                            <button
                                                onClick={() => openEditUser(user)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                title="Edit Details"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Role Permission Modal */}
            {isRoleModalOpen && (
                <RolePermissionModal
                    role={editingRole!}
                    onClose={() => setIsRoleModalOpen(false)}
                    onSuccess={() => {
                        setIsRoleModalOpen(false)
                        router.refresh()
                    }}
                />
            )}

            {/* Edit User Modal */}
            <EditUserModal
                user={editingUser}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => {
                    setIsEditModalOpen(false)
                    router.refresh()
                }}
            />
        </div>
    )
}
