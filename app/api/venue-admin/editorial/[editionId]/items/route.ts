
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = {
  params: Promise<{ editionId: string }>
}

type ItemBody = Record<string, unknown>

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ITEM_SELECT = `
  id,
  edition_id,
  venue_id,
  source_collection_item_id,
  origin,
  position,
  display_title,
  editorial_blurb,
  badge,
  image_override_url,
  created_at,
  updated_at
`

type ItemRow = {
  id: string
  edition_id: string
  venue_id: string
  source_collection_item_id: string | null
  origin: string
  position: number
  display_title: string | null
  editorial_blurb: string | null
  badge: string | null
  image_override_url: string | null
  created_at: string
  updated_at: string
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
  cover: string | null
  // OPTION C — CANONICAL VENUE DESCRIPTION
  description: string | null
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function isRecord(
  value: unknown,
): value is ItemBody {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UUID_PATTERN.test(value)
  )
}

function readOptionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const normalized = value.trim()

  if (normalized.length > maxLength) return undefined

  return normalized || null
}

async function getEditionStatus(editionId: string) {
  const { data, error } = await supabaseAdmin
    .from('roam_editorial_editions')
    .select('id, status')
    .eq('id', editionId)
    .maybeSingle()

  if (error) throw error

  return data
}

async function loadItems(editionId: string) {
  const { data, error } = await supabaseAdmin
    .from('roam_editorial_edition_items')
    .select(ITEM_SELECT)
    .eq('edition_id', editionId)
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error

  const items = (data ?? []) as ItemRow[]
  const venueIds = [...new Set(items.map((item) => item.venue_id))]

  let venues: VenueRow[] = []

  if (venueIds.length > 0) {
    const result = await supabaseAdmin
      .from('venues')
      // OPTION C — INCLUDE EXISTING VENUE DESCRIPTION
      .select('id, name, city, cover, description')
      .in('id', venueIds)

    if (result.error) throw result.error

    venues = (result.data ?? []) as VenueRow[]
  }

  const venueMap = new Map(
    venues.map((venue) => [venue.id, venue]),
  )

  return items.map((item) => {
    const venue = venueMap.get(item.venue_id)

    return {
      ...item,
      venue_name: venue?.name ?? 'Unavailable venue',
      venue_city: venue?.city ?? null,
      venue_cover_url: venue?.cover ?? null,
      // OPTION C — READ-ONLY DESCRIPTION FOR SLIDE TEASERS
      venue_description: venue?.description ?? null,
      image_url:
        item.image_override_url ?? venue?.cover ?? null,
    }
  })
}

async function getAuthorizedEdition(
  editionId: string,
  requireDraft: boolean,
) {
  if (!validId(editionId)) {
    return {
      ok: false as const,
      response: json({ error: 'Invalid edition ID.' }, 400),
    }
  }

  const edition = await getEditionStatus(editionId)

  if (!edition) {
    return {
      ok: false as const,
      response: json({ error: 'Edition not found.' }, 404),
    }
  }

  if (requireDraft && edition.status !== 'draft') {
    return {
      ok: false as const,
      response: json(
        { error: 'Only draft editions can be modified.' },
        409,
      ),
    }
  }

  return { ok: true as const }
}

// ============================================================
// GET — LIST EDITION PLACES
// ============================================================

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await getAuthorizedEdition(
      editionId,
      false,
    )

    if (!check.ok) return check.response

    return json({
      items: await loadItems(editionId),
    })
  } catch (error) {
    console.error('[editorial/items] GET failed:', error)

    return json(
      { error: 'Could not load edition places.' },
      500,
    )
  }
}

// ============================================================
// POST — ADD CANONICAL VENUE
// ============================================================

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await getAuthorizedEdition(
      editionId,
      true,
    )

    if (!check.ok) return check.response

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !isRecord(body) ||
      Object.keys(body).some((key) => key !== 'venue_id') ||
      !validId(body.venue_id)
    ) {
      return json(
        { error: 'A valid venue_id is required.' },
        400,
      )
    }

    const venueId = body.venue_id

    const venueResult = await supabaseAdmin
      .from('venues')
      .select('id, name')
      .eq('id', venueId)
      .maybeSingle()

    if (venueResult.error) throw venueResult.error

    if (
      !venueResult.data ||
      !venueResult.data.name?.trim()
    ) {
      return json(
        { error: 'Canonical venue not found.' },
        404,
      )
    }

    const existing = await supabaseAdmin
      .from('roam_editorial_edition_items')
      .select('id')
      .eq('edition_id', editionId)
      .eq('venue_id', venueId)
      .maybeSingle()

    if (existing.error) throw existing.error

    if (existing.data) {
      return json(
        { error: 'Venue is already in this edition.' },
        409,
      )
    }

    const positionResult = await supabaseAdmin
      .from('roam_editorial_edition_items')
      .select('position')
      .eq('edition_id', editionId)
      .order('position', { ascending: false })
      .limit(1)

    if (positionResult.error) throw positionResult.error

    const lastPosition =
      positionResult.data?.[0]?.position ?? -1

    const { error } = await supabaseAdmin
      .from('roam_editorial_edition_items')
      .insert({
        edition_id: editionId,
        venue_id: venueId,
        origin: 'admin_added',
        source_collection_item_id: null,
        position: lastPosition + 1,
      })

    if (error) {
      if (error.code === '23505') {
        return json(
          {
            error:
              'Venue or position conflict. Refresh and try again.',
          },
          409,
        )
      }

      throw error
    }

    return json(
      { items: await loadItems(editionId) },
      201,
    )
  } catch (error) {
    console.error('[editorial/items] POST failed:', error)

    return json(
      { error: 'Could not add venue to edition.' },
      500,
    )
  }
}

// ============================================================
// PATCH — EDIT VENUE PRESENTATION
// ============================================================

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await getAuthorizedEdition(
      editionId,
      true,
    )

    if (!check.ok) return check.response

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (!isRecord(body) || !validId(body.item_id)) {
      return json(
        { error: 'A valid item_id is required.' },
        400,
      )
    }

    const allowed = new Set([
      'item_id',
      'display_title',
      'editorial_blurb',
      'badge',
    ])

    if (
      Object.keys(body).some((key) => !allowed.has(key))
    ) {
      return json(
        { error: 'Unsupported item update field.' },
        400,
      )
    }

    const changes: Record<string, string | null> = {}

    for (const [field, maxLength] of [
      ['display_title', 160],
      ['editorial_blurb', 600],
      ['badge', 80],
    ] as const) {
      if (!(field in body)) continue

      const value = readOptionalText(
        body[field],
        maxLength,
      )

      if (value === undefined) {
        return json(
          { error: `Invalid ${field}.` },
          400,
        )
      }

      changes[field] = value
    }

    if (Object.keys(changes).length === 0) {
      return json(
        { error: 'No editable fields supplied.' },
        400,
      )
    }

    const { data, error } = await supabaseAdmin
      .from('roam_editorial_edition_items')
      .update(changes)
      .eq('id', body.item_id)
      .eq('edition_id', editionId)
      .select('id')
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return json(
        { error: 'Edition item not found.' },
        404,
      )
    }

    return json({
      items: await loadItems(editionId),
    })
  } catch (error) {
    console.error('[editorial/items] PATCH failed:', error)

    return json(
      { error: 'Could not update edition item.' },
      500,
    )
  }
}

// ============================================================
// DELETE — REMOVE ONE EDITION ITEM
// ============================================================

export async function DELETE(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await getAuthorizedEdition(
      editionId,
      true,
    )

    if (!check.ok) return check.response

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !isRecord(body) ||
      Object.keys(body).some((key) => key !== 'item_id') ||
      !validId(body.item_id)
    ) {
      return json(
        { error: 'A valid item_id is required.' },
        400,
      )
    }

    const { data, error } = await supabaseAdmin
      .from('roam_editorial_edition_items')
      .delete()
      .eq('edition_id', editionId)
      .eq('id', body.item_id)
      .select('id')
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return json(
        { error: 'Edition item not found.' },
        404,
      )
    }

    return json({
      items: await loadItems(editionId),
    })
  } catch (error) {
    console.error('[editorial/items] DELETE failed:', error)

    return json(
      { error: 'Could not remove edition item.' },
      500,
    )
  }
}
