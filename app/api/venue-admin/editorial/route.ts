
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

// ============================================================
// GET /api/venue-admin/editorial
// ============================================================

export async function GET() {
  try {
    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const { data, error } = await supabaseAdmin
      .from('roam_editorial_editions')
      .select(EDITION_SELECT)
      .order('updated_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .limit(100)

    if (error) {
      console.error(
        '[venue-admin/editorial] GET failed:',
        error,
      )

      return json(
        { error: 'Could not load editorial editions.' },
        500,
      )
    }

    return json({
      editions: data ?? [],
    })
  } catch (error) {
    console.error(
      '[venue-admin/editorial] Unexpected GET error:',
      error,
    )

    return json(
      { error: 'Unexpected error loading editions.' },
      500,
    )
  }
}

// ============================================================
// POST /api/venue-admin/editorial
// ============================================================

export async function POST(request: Request) {
  try {
    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const body: unknown = await request
      .json()
      .catch(() => null)

    const validation = validateEditorialDraft(
      body,
      'create',
    )

    if (!validation.ok) {
      return json(
        { error: validation.error },
        400,
      )
    }

    const {
      edition_type,
      title,
      subtitle,
      description,
      city,
      theme_key,
    } = validation.data

    if (!edition_type || !title) {
      return json(
        {
          error:
            'Edition type and title are required.',
        },
        400,
      )
    }

    const { data, error } = await supabaseAdmin
      .from('roam_editorial_editions')
      .insert({
        edition_type,
        title,
        subtitle: subtitle ?? null,
        description: description ?? null,
        city: city ?? null,
        theme_key: theme_key ?? null,

        status: 'draft',
        credit_mode: 'roam_selects',
        creator_permission_status: 'not_requested',

        template_key: 'roam_sticker_v1',

        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select(EDITION_SELECT)
      .single()

    if (error || !data) {
      console.error(
        '[venue-admin/editorial] POST failed:',
        {
          adminUserId: auth.user.id,
          error,
        },
      )

      return json(
        { error: 'Could not create editorial edition.' },
        500,
      )
    }

    return json(
      { edition: data },
      201,
    )
  } catch (error) {
    console.error(
      '[venue-admin/editorial] Unexpected POST error:',
      error,
    )

    return json(
      { error: 'Unexpected error creating edition.' },
      500,
    )
  }
}
