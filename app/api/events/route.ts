import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { getSupabaseAdmin } from '@/lib/supabase/admin-runtime'
import type { Database } from '@/types/supabase'

type EventRow = Database['public']['Tables']['events']['Row']

type DiscoverableCommunityEvent = {
  event_id: string
  occurrence_id: string
  confidence_band: string
}

type EventOccurrenceConfidenceRow = {
  occurrence_id: string
  unique_confirmers: number
}

export async function GET(req: Request) {
  const supabase = await supabaseServerApi()
  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(req.url)

  const city = url.searchParams.get('city')?.toLowerCase() || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null
  const tags = url.searchParams.get('tags') || null
  const onlyActive = url.searchParams.get('active')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  if (process.env.NODE_ENV !== 'production') {
    console.debug('📥 Incoming /api/events params:', {
      city,
      from,
      to,
      tags,
      onlyActive,
      limit,
      offset,
    })
  }

  if (!city || !from || !to) {
    console.warn('⚠️ Missing filters in /api/events:', {
      city,
      from,
      to,
    })
  }

  /**
   * Community Signals discovery authority.
   *
   * 010C owns occurrence-level discovery eligibility.
   * 012B projects the canonical community event IDs whose
   * occurrences currently satisfy that policy.
   *
   * This route intentionally does not reproduce confidence,
   * correction, resolution, or temporal trust rules.
   */
  const {
    data: discoverableCommunityRows,
    error: discoverableCommunityError,
  } = await supabaseAdmin.rpc(
    'get_discoverable_community_event_ids',
    {
      p_as_of: new Date().toISOString(),
    }
  )

  if (discoverableCommunityError) {
    console.error(
      '❌ Error fetching discoverable community events:',
      discoverableCommunityError
    )

    return NextResponse.json(
      {
        error: 'Failed to fetch events',
        details: discoverableCommunityError.message,
      },
      { status: 500 }
    )
  }

  const discoverableCommunityEvents =
    (discoverableCommunityRows ??
      []) as DiscoverableCommunityEvent[]

  const discoverableCommunityEventIds =
    discoverableCommunityEvents.map(
      (row) => row.event_id
    )

  /**
   * Community Signal presentation identity.
   *
   * 012B already owns the authoritative relationship between a
   * discoverable canonical Community Event and its resolved
   * occurrence.
   *
   * Preserve that relationship for response enrichment only.
   * This does not create a second occurrence lookup, reproduce
   * discovery policy, or give the client resolution authority.
   */
  const discoverableCommunityEventById =
    new Map(
      discoverableCommunityEvents.map(
        (row) => [
          row.event_id,
          row,
        ]
      )
    )

  /**
   * Community Signal corroboration presentation.
   *
   * get_event_occurrence_confidence remains authoritative for
   * occurrence-level evidence aggregation.
   *
   * This route transports only unique_confirmers for presentation.
   * It does not count confirmation rows, infer confidence, or
   * reproduce trust rules.
   */
  const confirmingContributorsByOccurrenceId =
    new Map<string, number>()

  const confidenceResults =
    await Promise.all(
      discoverableCommunityEvents.map(
        async (communityEvent) => {
          const {
            data,
            error,
          } = await supabaseAdmin.rpc(
            'get_event_occurrence_confidence',
            {
              p_occurrence_id:
                communityEvent.occurrence_id,
            }
          )

          if (error) {
            return {
              occurrenceId:
                communityEvent.occurrence_id,
              confirmingContributors:
                null,
              error,
            }
          }

          const rows =
            (data ??
              []) as EventOccurrenceConfidenceRow[]

          if (
            rows.length !== 1 ||
            rows[0].occurrence_id !==
              communityEvent.occurrence_id ||
            !Number.isInteger(
              rows[0].unique_confirmers
            ) ||
            rows[0].unique_confirmers < 0
          ) {
            return {
              occurrenceId:
                communityEvent.occurrence_id,
              confirmingContributors:
                null,
              error:
                new Error(
                  'Invalid event occurrence confirmation count.'
                ),
            }
          }

          return {
            occurrenceId:
              communityEvent.occurrence_id,
            confirmingContributors:
              rows[0].unique_confirmers,
            error:
              null,
          }
        }
      )
    )

  for (
    const result of
      confidenceResults
  ) {
    if (
      result.error ||
      result.confirmingContributors ===
        null
    ) {
      console.error(
        '❌ Error fetching Community Signal confirmation count:',
        {
          occurrence_id:
            result.occurrenceId,
          error:
            result.error,
        }
      )

      return NextResponse.json(
        {
          error:
            'Failed to fetch events',
          details:
            'Could not load Community Signal confirmation count.',
        },
        {
          status: 500,
        }
      )
    }

    confirmingContributorsByOccurrenceId.set(
      result.occurrenceId,
      result.confirmingContributors
    )
  }

  let query = supabase
    .from('events')
    .select(
      `
      id,
      title,
      description,
      starts_at,
      ends_at,
      tags,
      price_info,
      source_type,
      timezone,
      is_active,
      checkin_enabled,
      xp_reward,
      social_group_id,
      created_at,
      updated_at,
      ticket_link,
      venue:venues!events_venue_id_fkey (
        id,
        name,
        slug,
        lat,
        lon,
        city,
        cover
      ),
      social_group:social_groups (
        id,
        name,
        slug,
        logo_url
      ),
      event_interests(count)
    `
    )
    .not('venue', 'is', null)

  /**
   * Ordinary events retain their existing discovery behavior.
   *
   * Canonical Community Signals events are allowed through only
   * when 012B says their resolved occurrence is discoverable.
   *
   * Important:
   * source_type is the discriminator used here because
   * `community_signal` is the frozen canonical Community Signals
   * source type.
   */
  if (discoverableCommunityEventIds.length > 0) {
    const eligibleIds = discoverableCommunityEventIds.join(',')

    query = query.or(
      `source_type.neq.community_signal,and(source_type.eq.community_signal,id.in.(${eligibleIds}))`
    )
  } else {
    query = query.neq('source_type', 'community_signal')
  }

  const activeParam = onlyActive?.toLowerCase()
  const isActive =
    activeParam !== 'false' &&
    activeParam !== '0'

  if (isActive) {
    query = query.eq('is_active', true)
  }

  // Keep current/future events visible, including overnight events
  // that started before `from`.
  const nowIso =
    new Date().toISOString()

  if (to) {
    query = query.lte(
      'starts_at',
      to
    )
  }

  if (from) {
    query = query.or(
      `starts_at.gte.${from},ends_at.gte.${nowIso}`
    )
  } else {
    query = query.or(
      `ends_at.gte.${nowIso},ends_at.is.null`
    )
  }

  if (city) {
    query = query.filter(
      'venues.city',
      'eq',
      city
    )
  }

  if (tags) {
    const tagList =
      tags
        .split(',')
        .map((t) =>
          t.trim()
        )

    query = query.overlaps(
      'tags',
      tagList
    )
  }

  query = query
    .order(
      'starts_at',
      {
        ascending:
          true,
      }
    )
    .range(
      offset,
      offset + limit - 1
    )

  const {
    data,
    error,
  } = await query

  if (error) {
    console.error(
      '❌ Error fetching events:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Failed to fetch events',
        details:
          error.message,
      },
      {
        status: 500,
      }
    )
  }

  const eventsWithCounts =
    (data ?? []).map(
      (event) => {
        const communityDiscovery =
          event.source_type ===
          'community_signal'
            ? discoverableCommunityEventById.get(
                event.id
              )
            : undefined

        const confirmingContributors =
          communityDiscovery
            ? confirmingContributorsByOccurrenceId.get(
                communityDiscovery.occurrence_id
              )
            : undefined

        return {
          ...event,

          interest_count:
            event.event_interests?.[0]
              ?.count ?? 0,

          ...(communityDiscovery
            ? {
                occurrence_id:
                  communityDiscovery.occurrence_id,

                confidence_band:
                  communityDiscovery.confidence_band,

                confirming_contributors:
                  confirmingContributors ??
                  0,
              }
            : {}),
        }
      }
    )

  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    console.debug(
      '📤 Events returned from Supabase:',
      eventsWithCounts.map(
        (ev) => ({
          id:
            ev.id,

          title:
            ev.title,

          starts_at:
            ev.starts_at,

          ends_at:
            ev.ends_at,

          venue_city:
            ev.venue?.city,

          is_active:
            ev.is_active,

          checkin_enabled:
            ev.checkin_enabled,

          xp_reward:
            ev.xp_reward,

          social_group_id:
            ev.social_group_id,

          interest_count:
            ev.interest_count,

          source_type:
            ev.source_type,

          occurrence_id:
            'occurrence_id' in
            ev
              ? ev.occurrence_id
              : undefined,

          confidence_band:
            'confidence_band' in
            ev
              ? ev.confidence_band
              : undefined,

          confirming_contributors:
            'confirming_contributors' in
            ev
              ? ev.confirming_contributors
              : undefined,
        })
      )
    )
  }

  const response = {
    events:
      eventsWithCounts,

    meta: {
      count:
        eventsWithCounts.length,

      city,

      from,

      to,

      active:
        isActive,

      tags:
        tags?.split(',') ??
        [],

      limit,

      offset,

      fetched_at:
        new Date().toISOString(),
    },
  }

  return NextResponse.json(
    response
  )
}