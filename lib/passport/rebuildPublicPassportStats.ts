import 'server-only'

import {
  getPassportSnapshot,
  type PassportStats,
} from '@/lib/passport/score'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type RebuildPublicPassportStatsResult = {
  stats: PassportStats
  snapshot: ReturnType<typeof getPassportSnapshot>
  updatedAt: string
}

type CrawlEventRelation = {
  id?: string | null
  datetime?: string | null
  venue_ids?: unknown
}

type CrawlRsvpRow = {
  crawl_id?: string | null
  crawl_events?:
    | CrawlEventRelation
    | CrawlEventRelation[]
    | null
}

type CompletedFlowSessionRow = {
  id?: string | null
  venue_ids?: unknown
}

type VenueVisitRow = {
  venue_id?: string | null
}

type CrawlProgressRow = {
  crawl_id?: string | null
}

type EventXpRow = {
  xp_amount?: number | string | null
}

type CrawlEventRow = {
  id?: string | null
  venue_ids?: unknown
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Math.floor(value)
}

function normalizeXpValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed)
    }
  }

  return 0
}

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function getRelatedCrawlEvent(
  relation: CrawlRsvpRow['crawl_events']
): CrawlEventRelation | null {
  if (!relation) {
    return null
  }

  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation
}

function isPastDate(
  value: unknown,
  now: Date
): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  return parsed.getTime() < now.getTime()
}

function throwIfQueryFailed(
  queryName: string,
  error: {
    message?: string
    code?: string
    details?: string
    hint?: string
  } | null
): void {
  if (!error) {
    return
  }

  const details = [
    error.message,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  throw new Error(
    `[rebuildPublicPassportStats] ${queryName} failed: ${details}`
  )
}

/**
 * Rebuilds the canonical Passport snapshot for one user.
 *
 * This function:
 * - Uses the Supabase service-role client.
 * - Reads Passport source tables without viewer-dependent RLS.
 * - Calculates the Passport once through getPassportSnapshot().
 * - Upserts one canonical row into profile_public_stats.
 *
 * It must only be called from trusted server-side code.
 */
export async function rebuildPublicPassportStats(
  userId: string
): Promise<RebuildPublicPassportStatsResult> {
  const normalizedUserId = userId.trim()

  if (!normalizedUserId) {
    throw new Error(
      '[rebuildPublicPassportStats] A valid userId is required.'
    )
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()

  const [
    hostedCrawlsResult,
    crawlRsvpsResult,
    savedPropertiesResult,
    completedFlowsResult,
    venueVisitsResult,
    crawlProgressResult,
    eventXpResult,
    eventCheckinsResult,
  ] = await Promise.all([
    supabase
      .from('crawl_events')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('creator_id', normalizedUserId),

    supabase
      .from('crawl_rsvps')
      .select(`
        crawl_id,
        crawl_events (
          id,
          datetime
        )
      `)
      .eq('user_id', normalizedUserId),

    supabase
      .from('saved_properties')
      .select('property_id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', normalizedUserId),

    supabase
      .from('active_flow_sessions')
      .select('id, venue_ids')
      .eq('user_id', normalizedUserId)
      .eq('status', 'completed'),

    supabase
      .from('venue_visits')
      .select('venue_id')
      .eq('user_id', normalizedUserId),

    supabase
      .from('crawl_progress')
      .select('crawl_id')
      .eq('user_id', normalizedUserId),

    supabase
      .from('event_xp_ledger')
      .select('xp_amount')
      .eq('user_id', normalizedUserId),

    supabase
      .from('event_checkins')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', normalizedUserId),
  ])

  throwIfQueryFailed(
    'crawl_events',
    hostedCrawlsResult.error
  )
  throwIfQueryFailed(
    'crawl_rsvps',
    crawlRsvpsResult.error
  )
  throwIfQueryFailed(
    'saved_properties',
    savedPropertiesResult.error
  )
  throwIfQueryFailed(
    'active_flow_sessions',
    completedFlowsResult.error
  )
  throwIfQueryFailed(
    'venue_visits',
    venueVisitsResult.error
  )
  throwIfQueryFailed(
    'crawl_progress',
    crawlProgressResult.error
  )
  throwIfQueryFailed(
    'event_xp_ledger',
    eventXpResult.error
  )
  throwIfQueryFailed(
    'event_checkins',
    eventCheckinsResult.error
  )

  const crawlRsvps =
    (crawlRsvpsResult.data ?? []) as CrawlRsvpRow[]

  const completedFlows =
    (completedFlowsResult.data ?? []) as CompletedFlowSessionRow[]

  const venueVisitRows =
    (venueVisitsResult.data ?? []) as VenueVisitRow[]

  const crawlProgress =
    (crawlProgressResult.data ?? []) as CrawlProgressRow[]

  const eventXpRows =
    (eventXpResult.data ?? []) as EventXpRow[]

  const hostedCrawls = normalizeCount(
    hostedCrawlsResult.count ?? 0
  )

  const joinedCrawls = normalizeCount(
    crawlRsvps.length
  )

  const pastCrawls = normalizeCount(
    crawlRsvps.filter((row) => {
      const crawlEvent = getRelatedCrawlEvent(
        row.crawl_events
      )

      return isPastDate(
        crawlEvent?.datetime,
        now
      )
    }).length
  )

  const savedProperties = normalizeCount(
    savedPropertiesResult.count ?? 0
  )

  const completedFlowCount = normalizeCount(
    completedFlows.length
  )

  const completedFlowStops = normalizeCount(
    completedFlows.reduce(
      (total, session) =>
        total + getArrayLength(session.venue_ids),
      0
    )
  )

  const venueVisits = normalizeCount(
    new Set(
      venueVisitRows
        .map((row) => row.venue_id)
        .filter(
          (venueId): venueId is string =>
            typeof venueId === 'string' &&
            venueId.trim().length > 0
        )
    ).size
  )

  const hostedFlowStops = normalizeCount(
    crawlProgress.length
  )

  const eventXp = eventXpRows.reduce(
    (total, row) =>
      total + normalizeXpValue(row.xp_amount),
    0
  )

  const eventCheckins = normalizeCount(
    eventCheckinsResult.count ?? 0
  )

  const progressedCrawlIds = [
    ...new Set(
      crawlProgress
        .map((row) => row.crawl_id)
        .filter(
          (crawlId): crawlId is string =>
            typeof crawlId === 'string' &&
            crawlId.trim().length > 0
        )
    ),
  ]

  let completedHostedFlows = 0

  if (progressedCrawlIds.length > 0) {
    const crawlEventsResult = await supabase
      .from('crawl_events')
      .select('id, venue_ids')
      .in('id', progressedCrawlIds)

    throwIfQueryFailed(
      'crawl_events completion lookup',
      crawlEventsResult.error
    )

    const crawlEvents =
      (crawlEventsResult.data ?? []) as CrawlEventRow[]

    const completedStopsByCrawlId =
      crawlProgress.reduce<Record<string, number>>(
        (totals, row) => {
          const crawlId = row.crawl_id

          if (
            typeof crawlId !== 'string' ||
            crawlId.trim().length === 0
          ) {
            return totals
          }

          totals[crawlId] =
            (totals[crawlId] ?? 0) + 1

          return totals
        },
        {}
      )

    completedHostedFlows = normalizeCount(
      crawlEvents.filter((crawl) => {
        const crawlId = crawl.id

        if (
          typeof crawlId !== 'string' ||
          crawlId.trim().length === 0
        ) {
          return false
        }

        const requiredStops = getArrayLength(
          crawl.venue_ids
        )

        const completedStops =
          completedStopsByCrawlId[crawlId] ?? 0

        return (
          requiredStops > 0 &&
          completedStops >= requiredStops
        )
      }).length
    )
  }

  const stats: PassportStats = {
    hostedCrawls,
    joinedCrawls,
    pastCrawls,
    savedProperties,
    completedFlows: completedFlowCount,
    completedFlowStops,
    hostedFlowStops,
    completedHostedFlows,
    venueVisits,
    eventXp,
    eventCheckins,
  }

  const snapshot = getPassportSnapshot(stats)
  const updatedAt = new Date().toISOString()

  const { error: upsertError } = await supabase
    .from('profile_public_stats')
    .upsert(
      {
        user_id: normalizedUserId,

        hosted_crawls: stats.hostedCrawls,
        joined_crawls: stats.joinedCrawls,
        past_crawls: stats.pastCrawls,
        saved_properties: stats.savedProperties,

        completed_flows: stats.completedFlows,
        completed_flow_stops:
          stats.completedFlowStops,
        hosted_flow_stops:
          stats.hostedFlowStops,
        completed_hosted_flows:
          stats.completedHostedFlows,

        venue_visits: stats.venueVisits,
        event_xp: stats.eventXp,
        event_checkins:
          stats.eventCheckins ?? 0,

        passport_xp: snapshot.xp,
        passport_level: snapshot.level,
        passport_progress:
          snapshot.progressToNextLevel,
        passport_progress_percent:
          snapshot.progressPercent,

        updated_at: updatedAt,
      },
      {
        onConflict: 'user_id',
      }
    )

  throwIfQueryFailed(
    'profile_public_stats upsert',
    upsertError
  )

  return {
    stats,
    snapshot,
    updatedAt,
  }
}