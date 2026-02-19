import { getFinancialStats, getExpenses } from '@/lib/actions/finance-actions'
import FinanceCharts from '@/components/admin/finance/FinanceCharts'
import ExpenseList from '@/components/admin/finance/ExpenseList'
import FinanceFilters from '@/components/admin/finance/FinanceFilters'
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react'

// Props type for Server Component pages
type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function FinancePage({ searchParams }: Props) {
    const params = await searchParams
    const period = (params.period as 'daily' | 'monthly' | 'yearly') || 'daily'

    const [stats, expensesRes] = await Promise.all([
        getFinancialStats(period),
        getExpenses()
    ])

    const recentExpenses = expensesRes.success ? expensesRes.data || [] : []

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Finance & Analytics</h1>
                <FinanceFilters />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-50 rounded-xl text-green-600">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Revenue</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">₹{stats.revenue.toLocaleString()}</div>
                    <p className="text-sm text-gray-500 mt-1">Gross sales from all orders</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-red-50 rounded-xl text-red-600">
                            <TrendingDown className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Expenses</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">₹{stats.expenses.toLocaleString()}</div>
                    <p className="text-sm text-gray-500 mt-1">Operational costs + Overheads</p>
                </div>

                <div className="bg-secondary text-white p-6 rounded-2xl shadow-lg shadow-indigo-200 bg-gradient-to-br from-indigo-600 to-indigo-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-white/10 rounded-xl text-white backdrop-blur-sm">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Net Profit</span>
                    </div>
                    <div className="text-3xl font-black text-white">₹{stats.profit.toLocaleString()}</div>
                    <p className="text-sm text-indigo-100 mt-1">Revenue - Expenses</p>
                </div>
            </div>

            {/* Charts & Expense List Split */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left: Charts (2/3 width) */}
                <div className="xl:col-span-2 space-y-6">
                    <FinanceCharts data={stats.chartData} />
                </div>

                {/* Right: Expense List (1/3 width) */}
                <div className="xl:col-span-1">
                    <ExpenseList initialExpenses={recentExpenses} />
                </div>
            </div>
        </div>
    )
}
