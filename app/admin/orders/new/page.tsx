import { getCustomers } from '@/lib/actions/order-actions'
import NewOrderClient from '@/components/admin/orders/NewOrderClient'

export default async function NewOrderPage() {
  const customersRes = await getCustomers({ page: 1, limit: 20 })
  return <NewOrderClient initialCustomers={customersRes.data || []} />
}
