
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = {
  params: Promise<{
    editionId: string
  }>
}

type EditionStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'archived'

type PermissionStatus =
  | 'not_requested'
  | 'approved'
  | 'declined'

type PublicationRow = {
  id: string
  status: EditionStatus
  is_public: boolean
  published_at: string | null
  approved_at: string | null
  featured_creator_id: string | null
  source_collection_id: string | null
  creator_permission_status: PermissionStatus
  updated_at: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PUBLICATION_SELECT = `
  id,
  status,
  is_public,
  published_at,
  approved_at,
  featured_creator_id,
  source_collection_id,
  creator_permission_status,
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
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function publicationResponse(
  edition: PublicationRow,
) {
  return {
    id: edition.id,
    status: edition.status,
    is_public: edition.is_public,
    published_at: edition.published_at,
    approved_at: edition.approved_at,
    updated_at: edition.updated_at,
  }
}

async function loadPublication(
  editionId: string,
): Promise<PublicationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('roam_editorial_editions')
    .select(PUBLICATION_SELECT)
    .eq('id', editionId)
    .maybeSingle()

  if (error) throw error

  return (data as PublicationRow | null) ?? null
}

// ============================================================
// GET — READ EDITION PUBLICATION STATE
//
// Admin-only.
// Does not change the editorial edition.
// ============================================================

export async function GET(
  _request: Request,
  context: Context,
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

    const edition = await loadPublication(editionId)

    if (!edition) {
      return json(
        { error: 'Edition not found.' },
        404,
      )
    }

    return json({
      publication: publicationResponse(edition),
    })
  } catch (error) {
    console.error(
      '[editorial/publication] GET failed:',
      error,
    )

    return json(
      {
        error: 'Could not load edition publication settings.',
      },
      500,
    )
  }
}

// ============================================================
// PATCH — PUBLISH OR UNPUBLISH
//
// Request:
//   { "is_public": true }
//   { "is_public": false }
//
// Publishing requires:
// - Approved editorial status
// - Existing approval timestamp
// - Approved creator permission when creator content
//   or attribution is linked
//
// Unpublishing:
// - Does not change editorial status
// - Does not erase publication history
// - Is permitted from any editorial status
//
// Historical archived editions remain public
// unless explicitly unpublished.
// ============================================================

export async function PATCH(
  request: Request,
  context: Context,
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

    let input: unknown

    try {
      input = await request.json()
    } catch {
      return json(
        { error: 'Invalid JSON body.' },
        400,
      )
    }

    if (
      !isRecord(input) ||
      Object.keys(input).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(
        input,
        'is_public',
      ) ||
      typeof input.is_public !== 'boolean'
    ) {
      return json(
        {
          error:
            'Expected exactly one boolean field: is_public.',
        },
        400,
      )
    }

    const shouldPublish = input.is_public

    const edition = await loadPublication(editionId)

    if (!edition) {
      return json(
        { error: 'Edition not found.' },
        404,
      )
    }

    // --------------------------------------------------------
    // PUBLISH — VERIFY EDITORIAL APPROVAL
    // --------------------------------------------------------

    if (shouldPublish) {
      if (
        edition.status !== 'approved' ||
        !edition.approved_at
      ) {
        return json(
          {
            error:
              'Only approved editorial editions can be published.',
          },
          409,
        )
      }

      // This mirrors the existing editorial approval
      // permission rule. Manual creator selection and
      // collection-based attribution are both covered.
      const usesCreatorSource =
        Boolean(edition.featured_creator_id) ||
        Boolean(edition.source_collection_id)

      if (
        usesCreatorSource &&
        edition.creator_permission_status !== 'approved'
      ) {
        return json(
          {
            error:
              'Creator permission must be approved before this edition can be published.',
          },
          403,
        )
      }
    }

    // --------------------------------------------------------
    // IDEMPOTENCY
    //
    // Repeating Publish or Unpublish should not
    // unnecessarily rewrite the edition.
    // --------------------------------------------------------

    if (edition.is_public === shouldPublish) {
      return json({
        publication: publicationResponse(edition),
      })
    }

    // --------------------------------------------------------
    // PRESERVE ORIGINAL PUBLICATION DATE
    //
    // First publication records a timestamp.
    // Unpublishing never clears it.
    // Republish retains the original timestamp.
    // --------------------------------------------------------

    const now = new Date().toISOString()

    const publishedAt = shouldPublish
      ? edition.published_at ?? now
      : edition.published_at

    // --------------------------------------------------------
    // CONDITIONAL UPDATE
    //
    // Preserve all other edition fields.
    //
    // The status, visibility, and updated_at conditions
    // prevent applying a stale publication decision
    // after another administrator changes the edition.
    // --------------------------------------------------------

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from('roam_editorial_editions')
        .update({
          is_public: shouldPublish,
          published_at: publishedAt,
          updated_by: auth.user.id,
          updated_at: now,
        })
        .eq('id', editionId)
        .eq('status', edition.status)
        .eq('is_public', edition.is_public)
        .eq('updated_at', edition.updated_at)
        .select(PUBLICATION_SELECT)
        .maybeSingle()

    if (updateError) {
      console.error(
        '[editorial/publication] PATCH update failed:',
        {
          editionId,
          adminUserId: auth.user.id,
          error: updateError,
        },
      )

      return json(
        {
          error:
            'Could not update edition publication settings.',
        },
        500,
      )
    }

    if (!updated) {
      return json(
        {
          error:
            'Edition settings changed before publication completed. Refresh and try again.',
        },
        409,
      )
    }

    return json({
      publication: publicationResponse(
        updated as PublicationRow,
      ),
    })
  } catch (error) {
    console.error(
      '[editorial/publication] PATCH failed:',
      error,
    )

    return json(
      {
        error:
          'Unexpected error updating edition publication settings.',
      },
      500,
    )
  }
}
