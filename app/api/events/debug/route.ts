// app/api/events/debug/route.ts

import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"

export async function GET(req: Request) {
  const supabase = await supabaseServerApi()

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      is_active,
      venue:venues (
        id,
        name,
        city,
        slug,
        lat,
        lon
      )
    `
    )

  if (error) {
    console.error("❌ debug fetch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("🐛 debug events:", data)
  return NextResponse.json({ events: data })
}
