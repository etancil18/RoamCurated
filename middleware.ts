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

  /* ------------------------------------------------------------------ */
  /* EXISTING PROTECTED ROUTES (unchanged)                             */
  /* ------------------------------------------------------------------ */
  const protectedRoutes = ['/', '/favorites', '/venue-admin']
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  const isLogin = pathname === '/login'

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLogin && user) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  /* ------------------------------------------------------------------ */
  /* DASH-SPECIFIC LOGIC (surgical addition)                           */
  /* ------------------------------------------------------------------ */
  const isDashRoute = pathname.startsWith('/dash')
  const isDashLogin = pathname === '/dash/login'

  // 🔐 Unauthenticated users cannot access /dash/*
  if (isDashRoute && !isDashLogin && !user) {
    return NextResponse.redirect(new URL('/dash/login', req.url))
  }

  // ✅ Authenticated users should never see /dash/login
  if (isDashLogin && user) {
    return NextResponse.redirect(new URL('/dash/dashboard', req.url))
  }

  // 🔍 Authenticated users accessing /dash/* must be in venue_users
  if (user && isDashRoute && !isDashLogin) {
    const { data: venueUser } = await supabase
      .from('venue_users')
      .select('id')
      .eq('email', user.email ?? '')
      .single()

    if (!venueUser) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/',
    '/favorites',
    '/venue-admin',
    '/venue-admin/(.*)',
    '/dash',
    '/dash/(.*)',
    '/api/(.*)',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
