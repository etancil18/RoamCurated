import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  supabaseServerApi,
} from '@/lib/supabase/server-api'


// ============================================================
// Community Signals — occurrence correction writer
//
// event_correction =
// "I believe a specific fact or relationship concerning this
// occurrence is inaccurate."
//
// A correction is evidence.
//
// It MUST NOT directly:
// - mutate events
// - mutate event_occurrences
// - mutate event_reports
// - create or update venue_visits
// - create or update event_checkins
// - create or update event_interests
// - touch Active Flow progress
// - merge occurrences
// - merge events
//
// Interpretation happens later through resolution operations.
// ============================================================


const MAX_TITLE_LENGTH = 160
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_NOTE_LENGTH = 1000
const MAX_SOURCE_URL_LENGTH = 2048


const ALLOWED_CORRECTION_TYPES =
  new Set([
    'time',
    'canceled',
    'venue',
    'title',
    'details',
    'duplicate',
    'source',
  ])


type CorrectionType =
  | 'time'
  | 'canceled'
  | 'venue'
  | 'title'
  | 'details'
  | 'duplicate'
  | 'source'


type CorrectionBody = {
  correction_type?: unknown
  claim?: unknown

  note?: unknown
  source_url?: unknown
  observed_at?: unknown
}


type OccurrenceRow = {
  id: string
  venue_id: string
  resolution_status: string
}


type ValidatedCorrection = {
  correctionType:
    CorrectionType

  claim:
    Record<string, unknown>
}


function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}


function normalizeRequiredText(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (
    normalized.length === 0 ||
    normalized.length > maxLength
  ) {
    return null
  }

  return normalized
}


function normalizeOptionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (
    normalized.length === 0 ||
    normalized.length > maxLength
  ) {
    return null
  }

  return normalized
}


function normalizeOptionalTimestamp(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed =
    new Date(value)

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null
  }

  return parsed.toISOString()
}


function normalizeSourceUrl(
  value: unknown
): string | null {
  const normalized =
    normalizeOptionalText(
      value,
      MAX_SOURCE_URL_LENGTH
    )

  if (!normalized) {
    return null
  }

  try {
    const url =
      new URL(normalized)

    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:'
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}


function hasExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[]
): boolean {
  const actualKeys =
    Object.keys(value)

  if (
    actualKeys.length !==
    allowedKeys.length
  ) {
    return false
  }

  return actualKeys.every(
    key =>
      allowedKeys.includes(key)
  )
}


function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: string[]
): boolean {
  return Object.keys(value)
    .every(
      key =>
        allowedKeys.includes(key)
    )
}


function validateCorrectionClaim({
  correctionType,
  rawClaim,
}: {
  correctionType:
    CorrectionType
  rawClaim:
    unknown
}):
  | {
      ok: true
      value: ValidatedCorrection
    }
  | {
      ok: false
      error: string
    } {
  if (!isRecord(rawClaim)) {
    return {
      ok: false,
      error:
        'Correction claim must be an object.',
    }
  }


  if (
    correctionType ===
    'time'
  ) {
    if (
      !hasOnlyKeys(
        rawClaim,
        [
          'starts_at',
          'ends_at',
        ]
      )
    ) {
      return {
        ok: false,
        error:
          'Time correction contains unsupported fields.',
      }
    }

    const hasStartsAt =
      rawClaim.starts_at !==
        undefined &&
      rawClaim.starts_at !==
        null &&
      rawClaim.starts_at !==
        ''

    const hasEndsAt =
      rawClaim.ends_at !==
        undefined &&
      rawClaim.ends_at !==
        null &&
      rawClaim.ends_at !==
        ''

    if (
      !hasStartsAt &&
      !hasEndsAt
    ) {
      return {
        ok: false,
        error:
          'Time correction must provide a start time, end time, or both.',
      }
    }

    const startsAt =
      hasStartsAt
        ? normalizeOptionalTimestamp(
            rawClaim.starts_at
          )
        : null

    const endsAt =
      hasEndsAt
        ? normalizeOptionalTimestamp(
            rawClaim.ends_at
          )
        : null

    if (
      hasStartsAt &&
      !startsAt
    ) {
      return {
        ok: false,
        error:
          'Corrected start time is invalid.',
      }
    }

    if (
      hasEndsAt &&
      !endsAt
    ) {
      return {
        ok: false,
        error:
          'Corrected end time is invalid.',
      }
    }

    if (
      startsAt &&
      endsAt &&
      new Date(
        endsAt
      ).getTime() <=
        new Date(
          startsAt
        ).getTime()
    ) {
      return {
        ok: false,
        error:
          'Corrected end time must be after the corrected start time.',
      }
    }

    const claim:
      Record<string, unknown> =
        {}

    if (startsAt) {
      claim.starts_at =
        startsAt
    }

    if (endsAt) {
      claim.ends_at =
        endsAt
    }

    return {
      ok: true,
      value: {
        correctionType,
        claim,
      },
    }
  }


  if (
    correctionType ===
    'canceled'
  ) {
    if (
      !hasExactKeys(
        rawClaim,
        []
      )
    ) {
      return {
        ok: false,
        error:
          'Canceled correction claim must be empty.',
      }
    }

    return {
      ok: true,
      value: {
        correctionType,
        claim: {},
      },
    }
  }


  if (
    correctionType ===
    'venue'
  ) {
    if (
      !hasExactKeys(
        rawClaim,
        [
          'venue_id',
        ]
      )
    ) {
      return {
        ok: false,
        error:
          'Venue correction must contain only venue_id.',
      }
    }

    const venueId =
      normalizeRequiredText(
        rawClaim.venue_id,
        100
      )

    if (!venueId) {
      return {
        ok: false,
        error:
          'Corrected venue is invalid.',
      }
    }

    return {
      ok: true,
      value: {
        correctionType,
        claim: {
          venue_id:
            venueId,
        },
      },
    }
  }


  if (
    correctionType ===
    'title'
  ) {
    if (
      !hasExactKeys(
        rawClaim,
        [
          'title',
        ]
      )
    ) {
      return {
        ok: false,
        error:
          'Title correction must contain only title.',
      }
    }

    const title =
      normalizeRequiredText(
        rawClaim.title,
        MAX_TITLE_LENGTH
      )

    if (!title) {
      return {
        ok: false,
        error:
          'Corrected title is required and must be 160 characters or fewer.',
      }
    }

    return {
      ok: true,
      value: {
        correctionType,
        claim: {
          title,
        },
      },
    }
  }


  if (
    correctionType ===
    'details'
  ) {
    if (
      !hasExactKeys(
        rawClaim,
        [
          'description',
        ]
      )
    ) {
      return {
        ok: false,
        error:
          'Details correction must contain only description.',
      }
    }

    const description =
      normalizeRequiredText(
        rawClaim.description,
        MAX_DESCRIPTION_LENGTH
      )

    if (!description) {
      return {
        ok: false,
        error:
          'Corrected description is required and must be 2000 characters or fewer.',
      }
    }

    return {
      ok: true,
      value: {
        correctionType,
        claim: {
          description,
        },
      },
    }
  }


  if (
    correctionType ===
    'duplicate'
  ) {
    if (
      !hasExactKeys(
        rawClaim,
        [
          'occurrence_id',
        ]
      )
    ) {
      return {
        ok: false,
        error:
          'Duplicate correction must contain only occurrence_id.',
      }
    }

    const duplicateOccurrenceId =
      normalizeRequiredText(
        rawClaim.occurrence_id,
        100
      )

    if (!duplicateOccurrenceId) {
      return {
        ok: false,
        error:
          'Duplicate occurrence is invalid.',
      }
    }

    return {
      ok: true,
      value: {
        correctionType,
        claim: {
          occurrence_id:
            duplicateOccurrenceId,
        },
      },
    }
  }


  // source

  if (
    !hasExactKeys(
      rawClaim,
      []
    )
  ) {
    return {
      ok: false,
      error:
        'Source correction claim must be empty.',
    }
  }

  return {
    ok: true,
    value: {
      correctionType,
      claim: {},
    },
  }
}


export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      occurrenceId: string
    }>
  }
) {
  // ----------------------------------------------------------
  // 1. Authenticate.
  // ----------------------------------------------------------

  const supabase =
    await supabaseServerApi()

  const {
    data: {
      user,
    },
    error: authError,
  } =
    await supabase.auth.getUser()

  if (
    authError ||
    !user
  ) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status: 401,
      }
    )
  }


  // ----------------------------------------------------------
  // 2. Validate occurrence identity.
  // ----------------------------------------------------------

  const {
    occurrenceId: rawOccurrenceId,
  } =
    await context.params

  const occurrenceId =
    normalizeRequiredText(
      rawOccurrenceId,
      100
    )

  if (!occurrenceId) {
    return NextResponse.json(
      {
        error:
          'Occurrence is required.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 3. Parse body.
  // ----------------------------------------------------------

  const rawBody =
    await req
      .json()
      .catch(
        () => null
      )

  if (
    !isRecord(rawBody)
  ) {
    return NextResponse.json(
      {
        error:
          'Invalid request body.',
      },
      {
        status: 400,
      }
    )
  }

  const body =
    rawBody as CorrectionBody


  // ----------------------------------------------------------
  // 4. Validate correction type.
  // ----------------------------------------------------------

  const rawCorrectionType =
    normalizeRequiredText(
      body.correction_type,
      50
    )

  if (
    !rawCorrectionType ||
    !ALLOWED_CORRECTION_TYPES.has(
      rawCorrectionType
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Correction type is invalid.',
      },
      {
        status: 400,
      }
    )
  }

  const correctionType =
    rawCorrectionType as
      CorrectionType


  // ----------------------------------------------------------
  // 5. Validate exact type-specific claim shape.
  // ----------------------------------------------------------

  const validatedClaim =
    validateCorrectionClaim({
      correctionType,
      rawClaim:
        body.claim,
    })

  if (!validatedClaim.ok) {
    return NextResponse.json(
      {
        error:
          validatedClaim.error,
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 6. Validate optional note.
  // ----------------------------------------------------------

  const note =
    normalizeOptionalText(
      body.note,
      MAX_NOTE_LENGTH
    )

  if (
    body.note !== undefined &&
    body.note !== null &&
    (
      typeof body.note !==
        'string' ||
      (
        body.note
          .trim()
          .length >
        MAX_NOTE_LENGTH
      )
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Correction note is invalid or too long.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 7. Validate optional source URL.
  // ----------------------------------------------------------

  const sourceUrl =
    normalizeSourceUrl(
      body.source_url
    )

  if (
    body.source_url !==
      undefined &&
    body.source_url !==
      null &&
    body.source_url !==
      '' &&
    !sourceUrl
  ) {
    return NextResponse.json(
      {
        error:
          'Source URL must be a valid HTTP or HTTPS URL.',
      },
      {
        status: 400,
      }
    )
  }

  if (
    correctionType ===
      'source' &&
    !sourceUrl
  ) {
    return NextResponse.json(
      {
        error:
          'Source correction requires a source URL.',
      },
      {
        status: 400,
      }
    )
  }


  // ----------------------------------------------------------
  // 8. Validate optional observation time.
  // ----------------------------------------------------------

  let observedAt:
    string | null =
      null

  if (
    body.observed_at !==
      undefined &&
    body.observed_at !==
      null &&
    body.observed_at !==
      ''
  ) {
    const normalizedObservedAt =
      normalizeOptionalTimestamp(
        body.observed_at
      )

    if (
      !normalizedObservedAt
    ) {
      return NextResponse.json(
        {
          error:
            'Observation time is invalid.',
        },
        {
          status: 400,
        }
      )
    }

    const now =
      new Date()

    const futureToleranceMs =
      5 * 60 * 1000

    if (
      new Date(
        normalizedObservedAt
      ).getTime() >
      now.getTime() +
        futureToleranceMs
    ) {
      return NextResponse.json(
        {
          error:
            'Observation time cannot be in the future.',
        },
        {
          status: 400,
        }
      )
    }

    observedAt =
      normalizedObservedAt
  }


  // ----------------------------------------------------------
  // 9. Load source occurrence.
  // ----------------------------------------------------------

  const supabaseAdmin =
    getSupabaseAdmin()

  const {
    data: occurrence,
    error: occurrenceError,
  } =
    await supabaseAdmin
      .from(
        'event_occurrences'
      )
      .select(`
        id,
        venue_id,
        resolution_status
      `)
      .eq(
        'id',
        occurrenceId
      )
      .maybeSingle<OccurrenceRow>()

  if (occurrenceError) {
    console.error(
      '[event-corrections][POST] Occurrence lookup failed:',
      {
        occurrenceId,
        userId:
          user.id,
        error:
          occurrenceError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Could not validate occurrence.',
      },
      {
        status: 500,
      }
    )
  }

  if (!occurrence) {
    return NextResponse.json(
      {
        error:
          'Occurrence not found.',
      },
      {
        status: 404,
      }
    )
  }

  if (
    occurrence.resolution_status ===
    'rejected'
  ) {
    return NextResponse.json(
      {
        error:
          'This occurrence is no longer accepting community evidence.',
      },
      {
        status: 409,
      }
    )
  }


  // ----------------------------------------------------------
  // 10. Validate relationship claims against canonical data.
  // ----------------------------------------------------------

  if (
    correctionType ===
    'venue'
  ) {
    const proposedVenueId =
      validatedClaim
        .value
        .claim
        .venue_id as string

    if (
      proposedVenueId ===
      occurrence.venue_id
    ) {
      return NextResponse.json(
        {
          error:
            'Corrected venue must differ from the occurrence venue.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: proposedVenue,
      error: proposedVenueError,
    } =
      await supabaseAdmin
        .from('venues')
        .select('id')
        .eq(
          'id',
          proposedVenueId
        )
        .maybeSingle()

    if (proposedVenueError) {
      console.error(
        '[event-corrections][POST] Proposed venue lookup failed:',
        {
          occurrenceId:
            occurrence.id,
          proposedVenueId,
          userId:
            user.id,
          error:
            proposedVenueError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not validate corrected venue.',
        },
        {
          status: 500,
        }
      )
    }

    if (!proposedVenue) {
      return NextResponse.json(
        {
          error:
            'Corrected venue not found.',
        },
        {
          status: 404,
        }
      )
    }
  }


  if (
    correctionType ===
    'duplicate'
  ) {
    const duplicateOccurrenceId =
      validatedClaim
        .value
        .claim
        .occurrence_id as string

    if (
      duplicateOccurrenceId ===
      occurrence.id
    ) {
      return NextResponse.json(
        {
          error:
            'An occurrence cannot be marked as a duplicate of itself.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: duplicateOccurrence,
      error: duplicateOccurrenceError,
    } =
      await supabaseAdmin
        .from(
          'event_occurrences'
        )
        .select(`
          id,
          venue_id,
          resolution_status
        `)
        .eq(
          'id',
          duplicateOccurrenceId
        )
        .maybeSingle<OccurrenceRow>()

    if (duplicateOccurrenceError) {
      console.error(
        '[event-corrections][POST] Duplicate occurrence lookup failed:',
        {
          occurrenceId:
            occurrence.id,
          duplicateOccurrenceId,
          userId:
            user.id,
          error:
            duplicateOccurrenceError,
        }
      )

      return NextResponse.json(
        {
          error:
            'Could not validate duplicate occurrence.',
        },
        {
          status: 500,
        }
      )
    }

    if (!duplicateOccurrence) {
      return NextResponse.json(
        {
          error:
            'Duplicate occurrence not found.',
        },
        {
          status: 404,
        }
      )
    }

    if (
      duplicateOccurrence.venue_id !==
      occurrence.venue_id
    ) {
      return NextResponse.json(
        {
          error:
            'Duplicate occurrence must currently reference the same venue.',
        },
        {
          status: 400,
        }
      )
    }
  }


  // ----------------------------------------------------------
  // 11. Trusted evidence insert.
  //
  // Client has no authority over:
  // - contributor_user_id
  // - evidence_source
  // - review state
  // - reviewer identity
  // - moderation state
  //
  // No canonical mutation occurs here.
  // ----------------------------------------------------------

  const {
    data: correction,
    error: insertError,
  } =
    await supabaseAdmin
      .from(
        'event_corrections'
      )
      .insert({
        occurrence_id:
          occurrence.id,

        contributor_user_id:
          user.id,

        evidence_source:
          'community',

        correction_type:
          validatedClaim
            .value
            .correctionType,

        claim:
          validatedClaim
            .value
            .claim,

        note,

        source_url:
          sourceUrl,

        observed_at:
          observedAt,

        review_status:
          'pending',

        reviewed_at:
          null,

        reviewed_by:
          null,

        review_reason:
          null,

        moderation_status:
          'pending',
      })
      .select(`
        id,
        occurrence_id,
        correction_type,
        claim,
        note,
        source_url,
        observed_at,
        review_status,
        moderation_status,
        created_at
      `)
      .single()

  if (insertError) {
    console.error(
      '[event-corrections][POST] Insert failed:',
      {
        occurrenceId:
          occurrence.id,
        userId:
          user.id,
        correctionType,
        error:
          insertError,
      }
    )

    return NextResponse.json(
      {
        error:
          'Failed to submit correction.',
      },
      {
        status: 500,
      }
    )
  }


  // ----------------------------------------------------------
  // 12. Return deliberately limited evidence representation.
  // ----------------------------------------------------------

  return NextResponse.json(
    {
      correction,
    },
    {
      status: 201,
    }
  )
}