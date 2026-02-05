// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"

export async function middleware(req: NextRequest) {
  // We use NextResponse.next() so we can return it later (response remains mutable)
  const res = NextResponse.next()

  // Create a Supabase server client using request cookies
  const supabase = await createServerClient(res)

  // Get the session from cookies
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  const user = session?.user ?? null

  const pathname = req.nextUrl.pathname
  console.log(`🔍 [Middleware] Path: ${pathname}`)
  console.log("   User session:", user?.email ?? "None", error ? error.message : "")

  /* ------------------------------------------------------------------ */
  /* PROTECTED ROUTES                                                    */
  /* ------------------------------------------------------------------ */
  const protectedRoutes = ["/", "/favorites", "/venue-admin"]
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  const isLogin = pathname === "/login"

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLogin && user) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  /* ------------------------------------------------------------------ */
  /* DASH ROUTES                                                         */
  /* ------------------------------------------------------------------ */
  const isDashRoute = pathname.startsWith("/dash")
  const isDashLogin = pathname === "/dash/login"

  if (isDashRoute && !isDashLogin && !user) {
    return NextResponse.redirect(new URL("/dash/login", req.url))
  }

  if (isDashLogin && user) {
    return NextResponse.redirect(new URL("/dash/dashboard", req.url))
  }

  if (user && isDashRoute && !isDashLogin) {
    const { data: venueUser, error: dashErr } = await supabase
      .from("venue_users")
      .select("id")
      .eq("email", user.email ?? "")
      .maybeSingle()

    if (dashErr || !venueUser) {
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Return the mutable response
  return res
}

export const config = {
  matcher: [
    "/",
    "/favorites",
    "/venue-admin",
    "/venue-admin/(.*)",
    "/dash",
    "/dash/(.*)",
    // Only protect API routes if needed:
    // '/api/(.*)',
  ],
}