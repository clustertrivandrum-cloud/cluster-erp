import CouponManager from '@/components/admin/coupons/CouponManager'
import { requirePagePermission } from '@/lib/auth'
import { getCoupons } from '@/lib/actions/coupon-actions'

export default async function CouponsPage() {
    await requirePagePermission('manage_settings')

    const { data, error } = await getCoupons()

    if (error) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
            </div>
        )
    }

    return <CouponManager initialCoupons={data} />
}
