
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateEditorialDraft } from '@/lib/editorial/draftValidation'

const EDITION_SELECT = `
  id,
  edition_type,
  status,
  title,
  subtitle,
  description,
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

type RouteContext = {
  params: Promise<{
    editionId: string
  }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

// ============================================================
// GET /api/venue-admin/editorial/[editionId]
// ============================================================

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const { editionId } = await context.params

    // ========================================================
    // EDITORIAL DETAIL — ROUTE PARAMETER DIAGNOSTICS
    //
    // Determine why a valid-looking edition UUID is being
    // rejected before the database query executes.
    //
    // Diagnostic only. No validation or data changes.
    // ========================================================

    console.log(
      '[editorial detail GET] params:',
      await context.params,
    )

    console.log(
      '[editorial detail GET] editionId:',
      editionId,
    )

    console.log(
      '[editorial detail GET] editionId type:',
      typeof editionId,
    )

    if (!UUID_PATTERN.test(editionId)) {
      return json(
        { error: 'Invalid edition ID.' },
        400,
      )
    }

    const { data, error } = await supabaseAdmin
      .from('roam_editorial_editions')
      .select(EDITION_SELECT)
      .eq('id', editionId)
      .maybeSingle()

    if (error) {
      console.error(
        '[venue-admin/editorial] Detail GET failed:',
        {
          editionId,
          error,
        },
      )

      return json(
        { error: 'Could not load editorial edition.' },
        500,
      )
    }

    if (!data) {
      return json(
        { error: 'Edition not found.' },
        404,
      )
    }

    return json({
      edition: data,
    })
  } catch (error) {
    console.error(
      '[venue-admin/editorial] Unexpected detail GET error:',
      error,
    )

    return json(
      { error: 'Unexpected error loading edition.' },
      500,
    )
  }
}

// ============================================================
// PATCH /api/venue-admin/editorial/[editionId]
// ============================================================

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const { editionId } = await context.params

    if (!UUID_PATTERN.test(editionId)) {
      return json(
        { error: 'Invalid edition ID.' },
        400,
      )
    }

    const body: unknown = await request
      .json()
      .catch(() => null)

    const validation = validateEditorialDraft(
      body,
      'update',
    )

    if (!validation.ok) {
      return json(
        { error: validation.error },
        400,
      )
    }

    const { data, error } = await supabaseAdmin
      .from('roam_editorial_editions')
      .update({
        ...validation.data,
        updated_by: auth.user.id,
      })
      .eq('id', editionId)
      .eq('status', 'draft')
      .select(EDITION_SELECT)
      .maybeSingle()

    if (error) {
      console.error(
        '[venue-admin/editorial] PATCH failed:',
        {
          editionId,
          adminUserId: auth.user.id,
          error,
        },
      )

      return json(
        { error: 'Could not update editorial edition.' },
        500,
      )
    }

    if (!data) {
      const existing = await supabaseAdmin
        .from('roam_editorial_editions')
        .select('id, status')
        .eq('id', editionId)
        .maybeSingle()

      if (existing.error) {
        console.error(
          '[venue-admin/editorial] Status lookup failed:',
          existing.error,
        )

        return json(
          { error: 'Could not verify edition status.' },
          500,
        )
      }

      if (!existing.data) {
        return json(
          { error: 'Edition not found.' },
          404,
        )
      }

      return json(
        {
          error:
            'Only draft editions can be edited.',
        },
        409,
      )
    }

    return json({
      edition: data,
    })
  } catch (error) {
    console.error(
      '[venue-admin/editorial] Unexpected PATCH error:',
      error,
    )

    return json(
      { error: 'Unexpected error updating edition.' },
      500,
    )
  }
}
