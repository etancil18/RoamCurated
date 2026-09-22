// app/api/generate-from-collection/route.ts

import { NextRequest, NextResponse } from 'next/server'

import { CITY_CONFIGS } from '@/config/cities'
import {
  generateRouteFromCollection,
  type GenerateRouteFromCollectionVenue,
} from '@/lib/routes/generateRouteFromCollection'
import type { UserRoutePersonalization } from '@/lib/routes/personalization'
import { createServerClient } from '@/lib/supabase/server'
import type {
  RouteTightness,
  RouteTravelMode,
} from '@/types/route'

export const dynamic = 'force-dynamic'

type GenerateFromCollectionBody = {
  collectionId?: string | null
  plannedStartAt?: string | null
  travelMode?: RouteTravelMode | null
  tightness?: RouteTightness | null
  maxStops?: number | null
  preferredVibes?: string[] | null
  preferredTags?: string[] | null
}

type CollectionRow = {
  id: string
  user_id: string
  title: string
  city: string | null
  visibility: string
}

type CollectionVenueRow = {
  venue_id: string
  sort_order: number
}

type VenueRow = {
  id: string
  name: string
  slug: string | null
  city: string | null
  address: string | null
  lat: number | null
  lon: number | null
  type: unknown
  tags: unknown
  vibe: unknown
  price: string | null
  hours: unknown
  cover: string | null
  profile_status: string | null
}

type ExistingActiveFlowRow = {
  id: string
  title: string | null
  city: string | null
  started_at: string
}

type GeneratedStopOrigin = {
  venueId: string
  stopIndex: number
  origin: 'collection' | 'roam_fill'
}

const DEFAULT_MAX_STOPS = 5

const VENUE_SELECT = `
  id,
  name,
  slug,
  city,
  address,
  lat,
  lon,
  type,
  tags,
  vibe,
  price,
  hours,
  cover,
  profile_status
`

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | GenerateFromCollectionBody
      | null

    const collectionId = normalizeUuid(body?.collectionId)

    if (!collectionId) {
      return NextResponse.json(
        {
          error: 'Collection ID is invalid.',
        },
        { status: 400 }
      )
    }

    const travelMode = sanitizeTravelMode(body?.travelMode)
    const tightness = sanitizeTightness(body?.tightness)
    const maxStops = sanitizeMaxStops(body?.maxStops)
    const plannedStartAt = normalizePlannedStartAt(
      body?.plannedStartAt
    )

    if (body?.plannedStartAt && !plannedStartAt) {
      return NextResponse.json(
        {
          error: 'Planned start time is invalid.',
        },
        { status: 400 }
      )
    }

    const preferredVibes = sanitizeStringArray(
      body?.preferredVibes
    )
    const preferredTags = sanitizeStringArray(
      body?.preferredTags
    )

    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            'Create a free Roam account to build this Flow and unlock the full experience.',
          code: 'AUTH_REQUIRED',
          authRequired: true,
          redirectTo: '/login',
        },
        { status: 401 }
      )
    }

    /*
     * Collection generation can involve multiple inventory and
     * personalization queries plus route scoring.
     *
     * Preserve the one-active-Flow invariant before doing that
     * expensive work.
     */
    const {
      data: existingActiveFlow,
      error: existingActiveFlowError,
    } = await supabase
      .from('active_flow_sessions')
      .select('id, title, city, started_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle<ExistingActiveFlowRow>()

    if (existingActiveFlowError) {
      console.error(
        '[generate-from-collection] Existing active flow check failed:',
        existingActiveFlowError
      )

      return NextResponse.json(
        {
          error: 'Could not check your current active Flow.',
        },
        { status: 500 }
      )
    }

    if (existingActiveFlow) {
      return NextResponse.json(
        {
          error: 'You already have an active Flow.',
          activeSession: existingActiveFlow,
          redirectTo: `/flow/${existingActiveFlow.id}`,
        },
        { status: 409 }
      )
    }

    /*
     * The browser supplies only the Collection ID and generation
     * preferences.
     *
     * Collection ownership, creator attribution, title, city,
     * membership, venue inventory, and provenance all come from
     * canonical server-side data.
     *
     * RLS determines whether this authenticated user can read
     * the requested Collection.
     */
    const {
      data: collection,
      error: collectionError,
    } = await supabase
      .from('creator_collections')
      .select(`
        id,
        user_id,
        title,
        city,
        visibility
      `)
      .eq('id', collectionId)
      .maybeSingle<CollectionRow>()

    if (collectionError) {
      console.error(
        '[generate-from-collection] Collection fetch failed:',
        collectionError
      )

      return NextResponse.json(
        {
          error: 'Could not load this Collection.',
        },
        { status: 500 }
      )
    }

    if (!collection) {
      return NextResponse.json(
        {
          error: 'Collection not found.',
        },
        { status: 404 }
      )
    }

    /*
     * creator_collection_venues is the authoritative Collection
     * membership source for Flow generation.
     *
     * An empty membership is not itself an error. The Collection
     * engine can fall back to broader Roam inventory.
     */
    const {
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from('creator_collection_venues')
      .select('venue_id, sort_order')
      .eq('collection_id', collection.id)
      .order('sort_order', {
        ascending: true,
      })

    if (membershipError) {
      console.error(
        '[generate-from-collection] Collection membership fetch failed:',
        membershipError
      )

      return NextResponse.json(
        {
          error: 'Could not load Collection venues.',
        },
        { status: 500 }
      )
    }

    const memberships = (
      (membershipData ?? []) as CollectionVenueRow[]
    ).filter((membership) =>
      Boolean(normalizeUuid(membership.venue_id))
    )

    const collectionVenueIds = [
      ...new Set(
        memberships
          .map((membership) =>
            normalizeUuid(membership.venue_id)
          )
          .filter(
            (venueId): venueId is string =>
              Boolean(venueId)
          )
      ),
    ]

    let collectionVenueRows: VenueRow[] = []

    if (collectionVenueIds.length > 0) {
      const {
        data: collectionVenueData,
        error: collectionVenueError,
      } = await supabase
        .from('venues')
        .select(VENUE_SELECT)
        .in('id', collectionVenueIds)

      if (collectionVenueError) {
        console.error(
          '[generate-from-collection] Collection venue hydration failed:',
          collectionVenueError
        )

        return NextResponse.json(
          {
            error: 'Could not load Collection venue details.',
          },
          { status: 500 }
        )
      }

      collectionVenueRows = (
        (collectionVenueData ?? []) as VenueRow[]
      ).filter(hasUsableCoordinates)
    }

    const collectionVenueById = new Map(
      collectionVenueRows.map((venue) => [
        venue.id,
        venue,
      ])
    )

    /*
     * Restore creator_collection_venues ordering after the venue
     * hydration query. SQL IN does not preserve membership order.
     */
    const collectionVenues = memberships
      .map((membership) =>
        collectionVenueById.get(membership.venue_id)
      )
      .filter(
        (venue): venue is VenueRow =>
          Boolean(venue)
      )
      .map(normalizeGenerationVenue)

    const resolvedCity =
      normalizeNullableText(collection.city) ??
      collectionVenues.find((venue) =>
        Boolean(normalizeNullableText(venue.city))
      )?.city ??
      null

    const timezone =
      resolvedCity && CITY_CONFIGS[resolvedCity]?.timezone
        ? CITY_CONFIGS[resolvedCity].timezone
        : null

    /*
     * Broader Roam inventory is loaded separately from Collection
     * membership. Collection venues receive first refusal inside
     * generateRouteFromCollection().
     *
     * Use an explicit projection rather than select('*') so
     * unrelated/sensitive venue columns never enter this path.
     */
    let broaderVenueQuery = supabase
      .from('venues')
      .select(VENUE_SELECT)

    if (resolvedCity) {
      broaderVenueQuery = broaderVenueQuery.eq(
        'city',
        resolvedCity
      )
    }

    const [
      {
        data: broaderVenueData,
        error: broaderVenueError,
      },
      personalization,
    ] = await Promise.all([
      broaderVenueQuery,
      loadUserPersonalization({
        supabase,
        userId: user.id,
      }),
    ])

    if (broaderVenueError) {
      console.error(
        '[generate-from-collection] Broader venue inventory fetch failed:',
        broaderVenueError
      )

      return NextResponse.json(
        {
          error: 'Could not load Roam venue inventory.',
        },
        { status: 500 }
      )
    }

    const broaderVenues = (
      (broaderVenueData ?? []) as VenueRow[]
    )
      .filter(hasUsableCoordinates)
      .map(normalizeGenerationVenue)

    const route = generateRouteFromCollection({
      collection: {
        id: collection.id,
        creatorUserId: collection.user_id,
        title: collection.title,
        city: resolvedCity,
      },
      collectionVenues,
      venues: broaderVenues,
      city: resolvedCity,
      plannedStartAt:
        plannedStartAt ?? new Date().toISOString(),
      travelMode,
      tightness,
      maxStops,
      preferredVibes:
        preferredVibes.length > 0
          ? preferredVibes
          : personalization.preferredVibes ?? [],
      preferredTags:
        preferredTags.length > 0
          ? preferredTags
          : personalization.interestCategories ?? [],
      personalization,
      includeDebug: true,
      timezone,
    })

    /*
     * A successful engine result is not enough to persist an
     * executable Flow.
     *
     * active_flow_sessions must contain at least two unique,
     * canonical UUID venue IDs.
     */
    const canonicalRoute = normalizeGeneratedRoute(
      route.stops
    )

    if (
      route.status !== 'success' ||
      !canonicalRoute
    ) {
      return NextResponse.json(
        {
          route,
          error:
            'No executable Flow could be built from this Collection.',
        },
        { status: 422 }
      )
    }

    const venueIds = canonicalRoute.map(
      (stop) => stop.venueId
    )

    const stopOrigins: GeneratedStopOrigin[] =
      canonicalRoute.map((stop) => ({
        venueId: stop.venueId,
        stopIndex: stop.stopIndex,
        origin: stop.origin,
      }))

    const now = new Date().toISOString()

    /*
     * Create an ordinary active_flow_session.
     *
     * The existing /flow/[session_id] execution, check-in, and
     * completion system takes over from this point forward.
     *
     * Provenance is snapshotted now. Future Collection membership
     * edits must not rewrite the historical origin of these stops.
     */
    const insertPayload = {
      user_id: user.id,
      title:
        normalizeNullableText(collection.title) ??
        'Roam Flow',
      city:
        normalizeNullableText(route.context.city) ??
        resolvedCity,
      source: 'creator_collection',
      source_id: collection.id,
      source_creator_user_id: collection.user_id,
      venue_ids: venueIds,
      travel_mode: travelMode,
      status: 'active',
      started_at: now,
      metadata: {
        collectionTitle:
          normalizeNullableText(collection.title),
        plannedStartAt:
          route.context.plannedStartAt,
        stopOrigins,
      },
    } as any

    const {
      data: session,
      error: insertError,
    } = await supabase
      .from('active_flow_sessions')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError || !session) {
      /*
       * The partial unique index on active_flow_sessions is the
       * concurrency backstop if two generation requests race
       * after the early active-Flow check.
       */
      if (isUniqueConstraintViolation(insertError)) {
        const {
          data: concurrentActiveFlow,
        } = await supabase
          .from('active_flow_sessions')
          .select('id, title, city, started_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle<ExistingActiveFlowRow>()

        return NextResponse.json(
          {
            error: 'You already have an active Flow.',
            activeSession:
              concurrentActiveFlow ?? null,
            redirectTo: concurrentActiveFlow
              ? `/flow/${concurrentActiveFlow.id}`
              : null,
          },
          { status: 409 }
        )
      }

      console.error(
        '[generate-from-collection] Active flow creation failed:',
        insertError
      )

      return NextResponse.json(
        {
          error: 'Could not start this Collection Flow.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        session,
        route,
        redirectTo: `/flow/${session.id}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error(
      '[generate-from-collection] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error generating this Collection Flow.',
      },
      { status: 500 }
    )
  }
}

async function loadUserPersonalization({
  supabase,
  userId,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
}): Promise<UserRoutePersonalization> {
  const [
    { data: profile },
    { data: savedProperties },
    { data: venueVisits },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'preferred_vibes, interest_categories, home_neighborhood'
      )
      .eq('id', userId)
      .maybeSingle(),

    supabase
      .from('saved_properties')
      .select('property_id, slug, city')
      .eq('user_id', userId),

    supabase
      .from('venue_visits')
      .select('venue_id')
      .eq('user_id', userId),
  ])

  return {
    preferredVibes:
      sanitizeStringArray(profile?.preferred_vibes),

    interestCategories:
      sanitizeStringArray(profile?.interest_categories),

    homeCity:
      normalizeNullableText(profile?.home_neighborhood),

    savedVenueIds:
      savedProperties
        ?.map((item: any) =>
          normalizeUuid(item.property_id)
        )
        .filter(
          (value): value is string =>
            Boolean(value)
        ) ?? [],

    savedVenueSlugs:
      savedProperties
        ?.map((item: any) =>
          normalizeNullableText(item.slug)
        )
        .filter(
          (value): value is string =>
            Boolean(value)
        ) ?? [],

    visitedVenueIds: [
      ...new Set(
        venueVisits
          ?.map((item: any) =>
            normalizeUuid(item.venue_id)
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          ) ?? []
      ),
    ],
  }
}

function normalizeGenerationVenue(
  venue: VenueRow
): GenerateRouteFromCollectionVenue {
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug ?? null,
    city: venue.city ?? null,
    address: venue.address ?? null,
    lat: venue.lat as number,
    lon: venue.lon as number,
    type: normalizeListLikeValue(venue.type),
    types: null,
    venue_type: null,
    venue_types: null,
    category: null,
    categories: null,
    tags: normalizeListLikeValue(venue.tags),
    vibe: normalizeListLikeValue(venue.vibe),
    price: venue.price ?? null,
    hours: Array.isArray(venue.hours)
      ? venue.hours
      : venue.hours ?? null,
    dayParts: null,
    image_url: venue.cover ?? null,
    link: venue.slug
      ? `/venue-profile/${venue.id}`
      : null,
    is_active: null,
  }
}

function normalizeGeneratedRoute(
  stops: Array<{
    venue: {
      id: string
    }
    origin?: 'collection' | 'roam_fill'
  }>
):
  | Array<{
      venueId: string
      stopIndex: number
      origin: 'collection' | 'roam_fill'
    }>
  | null {
  if (!Array.isArray(stops) || stops.length < 2) {
    return null
  }

  const normalizedStops: Array<{
    venueId: string
    stopIndex: number
    origin: 'collection' | 'roam_fill'
  }> = []

  const venueIds = new Set<string>()

  for (
    let stopIndex = 0;
    stopIndex < stops.length;
    stopIndex += 1
  ) {
    const stop = stops[stopIndex]
    const venueId = normalizeUuid(stop?.venue?.id)

    if (!venueId || venueIds.has(venueId)) {
      return null
    }

    if (
      stop.origin !== 'collection' &&
      stop.origin !== 'roam_fill'
    ) {
      return null
    }

    venueIds.add(venueId)

    normalizedStops.push({
      venueId,
      stopIndex,
      origin: stop.origin,
    })
  }

  return normalizedStops
}

function hasUsableCoordinates(
  venue: VenueRow | null | undefined
): venue is VenueRow {
  return (
    Boolean(normalizeUuid(venue?.id)) &&
    Boolean(normalizeNullableText(venue?.name)) &&
    typeof venue?.lat === 'number' &&
    Number.isFinite(venue.lat) &&
    Math.abs(venue.lat) <= 90 &&
    typeof venue?.lon === 'number' &&
    Number.isFinite(venue.lon) &&
    Math.abs(venue.lon) <= 180
  )
}

function sanitizeTravelMode(
  value: unknown
): RouteTravelMode {
  return value === 'cycling' ||
    value === 'driving' ||
    value === 'walking'
    ? value
    : 'walking'
}

function sanitizeTightness(
  value: unknown
): RouteTightness {
  return value === 'tight' ||
    value === 'loose' ||
    value === 'medium'
    ? value
    : 'medium'
}

function sanitizeMaxStops(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_MAX_STOPS
  }

  return Math.max(
    3,
    Math.min(
      8,
      Math.round(value)
    )
  )
}

function sanitizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === 'string'
        )
        .map((item) =>
          item
            .trim()
            .replace(/\s+/g, ' ')
        )
        .filter(Boolean)
    ),
  ].slice(0, 50)
}

function normalizePlannedStartAt(
  value: unknown
): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)

  if (!Number.isFinite(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function normalizeUuid(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? normalized
    : null
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeListLikeValue(
  value: unknown
): any {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        String(item).trim()
      )
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (!trimmed) {
      return null
    }

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
    }

    return trimmed
  }

  return value ?? null
}

function isUniqueConstraintViolation(
  error: unknown
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    !Array.isArray(error) &&
    (
      error as Record<string, unknown>
    ).code === '23505'
  )
}