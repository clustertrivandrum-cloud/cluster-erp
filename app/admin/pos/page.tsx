import { getPosCategories, getPosProducts } from '@/lib/actions/pos-actions'
import { getCustomers } from '@/lib/actions/order-actions'
import { getSettings } from '@/lib/actions/settings-actions'
import POSShell from '@/components/admin/pos/POSShell'

export default async function POSPage() {
    // Parallel Fetching for Initial Data
    const [productsResult, categories, customersRes, settings] = await Promise.all([
        getPosProducts({ page: 1, limit: 48 }),
        getPosCategories(),
        getCustomers({ page: 1, limit: 20 }),
        getSettings()
    ])

    return (
        <POSShell
            initialProducts={productsResult?.data || []}
            categories={categories}
            initialCustomers={customersRes?.data || []}
            settings={settings}
        />
    )
}
