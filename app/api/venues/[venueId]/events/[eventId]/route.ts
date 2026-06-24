// app/api/venues/[venueId]/events/[eventId]/route.ts

import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"
import { normalizeEventArchetypeForStorage } from "@/lib/outings/eventArchetypes"
import type { EventUpdate, Json } from "@/types/supabase"

type RouteContext = {
  params: Promise<{
    venueId: string
    eventId: string
  }>
}

/**
 * PUT /api/venues/[venueId]/events/[eventId]
 * Updates an existing event for a specific venue.
 */
export async function PUT(req: Request, context: RouteContext) {
  const { venueId, eventId } = await context.params
  const supabase = await supabaseServerApi()

  if (!venueId || !eventId) {
    return NextResponse.json(
      { error: "Missing venueId or eventId" },
      { status: 400 }
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const normalizedTimes = normalizeEventTimes(
    body.starts_at ?? body.startsAt ?? null,
    body.ends_at ?? body.endsAt ?? null
  )

  const hasCheckinEnabled =
    typeof body.checkin_enabled === "boolean" ||
    typeof body.checkinEnabled === "boolean"

  const checkinEnabled =
    typeof body.checkin_enabled === "boolean"
      ? body.checkin_enabled
      : typeof body.checkinEnabled === "boolean"
        ? body.checkinEnabled
        : undefined

  const parsedXpReward = Number.parseInt(
    String(body.xp_reward ?? body.xpReward ?? 25),
    10
  )

  const xpReward =
    hasCheckinEnabled && checkinEnabled === false
      ? 0
      : Number.isFinite(parsedXpReward) && parsedXpReward > 0
        ? parsedXpReward
        : undefined

  const socialGroupId =
    typeof body.social_group_id === "string" && body.social_group_id.trim().length > 0
      ? body.social_group_id.trim()
      : typeof body.socialGroupId === "string" && body.socialGroupId.trim().length > 0
        ? body.socialGroupId.trim()
        : body.social_group_id === null || body.socialGroupId === null
          ? null
          : undefined

  const updatePayload: EventUpdate = {
    title:
      typeof body.title === "string" && body.title.trim().length > 0
        ? body.title.trim()
        : null,
    description:
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null,
    archetype: normalizeEventArchetypeForStorage(body.archetype),
    tags: normalizeTags(body.tags),
    price_info: body.price_info ?? body.priceInfo ?? null,
    permalink: body.permalink ?? null,
    ticket_link: body.ticket_link ?? body.ticketLink ?? null,
    source: body.source ?? "portal",
    source_type: body.source_type ?? body.sourceType ?? "portal",
    raw_payload: (body.raw_payload ?? body.rawPayload ?? null) as Json | null,
    starts_at: normalizedTimes.starts_at,
    ends_at: normalizedTimes.ends_at,
    timezone: body.timezone ?? "America/New_York",
    is_active: body.is_active ?? true,
    updated_at: new Date().toISOString(),
  }

  if (hasCheckinEnabled && typeof checkinEnabled === "boolean") {
    updatePayload.checkin_enabled = checkinEnabled
  }

  if (typeof xpReward === "number") {
    updatePayload.xp_reward = xpReward
  }

  if (socialGroupId !== undefined) {
    updatePayload.social_group_id = socialGroupId
  }

  const { data, error } = await supabase
    .from("events")
    .update(updatePayload)
    .eq("id", eventId)
    .eq("venue_id", venueId)
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
    return NextResponse.json(
      { error: "Failed to update event", details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ event: data })
}

/**
 * DELETE /api/venues/[venueId]/events/[eventId]
 * Soft-archives an event.
 */
export async function DELETE(_req: Request, context: RouteContext) {
  const { venueId, eventId } = await context.params
  const supabase = await supabaseServerApi()

  if (!venueId || !eventId) {
    return NextResponse.json(
      { error: "Missing venueId or eventId" },
      { status: 400 }
    )
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { error } = await supabase
    .from("events")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("venue_id", venueId)

  if (error) {
    return NextResponse.json(
      { error: "Failed to archive event", details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}

function normalizeTags(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const tags = value
      .map((tag) => String(tag).trim())
      .filter(Boolean)

    return tags.length > 0 ? tags : null
  }

  if (typeof value === "string") {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

    return tags.length > 0 ? tags : null
  }

  return null
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