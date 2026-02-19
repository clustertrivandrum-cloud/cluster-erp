import { createClient } from '@/lib/supabase';

export default async function AdminDashboard() {
    const supabase = await createClient();

    // Example fetch to verify connection
    const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

    const stats = [
        { label: 'Total Products', value: productsCount || 0 },
        { label: 'Total Orders', value: ordersCount || 0 },
        { label: 'Total Users', value: usersCount || 0 },
        { label: 'Revenue', value: '₹0.00' } // Placeholder
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
