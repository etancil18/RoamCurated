// utils/supabase/middlewareClient.ts
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/types/supabase"
import type { NextRequest, NextResponse } from "next/server"

export async function initAuth(
  req: NextRequest,
  res: NextResponse
): Promise<NextResponse> {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // trigger session refresh / validation
  await supabase.auth.getSession()

  // Return the response — Supabase modifies cookies on internal response,
  // so we need to return that to propagate cookie changes to client
  return res
}
