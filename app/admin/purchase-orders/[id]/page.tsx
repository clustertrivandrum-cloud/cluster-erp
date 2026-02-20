'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, CheckCircle, Clock } from 'lucide-react'
import { getPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder } from '@/lib/actions/purchase-order-actions'

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        loadOrder()
    }, [id])

    const loadOrder = async () => {
        setLoading(true)
        const data = await getPurchaseOrder(id)
        if (data) {
            setOrder(data)
        } else {
            alert("Order not found")
            router.push('/admin/purchase-orders')
        }
        setLoading(false)
    }

    const handleReceive = async () => {
        if (!confirm("Are you sure you want to mark this order as Received? This will update inventory stock.")) return

        setProcessing(true)
        const result = await receivePurchaseOrder(id)
        if (result.error) {
            alert(result.error)
        } else {
            // Reload to show new status
            loadOrder()
        }
        setProcessing(false)
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this Draft order? This cannot be undone.")) return

        setProcessing(true)
        const result = await deletePurchaseOrder(id)
        if (result.error) {
            alert(result.error)
            setProcessing(false)
        } else {
            router.push('/admin/purchase-orders')
        }
    }

    if (loading) return <div className="p-8 text-center">Loading details...</div>
    if (!order) return <div className="p-8 text-center">Order not found</div>

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'received':
                return <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"><CheckCircle className="w-4 h-4 mr-1" /> Received</span>
            case 'ordered':
                return <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"><Clock className="w-4 h-4 mr-1" /> Ordered</span>
            default:
                return <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium uppercase">{status}</span>
        }
    }

    return (
        <div className="max-w-4xl mx-auto pb-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Order #{order.order_number}</h1>
                        <p className="text-sm text-gray-500 mt-1">Created on {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {order.status !== 'received' && (
                        <button
                            onClick={handleReceive}
                            disabled={processing}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Receive Order
                        </button>
                    )}
                    {order.status === 'draft' && (
                        <button
                            onClick={handleDelete}
                            disabled={processing}
                            className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Delete
                        </button>
                    )}
                    <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center">
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Items Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Order Items</h3>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {order.purchase_order_items?.map((item: any) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            <div>{item.product_variants?.products?.title}</div>
                                            <div className="text-xs text-gray-500">{item.product_variants?.title !== 'Default Variant' && item.product_variants?.title}</div>
                                            <div className="text-xs text-gray-400">SKU: {item.product_variants?.sku}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                                            {item.quantity}
                                            {order.status === 'received' && (
                                                <span className="block text-xs text-green-600">Received</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                                            ₹{parseFloat(item.unit_cost).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                                            ₹{parseFloat(item.total_cost).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">Total Amount</td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                                        ₹{parseFloat(order.total_amount).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">Status</h3>
                            {getStatusBadge(order.status)}
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <div className="text-sm text-gray-500">Supplier</div>
                            <div className="font-medium text-gray-900 text-lg">{order.suppliers?.name}</div>
                            <div className="text-sm text-gray-500 mt-1">{order.suppliers?.contact_person}</div>
                            <div className="text-sm text-gray-500">{order.suppliers?.email}</div>
                            <div className="text-sm text-gray-500">{order.suppliers?.phone}</div>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                            <div className="text-sm text-gray-500">Expected Date</div>
                            <div className="font-medium text-gray-900">
                                {order.expected_date ? new Date(order.expected_date).toLocaleDateString() : 'Not set'}
                            </div>
                        </div>
                        {order.notes && (
                            <div className="pt-4 border-t border-gray-100">
                                <div className="text-sm text-gray-500">Notes</div>
                                <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{order.notes}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
