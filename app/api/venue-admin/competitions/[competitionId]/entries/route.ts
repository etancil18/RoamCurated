import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

// ============================================================
// ADMIN CONFIG
// ============================================================

const ALLOWED_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

// ============================================================
// TYPES
// ============================================================

type RouteContext = {
  params: Promise<{
    competitionId: string
  }>
}

type CreateEntryBody = {
  submission_id?: unknown
  contender_slot?: unknown

  /**
   * VENUE-PARTICIPATION MODE ONLY.
   *
   * Curated sides are authored directly from canonical venue IDs
   * and do not originate from competition_submissions.
   */
  venue_ids?: unknown
}

type CompetitionStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'scoring'
  | 'completed'
  | 'cancelled'

type TasteDuelExecutionMode =
  | 'itinerary'
  | 'venue_participation'

type CompetitionRow = {
  id: string

  competition_type: string

  taste_duel_execution_mode:
    TasteDuelExecutionMode | null

  status: CompetitionStatus
  max_entries: number
}

type SubmissionSource =
  | 'active_flow'
  | 'visit_history'

type SubmissionRow = {
  id: string
  competition_id: string
  user_id: string
  submission_source: SubmissionSource
  flow_session_id: string | null
  visit_date: string | null
  venue_ids: string[]
  status: string
  submitted_at: string
  competition_entry_id: string | null
}

type VenueRow = {
  id: string
}

// ============================================================
// CONSTANTS
// ============================================================

const ENTRY_SELECT = `
  id,
  competition_id,
  user_id,
  contender_slot,
  source_type,
  source_flow_session_id,
  source_visit_date,
  venue_ids,
  status,
  submitted_at,
  approved_at,
  withdrawn_at,
  disqualified_at,
  created_at,
  updated_at
`

const SUBMISSION_SELECT = `
  id,
  competition_id,
  user_id,
  submission_source,
  flow_session_id,
  visit_date,
  venue_ids,
  status,
  submitted_at,
  competition_entry_id
`

const PROMOTABLE_COMPETITION_STATUSES =
  new Set<CompetitionStatus>([
    'draft',
    'scheduled',
    'live',
  ])

// ============================================================
// POST
// POST /api/venue-admin/competitions/[competitionId]/entries
// ============================================================

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const auth =
      await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const {
      competitionId,
    } = await context.params

    const normalizedCompetitionId =
      competitionId
        ?.trim()
        .toLowerCase()

    if (
      !normalizedCompetitionId ||
      !isValidUuid(
        normalizedCompetitionId
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid competition ID.',
        },
        {
          status: 400,
        }
      )
    }

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as CreateEntryBody

    /**
     * Do not require submission_id before loading the competition.
     *
     * itinerary:
     *
     *   submission_id + contender_slot
     *
     * venue_participation:
     *
     *   contender_slot + venue_ids
     */
    const submissionId =
      typeof body.submission_id ===
        'string'
        ? body.submission_id
            .trim()
            .toLowerCase()
        : ''

    const contenderSlot =
      body.contender_slot

    if (
      typeof contenderSlot !==
        'number' ||
      !Number.isSafeInteger(
        contenderSlot
      ) ||
      contenderSlot <
        1 ||
      contenderSlot >
        4
    ) {
      return noStoreJson(
        {
          error:
            'contender_slot must be an integer between 1 and 4.',
        },
        {
          status: 400,
        }
      )
    }

    const serviceSupabase =
      createCompetitionServiceClient()

    // ========================================================
    // LOAD COMPETITION
    // ========================================================

    const {
      data:
        competitionData,
      error:
        competitionError,
    } = await serviceSupabase
      .from(
        'competitions'
      )
      .select(`
        id,
        competition_type,
        taste_duel_execution_mode,
        status,
        max_entries
      `)
      .eq(
        'id',
        normalizedCompetitionId
      )
      .maybeSingle()

    if (
      competitionError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Competition lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId:
            submissionId ||
            null,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            competitionError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not validate competition.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !competitionData
    ) {
      return noStoreJson(
        {
          error:
            'Competition not found.',
        },
        {
          status: 404,
        }
      )
    }

    const competition =
      competitionData as
        CompetitionRow

    if (
      !PROMOTABLE_COMPETITION_STATUSES.has(
        competition.status
      )
    ) {
      return noStoreJson(
        {
          error:
            'This competition is no longer accepting official contenders.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      contenderSlot >
      competition.max_entries
    ) {
      return noStoreJson(
        {
          error:
            `Contender slot ${contenderSlot} is outside this competition's ${competition.max_entries}-entry limit.`,
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // TASTE DUEL EXECUTION-MODE DISPATCH
    // ========================================================
    //
    // itinerary:
    //
    //   preserve the existing approved-submission promotion path
    //   below exactly.
    //
    // venue_participation:
    //
    //   create an admin-curated side directly from venue IDs.
    //
    //   No:
    //
    //     competition_submission
    //     user owner
    //     Active Flow provenance
    //     Visit History provenance
    //
    // ========================================================

    if (
      competition.competition_type ===
        'taste_duel' &&
      competition.taste_duel_execution_mode ===
        'venue_participation'
    ) {
      return createVenueParticipationEntry({
        serviceSupabase,

        competitionId:
          normalizedCompetitionId,

        contenderSlot,

        venueIdsValue:
          body.venue_ids,

        adminUserId:
          auth.user.id,

        adminEmail:
          auth.user.email,
      })
    }

    if (
      competition.competition_type !==
        'taste_duel' ||
      competition.taste_duel_execution_mode !==
        'itinerary'
    ) {
      return noStoreJson(
        {
          error:
            'Competition does not support this contender creation path.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // ITINERARY SUBMISSION CONTRACT
    // ========================================================

    if (
      !submissionId ||
      !isValidUuid(
        submissionId
      )
    ) {
      return noStoreJson(
        {
          error:
            'Invalid or missing submission_id.',
        },
        {
          status: 400,
        }
      )
    }

    // ========================================================
    // LOAD APPROVED SUBMISSION
    // ========================================================

    const {
      data:
        submissionData,
      error:
        submissionError,
    } = await serviceSupabase
      .from(
        'competition_submissions'
      )
      .select(
        SUBMISSION_SELECT
      )
      .eq(
        'id',
        submissionId
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .maybeSingle()

    if (
      submissionError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Submission lookup failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            submissionError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not load competition submission.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !submissionData
    ) {
      return noStoreJson(
        {
          error:
            'Competition submission not found.',
        },
        {
          status: 404,
        }
      )
    }

    const submission =
      submissionData as
        SubmissionRow

    // ========================================================
    // IDEMPOTENT ALREADY-PROMOTED STATE
    // ========================================================

    if (
      submission.competition_entry_id
    ) {
      const {
        data:
          existingLinkedEntry,
        error:
          existingLinkedEntryError,
      } = await serviceSupabase
        .from(
          'competition_entries'
        )
        .select(
          ENTRY_SELECT
        )
        .eq(
          'id',
          submission.competition_entry_id
        )
        .eq(
          'competition_id',
          normalizedCompetitionId
        )
        .maybeSingle()

      if (
        existingLinkedEntryError
      ) {
        console.error(
          '[venue-admin/competitions/[competitionId]/entries] Existing linked entry lookup failed:',
          {
            competitionId:
              normalizedCompetitionId,

            submissionId,

            competitionEntryId:
              submission.competition_entry_id,

            adminUserId:
              auth.user.id,

            error:
              existingLinkedEntryError,
          }
        )

        return noStoreJson(
          {
            error:
              'Could not validate existing competition entry.',
          },
          {
            status: 500,
          }
        )
      }

      if (
        existingLinkedEntry
      ) {
        return noStoreJson(
          {
            entry:
              existingLinkedEntry,

            submission,

            message:
              'Submission is already an official competition entry.',
          },
          {
            status: 200,
          }
        )
      }

      /**
       * A linked entry ID without a corresponding entry is an
       * invalid persisted state. Do not silently create another.
       */
      return noStoreJson(
        {
          error:
            'Submission references an official entry that could not be found.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      submission.status !==
      'approved'
    ) {
      return noStoreJson(
        {
          error:
            'Only approved submissions can become official competition entries.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // VALIDATE CANONICAL SOURCE EVIDENCE
    // ========================================================

    if (
      !Array.isArray(
        submission.venue_ids
      ) ||
      submission.venue_ids.length <
        3
    ) {
      return noStoreJson(
        {
          error:
            'Submission does not contain enough route evidence to become an official entry.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      submission.submission_source ===
        'active_flow' &&
      !submission.flow_session_id
    ) {
      return noStoreJson(
        {
          error:
            'Approved Active Flow submission is missing its canonical Flow session.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      submission.submission_source ===
        'visit_history' &&
      !submission.visit_date
    ) {
      return noStoreJson(
        {
          error:
            'Approved Visit History submission is missing its canonical visit date.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // VALIDATE SLOT AVAILABILITY
    // ========================================================

    const {
      data:
        occupiedSlotEntry,
      error:
        occupiedSlotError,
    } = await serviceSupabase
      .from(
        'competition_entries'
      )
      .select(
        'id, status'
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .eq(
        'contender_slot',
        contenderSlot
      )
      .in(
        'status',
        [
          'pending',
          'approved',
        ]
      )
      .maybeSingle()

    if (
      occupiedSlotError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Slot validation failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          contenderSlot,

          adminUserId:
            auth.user.id,

          error:
            occupiedSlotError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not validate contender slot.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      occupiedSlotEntry
    ) {
      return noStoreJson(
        {
          error:
            `Contender slot ${contenderSlot} is already occupied.`,
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // PREVENT DUPLICATE ACTIVE ENTRY FOR SAME SUBMISSION SOURCE
    // ========================================================

    let duplicateEntryQuery =
      serviceSupabase
        .from(
          'competition_entries'
        )
        .select(
          'id, contender_slot, status'
        )
        .eq(
          'competition_id',
          normalizedCompetitionId
        )
        .eq(
          'user_id',
          submission.user_id
        )
        .eq(
          'source_type',
          submission.submission_source
        )
        .in(
          'status',
          [
            'pending',
            'approved',
          ]
        )

    if (
      submission.submission_source ===
      'active_flow'
    ) {
      duplicateEntryQuery =
        duplicateEntryQuery.eq(
          'source_flow_session_id',
          submission.flow_session_id
        )
    } else {
      duplicateEntryQuery =
        duplicateEntryQuery.eq(
          'source_visit_date',
          submission.visit_date
        )
    }

    const {
      data:
        duplicateEntry,
      error:
        duplicateEntryError,
    } = await duplicateEntryQuery
      .maybeSingle()

    if (
      duplicateEntryError
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Duplicate entry validation failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          adminUserId:
            auth.user.id,

          error:
            duplicateEntryError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not validate existing competition entry state.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      duplicateEntry
    ) {
      return noStoreJson(
        {
          error:
            'This route is already an official contender in this competition.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // CREATE OFFICIAL ENTRY
    // ========================================================

    const now =
      new Date().toISOString()

    const {
      data:
        entry,
      error:
        insertError,
    } = await serviceSupabase
      .from(
        'competition_entries'
      )
      .insert({
        competition_id:
          normalizedCompetitionId,

        user_id:
          submission.user_id,

        contender_slot:
          contenderSlot,

        source_type:
          submission.submission_source,

        source_flow_session_id:
          submission.submission_source ===
            'active_flow'
            ? submission.flow_session_id
            : null,

        source_visit_date:
          submission.submission_source ===
            'visit_history'
            ? submission.visit_date
            : null,

        venue_ids:
          submission.venue_ids,

        /**
         * This route represents an explicit admin promotion of an
         * already-approved submission, so the resulting contender
         * is immediately approved.
         */
        status:
          'approved',

        submitted_at:
          submission.submitted_at,

        approved_at:
          now,

        withdrawn_at:
          null,

        disqualified_at:
          null,

        updated_at:
          now,
      })
      .select(
        ENTRY_SELECT
      )
      .single()

    if (
      insertError ||
      !entry
    ) {
      const errorCode =
        getPostgresErrorCode(
          insertError
        )

      /**
       * Unique constraints remain the final authority for races
       * between simultaneous admin requests.
       */
      if (
        errorCode ===
        '23505'
      ) {
        return noStoreJson(
          {
            error:
              'This contender slot or submission is already assigned to an official entry.',
          },
          {
            status: 409,
          }
        )
      }

      if (
        errorCode ===
          '23514' ||
        errorCode ===
          'P0001'
      ) {
        console.warn(
          '[venue-admin/competitions/[competitionId]/entries] Entry rejected by database invariant:',
          {
            competitionId:
              normalizedCompetitionId,

            submissionId,

            contenderSlot,

            adminUserId:
              auth.user.id,

            error:
              insertError,
          }
        )

        return noStoreJson(
          {
            error:
              'This submission is no longer eligible to become an official contender.',
          },
          {
            status: 409,
          }
        )
      }

      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Entry insert failed:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          contenderSlot,

          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          error:
            insertError,
        }
      )

      return noStoreJson(
        {
          error:
            'Could not create official competition entry.',
        },
        {
          status: 500,
        }
      )
    }

    // ========================================================
    // LINK SUBMISSION TO ENTRY
    // ========================================================

    const {
      data:
        updatedSubmission,
      error:
        submissionLinkError,
    } = await serviceSupabase
      .from(
        'competition_submissions'
      )
      .update({
        competition_entry_id:
          entry.id,

        updated_at:
          now,
      })
      .eq(
        'id',
        submissionId
      )
      .eq(
        'competition_id',
        normalizedCompetitionId
      )
      .eq(
        'status',
        'approved'
      )
      .is(
        'competition_entry_id',
        null
      )
      .select(
        SUBMISSION_SELECT
      )
      .maybeSingle()

    if (
      submissionLinkError ||
      !updatedSubmission
    ) {
      console.error(
        '[venue-admin/competitions/[competitionId]/entries] Submission link failed; rolling back entry:',
        {
          competitionId:
            normalizedCompetitionId,

          submissionId,

          competitionEntryId:
            entry.id,

          adminUserId:
            auth.user.id,

          error:
            submissionLinkError,
        }
      )

      /**
       * Supabase client calls here are not one SQL transaction.
       * If linking the approved submission fails, remove the entry
       * we just created so the two canonical records cannot drift.
       */
      const {
        error:
          rollbackError,
      } = await serviceSupabase
        .from(
          'competition_entries'
        )
        .delete()
        .eq(
          'id',
          entry.id
        )
        .eq(
          'competition_id',
          normalizedCompetitionId
        )

      if (
        rollbackError
      ) {
        console.error(
          '[venue-admin/competitions/[competitionId]/entries] CRITICAL rollback failure:',
          {
            competitionId:
              normalizedCompetitionId,

            submissionId,

            competitionEntryId:
              entry.id,

            adminUserId:
              auth.user.id,

            error:
              rollbackError,
          }
        )

        return noStoreJson(
          {
            error:
              'Competition entry was created but could not be linked to its submission. Automatic rollback also failed. Manual reconciliation is required.',
          },
          {
            status: 500,
          }
        )
      }

      return noStoreJson(
        {
          error:
            'Submission changed before it could be promoted. Refresh and try again.',
        },
        {
          status: 409,
        }
      )
    }

    // ========================================================
    // SUCCESS
    // ========================================================

    return noStoreJson(
      {
        entry,

        submission:
          updatedSubmission,

        message:
          `Submission promoted to Contender ${contenderSlotLabel(
            contenderSlot
          )}.`,
      },
      {
        status: 201,
      }
    )
  } catch (error) {
    console.error(
      '[venue-admin/competitions/[competitionId]/entries] POST unexpected error:',
      error
    )

    return noStoreJson(
      {
        error:
          'Unexpected error creating official competition entry.',
      },
      {
        status: 500,
      }
    )
  }
}

// ============================================================
// VENUE-PARTICIPATION ENTRY CREATION
// ============================================================
//
// VENUE-PARTICIPATION MODE ONLY.
//
// Curated sides are configuration, not user submissions.
//
// Therefore an official side deliberately has:
//
//   user_id                = NULL
//   source_type            = NULL
//   source_flow_session_id = NULL
//   source_visit_date      = NULL
//
// while:
//
//   venue_ids
//
// contains the canonical configured venues belonging to that side.
//
// Database triggers remain the final authority for:
//
//   - execution-mode semantics
//   - contender-slot limits
//   - duplicate venues within one side
//   - venue exclusivity across sibling sides
// ============================================================

async function createVenueParticipationEntry({
  serviceSupabase,
  competitionId,
  contenderSlot,
  venueIdsValue,
  adminUserId,
  adminEmail,
}: {
  serviceSupabase:
    ReturnType<
      typeof createCompetitionServiceClient
    >

  competitionId:
    string

  contenderSlot:
    number

  venueIdsValue:
    unknown

  adminUserId:
    string

  adminEmail:
    string
}) {
  // ==========================================================
  // NORMALIZE VENUE IDS
  // ==========================================================

  const venueIds =
    normalizeVenueIds(
      venueIdsValue
    )

  if (
    !venueIds ||
    venueIds.length ===
      0
  ) {
    return noStoreJson(
      {
        error:
          'venue_ids must contain at least one valid venue ID.',
      },
      {
        status: 400,
      }
    )
  }

  const uniqueVenueIds =
    [
      ...new Set(
        venueIds
      ),
    ]

  if (
    uniqueVenueIds.length !==
      venueIds.length
  ) {
    return noStoreJson(
      {
        error:
          'venue_ids cannot contain duplicate venues.',
      },
      {
        status: 400,
      }
    )
  }

  // ==========================================================
  // VALIDATE SLOT AVAILABILITY
  // ==========================================================

  const {
    data:
      occupiedSlotEntry,
    error:
      occupiedSlotError,
  } = await serviceSupabase
    .from(
      'competition_entries'
    )
    .select(
      'id, status'
    )
    .eq(
      'competition_id',
      competitionId
    )
    .eq(
      'contender_slot',
      contenderSlot
    )
    .in(
      'status',
      [
        'pending',
        'approved',
      ]
    )
    .maybeSingle()

  if (
    occupiedSlotError
  ) {
    console.error(
      '[venue-admin/competitions/[competitionId]/entries] Venue-participation slot validation failed:',
      {
        competitionId,

        contenderSlot,

        adminUserId,

        adminEmail,

        error:
          occupiedSlotError,
      }
    )

    return noStoreJson(
      {
        error:
          'Could not validate contender slot.',
      },
      {
        status: 500,
      }
    )
  }

  if (
    occupiedSlotEntry
  ) {
    return noStoreJson(
      {
        error:
          `Contender slot ${contenderSlot} is already occupied.`,
      },
      {
        status: 409,
      }
    )
  }

  // ==========================================================
  // VERIFY CANONICAL VENUES EXIST
  // ==========================================================

  const {
    data:
      venueData,
    error:
      venueError,
  } = await serviceSupabase
    .from(
      'venues'
    )
    .select(
      'id'
    )
    .in(
      'id',
      venueIds
    )

  if (
    venueError
  ) {
    console.error(
      '[venue-admin/competitions/[competitionId]/entries] Venue-participation venue validation failed:',
      {
        competitionId,

        contenderSlot,

        venueIds,

        adminUserId,

        adminEmail,

        error:
          venueError,
      }
    )

    return noStoreJson(
      {
        error:
          'Could not validate competition venues.',
      },
      {
        status: 500,
      }
    )
  }

  const existingVenueIds =
    new Set(
      (
        venueData ??
        []
      )
        .map(
          (
            row
          ) =>
            (
              row as VenueRow
            ).id
        )
        .filter(
          (
            venueId
          ): venueId is string =>
            typeof venueId ===
              'string' &&
            venueId.length >
              0
        )
    )

  const missingVenueIds =
    venueIds.filter(
      (
        venueId
      ) =>
        !existingVenueIds.has(
          venueId
        )
    )

  if (
    missingVenueIds.length >
      0
  ) {
    return noStoreJson(
      {
        error:
          'One or more venue_ids do not reference canonical venues.',

        invalidVenueIds:
          missingVenueIds,
      },
      {
        status: 400,
      }
    )
  }

  // ==========================================================
  // CREATE CURATED OFFICIAL ENTRY
  // ==========================================================

  const now =
    new Date()
      .toISOString()

  const {
    data:
      entry,
    error:
      insertError,
  } = await serviceSupabase
    .from(
      'competition_entries'
    )
    .insert({
      competition_id:
        competitionId,

      /**
       * Curated venue-participation sides do not have entrant
       * ownership.
       */
      user_id:
        null,

      contender_slot:
        contenderSlot,

      /**
       * Venue-participation sides do not originate from itinerary
       * evidence.
       */
      source_type:
        null,

      source_flow_session_id:
        null,

      source_visit_date:
        null,

      venue_ids:
        venueIds,

      /**
       * Admin-curated sides become official immediately.
       */
      status:
        'approved',

      submitted_at:
        now,

      approved_at:
        now,

      withdrawn_at:
        null,

      disqualified_at:
        null,

      updated_at:
        now,
    })
    .select(
      ENTRY_SELECT
    )
    .single()

  if (
    insertError ||
    !entry
  ) {
    const errorCode =
      getPostgresErrorCode(
        insertError
      )

    const errorMessage =
      getPostgresErrorMessage(
        insertError
      )

    if (
      errorCode ===
        '23505'
    ) {
      return noStoreJson(
        {
          error:
            'This contender slot is already assigned to an official entry.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      errorMessage?.includes(
        'VENUE_PARTICIPATION_VENUE_ALREADY_ASSIGNED_TO_ANOTHER_ENTRY'
      )
    ) {
      return noStoreJson(
        {
          error:
            'One or more selected venues are already assigned to another active contender.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      errorMessage?.includes(
        'VENUE_PARTICIPATION_ENTRY_CONTAINS_DUPLICATE_VENUES'
      )
    ) {
      return noStoreJson(
        {
          error:
            'venue_ids cannot contain duplicate venues.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      errorCode ===
        '23514' ||
      errorCode ===
        'P0001'
    ) {
      console.warn(
        '[venue-admin/competitions/[competitionId]/entries] Venue-participation entry rejected by database invariant:',
        {
          competitionId,

          contenderSlot,

          venueIds,

          adminUserId,

          error:
            insertError,
        }
      )

      return noStoreJson(
        {
          error:
            'This curated contender does not satisfy the competition entry rules.',
        },
        {
          status: 409,
        }
      )
    }

    console.error(
      '[venue-admin/competitions/[competitionId]/entries] Venue-participation entry insert failed:',
      {
        competitionId,

        contenderSlot,

        venueIds,

        adminUserId,

        adminEmail,

        error:
          insertError,
      }
    )

    return noStoreJson(
      {
        error:
          'Could not create curated competition entry.',
      },
      {
        status: 500,
      }
    )
  }

  // ==========================================================
  // SUCCESS
  // ==========================================================

  return noStoreJson(
    {
      entry,

      /**
       * There is intentionally no competition_submission for a
       * curated venue-participation side.
       */
      submission:
        null,

      message:
        `Curated Contender ${contenderSlotLabel(
          contenderSlot
        )} created.`,
    },
    {
      status: 201,
    }
  )
}

// ============================================================
// ADMIN AUTH
// ============================================================

async function requireAdmin(): Promise<
  | {
      ok: true
      user: {
        id: string
        email: string
      }
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !user
  ) {
    return {
      ok: false,

      response:
        noStoreJson(
          {
            error:
              'User not authenticated.',
          },
          {
            status: 401,
          }
        ),
    }
  }

  const email =
    user.email
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    !email ||
    !ALLOWED_ADMIN_EMAILS.has(
      email
    )
  ) {
    return {
      ok: false,

      response:
        noStoreJson(
          {
            error:
              'Admin access required.',
          },
          {
            status: 403,
          }
        ),
    }
  }

  return {
    ok: true,

    user: {
      id:
        user.id,

      email,
    },
  }
}

// ============================================================
// SERVICE CLIENT
// ============================================================

function createCompetitionServiceClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    supabaseUrl
      .trim()
      .length ===
      0
  ) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not configured.'
    )
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey
      .trim()
      .length ===
      0
  ) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured.'
    )
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    }
  )
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function noStoreJson(
  body: unknown,
  init: {
    status: number
  }
) {
  return NextResponse.json(
    body,
    {
      status:
        init.status,

      headers: {
        'Cache-Control':
          'no-store, max-age=0',
      },
    }
  )
}

// ============================================================
// VALIDATION / HELPERS
// ============================================================

function isValidUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function normalizeVenueIds(
  value: unknown
): string[] | null {
  if (
    !Array.isArray(
      value
    )
  ) {
    return null
  }

  const venueIds:
    string[] =
    []

  for (
    const venueId
    of value
  ) {
    if (
      typeof venueId !==
        'string'
    ) {
      return null
    }

    const normalizedVenueId =
      venueId.trim()

    if (
      normalizedVenueId.length ===
        0
    ) {
      return null
    }

    venueIds.push(
      normalizedVenueId
    )
  }

  return venueIds
}

function getPostgresErrorCode(
  error: unknown
): string | null {
  if (
    !error ||
    typeof error !==
      'object'
  ) {
    return null
  }

  if (
    'code' in error &&
    typeof error.code ===
      'string'
  ) {
    return error.code
  }

  return null
}

function getPostgresErrorMessage(
  error: unknown
): string | null {
  if (
    !error ||
    typeof error !==
      'object'
  ) {
    return null
  }

  if (
    'message' in error &&
    typeof error.message ===
      'string'
  ) {
    return error.message
  }

  return null
}

function contenderSlotLabel(
  slot: number
): string {
  switch (slot) {
    case 1:
      return 'A'

    case 2:
      return 'B'

    case 3:
      return 'C'

    case 4:
      return 'D'

    default:
      return String(
        slot
      )
  }
}