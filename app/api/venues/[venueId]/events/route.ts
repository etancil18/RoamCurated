import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"
import type { EventInsert, Json } from "@/types/supabase"

/**
 * POST /api/venues/[venueId]/events
 * Creates a new event for a specific venue.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ venueId: string }> }
) {
  const { venueId } = await context.params
  const supabase = await supabaseServerApi ()
  const body = await req.json()

  // ✅ Check for authenticated user (RLS-safe)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("❌ Auth error or no user:", authError)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  console.log("✅ Authenticated user:", user.id)

  const validated: EventInsert = {
    venue_id: venueId,
    title: body.title?.trim() ?? null,
    description: body.description?.trim() ?? null,
    tags: body.tags ?? null,
    price_info: body.price_info ?? body.priceInfo ?? null,
    permalink: body.permalink ?? null,
    source: body.source ?? "portal",
    source_type: body.source_type ?? body.sourceType ?? "portal",
    raw_payload: (body.raw_payload ?? body.rawPayload ?? null) as Json | null,
    starts_at: body.starts_at ?? body.startsAt ?? null,
    ends_at: body.ends_at ?? body.endsAt ?? null,
    timezone: body.timezone ?? "America/New_York",
    is_active: body.is_active ?? true,
    created_at: null,
    updated_at: null,
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .insert([validated])
      .select(
        `
        id,
        venue_id,
        title,
        description,
        starts_at,
        ends_at,
        tags,
        price_info,
        source_type,
        source,
        permalink,
        is_active,
        timezone,
        created_at,
        updated_at,
        venue:venues (
          id,
          name,
          slug,
          lat,
          lon,
          city
        )
        `
      )
      .single()

    if (error) {
      console.error("❌ Failed to insert event:", error)
      return NextResponse.json(
        {
          error: "Failed to create event",
          details: error.message,
        },
        { status: 500 }
      )
    }

    console.log("✅ Event created:", data.id)
    return NextResponse.json({ event: data }, { status: 201 })
  } catch (err: any) {
    console.error("❌ Unexpected error creating event:", err)
    return NextResponse.json(
      {
        error: "Unexpected error while creating event",
        details: err.message ?? String(err),
      },
      { status: 500 }
    )
  }
}