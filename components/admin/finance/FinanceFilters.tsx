'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function FinanceFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentPeriod = searchParams.get('period') || 'daily'

    const handlePeriodChange = (period: string) => {
        router.push(`/admin/finance?period=${period}`)
    }

    return (
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            {['daily', 'monthly', 'yearly'].map((period) => (
                <button
                    key={period}
                    onClick={() => handlePeriodChange(period)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${currentPeriod === period
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    {period}
                </button>
            ))}
        </div>
    )
}
