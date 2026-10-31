
import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  isAllowedAdminEmail,
} from '@/lib/auth/adminAccess'

export const dynamic = 'force-dynamic'

/* =========================================================
 * Configuration
 * ======================================================= */

const MAX_HOST_FAVORITES = 10
const MAX_FAVORITE_LABEL_LENGTH = 120
const MAX_FAVORITE_DESCRIPTION_LENGTH = 500

const MAX_PROPERTY_NAME_LENGTH = 160
const MAX_PROPERTY_ADDRESS_LENGTH = 500
const MAX_PROPERTY_WEBSITE_LENGTH = 500
const MAX_WELCOME_DESCRIPTION_LENGTH = 5000

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteContext = {
  params: Promise<{
    propertyId: string
  }>
}

type PropertyRecord = {
  id: string
  name: string
  city: string
  slug: string
  address: string | null
  website: string | null
  welcome_description: string | null
  lat: number | string | null
  lon: number | string | null
  owner_user_id: string | null
}

type FavoriteRecord = {
  id: string
  property_id: string
  venue_id: string
  label: string | null
  description: string | null
  priority: number | null
  category: string | null
}

type VenueRecord = {
  id: string
  name: string
  city: string | null
  canonical_city: string | null
  address: string | null
  type: unknown
}

type FavoriteInput = {
  venueId: string
  label: string | null
  description: string | null
}

type ValidatedUpdate = {
  name: string
  address: string
  website: string | null
  welcomeDescription: string | null
  favorites: FavoriteInput[]
}

type ValidationResult =
  | {
      ok: true
      value: ValidatedUpdate
    }
  | {
      ok: false
      error: string
    }

/* =========================================================
 * Response helpers
 * ======================================================= */

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  )
}

function isUuid(
  value: unknown
): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const parts = value.split('-')

  return (
    parts.length === 5 &&
    parts[0].length === 8 &&
    parts[1].length === 4 &&
    parts[2].length === 4 &&
    parts[3].length === 4 &&
    parts[4].length === 12 &&
    parts.every((part) =>
      /^[0-9a-f]+$/i.test(part)
    )
  )
}

function normalizeCityKey(
  input: string | null | undefined
): string {
  const raw = (
    input ?? ''
  ).trim().toLowerCase()

  const aliases: Record<string, string> = {
    atl: 'atl',
    atlanta: 'atl',
    'atlanta ga': 'atl',

    nyc: 'nyc',
    'new york': 'nyc',
    'new york city': 'nyc',
    manhattan: 'nyc',
    brooklyn: 'nyc',
    queens: 'nyc',
    bronx: 'nyc',
    'staten island': 'nyc',

    la: 'la',
    'los angeles': 'la',
    'los-angeles': 'la',
    hollywood: 'la',
    'west hollywood': 'la',
    weho: 'la',
    venice: 'la',
    'santa monica': 'la',
    dtla: 'la',

    london: 'london',
    ldn: 'london',
    'greater london': 'london',

    porto: 'porto',
    oporto: 'porto',

    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
}

function normalizeTypes(
  input: unknown
): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  const result: string[] = []

  for (const item of input) {
    if (typeof item !== 'string') {
      continue
    }

    for (const part of item.split(',')) {
      const value = part.trim()

      if (value && !result.includes(value)) {
        result.push(value)
      }
    }
  }

  return result
}

function normalizeCoordinate(
  input: unknown
): number | null {
  if (
    input === null ||
    input === undefined ||
    input === ''
  ) {
    return null
  }

  const value = Number(input)

  return Number.isFinite(value)
    ? value
    : null
}

function publicProperty(
  property: PropertyRecord
) {
  return {
    id: property.id,
    name: property.name,
    city: property.city,
    slug: property.slug,
    address: property.address,
    website: property.website,
    welcome_description:
      property.welcome_description,
    lat: normalizeCoordinate(property.lat),
    lon: normalizeCoordinate(property.lon),
  }
}

/* =========================================================
 * Authentication and authorization
 *
 * Property ownership is checked using the authenticated
 * Supabase user, never a user ID supplied by the browser.
 *
 * Administrator access reuses Roam's existing centralized
 * email allowlist in lib/auth/adminAccess.ts.
 *
 * Both GET and PATCH use this same authorization check.
 * ======================================================= */

function canEditProperty(
  user: {
    id: string
    email?: string | null
  },
  property: PropertyRecord
): boolean {
  return (
    property.owner_user_id === user.id ||
    isAllowedAdminEmail(user.email?.trim())
  )
}

/* =========================================================
 * Input validation
 * ======================================================= */

function validateUpdate(
  input: unknown
): ValidationResult {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    return {
      ok: false,
      error: 'Invalid property update.',
    }
  }

  const body = input as Record<string, unknown>

  if (
    typeof body.name !== 'string' ||
    !body.name.trim()
  ) {
    return {
      ok: false,
      error: 'Property name is required.',
    }
  }

  if (
    typeof body.address !== 'string' ||
    !body.address.trim()
  ) {
    return {
      ok: false,
      error: 'Property address is required.',
    }
  }

  const name = body.name.trim()
  const address = body.address.trim()

  if (name.length > MAX_PROPERTY_NAME_LENGTH) {
    return {
      ok: false,
      error:
        `Property name must be ${MAX_PROPERTY_NAME_LENGTH} characters or fewer.`,
    }
  }

  if (address.length > MAX_PROPERTY_ADDRESS_LENGTH) {
    return {
      ok: false,
      error:
        `Property address must be ${MAX_PROPERTY_ADDRESS_LENGTH} characters or fewer.`,
    }
  }

  if (
    body.website !== null &&
    body.website !== undefined &&
    typeof body.website !== 'string'
  ) {
    return {
      ok: false,
      error: 'Website must be text.',
    }
  }

  if (
    body.welcomeDescription !== null &&
    body.welcomeDescription !== undefined &&
    typeof body.welcomeDescription !== 'string'
  ) {
    return {
      ok: false,
      error: 'Welcome description must be text.',
    }
  }

  const website =
    typeof body.website === 'string'
      ? body.website.trim()
      : ''

  const welcomeDescription =
    typeof body.welcomeDescription === 'string'
      ? body.welcomeDescription.trim()
      : ''

  if (website.length > MAX_PROPERTY_WEBSITE_LENGTH) {
    return {
      ok: false,
      error:
        `Website must be ${MAX_PROPERTY_WEBSITE_LENGTH} characters or fewer.`,
    }
  }

  if (
    welcomeDescription.length >
    MAX_WELCOME_DESCRIPTION_LENGTH
  ) {
    return {
      ok: false,
      error:
        `Welcome description must be ${MAX_WELCOME_DESCRIPTION_LENGTH} characters or fewer.`,
    }
  }

  if (website) {
    try {
      const url = new URL(website)

      if (
        url.protocol !== 'https:' &&
        url.protocol !== 'http:'
      ) {
        return {
          ok: false,
          error:
            'Website must use http or https.',
        }
      }
    } catch {
      return {
        ok: false,
        error:
          'Enter a valid website URL.',
      }
    }
  }

  if (!Array.isArray(body.favorites)) {
    return {
      ok: false,
      error:
        'Host Picks must be provided as an array.',
    }
  }

  if (
    body.favorites.length >
    MAX_HOST_FAVORITES
  ) {
    return {
      ok: false,
      error:
        `Select no more than ${MAX_HOST_FAVORITES} Host Picks.`,
    }
  }

  const favorites: FavoriteInput[] = []
  const seenIds = new Set<string>()

  for (const item of body.favorites) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      return {
        ok: false,
        error: 'Invalid Host Pick.',
      }
    }

    const favorite =
      item as Record<string, unknown>

    if (!isUuid(favorite.venueId)) {
      return {
        ok: false,
        error:
          'Each Host Pick must have a valid venue ID.',
      }
    }

    const venueId =
      favorite.venueId.toLowerCase()

    if (seenIds.has(venueId)) {
      return {
        ok: false,
        error:
          'Duplicate Host Picks are not allowed.',
      }
    }

    seenIds.add(venueId)

    if (
      favorite.label !== null &&
      favorite.label !== undefined &&
      typeof favorite.label !== 'string'
    ) {
      return {
        ok: false,
        error:
          'Host Pick labels must be text.',
      }
    }

    if (
      favorite.description !== null &&
      favorite.description !== undefined &&
      typeof favorite.description !== 'string'
    ) {
      return {
        ok: false,
        error:
          'Host Pick recommendations must be text.',
      }
    }

    const label =
      typeof favorite.label === 'string'
        ? favorite.label.trim()
        : ''

    const description =
      typeof favorite.description === 'string'
        ? favorite.description.trim()
        : ''

    if (
      label.length >
      MAX_FAVORITE_LABEL_LENGTH
    ) {
      return {
        ok: false,
        error:
          `Host Pick labels must be ${MAX_FAVORITE_LABEL_LENGTH} characters or fewer.`,
      }
    }

    if (
      description.length >
      MAX_FAVORITE_DESCRIPTION_LENGTH
    ) {
      return {
        ok: false,
        error:
          `Host Pick recommendations must be ${MAX_FAVORITE_DESCRIPTION_LENGTH} characters or fewer.`,
      }
    }

    favorites.push({
      venueId,
      label: label || null,
      description: description || null,
    })
  }

  return {
    ok: true,
    value: {
      name,
      address,
      website: website || null,
      welcomeDescription:
        welcomeDescription || null,
      favorites,
    },
  }
}

/* =========================================================
 * Geocoding
 *
 * An address change must yield real coordinates.
 * Never save a new address with stale map coordinates.
 * ======================================================= */

async function geocodeAddress(
  address: string
): Promise<{
  lat: number
  lon: number
} | null> {
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) {
    console.error(
      '[property-editor] Missing Mapbox token.'
    )

    return null
  }

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
      `${encodeURIComponent(address)}.json` +
      `?limit=1&access_token=${encodeURIComponent(token)}`

    const response = await fetch(
      url,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    )

    if (!response.ok) {
      return null
    }

    const payload = await response.json()

    const center =
      payload?.features?.[0]?.center

    if (
      !Array.isArray(center) ||
      center.length < 2
    ) {
      return null
    }

    const lon = Number(center[0])
    const lat = Number(center[1])

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return null
    }

    return { lat, lon }
  } catch (error) {
    console.error(
      '[property-editor] Address geocoding failed:',
      error
    )

    return null
  }
}

/* =========================================================
 * Read and hydrate Host Picks
 * ======================================================= */

async function loadFavorites(
  db: any,
  propertyId: string
): Promise<{
  rows: FavoriteRecord[]
  publicFavorites: Array<{
    venueId: string
    label: string | null
    description: string | null
    priority: number
    venue: {
      id: string
      name: string
      city: string
      canonicalCity: string | null
      address: string | null
      type: string[]
    }
  }>
}> {
  const { data, error } = await db
    .from('property_favorites')
    .select(
      'id, property_id, venue_id, label, description, priority, category'
    )
    .eq('property_id', propertyId)
    .order('priority', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      'Unable to load property Host Picks.'
    )
  }

  const rows =
    (data ?? []) as FavoriteRecord[]

  if (rows.length === 0) {
    return {
      rows,
      publicFavorites: [],
    }
  }

  const venueIds = [
    ...new Set(
      rows.map((row) => row.venue_id)
    ),
  ]

  const {
    data: venuesData,
    error: venuesError,
  } = await db
    .from('venues')
    .select(
      'id, name, city, canonical_city, address, type'
    )
    .in('id', venueIds)

  if (venuesError) {
    throw new Error(
      'Unable to load Host Pick venue details.'
    )
  }

  const venueById =
    new Map<string, VenueRecord>(
      (
        (venuesData ?? []) as VenueRecord[]
      ).map((venue) => [
        venue.id,
        venue,
      ])
    )

  const publicFavorites = rows.map(
    (favorite, index) => {
      const venue =
        venueById.get(favorite.venue_id)

      if (!venue) {
        throw new Error(
          'A Host Pick references a venue that could not be loaded.'
        )
      }

      return {
        venueId: favorite.venue_id,
        label: favorite.label,
        description: favorite.description,
        priority:
          favorite.priority ?? index,
        venue: {
          id: venue.id,
          name: venue.name,
          city: venue.city ?? '',
          canonicalCity:
            venue.canonical_city,
          address: venue.address,
          type: normalizeTypes(venue.type),
        },
      }
    }
  )

  return {
    rows,
    publicFavorites,
  }
}

/* =========================================================
 * GET
 *
 * GET /api/hosts/properties/[propertyId]
 *
 * Owner/admin access only.
 * ======================================================= */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { propertyId } =
      await context.params

    if (!isUuid(propertyId)) {
      return json(
        { error: 'Invalid property ID.' },
        400
      )
    }

    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return json(
        { error: 'Authentication required.' },
        401
      )
    }

    /*
     * Use the existing server client.
     *
     * The cast accommodates generated Supabase types
     * that may not yet include owner_user_id.
     */
    const db = supabase as any

    const {
      data: propertyData,
      error: propertyError,
    } = await db
      .from('properties')
      .select(
        [
          'id',
          'name',
          'city',
          'slug',
          'address',
          'website',
          'welcome_description',
          'lat',
          'lon',
          'owner_user_id',
        ].join(', ')
      )
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyError) {
      console.error(
        '[property-editor] Property lookup failed:',
        propertyError
      )

      return json(
        { error: 'Unable to load property.' },
        500
      )
    }

    if (!propertyData) {
      return json(
        { error: 'Property not found.' },
        404
      )
    }

    const property =
      propertyData as PropertyRecord

    if (
      !canEditProperty(
        user,
        property
      )
    ) {
      return json(
        {
          error:
            'You are not authorized to edit this property.',
        },
        403
      )
    }

    const favorites =
      await loadFavorites(
        db,
        property.id
      )

    return json({
      property: publicProperty(property),
      favorites:
        favorites.publicFavorites,
      canEdit: true,
    })
  } catch (error) {
    console.error(
      '[property-editor] GET failed:',
      error
    )

    return json(
      {
        error:
          'Unexpected error loading property editor.',
      },
      500
    )
  }
}

/* =========================================================
 * PATCH
 *
 * PATCH /api/hosts/properties/[propertyId]
 *
 * Only the property's owner or a trusted admin may
 * update its editable fields and Host Picks.
 *
 * City, slug, ownership, approved, and featured
 * cannot be modified through this endpoint.
 * ======================================================= */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { propertyId } =
      await context.params

    if (!isUuid(propertyId)) {
      return json(
        { error: 'Invalid property ID.' },
        400
      )
    }

    /*
     * Browser-side editing uses same-origin JSON.
     *
     * Reject mismatched Origin headers rather than
     * accepting cross-origin credentialed mutations.
     */
    const origin =
      request.headers.get('origin')

    if (
      origin &&
      origin !== request.nextUrl.origin
    ) {
      return json(
        { error: 'Invalid request origin.' },
        403
      )
    }

    const contentType =
      request.headers.get('content-type') ?? ''

    if (
      !contentType
        .toLowerCase()
        .startsWith('application/json')
    ) {
      return json(
        {
          error:
            'Content-Type must be application/json.',
        },
        415
      )
    }

    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return json(
        { error: 'Authentication required.' },
        401
      )
    }

    const db = supabase as any

    const {
      data: propertyData,
      error: propertyError,
    } = await db
      .from('properties')
      .select(
        [
          'id',
          'name',
          'city',
          'slug',
          'address',
          'website',
          'welcome_description',
          'lat',
          'lon',
          'owner_user_id',
        ].join(', ')
      )
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyError) {
      console.error(
        '[property-editor] Property lookup failed:',
        propertyError
      )

      return json(
        { error: 'Unable to load property.' },
        500
      )
    }

    if (!propertyData) {
      return json(
        { error: 'Property not found.' },
        404
      )
    }

    const property =
      propertyData as PropertyRecord

    if (
      !canEditProperty(
        user,
        property
      )
    ) {
      return json(
        {
          error:
            'You are not authorized to edit this property.',
        },
        403
      )
    }

    let rawBody: unknown

    try {
      rawBody = await request.json()
    } catch {
      return json(
        { error: 'Invalid JSON request body.' },
        400
      )
    }

    const validated =
      validateUpdate(rawBody)

    if (!validated.ok) {
      return json(
        { error: validated.error },
        400
      )
    }

    const update =
      validated.value

    /* ------------------------------------------------ */
    /* Validate every chosen venue against property city */
    /* ------------------------------------------------ */

    const selectedVenueIds =
      update.favorites.map(
        (favorite) => favorite.venueId
      )

    if (selectedVenueIds.length > 0) {
      const {
        data: selectedVenueData,
        error: venueError,
      } = await db
        .from('venues')
        .select(
          'id, city, canonical_city'
        )
        .in(
          'id',
          selectedVenueIds
        )

      if (venueError) {
        console.error(
          '[property-editor] Venue validation failed:',
          venueError
        )

        return json(
          {
            error:
              'Unable to validate selected venues.',
          },
          500
        )
      }

      const selectedVenues =
        new Map<
          string,
          {
            id: string
            city: string | null
            canonical_city: string | null
          }
        >(
          (
            selectedVenueData ?? []
          ).map((venue: any) => [
            String(venue.id).toLowerCase(),
            venue,
          ])
        )

      const propertyCity =
        normalizeCityKey(property.city)

      for (const favorite of update.favorites) {
        const venue =
          selectedVenues.get(
            favorite.venueId
          )

        if (!venue) {
          return json(
            {
              error:
                'One or more selected venues no longer exist.',
            },
            400
          )
        }

        const venueCity =
          normalizeCityKey(
            venue.canonical_city ||
            venue.city
          )

        if (
          venueCity !== propertyCity
        ) {
          return json(
            {
              error:
                'Host Picks must belong to the property city.',
            },
            400
          )
        }
      }
    }

    /* ------------------------------------------------ */
    /* Resolve address changes                          */
    /* ------------------------------------------------ */

    const addressChanged =
      update.address !==
      (property.address ?? '')

    let nextLat =
      normalizeCoordinate(property.lat)

    let nextLon =
      normalizeCoordinate(property.lon)

    if (addressChanged) {
      const coordinates =
        await geocodeAddress(
          update.address
        )

      if (!coordinates) {
        return json(
          {
            error:
              'Unable to verify the new address. Please check it and try again.',
          },
          422
        )
      }

      nextLat = coordinates.lat
      nextLon = coordinates.lon
    }

    /* ------------------------------------------------ */
    /* Snapshot existing Host Picks for safe restoration */
    /* ------------------------------------------------ */

    let previousFavorites:
      FavoriteRecord[]

    try {
      const snapshot =
        await loadFavorites(
          db,
          property.id
        )

      previousFavorites =
        snapshot.rows
    } catch (error) {
      console.error(
        '[property-editor] Unable to snapshot favorites:',
        error
      )

      return json(
        {
          error:
            'Unable to verify existing Host Picks. No changes were saved.',
        },
        500
      )
    }

    const previousFavoritePayload =
      previousFavorites.map(
        (favorite) => ({
          id: favorite.id,
          property_id:
            favorite.property_id,
          venue_id:
            favorite.venue_id,
          label:
            favorite.label,
          description:
            favorite.description,
          priority:
            favorite.priority,
          category:
            favorite.category,
        })
      )

    const previousFavoritesByVenueId =
      new Map(
        previousFavorites.map(
          (favorite) => [
            favorite.venue_id,
            favorite,
          ]
        )
      )

    const nextFavoritePayload =
      update.favorites.map(
        (favorite, index) => ({
          property_id: property.id,
          venue_id: favorite.venueId,
          label: favorite.label,
          description:
            favorite.description,
          priority: index,

          // Preserve the optional existing category
          // when a venue remains a Host Pick.
          category:
            previousFavoritesByVenueId.get(
              favorite.venueId
            )?.category ?? null,
        })
      )

    const favoritesChanged =
      JSON.stringify(
        previousFavorites.map(
          (favorite, index) => ({
            venueId: favorite.venue_id,
            label: favorite.label,
            description:
              favorite.description,
            priority:
              favorite.priority ?? index,
          })
        )
      ) !==
      JSON.stringify(
        update.favorites.map(
          (favorite, index) => ({
            venueId: favorite.venueId,
            label: favorite.label,
            description:
              favorite.description,
            priority: index,
          })
        )
      )

    const propertyChanged =
      update.name !== property.name ||
      update.address !==
        (property.address ?? '') ||
      update.website !==
        property.website ||
      update.welcomeDescription !==
        property.welcome_description

    /* ------------------------------------------------ */
    /* Persist editable property fields                 */
    /* ------------------------------------------------ */

    if (propertyChanged) {
      const {
        error: updateError,
      } = await db
        .from('properties')
        .update({
          name: update.name,
          address: update.address,
          website: update.website,
          welcome_description:
            update.welcomeDescription,

          // Re-geocoded only when address changes.
          lat: nextLat,
          lon: nextLon,
        })
        .eq('id', property.id)

      if (updateError) {
        console.error(
          '[property-editor] Property update failed:',
          updateError
        )

        return json(
          {
            error:
              'Unable to save property details.',
          },
          500
        )
      }
    }

    /* ------------------------------------------------ */
    /* Persist ordered Host Picks                       */
    /* ------------------------------------------------ */

    if (favoritesChanged) {
      const {
        error: deleteError,
      } = await db
        .from('property_favorites')
        .delete()
        .eq(
          'property_id',
          property.id
        )

      if (!deleteError) {
        if (
          nextFavoritePayload.length > 0
        ) {
          const {
            error: insertError,
          } = await db
            .from('property_favorites')
            .insert(
              nextFavoritePayload
            )

          if (insertError) {
            console.error(
              '[property-editor] Host Picks insert failed:',
              insertError
            )

            /*
             * The delete may have succeeded before
             * the insert failed. Restore the snapshot.
             */
            return await restoreAfterFailure({
              db,
              property,
              previousFavoritePayload,
              propertyChanged,
            })
          }
        }
      } else {
        console.error(
          '[property-editor] Host Picks delete failed:',
          deleteError
        )

        return await restoreAfterFailure({
          db,
          property,
          previousFavoritePayload,
          propertyChanged,
        })
      }
    }

    /* ------------------------------------------------ */
    /* Reload the actual saved state                    */
    /* ------------------------------------------------ */

    const {
      data: savedPropertyData,
      error: savedPropertyError,
    } = await db
      .from('properties')
      .select(
        [
          'id',
          'name',
          'city',
          'slug',
          'address',
          'website',
          'welcome_description',
          'lat',
          'lon',
          'owner_user_id',
        ].join(', ')
      )
      .eq('id', property.id)
      .single()

    if (
      savedPropertyError ||
      !savedPropertyData
    ) {
      console.error(
        '[property-editor] Saved property reload failed:',
        savedPropertyError
      )

      return json(
        {
          error:
            'Changes may have been saved, but the updated property could not be reloaded. Refresh before editing again.',
        },
        500
      )
    }

    const savedProperty =
      savedPropertyData as PropertyRecord

    let savedFavorites:
      Awaited<ReturnType<typeof loadFavorites>>

    try {
      savedFavorites =
        await loadFavorites(
          db,
          property.id
        )
    } catch (error) {
      console.error(
        '[property-editor] Saved favorites reload failed:',
        error
      )

      return json(
        {
          error:
            'Changes may have been saved, but Host Picks could not be reloaded. Refresh before editing again.',
        },
        500
      )
    }

    return json({
      success: true,
      property:
        publicProperty(savedProperty),
      favorites:
        savedFavorites.publicFavorites,
    })
  } catch (error) {
    console.error(
      '[property-editor] PATCH failed:',
      error
    )

    return json(
      {
        error:
          'Unexpected error saving property changes.',
      },
      500
    )
  }
}

/* =========================================================
 * Best-effort restoration
 *
 * Supabase/PostgREST makes each table mutation a separate
 * database transaction. This restores earlier state after
 * a failed multi-table operation when possible.
 *
 * Strict atomicity requires a PostgreSQL RPC/transaction.
 * ======================================================= */

async function restoreAfterFailure({
  db,
  property,
  previousFavoritePayload,
  propertyChanged,
}: {
  db: any
  property: PropertyRecord
  previousFavoritePayload: Array<{
    id: string
    property_id: string
    venue_id: string
    label: string | null
    description: string | null
    priority: number | null
    category: string | null
  }>
  propertyChanged: boolean
}) {
  let restorationFailed = false

  /*
   * Remove any replacement favorites that may already
   * exist before restoring the original snapshot.
   */
  const {
    error: cleanupError,
  } = await db
    .from('property_favorites')
    .delete()
    .eq(
      'property_id',
      property.id
    )

  if (cleanupError) {
    restorationFailed = true

    console.error(
      '[property-editor] Favorites cleanup failed:',
      cleanupError
    )
  } else if (
    previousFavoritePayload.length > 0
  ) {
    const {
      error: restoreFavoritesError,
    } = await db
      .from('property_favorites')
      .insert(
        previousFavoritePayload
      )

    if (restoreFavoritesError) {
      restorationFailed = true

      console.error(
        '[property-editor] Favorites restoration failed:',
        restoreFavoritesError
      )
    }
  }

  if (propertyChanged) {
    const {
      error: restorePropertyError,
    } = await db
      .from('properties')
      .update({
        name: property.name,
        address: property.address,
        website: property.website,
        welcome_description:
          property.welcome_description,
        lat: property.lat,
        lon: property.lon,
      })
      .eq(
        'id',
        property.id
      )

    if (restorePropertyError) {
      restorationFailed = true

      console.error(
        '[property-editor] Property restoration failed:',
        restorePropertyError
      )
    }
  }

  return json(
    {
      error:
        restorationFailed
          ? 'Saving failed and the previous state could not be fully restored. Please contact support before making more changes.'
          : 'Unable to save Host Picks. Previous property details and recommendations were restored.',
    },
    500
  )
}
