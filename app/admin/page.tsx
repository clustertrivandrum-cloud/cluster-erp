import { createClient } from '@/lib/supabase';

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

            <div className="mt-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
                    <p className="text-gray-500">No recent activity.</p>
                </div>
            </div>

        </div>
    );
}
