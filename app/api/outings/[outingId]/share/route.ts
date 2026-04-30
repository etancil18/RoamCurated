// app/api/outings/[outingId]/share/route.ts

import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"

type Props = {
  params: Promise<{
    outingId: string
  }>
}

type PlannedOutingShareRow = {
  id: string
  user_id: string | null
  event_id: string | null
  city: string | null
  mode: "before" | "after" | "full" | null
  share_enabled: boolean | null
}

export async function POST(_req: Request, context: Props) {
  try {
    const { outingId } = await context.params
    const plannedOutingId = outingId

    if (!plannedOutingId) {
      return NextResponse.json(
        { error: "Missing planned outing id" },
        { status: 400 }
      )
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: outing, error: outingError } = await supabase
      .from("planned_outings")
      .select("id, user_id, event_id, city, mode, share_enabled")
      .eq("id", plannedOutingId)
      .eq("user_id", user.id)
      .single<PlannedOutingShareRow>()

    if (outingError || !outing) {
      return NextResponse.json(
        { error: "Planned outing not found" },
        { status: 404 }
      )
    }

    if (outing.share_enabled !== true) {
      const { error: updateError } = await supabase
        .from("planned_outings")
        .update({ share_enabled: true })
        .eq("id", plannedOutingId)
        .eq("user_id", user.id)

      if (updateError) {
        return NextResponse.json(
          {
            error: "Failed to enable sharing",
            details: updateError.message,
          },
          { status: 500 }
        )
      }
    }

    await supabase.from("planned_outing_events").insert({
      planned_outing_id: plannedOutingId,
      user_id: user.id,
      event_type: "outing_share_enabled",
      metadata: {
        eventId: outing.event_id,
        city: outing.city,
        mode: outing.mode,
        alreadyEnabled: outing.share_enabled === true,
      },
    })

    const sharePath = `/share/outing/${plannedOutingId}`
    const shareUrl = new URL(sharePath, getBaseUrl()).toString()

    return NextResponse.json({
      success: true,
      plannedOutingId,
      sharePath,
      shareUrl,
    })
  } catch (error) {
    console.error("share outing POST error:", error)

    return NextResponse.json(
      { error: "Failed to enable outing sharing" },
      { status: 500 }
    )
  }
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return "http://localhost:3000"
}