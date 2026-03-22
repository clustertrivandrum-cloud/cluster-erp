import { getReviews, updateReviewStatus } from '@/lib/actions/review-actions'
import { CheckCircle, Ban, ShieldAlert } from 'lucide-react'

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    const { status = 'pending' } = await searchParams
    const { data: reviews, error } = await getReviews(status)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
                <div className="flex gap-2">
                    {['pending', 'approved', 'rejected', 'spam'].map((s) => (
                        <a
                            key={s}
                            href={`/admin/reviews?status=${s}`}
                            className={`px-3 py-1 rounded-lg text-sm font-medium border ${status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
                        >
                            {s}
                        </a>
                    ))}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {error && (
                    <div className="px-6 py-4 text-sm text-red-700 bg-red-50 border-b border-red-100">
                        {error}
                    </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rating</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Content</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {reviews.map((review) => (
                            <tr key={review.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900">{review.products?.title || 'Product'}</td>
                                <td className="px-6 py-4 text-sm text-gray-900">{review.rating ?? '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-700 max-w-lg truncate" title={review.body}>{review.body}</td>
                                <td className="px-6 py-4 text-sm capitalize text-gray-700">{review.status}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <form action={updateReviewStatus.bind(null, review.id, 'approved')} className="inline">
                                        <button className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                        </button>
                                    </form>
                                    <form action={updateReviewStatus.bind(null, review.id, 'rejected')} className="inline">
                                        <button className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700">
                                            <ShieldAlert className="w-4 h-4 mr-1" /> Reject
                                        </button>
                                    </form>
                                    <form action={updateReviewStatus.bind(null, review.id, 'spam')} className="inline">
                                        <button className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                                            <Ban className="w-4 h-4 mr-1" /> Spam
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {reviews.length === 0 && !error && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No reviews found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
