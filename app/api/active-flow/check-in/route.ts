import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

import { rebuildPublicPassportStats } from '@/lib/passport/rebuildPublicPassportStats'

import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'

import { getRoamDay } from '@/lib/roam/roamDay'

type CheckInActiveFlowBody = {
  session_id?: string
  venue_id?: string
  stop_index?: number
  rating?: unknown
  user_lat?: number
  user_lon?: number
  location_accuracy_meters?: number
  device_timestamp?: string
}

type ActiveFlowVenueVisitRow = {
  id: string
  venue_id: string
  rating: number
  visited_at: string
  geo_verified: boolean
  check_in_source: string
}

type CreatorReplayStopAttributionRow = {
  attributed: boolean
  event_id: string | null
  creator_user_id: string
  replay_user_id: string
  snapshot_id: string
  session_id: string
  stop_index: number
  venue_id: string | null
  occurred_at: string | null
}

type CompetitionFlowBridgeRow = {
  competition_id: string
  competition_entry_id: string
  flow_session_id: string
  user_id: string
}

type CompetitionParticipationProgressRow = {
  id: string
  verified_stop_count: number
  total_stop_count: number
}

const BASE_CHECK_IN_RADIUS_METERS = 125
const FLEXIBLE_RADIUS_METERS = 75
const MAX_REASONABLE_ACCURACY_METERS = 250

async function refreshPublicPassportStats(
  userId: string
) {
  try {
    await rebuildPublicPassportStats(
      userId
    )
  } catch (error) {
    console.error(
      '[active-flow/check-in] Failed to rebuild public Passport stats:',
      error
    )
  }
}

/**
 * Competition participation synchronization:
 *
 * Active Flow progress remains the canonical raw evidence.
 *
 * When the Active Flow belongs to a competition entry through
 * competition_flow_sessions, recompute the number of distinct
 * geo-verified route venues and increase the linked
 * competition_participations.verified_stop_count.
 *
 * This operation deliberately:
 *
 *   - detects competition context through the bridge
 *   - counts only geo_verified Active Flow progress
 *   - counts only venues belonging to this Flow's canonical route
 *   - deduplicates venue IDs
 *   - never decreases verified_stop_count
 *   - does not calculate qualification here
 *   - does not alter a successful physical check-in if downstream
 *     competition synchronization temporarily fails
 *
 * A service-role client is required because competition
 * participation state is trusted-server writable rather than
 * browser writable.
 */
async function syncCompetitionParticipationVerifiedProgress({
  sessionId,
  userId,
  routeVenueIds,
}: {
  sessionId: string
  userId: string
  routeVenueIds: string[]
}) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        '[active-flow/check-in] Competition participation sync unavailable: missing Supabase service-role configuration.'
      )

      return
    }

    const serviceSupabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,
          },
        }
      )

    const {
      data: bridge,
      error: bridgeError,
    } = await serviceSupabase
      .from(
        'competition_flow_sessions'
      )
      .select(
        `
          competition_id,
          competition_entry_id,
          flow_session_id,
          user_id
        `
      )
      .eq(
        'flow_session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle<CompetitionFlowBridgeRow>()

    if (bridgeError) {
      console.error(
        '[active-flow/check-in] Competition Flow bridge lookup failed:',
        {
          sessionId,
          userId,
          error:
            bridgeError,
        }
      )

      return
    }

    if (!bridge) {
      return
    }

    const {
      data: participation,
      error: participationError,
    } = await serviceSupabase
      .from(
        'competition_participations'
      )
      .select(
        `
          id,
          verified_stop_count,
          total_stop_count
        `
      )
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .eq(
        'competition_entry_id',
        bridge.competition_entry_id
      )
      .eq(
        'flow_session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle<CompetitionParticipationProgressRow>()

    if (participationError) {
      console.error(
        '[active-flow/check-in] Competition participation lookup failed:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          error:
            participationError,
        }
      )

      return
    }

    if (!participation) {
      console.error(
        '[active-flow/check-in] Competition Flow bridge exists without linked participation:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
        }
      )

      return
    }

    const canonicalRouteVenueIds =
      new Set(
        routeVenueIds.filter(
          (
            routeVenueId
          ): routeVenueId is string =>
            typeof routeVenueId ===
              'string' &&
            routeVenueId.length >
              0
        )
      )

    const {
      data: verifiedProgressRows,
      error: verifiedProgressError,
    } = await serviceSupabase
      .from(
        'active_flow_progress'
      )
      .select(
        'venue_id'
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )
      .eq(
        'geo_verified',
        true
      )

    if (verifiedProgressError) {
      console.error(
        '[active-flow/check-in] Competition verified progress lookup failed:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          error:
            verifiedProgressError,
        }
      )

      return
    }

    const verifiedVenueIds =
      new Set(
        (
          verifiedProgressRows ??
          []
        )
          .map(
            (
              row
            ) =>
              row.venue_id
          )
          .filter(
            (
              progressVenueId
            ): progressVenueId is string =>
              typeof progressVenueId ===
                'string' &&
              canonicalRouteVenueIds.has(
                progressVenueId
              )
          )
      )

    const canonicalVerifiedStopCount =
      Math.min(
        verifiedVenueIds.size,
        participation.total_stop_count
      )

    /**
     * The database already rejects regression, but avoid issuing
     * an unnecessary UPDATE when there is no increase.
     */
    if (
      canonicalVerifiedStopCount <=
      participation.verified_stop_count
    ) {
      return
    }

    const {
      error: updateError,
    } = await serviceSupabase
      .from(
        'competition_participations'
      )
      .update({
        verified_stop_count:
          canonicalVerifiedStopCount,

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        'id',
        participation.id
      )
      .eq(
        'competition_id',
        bridge.competition_id
      )
      .eq(
        'competition_entry_id',
        bridge.competition_entry_id
      )
      .eq(
        'flow_session_id',
        sessionId
      )
      .eq(
        'user_id',
        userId
      )

    if (updateError) {
      console.error(
        '[active-flow/check-in] Competition participation verified-stop sync failed:',
        {
          sessionId,
          userId,
          competitionId:
            bridge.competition_id,
          competitionEntryId:
            bridge.competition_entry_id,
          participationId:
            participation.id,
          verifiedStopCount:
            canonicalVerifiedStopCount,
          error:
            updateError,
        }
      )
    }
  } catch (error) {
    console.error(
      '[active-flow/check-in] Unexpected competition participation sync failure:',
      {
        sessionId,
        userId,
        error,
      }
    )
  }
}

/**
 * Creator replay attribution:
 *
 * Replay creator credit is recorded only through the hardened
 * canonical Postgres RPC.
 *
 * The application supplies only:
 *
 *   - replay session ID
 *   - canonical stop index
 *
 * Creator identity, snapshot identity, venue identity, verified
 * progress, replay eligibility, and self-replay suppression are
 * all resolved and enforced by the database function.
 *
 * Attribution is intentionally best-effort relative to the
 * user's already-successful physical check-in. Failure to record
 * creator attribution must never roll back or invalidate genuine
 * user progress.
 *
 * The RPC itself is lifetime-idempotent, so this may also be
 * called for an existing progress row to repair attribution that
 * may have been missed by an earlier application version or
 * transient request failure.
 */
async function recordCreatorReplayStopAttribution({
  supabase,
  sessionId,
  stopIndex,
  source,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  sessionId: string
  stopIndex: number
  source: unknown
}): Promise<
  CreatorReplayStopAttributionRow | null
> {
  if (
    source !==
    'flow_snapshot'
  ) {
    return null
  }

  try {
    const {
      data,
      error,
    } = await supabase.rpc(
      'record_creator_replay_stop',
      {
        p_session_id:
          sessionId,

        p_stop_index:
          stopIndex,
      }
    )

    if (error) {
      console.error(
        '[active-flow/check-in] Creator replay stop attribution failed:',
        {
          sessionId,
          stopIndex,
          error,
        }
      )

      return null
    }

    const row =
      Array.isArray(data)
        ? data[0]
        : data

    if (
      !row ||
      typeof row !==
        'object'
    ) {
      console.warn(
        '[active-flow/check-in] Creator replay stop attribution returned no canonical row:',
        {
          sessionId,
          stopIndex,
        }
      )

      return null
    }

    return row as
      CreatorReplayStopAttributionRow
  } catch (error) {
    console.error(
      '[active-flow/check-in] Unexpected creator replay stop attribution failure:',
      {
        sessionId,
        stopIndex,
        error,
      }
    )

    return null
  }
}

export async function POST(
  req: Request
) {
  try {
    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'User not authenticated',
        },
        {
          status:
            401,
        }
      )
    }

    const body =
      (await req.json()) as
        CheckInActiveFlowBody

    const sessionId =
      body.session_id

    const venueId =
      body.venue_id

    const stopIndex =
      body.stop_index

    const rating =
      body.rating

    const userLat =
      body.user_lat

    const userLon =
      body.user_lon

    const locationAccuracyMeters =
      body.location_accuracy_meters

    const deviceTimestamp =
      body.device_timestamp

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'Missing session_id.',
        },
        {
          status:
            400,
        }
      )
    }

    if (!venueId) {
      return NextResponse.json(
        {
          error:
            'Missing venue_id.',
        },
        {
          status:
            400,
        }
      )
    }

    if (
      typeof stopIndex !==
        'number' ||
      !Number.isInteger(
        stopIndex
      ) ||
      stopIndex < 0
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid stop_index.',
        },
        {
          status:
            400,
        }
      )
    }

    /**
     * venue_visits.rating is required.
     *
     * Validate the real user-supplied rating before either
     * active_flow_progress or venue_visits is written.
     */
    if (
      !isValidRating(
        rating
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Rating must be an integer between 1 and 5.',
        },
        {
          status:
            400,
        }
      )
    }

    if (
      !isValidLatitude(
        userLat
      ) ||
      !isValidLongitude(
        userLon
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Location is required to check in.',
        },
        {
          status:
            400,
        }
      )
    }

    if (
      typeof locationAccuracyMeters ===
        'number' &&
      Number.isFinite(
        locationAccuracyMeters
      ) &&
      locationAccuracyMeters >
        MAX_REASONABLE_ACCURACY_METERS
    ) {
      return NextResponse.json(
        {
          error:
            'We could not confirm your location accurately enough. Try again closer to the venue entrance.',
        },
        {
          status:
            400,
        }
      )
    }

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .select(
        'id, user_id, venue_ids, status, source, source_id, title, city, metadata, completed_stops'
      )
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle()

    if (sessionError) {
      console.error(
        '[active-flow/check-in] Session fetch failed:',
        sessionError
      )

      return NextResponse.json(
        {
          error:
            'Could not fetch active flow.',
        },
        {
          status:
            500,
        }
      )
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            'Flow not found.',
        },
        {
          status:
            404,
        }
      )
    }

    if (
      session.status !==
      'active'
    ) {
      return NextResponse.json(
        {
          error:
            'Only active flows can be checked into.',
        },
        {
          status:
            400,
        }
      )
    }

    const venueIds =
      Array.isArray(
        session.venue_ids
      )
        ? session.venue_ids.filter(
            Boolean
          )
        : []

    if (
      !venueIds.includes(
        venueId
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Venue is not part of this flow.',
        },
        {
          status:
            400,
        }
      )
    }

    if (
      venueIds[
        stopIndex
      ] !== venueId
    ) {
      return NextResponse.json(
        {
          error:
            'Stop index does not match this venue.',
        },
        {
          status:
            400,
        }
      )
    }

    const {
      data: venue,
      error: venueError,
    } = await supabase
      .from(
        'venues'
      )
      .select(
        'id, lat, lon, city'
      )
      .eq(
        'id',
        venueId
      )
      .maybeSingle()

    if (venueError) {
      console.error(
        '[active-flow/check-in] Venue fetch failed:',
        venueError
      )

      return NextResponse.json(
        {
          error:
            'Could not verify venue location.',
        },
        {
          status:
            500,
        }
      )
    }

    if (
      !venue ||
      !isValidLatitude(
        venue.lat
      ) ||
      !isValidLongitude(
        venue.lon
      )
    ) {
      return NextResponse.json(
        {
          error:
            'This venue does not have a valid check-in location.',
        },
        {
          status:
            400,
        }
      )
    }

    const distanceMeters =
      calculateDistanceMeters({
        fromLat:
          userLat,

        fromLon:
          userLon,

        toLat:
          venue.lat,

        toLon:
          venue.lon,
      })

    const accuracyBuffer =
      typeof locationAccuracyMeters ===
        'number' &&
      Number.isFinite(
        locationAccuracyMeters
      )
        ? locationAccuracyMeters
        : 0

    const geoVerified =
      distanceMeters <=
        BASE_CHECK_IN_RADIUS_METERS ||
      distanceMeters <=
        FLEXIBLE_RADIUS_METERS +
          accuracyBuffer

    if (!geoVerified) {
      return NextResponse.json(
        {
          error:
            'You need to be closer to this venue to check in.',

          distanceMeters:
            Math.round(
              distanceMeters
            ),

          requiredDistanceMeters:
            BASE_CHECK_IN_RADIUS_METERS,
        },
        {
          status:
            400,
        }
      )
    }

    const now =
      new Date()
        .toISOString()

    const normalizedLocationAccuracyMeters =
      typeof locationAccuracyMeters ===
        'number' &&
      Number.isFinite(
        locationAccuracyMeters
      )
        ? locationAccuracyMeters
        : null

    const normalizedDeviceTimestamp =
      typeof deviceTimestamp ===
        'string' &&
      deviceTimestamp
        .trim()
        .length > 0
        ? deviceTimestamp
        : null

    /**
     * Idempotency boundary.
     *
     * active_flow_progress is the canonical proof that this exact
     * session stop has already been completed. A retry must reuse
     * that event instead of upserting it with a new checked_in_at
     * timestamp and then manufacturing another venue_visits row.
     */
    const {
      data: existingProgress,
      error:
        existingProgressError,
    } = await supabase
      .from(
        'active_flow_progress'
      )
      .select(
        '*'
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'venue_id',
        venueId
      )
      .maybeSingle()

    if (
      existingProgressError
    ) {
      console.error(
        '[active-flow/check-in] Existing progress lookup failed:',
        existingProgressError
      )

      return NextResponse.json(
        {
          error:
            'Could not verify existing flow progress.',
        },
        {
          status:
            500,
        }
      )
    }

    if (existingProgress) {
      const canonicalVisitedAt =
        typeof existingProgress.checked_in_at ===
          'string' &&
        existingProgress.checked_in_at
          .trim()
          .length > 0
          ? existingProgress.checked_in_at
          : null

      let venueVisit:
        ActiveFlowVenueVisitRow | null =
        null

      let repairedVenueVisit =
        false

      if (canonicalVisitedAt) {
        const {
          data:
            existingVenueVisit,
          error:
            existingVenueVisitError,
        } = await supabase
          .from(
            'venue_visits'
          )
          .select(`
            id,
            venue_id,
            rating,
            visited_at,
            geo_verified,
            check_in_source
          `)
          .eq(
            'user_id',
            user.id
          )
          .eq(
            'venue_id',
            venueId
          )
          .eq(
            'check_in_source',
            'active_flow'
          )
          .eq(
            'visited_at',
            canonicalVisitedAt
          )
          .limit(
            1
          )
          .maybeSingle<ActiveFlowVenueVisitRow>()

        if (
          existingVenueVisitError
        ) {
          console.error(
            '[active-flow/check-in] Existing canonical venue visit lookup failed:',
            existingVenueVisitError
          )

          return NextResponse.json(
            {
              error:
                'The check-in already exists, but its venue visit could not be verified.',
            },
            {
              status:
                500,
            }
          )
        }

        venueVisit =
          existingVenueVisit
      }

      /**
       * Legacy repair:
       *
       * A historical progress row may predate venue_visits
       * synchronization or may have survived an earlier partial
       * request failure. Only create the missing canonical visit
       * when no matching active-flow visit exists.
       */
      if (!venueVisit) {
        const repairVisitedAt =
          canonicalVisitedAt ??
          now

        const {
          data:
            repairedVenueVisitRow,
          error:
            repairedVenueVisitError,
        } = await supabase
          .from(
            'venue_visits'
          )
          .insert({
            user_id:
              user.id,

            venue_id:
              venueId,

            rating,

            visited_at:
              repairVisitedAt,

            user_lat:
              typeof existingProgress.user_lat ===
                'number'
                ? existingProgress.user_lat
                : userLat,

            user_lon:
              typeof existingProgress.user_lon ===
                'number'
                ? existingProgress.user_lon
                : userLon,

            distance_meters:
              typeof existingProgress.distance_meters ===
                'number'
                ? existingProgress.distance_meters
                : distanceMeters,

            location_accuracy_meters:
              typeof existingProgress.location_accuracy_meters ===
                'number'
                ? existingProgress.location_accuracy_meters
                : normalizedLocationAccuracyMeters,

            geo_verified:
              existingProgress.geo_verified ===
              true,

            check_in_source:
              'active_flow',

            device_timestamp:
              typeof existingProgress.device_timestamp ===
                'string'
                ? existingProgress.device_timestamp
                : normalizedDeviceTimestamp,

            updated_at:
              now,
          })
          .select(`
            id,
            venue_id,
            rating,
            visited_at,
            geo_verified,
            check_in_source
          `)
          .single<ActiveFlowVenueVisitRow>()

        if (
          repairedVenueVisitError ||
          !repairedVenueVisitRow
        ) {
          console.error(
            '[active-flow/check-in] Existing progress venue visit repair failed:',
            {
              userId:
                user.id,

              venueId,

              sessionId,

              stopIndex,

              error:
                repairedVenueVisitError,
            }
          )

          return NextResponse.json(
            {
              error:
                'The check-in already exists, but its venue visit could not be recorded.',
            },
            {
              status:
                500,
            }
          )
        }

        venueVisit =
          repairedVenueVisitRow

        repairedVenueVisit =
          true
      }

      const {
        data: progressRows,
        error: progressError,
      } = await supabase
        .from(
          'active_flow_progress'
        )
        .select(
          'venue_id'
        )
        .eq(
          'session_id',
          sessionId
        )
        .eq(
          'user_id',
          user.id
        )

      if (progressError) {
        console.error(
          '[active-flow/check-in] Progress refresh failed:',
          progressError
        )

        return NextResponse.json(
          {
            error:
              'Check-in saved, but progress could not be refreshed.',
          },
          {
            status:
              500,
          }
        )
      }

      const completedVenueIds =
        new Set(
          (
            progressRows ??
            []
          )
            .map(
              (
                row
              ) =>
                row.venue_id
            )
            .filter(
              Boolean
            )
        )

      const completedStops =
        completedVenueIds.size

      const totalStops =
        venueIds.length

      const flowCompleted =
        completedStops ===
        totalStops

      const {
        error:
          sessionProgressUpdateError,
      } = await supabase
        .from(
          'active_flow_sessions'
        )
        .update({
          completed_stops:
            completedStops,

          updated_at:
            now,
        } as any)
        .eq(
          'id',
          sessionId
        )
        .eq(
          'user_id',
          user.id
        )

      if (
        sessionProgressUpdateError
      ) {
        console.error(
          '[active-flow/check-in] Session completed_stops cache update failed:',
          sessionProgressUpdateError
        )
      }

      /**
       * Competition participation progress repair / idempotency.
       *
       * If this existing verified progress belongs to a
       * competition-linked Flow, re-run synchronization so a
       * previously missed participation update can repair itself.
       */
      if (
        existingProgress.geo_verified ===
        true
      ) {
        await syncCompetitionParticipationVerifiedProgress({
          sessionId,

          userId:
            user.id,

          routeVenueIds:
            venueIds,
        })
      }

      /**
       * Replay attribution repair / idempotency:
       *
       * Even though this stop already has canonical progress,
       * call the attribution RPC again for snapshot replays.
       *
       * The database unique boundary prevents duplicate creator
       * credit while allowing a previously missed attribution
       * event to be repaired.
       */
      const replayAttribution =
        await recordCreatorReplayStopAttribution({
          supabase,
          sessionId,
          stopIndex,
          source:
            session.source,
        })

      /**
       * A pure retry has not created new canonical evidence and
       * therefore does not need another Passport/reputation
       * rebuild. A repaired missing venue visit does.
       */
      if (repairedVenueVisit) {
        await refreshPublicPassportStats(
          user.id
        )

        await safelyRefreshCreatorReputation(
          user.id,
          {
            mutation:
              'active_flow_check_in',

            rankingRefreshMode:
              'affected',

            calculatedAt:
              now,
          }
        )
      }

      return NextResponse.json(
        {
          progress:
            existingProgress,

          venueVisit,

          completedStops,

          totalStops,

          flowCompleted,

          xpEarned:
            0,

          geoVerified:
            existingProgress.geo_verified ===
            true,

          distanceMeters:
            Math.round(
              typeof existingProgress.distance_meters ===
                'number'
                ? existingProgress.distance_meters
                : distanceMeters
            ),

          source:
            session.source ??
            null,

          sourceId:
            session.source_id ??
            null,

          replayAttribution:
            replayAttribution
              ? {
                  attributed:
                    replayAttribution.attributed,

                  creatorUserId:
                    replayAttribution.creator_user_id,

                  snapshotId:
                    replayAttribution.snapshot_id,

                  eventId:
                    replayAttribution.event_id,
                }
              : null,
        },
        {
          status:
            200,
        }
      )
    }

    /**
     * A new flow stop must not manufacture a second historical
     * venue visit during the same Roam day.
     */
    if (
      typeof venue.city ===
        'string' &&
      venue.city
        .trim()
        .length > 0
    ) {
      const {
        data:
          latestVenueVisit,
        error:
          latestVenueVisitError,
      } = await supabase
        .from(
          'venue_visits'
        )
        .select(
          'visited_at'
        )
        .eq(
          'user_id',
          user.id
        )
        .eq(
          'venue_id',
          venueId
        )
        .order(
          'visited_at',
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle()

      if (
        latestVenueVisitError
      ) {
        console.error(
          '[active-flow/check-in] Latest venue visit lookup failed:',
          latestVenueVisitError
        )

        return NextResponse.json(
          {
            error:
              'Could not verify existing venue visit.',
          },
          {
            status:
              500,
          }
        )
      }

      if (
        latestVenueVisit?.visited_at &&
        isSameRoamDay(
          latestVenueVisit.visited_at,
          now,
          venue.city
        )
      ) {
        return NextResponse.json(
          {
            error:
              'You have already checked in to this venue today. Try again on a different day.',
          },
          {
            status:
              409,
          }
        )
      }
    }

    const {
      data: progress,
      error: upsertError,
    } = await supabase
      .from(
        'active_flow_progress'
      )
      .upsert(
        {
          session_id:
            sessionId,

          user_id:
            user.id,

          venue_id:
            venueId,

          stop_index:
            stopIndex,

          checked_in_at:
            now,

          user_lat:
            userLat,

          user_lon:
            userLon,

          distance_meters:
            distanceMeters,

          location_accuracy_meters:
            normalizedLocationAccuracyMeters,

          geo_verified:
            true,

          check_in_source:
            'geo',

          device_timestamp:
            normalizedDeviceTimestamp,
        },
        {
          onConflict:
            'session_id,user_id,venue_id',
        }
      )
      .select(
        '*'
      )
      .single()

    if (
      upsertError ||
      !progress
    ) {
      console.error(
        '[active-flow/check-in] Check-in upsert failed:',
        upsertError
      )

      return NextResponse.json(
        {
          error:
            'Could not check in.',
        },
        {
          status:
            500,
        }
      )
    }

    /**
     * Synchronize the verified active-flow check-in into the
     * canonical venue_visits relationship used by Passport stats
     * and public Creator Exploration Maps.
     *
     * A real rating is included because venue_visits.rating is
     * intentionally non-nullable.
     */
    const {
      data: venueVisit,
      error: venueVisitError,
    } = await supabase
      .from(
        'venue_visits'
      )
      .insert({
        user_id:
          user.id,

        venue_id:
          venueId,

        rating,

        visited_at:
          now,

        user_lat:
          userLat,

        user_lon:
          userLon,

        distance_meters:
          distanceMeters,

        location_accuracy_meters:
          normalizedLocationAccuracyMeters,

        geo_verified:
          true,

        check_in_source:
          'active_flow',

        device_timestamp:
          normalizedDeviceTimestamp,

        updated_at:
          now,
      })
      .select(`
        id,
        venue_id,
        rating,
        visited_at,
        geo_verified,
        check_in_source
      `)
      .single<ActiveFlowVenueVisitRow>()

    if (
      venueVisitError ||
      !venueVisit
    ) {
      console.error(
        '[active-flow/check-in] Venue visit sync failed:',
        {
          userId:
            user.id,

          venueId,

          sessionId,

          stopIndex,

          error:
            venueVisitError,
        }
      )

      return NextResponse.json(
        {
          error:
            'The check-in was verified, but the venue visit could not be recorded.',
        },
        {
          status:
            500,
        }
      )
    }

    const {
      data: progressRows,
      error: progressError,
    } = await supabase
      .from(
        'active_flow_progress'
      )
      .select(
        'venue_id'
      )
      .eq(
        'session_id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )

    if (progressError) {
      console.error(
        '[active-flow/check-in] Progress refresh failed:',
        progressError
      )

      return NextResponse.json(
        {
          error:
            'Check-in saved, but progress could not be refreshed.',
        },
        {
          status:
            500,
        }
      )
    }

    const completedVenueIds =
      new Set(
        (
          progressRows ??
          []
        )
          .map(
            (
              row
            ) =>
              row.venue_id
          )
          .filter(
            Boolean
          )
      )

    const completedStops =
      completedVenueIds.size

    const totalStops =
      venueIds.length

    const flowCompleted =
      completedStops ===
      totalStops

    const {
      error:
        sessionProgressUpdateError,
    } = await supabase
      .from(
        'active_flow_sessions'
      )
      .update({
        completed_stops:
          completedStops,

        updated_at:
          now,
      } as any)
      .eq(
        'id',
        sessionId
      )
      .eq(
        'user_id',
        user.id
      )

    if (
      sessionProgressUpdateError
    ) {
      console.error(
        '[active-flow/check-in] Session completed_stops cache update failed:',
        sessionProgressUpdateError
      )
    }

    /**
     * Competition participation synchronization:
     *
     * The physical check-in has now been canonically persisted as
     * geo-verified Active Flow progress.
     *
     * If this Flow is connected to a competition entry through
     * competition_flow_sessions, synchronize the linked
     * competition_participations verified-stop aggregate.
     */
    await syncCompetitionParticipationVerifiedProgress({
      sessionId,

      userId:
        user.id,

      routeVenueIds:
        venueIds,
    })

    /**
     * Creator replay attribution:
     *
     * Only flow_snapshot sessions reach the RPC.
     *
     * This happens after both canonical verified progress and
     * venue_visits evidence have successfully persisted.
     *
     * The RPC verifies the immutable snapshot stop and records
     * lifetime-idempotent creator attribution. Attribution
     * failure remains non-fatal to the user's successful
     * physical check-in.
     */
    const replayAttribution =
      await recordCreatorReplayStopAttribution({
        supabase,
        sessionId,
        stopIndex,
        source:
          session.source,
      })

    await refreshPublicPassportStats(
      user.id
    )

    /**
     * Refresh creator reputation only after the canonical
     * verified venue visit and active-flow progress writes have
     * succeeded.
     *
     * The safe refresh boundary records failures without
     * invalidating the completed user check-in.
     */
    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          'active_flow_check_in',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          now,
      }
    )

    return NextResponse.json(
      {
        progress,

        venueVisit,

        completedStops,

        totalStops,

        flowCompleted,

        xpEarned:
          25,

        geoVerified:
          true,

        distanceMeters:
          Math.round(
            distanceMeters
          ),

        source:
          session.source ??
          null,

        sourceId:
          session.source_id ??
          null,

        replayAttribution:
          replayAttribution
            ? {
                attributed:
                  replayAttribution.attributed,

                creatorUserId:
                  replayAttribution.creator_user_id,

                snapshotId:
                  replayAttribution.snapshot_id,

                eventId:
                  replayAttribution.event_id,
              }
            : null,
      },
      {
        status:
          200,
      }
    )
  } catch (err) {
    console.error(
      '[active-flow/check-in] Unexpected error:',
      err
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error checking in.',
      },
      {
        status:
          500,
      }
    )
  }
}

function isSameRoamDay(
  firstValue: string,
  secondValue: string,
  city: string
): boolean {
  const firstRoamDay =
    getRoamDay(
      firstValue,
      city
    )

  const secondRoamDay =
    getRoamDay(
      secondValue,
      city
    )

  return (
    firstRoamDay !==
      null &&
    secondRoamDay !==
      null &&
    firstRoamDay ===
      secondRoamDay
  )
}

function isValidRating(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >= 1 &&
    value <= 5
  )
}

function isValidLatitude(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -90 &&
    value <= 90
  )
}

function isValidLongitude(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -180 &&
    value <= 180
  )
}

function calculateDistanceMeters({
  fromLat,
  fromLon,
  toLat,
  toLon,
}: {
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}) {
  const earthRadiusMeters =
    6371000

  const fromLatRad =
    degreesToRadians(
      fromLat
    )

  const toLatRad =
    degreesToRadians(
      toLat
    )

  const deltaLatRad =
    degreesToRadians(
      toLat -
        fromLat
    )

  const deltaLonRad =
    degreesToRadians(
      toLon -
        fromLon
    )

  const a =
    Math.sin(
      deltaLatRad /
        2
    ) *
      Math.sin(
        deltaLatRad /
          2
      ) +
    Math.cos(
      fromLatRad
    ) *
      Math.cos(
        toLatRad
      ) *
      Math.sin(
        deltaLonRad /
          2
      ) *
      Math.sin(
        deltaLonRad /
          2
      )

  const c =
    2 *
    Math.atan2(
      Math.sqrt(
        a
      ),
      Math.sqrt(
        1 -
          a
      )
    )

  return (
    earthRadiusMeters *
    c
  )
}

function degreesToRadians(
  value: number
) {
  return (
    value *
    Math.PI
  ) / 180
}