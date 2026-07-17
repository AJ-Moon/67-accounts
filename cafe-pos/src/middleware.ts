import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect all routes under / except for /login and /api
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  const isPublicAsset = request.nextUrl.pathname.match(/\.(.*)$/) // skip generic static extensions

  if (!user && !isLoginPage && !isApiRoute && !isPublicAsset) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // RBAC — route access per role
  // admin: everything | manager: no accounts/users/settings | cashier: billing+orders+KDS | kitchen: KDS only
  const ROUTE_ROLES: Record<string, string[]> = {
    '/accounts':  ['admin'],
    '/ledger':    ['admin'],
    '/users':     ['admin'],
    '/settings':  ['admin'],
    '/dashboard': ['admin', 'manager'],
    '/reports':   ['admin', 'manager'],
    '/menu':      ['admin', 'manager'],
    '/inventory': ['admin', 'manager'],
    '/orders':    ['admin', 'manager', 'cashier'],
    '/kds':       ['admin', 'manager', 'cashier', 'kitchen'],
  }

  if (user && !isApiRoute && !isPublicAsset) {
    const matched = Object.keys(ROUTE_ROLES).find(r => request.nextUrl.pathname.startsWith(r))
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || ''

    if (matched && !ROUTE_ROLES[matched].includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'kitchen' ? '/kds/kitchen' : '/'
      return NextResponse.redirect(url)
    }

    // Kitchen role: keep them on KDS screens (root '/' is the billing screen)
    if (role === 'kitchen' && !request.nextUrl.pathname.startsWith('/kds')) {
      const url = request.nextUrl.clone()
      url.pathname = '/kds/kitchen'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
