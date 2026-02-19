import { getProducts } from '@/lib/actions/product-actions'
import { getCustomers } from '@/lib/actions/order-actions'
import { getSettings } from '@/lib/actions/settings-actions'
import POSShell from '@/components/admin/pos/POSShell'

export default async function POSPage() {
    // Parallel Fetching for Initial Data
    const [productsResult, customers, settings] = await Promise.all([
        getProducts('', 1, 1000), // Fetch many products initially
        getCustomers(),
        getSettings()
    ])

    return (
        <POSShell
            initialProducts={productsResult?.data || []}
            initialCustomers={customers || []}
            settings={settings}
        />
    )
}
