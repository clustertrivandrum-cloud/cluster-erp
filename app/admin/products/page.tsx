import Link from 'next/link'
import { getProducts } from '@/lib/actions/product-actions'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: { q?: string; page?: string }
}) {
    const query = searchParams.q || ''
    const currentPage = Number(searchParams.page) || 1
    const limit = 10

    const { data: products, count } = await getProducts(query, currentPage, limit)
    const totalPages = Math.ceil((count || 0) / limit)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Products</h1>
                <Link
                    href="/admin/products/new"
                    className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Product
                </Link>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <form action="/admin/products" method="GET">
                        <input
                            type="text"
                            name="q"
                            defaultValue={query}
                            placeholder="Search products..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                    </form>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {products?.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {/* Placeholder for image */}
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
                                                Img
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{product.title}</div>
                                                <div className="text-sm text-gray-500 truncate max-w-xs">{product.slug}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-800' :
                                            product.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                            {product.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {product.product_type || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {product.vendor || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-2">
                                            <Link href={`/admin/products/${product.id}`} className="text-gray-500 hover:text-gray-900 p-1 hover:bg-gray-100 rounded">
                                                <Edit className="w-5 h-5" />
                                            </Link>
                                            <button className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {products?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No products found. Start by adding one!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex space-x-2">
                            <Link
                                href={`/admin/products?page=${currentPage - 1}&q=${query}`}
                                className={`px-3 py-1 border border-gray-300 rounded-md text-sm font-medium ${currentPage <= 1 ? 'pointer-events-none opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}
                            >
                                Previous
                            </Link>
                            <Link
                                href={`/admin/products?page=${currentPage + 1}&q=${query}`}
                                className={`px-3 py-1 border border-gray-300 rounded-md text-sm font-medium ${currentPage >= totalPages ? 'pointer-events-none opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}
                            >
                                Next
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
