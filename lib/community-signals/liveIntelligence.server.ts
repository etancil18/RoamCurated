import 'server-only'

import type {
  SupabaseClient,
} from '@supabase/supabase-js'

import {
  buildCommunityEventIntelligenceId,
  buildCommunityPlaceSignalIntelligenceId,
  isCommunityEventConfidenceBand,
  isCommunityPlaceSignalPosture,
  isCommunityPlaceSignalState,
  isCommunityPlaceSignalType,
  type CommunityEventIntelligence,
  type CommunityLiveIntelligence,
  type CommunityPlaceSignalIntelligence,
  type CommunityPlaceSignalType,
} from '@/lib/community-signals/liveIntelligence'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

type DiscoverableCommunityEventRow = {
  event_id: string
  occurrence_id: string
  confidence_band: string
}

type EventOccurrenceConfidenceRow = {
  occurrence_id: string
  unique_confirmers: number
}

type CommunityEventRow = {
  id: string
  venue_id: string
  title: string | null
  starts_at: string | null
  ends_at: string | null
  timezone: string | null
  is_active: boolean | null
  source: string | null
  source_type: string | null
}

/**
 * Runtime shape of the 020E RPC.
 *
 * Nullable fields are intentionally represented accurately here
 * even if generated Supabase RPC types currently describe some of
 * them as non-null strings.
 */
type CurrentPlaceSignalRow = {
  venue_id: string
  signal_type: string
  current_state: string | null
  is_current: boolean
  fresh_contributors: number
  supporting_contributors: number
  opposing_contributors: number
  proximity_verified_contributors: number
  latest_observed_at: string | null
  expires_at: string | null
  current_posture: string
}

function assertValidAsOf(
  asOf: Date
): string {
  if (
    Number.isNaN(
      asOf.getTime()
    )
  ) {
    throw new Error(
      '[community-signals/live-intelligence] asOf must be a valid date.'
    )
  }

  return asOf.toISOString()
}

function normalizeCommunityEvent({
  event,
  discovery,
  confirmingContributors,
}: {
  event: CommunityEventRow
  discovery: DiscoverableCommunityEventRow
  confirmingContributors: number
}): CommunityEventIntelligence | null {
  /**
   * Defense in depth.
   *
   * 012B is authoritative for discoverability, but this adapter
   * still refuses to normalize a row that is not the frozen
   * canonical Community Signals event shape.
   */
  if (
    event.source !== 'community' ||
    event.source_type !== 'community_signal' ||
    event.is_active !== true
  ) {
    return null
  }

  if (
    !event.id ||
    !event.venue_id ||
    !event.title ||
    !event.starts_at ||
    !discovery.occurrence_id ||
    !isCommunityEventConfidenceBand(
      discovery.confidence_band
    ) ||
    !Number.isInteger(
      confirmingContributors
    ) ||
    confirmingContributors < 0
  ) {
    return null
  }

  return {
    kind: 'event',

    intelligenceId:
      buildCommunityEventIntelligenceId(
        event.id
      ),

    venueId:
      event.venue_id,

    eventId:
      event.id,

    occurrenceId:
      discovery.occurrence_id,

    confidenceBand:
      discovery.confidence_band,

    confirmingContributors,

    title:
      event.title,

    startsAt:
      event.starts_at,

    endsAt:
      event.ends_at,

    timezone:
      event.timezone,
  }
}

function normalizeCurrentPlaceSignal(
  row: CurrentPlaceSignalRow
): CommunityPlaceSignalIntelligence | null {
  /**
   * 020E deliberately returns one row even when no current signal
   * exists.
   *
   * The normalized live-intelligence seam exposes only intelligence
   * that is current at the requested asOf.
   */
  if (
    row.is_current !== true
  ) {
    return null
  }

  if (
    !row.venue_id ||
    !isCommunityPlaceSignalType(
      row.signal_type
    ) ||
    !isCommunityPlaceSignalState(
      row.current_state
    ) ||
    !isCommunityPlaceSignalPosture(
      row.current_posture
    ) ||
    !Number.isInteger(
      row.supporting_contributors
    ) ||
    row.supporting_contributors < 0 ||
    !row.latest_observed_at ||
    !row.expires_at
  ) {
    return null
  }

  return {
    kind:
      'place_signal',

    intelligenceId:
      buildCommunityPlaceSignalIntelligenceId({
        venueId:
          row.venue_id,

        signalType:
          row.signal_type,
      }),

    venueId:
      row.venue_id,

    signalType:
      row.signal_type,

    signalState:
      row.current_state,

    posture:
      row.current_posture,

    supportingContributors:
      row.supporting_contributors,

    observedAt:
      row.latest_observed_at,

    expiresAt:
      row.expires_at,
  }
}

/**
 * Load canonical Community Signals events that are currently
 * discoverable according to the frozen V1 event trust authority.
 *
 * Authority:
 *
 * get_discoverable_community_event_ids
 *
 * This function does NOT reproduce:
 *
 * - occurrence confidence rules
 * - correction rules
 * - canonicalization rules
 * - discovery eligibility
 * - event trust rules
 */
export async function loadDiscoverableCommunityEventIntelligence({
  asOf = new Date(),
  supabase: providedSupabase,
}: {
  asOf?: Date
  supabase?: SupabaseClient
} = {}): Promise<CommunityEventIntelligence[]> {
  const asOfIso =
    assertValidAsOf(
      asOf
    )

  const supabase =
    providedSupabase ??
    getSupabaseAdmin()

  const {
    data: discoveryRows,
    error: discoveryError,
  } = await supabase.rpc(
    'get_discoverable_community_event_ids',
    {
      p_as_of:
        asOfIso,
    }
  )

  if (
    discoveryError
  ) {
    throw new Error(
      `[community-signals/live-intelligence] Failed to load discoverable community events: ${discoveryError.message}`
    )
  }

  const discoveries =
    (discoveryRows ??
      []) as DiscoverableCommunityEventRow[]

  if (
    discoveries.length === 0
  ) {
    return []
  }

  const discoveryByEventId =
    new Map<
      string,
      DiscoverableCommunityEventRow
    >()

  for (
    const discovery of
      discoveries
  ) {
    if (
      !discovery.event_id ||
      !discovery.occurrence_id ||
      !isCommunityEventConfidenceBand(
        discovery.confidence_band
      )
    ) {
      continue
    }

    /**
     * 012B guarantees one row per canonical event.
     *
     * The map also makes this adapter deterministic and prevents
     * accidental duplicate normalized intelligence if malformed
     * rows ever reach this boundary.
     */
    discoveryByEventId.set(
      discovery.event_id,
      discovery
    )
  }

  const eventIds =
    Array.from(
      discoveryByEventId.keys()
    )

  if (
    eventIds.length === 0
  ) {
    return []
  }

  const confidenceByOccurrenceId =
    new Map<
      string,
      number
    >()

  await Promise.all(
    Array.from(
      discoveryByEventId.values()
    ).map(
      async (
        discovery
      ) => {
        const {
          data,
          error,
        } = await supabase.rpc(
          'get_event_occurrence_confidence',
          {
            p_occurrence_id:
              discovery.occurrence_id,
          }
        )

        if (
          error
        ) {
          throw new Error(
            `[community-signals/live-intelligence] Failed to load event occurrence confidence: ${error.message}`
          )
        }

        const rows =
          (data ??
            []) as EventOccurrenceConfidenceRow[]

        if (
          rows.length !== 1
        ) {
          throw new Error(
            '[community-signals/live-intelligence] Event occurrence confidence returned an unexpected row count.'
          )
        }

        const row =
          rows[0]

        if (
          row.occurrence_id !==
            discovery.occurrence_id ||
          !Number.isInteger(
            row.unique_confirmers
          ) ||
          row.unique_confirmers < 0
        ) {
          throw new Error(
            '[community-signals/live-intelligence] Event occurrence confidence returned an invalid confirmation count.'
          )
        }

        confidenceByOccurrenceId.set(
          discovery.occurrence_id,
          row.unique_confirmers
        )
      }
    )
  )

  /**
   * Keep this as a literal selection string.
   *
   * Supabase's TypeScript query parser can infer this result shape
   * from a literal. Building the string dynamically with join()
   * widens it to `string` and produces GenericStringError[].
   */
  const {
    data: eventRows,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, venue_id, title, starts_at, ends_at, timezone, is_active, source, source_type'
    )
    .in(
      'id',
      eventIds
    )

  if (
    eventError
  ) {
    throw new Error(
      `[community-signals/live-intelligence] Failed to hydrate canonical community events: ${eventError.message}`
    )
  }

  const normalized:
    CommunityEventIntelligence[] = []

  /**
   * No cast here.
   *
   * The literal Supabase selection above owns the inferred row
   * shape, which is structurally compatible with CommunityEventRow.
   */
  for (
    const event of
      eventRows ?? []
  ) {
    const discovery =
      discoveryByEventId.get(
        event.id
      )

    if (
      !discovery
    ) {
      continue
    }

    const confirmingContributors =
      confidenceByOccurrenceId.get(
        discovery.occurrence_id
      )

    if (
      confirmingContributors ===
      undefined
    ) {
      continue
    }

    const intelligence =
      normalizeCommunityEvent({
        event,
        discovery,
        confirmingContributors,
      })

    if (
      intelligence
    ) {
      normalized.push(
        intelligence
      )
    }
  }

  /**
   * Deterministic output only.
   *
   * This is NOT opportunity ranking or recommendation logic.
   */
  normalized.sort(
    (
      a,
      b
    ) => {
      const aStartsAt =
        Date.parse(
          a.startsAt
        )

      const bStartsAt =
        Date.parse(
          b.startsAt
        )

      if (
        Number.isFinite(
          aStartsAt
        ) &&
        Number.isFinite(
          bStartsAt
        )
      ) {
        const startsDifference =
          aStartsAt -
          bStartsAt

        if (
          startsDifference !== 0
        ) {
          return startsDifference
        }
      }

      return a.eventId.localeCompare(
        b.eventId
      )
    }
  )

  return normalized
}

/**
 * Load the current live condition for one venue + signal type.
 *
 * Authority:
 *
 * get_current_community_place_signal
 *
 * The SQL projection remains authoritative for:
 *
 * - moderation exclusion
 * - freshness
 * - future-evidence exclusion
 * - same-contributor supersession
 * - current-state resolution
 * - disagreement
 * - natural expiry
 *
 * This function only validates and normalizes that derived result.
 */
export async function loadCurrentCommunityPlaceSignalIntelligence({
  venueId,
  signalType,
  asOf = new Date(),
  supabase: providedSupabase,
}: {
  venueId: string
  signalType: CommunityPlaceSignalType
  asOf?: Date
  supabase?: SupabaseClient
}): Promise<CommunityPlaceSignalIntelligence | null> {
  const normalizedVenueId =
    venueId.trim()

  if (
    !normalizedVenueId
  ) {
    throw new Error(
      '[community-signals/live-intelligence] venueId is required.'
    )
  }

  if (
    !isCommunityPlaceSignalType(
      signalType
    )
  ) {
    throw new Error(
      '[community-signals/live-intelligence] signalType is invalid.'
    )
  }

  const asOfIso =
    assertValidAsOf(
      asOf
    )

  const supabase =
    providedSupabase ??
    getSupabaseAdmin()

  const {
    data,
    error,
  } = await supabase.rpc(
    'get_current_community_place_signal',
    {
      p_venue_id:
        normalizedVenueId,

      p_signal_type:
        signalType,

      p_as_of:
        asOfIso,
    }
  )

  if (
    error
  ) {
    throw new Error(
      `[community-signals/live-intelligence] Failed to load current place signal: ${error.message}`
    )
  }

  /**
   * The generated RPC type currently represents some SQL-nullable
   * result columns as strings. Normalize through the explicit
   * runtime shape because 020E legitimately returns NULL when the
   * signal is not current.
   */
  const rows =
    (data ??
      []) as CurrentPlaceSignalRow[]

  if (
    rows.length === 0
  ) {
    return null
  }

  /**
   * 020E's SQL contract returns exactly one row.
   *
   * Fail closed rather than silently choosing a row if that
   * contract is unexpectedly violated.
   */
  if (
    rows.length !== 1
  ) {
    throw new Error(
      '[community-signals/live-intelligence] Current place signal projection returned an unexpected row count.'
    )
  }

  return normalizeCurrentPlaceSignal(
    rows[0]
  )
}

/**
 * Load every V2 place-signal condition currently known for one
 * venue.
 *
 * V2 intentionally contains only:
 *
 * - line
 * - temporary_closure
 *
 * Do not turn this into a generalized place-state ontology.
 */
export async function loadCurrentCommunityPlaceIntelligenceForVenue({
  venueId,
  asOf = new Date(),
  supabase: providedSupabase,
}: {
  venueId: string
  asOf?: Date
  supabase?: SupabaseClient
}): Promise<CommunityPlaceSignalIntelligence[]> {
  const normalizedVenueId =
    venueId.trim()

  if (
    !normalizedVenueId
  ) {
    throw new Error(
      '[community-signals/live-intelligence] venueId is required.'
    )
  }

  const supabase =
    providedSupabase ??
    getSupabaseAdmin()

  const signalTypes:
    CommunityPlaceSignalType[] = [
      'line',
      'temporary_closure',
    ]

  const results =
    await Promise.all(
      signalTypes.map(
        (
          signalType
        ) =>
          loadCurrentCommunityPlaceSignalIntelligence({
            venueId:
              normalizedVenueId,

            signalType,

            asOf,

            supabase,
          })
      )
    )

  return results.filter(
    (
      intelligence
    ): intelligence is CommunityPlaceSignalIntelligence =>
      intelligence !== null
  )
}

/**
 * Normalized convenience seam.
 *
 * With no venueId:
 *
 *   returns discoverable Community Signal events.
 *
 * With venueId:
 *
 *   returns discoverable Community Signal events at that venue
 *   plus the venue's current V2 place signals.
 *
 * Important:
 *
 * This function does NOT attempt global place-signal discovery.
 * That query shape belongs to the later Community Signals
 * presentation/discovery layer.
 */
export async function loadCommunityLiveIntelligence({
  venueId,
  asOf = new Date(),
  supabase: providedSupabase,
}: {
  venueId?: string
  asOf?: Date
  supabase?: SupabaseClient
} = {}): Promise<CommunityLiveIntelligence[]> {
  const normalizedVenueId =
    venueId?.trim() ||
    null

  const supabase =
    providedSupabase ??
    getSupabaseAdmin()

  const [
    events,
    placeSignals,
  ] = await Promise.all([
    loadDiscoverableCommunityEventIntelligence({
      asOf,
      supabase,
    }),

    normalizedVenueId
      ? loadCurrentCommunityPlaceIntelligenceForVenue({
          venueId:
            normalizedVenueId,

          asOf,

          supabase,
        })
      : Promise.resolve<
          CommunityPlaceSignalIntelligence[]
        >([]),
  ])

  if (
    !normalizedVenueId
  ) {
    return events
  }

  return [
    ...events.filter(
      (
        event
      ) =>
        event.venueId ===
        normalizedVenueId
    ),

    ...placeSignals,
  ]
}