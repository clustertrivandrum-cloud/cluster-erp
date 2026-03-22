import BannerManager from '@/components/admin/banners/BannerManager'
import { getBannerSettings } from '@/lib/actions/banner-actions'
import { requirePagePermission } from '@/lib/auth'

export default async function BannersPage() {
    await requirePagePermission('manage_settings')

    const settings = await getBannerSettings()

    return <BannerManager initialSettings={settings} />
}
