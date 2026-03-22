import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRequiredPermissionForPath } from '@/lib/permissions'

export async function middleware(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (request.nextUrl.pathname === '/login' && user) {
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!user) {
            const url = new URL('/login', request.url)
            url.searchParams.set('return_to', request.nextUrl.pathname + request.nextUrl.search)
            return NextResponse.redirect(url)
        }

        const { data: userRecord } = await supabase
            .from('users')
            .select('role_id, is_active')
            .eq('id', user.id)
            .maybeSingle()

        if (!userRecord?.is_active) {
            const url = new URL('/login', request.url)
            url.searchParams.set('return_to', request.nextUrl.pathname + request.nextUrl.search)
            return NextResponse.redirect(url)
        }

        const requiredPermission = getRequiredPermissionForPath(request.nextUrl.pathname)
        if (requiredPermission && userRecord.role_id) {
            const { data: permissionRows } = await supabase
                .from('role_permissions')
                .select(`
                    permission:permissions (
                        key
                    )
                `)
                .eq('role_id', userRecord.role_id)

            const permissionKeys = (permissionRows || [])
                .flatMap((row: { permission: Array<{ key?: string }> | { key?: string } | null }) => {
                    if (Array.isArray(row.permission)) {
                        return row.permission.map((item) => item.key)
                    }

                    return row.permission?.key ? [row.permission.key] : []
                })
                .filter((value): value is string => Boolean(value))

            const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]

            if (!requiredPermissions.some((permission) => permissionKeys.includes(permission))) {
                return NextResponse.redirect(new URL('/admin/unauthorized', request.url))
            }
        }
    }

    // Redirect root to dashboard if logged in, otherwise login
    if (request.nextUrl.pathname === '/') {
        if (user) {
            return NextResponse.redirect(new URL('/admin', request.url))
        } else {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
