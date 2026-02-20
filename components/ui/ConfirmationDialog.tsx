'use client'

import Dialog from './Dialog'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface ConfirmationDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'primary' | 'success'
    loading?: boolean
}

export default function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
    loading = false
}: ConfirmationDialogProps) {
    const getConfirmButtonStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            case 'success':
                return 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            default:
                return 'bg-gray-900 hover:bg-black focus:ring-gray-900'
        }
    }

    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 mb-4 sm:mb-0 sm:mr-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
            case 'success':
                return <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10 mb-4 sm:mb-0 sm:mr-4">
                    <CheckCircle className="h-6 w-6 text-green-600" aria-hidden="true" />
                </div>
            default:
                return <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10 mb-4 sm:mb-0 sm:mr-4">
                    <AlertTriangle className="h-6 w-6 text-gray-600" aria-hidden="true" />
                </div>
        }
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose}>
            <div className="sm:flex sm:items-start">
                {getIcon()}
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg font-bold leading-6 text-gray-900" id="modal-title">
                        {title}
                    </h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">
                            {message}
                        </p>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
                        <button
                            type="button"
                            className={`inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto ${getConfirmButtonStyles()} disabled:opacity-70 disabled:cursor-not-allowed`}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : confirmText}
                        </button>
                        <button
                            type="button"
                            className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                            onClick={onClose}
                            disabled={loading}
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </Dialog>
    )
}
