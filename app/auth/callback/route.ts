// app/auth/callback/route.ts
import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server" // ✅ Your SSR helper
import type { Database } from "@/types/supabase"

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get("code")
  const nextPath = searchParams.get("next") ?? "/events"

  if (!code) {
    console.warn("[Auth callback] No code in URL — redirecting to login")
    return NextResponse.redirect(`${origin}/login`)
  }

  // ✅ Prepare redirect response
  const res = NextResponse.redirect(`${origin}${nextPath}`)

  // ✅ Inject response into Supabase client so cookies can persist
  const supabase = await createServerClient(res)

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[Auth callback] exchangeCodeForSession error:", error)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // ✅ Session now stored in browser — user will stay logged in
  return res
}
