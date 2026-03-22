'use client'

import { useMemo, useState, useTransition } from 'react'
import { BadgePercent, Plus, Power, Save, Search, Trash2 } from 'lucide-react'
import type { CouponInput, CouponRow } from '@/lib/actions/coupon-actions'
import { deleteCoupon, saveCoupon, toggleCouponStatus } from '@/lib/actions/coupon-actions'
import Input from '@/components/ui/Input'

type CouponManagerProps = {
    initialCoupons: CouponRow[]
}

type CouponFormState = {
    id?: string
    code: string
    description: string
    discountType: 'percentage' | 'fixed'
    discountValue: string
    minOrderValue: string
    maxDiscount: string
    usageLimit: string
    isActive: boolean
    startsAt: string
    expiresAt: string
}

const emptyForm: CouponFormState = {
    code: '',
    description: '',
    discountType: 'fixed',
    discountValue: '',
    minOrderValue: '0',
    maxDiscount: '',
    usageLimit: '',
    isActive: true,
    startsAt: '',
    expiresAt: '',
}

function toDateTimeLocal(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const offset = date.getTimezoneOffset()
    const adjusted = new Date(date.getTime() - offset * 60_000)
    return adjusted.toISOString().slice(0, 16)
}

function toUtcISOString(value: string) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
}

const scheduleFormatter = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
})

function formatScheduleDate(value: string | null) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return scheduleFormatter.format(date)
}

function toFormState(coupon?: CouponRow | null): CouponFormState {
    if (!coupon) return emptyForm

    return {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description || '',
        discountType: coupon.discount_type,
        discountValue: String(coupon.discount_value ?? ''),
        minOrderValue: String(coupon.min_order_value ?? 0),
        maxDiscount: coupon.max_discount === null ? '' : String(coupon.max_discount),
        usageLimit: coupon.usage_limit === null ? '' : String(coupon.usage_limit),
        isActive: coupon.is_active,
        startsAt: toDateTimeLocal(coupon.starts_at),
        expiresAt: toDateTimeLocal(coupon.expires_at),
    }
}

function formatSchedule(coupon: CouponRow) {
    if (!coupon.starts_at && !coupon.expires_at) return 'Always active'
    const start = formatScheduleDate(coupon.starts_at) || 'Immediately'
    const end = formatScheduleDate(coupon.expires_at) || 'No expiry'
    return `${start} -> ${end}`
}

export default function CouponManager({ initialCoupons }: CouponManagerProps) {
    const [coupons, setCoupons] = useState(initialCoupons)
    const [query, setQuery] = useState('')
    const [form, setForm] = useState<CouponFormState>(emptyForm)
    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    const filteredCoupons = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        if (!normalized) return coupons

        return coupons.filter((coupon) =>
            coupon.code.toLowerCase().includes(normalized) ||
            (coupon.description || '').toLowerCase().includes(normalized)
        )
    }, [coupons, query])

    const selectedCoupon = coupons.find((coupon) => coupon.id === form.id) || null

    const handleEdit = (coupon: CouponRow) => {
        setForm(toFormState(coupon))
        setFeedback(null)
    }

    const handleCreateNew = () => {
        setForm(emptyForm)
        setFeedback(null)
    }

    const handleSave = () => {
        setFeedback(null)

        startTransition(async () => {
            const payload: CouponInput = {
                id: form.id,
                code: form.code,
                description: form.description,
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                minOrderValue: Number(form.minOrderValue || 0),
                maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
                usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
                isActive: form.isActive,
                startsAt: toUtcISOString(form.startsAt),
                expiresAt: toUtcISOString(form.expiresAt),
            }

            const result = await saveCoupon(payload)
            if (!result.success) {
                setFeedback({ tone: 'error', text: result.error || 'Could not save coupon.' })
                return
            }

            const saved = result.data
            if (saved) {
                setCoupons((current) => {
                    const withoutOld = current.filter((coupon) => coupon.id !== saved.id)
                    return [saved, ...withoutOld]
                })
                setForm(toFormState(saved))
            }

            setFeedback({ tone: 'success', text: form.id ? 'Coupon updated.' : 'Coupon created.' })
        })
    }

    const handleToggle = (coupon: CouponRow) => {
        setFeedback(null)
        startTransition(async () => {
            const nextActive = !coupon.is_active
            const result = await toggleCouponStatus(coupon.id, nextActive)
            if (!result.success) {
                setFeedback({ tone: 'error', text: result.error || 'Could not update coupon status.' })
                return
            }

            setCoupons((current) => current.map((item) => item.id === coupon.id ? { ...item, is_active: nextActive } : item))
            if (form.id === coupon.id) {
                setForm((current) => ({ ...current, isActive: nextActive }))
            }
            setFeedback({ tone: 'success', text: `Coupon ${nextActive ? 'activated' : 'paused'}.` })
        })
    }

    const handleDelete = (coupon: CouponRow) => {
        if (!window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) return

        setFeedback(null)
        startTransition(async () => {
            const result = await deleteCoupon(coupon.id)
            if (!result.success) {
                setFeedback({ tone: 'error', text: result.error || 'Could not delete coupon.' })
                return
            }

            setCoupons((current) => current.filter((item) => item.id !== coupon.id))
            if (form.id === coupon.id) {
                setForm(emptyForm)
            }
            setFeedback({ tone: 'success', text: 'Coupon deleted.' })
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
                    <p className="text-sm text-gray-500">Create storefront discount codes, manage limits, and control their availability.</p>
                </div>
                <button
                    type="button"
                    onClick={handleCreateNew}
                    className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-black transition-colors"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Coupon
                </button>
            </div>

            {feedback ? (
                <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                    {feedback.text}
                </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 p-4">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search code or description..."
                                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-5 py-3">Coupon</th>
                                    <th className="px-5 py-3">Discount</th>
                                    <th className="px-5 py-3">Usage</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredCoupons.map((coupon) => (
                                    <tr
                                        key={coupon.id}
                                        className={`transition-colors hover:bg-gray-50 ${selectedCoupon?.id === coupon.id ? 'bg-gray-50' : ''}`}
                                    >
                                        <td className="px-5 py-4 align-top">
                                            <div className="font-semibold text-gray-900">{coupon.code}</div>
                                            <div className="mt-1 text-xs text-gray-500">{coupon.description || 'No description'}</div>
                                            <div className="mt-2 text-xs text-gray-400">{formatSchedule(coupon)}</div>
                                        </td>
                                        <td className="px-5 py-4 align-top text-sm text-gray-700">
                                            {coupon.discount_type === 'percentage'
                                                ? `${coupon.discount_value}% off`
                                                : `₹${coupon.discount_value} off`}
                                            {coupon.max_discount ? (
                                                <div className="mt-1 text-xs text-gray-500">Max ₹{coupon.max_discount}</div>
                                            ) : null}
                                            <div className="mt-1 text-xs text-gray-500">Min order ₹{coupon.min_order_value}</div>
                                        </td>
                                        <td className="px-5 py-4 align-top text-sm text-gray-700">
                                            <div>{coupon.used_count} used</div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                {coupon.usage_limit ? `${coupon.usage_limit} max` : 'Unlimited'}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${coupon.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {coupon.is_active ? 'Active' : 'Paused'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(coupon)}
                                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggle(coupon)}
                                                    disabled={isPending}
                                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    <Power className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(coupon)}
                                                    disabled={isPending}
                                                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCoupons.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">
                                            No coupons found.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 p-5">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-gray-100 p-2">
                                <BadgePercent className="h-5 w-5 text-gray-700" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Edit Coupon' : 'Create Coupon'}</h2>
                                <p className="text-sm text-gray-500">Codes are stored uppercase and used on the ecommerce checkout.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5 p-5">
                        <Input
                            label="Coupon Code"
                            value={form.code}
                            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                            placeholder="WELCOME10"
                        />

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                rows={3}
                                className="block w-full rounded-lg border-[1.5px] border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                placeholder="Visible only in admin. Explain what the coupon is for."
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">Discount Type</label>
                                <select
                                    value={form.discountType}
                                    onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as 'percentage' | 'fixed' }))}
                                    className="block w-full rounded-lg border-[1.5px] border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                >
                                    <option value="fixed">Fixed amount</option>
                                    <option value="percentage">Percentage</option>
                                </select>
                            </div>
                            <Input
                                label={form.discountType === 'percentage' ? 'Discount Percent' : 'Discount Amount'}
                                type="number"
                                value={form.discountValue}
                                onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
                                placeholder={form.discountType === 'percentage' ? '10' : '100'}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Minimum Order Value"
                                type="number"
                                value={form.minOrderValue}
                                onChange={(event) => setForm((current) => ({ ...current, minOrderValue: event.target.value }))}
                                placeholder="0"
                            />
                            <Input
                                label="Max Discount"
                                type="number"
                                value={form.maxDiscount}
                                onChange={(event) => setForm((current) => ({ ...current, maxDiscount: event.target.value }))}
                                placeholder={form.discountType === 'percentage' ? '500' : 'Optional'}
                                helperText="Useful for percentage coupons."
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Usage Limit"
                                type="number"
                                value={form.usageLimit}
                                onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))}
                                placeholder="Leave blank for unlimited"
                            />
                            <div className="flex items-end">
                                <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                                    />
                                    Coupon is active
                                </label>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">Start Date</label>
                                <input
                                    type="datetime-local"
                                    value={form.startsAt}
                                    onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                                    className="block w-full rounded-lg border-[1.5px] border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">Expiry Date</label>
                                <input
                                    type="datetime-local"
                                    value={form.expiresAt}
                                    onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                                    className="block w-full rounded-lg border-[1.5px] border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/25"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-4">
                        <button
                            type="button"
                            onClick={handleCreateNew}
                            className="text-sm font-medium text-gray-500 hover:text-gray-900"
                        >
                            Reset form
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isPending}
                            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {isPending ? 'Saving...' : form.id ? 'Update Coupon' : 'Create Coupon'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
