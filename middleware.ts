// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = await createServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname
  console.log(`🔍 [Middleware] Path: ${pathname}`)
  console.log('   User in middleware:', user?.email ?? 'None', error ?? '')

  const protectedRoutes = ['/', '/favorites', '/venue-admin']
  const isProtected = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(`${route}/`)
  )
  const isLogin = pathname === '/login'

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isLogin && user) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/',
    '/favorites',
    '/venue-admin',
    '/venue-admin/(.*)',
    '/api/(.*)',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
