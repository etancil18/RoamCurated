
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ snapshotId: string }>
}

type SnapshotRow = {
  id: string
  user_id: string
  visibility: string
  total_stops: number | null
}

type StopRow = {
  id: string
  venue_id: string
  stop_index: number
}

type MappingRow = {
  snapshot_stop_id: string
  contribution_id: string
  venue_id: string
}

type ContributionRow = {
  id: string
  venue_id: string
  origin: 'collection' | 'manual' | 'platform'
  creator_user_id: string | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
}

function json(
  body: unknown,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  })
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    // Independent read rollout control.
    // OFF until the lineage migration is deployed.
    if (
      process.env.ROAM_SNAPSHOT_ATTRIBUTION_READ_ENABLED !==
      'true'
    ) {
      return json(
        { error: 'Attribution read is not enabled.' },
        404
      )
    }

    const { snapshotId: rawSnapshotId } =
      await context.params

    const snapshotId = rawSnapshotId?.trim()

    if (!snapshotId || !UUID_PATTERN.test(snapshotId)) {
      return json(
        { error: 'Snapshot ID is invalid.' },
        400
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        '[snapshot-attribution] Server configuration missing.'
      )

      return json(
        { error: 'Attribution is unavailable.' },
        503
      )
    }

    // Validate any signed-in viewer from the server session.
    // An anonymous visitor may still read a PUBLIC Snapshot.
    const viewerClient = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await viewerClient.auth.getUser()

    const viewerId =
      !authError && user ? user.id : null

    const service = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const {
      data: snapshot,
      error: snapshotError,
    } = await service
      .from('flow_snapshots')
      .select(
        'id, user_id, visibility, total_stops'
      )
      .eq('id', snapshotId)
      .maybeSingle<SnapshotRow>()

    if (snapshotError) {
      console.error(
        '[snapshot-attribution] Snapshot lookup failed:',
        snapshotError
      )

      return json(
        { error: 'Could not load attribution.' },
        500
      )
    }

    // Do not reveal whether a private Snapshot exists.
    if (
      !snapshot ||
      (
        snapshot.visibility !== 'public' &&
        snapshot.user_id !== viewerId
      )
    ) {
      return json(
        { error: 'Snapshot not found.' },
        404
      )
    }

    const {
      data: certification,
      error: certificationError,
    } = await service
      .from('flow_snapshot_route_certifications')
      .select('snapshot_id')
      .eq('snapshot_id', snapshot.id)
      .maybeSingle<{ snapshot_id: string }>()

    if (certificationError) {
      console.error(
        '[snapshot-attribution] Certification lookup failed:',
        certificationError
      )

      return json(
        { error: 'Could not verify attribution.' },
        500
      )
    }

    const certifiedRoute = Boolean(certification)

    const {
      data: stopData,
      error: stopsError,
    } = await service
      .from('flow_snapshot_stops')
      .select('id, venue_id, stop_index')
      .eq('snapshot_id', snapshot.id)
      .order('stop_index', { ascending: true })

    if (stopsError) {
      console.error(
        '[snapshot-attribution] Stop lookup failed:',
        stopsError
      )

      return json(
        { error: 'Could not load Snapshot stops.' },
        500
      )
    }

    const stops = (stopData ?? []) as StopRow[]

    // Fail closed on inconsistent canonical route evidence.
    const invalidRoute =
      stops.length < 2 ||
      new Set(stops.map(stop => stop.venue_id)).size !==
        stops.length ||
      stops.some(
        (stop, index) =>
          stop.stop_index !== index ||
          !UUID_PATTERN.test(stop.venue_id)
      ) ||
      (
        snapshot.total_stops !== null &&
        snapshot.total_stops !== stops.length
      )

    if (invalidRoute) {
      return json(
        { error: 'Snapshot route is inconsistent.' },
        409
      )
    }

    // Legacy Snapshots remain readable without fabricating
    // human authorship or claiming route certification.
    if (!certifiedRoute) {
      return json(
        {
          snapshotId: snapshot.id,
          publisherUserId: snapshot.user_id,
          certifiedRoute: false,
          stops: stops.map(stop => ({
            venueId: stop.venue_id,
            stopIndex: stop.stop_index,
            attributionOrigin: 'unknown',
            originalCreatorUserId: null,
            attributionCertified: false,
          })),
        },
        200
      )
    }

    const stopIds = stops.map(stop => stop.id)

    const {
      data: mappingData,
      error: mappingError,
    } = await service
      .from('flow_snapshot_stop_contributions')
      .select(
        'snapshot_stop_id, contribution_id, venue_id'
      )
      .in('snapshot_stop_id', stopIds)

    if (mappingError) {
      console.error(
        '[snapshot-attribution] Mapping lookup failed:',
        mappingError
      )

      return json(
        { error: 'Could not load certified attribution.' },
        500
      )
    }

    const mappings = (mappingData ?? []) as MappingRow[]

    const contributionIds = [
      ...new Set(
        mappings.map(mapping => mapping.contribution_id)
      ),
    ]

    let contributions: ContributionRow[] = []

    if (contributionIds.length > 0) {
      const {
        data,
        error,
      } = await service
        .from('flow_contributions')
        .select(
          'id, venue_id, origin, creator_user_id'
        )
        .in('id', contributionIds)

      if (error) {
        console.error(
          '[snapshot-attribution] Contribution lookup failed:',
          error
        )

        return json(
          { error: 'Could not resolve original authorship.' },
          500
        )
      }

      contributions = (data ?? []) as ContributionRow[]
    }

    const mappingByStopId = new Map(
      mappings.map(mapping => [
        mapping.snapshot_stop_id,
        mapping,
      ])
    )

    const contributionById = new Map(
      contributions.map(contribution => [
        contribution.id,
        contribution,
      ])
    )

    const attributedStops = []

    for (const stop of stops) {
      const mapping = mappingByStopId.get(stop.id)

      if (!mapping) {
        attributedStops.push({
          venueId: stop.venue_id,
          stopIndex: stop.stop_index,
          attributionOrigin: 'unknown',
          originalCreatorUserId: null,
          attributionCertified: false,
        })
        continue
      }

      const contribution =
        contributionById.get(mapping.contribution_id)

      const venueMatches =
        mapping.venue_id === stop.venue_id &&
        contribution?.venue_id === stop.venue_id

      const originValid =
        contribution?.origin === 'collection' ||
        contribution?.origin === 'manual' ||
        contribution?.origin === 'platform'

      const authorValid =
        contribution?.origin === 'platform'
          ? contribution.creator_user_id === null
          : Boolean(contribution?.creator_user_id)

      if (
        !contribution ||
        !venueMatches ||
        !originValid ||
        !authorValid
      ) {
        console.error(
          '[snapshot-attribution] Invalid certified mapping.',
          { snapshotId: snapshot.id, stopIndex: stop.stop_index }
        )

        return json(
          { error: 'Certified attribution is inconsistent.' },
          409
        )
      }

      attributedStops.push({
        venueId: stop.venue_id,
        stopIndex: stop.stop_index,
        attributionOrigin: contribution.origin,
        originalCreatorUserId:
          contribution.origin === 'platform'
            ? null
            : contribution.creator_user_id,
        attributionCertified: true,
      })
    }

    return json(
      {
        snapshotId: snapshot.id,
        publisherUserId: snapshot.user_id,
        certifiedRoute: true,
        stops: attributedStops,
      },
      200
    )
  } catch (error) {
    console.error(
      '[snapshot-attribution] Unexpected error:',
      error
    )

    return json(
      { error: 'Unexpected attribution error.' },
      500
    )
  }
}
