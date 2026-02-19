'use server'

import { createClient } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getFinancialStats(period: 'daily' | 'monthly' | 'yearly' = 'daily') {
    const supabase = await createClient()

    // Determine Date Range
    const now = new Date()
    let startDate: string | undefined

    if (period === 'daily') {
        const d = new Date()
        d.setDate(d.getDate() - 30) // Last 30 Days
        startDate = d.toISOString()
    } else if (period === 'monthly') {
        const d = new Date()
        d.setFullYear(d.getFullYear() - 1) // Last 12 Months
        startDate = d.toISOString()
    }
    // Yearly = All Time (no start date)

    // 1. Revenue
    let revenueQuery = supabase
        .from('orders')
        .select('grand_total, created_at')
        .eq('financial_status', 'paid')

    if (startDate) revenueQuery = revenueQuery.gte('created_at', startDate)

    const { data: orders, error: orderError } = await revenueQuery
    if (orderError) throw new Error(orderError.message)

    const totalRevenue = orders.reduce((sum, order) => sum + ((order as any).grand_total || 0), 0)

    // 2. Expenses
    let expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date')

    if (startDate) expenseQuery = expenseQuery.gte('expense_date', startDate)

    const { data: expenses, error: expenseError } = await expenseQuery
    if (expenseError) throw new Error(expenseError.message)

    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
    const netProfit = totalRevenue - totalExpenses

    // 3. Grouping Logic
    const chartDataMap = new Map<string, { date: string, revenue: number, expense: number, label: string }>()

    const getGroupKey = (dateStr: string) => {
        const d = new Date(dateStr)
        if (period === 'daily') {
            return {
                key: dateStr.split('T')[0],
                label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            }
        }
        if (period === 'monthly') {
            return {
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
            }
        }
        if (period === 'yearly') {
            return {
                key: `${d.getFullYear()}`,
                label: String(d.getFullYear())
            }
        }
        return { key: dateStr, label: dateStr }
    }

    // Process Orders
    orders.forEach(o => {
        const { key, label } = getGroupKey(o.created_at)
        const current = chartDataMap.get(key) || { date: key, label, revenue: 0, expense: 0 }
        current.revenue += (o as any).grand_total || 0
        chartDataMap.set(key, current)
    })

    // Process Expenses
    expenses.forEach(e => {
        const { key, label } = getGroupKey(String(e.expense_date))
        const current = chartDataMap.get(key) || { date: key, label, revenue: 0, expense: 0 }
        current.expense += e.amount || 0
        chartDataMap.set(key, current)
    })

    // Sort
    const chartData = Array.from(chartDataMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return {
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit: netProfit,
        chartData
    }
}

export async function getExpenses() {
    const supabase = await createClient()
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (error) return { success: false, error: error.message }
    return { success: true, data }
}

export async function createExpense(data: any) {
    const supabase = await createClient()
    const { error } = await supabase.from('expenses').insert(data)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/finance')
    return { success: true }
}

export async function deleteExpense(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/finance')
    return { success: true }
}
