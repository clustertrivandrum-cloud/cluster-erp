'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { createExpense, deleteExpense } from '@/lib/actions/finance-actions'
import { useRouter } from 'next/navigation'

interface ExpenseListProps {
    initialExpenses: any[]
}

export default function ExpenseList({ initialExpenses }: ExpenseListProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter() // Not strictly needed with server action revalidate but good for refresh if needed

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: 'Operating',
        description: '',
        expense_date: new Date().toISOString().split('T')[0]
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await createExpense(formData)
        if (res.success) {
            setIsModalOpen(false)
            setFormData({
                title: '',
                amount: '',
                category: 'Operating',
                description: '',
                expense_date: new Date().toISOString().split('T')[0]
            })
        } else {
            alert(res.error)
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await deleteExpense(id)
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Recent Expenses</h3>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="p-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[500px] p-2">
                {initialExpenses.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No expenses recorded</div>
                ) : (
                    <div className="space-y-2">
                        {initialExpenses.map(expense => (
                            <div key={expense.id} className="p-3 hover:bg-gray-50 rounded-xl transition-colors group flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">{expense.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider bg-gray-100 px-1.5 py-0.5 rounded">{expense.category}</span>
                                        <span className="text-xs text-gray-400">{expense.expense_date}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-500">-₹{expense.amount}</span>
                                    <button
                                        onClick={() => handleDelete(expense.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ADD EXPENSE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-900">Add New Expense</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                                <input
                                    required
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
                                    placeholder="e.g. Shop Rent"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-400">₹</span>
                                        <input
                                            required
                                            type="number"
                                            className="w-full p-2 pl-7 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
                                            placeholder="0.00"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
                                        value={formData.expense_date}
                                        onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                                <select
                                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    <option>Operating</option>
                                    <option>Rent</option>
                                    <option>Salary</option>
                                    <option>Utilities</option>
                                    <option>Marketing</option>
                                    <option>Inventory</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black disabled:opacity-70 transition-all shadow-lg shadow-gray-200"
                            >
                                {loading ? 'Saving...' : 'Save Expense'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
