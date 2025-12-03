// app/api/events/[eventId]/interest/route.ts

import { supabaseServerApi } from "@/lib/supabase/server-api"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params

  const supabase = await supabaseServerApi()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 🛠 Fetch event to get venue_id and city
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("venue_id, venue:venues(city)")
    .eq("id", eventId)
    .single()

  if (fetchError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const venueId = event.venue_id ?? null
  const city = event.venue?.city ?? null

  const { error: insertError } = await supabase
    .from("event_interests")
    .insert({
      event_id: eventId,
      user_id: user.id,
      venue_id: venueId,
      city,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params

  const supabase = await supabaseServerApi()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("event_interests")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
