
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SUPPORTED_HOST_CITIES = new Set([
  'atl',
  'nyc',
  'porto',
  'lisbon',

  // 🇬🇧 London
  'london',

  // 🇺🇸 Los Angeles
  'la',
])

/* ------------------------------------------------ */
/* Host Favorites configuration                     */
/* ------------------------------------------------ */

const MAX_HOST_FAVORITES = 10
const MAX_FAVORITE_LABEL_LENGTH = 120
const MAX_FAVORITE_DESCRIPTION_LENGTH = 500

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type HostFavoriteInput = {
  venueId: string
  label: string | null
  description: string | null
}

type FavoriteValidationResult =
  | {
      ok: true
      favorites: HostFavoriteInput[]
    }
  | {
      ok: false
      error: string
    }

function validateHostFavorites(
  input: unknown
): FavoriteValidationResult {
  // Preserve compatibility with existing host creation
  // requests that do not include any favorites.
  if (input === undefined) {
    return {
      ok: true,
      favorites: [],
    }
  }

  if (!Array.isArray(input)) {
    return {
      ok: false,
      error: 'Favorites must be an array.',
    }
  }

  if (input.length > MAX_HOST_FAVORITES) {
    return {
      ok: false,
      error: `You can select up to ${MAX_HOST_FAVORITES} favorite venues.`,
    }
  }

  const favorites: HostFavoriteInput[] = []
  const seenVenueIds = new Set<string>()

  for (const item of input) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      return {
        ok: false,
        error: 'Invalid favorite venue.',
      }
    }

    const candidate = item as Record<string, unknown>

    if (
      typeof candidate.venueId !== 'string' ||
      !UUID_PATTERN.test(candidate.venueId)
    ) {
      return {
        ok: false,
        error: 'Each favorite must have a valid venue ID.',
      }
    }

    const venueId = candidate.venueId.toLowerCase()

    if (seenVenueIds.has(venueId)) {
      return {
        ok: false,
        error: 'The same venue cannot be selected more than once.',
      }
    }

    seenVenueIds.add(venueId)

    if (
      candidate.label !== undefined &&
      candidate.label !== null &&
      typeof candidate.label !== 'string'
    ) {
      return {
        ok: false,
        error: 'Favorite labels must be text.',
      }
    }

    if (
      candidate.description !== undefined &&
      candidate.description !== null &&
      typeof candidate.description !== 'string'
    ) {
      return {
        ok: false,
        error: 'Favorite recommendations must be text.',
      }
    }

    const label =
      typeof candidate.label === 'string'
        ? candidate.label.trim()
        : ''

    const description =
      typeof candidate.description === 'string'
        ? candidate.description.trim()
        : ''

    if (label.length > MAX_FAVORITE_LABEL_LENGTH) {
      return {
        ok: false,
        error: `Favorite labels must be ${MAX_FAVORITE_LABEL_LENGTH} characters or fewer.`,
      }
    }

    if (
      description.length >
      MAX_FAVORITE_DESCRIPTION_LENGTH
    ) {
      return {
        ok: false,
        error: `Favorite recommendations must be ${MAX_FAVORITE_DESCRIPTION_LENGTH} characters or fewer.`,
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
    favorites,
  }
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

function normalizeCityKey(input: string) {
  const raw = input.toLowerCase().trim()

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
    hollywood: 'la',
    'west hollywood': 'la',
    weho: 'la',
    venice: 'la',
    'santa monica': 'la',
    dtla: 'la',

    london: 'london',
    ldn: 'london',
    'greater london': 'london',
    shoreditch: 'london',
    soho: 'london',
    camden: 'london',
    chelsea: 'london',
    hackney: 'london',

    porto: 'porto',
    oporto: 'porto',

    lisbon: 'lisbon',
    lisboa: 'lisbon',
  }

  return aliases[raw] ?? raw
}

async function geocodeAddress(address: string) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) {
    console.warn('Missing Mapbox token — skipping geocoding')
    return null
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?limit=1&access_token=${token}`

  const res = await fetch(url)

  if (!res.ok) return null

  const data = await res.json()

  if (!data.features?.length) return null

  const [lon, lat] = data.features[0].center

  return { lat, lon }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    /* ------------------------------------------------ */
    /* Property creator ownership                       */
    /* ------------------------------------------------ */

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const {
      name,
      city,
      address,
      website,
      welcomeDescription,
      favorites: favoritesInput,
    } = await req.json()

    if (!name || !city || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const normalizedCity = normalizeCityKey(city)

    if (!SUPPORTED_HOST_CITIES.has(normalizedCity)) {
      return NextResponse.json(
        { error: 'Unsupported city selection' },
        { status: 400 }
      )
    }

    /* ------------------------------------------------ */
    /* Validate Host Favorites before property creation  */
    /* ------------------------------------------------ */

    const validatedFavorites =
      validateHostFavorites(favoritesInput)

    if (!validatedFavorites.ok) {
      return NextResponse.json(
        { error: validatedFavorites.error },
        { status: 400 }
      )
    }

    const favorites = validatedFavorites.favorites

    if (favorites.length > 0) {
      const requestedVenueIds = favorites.map(
        (favorite) => favorite.venueId
      )

      const { data: matchingVenues, error: venueLookupError } =
        await supabase
          .from('venues')
          .select('id, city, canonical_city')
          .in('id', requestedVenueIds)

      if (venueLookupError) {
        console.error(
          'Host favorite venue validation error:',
          venueLookupError
        )

        return NextResponse.json(
          { error: 'Unable to validate selected favorite venues' },
          { status: 500 }
        )
      }

      const venuesById = new Map(
        (matchingVenues ?? []).map((venue) => [
          venue.id.toLowerCase(),
          venue,
        ])
      )

      for (const favorite of favorites) {
        const venue = venuesById.get(favorite.venueId)

        if (!venue) {
          return NextResponse.json(
            {
              error:
                'One or more selected favorite venues no longer exist or are unavailable.',
            },
            { status: 400 }
          )
        }

        /*
         * The venues table uses canonical_city = "la"
         * while its city column contains "los angeles".
         *
         * Validate against canonical_city when present,
         * falling back to the existing city field.
         *
         * Do not trust the city sent by the browser for
         * individual venue selections.
         */
        const venueCity = normalizeCityKey(
          venue.canonical_city ||
          venue.city ||
          ''
        )

        if (venueCity !== normalizedCity) {
          return NextResponse.json(
            {
              error:
                'Favorite venues must belong to the selected property city.',
            },
            { status: 400 }
          )
        }
      }
    }

    const slug = slugify(name)

    // Geocode address
    const coords = await geocodeAddress(address)

    const lat = coords?.lat ?? null
    const lon = coords?.lon ?? null

    const { data, error } = await supabase
      .from('properties')
      .insert({
        name,
        slug,
        city: normalizedCity,
        address,
        website: website ?? null,
        welcome_description:
          typeof welcomeDescription === 'string' &&
          welcomeDescription.trim().length > 0
            ? welcomeDescription.trim()
            : null,
        lat,
        lon,

        // Associate the property with its signed-in creator.
        // Preserve anonymous creation with a null owner.
        owner_user_id: user?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('Property insert error:', error)

      return NextResponse.json(
        { error: 'Failed to create property' },
        { status: 500 }
      )
    }

    /* ------------------------------------------------ */
    /* Persist ordered Host Picks                        */
    /* ------------------------------------------------ */

    if (favorites.length > 0) {
      const favoriteRows = favorites.map(
        (favorite, index) => ({
          property_id: data.id,
          venue_id: favorite.venueId,
          label: favorite.label,
          description: favorite.description,
          priority: index,
        })
      )

      const { error: favoritesInsertError } =
        await supabase
          .from('property_favorites')
          .insert(favoriteRows)

      if (favoritesInsertError) {
        console.error(
          'Property favorites insert error:',
          favoritesInsertError
        )

        /*
         * Do not return a successful guide URL when
         * the host's chosen favorites were not saved.
         *
         * Attempt to remove the property just created.
         * The database's ON DELETE CASCADE constraint
         * will also remove any associated favorites.
         *
         * This is compensating cleanup, not a true
         * transaction. An RPC is required for strict
         * atomic creation across both tables.
         */
        const { error: rollbackError } =
          await supabase
            .from('properties')
            .delete()
            .eq('id', data.id)

        if (rollbackError) {
          console.error(
            'Failed to clean up property after favorites insert error:',
            {
              propertyId: data.id,
              rollbackError,
            }
          )
        }

        return NextResponse.json(
          {
            error:
              'Failed to save Host Picks. Your guide could not be completed. Please try again.',
          },
          { status: 500 }
        )
      }
    }

    const url = `/property/${normalizedCity}/${slug}`

    return NextResponse.json({
      success: true,
      url,
      property: data,
    })
  } catch (err) {
    console.error('Host creation error:', err)

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    )
  }
}
