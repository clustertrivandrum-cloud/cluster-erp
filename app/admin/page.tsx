import { createClient } from '@/lib/supabase';
import { Package, ShoppingBag, User, TrendingUp, Activity } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
    const supabase = await createClient();
    const { data: dashboardRows, error: dashboardError } = await supabase.rpc('get_admin_dashboard_summary')

    let productsCount = 0
    let ordersCount = 0
    let usersCount = 0
    let revenueTotal = 0

    if (!dashboardError && Array.isArray(dashboardRows) && dashboardRows[0]) {
        productsCount = Number(dashboardRows[0].products_count || 0)
        ordersCount = Number(dashboardRows[0].orders_count || 0)
        usersCount = Number(dashboardRows[0].users_count || 0)
        revenueTotal = Number(dashboardRows[0].revenue_ytd || 0)
    } else {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString()
        const [
            { count: fallbackProductsCount },
            { count: fallbackOrdersCount },
            { count: fallbackUsersCount },
            { data: revenueRows },
        ] = await Promise.all([
            supabase.from('products').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase
                .from('orders')
                .select('*')
                .gte('created_at', startOfYear),
        ])

        productsCount = fallbackProductsCount || 0
        ordersCount = fallbackOrdersCount || 0
        usersCount = fallbackUsersCount || 0
        revenueTotal = (revenueRows || []).reduce((sum, row) => {
            const status = String(row.payment_status ?? row.financial_status ?? '').toLowerCase()
            if (status !== 'paid') {
                return sum
            }

            return sum + (Number(row.total_amount ?? row.grand_total) || 0)
        }, 0)
    }

    // Fetch Recent Activity (Parallel)
    const [
        { data: recentOrders },
        { data: recentUsers },
        { data: recentProducts }
    ] = await Promise.all([
        supabase.from('orders').select('id, created_at, grand_total, total_amount, payment_status, financial_status, reference, order_number').order('created_at', { ascending: false }).limit(5),
        supabase.from('users').select('id, created_at, first_name, last_name, email').order('created_at', { ascending: false }).limit(5),
        supabase.from('products').select('id, created_at, title').order('created_at', { ascending: false }).limit(5)
    ])

    const activities = [
        ...(recentOrders || []).map(o => ({
            id: `order_${o.id}`,
            type: 'order',
            title: `Order ${o.order_number || o.reference || `#${o.id.substring(0, 6)}`} placed`,
            description: `Amount: ₹${Number(o.grand_total ?? o.total_amount ?? 0).toFixed(2)} (${o.payment_status || o.financial_status || 'Pending'})`,
            date: o.created_at,
            Icon: ShoppingBag,
            bgColor: 'bg-emerald-100',
            iconColor: 'text-emerald-600'
        })),
        ...(recentUsers || []).map(u => ({
            id: `user_${u.id}`,
            type: 'user',
            title: `New Customer: ${u.first_name || ''} ${u.last_name || ''}`.trim() || 'New Customer',
            description: u.email || 'Registered',
            date: u.created_at,
            Icon: User,
            bgColor: 'bg-blue-100',
            iconColor: 'text-blue-600'
        })),
        ...(recentProducts || []).map(p => ({
            id: `product_${p.id}`,
            type: 'product',
            title: `New Product: ${p.title}`,
            description: 'Added to catalog',
            date: p.created_at,
            Icon: Package,
            bgColor: 'bg-purple-100',
            iconColor: 'text-purple-600'
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 7);


    const stats = [
        { label: 'Total Products', value: productsCount },
        { label: 'Total Orders', value: ordersCount },
        { label: 'Total Users', value: usersCount },
        { label: 'Revenue (YTD)', value: `₹${revenueTotal.toFixed(2)}` }
    ];

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                        <p className="text-2xl font-semibold text-gray-900 mt-2">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mt-8">
                {/* Analytics / Charts Area */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-900">Revenue Analytics</h3>
                            <select className="bg-gray-50 border border-gray-200 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-gray-900 focus:border-gray-900 text-gray-600">
                                <option>Last 30 Days</option>
                                <option>This Year</option>
                                <option>All Time</option>
                            </select>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <TrendingUp className="w-10 h-10 mb-3 text-gray-300" />
                            <p className="font-semibold text-gray-500">Detailed Analytics Coming Soon</p>
                            <p className="text-sm mt-1 max-w-sm text-center">Interactive charts for revenue trends and top selling products will appear here.</p>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[400px] overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-gray-400" />
                            Recent Activity
                        </h3>
                        <Link href="/admin/orders" className="text-sm font-bold text-gray-900 hover:underline">View All</Link>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 space-y-6">
                        {activities.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-8">No recent activity found.</p>
                        ) : (
                            activities.map((act) => (
                                <div key={act.id} className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${act.bgColor}`}>
                                        <act.Icon className={`w-5 h-5 ${act.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <p className="text-sm font-bold text-gray-900 truncate">{act.title}</p>
                                        <p className="text-xs font-medium text-gray-500 truncate mt-0.5">{act.description}</p>
                                    </div>
                                    <div className="text-[11px] font-bold text-gray-400 whitespace-nowrap pt-1">
                                        {new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}
