'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getOrder, updateOrderStatus } from '@/lib/actions/order-actions'
import { ArrowLeft, Printer, Truck, CheckCircle, Package } from 'lucide-react'
import ConfirmationDialog from '@/components/ui/ConfirmationDialog'
import Link from 'next/link'

export default function OrderDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [order, setOrder] = useState<any>(null)
    const [updating, setUpdating] = useState(false)

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [pendingStatus, setPendingStatus] = useState<string | null>(null)

    useEffect(() => {
        if (params.id) {
            getOrder(params.id as string).then(setOrder)
        }
    }, [params.id])

    const requestStatusUpdate = (status: string) => {
        setPendingStatus(status)
        setConfirmOpen(true)
    }

    const handleStatusUpdate = async () => {
        if (!pendingStatus) return

        setUpdating(true)
        await updateOrderStatus(order.id, pendingStatus)
        // Refresh
        const updated = await getOrder(order.id)
        setOrder(updated)
        setUpdating(false)
        setConfirmOpen(false)
        setPendingStatus(null)
    }

    if (!order) return <div className="p-10 text-center text-gray-500">Loading Order...</div>

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center">
                    <button onClick={() => router.push('/admin/orders')} className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            Order #{order.order_number}
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide border border-gray-200">
                                {order.status}
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Placed on {new Date(order.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Print Invoice
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Items */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Order Items</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {order.order_items.map((item: any) => (
                                <div key={item.id} className="p-6 flex items-center gap-4">
                                    {item.product_variants?.products?.product_media?.[0]?.media_url ? (
                                        <img src={item.product_variants.products.product_media[0].media_url} className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                            <Package className="w-8 h-8" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-gray-900">{item.product_variants?.products?.title}</h4>
                                        <p className="text-sm text-gray-500">{item.product_variants?.title !== 'Default Variant' ? item.product_variants?.title : ''}</p>
                                        <p className="text-xs text-gray-400 mt-1">SKU: {item.product_variants?.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-gray-900">₹{item.total_price}</p>
                                        <p className="text-xs text-gray-500">{item.quantity} x ₹{item.unit_price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-gray-50 p-6 border-t border-gray-200">
                            <div className="flex justify-between items-center text-base font-bold text-gray-900">
                                <span>Total</span>
                                <span>₹{order.total_amount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Info & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Actions */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Workflow</h3>
                        <div className="space-y-3">
                            {order.status === 'pending' && (
                                <button
                                    onClick={() => requestStatusUpdate('processing')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    Mark as Processing
                                </button>
                            )}
                            {order.status === 'processing' && (
                                <button
                                    onClick={() => handleStatusUpdate('shipped')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-black"
                                >
                                    <Truck className="w-4 h-4 mr-2" />
                                    Mark as Shipped
                                </button>
                            )}
                            {order.status === 'shipped' && (
                                <button
                                    onClick={() => handleStatusUpdate('delivered')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark as Delivered
                                </button>
                            )}
                            {['pending', 'processing'].includes(order.status) && (
                                <button
                                    onClick={() => handleStatusUpdate('cancelled')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50"
                                >
                                    Cancel Order
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Customer Details</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-medium text-gray-900">{order.customers?.first_name} {order.customers?.last_name}</p>
                                <p className="text-sm text-gray-500">{order.customers?.email}</p>
                                <p className="text-sm text-gray-500">{order.customers?.phone}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Dialog for this page */}
            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />
        </div>
    )
}
                    <button onClick={() => router.push('/admin/orders')} className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            Order #{order.order_number}
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 uppercase tracking-wide border border-gray-200">
                                {order.status}
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Placed on {new Date(order.created_at).toLocaleString()}
                        </p>
                    </div>

                    <ConfirmationDialog
                        isOpen={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        onConfirm={handleStatusUpdate}
                        title="Update Order Status"
                        message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                        confirmText="Update Status"
                        loading={updating}
                    />
                </div >

                <ConfirmationDialog
                    isOpen={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={handleStatusUpdate}
                    title="Update Order Status"
                    message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                    confirmText="Update Status"
                    loading={updating}
                />
                <div className="flex gap-3">
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Print Invoice
                    </button>
                </div>

                <ConfirmationDialog
                    isOpen={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={handleStatusUpdate}
                    title="Update Order Status"
                    message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                    confirmText="Update Status"
                    loading={updating}
                />
            </div >

            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Items */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-base font-semibold text-gray-900">Order Items</h3>
                        </div>

                        <ConfirmationDialog
                            isOpen={confirmOpen}
                            onClose={() => setConfirmOpen(false)}
                            onConfirm={handleStatusUpdate}
                            title="Update Order Status"
                            message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                            confirmText="Update Status"
                            loading={updating}
                        />
                        <div className="divide-y divide-gray-100">
                            {order.order_items.map((item: any) => (
                                <div key={item.id} className="p-6 flex items-center gap-4">
                                    {item.product_variants?.products?.product_media?.[0]?.media_url ? (
                                        <img src={item.product_variants.products.product_media[0].media_url} className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                            <Package className="w-8 h-8" />
                                        </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />
                                    )}
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-gray-900">{item.product_variants?.products?.title}</h4>
                                        <p className="text-sm text-gray-500">{item.product_variants?.title !== 'Default Variant' ? item.product_variants?.title : ''}</p>
                                        <p className="text-xs text-gray-400 mt-1">SKU: {item.product_variants?.sku}</p>
                                    </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-gray-900">₹{item.total_price}</p>
                                        <p className="text-xs text-gray-500">{item.quantity} x ₹{item.unit_price}</p>
                                    </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />
                                </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />
                            ))}
                        </div>

                        <ConfirmationDialog
                            isOpen={confirmOpen}
                            onClose={() => setConfirmOpen(false)}
                            onConfirm={handleStatusUpdate}
                            title="Update Order Status"
                            message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                            confirmText="Update Status"
                            loading={updating}
                        />
                        <div className="bg-gray-50 p-6 border-t border-gray-200">
                            <div className="flex justify-between items-center text-base font-bold text-gray-900">
                                <span>Total</span>
                                <span>₹{order.total_amount}</span>
                            </div>

                            <ConfirmationDialog
                                isOpen={confirmOpen}
                                onClose={() => setConfirmOpen(false)}
                                onConfirm={handleStatusUpdate}
                                title="Update Order Status"
                                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                                confirmText="Update Status"
                                loading={updating}
                            />
                        </div>

                        <ConfirmationDialog
                            isOpen={confirmOpen}
                            onClose={() => setConfirmOpen(false)}
                            onConfirm={handleStatusUpdate}
                            title="Update Order Status"
                            message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                            confirmText="Update Status"
                            loading={updating}
                        />
                    </div>

                    <ConfirmationDialog
                        isOpen={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        onConfirm={handleStatusUpdate}
                        title="Update Order Status"
                        message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                        confirmText="Update Status"
                        loading={updating}
                    />
                </div>

                <ConfirmationDialog
                    isOpen={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={handleStatusUpdate}
                    title="Update Order Status"
                    message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                    confirmText="Update Status"
                    loading={updating}
                />

                {/* Right: Info & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Actions */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Workflow</h3>
                        <div className="space-y-3">
                            {order.status === 'pending' && (
                                <button
                                    onClick={() => requestStatusUpdate('processing')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    Mark as Processing
                                </button>
                            )}
                            {order.status === 'processing' && (
                                <button
                                    onClick={() => handleStatusUpdate('shipped')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-black"
                                >
                                    <Truck className="w-4 h-4 mr-2" />
                                    Mark as Shipped
                                </button>
                            )}
                            {order.status === 'shipped' && (
                                <button
                                    onClick={() => handleStatusUpdate('delivered')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Mark as Delivered
                                </button>
                            )}
                            {['pending', 'processing'].includes(order.status) && (
                                <button
                                    onClick={() => handleStatusUpdate('cancelled')}
                                    disabled={updating}
                                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50"
                                >
                                    Cancel Order
                                </button>
                            )}
                        </div>

                        <ConfirmationDialog
                            isOpen={confirmOpen}
                            onClose={() => setConfirmOpen(false)}
                            onConfirm={handleStatusUpdate}
                            title="Update Order Status"
                            message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                            confirmText="Update Status"
                            loading={updating}
                        />
                    </div>

                    <ConfirmationDialog
                        isOpen={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        onConfirm={handleStatusUpdate}
                        title="Update Order Status"
                        message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                        confirmText="Update Status"
                        loading={updating}
                    />

                    {/* Customer Info */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Customer Details</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-medium text-gray-900">{order.customers?.first_name} {order.customers?.last_name}</p>
                                <p className="text-sm text-gray-500">{order.customers?.email}</p>
                                <p className="text-sm text-gray-500">{order.customers?.phone}</p>
                            </div>

                            <ConfirmationDialog
                                isOpen={confirmOpen}
                                onClose={() => setConfirmOpen(false)}
                                onConfirm={handleStatusUpdate}
                                title="Update Order Status"
                                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                                confirmText="Update Status"
                                loading={updating}
                            />
                        </div>

                        <ConfirmationDialog
                            isOpen={confirmOpen}
                            onClose={() => setConfirmOpen(false)}
                            onConfirm={handleStatusUpdate}
                            title="Update Order Status"
                            message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                            confirmText="Update Status"
                            loading={updating}
                        />
                    </div>

                    <ConfirmationDialog
                        isOpen={confirmOpen}
                        onClose={() => setConfirmOpen(false)}
                        onConfirm={handleStatusUpdate}
                        title="Update Order Status"
                        message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                        confirmText="Update Status"
                        loading={updating}
                    />
                </div>

                <ConfirmationDialog
                    isOpen={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={handleStatusUpdate}
                    title="Update Order Status"
                    message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                    confirmText="Update Status"
                    loading={updating}
                />
            </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleStatusUpdate}
                title="Update Order Status"
                message={`Are you sure you want to mark this order as ${pendingStatus}?`}
                confirmText="Update Status"
                loading={updating}
            />
        </div >
    )
}
