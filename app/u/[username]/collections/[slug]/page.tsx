import type {
  Metadata,
} from 'next'
import Link from 'next/link'
import {
  notFound,
} from 'next/navigation'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  getCityLabel,
} from '@/lib/cities/normalizeCity'

export const dynamic =
  'force-dynamic'

/* =========================================================
 * Page contracts
 * ======================================================= */

type Props = {
  params: Promise<{
    username: string
    slug: string
  }>
}

type ProfileRow = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  is_public: boolean | null
  creator_mode_enabled:
    | boolean
    | null
  creator_headline:
    | string
    | null
}

type CreatorCollectionRow = {
  id: string
  user_id: string
  title: string
  slug: string
  description: string | null
  cover_image_url:
    | string
    | null
  city: string | null
  category: string | null
  visibility:
    | 'public'
    | 'private'
  featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

type CreatorCollectionVenueRow = {
  id: string
  collection_id: string
  venue_id: string
  sort_order: number
  created_at: string
}

type VenueRow = {
  id: string
  name: string
  slug: string | null
  city: string | null
  category: string | null
  description: string | null
  cover_image_url:
    | string
    | null
  created_at: string | null
}

type PublicCollectionItemType =
  | 'venue'
  | 'property'
  | 'flow'
  | 'snapshot'
  | 'custom'

type PublicCollectionItem = {
  id: string
  collection_id: string
  item_type:
    PublicCollectionItemType
  item_id: string | null
  title: string
  subtitle: string | null
  description: string | null
  image_url: string | null
  href: string | null
  city: string | null
  sort_order: number
  created_at: string
  updated_at: string | null
}

type PublicCollectionPageData = {
  profile: ProfileRow
  collection:
    CreatorCollectionRow
  items:
    PublicCollectionItem[]
}

/* =========================================================
 * Metadata
 * ======================================================= */

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const {
    username,
    slug,
  } = await params

  const normalizedUsername =
    normalizeUsername(username)

  const normalizedSlug =
    normalizeSlug(slug)

  if (
    !normalizedUsername ||
    !normalizedSlug
  ) {
    return {
      title:
        'Collection Not Found | Roam',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const data =
    await loadPublicCollection({
      username:
        normalizedUsername,
      slug:
        normalizedSlug,
      includeItems: false,
    })

  if (!data) {
    return {
      title:
        'Collection Not Found | Roam',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const creatorName =
    data.profile.full_name ??
    data.profile.username ??
    'Roam Creator'

  const description =
    data.collection.description ??
    `Explore ${data.collection.title}, a public collection curated by ${creatorName}.`

  return {
    title: `${data.collection.title} | ${creatorName} | Roam`,

    description:
      description.slice(0, 160),

    alternates: {
      canonical:
        `/u/${encodeURIComponent(
          normalizedUsername
        )}/collections/${encodeURIComponent(
          normalizedSlug
        )}`,
    },

    openGraph: {
      title:
        data.collection.title,

      description:
        description.slice(0, 200),

      type: 'article',

      images:
        data.collection
          .cover_image_url
          ? [
              {
                url:
                  data.collection
                    .cover_image_url,
                alt:
                  data.collection
                    .title,
              },
            ]
          : undefined,
    },

    twitter: {
      card:
        data.collection
          .cover_image_url
          ? 'summary_large_image'
          : 'summary',

      title:
        data.collection.title,

      description:
        description.slice(0, 200),

      images:
        data.collection
          .cover_image_url
          ? [
              data.collection
                .cover_image_url,
            ]
          : undefined,
    },
  }
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function PublicCreatorCollectionPage({
  params,
}: Props) {
  const {
    username,
    slug,
  } = await params

  const normalizedUsername =
    normalizeUsername(username)

  const normalizedSlug =
    normalizeSlug(slug)

  if (
    !normalizedUsername ||
    !normalizedSlug
  ) {
    notFound()
  }

  const data =
    await loadPublicCollection({
      username:
        normalizedUsername,
      slug:
        normalizedSlug,
      includeItems: true,
    })

  if (!data) {
    notFound()
  }

  const {
    profile,
    collection,
    items,
  } = data

  const creatorName =
    profile.full_name ??
    profile.username ??
    'Roam Creator'

  const profileHref =
    `/u/${encodeURIComponent(
      normalizedUsername
    )}`

  const collectionsHref =
    `${profileHref}/collections`

  const collectionDescription =
    collection.description ??
    `A public collection curated by ${creatorName}.`

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <CollectionNavigation
          profileHref={
            profileHref
          }
          collectionsHref={
            collectionsHref
          }
          creatorName={
            creatorName
          }
        />

        <CollectionHero
          profile={profile}
          collection={
            collection
          }
          creatorName={
            creatorName
          }
          profileHref={
            profileHref
          }
          description={
            collectionDescription
          }
        />

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <PublicCollectionItems
            items={items}
            collectionTitle={
              collection.title
            }
          />

          <CollectionSidebar
            profile={profile}
            collection={
              collection
            }
            creatorName={
              creatorName
            }
            profileHref={
              profileHref
            }
            itemCount={
              items.length
            }
          />
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Navigation
 * ======================================================= */

function CollectionNavigation({
  profileHref,
  collectionsHref,
  creatorName,
}: {
  profileHref: string
  collectionsHref: string
  creatorName: string
}) {
  return (
    <nav
      aria-label="Collection navigation"
      className="flex min-w-0 flex-wrap gap-2"
    >
      <Link
        href={profileHref}
        className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-cyan-400/40 hover:text-white"
      >
        ← {creatorName}
      </Link>

      <Link
        href={collectionsHref}
        className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-indigo-400/40 hover:text-white"
      >
        All Collections
      </Link>
    </nav>
  )
}

/* =========================================================
 * Hero
 * ======================================================= */

function CollectionHero({
  profile,
  collection,
  creatorName,
  profileHref,
  description,
}: {
  profile: ProfileRow
  collection:
    CreatorCollectionRow
  creatorName: string
  profileHref: string
  description: string
}) {
  return (
    <section className="relative mt-6 min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950">
      <div className="relative min-h-[280px] overflow-hidden sm:min-h-[360px]">
        {collection.cover_image_url ? (
          <img
            src={
              collection.cover_image_url
            }
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.35),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.24),transparent_42%),#09090b]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />

        <div className="relative flex min-h-[280px] flex-col justify-end p-5 sm:min-h-[360px] sm:p-8">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {collection.featured ? (
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-100 backdrop-blur-md">
                Featured Collection
              </span>
            ) : null}

            {collection.category ? (
              <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-200 backdrop-blur-md">
                {collection.category}
              </span>
            ) : null}

            {collection.city ? (
              <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-200 backdrop-blur-md">
                {getCityLabel(
                collection.city
                ) ?? collection.city}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 max-w-3xl break-words text-3xl font-bold tracking-tight text-white sm:text-5xl">
            {collection.title}
          </h1>

          <p className="mt-4 max-w-3xl break-words text-sm leading-6 text-neutral-200 sm:text-base sm:leading-7">
            {description}
          </p>

          <Link
            href={profileHref}
            className="mt-5 inline-flex w-fit min-w-0 items-center gap-3 rounded-full border border-white/15 bg-black/45 py-2 pl-2 pr-4 backdrop-blur-md transition hover:border-cyan-400/40 hover:bg-black/65"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-900 text-sm">
              {profile.avatar_url ? (
                <img
                  src={
                    profile.avatar_url
                  }
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-hidden="true">
                  🧭
                </span>
              )}
            </span>

            <span className="min-w-0">
              <span className="block truncate text-xs text-neutral-400">
                Curated by
              </span>

              <span className="block truncate text-sm font-semibold text-white">
                {creatorName}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Public items
 * ======================================================= */

function PublicCollectionItems({
  items,
  collectionTitle,
}: {
  items:
    PublicCollectionItem[]
  collectionTitle: string
}) {
  return (
    <section
      aria-labelledby="public-collection-items-title"
      className="min-w-0"
    >
      <div className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
            Collection contents
          </p>

          <h2
            id="public-collection-items-title"
            className="mt-1 text-xl font-semibold text-white sm:text-2xl"
          >
            Places and recommendations
          </h2>
        </div>

        <p className="shrink-0 text-xs text-neutral-600">
          {items.length.toLocaleString()}{' '}
          {items.length === 1
            ? 'item'
            : 'items'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-[1.75rem] border border-dashed border-neutral-800 bg-neutral-950/60 px-5 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-2xl">
            🗺️
          </span>

          <h3 className="mt-4 text-lg font-semibold text-white">
            Collection coming together
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
            {collectionTitle} does not
            contain any public items yet.
          </p>
        </div>
      ) : (
        <ol className="mt-4 space-y-4">
          {items.map(
            (
              item,
              index
            ) => (
              <li
                key={item.id}
                className="min-w-0"
              >
                <PublicCollectionItemCard
                  item={item}
                  position={
                    index + 1
                  }
                />
              </li>
            )
          )}
        </ol>
      )}
    </section>
  )
}

function PublicCollectionItemCard({
  item,
  position,
}: {
  item:
    PublicCollectionItem
  position: number
}) {
  const internalHref =
    normalizeInternalHref(
      item.href
    )

  const externalHref =
    internalHref
      ? null
      : normalizeExternalHref(
          item.href
        )

  const card = (
    <article className="group relative min-w-0 overflow-hidden rounded-[1.5rem] border border-neutral-800/90 bg-neutral-950/80 transition hover:border-neutral-700">
      <div className="grid min-w-0 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative min-h-44 overflow-hidden border-b border-neutral-800 bg-neutral-900 sm:min-h-full sm:border-b-0 sm:border-r">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_42%),#09090b]">
              <span className="text-3xl">
                {getItemTypeEmoji(
                  item.item_type
                )}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

          <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-md">
            {getItemTypeLabel(
              item.item_type
            )}
          </span>

          <span className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/65 text-xs font-semibold text-white backdrop-blur-md">
            {position}
          </span>
        </div>

        <div className="flex min-w-0 flex-col justify-center p-4 sm:p-5">
          <h3 className="break-words text-lg font-semibold text-white">
            {item.title}
          </h3>

          {item.subtitle ? (
            <p className="mt-1 break-words text-xs font-medium text-neutral-400">
              {item.subtitle}
            </p>
          ) : null}

          {item.description ? (
            <p className="mt-3 line-clamp-4 break-words text-sm leading-6 text-neutral-500">
              {item.description}
            </p>
          ) : null}

          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
            {item.city ? (
              <span className="inline-flex max-w-full items-center rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-[11px] text-neutral-400">
                <span className="truncate">
                  {item.city}
                </span>
              </span>
            ) : null}

            {internalHref ||
            externalHref ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">
                Explore
                <span aria-hidden="true">
                  →
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )

  if (internalHref) {
    return (
      <Link
        href={internalHref}
        className="block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        {card}
      </Link>
    )
  }

  if (externalHref) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        {card}
      </a>
    )
  }

  return card
}

/* =========================================================
 * Sidebar
 * ======================================================= */

function CollectionSidebar({
  profile,
  collection,
  creatorName,
  profileHref,
  itemCount,
}: {
  profile: ProfileRow
  collection:
    CreatorCollectionRow
  creatorName: string
  profileHref: string
  itemCount: number
}) {
  return (
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
      <section className="rounded-[1.5rem] border border-neutral-800 bg-neutral-950/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Collection details
        </p>

        <dl className="mt-4 space-y-4">
          <CollectionDetail
            label="Items"
            value={
              itemCount.toLocaleString()
            }
          />

          {collection.city ? (
            <CollectionDetail
              label="City"
              value={
                collection.city
              }
            />
          ) : null}

          {collection.category ? (
            <CollectionDetail
              label="Category"
              value={
                collection.category
              }
            />
          ) : null}

          <CollectionDetail
            label="Updated"
            value={formatDate(
              collection.updated_at
            )}
          />
        </dl>
      </section>

      <section className="rounded-[1.5rem] border border-indigo-500/20 bg-indigo-500/[0.05] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
          About the curator
        </p>

        <div className="mt-4 flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
            {profile.avatar_url ? (
              <img
                src={
                  profile.avatar_url
                }
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true">
                🧭
              </span>
            )}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {creatorName}
            </p>

            {profile.username ? (
              <p className="mt-0.5 truncate text-xs text-neutral-500">
                @{profile.username}
              </p>
            ) : null}
          </div>
        </div>

        {profile.creator_headline ? (
          <p className="mt-4 break-words text-sm leading-6 text-neutral-400">
            {
              profile.creator_headline
            }
          </p>
        ) : profile.bio ? (
          <p className="mt-4 line-clamp-4 break-words text-sm leading-6 text-neutral-400">
            {profile.bio}
          </p>
        ) : null}

        <Link
          href={profileHref}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white"
        >
          View Creator Profile
        </Link>
      </section>
    </aside>
  )
}

function CollectionDetail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        {label}
      </dt>

      <dd className="mt-1 break-words text-sm font-medium text-neutral-200">
        {value}
      </dd>
    </div>
  )
}

/* =========================================================
 * Loader
 * ======================================================= */

async function loadPublicCollection({
  username,
  slug,
  includeItems,
}: {
  username: string
  slug: string
  includeItems: boolean
}): Promise<PublicCollectionPageData | null> {
  const supabase =
    await createServerClient()

  const profileResult =
    await supabase
      .from('profiles')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        bio,
        is_public,
        creator_mode_enabled,
        creator_headline
      `)
      .ilike(
        'username',
        username
      )
      .maybeSingle<ProfileRow>()

  if (profileResult.error) {
    console.error(
      '[public creator collection] Profile query failed:',
      profileResult.error
    )

    return null
  }

  const profile =
    normalizeProfileRow(
      profileResult.data
    )

  if (
    !profile ||
    profile.is_public === false ||
    profile.creator_mode_enabled !==
      true
  ) {
    return null
  }

  const collectionResult =
    await supabase
      .from(
        'creator_collections'
      )
      .select(`
        id,
        user_id,
        title,
        slug,
        description,
        cover_image_url,
        city,
        category,
        visibility,
        featured,
        sort_order,
        created_at,
        updated_at
      `)
      .eq(
        'user_id',
        profile.id
      )
      .eq(
        'slug',
        slug
      )
      .eq(
        'visibility',
        'public'
      )
      .maybeSingle<CreatorCollectionRow>()

  if (collectionResult.error) {
    console.error(
      '[public creator collection] Collection query failed:',
      collectionResult.error
    )

    return null
  }

  const collection =
    normalizeCollectionRow({
      value:
        collectionResult.data,
      expectedUserId:
        profile.id,
      expectedSlug:
        slug,
    })

  if (!collection) {
    return null
  }

  if (!includeItems) {
    return {
      profile,
      collection,
      items: [],
    }
  }

  const collectionVenuesResult =
    await supabase
      .from(
        'creator_collection_venues'
      )
      .select(`
        id,
        collection_id,
        venue_id,
        sort_order,
        created_at
      `)
      .eq(
        'collection_id',
        collection.id
      )
      .order(
        'sort_order',
        {
          ascending: true,
        }
      )
      .order(
        'created_at',
        {
          ascending: true,
        }
      )

  if (
    collectionVenuesResult.error
  ) {
    console.error(
      '[public creator collection] Collection-venue query failed:',
      collectionVenuesResult.error
    )

    return {
      profile,
      collection,
      items: [],
    }
  }

  const collectionVenues =
    normalizeCollectionVenueRows({
      value:
        collectionVenuesResult.data,
      collectionId:
        collection.id,
    })

  if (
    collectionVenues.length === 0
  ) {
    return {
      profile,
      collection,
      items: [],
    }
  }

  const venueIds = [
    ...new Set(
      collectionVenues.map(
        (relationship) =>
          relationship.venue_id
      )
    ),
  ]

  const venuesResult =
    await supabase
      .from('venues')
      .select(`
        id,
        name,
        slug,
        city,
        category:tier,
        description,
        cover_image_url:cover
      `)
      .in(
        'id',
        venueIds
      )

  if (venuesResult.error) {
    const {
      code,
      message,
      details,
      hint,
    } = venuesResult.error

    console.error(
      [
        '[public creator collection] Venue query failed',
        `collectionId: ${collection.id}`,
        `code: ${code ?? 'unknown'}`,
        `message: ${message ?? 'unknown'}`,
        `details: ${details ?? 'none'}`,
        `hint: ${hint ?? 'none'}`,
      ].join('\n')
    )

    return {
      profile,
      collection,
      items: [],
    }
  }

  const venues =
    normalizeVenueRows(
      venuesResult.data
    )

  return {
    profile,
    collection,

    items:
      buildPublicVenueItems({
        collection,
        relationships:
          collectionVenues,
        venues,
      }),
  }
}

/* =========================================================
 * Row normalization
 * ======================================================= */

function normalizeProfileRow(
  value: unknown
): ProfileRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeIdentifier(
      value.id
    )

  const username =
    normalizeUsername(
      value.username
    )

  if (!id || !username) {
    return null
  }

  return {
    id,
    username,

    full_name:
      normalizeOptionalText(
        value.full_name,
        200
      ),

    avatar_url:
      normalizePublicUrl(
        value.avatar_url
      ),

    bio:
      normalizeOptionalText(
        value.bio,
        2_000
      ),

    is_public:
      value.is_public !== false,

    creator_mode_enabled:
      value.creator_mode_enabled ===
      true,

    creator_headline:
      normalizeOptionalText(
        value.creator_headline,
        240
      ),
  }
}

function normalizeCollectionRow({
  value,
  expectedUserId,
  expectedSlug,
}: {
  value: unknown
  expectedUserId: string
  expectedSlug: string
}): CreatorCollectionRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeIdentifier(
      value.id
    )

  const userId =
    normalizeIdentifier(
      value.user_id
    )

  const title =
    normalizeRequiredText(
      value.title,
      160
    )

  const slug =
    normalizeSlug(
      value.slug
    )

  const createdAt =
    normalizeIsoDate(
      value.created_at
    )

  const updatedAt =
    normalizeIsoDate(
      value.updated_at
    )

  if (
    !id ||
    userId !== expectedUserId ||
    !title ||
    slug !== expectedSlug ||
    value.visibility !==
      'public' ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  return {
    id,
    user_id: userId,
    title,
    slug,

    description:
      normalizeOptionalText(
        value.description,
        1_000
      ),

    cover_image_url:
      normalizePublicUrl(
        value.cover_image_url
      ),

    city:
      normalizeOptionalText(
        value.city,
        160
      ),

    category:
      normalizeOptionalText(
        value.category,
        120
      ),

    visibility: 'public',

    featured:
      value.featured === true,

    sort_order:
      normalizeSortOrder(
        value.sort_order
      ),

    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function normalizeCollectionVenueRows({
  value,
  collectionId,
}: {
  value: unknown
  collectionId: string
}): CreatorCollectionVenueRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows =
    value
      .map(
        (
          row
        ): CreatorCollectionVenueRow | null => {
          if (!isRecord(row)) {
            return null
          }

          const id =
            normalizeIdentifier(
              row.id
            )

          const rowCollectionId =
            normalizeIdentifier(
              row.collection_id
            )

          const venueId =
            normalizeIdentifier(
              row.venue_id
            )

          const createdAt =
            normalizeIsoDate(
              row.created_at
            )

          if (
            !id ||
            rowCollectionId !==
              collectionId ||
            !venueId ||
            !createdAt
          ) {
            return null
          }

          return {
            id,

            collection_id:
              rowCollectionId,

            venue_id:
              venueId,

            sort_order:
              normalizeSortOrder(
                row.sort_order
              ),

            created_at:
              createdAt,
          }
        }
      )
      .filter(
        (
          row
        ): row is CreatorCollectionVenueRow =>
          row !== null
      )

  const byId =
    new Map<
      string,
      CreatorCollectionVenueRow
    >()

  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row)
    }
  }

  return [
    ...byId.values(),
  ].sort(
    compareCollectionVenueRows
  )
}

function normalizeVenueRows(
  value: unknown
): VenueRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const byId =
    new Map<
      string,
      VenueRow
    >()

  for (const row of value) {
    if (!isRecord(row)) {
      continue
    }

    const id =
      normalizeIdentifier(
        row.id
      )

    const name =
      normalizeRequiredText(
        row.name,
        240
      )

    if (!id || !name) {
      continue
    }

    byId.set(id, {
      id,
      name,

      slug:
        normalizeOptionalText(
          row.slug,
          200
        ),

      city:
        normalizeOptionalText(
          row.city,
          160
        ),

      category:
        normalizeOptionalText(
          row.category,
          160
        ),

      description:
        normalizeOptionalText(
          row.description,
          1_000
        ),

      cover_image_url:
        normalizePublicUrl(
          row.cover_image_url
        ),

      created_at:
        normalizeIsoDate(
          row.created_at
        ),
    })
  }

  return [
    ...byId.values(),
  ]
}

function buildPublicVenueItems({
  collection,
  relationships,
  venues,
}: {
  collection:
    CreatorCollectionRow
  relationships:
    CreatorCollectionVenueRow[]
  venues: VenueRow[]
}): PublicCollectionItem[] {
  const venueById =
    new Map(
      venues.map(
        (venue) => [
          venue.id,
          venue,
        ]
      )
    )

  return relationships
    .map(
      (
        relationship
      ): PublicCollectionItem | null => {
        const venue =
          venueById.get(
            relationship.venue_id
          )

        if (!venue) {
          return null
        }

        return {
          id:
            relationship.id,

          collection_id:
            collection.id,

          item_type:
            'venue',

          item_id:
            venue.id,

          title:
            venue.name,

          subtitle:
            venue.category,

          description:
            venue.description,

          image_url:
            venue.cover_image_url,

          href:
            buildVenueProfileHref(
              venue
            ),

          city:
            venue.city,

          sort_order:
            relationship.sort_order,

          created_at:
            relationship.created_at,

          updated_at:
            null,
        }
      }
    )
    .filter(
      (
        item
      ): item is PublicCollectionItem =>
        item !== null
    )
    .sort(compareCollectionItems)
}

function compareCollectionVenueRows(
  first:
    CreatorCollectionVenueRow,
  second:
    CreatorCollectionVenueRow
): number {
  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  const createdComparison =
    Date.parse(
      first.created_at
    ) -
    Date.parse(
      second.created_at
    )

  if (
    createdComparison !== 0
  ) {
    return createdComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

function compareCollectionItems(
  first:
    PublicCollectionItem,
  second:
    PublicCollectionItem
): number {
  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  const createdComparison =
    Date.parse(
      first.created_at
    ) -
    Date.parse(
      second.created_at
    )

  if (
    createdComparison !== 0
  ) {
    return createdComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

/* =========================================================
 * Venue presentation
 * ======================================================= */

function buildVenueProfileHref(
  venue: VenueRow
): string {
  return `/venue-profile/${encodeURIComponent(
    venue.id
  )}`
}

/* =========================================================
 * Item presentation
 * ======================================================= */

function getItemTypeLabel(
  itemType:
    PublicCollectionItemType
): string {
  switch (itemType) {
    case 'venue':
      return 'Venue'

    case 'property':
      return 'Property'

    case 'flow':
      return 'Flow'

    case 'snapshot':
      return 'Snapshot'

    case 'custom':
      return 'Recommendation'
  }
}

function getItemTypeEmoji(
  itemType:
    PublicCollectionItemType
): string {
  switch (itemType) {
    case 'venue':
      return '📍'

    case 'property':
      return '🏙️'

    case 'flow':
      return '🗺️'

    case 'snapshot':
      return '📸'

    case 'custom':
      return '✨'
  }
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeUsername(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let decoded: string

  try {
    decoded =
      decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized = decoded
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')

  if (
    !normalized ||
    normalized.length > 100 ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function normalizeSlug(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let decoded: string

  try {
    decoded =
      decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized = decoded
    .trim()
    .toLowerCase()

  if (
    !normalized ||
    normalized.length > 160 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeIdentifier(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.length > 200 ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function normalizeRequiredText(
  value: unknown,
  maximumLength: number
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  if (
    !normalized ||
    normalized.length >
      maximumLength
  ) {
    return null
  }

  return normalized
}

function normalizeOptionalText(
  value: unknown,
  maximumLength: number
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized
    ? normalized.slice(
        0,
        maximumLength
      )
    : null
}

function normalizeSortOrder(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return Number.MAX_SAFE_INTEGER
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function normalizeIsoDate(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const timestamp =
    Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}

function normalizePublicUrl(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  try {
    const parsed =
      new URL(normalized)

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return null
    }

    if (
      parsed.username ||
      parsed.password ||
      !parsed.hostname ||
      isPrivateOrLocalHostname(
        parsed.hostname
      )
    ) {
      return null
    }

    parsed.hash = ''

    return parsed.toString()
  } catch {
    return null
  }
}

function normalizeInternalHref(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function normalizeExternalHref(
  value: unknown
): string | null {
  return normalizePublicUrl(value)
}

function isPrivateOrLocalHostname(
  hostname: string
): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')

  if (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith(
      '.localhost'
    ) ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  if (
    /^10\./.test(normalized) ||
    /^127\./.test(normalized) ||
    /^169\.254\./.test(
      normalized
    ) ||
    /^192\.168\./.test(
      normalized
    ) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      normalized
    )
  ) {
    return true
  }

  if (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  ) {
    return true
  }

  return false
}

function formatDate(
  value: string
): string {
  const timestamp =
    Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(
    'en',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  ).format(
    new Date(timestamp)
  )
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}