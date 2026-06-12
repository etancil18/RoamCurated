import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"
import { normalizeEventArchetypeForStorage } from "@/lib/outings/eventArchetypes"
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
  const supabase = await supabaseServerApi()
  const body = await req.json()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("❌ Auth error or no user:", authError)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  console.log("✅ Authenticated user:", user.id)

  const timezone = body.timezone ?? "America/New_York"
  const archetype = normalizeEventArchetypeForStorage(body.archetype)

  const normalizedTimes = normalizeEventTimes(
    body.starts_at ?? body.startsAt ?? null,
    body.ends_at ?? body.endsAt ?? null
  )

  const checkinEnabled =
    typeof body.checkin_enabled === "boolean"
      ? body.checkin_enabled
      : typeof body.checkinEnabled === "boolean"
        ? body.checkinEnabled
        : true

  const parsedXpReward = Number.parseInt(
    String(body.xp_reward ?? body.xpReward ?? 25),
    10
  )

  const xpReward =
    checkinEnabled && Number.isFinite(parsedXpReward) && parsedXpReward > 0
      ? parsedXpReward
      : 0

  const socialGroupId =
    typeof body.social_group_id === "string" && body.social_group_id.trim().length > 0
      ? body.social_group_id.trim()
      : typeof body.socialGroupId === "string" && body.socialGroupId.trim().length > 0
        ? body.socialGroupId.trim()
        : null

  const validated: EventInsert = {
    venue_id: venueId,
    title: body.title?.trim() ?? null,
    description: body.description?.trim() ?? null,
    tags: body.tags ?? null,
    price_info: body.price_info ?? body.priceInfo ?? null,
    permalink: body.permalink ?? null,
    ticket_link: body.ticket_link ?? body.ticketLink ?? null,
    source: body.source ?? "portal",
    source_type: body.source_type ?? body.sourceType ?? "portal",
    raw_payload: (body.raw_payload ?? body.rawPayload ?? null) as Json | null,
    starts_at: normalizedTimes.starts_at,
    ends_at: normalizedTimes.ends_at,
    timezone,
    is_active: body.is_active ?? true,
    checkin_enabled: checkinEnabled,
    xp_reward: xpReward,
    social_group_id: socialGroupId,
    archetype,
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
        archetype,
        starts_at,
        ends_at,
        tags,
        price_info,
        ticket_link,
        source_type,
        source,
        permalink,
        is_active,
        timezone,
        checkin_enabled,
        xp_reward,
        social_group_id,
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

function normalizeEventTimes(
  startsAtInput: unknown,
  endsAtInput: unknown
): { starts_at: string | null; ends_at: string | null } {
  const startsAt = normalizeDateInput(startsAtInput)
  let endsAt = normalizeDateInput(endsAtInput)

  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000)
  }

  return {
    starts_at: startsAt ? startsAt.toISOString() : null,
    ends_at: endsAt ? endsAt.toISOString() : null,
  }
}

function normalizeDateInput(value: unknown): Date | null {
  if (value == null) return null

  const raw = String(value).trim()
  if (!raw) return null

  const localDateTimeMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )

  if (localDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = localDateTimeMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "0")
    )

    return Number.isNaN(date.getTime()) ? null : date
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}