'use client'

import { useState } from 'react'
import { createRole } from '@/lib/actions/user-actions'
import { Plus, X, Loader2, ShieldPlus } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'

export default function CreateRoleModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [roleName, setRoleName] = useState('')
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const res = await createRole(roleName)

        setIsLoading(false)
        if (res.success) {
            setIsOpen(false)
            setRoleName('')
            setAlertConfig({ isOpen: true, message: 'Role created successfully.' })
        } else {
            setAlertConfig({ isOpen: true, message: res.error || 'Failed to create role' })
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 bg-white text-gray-900 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium"
            >
                <ShieldPlus className="w-5 h-5" />
                Add Role
            </button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Role</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                        <input
                            type="text"
                            required
                            value={roleName}
                            onChange={e => setRoleName(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none transition-all placeholder:text-gray-400 text-gray-900"
                            placeholder="e.g. Supervisor"
                        />
                        <p className="text-xs text-gray-500 mt-1">Role name will be saved in lowercase.</p>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-colors shadow-lg shadow-gray-200 disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Role'}
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
