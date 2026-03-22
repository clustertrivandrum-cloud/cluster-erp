'use client'

type PaginationBarProps = {
  page: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
}

const baseButton = 'px-3 py-1 border border-gray-300 rounded-md text-sm font-medium transition'

export default function PaginationBar({ page, totalItems, pageSize = 10, onPageChange }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const hasPrev = safePage > 1
  const hasNext = safePage < totalPages

  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = totalItems === 0 ? 0 : Math.min(totalItems, safePage * pageSize)

  const btnActive = 'text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900'
  const btnDisabled = 'text-gray-400 bg-gray-50 cursor-not-allowed'

  return (
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
      <div className="text-sm text-gray-500">
        {totalItems === 0 ? 'No records' : `Showing ${start}-${end} of ${totalItems}`}
      </div>
      <div className="flex space-x-2">
        <button
          type="button"
          onClick={() => hasPrev && onPageChange(safePage - 1)}
          disabled={!hasPrev}
          className={`${baseButton} ${hasPrev ? btnActive : btnDisabled}`}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => hasNext && onPageChange(safePage + 1)}
          disabled={!hasNext}
          className={`${baseButton} ${hasNext ? btnActive : btnDisabled}`}
        >
          Next
        </button>
      </div>
    </div>
  )
}
