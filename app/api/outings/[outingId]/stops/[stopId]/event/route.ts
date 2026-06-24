// app/api/outings/[outingId]/stops/[stopId]/event/route.ts

import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"
import type { Json } from "@/types/supabase"

type StopEventType =
  | "stop_viewed"
  | "stop_started"
  | "stop_completed"
  | "stop_skipped"
  | "stop_swapped"
  | "stop_reordered"

type StopEventRequestBody = {
  eventType?: StopEventType
  position?: number
  dwellTimeSeconds?: number
  metadata?: Json
}

type PlannedOutingRelation =
  | {
      id: string
      user_id: string | null
    }
  | {
      id: string
      user_id: string | null
    }[]
  | null

type PlannedOutingStopRecord = {
  id: string
  planned_outing_id: string
  stop_order: number | null
  role: string | null
  metadata: Json | null
  planned_outing: PlannedOutingRelation
}

const ALLOWED_EVENT_TYPES: StopEventType[] = [
  "stop_viewed",
  "stop_started",
  "stop_completed",
  "stop_skipped",
  "stop_swapped",
  "stop_reordered",
]

export async function POST(
  req: Request,
  context: { params: Promise<{ outingId: string; stopId: string }> }
) {
  try {
    const { outingId, stopId } = await context.params

    const supabase = await supabaseServerApi()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await safeJson(req)) as StopEventRequestBody
    const eventType = normalizeEventType(body.eventType)
    const position = normalizePosition(body.position)
    const dwellTimeSeconds = normalizeDwellTimeSeconds(body.dwellTimeSeconds)
    const metadata = normalizeMetadata(body.metadata)

    if (!eventType) {
      return NextResponse.json(
        { error: "Valid eventType is required" },
        { status: 422 }
      )
    }

    const { data: stopRecord, error: stopError } = await supabase
      .from("planned_outing_stops")
      .select(
        `
          id,
          planned_outing_id,
          stop_order,
          role,
          metadata,
          planned_outing:planned_outings (
            id,
            user_id
          )
        `
      )
      .eq("id", stopId)
      .eq("planned_outing_id", outingId)
      .single<PlannedOutingStopRecord>()

    if (stopError || !stopRecord) {
      return NextResponse.json(
        { error: "Planned outing stop not found" },
        { status: 404 }
      )
    }

    const outingRelation = normalizeOutingRelation(stopRecord.planned_outing)

    if (!outingRelation || outingRelation.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const insertPayload = {
      planned_outing_id: outingId,
      planned_outing_stop_id: stopId,
      user_id: user.id,
      event_type: eventType,
      position: position ?? stopRecord.stop_order ?? null,
      dwell_time_seconds: dwellTimeSeconds,
      metadata: mergeStopArchetypeMetadata({
        requestMetadata: metadata,
        stopMetadata: stopRecord.metadata,
        stopRole: stopRecord.role,
      }),
    }

    const { data: insertedEvent, error: insertError } = await supabase
      .from("planned_outing_stop_events")
      .insert(insertPayload)
      .select(
        `
          id,
          planned_outing_id,
          planned_outing_stop_id,
          user_id,
          event_type,
          position,
          dwell_time_seconds,
          metadata,
          created_at
        `
      )
      .single()

    if (insertError) {
      const isUniqueViolation = insertError.code === "23505"

      if (isUniqueViolation) {
        return NextResponse.json(
          {
            success: true,
            duplicate: true,
            message: "Stop event already recorded",
          },
          { status: 200 }
        )
      }

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      event: insertedEvent,
    })
  } catch (error) {
    console.error("stop event POST error:", error)
    return NextResponse.json(
      { error: "Failed to record stop event" },
      { status: 500 }
    )
  }
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function normalizeEventType(value?: string): StopEventType | null {
  if (!value) return null
  return ALLOWED_EVENT_TYPES.includes(value as StopEventType)
    ? (value as StopEventType)
    : null
}

function normalizePosition(value?: number): number | null {
  if (!Number.isFinite(value)) return null
  const n = Math.floor(Number(value))
  return n >= 1 ? n : null
}

function normalizeDwellTimeSeconds(value?: number): number | null {
  if (!Number.isFinite(value)) return null
  const n = Math.floor(Number(value))
  return n >= 0 ? n : null
}

function normalizeMetadata(value?: Json): Json {
  if (value == null) return {}
  return value
}

function normalizeOutingRelation(outing: PlannedOutingRelation) {
  if (!outing) return null
  return Array.isArray(outing) ? outing[0] ?? null : outing
}

function mergeStopArchetypeMetadata({
  requestMetadata,
  stopMetadata,
  stopRole,
}: {
  requestMetadata: Json
  stopMetadata: Json | null
  stopRole: string | null
}): Json {
  const requestObject = jsonObject(requestMetadata)
  const stopObject = jsonObject(stopMetadata)

  return {
    ...requestObject,
    eventArchetype:
      requestObject.eventArchetype ?? stopObject.eventArchetype ?? null,
    semanticRole:
      requestObject.semanticRole ?? stopObject.semanticRole ?? null,
    slotPhase:
      requestObject.slotPhase ?? stopObject.slotPhase ?? stopObject.phase ?? null,
    slotIndex:
      requestObject.slotIndex ?? stopObject.slotIndex ?? null,
    phase:
      requestObject.phase ?? stopObject.phase ?? null,
    role:
      requestObject.role ?? stopRole ?? null,
    venueType:
      requestObject.venueType ?? stopObject.venueType ?? null,
    displayType:
      requestObject.displayType ?? stopObject.displayType ?? null,
    selectedPass:
      requestObject.selectedPass ?? stopObject.selectedPass ?? null,
  } as Json
}

function jsonObject(value: Json | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}