'use client'

import { useState, useEffect } from 'react'
import { createRole, getPermissions, getRolePermissions, updateRolePermissions } from '@/lib/actions/user-actions'
import { Shield, Save, X, Loader2, Settings } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'

interface Role {
    id: string
    name: string
}

interface Permission {
    id: string
    key: string
    description: string
}

interface RolePermissionModalProps {
    role?: Role // If provided, we are editing. If null, creating.
    onClose: () => void
    onSuccess: () => void
}

export default function RolePermissionModal({ role, onClose, onSuccess }: RolePermissionModalProps) {
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
    const [roleName, setRoleName] = useState(role?.name || '')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        // Fetch all available permissions
        const permRes = await getPermissions()
        if (permRes.success && permRes.data) {
            setPermissions(permRes.data)
        }

        // If editing, fetch existing permissions for this role
        if (role) {
            const rolePermRes = await getRolePermissions(role.id)
            if (rolePermRes.success && rolePermRes.data) {
                setSelectedPermissions(rolePermRes.data)
            }
        }
        setLoading(false)
    }

    const togglePermission = (id: string) => {
        if (selectedPermissions.includes(id)) {
            setSelectedPermissions(prev => prev.filter(p => p !== id))
        } else {
            setSelectedPermissions(prev => [...prev, id])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        let targetRoleId = role?.id

        // 1. Create Role if new
        if (!targetRoleId) {
            if (!roleName.trim()) {
                setAlertConfig({ isOpen: true, message: 'Role name is required.' })
                setSaving(false)
                return
            }

            const createRes = await createRole(roleName.trim())
            if (!createRes.success || !createRes.data?.id) {
                setAlertConfig({ isOpen: true, message: createRes.error || 'Failed to create role' })
                setSaving(false)
                return
            }
            targetRoleId = createRes.data.id
        }

        if (!targetRoleId) {
            setAlertConfig({ isOpen: true, message: 'Failed to resolve role.' })
            setSaving(false)
            return
        }

        // 2. Update Permissions
        const updateRes = await updateRolePermissions(targetRoleId, selectedPermissions)
        if (updateRes.success) {
            setAlertConfig({ isOpen: true, message: 'Saved successfully.' })
            onSuccess()
            setSaving(false)
            // slight delay to let user see success
            setTimeout(() => onClose(), 300)
        } else {
            setAlertConfig({ isOpen: true, message: updateRes.error || 'Failed to update permissions' })
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-gray-900" />
                        {role ? `Manage Permissions: ${role.name}` : 'Create New Role'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
                    ) : (
                        <form id="role-form" onSubmit={handleSubmit} className="space-y-6">
                            {!role && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={roleName}
                                        onChange={e => setRoleName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none"
                                        placeholder="e.g. Sales Associate"
                                    />
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Settings className="w-4 h-4" /> Module Access
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {permissions.map(perm => (
                                        <label key={perm.id} className={`
                                            flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                            ${selectedPermissions.includes(perm.id)
                                                ? 'bg-gray-50 border-gray-200 shadow-sm'
                                                : 'bg-white border-gray-100 hover:border-gray-200'}
                                        `}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.includes(perm.id)}
                                                onChange={() => togglePermission(perm.id)}
                                                className="mt-1 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 capitalize">
                                                    {perm.key.replace(/_/g, ' ')}
                                                </div>
                                                <div className="text-xs text-gray-500">{perm.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} type="button" className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="role-form"
                        disabled={saving}
                        className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black shadow-lg shadow-gray-200 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
                    </button>
                </div>
            </div>

            <Dialog
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
                title="Notification"
            >
                <div className="mt-2">
                    <p className="text-sm text-gray-500">
                        {alertConfig.message}
                    </p>
                </div>
                <div className="mt-4">
                    <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })}
                    >
                        Close
                    </button>
                </div>
            </Dialog>
        </div>
    )
}
