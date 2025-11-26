// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient<Database>({ req, res })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname

  const protectedRoutes = ['/', '/favorites']
  const isProtected = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )

  const isLogin = pathname === '/login'

  // 🚫 Block unauthenticated access to protected routes
  if (isProtected && !user) {
    console.warn(`🔒 Redirecting unauthenticated user from ${pathname} to /login`)
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 🚫 Prevent logged-in users from visiting /login
  if (isLogin && user) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
