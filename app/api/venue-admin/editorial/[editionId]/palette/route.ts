
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = {
  params: Promise<{
    editionId: string
  }>
}

// ============================================================
// EDITORIAL PALETTES — APPROVED PRESETS
// ============================================================

const PALETTES = [
  'midnight_navy',
  'after_hours',
  'olive_oak',
  'golden_hour',
  'noir_champagne',
  'winter_blue',
] as const

type EditorialPalette = (typeof PALETTES)[number]

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EDITION_SELECT = `
  id,
  edition_type,
  status,
  title,
  subtitle,
  city,
  theme_key,
  source_collection_id,
  featured_creator_id,
  credit_mode,
  creator_permission_status,
  creator_permission_recorded_at,
  template_key,
  design_settings,
  created_by,
  updated_by,
  approved_by,
  approved_at,
  created_at,
  updated_at
`

function json(
  body: unknown,
  status = 200,
) {
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
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function isEditorialPalette(
  value: unknown,
): value is EditorialPalette {
  return (
    typeof value === 'string' &&
    PALETTES.some((palette) => palette === value)
  )
}

// ============================================================
// PATCH /api/venue-admin/editorial/[editionId]/palette
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    // ========================================================
    // AUTHENTICATION
    // ========================================================

    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    // ========================================================
    // VALIDATE EDITION ID
    // ========================================================

    const { editionId } = await context.params

    if (!UUID_PATTERN.test(editionId)) {
      return json(
        { error: 'Invalid edition ID.' },
        400,
      )
    }

    // ========================================================
    // VALIDATE REQUEST BODY
    // ========================================================

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !isRecord(body) ||
      Object.keys(body).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(
        body,
        'palette',
      ) ||
      !isEditorialPalette(body.palette)
    ) {
      return json(
        {
          error:
            'A valid palette is required. Supported palettes: ' +
            PALETTES.join(', ') +
            '.',
        },
        400,
      )
    }

    const palette = body.palette

    // ========================================================
    // LOAD EXISTING STATUS AND DESIGN SETTINGS
    // ========================================================

    const {
      data: existingEdition,
      error: lookupError,
    } = await supabaseAdmin
      .from('roam_editorial_editions')
      .select(
        'id, status, design_settings, updated_at',
      )
      .eq('id', editionId)
      .maybeSingle()

    if (lookupError) {
      console.error(
        '[venue-admin/editorial/palette] Edition lookup failed:',
        {
          editionId,
          error: lookupError,
        },
      )

      return json(
        {
          error:
            'Could not load editorial design settings.',
        },
        500,
      )
    }

    if (!existingEdition) {
      return json(
        { error: 'Edition not found.' },
        404,
      )
    }

    // ========================================================
    // ENFORCE DRAFT-ONLY EDITING
    // ========================================================

    if (existingEdition.status !== 'draft') {
      return json(
        {
          error:
            'Only draft editions can have their palette changed.',
        },
        409,
      )
    }

    // ========================================================
    // PRESERVE EXISTING DESIGN SETTINGS
    // ========================================================

    const currentSettings =
      existingEdition.design_settings

    if (
      currentSettings !== null &&
      !isRecord(currentSettings)
    ) {
      return json(
        {
          error:
            'Existing design settings are not a valid JSON object.',
        },
        409,
      )
    }

    const settings = isRecord(currentSettings)
      ? currentSettings
      : {}

    const nextSettings = {
      ...settings,
      palette,
    }

    // ========================================================
    // SAVE PALETTE WITH OPTIMISTIC CONCURRENCY GUARD
    // ========================================================

    const now = new Date().toISOString()

    let updateQuery = supabaseAdmin
      .from('roam_editorial_editions')
      .update({
        design_settings: nextSettings,
        updated_by: auth.user.id,
        updated_at: now,
      })
      .eq('id', editionId)
      .eq('status', 'draft')

    // Do not apply a stale read if the edition has been
    // updated since its design settings were loaded.
    if (existingEdition.updated_at === null) {
      updateQuery = updateQuery.is(
        'updated_at',
        null,
      )
    } else {
      updateQuery = updateQuery.eq(
        'updated_at',
        existingEdition.updated_at,
      )
    }

    const {
      data: updatedEdition,
      error: updateError,
    } = await updateQuery
      .select(EDITION_SELECT)
      .maybeSingle()

    if (updateError) {
      console.error(
        '[venue-admin/editorial/palette] PATCH failed:',
        {
          editionId,
          adminUserId: auth.user.id,
          palette,
          error: updateError,
        },
      )

      return json(
        {
          error:
            'Could not update editorial color palette.',
        },
        500,
      )
    }

    if (!updatedEdition) {
      return json(
        {
          error:
            'The edition changed before the palette could be saved. Refresh and try again.',
        },
        409,
      )
    }

    // ========================================================
    // RETURN UPDATED EDITION
    // ========================================================

    return json({
      edition: updatedEdition,
    })
  } catch (error) {
    console.error(
      '[venue-admin/editorial/palette] Unexpected PATCH error:',
      error,
    )

    return json(
      {
        error:
          'Unexpected error updating editorial color palette.',
      },
      500,
    )
  }
}
