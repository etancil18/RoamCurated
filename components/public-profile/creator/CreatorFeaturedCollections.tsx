import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  FolderHeart,
  ImageIcon,
  MapPin,
  Sparkles,
} from 'lucide-react'

import type {
  PublicCreatorCollection,
} from '@/lib/creator/types'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorFeaturedCollectionsProps = {
  /**
   * Public profile username without the leading `@`.
   *
   * Collection links resolve to:
   *
   *   /u/[username]/collections/[slug]
   */
  username: string

  /**
   * Public, featured collection projections returned by the
   * public creator-profile loader.
   *
   * Private collections must never be passed to this component.
   */
  collections:
    readonly PublicCreatorCollection[]

  /**
   * Optional section title.
   */
  title?: string

  /**
   * Optional supporting copy.
   */
  description?: string

  /**
   * Maximum number of featured collections rendered.
   *
   * Defaults to six and is capped at twelve.
   */
  limit?: number

  /**
   * Controls whether the section heading is rendered.
   *
   * Disable this when nesting the grid inside another panel that
   * already provides a heading.
   */
  showHeading?: boolean

  /**
   * Controls whether a link to the creator's full collections
   * index is displayed.
   */
  showViewAll?: boolean

  /**
   * Optional override for the collections-index route.
   *
   * Defaults to:
   *
   *   /u/[username]/collections
   */
  viewAllHref?: string | null

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorFeaturedCollections({
  username,
  collections,
  title = 'Featured collections',
  description =
    'Curated places, routes, and local recommendations that reflect this creator’s point of view.',
  limit = 6,
  showHeading = true,
  showViewAll = true,
  viewAllHref,
  className = '',
}: CreatorFeaturedCollectionsProps) {
  const normalizedUsername =
    normalizeUsername(username)

  if (!normalizedUsername) {
    return null
  }

  const normalizedCollections =
    normalizeFeaturedCollections({
      collections,
      limit,
    })

  if (
    normalizedCollections.length === 0
  ) {
    return null
  }

  const resolvedViewAllHref =
    normalizeInternalHref(viewAllHref) ??
    buildCreatorCollectionsHref(
      normalizedUsername
    )

  const headingId =
    'creator-featured-collections-title'

  return (
    <section
      aria-labelledby={
        showHeading
          ? headingId
          : undefined
      }
      className={[
        'w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/70 p-4 text-white shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showHeading ? (
        <FeaturedCollectionsHeading
          id={headingId}
          title={title}
          description={description}
          collectionCount={
            normalizedCollections.length
          }
          viewAllHref={
            showViewAll
              ? resolvedViewAllHref
              : null
          }
        />
      ) : null}

      <ul
        aria-label="Featured creator collections"
        className={[
          'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2',
          normalizedCollections.length >= 3
            ? 'lg:grid-cols-3'
            : '',
          showHeading ? 'mt-5' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {normalizedCollections.map(
          (collection) => (
            <li
              key={collection.id}
              className="min-w-0"
            >
              <FeaturedCollectionCard
                username={
                  normalizedUsername
                }
                collection={collection}
              />
            </li>
          )
        )}
      </ul>

      {!showHeading &&
      showViewAll &&
      resolvedViewAllHref ? (
        <div className="mt-5">
          <ViewAllCollectionsLink
            href={resolvedViewAllHref}
          />
        </div>
      ) : null}
    </section>
  )
}

/* =========================================================
 * Heading
 * ======================================================= */

function FeaturedCollectionsHeading({
  id,
  title,
  description,
  collectionCount,
  viewAllHref,
}: {
  id: string
  title: string
  description: string
  collectionCount: number
  viewAllHref: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
            <FolderHeart
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">
            Curated by creator
          </p>
        </div>

        <h2
          id={id}
          className="mt-3 break-words text-xl font-semibold tracking-tight text-white"
        >
          {title}
        </h2>

        {description ? (
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span
          aria-label={`${collectionCount} featured ${
            collectionCount === 1
              ? 'collection'
              : 'collections'
          }`}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-xs font-semibold text-neutral-400"
        >
          <Sparkles
            aria-hidden="true"
            className="h-3.5 w-3.5 text-indigo-400"
          />

          {collectionCount.toLocaleString()}
        </span>

        {viewAllHref ? (
          <ViewAllCollectionsLink
            href={viewAllHref}
          />
        ) : null}
      </div>
    </div>
  )
}

function ViewAllCollectionsLink({
  href,
}: {
  href: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      View all

      <ArrowRight
        aria-hidden="true"
        className="h-3.5 w-3.5"
      />
    </Link>
  )
}

/* =========================================================
 * Collection card
 * ======================================================= */

function FeaturedCollectionCard({
  username,
  collection,
}: {
  username: string
  collection:
    NormalizedPublicCreatorCollection
}) {
  const href =
    buildCreatorCollectionHref({
      username,
      slug: collection.slug,
    })

  return (
    <Link
      href={href}
      aria-label={`Open collection: ${collection.title}`}
      className={[
        'group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-black/30 transition',
        'hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-indigo-500/[0.05] hover:shadow-xl hover:shadow-black/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      ].join(' ')}
    >
      <CollectionCover
        collection={collection}
      />

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            {collection.category ? (
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">
                {collection.category}
              </p>
            ) : (
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                Collection
              </p>
            )}

            <h3 className="mt-1 line-clamp-2 break-words text-base font-semibold leading-6 text-white transition group-hover:text-indigo-100">
              {collection.title}
            </h3>
          </div>

          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-neutral-500 transition group-hover:border-indigo-500/30 group-hover:bg-indigo-500/10 group-hover:text-indigo-300">
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>
        </div>

        {collection.description ? (
          <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-neutral-500">
            {collection.description}
          </p>
        ) : null}

        <div className="mt-auto pt-4">
          {collection.city ? (
            <p className="flex min-w-0 items-center gap-2 text-xs text-neutral-500">
              <MapPin
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-indigo-400"
              />

              <span className="truncate">
                {collection.city}
              </span>
            </p>
          ) : (
            <p className="text-xs text-neutral-600">
              Curated on Roam
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

/* =========================================================
 * Collection cover
 * ======================================================= */

function CollectionCover({
  collection,
}: {
  collection:
    NormalizedPublicCreatorCollection
}) {
  return (
    <div className="relative aspect-[4/3] w-full min-w-0 overflow-hidden border-b border-neutral-800 bg-neutral-900">
      {collection.cover_image_url ? (
        <Image
          src={
            collection.cover_image_url
          }
          alt=""
          fill
          unoptimized
          sizes={[
            '(min-width: 1024px) 33vw',
            '(min-width: 640px) 50vw',
            '100vw',
          ].join(', ')}
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <CollectionCoverFallback
          title={collection.title}
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
      />

      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
        <Sparkles
          aria-hidden="true"
          className="h-3 w-3 text-indigo-300"
        />

        Featured
      </span>
    </div>
  )
}

function CollectionCoverFallback({
  title,
}: {
  title: string
}) {
  const initials =
    getCollectionInitials(title)

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/15 via-neutral-900 to-cyan-500/10">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-neutral-400">
          <ImageIcon
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>

        <span
          aria-hidden="true"
          className="mt-3 block text-sm font-semibold tracking-[0.12em] text-neutral-500"
        >
          {initials}
        </span>
      </div>
    </div>
  )
}

/* =========================================================
 * Internal normalized shape
 * ======================================================= */

type NormalizedPublicCreatorCollection = {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  city: string | null
  category: string | null
  featured: true
  sort_order: number
  created_at: string
  updated_at: string
}

/* =========================================================
 * Collection normalization
 * ======================================================= */

function normalizeFeaturedCollections({
  collections,
  limit,
}: {
  collections:
    readonly PublicCreatorCollection[]
  limit: number
}): NormalizedPublicCreatorCollection[] {
  const normalizedLimit =
    normalizeCollectionLimit(limit)

  if (normalizedLimit === 0) {
    return []
  }

  const collectionsById =
    new Map<
      string,
      NormalizedPublicCreatorCollection
    >()

  const collectionIdsBySlug =
    new Map<string, string>()

  for (const collection of collections) {
    const normalizedCollection =
      normalizeFeaturedCollection(
        collection
      )

    if (!normalizedCollection) {
      continue
    }

    const existingIdForSlug =
      collectionIdsBySlug.get(
        normalizedCollection.slug
      )

    if (
      existingIdForSlug !== undefined
    ) {
      const existingCollection =
        collectionsById.get(
          existingIdForSlug
        )

      if (
        existingCollection &&
        compareCollections(
          existingCollection,
          normalizedCollection
        ) <= 0
      ) {
        continue
      }

      collectionsById.delete(
        existingIdForSlug
      )
    }

    const existingById =
      collectionsById.get(
        normalizedCollection.id
      )

    if (
      existingById &&
      compareCollections(
        existingById,
        normalizedCollection
      ) <= 0
    ) {
      continue
    }

    if (existingById) {
      collectionIdsBySlug.delete(
        existingById.slug
      )
    }

    collectionsById.set(
      normalizedCollection.id,
      normalizedCollection
    )

    collectionIdsBySlug.set(
      normalizedCollection.slug,
      normalizedCollection.id
    )
  }

  return [
    ...collectionsById.values(),
  ]
    .sort(compareCollections)
    .slice(0, normalizedLimit)
}

function normalizeFeaturedCollection(
  value: PublicCreatorCollection
): NormalizedPublicCreatorCollection | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  const id =
    normalizeIdentifier(value.id)

  const title =
    normalizeRequiredText(
      value.title,
      160
    )

  const slug =
    normalizeSlug(value.slug)

  if (!id || !title || !slug) {
    return null
  }

  if (value.featured !== true) {
    return null
  }

  const createdAt =
    normalizeIsoDate(
      value.created_at
    )

  const updatedAt =
    normalizeIsoDate(
      value.updated_at
    )

  if (!createdAt || !updatedAt) {
    return null
  }

  return {
    id,
    title,
    slug,

    description:
      normalizeOptionalText(
        value.description,
        1000
      ),

    cover_image_url:
      normalizePublicImageUrl(
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

    featured: true,

    sort_order:
      normalizeSortOrder(
        value.sort_order
      ),

    created_at: createdAt,
    updated_at: updatedAt,
  }
}

/* =========================================================
 * Sorting
 * ======================================================= */

function compareCollections(
  first:
    NormalizedPublicCreatorCollection,
  second:
    NormalizedPublicCreatorCollection
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

  const createdAtComparison =
    compareIsoDatesDescending(
      first.created_at,
      second.created_at
    )

  if (createdAtComparison !== 0) {
    return createdAtComparison
  }

  const titleComparison =
    first.title.localeCompare(
      second.title,
      undefined,
      {
        sensitivity: 'base',
      }
    )

  if (titleComparison !== 0) {
    return titleComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

/* =========================================================
 * Route builders
 * ======================================================= */

function buildCreatorCollectionHref({
  username,
  slug,
}: {
  username: string
  slug: string
}): string {
  return `/u/${encodeURIComponent(
    username
  )}/collections/${encodeURIComponent(
    slug
  )}`
}

function buildCreatorCollectionsHref(
  username: string
): string {
  return `/u/${encodeURIComponent(
    username
  )}/collections`
}

function normalizeInternalHref(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

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

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeUsername(
  value: string
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
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

function normalizeIdentifier(
  value: string
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (
    !normalized ||
    normalized.length > 200
  ) {
    return null
  }

  return normalized
}

function normalizeRequiredText(
  value: string,
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
    normalized.length > maximumLength
  ) {
    return null
  }

  return normalized
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
  maximumLength: number
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    maximumLength
  )
}

function normalizeSlug(
  value: string
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
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

function normalizePublicImageUrl(
  value:
    | string
    | null
    | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    const parsed = new URL(normalized)

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return null
    }

    if (
      parsed.username ||
      parsed.password ||
      !parsed.hostname
    ) {
      return null
    }

    if (
      isLocalOrPrivateHostname(
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

function isLocalOrPrivateHostname(
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
    /^127\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^169\.254\./.test(normalized) ||
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

function normalizeSortOrder(
  value: number
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

function normalizeCollectionLimit(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return 6
  }

  return Math.min(
    12,
    Math.max(0, value)
  )
}

function normalizeIsoDate(
  value: string
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

function compareIsoDatesDescending(
  first: string,
  second: string
): number {
  const firstTime =
    Date.parse(first)

  const secondTime =
    Date.parse(second)

  if (
    Number.isNaN(firstTime) ||
    Number.isNaN(secondTime)
  ) {
    return second.localeCompare(first)
  }

  return secondTime - firstTime
}

function getCollectionInitials(
  title: string
): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'RC'
  }

  if (words.length === 1) {
    return (
      words[0]
        ?.slice(0, 2)
        .toUpperCase() ?? 'RC'
    )
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}