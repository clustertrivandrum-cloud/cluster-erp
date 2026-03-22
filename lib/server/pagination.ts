const DEFAULT_MAX_PAGE_SIZE = 100

type PaginationOptions = {
    page?: number | string | null
    limit?: number | string | null
    defaultLimit?: number
    maxLimit?: number
}

export function getPagination({
    page,
    limit,
    defaultLimit = 20,
    maxLimit = DEFAULT_MAX_PAGE_SIZE,
}: PaginationOptions) {
    const parsedPage = typeof page === 'string' ? Number(page) : page
    const parsedLimit = typeof limit === 'string' ? Number(limit) : limit

    const safePage = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage as number)) : 1
    const requestedLimit = Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit as number) : defaultLimit
    const safeLimit = Math.min(Math.max(1, requestedLimit), maxLimit)
    const from = (safePage - 1) * safeLimit
    const to = from + safeLimit - 1

    return {
        page: safePage,
        limit: safeLimit,
        from,
        to,
    }
}

export function normalizeSearchTerm(value?: string | null, maxLength: number = 100) {
    return (value ?? '').trim().slice(0, maxLength)
}
