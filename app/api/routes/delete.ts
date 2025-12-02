// app/api/routes/delete/route.ts
import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  // ✅ Typed Supabase instance for SSR context
  const supabase = await createServerClient() as SupabaseClient<Database>

  // ✅ Safely parse body
  const { routeId } = await req.json()

  if (!routeId) {
    return NextResponse.json(
      { success: false, message: "Missing routeId" },
      { status: 400 }
    )
  }

  // ✅ Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    )
  }

  // ✅ Delete route — typed & guarded
  const { error } = await supabase
    .from("saved_routes")
    .delete()
    .eq("id", routeId as string)
    .eq("user_id", user.id as string)

  if (error) {
    console.error("[DELETE route] Error:", error.message)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
