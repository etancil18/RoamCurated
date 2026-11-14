
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RouteContext = {
  params: Promise<{
    editionId: string
  }>
}

type EditionStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'archived'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================
// EDITORIAL APPROVAL — ALLOWED STATUS TRANSITIONS
// ============================================================

const STATUS_TRANSITIONS: Record<
  EditionStatus,
  readonly EditionStatus[]
> = {
  draft: ['in_review', 'archived'],
  in_review: ['approved', 'draft'],
  approved: ['archived'],
  archived: ['draft'],
}

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

function isEditionStatus(
  value: unknown,
): value is EditionStatus {
  return (
    value === 'draft' ||
    value === 'in_review' ||
    value === 'approved' ||
    value === 'archived'
  )
}

// ============================================================
// PATCH /api/venue-admin/editorial/[editionId]/status
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

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !('status' in body) ||
      !isEditionStatus(body.status)
    ) {
      return json(
        { error: 'A valid editorial status is required.' },
        400,
      )
    }

    const nextStatus = body.status

    // ========================================================
    // LOAD CURRENT STATUS AND PERMISSION INFORMATION
    // ========================================================

    const {
      data: existingEdition,
      error: lookupError,
    } = await supabaseAdmin
      .from('roam_editorial_editions')
      .select(
        'id, status, featured_creator_id, source_collection_id, creator_permission_status',
      )
      .eq('id', editionId)
      .maybeSingle()

    if (lookupError) {
      console.error(
        '[venue-admin/editorial/status] Edition lookup failed:',
        {
          editionId,
          error: lookupError,
        },
      )

      return json(
        { error: 'Could not verify editorial edition status.' },
        500,
      )
    }

    if (!existingEdition) {
      return json(
        { error: 'Edition not found.' },
        404,
      )
    }

    if (!isEditionStatus(existingEdition.status)) {
      return json(
        { error: 'Edition has an unsupported status.' },
        409,
      )
    }

    const currentStatus = existingEdition.status

    // ========================================================
    // ENFORCE ALLOWED TRANSITIONS
    // ========================================================

    if (
      !STATUS_TRANSITIONS[currentStatus].includes(nextStatus)
    ) {
      return json(
        {
          error:
            `Cannot transition an edition from ${currentStatus} to ${nextStatus}.`,
        },
        409,
      )
    }

    // ========================================================
    // APPROVAL — VERIFY CREATOR REUSE PERMISSION
    // ========================================================

    if (nextStatus === 'approved') {
      const usesCreatorSource =
        Boolean(existingEdition.featured_creator_id) ||
        Boolean(existingEdition.source_collection_id)

      if (
        usesCreatorSource &&
        existingEdition.creator_permission_status !==
          'approved'
      ) {
        return json(
          {
            error:
              'Creator permission must be approved before this edition can be approved.',
          },
          403,
        )
      }
    }

    // ========================================================
    // UPDATE STATUS AND APPROVAL AUDIT FIELDS
    // ========================================================

    const now = new Date().toISOString()

    const updates: {
      status: EditionStatus
      updated_by: string
      updated_at: string
      approved_by?: string | null
      approved_at?: string | null
    } = {
      status: nextStatus,
      updated_by: auth.user.id,
      updated_at: now,
    }

    if (nextStatus === 'approved') {
      updates.approved_by = auth.user.id
      updates.approved_at = now
    }

    // Returning an edition to draft starts a new
    // editorial review cycle.
    if (nextStatus === 'draft') {
      updates.approved_by = null
      updates.approved_at = null
    }

    // Archive preserves prior approval metadata, if any,
    // as a record of the edition's earlier approval.

    const {
      data: updatedEdition,
      error: updateError,
    } = await supabaseAdmin
      .from('roam_editorial_editions')
      .update(updates)
      .eq('id', editionId)
      .eq('status', currentStatus)
      .select(EDITION_SELECT)
      .maybeSingle()

    if (updateError) {
      console.error(
        '[venue-admin/editorial/status] Status update failed:',
        {
          editionId,
          adminUserId: auth.user.id,
          currentStatus,
          nextStatus,
          error: updateError,
        },
      )

      return json(
        { error: 'Could not update editorial edition status.' },
        500,
      )
    }

    // The conditional status filter prevents an update
    // when another administrator has already moved
    // the edition into a different status.
    if (!updatedEdition) {
      return json(
        {
          error:
            'Edition status changed before this update completed. Refresh the edition and try again.',
        },
        409,
      )
    }

    return json({
      edition: updatedEdition,
    })
  } catch (error) {
    console.error(
      '[venue-admin/editorial/status] Unexpected PATCH error:',
      error,
    )

    return json(
      { error: 'Unexpected error updating edition status.' },
      500,
    )
  }
}
