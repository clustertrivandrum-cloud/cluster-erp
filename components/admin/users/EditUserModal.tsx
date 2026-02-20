'use client'

import { useState, useEffect } from 'react'
import { updateUser } from '@/lib/actions/user-actions'
import { Save, X, Loader2 } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'

interface EditUserModalProps {
    user: any
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function EditUserModal({ user, isOpen, onClose, onSuccess }: EditUserModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '' })
    const [formData, setFormData] = useState({
        email: '',
        fullName: ''
    })

    useEffect(() => {
        if (user) {
            setFormData({
                email: user.email || '',
                fullName: user.full_name || ''
            })
        }
    }, [user])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const res = await updateUser(user.id, formData)

        setIsLoading(false)
        if (res.success) {
            onSuccess()
            onClose()
        } else {
            setAlertConfig({ isOpen: true, message: res.error || 'Failed to update user' })
        }
    }

    if (!isOpen) {
        // Need to render Dialog even if modal is closed if we use it for errors? 
        // No, typically alert is shown while modal is open. 
        // But if we want to show alert AFTER closing?
        // In this case, success closes. Error stays open.
        // So we just return null if not open.
        return null
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                </button>

                <h2 className="text-xl font-bold text-gray-900 mb-6">Edit User</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            value={formData.fullName}
                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
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
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-black transition-colors shadow-lg shadow-gray-200 disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
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
