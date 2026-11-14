
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  normalizeCityKey,
  isSupportedCityKey,
} from '@/lib/cities/normalizeCity'

type Context = {
  params: Promise<{ editionId: string }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UUID_PATTERN.test(value)
  )
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

type CollectionRow = {
  id: string
  user_id: string
  title: string
  slug: string
  description: string | null
  city: string | null
  cover_image_url: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  is_public: boolean | null
  creator_mode_enabled: boolean | null
}

async function getEligibleCollection(
  collectionId: string,
  editionCity: string,
) {
  const { data: collection, error } = await supabaseAdmin
    .from('creator_collections')
    .select(
      'id, user_id, title, slug, description, city, cover_image_url',
    )
    .eq('id', collectionId)
    .eq('visibility', 'public')
    .maybeSingle()

  if (error) throw error

  if (!collection) return null

  const typedCollection = collection as CollectionRow

  if (
    normalizeCityKey(typedCollection.city) !== editionCity
  ) {
    return null
  }

  const profileResult = await supabaseAdmin
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, is_public, creator_mode_enabled',
    )
    .eq('id', typedCollection.user_id)
    .maybeSingle()

  if (profileResult.error) throw profileResult.error

  const profile = profileResult.data as ProfileRow | null

  if (
    !profile ||
    profile.is_public === false ||
    profile.creator_mode_enabled !== true
  ) {
    return null
  }

  return { collection: typedCollection, profile }
}

export async function GET(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    if (!validId(editionId)) {
      return json({ error: 'Invalid edition ID.' }, 400)
    }

    const { data: edition, error: editionError } =
      await supabaseAdmin
        .from('roam_editorial_editions')
        .select('id, city')
        .eq('id', editionId)
        .maybeSingle()

    if (editionError) throw editionError

    if (!edition) {
      return json({ error: 'Edition not found.' }, 404)
    }

    const editionCity = normalizeCityKey(edition.city)

    if (!isSupportedCityKey(editionCity)) {
      return json(
        {
          error:
            'Save a supported edition city before finding creator collections.',
        },
        409,
      )
    }

    const url = new URL(request.url)
    const collectionId =
      url.searchParams.get('collection_id')

    // ========================================================
    // PREVIEW ONE ELIGIBLE PUBLIC CREATOR COLLECTION
    // ========================================================

    if (collectionId !== null) {
      if (!validId(collectionId)) {
        return json(
          { error: 'Invalid collection ID.' },
          400,
        )
      }

      const source = await getEligibleCollection(
        collectionId,
        editionCity,
      )

      if (!source) {
        return json(
          {
            error:
              'Public creator collection not found or not eligible for this edition city.',
          },
          404,
        )
      }

      const { data: sourceItems, error: itemsError } =
        await supabaseAdmin
          .from('creator_collection_items')
          .select(
            'id, collection_id, source_type, source_id, custom_title, creator_note, image_url, sort_order, created_at',
          )
          .eq('collection_id', collectionId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(200)

      if (itemsError) throw itemsError

      const items = sourceItems ?? []

      const canonicalItems = items.filter(
        (item) =>
          item.source_type === 'venue' &&
          validId(item.source_id),
      )

      const venueIds = [
        ...new Set(
          canonicalItems.map((item) => item.source_id),
        ),
      ]

      const venueMap = new Map<
        string,
        {
          id: string
          name: string
          city: string | null
          canonical_city: string | null
          cover: string | null
        }
      >()

      if (venueIds.length > 0) {
        const venueResult = await supabaseAdmin
          .from('venues')
          .select(
            'id, name, city, canonical_city, cover',
          )
          .in('id', venueIds)

        if (venueResult.error) throw venueResult.error

        for (const venue of venueResult.data ?? []) {
          venueMap.set(venue.id, venue)
        }
      }

      const previewItems = canonicalItems
        .map((item) => {
          const venue = venueMap.get(item.source_id)

          if (!venue) return null

          if (
            normalizeCityKey(venue.canonical_city) !==
            editionCity
          ) {
            return null
          }

          return {
            source_collection_item_id: item.id,
            venue_id: venue.id,
            venue_name: venue.name,
            venue_city: venue.city,
            display_title:
              item.custom_title || venue.name,
            creator_note: item.creator_note,
            image_url:
              item.image_url ?? venue.cover,
            sort_order: item.sort_order,
          }
        })
        .filter(
          (item): item is NonNullable<typeof item> =>
            item !== null,
        )

      return json({
        collection: {
          ...source.collection,
          creator: source.profile,
        },
        items: previewItems,
        total_source_items: items.length,
        eligible_venue_count: previewItems.length,
        omitted_item_count:
          items.length - previewItems.length,
      })
    }

    // ========================================================
    // DISCOVER PUBLIC CREATOR COLLECTIONS BY TITLE
    // ========================================================

    const query = (
      url.searchParams.get('q') ?? ''
    ).trim()

    if (query.length > 80) {
      return json(
        { error: 'Search must be 80 characters or fewer.' },
        400,
      )
    }

    let collectionsQuery = supabaseAdmin
      .from('creator_collections')
      .select(
        'id, user_id, title, slug, description, city, cover_image_url',
      )
      .eq('visibility', 'public')

    if (query.length > 0) {
      collectionsQuery = collectionsQuery.ilike(
        'title',
        `%${query}%`,
      )
    }

    const { data, error } = await collectionsQuery
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const cityCollections = (
      (data ?? []) as CollectionRow[]
    ).filter(
      (collection) =>
        normalizeCityKey(collection.city) === editionCity,
    )

    const creatorIds = [
      ...new Set(
        cityCollections.map((collection) => collection.user_id),
      ),
    ]

    if (creatorIds.length === 0) {
      return json({
        collections: [],
        city: editionCity,
      })
    }

    const profilesResult = await supabaseAdmin
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, is_public, creator_mode_enabled',
      )
      .in('id', creatorIds)

    if (profilesResult.error) {
      throw profilesResult.error
    }

    const eligibleProfiles = new Map(
      ((profilesResult.data ?? []) as ProfileRow[])
        .filter(
          (profile) =>
            profile.is_public !== false &&
            profile.creator_mode_enabled === true,
        )
        .map((profile) => [profile.id, profile]),
    )

    return json({
      collections: cityCollections
        .filter((collection) =>
          eligibleProfiles.has(collection.user_id),
        )
        .slice(0, 30)
        .map((collection) => ({
          ...collection,
          creator:
            eligibleProfiles.get(collection.user_id),
        })),
      city: editionCity,
    })
  } catch (error) {
    console.error(
      '[editorial/creator-collections] GET failed:',
      error,
    )

    return json(
      { error: 'Could not load creator collections.' },
      500,
    )
  }
}
