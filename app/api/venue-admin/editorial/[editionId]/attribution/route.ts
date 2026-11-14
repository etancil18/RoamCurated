
import 'server-only'

import { NextResponse } from 'next/server'
import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = {
  params: Promise<{ editionId: string }>
}

type CreditMode =
  | 'creator_edit'
  | 'roam_x_creator'
  | 'roam_selects'

type PermissionStatus =
  | 'not_requested'
  | 'approved'
  | 'declined'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CREDIT_MODES: CreditMode[] = [
  'creator_edit',
  'roam_x_creator',
  'roam_selects',
]

const PERMISSION_STATUSES: PermissionStatus[] = [
  'not_requested',
  'approved',
  'declined',
]

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
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

async function loadAttribution(editionId: string) {
  const { data: edition, error: editionError } =
    await supabaseAdmin
      .from('roam_editorial_editions')
      .select(
        'id, status, edition_type, source_collection_id, featured_creator_id, credit_mode, creator_permission_status, creator_permission_recorded_at',
      )
      .eq('id', editionId)
      .maybeSingle()

  if (editionError) throw editionError
  if (!edition) return null

  let creator: {
    id: string
    username: string | null
    full_name: string | null
  } | null = null

  let sourceCollection: {
    id: string
    title: string
    slug: string
  } | null = null

  if (edition.featured_creator_id) {
    const result = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name')
      .eq('id', edition.featured_creator_id)
      .maybeSingle()

    if (result.error) throw result.error

    creator = result.data
  }

  if (edition.source_collection_id) {
    const result = await supabaseAdmin
      .from('creator_collections')
      .select('id, title, slug')
      .eq('id', edition.source_collection_id)
      .maybeSingle()

    if (result.error) throw result.error

    sourceCollection = result.data
  }

  return {
    id: edition.id,
    status: edition.status,
    edition_type: edition.edition_type,
    credit_mode: edition.credit_mode,
    creator_permission_status:
      edition.creator_permission_status,
    creator_permission_recorded_at:
      edition.creator_permission_recorded_at,
    featured_creator_id: edition.featured_creator_id,
    source_collection_id: edition.source_collection_id,
    creator,
    source_collection: sourceCollection,
  }
}

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    if (!UUID_PATTERN.test(editionId)) {
      return json({ error: 'Invalid edition ID.' }, 400)
    }

    const attribution = await loadAttribution(editionId)

    if (!attribution) {
      return json({ error: 'Edition not found.' }, 404)
    }

    return json({ attribution })
  } catch (error) {
    console.error(
      '[editorial/attribution] GET failed:',
      error,
    )

    return json(
      { error: 'Could not load edition attribution.' },
      500,
    )
  }
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    if (!UUID_PATTERN.test(editionId)) {
      return json({ error: 'Invalid edition ID.' }, 400)
    }

    let input: unknown

    try {
      input = await request.json()
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400)
    }

    if (!isRecord(input)) {
      return json(
        { error: 'Expected a JSON object.' },
        400,
      )
    }

    const allowedFields = new Set([
      'credit_mode',
      'creator_permission_status',
      'permission_confirmed',
      'featured_creator_id',
    ])

    if (
      Object.keys(input).some(
        (field) => !allowedFields.has(field),
      )
    ) {
      return json(
        { error: 'Unsupported attribution field.' },
        400,
      )
    }

    if (
      !('credit_mode' in input) &&
      !('creator_permission_status' in input) &&
      !('featured_creator_id' in input)
    ) {
      return json(
        { error: 'No attribution changes supplied.' },
        400,
      )
    }

    if (
      'credit_mode' in input &&
      !CREDIT_MODES.includes(
        input.credit_mode as CreditMode,
      )
    ) {
      return json(
        { error: 'Invalid credit mode.' },
        400,
      )
    }

    if (
      'creator_permission_status' in input &&
      !PERMISSION_STATUSES.includes(
        input.creator_permission_status as PermissionStatus,
      )
    ) {
      return json(
        { error: 'Invalid permission status.' },
        400,
      )
    }

    // Manual creator selection accepts an existing
    // profile UUID, or null to remove the featured creator.
    if (
      'featured_creator_id' in input &&
      input.featured_creator_id !== null &&
      (
        typeof input.featured_creator_id !== 'string' ||
        !UUID_PATTERN.test(input.featured_creator_id)
      )
    ) {
      return json(
        { error: 'Invalid featured creator ID.' },
        400,
      )
    }

    const { data: edition, error: editionError } =
      await supabaseAdmin
        .from('roam_editorial_editions')
        .select(
          'id, status, featured_creator_id, credit_mode, creator_permission_status, creator_permission_recorded_at',
        )
        .eq('id', editionId)
        .maybeSingle()

    if (editionError) throw editionError

    if (!edition) {
      return json({ error: 'Edition not found.' }, 404)
    }

    if (edition.status !== 'draft') {
      return json(
        { error: 'Only draft editions can be edited.' },
        409,
      )
    }

    // Use the manually selected creator when supplied;
    // otherwise preserve the currently linked creator.
    const featuredCreatorId =
      'featured_creator_id' in input
        ? (input.featured_creator_id as string | null)
        : edition.featured_creator_id

    const creatorChanged =
      featuredCreatorId !== edition.featured_creator_id

    // Verify the selected creator actually exists.
    // This does not import or modify any collection.
    if (creatorChanged && featuredCreatorId) {
      const { data: creator, error: creatorError } =
        await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', featuredCreatorId)
          .maybeSingle()

      if (creatorError) throw creatorError

      if (!creator) {
        return json(
          {
            error:
              'Selected creator was not found among Roam users.',
          },
          404,
        )
      }
    }

    const creditMode =
      'credit_mode' in input
        ? (input.credit_mode as CreditMode)
        : (edition.credit_mode as CreditMode)

    // A different creator cannot inherit the previous
    // creator's approval or declined permission status.
    const permissionStatus =
      'creator_permission_status' in input
        ? (input.creator_permission_status as PermissionStatus)
        : creatorChanged
          ? 'not_requested'
          : (edition.creator_permission_status as PermissionStatus)

    // Creator-specific credit and permission decisions
    // require an actual linked creator.
    // The creator may be manually selected or imported.
    if (
      !featuredCreatorId &&
      (
        creditMode !== 'roam_selects' ||
        permissionStatus !== 'not_requested'
      )
    ) {
      return json(
        {
          error:
            'Select a featured creator or import a creator collection before assigning creator credit or recording creator permission.',
        },
        409,
      )
    }

    // Explicit acknowledgement is required when changing
    // a permission decision to approved. This is a
    // declaration by the administrator, not proof of consent.
    //
    // A newly selected creator must be approved independently,
    // even if the previously linked creator was approved.
    if (
      permissionStatus === 'approved' &&
      (
        edition.creator_permission_status !== 'approved' ||
        creatorChanged
      ) &&
      input.permission_confirmed !== true
    ) {
      return json(
        {
          error:
            'Confirm that creator permission has been obtained before marking it approved.',
        },
        400,
      )
    }

    const permissionChanged =
      permissionStatus !==
      edition.creator_permission_status

    // Creator changes must also reset or re-record the
    // permission timestamp, even if the status text
    // happens to remain the same.
    const recordedAt = permissionChanged || creatorChanged
      ? permissionStatus === 'not_requested'
        ? null
        : new Date().toISOString()
      : edition.creator_permission_recorded_at

    // Preserve the existing update and add only the
    // featured creator assignment. Matching the previous
    // creator prevents overwriting a concurrent reassignment.
    let updateQuery = supabaseAdmin
      .from('roam_editorial_editions')
      .update({
        featured_creator_id: featuredCreatorId,
        credit_mode: creditMode,
        creator_permission_status: permissionStatus,
        creator_permission_recorded_at: recordedAt,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editionId)
      .eq('status', 'draft')

    if (edition.featured_creator_id) {
      updateQuery = updateQuery.eq(
        'featured_creator_id',
        edition.featured_creator_id,
      )
    } else {
      updateQuery = updateQuery.is(
        'featured_creator_id',
        null,
      )
    }

    const { data: updated, error: updateError } =
      await updateQuery
        .select('id')
        .maybeSingle()

    if (updateError) throw updateError

    if (!updated) {
      return json(
        {
          error:
            'This edition is no longer editable or its featured creator was changed by another administrator. Refresh and try again.',
        },
        409,
      )
    }

    const attribution = await loadAttribution(editionId)

    return json({ attribution })
  } catch (error) {
    console.error(
      '[editorial/attribution] PATCH failed:',
      error,
    )

    return json(
      { error: 'Could not save attribution settings.' },
      500,
    )
  }
}
