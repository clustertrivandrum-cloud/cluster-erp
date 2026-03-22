'use server'

import { requireActionPermission } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export type FinanceChartPoint = {
    date: string
    label: string
    revenue: number
    expense: number
}

type FinancialOrder = {
    created_at: string
    payment_status?: string | null
    financial_status?: string | null
    total_amount?: number | string | null
    grand_total?: number | string | null
}

type ExpenseInput = {
    title: string
    amount: string | number
    category: string
    description?: string
    expense_date: string
}

function getOrderAmount(order: FinancialOrder) {
    const amount = order.total_amount ?? order.grand_total ?? 0
    const parsedAmount = typeof amount === 'number' ? amount : Number(amount)
    return Number.isFinite(parsedAmount) ? parsedAmount : 0
}

function isPaidOrder(order: FinancialOrder) {
    const status = (order.payment_status ?? order.financial_status ?? '').toLowerCase()
    return status === 'paid'
}

async function getFinancialStatsFallback(period: 'daily' | 'monthly' | 'yearly', supabase: Awaited<ReturnType<typeof createClient>>) {
    let startDate: string | undefined

    if (period === 'daily') {
        const d = new Date()
        d.setDate(d.getDate() - 30)
        startDate = d.toISOString()
    } else if (period === 'monthly') {
        const d = new Date()
        d.setFullYear(d.getFullYear() - 1)
        startDate = d.toISOString()
    }

    let revenueQuery = supabase
        .from('orders')
        .select('*')

    if (startDate) revenueQuery = revenueQuery.gte('created_at', startDate)

    const { data: orderRows, error: orderError } = await revenueQuery
    if (orderError) throw new Error(orderError.message)
    const orders = (orderRows ?? []) as FinancialOrder[]
    const paidOrders = orders.filter(isPaidOrder)
    const totalRevenue = paidOrders.reduce((sum, order) => sum + getOrderAmount(order), 0)

    let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date')

    if (startDate) expenseQuery = expenseQuery.gte('expense_date', startDate)

    const { data: expenseRows, error: expenseError } = await expenseQuery
    if (expenseError) throw new Error(expenseError.message)
    const expenses = expenseRows ?? []
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

    const chartDataMap = new Map<string, FinanceChartPoint>()

    const getGroupKey = (dateStr: string) => {
        const d = new Date(dateStr)
        if (period === 'daily') {
            return {
                key: dateStr.split('T')[0],
                label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            }
        }
        if (period === 'monthly') {
            return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
            }
        }
        return {
            key: `${d.getFullYear()}`,
            label: String(d.getFullYear()),
        }
    }

    paidOrders.forEach((order) => {
        const { key, label } = getGroupKey(order.created_at)
        const current = chartDataMap.get(key) || { date: key, label, revenue: 0, expense: 0 }
        current.revenue += getOrderAmount(order)
        chartDataMap.set(key, current)
    })

    expenses.forEach((expense) => {
        const { key, label } = getGroupKey(String(expense.expense_date))
        const current = chartDataMap.get(key) || { date: key, label, revenue: 0, expense: 0 }
        current.expense += expense.amount || 0
        chartDataMap.set(key, current)
    })

    const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: totalRevenue - totalExpenses,
        chartData,
    }
}

export async function getFinancialStats(period: 'daily' | 'monthly' | 'yearly' = 'daily') {
    await requireActionPermission('manage_finance')
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_financial_chart', { p_period: period })

    if (!error && Array.isArray(data)) {
        const chartData = data.map((row) => ({
            date: String(row.date_key),
            label: String(row.label),
            revenue: Number(row.revenue || 0),
            expense: Number(row.expense || 0),
        })) as FinanceChartPoint[]

        const revenue = chartData.reduce((sum, row) => sum + row.revenue, 0)
        const expenses = chartData.reduce((sum, row) => sum + row.expense, 0)

        return {
            revenue,
            expenses,
            profit: revenue - expenses,
            chartData,
        }
    }

    console.warn('Falling back to app-side financial aggregation:', error?.message)
    return getFinancialStatsFallback(period, supabase)
}

export async function getExpenses() {
    await requireActionPermission('manage_finance')
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('expenses')
        .select('id, title, amount, category, expense_date')
        .order('expense_date', { ascending: false })
        .limit(50)
    if (error) return { success: false, error: error.message }
    return { success: true, data }
}

export async function createExpense(data: ExpenseInput) {
    await requireActionPermission('manage_finance')
    const supabase = await createClient()
    const { error } = await supabase.from('expenses').insert(data)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/finance')
    return { success: true }
}

export async function deleteExpense(id: string) {
    await requireActionPermission('manage_finance')
    const supabase = await createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/finance')
    return { success: true }
}
