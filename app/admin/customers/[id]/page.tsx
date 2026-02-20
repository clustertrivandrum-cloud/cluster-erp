'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getCustomer, updateCustomer, deleteCustomer } from '@/lib/actions/order-actions'
import Link from 'next/link'
import { ArrowLeft, User, ShoppingBag, MapPin, Edit2, Trash2, Save, X } from 'lucide-react'
import Input from '@/components/ui/Input'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'

export default function CustomerDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [customer, setCustomer] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // Edit Mode
    const [formData, setFormData] = useState<any>({})

    // Dialog State
    const [deleteDTOpen, setDeleteDTOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (params.id) {
            loadCustomer()
        }
    }, [params.id])

    const loadCustomer = () => {
        setLoading(true)
        getCustomer(params.id as string).then(data => {
            setCustomer(data)
            setFormData({
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone
            })
            setLoading(false)
        })
    }

    const handleUpdate = async () => {
        const fd = new FormData()
        fd.append('first_name', formData.first_name)
        fd.append('last_name', formData.last_name)
        fd.append('email', formData.email)
        fd.append('phone', formData.phone)

        const res = await updateCustomer(customer.id, fd)
        if (res.success) {
            loadCustomer()
            setIsEditing(false)
        } else {
            alert(res.error)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        const res = await deleteCustomer(customer.id)
        if (res.success) {
            router.push('/admin/customers')
        } else {
            alert(res.error)
            setDeleting(false)
            setDeleteDTOpen(false)
        }
    }

    if (loading) return <div className="p-10 text-center text-gray-500">Loading profile...</div>
    if (!customer) return <div className="p-10 text-center text-gray-500">Customer not found.</div>

    // Calculations
    const totalSpent = customer.orders?.reduce((sum: number, order: any) => sum + (parseFloat(order.total_amount) || 0), 0) || 0
    const orderCount = customer.orders?.length || 0

    return (
        <div className="max-w-5xl mx-auto pb-10">
            <div className="flex items-center mb-6">
                <button onClick={() => router.push('/admin/customers')} className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Profile</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
                        <div className="flex flex-col items-center text-center">
                            <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-900 text-3xl font-bold mb-4">
                                {customer.first_name?.[0]}{customer.last_name?.[0]}
                            </div>

                            {!isEditing ? (
                                <>
                                    <h2 className="text-xl font-bold text-gray-900">{customer.first_name} {customer.last_name}</h2>
                                    <p className="text-sm text-gray-500">{customer.email}</p>
                                    <p className="text-sm text-gray-500">{customer.phone}</p>

                                    <div className="mt-6 w-full flex gap-2">
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                            <Edit2 className="w-4 h-4 mr-2" /> Edit
                                        </button>
                                        <button
                                            className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full space-y-4 pt-4">
                                    <Input label="First Name" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                                    <Input label="Last Name" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                                    <Input label="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />

                                    <div className="flex gap-2 pt-2">
                                        <button onClick={handleUpdate} className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                                            <Save className="w-4 h-4" /> Save
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                                            <X className="w-4 h-4" /> Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                            <p className="text-xs text-gray-500 uppercase font-medium">Total Orders</p>
                            <p className="text-2xl font-bold text-gray-900">{orderCount}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-center">
                            <p className="text-xs text-gray-500 uppercase font-medium">Total Spent</p>
                            <p className="text-2xl font-bold text-gray-900">₹{totalSpent.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Addresses Placeholder */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-900">Addresses</h3>
                            <button className="text-xs text-gray-900 font-medium hover:text-black">+ Add</button>
                        </div>
                        <div className="text-sm text-gray-500 italic">No addresses saved.</div>
                        {/* 
                            Implement address loop here from customer.addresses jsonb 
                        */}
                    </div>
                </div>

                {/* Right: Order History */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Order History</h3>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customer.orders && customer.orders.length > 0 ? (
                                    customer.orders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                <Link href={`/admin/orders/${order.id}`}>
                                                    #{order.order_number}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                                                    ${order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                                ₹{order.total_amount}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            No orders yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={deleteDTOpen}
                onClose={() => setDeleteDTOpen(false)}
                onConfirm={handleDelete}
                title="Delete Customer"
                message="Are you sure you want to delete this customer? This action cannot be undone and will remove all their data."
                confirmText="Delete Customer"
                variant="danger"
                loading={deleting}
            />
        </div>
    )
}
