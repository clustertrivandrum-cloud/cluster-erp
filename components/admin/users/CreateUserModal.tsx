'use client'

import { useState } from 'react'
import { createUser } from '@/lib/actions/user-actions'
import { Plus, X, Loader2 } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'

interface Role {
    id: string
    name: string
}

interface CreateUserModalProps {
    roles: Role[]
}

export default function CreateUserModal({ roles }: CreateUserModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' })

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        roleId: roles.find(r => r.name === 'cashier')?.id || roles[0]?.id || ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const res = await createUser(formData)

        setIsLoading(false)
        if (res.success) {
            setIsOpen(false)
            setFormData({ email: '', password: '', fullName: '', roleId: roles[0]?.id || '' })
            setAlertConfig({ isOpen: true, message: 'User created successfully.' })
        } else {
            setAlertConfig({ isOpen: true, message: res.error || 'Failed to create user' })
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-black transition-colors shadow-sm font-medium"
            >
                <Plus className="w-5 h-5" />
                Add User
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold text-gray-900 mb-6">Add New User</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            value={formData.fullName}
                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                            placeholder="John Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                            placeholder="john@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={formData.roleId}
                            onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none transition-all appearance-none bg-white text-gray-900 placeholder:text-gray-400"
                        >
                            {roles.map(role => (
                                <option key={role.id} value={role.id}>
                                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-colors shadow-lg shadow-gray-200 disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create User'}
                        </button>
                    </div>
                </form>
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
