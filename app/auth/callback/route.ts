// app/auth/callback/route.ts
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"  // your SSR helper
import type { Database } from "@/types/supabase"

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get("code")
  const nextPath = searchParams.get("next") ?? "/"

  if (!code) {
    console.warn("[Auth callback] No code in URL — redirecting to login")
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = await createServerClient()

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[Auth callback] exchangeCodeForSession error:", error)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Optional: log session info for debugging
  console.log("[Auth callback] session:", sessionData.session)

  // Redirect user to intended path after login
  return NextResponse.redirect(`${origin}${nextPath}`)
}
