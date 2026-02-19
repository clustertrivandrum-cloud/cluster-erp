'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getOrder } from '@/lib/actions/order-actions'
import { getSettings } from '@/lib/actions/settings-actions'
import { Printer } from 'lucide-react'

export default function InvoicePage() {
    const params = useParams()
    const [order, setOrder] = useState<any>(null)
    const [settings, setSettings] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (params.id) {
            Promise.all([
                getOrder(params.id as string),
                getSettings()
            ]).then(([orderData, settingsData]) => {
                setOrder(orderData)
                setSettings(settingsData)
                setLoading(false)
            })
        }
    }, [params.id])

    if (loading) return <div className="p-10 text-center">Loading Invoice...</div>
    if (!order) return <div className="p-10 text-center">Order not found</div>

    const subtotal = order.order_items.reduce((sum: number, item: any) => sum + (parseFloat(item.total_price) || 0), 0)
    // Simplify tax logic: Assume total_amount implies tax included or added. 
    // Usually ERPs have nuanced tax lines. keeping it simple: 
    // If settings.tax_rate > 0, we calculated backwards or forwards. 
    // Let's assume Unit Price excludes Tax for B2B/Wholesale or Includes for Retail.
    // For specific display, let's just show Total.
    const taxAmount = (subtotal * (settings?.tax_rate || 0)) / 100
    const grandTotal = order.total_amount // or subtotal + taxAmount depending on business logic

    return (
        <div className="bg-gray-100 min-h-screen p-8 print:p-0 print:bg-white">
            <div className="max-w-4xl mx-auto bg-white shadow-lg p-10 rounded-xl print:shadow-none">

                {/* Print Button (Hidden in Print) */}
                <div className="flex justify-end mb-8 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Print Invoice
                    </button>
                </div>

                {/* Header */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-8 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{settings?.store_name || 'Cluster ERP'}</h1>
                        <p className="text-gray-500 whitespace-pre-line">{settings?.store_address}</p>
                        <p className="text-gray-500 mt-2">GSTIN: {settings?.gstin}</p>
                        <p className="text-gray-500">{settings?.store_email}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-extrabold text-gray-200 tracking-widest uppercase">Invoice</h2>
                        <div className="mt-4">
                            <p className="text-sm text-gray-500">Invoice Number</p>
                            <p className="text-lg font-bold text-gray-900">#{order.order_number}</p>
                        </div>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500">Date Issued</p>
                            <p className="text-lg font-bold text-gray-900">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                {/* Bill To */}
                <div className="mb-8">
                    <div className="w-1/2">
                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Bill To</h3>
                        <p className="text-lg font-bold text-gray-900">{order.customers?.first_name} {order.customers?.last_name}</p>
                        <p className="text-gray-500">{order.customers?.email}</p>
                        <p className="text-gray-500">{order.customers?.phone}</p>
                        {/* Address if available */}
                    </div>
                </div>

                {/* Table */}
                <table className="w-full mb-8">
                    <thead>
                        <tr className="border-b-2 border-gray-200">
                            <th className="text-left py-3 text-sm font-bold text-gray-600 uppercase tracking-wider">Item</th>
                            <th className="text-right py-3 text-sm font-bold text-gray-600 uppercase tracking-wider">Price ({settings?.store_currency})</th>
                            <th className="text-right py-3 text-sm font-bold text-gray-600 uppercase tracking-wider">Qty</th>
                            <th className="text-right py-3 text-sm font-bold text-gray-600 uppercase tracking-wider">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.order_items.map((item: any) => (
                            <tr key={item.id} className="border-b border-gray-100 last:border-0">
                                <td className="py-4">
                                    <p className="font-bold text-gray-900">{item.product_variants?.products?.title}</p>
                                    <p className="text-sm text-gray-500">{item.product_variants?.sku}</p>
                                </td>
                                <td className="py-4 text-right text-gray-900">{item.unit_price}</td>
                                <td className="py-4 text-right text-gray-900">{item.quantity}</td>
                                <td className="py-4 text-right font-bold text-gray-900">{item.total_price}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end border-t border-gray-200 pt-8">
                    <div className="w-1/2 md:w-1/3">
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium text-gray-900">{settings?.store_currency} {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Tax ({settings?.tax_rate}%)</span>
                            <span className="font-medium text-gray-900">Included</span>
                            {/* Simplified tax line */}
                        </div>
                        <div className="flex justify-between pt-4 border-t border-gray-200">
                            <span className="text-xl font-bold text-gray-900">Total</span>
                            <span className="text-xl font-bold text-indigo-600">{settings?.store_currency} {order.total_amount}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
                    <p>Thank you for your business!</p>
                    <p className="mt-1">For any enquiries, please contact {settings?.store_email || 'us'}.</p>
                </div>

            </div>
        </div>
    )
}
