import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  redirect,
} from 'next/navigation'

import {
  createCreatorCollectionAction,
  deleteCreatorCollectionAction,
  reorderCreatorCollectionsAction,
  setCreatorCollectionFeaturedAction,
  setCreatorCollectionVisibilityAction,
  updateCreatorCollectionAction,
} from './actions'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  normalizeCityKey,
  SUPPORTED_CITIES,
} from '@/lib/cities/normalizeCity'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Creator Collections | Roam',
  description:
    'Create, organize, and publish collections for your Roam creator profile.',
  robots: {
    index: false,
    follow: false,
  },
}

/* =========================================================
 * Page contracts
 * ======================================================= */

type Props = {
  searchParams?: Promise<{
    status?: string
    message?: string
  }>
}

type ProfileRow = {
  id: string
  username: string | null
  creator_mode_enabled: boolean | null
}

type CreatorCollectionRow = {
  id: string
  user_id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  city: string | null
  category: string | null
  visibility: 'public' | 'private'
  featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

type CollectionVenueCountMap =
  Record<string, number>

type CollectionsPageData = {
  userId: string
  profile: ProfileRow
  collections: CreatorCollectionRow[]
  venueCountsByCollectionId:
    CollectionVenueCountMap
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function CreatorCollectionsPage({
  searchParams,
}: Props) {
  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : undefined

  const pageData =
    await loadCreatorCollectionsPage()

  if (!pageData) {
    redirect(
      `/login?next=${encodeURIComponent(
        '/profile/creator/collections'
      )}`
    )
  }

  const {
    profile,
    collections,
    venueCountsByCollectionId,
  } = pageData

  const publicCollectionCount =
    collections.filter(
      (collection) =>
        collection.visibility === 'public'
    ).length

  const featuredCollectionCount =
    collections.filter(
      (collection) =>
        collection.visibility === 'public' &&
        collection.featured
    ).length

  const publicProfileHref =
    profile.username
      ? `/u/${encodeURIComponent(
          profile.username
        )}`
      : null

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <CollectionsHeader
          username={profile.username}
          publicProfileHref={
            publicProfileHref
          }
        />

        <div className="mt-6 space-y-5">
          <ActionFeedback
            status={
              resolvedSearchParams?.status
            }
            message={
              resolvedSearchParams?.message
            }
          />

          <CollectionsOverview
            totalCount={
              collections.length
            }
            publicCount={
              publicCollectionCount
            }
            featuredCount={
              featuredCollectionCount
            }
            creatorModeEnabled={
              profile.creator_mode_enabled ===
              true
            }
          />

          <CreateCollectionPanel
            nextSortOrder={
              getNextSortOrder(
                collections
              )
            }
          />

          <CollectionsList
            collections={collections}
            username={profile.username}
            venueCountsByCollectionId={
              venueCountsByCollectionId
            }
          />
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Header
 * ======================================================= */

function CollectionsHeader({
  username,
  publicProfileHref,
}: {
  username: string | null
  publicProfileHref: string | null
}) {
  return (
    <header className="w-full min-w-0">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-400">
            Creator Mode
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Creator collections
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            Curate public and private
            collections that demonstrate
            your local point of view.
          </p>

          {!username ? (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200/80">
              Add a username before your
              public collection routes can
              be shared.
            </p>
          ) : null}
        </div>

        <nav
          aria-label="Creator collection navigation"
          className="flex shrink-0 flex-wrap gap-2"
        >
          <Link
            href="/profile/creator"
            className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
          >
            ← Creator Settings
          </Link>

          {publicProfileHref ? (
            <Link
              href={publicProfileHref}
              className="inline-flex items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white"
            >
              View Public Profile →
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  )
}

/* =========================================================
 * Action feedback
 * ======================================================= */

function ActionFeedback({
  status,
  message,
}: {
  status?: string
  message?: string
}) {
  const normalizedMessage =
    normalizeNullableText(message)

  if (
    status !== 'success' &&
    status !== 'error'
  ) {
    return null
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
      >
        <p className="text-sm font-semibold text-emerald-200">
          Collection settings updated
        </p>

        <p className="mt-1 text-xs leading-5 text-emerald-300/80">
          {normalizedMessage ??
            'Your creator collections were saved successfully.'}
        </p>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-red-200">
        Collection update failed
      </p>

      <p className="mt-1 text-xs leading-5 text-red-300/80">
        {normalizedMessage ??
          'The requested collection change could not be completed.'}
      </p>
    </div>
  )
}

/* =========================================================
 * Overview
 * ======================================================= */

function CollectionsOverview({
  totalCount,
  publicCount,
  featuredCount,
  creatorModeEnabled,
}: {
  totalCount: number
  publicCount: number
  featuredCount: number
  creatorModeEnabled: boolean
}) {
  return (
    <section
      aria-label="Creator collection overview"
      className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-gradient-to-br from-neutral-950 to-black p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div
            className={[
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
              creatorModeEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-neutral-700 bg-neutral-900 text-neutral-500',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'h-2 w-2 rounded-full',
                creatorModeEnabled
                  ? 'bg-emerald-400'
                  : 'bg-neutral-600',
              ].join(' ')}
            />

            {creatorModeEnabled
              ? 'Creator Mode active'
              : 'Creator Mode inactive'}
          </div>

          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
            Private collections remain
            visible only to you. Public
            collections can appear on your
            creator profile, while featured
            collections receive priority.
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-2">
          <OverviewMetric
            label="Total"
            value={totalCount}
          />

          <OverviewMetric
            label="Public"
            value={publicCount}
          />

          <OverviewMetric
            label="Featured"
            value={featuredCount}
          />
        </dl>
      </div>

      {!creatorModeEnabled ? (
        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200/80">
          You can prepare collections now,
          but they will not appear publicly
          until Creator Mode is enabled.
        </p>
      ) : null}
    </section>
  )
}

function OverviewMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="min-w-[76px] rounded-2xl border border-neutral-800 bg-black/30 px-3 py-3 text-center">
      <dd className="text-lg font-semibold text-white">
        {value.toLocaleString()}
      </dd>

      <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        {label}
      </dt>
    </div>
  )
}

/* =========================================================
 * Create collection
 * ======================================================= */

function CreateCollectionPanel({
  nextSortOrder,
}: {
  nextSortOrder: number
}) {
  return (
    <details className="group w-full min-w-0 rounded-[1.75rem] border border-indigo-500/25 bg-indigo-500/[0.05]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
            New collection
          </p>

          <h2 className="mt-1 text-base font-semibold text-white">
            Create a creator collection
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Add a curated collection and
            decide whether it should be
            private, public, or featured.
          </p>
        </div>

        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xl text-indigo-300 transition group-open:rotate-45"
        >
          +
        </span>
      </summary>

      <div className="border-t border-indigo-500/15 p-4 sm:p-5">
        <form
          action={createCollectionFormAction}
          className="space-y-4"
        >
          <input
            type="hidden"
            name="sort_order"
            value={nextSortOrder}
          />

          <CollectionFields />

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-indigo-300"
            >
              Create Collection
            </button>
          </div>
        </form>
      </div>
    </details>
  )
}

/* =========================================================
 * Collections list
 * ======================================================= */

function CollectionsList({
  collections,
  username,
  venueCountsByCollectionId,
}: {
  collections: CreatorCollectionRow[]
  username: string | null
  venueCountsByCollectionId:
    CollectionVenueCountMap
}) {
  if (collections.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-neutral-800 bg-neutral-950/50 px-5 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-2xl">
          📚
        </div>

        <h2 className="mt-4 text-lg font-semibold text-white">
          No creator collections yet
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
          Create your first collection to
          organize venues around a clear
          local theme.
        </p>
      </section>
    )
  }

  const orderedIds =
    collections.map(
      (collection) =>
        collection.id
    )

  return (
    <section
      aria-labelledby="creator-collections-list-title"
      className="w-full min-w-0"
    >
      <div className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Library
          </p>

          <h2
            id="creator-collections-list-title"
            className="mt-1 text-xl font-semibold text-white"
          >
            Your collections
          </h2>
        </div>

        <p className="shrink-0 text-xs text-neutral-600">
          {collections.length.toLocaleString()}{' '}
          {collections.length === 1
            ? 'collection'
            : 'collections'}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {collections.map(
          (
            collection,
            index
          ) => (
            <CollectionEditorCard
              key={collection.id}
              collection={collection}
              username={username}
              index={index}
              totalCount={
                collections.length
              }
              orderedIds={
                orderedIds
              }
              venueCount={
                venueCountsByCollectionId[
                  collection.id
                ] ?? 0
              }
            />
          )
        )}
      </div>
    </section>
  )
}

/* =========================================================
 * Collection card
 * ======================================================= */

function CollectionVisibilityBadge({
  visibility,
}: {
  visibility:
    | 'public'
    | 'private'
}) {
  const isPublic =
    visibility === 'public'

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
        isPublic
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-400',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'h-1.5 w-1.5 rounded-full',
          isPublic
            ? 'bg-emerald-400'
            : 'bg-neutral-600',
        ].join(' ')}
      />

      {isPublic
        ? 'Public'
        : 'Private'}
    </span>
  )
}

function CollectionEditorCard({
  collection,
  username,
  index,
  totalCount,
  orderedIds,
  venueCount,
}: {
  collection: CreatorCollectionRow
  username: string | null
  index: number
  totalCount: number
  orderedIds: string[]
  venueCount: number
}) {
  const publicHref =
    username &&
    collection.visibility === 'public'
      ? `/u/${encodeURIComponent(
          username
        )}/collections/${encodeURIComponent(
          collection.slug
        )}`
      : null

  const manageVenuesHref =
    `/profile/creator/collections/${encodeURIComponent(
      collection.id
    )}`

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/75">
      <div className="flex min-w-0 flex-col gap-4 border-b border-neutral-800/80 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CollectionVisibilityBadge
              visibility={
                collection.visibility
              }
            />

            {collection.featured ? (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300">
                Featured
              </span>
            ) : null}

            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
              {venueCount.toLocaleString()}{' '}
              {venueCount === 1
                ? 'Venue'
                : 'Venues'}
            </span>

            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-700">
              Position {index + 1}
            </span>
          </div>

          <h3 className="mt-3 break-words text-lg font-semibold text-white">
            {collection.title}
          </h3>

          <p className="mt-1 break-all text-xs text-neutral-600">
            /{collection.slug}
          </p>

          {collection.city ? (
            <p className="mt-2 text-xs text-neutral-500">
              Venue city:{' '}
              <span className="font-medium text-neutral-300">
                {collection.city}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-amber-300/80">
              Add and save a city before
              selecting venues.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <CollectionMoveForm
            collectionId={
              collection.id
            }
            orderedIds={orderedIds}
            direction="up"
            disabled={index === 0}
          />

          <CollectionMoveForm
            collectionId={
              collection.id
            }
            orderedIds={orderedIds}
            direction="down"
            disabled={
              index ===
              totalCount - 1
            }
          />

          <Link
            href={manageVenuesHref}
            className="inline-flex items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/[0.06] px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white"
          >
            Manage venues →
          </Link>

          {publicHref ? (
            <Link
              href={publicHref}
              className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-indigo-400/50 hover:text-white"
            >
              Preview →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <form
          action={updateCollectionFormAction}
          className="min-w-0 space-y-4"
        >
          <input
            type="hidden"
            name="collectionId"
            value={collection.id}
          />

          <input
            type="hidden"
            name="sort_order"
            value={
              collection.sort_order
            }
          />

          <CollectionFields
            collection={collection}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-300"
            >
              Save Changes
            </button>

            <Link
              href={manageVenuesHref}
              className="inline-flex items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/[0.05] px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white"
            >
              {venueCount > 0
                ? `Manage ${venueCount.toLocaleString()} ${
                    venueCount === 1
                      ? 'venue'
                      : 'venues'
                  }`
                : 'Add venues'}
            </Link>
          </div>
        </form>

        <aside className="min-w-0 space-y-3">
          <VisibilityControl
            collection={collection}
          />

          <FeaturedControl
            collection={collection}
          />

          <DeleteCollectionControl
            collection={collection}
          />
        </aside>
      </div>
    </article>
  )
}

/* =========================================================
 * Shared collection fields
 * ======================================================= */

function CollectionFields({
  collection,
}: {
  collection?: CreatorCollectionRow
}) {
  return (
    <>
      <FormField
        id={
          collection
            ? `${collection.id}-title`
            : 'new-collection-title'
        }
        label="Title"
        name="title"
        required
      >
        <input
          id={
            collection
              ? `${collection.id}-title`
              : 'new-collection-title'
          }
          name="title"
          type="text"
          required
          maxLength={160}
          defaultValue={
            collection?.title ?? ''
          }
          placeholder="Chicago Date Night"
          className={inputClassName}
        />
      </FormField>

      <FormField
        id={
          collection
            ? `${collection.id}-description`
            : 'new-collection-description'
        }
        label="Description"
        name="description"
      >
        <textarea
          id={
            collection
              ? `${collection.id}-description`
              : 'new-collection-description'
          }
          name="description"
          rows={4}
          maxLength={1000}
          defaultValue={
            collection?.description ??
            ''
          }
          placeholder="A concise explanation of what this collection contains."
          className={`${inputClassName} resize-y leading-6`}
        />
      </FormField>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField
          id={
            collection
              ? `${collection.id}-city`
              : 'new-collection-city'
          }
          label="City"
          name="city"
        >
          <select
            id={
                collection
                ? `${collection.id}-city`
                : 'new-collection-city'
            }
            name="city"
            defaultValue={
                normalizeCityKey(
                collection?.city
                )
            }
            className={inputClassName}
            >
            <option value="">
                Select a city
            </option>

            {SUPPORTED_CITIES.map(
                (city) => (
                <option
                    key={city.value}
                    value={city.value}
                >
                    {city.label}
                </option>
                )
            )}
            </select>
        </FormField>

        <FormField
          id={
            collection
              ? `${collection.id}-category`
              : 'new-collection-category'
          }
          label="Category"
          name="category"
        >
          <input
            id={
              collection
                ? `${collection.id}-category`
                : 'new-collection-category'
            }
            name="category"
            type="text"
            maxLength={120}
            defaultValue={
              collection?.category ??
              ''
            }
            placeholder="Date Night"
            className={inputClassName}
          />
        </FormField>
      </div>

      <FormField
        id={
          collection
            ? `${collection.id}-cover`
            : 'new-collection-cover'
        }
        label="Cover image URL"
        name="cover_image_url"
        description="Use a public http:// or https:// image URL."
      >
        <input
          id={
            collection
              ? `${collection.id}-cover`
              : 'new-collection-cover'
          }
          name="cover_image_url"
          type="url"
          inputMode="url"
          maxLength={2048}
          defaultValue={
            collection?.cover_image_url ??
            ''
          }
          placeholder="https://example.com/cover.jpg"
          className={inputClassName}
        />
      </FormField>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-3">
          <input
            type="radio"
            name="visibility"
            value="private"
            defaultChecked={
              !collection ||
              collection.visibility ===
                'private'
            }
            className="mt-0.5 h-4 w-4 accent-cyan-400"
          />

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Private
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Visible only in your
              collection manager.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-3">
          <input
            type="radio"
            name="visibility"
            value="public"
            defaultChecked={
              collection?.visibility ===
              'public'
            }
            className="mt-0.5 h-4 w-4 accent-cyan-400"
          />

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Public
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Eligible to appear on your
              creator profile.
            </span>
          </span>
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-3">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={
            collection?.featured ??
            false
          }
          className="mt-0.5 h-4 w-4 accent-indigo-400"
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">
            Feature this collection
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            Featured public collections
            receive priority on your
            creator profile.
          </span>
        </span>
      </label>
    </>
  )
}

function FormField({
  id,
  label,
  required = false,
  description,
  children,
}: {
  id: string
  label: string
  name: string
  required?: boolean
  description?: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-sm font-medium text-neutral-200"
      >
        {label}

        {required ? (
          <span className="text-cyan-400">
            {' '}
            *
          </span>
        ) : null}
      </label>

      <div className="mt-2">
        {children}
      </div>

      {description ? (
        <p className="mt-1.5 text-xs leading-5 text-neutral-600">
          {description}
        </p>
      ) : null}
    </div>
  )
}

const inputClassName = [
  'w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition',
  'placeholder:text-neutral-700',
  'focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40',
].join(' ')

/* =========================================================
 * Visibility and featured controls
 * ======================================================= */

function VisibilityControl({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  const nextVisibility =
    collection.visibility === 'public'
      ? 'private'
      : 'public'

  return (
    <form
      action={
        setCollectionVisibilityFormAction
      }
      className="rounded-2xl border border-neutral-800 bg-black/25 p-3"
    >
      <input
        type="hidden"
        name="collectionId"
        value={collection.id}
      />

      <input
        type="hidden"
        name="visibility"
        value={nextVisibility}
      />

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Visibility
      </p>

      <p className="mt-2 text-sm font-medium text-white">
        Currently{' '}
        {collection.visibility}
      </p>

      <button
        type="submit"
        className="mt-3 w-full rounded-full border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-cyan-400/50 hover:text-white"
      >
        Make {nextVisibility}
      </button>
    </form>
  )
}

function FeaturedControl({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <form
      action={
        setCollectionFeaturedFormAction
      }
      className="rounded-2xl border border-neutral-800 bg-black/25 p-3"
    >
      <input
        type="hidden"
        name="collectionId"
        value={collection.id}
      />

      <input
        type="hidden"
        name="featured"
        value={
          collection.featured
            ? 'false'
            : 'true'
        }
      />

      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Featured
      </p>

      <p className="mt-2 text-sm font-medium text-white">
        {collection.featured
          ? 'Featured on profile'
          : 'Not featured'}
      </p>

      <button
        type="submit"
        className="mt-3 w-full rounded-full border border-indigo-500/30 bg-indigo-500/[0.05] px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/10 hover:text-white"
      >
        {collection.featured
          ? 'Remove Feature'
          : 'Feature Collection'}
      </button>
    </form>
  )
}

/* =========================================================
 * Reordering
 * ======================================================= */

function CollectionMoveForm({
  collectionId,
  orderedIds,
  direction,
  disabled,
}: {
  collectionId: string
  orderedIds: string[]
  direction: 'up' | 'down'
  disabled: boolean
}) {
  return (
    <form
      action={
        moveCollectionFormAction
      }
    >
      <input
        type="hidden"
        name="collectionId"
        value={collectionId}
      />

      <input
        type="hidden"
        name="direction"
        value={direction}
      />

      <input
        type="hidden"
        name="orderedIds"
        value={JSON.stringify(
          orderedIds
        )}
      />

      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move collection ${direction}`}
        title={`Move ${direction}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 bg-black/30 text-sm text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        {direction === 'up'
          ? '↑'
          : '↓'}
      </button>
    </form>
  )
}

/* =========================================================
 * Delete
 * ======================================================= */

function DeleteCollectionControl({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <details className="rounded-2xl border border-red-900/50 bg-red-950/10">
      <summary className="cursor-pointer list-none px-3 py-3 text-xs font-semibold text-red-300">
        Delete collection
      </summary>

      <form
        action={
          deleteCollectionFormAction
        }
        className="border-t border-red-900/40 p-3"
      >
        <input
          type="hidden"
          name="collectionId"
          value={collection.id}
        />

        <p className="text-xs leading-5 text-red-200/70">
          This permanently deletes the
          collection and its collection
          items.
        </p>

        <label className="mt-3 flex items-start gap-2 text-xs text-red-200">
          <input
            type="checkbox"
            name="confirmDelete"
            value={collection.id}
            required
            className="mt-0.5 h-4 w-4 accent-red-500"
          />

          I understand this cannot be
          undone.
        </label>

        <button
          type="submit"
          className="mt-3 w-full rounded-full bg-red-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-400"
        >
          Permanently Delete
        </button>
      </form>
    </details>
  )
}

/* =========================================================
 * Server form actions
 * ======================================================= */

async function createCollectionFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const result =
    await createCreatorCollectionAction({
      title:
        formData.get('title'),

      description:
        formData.get(
          'description'
        ),

      cover_image_url:
        formData.get(
          'cover_image_url'
        ),

      city:
        formData.get('city'),

      category:
        formData.get('category'),

      visibility:
        formData.get('visibility'),

      featured:
        formData.get('featured') ===
        'on',

      sort_order:
        formData.get(
          'sort_order'
        ),
    })

  redirectWithActionResult({
    result,
    successMessage:
      'Collection created successfully.',
  })
}

async function updateCollectionFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const result =
    await updateCreatorCollectionAction({
      collectionId:
        formData.get(
          'collectionId'
        ),

      title:
        formData.get('title'),

      description:
        formData.get(
          'description'
        ),

      cover_image_url:
        formData.get(
          'cover_image_url'
        ),

      city:
        formData.get('city'),

      category:
        formData.get('category'),

      visibility:
        formData.get('visibility'),

      featured:
        formData.get('featured') ===
        'on',

      sort_order:
        formData.get(
          'sort_order'
        ),
    })

  redirectWithActionResult({
    result,
    successMessage:
      'Collection updated successfully.',
  })
}

async function deleteCollectionFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const collectionId =
    getFormString(
      formData,
      'collectionId'
    )

  const confirmation =
    getFormString(
      formData,
      'confirmDelete'
    )

  if (
    !collectionId ||
    confirmation !== collectionId
  ) {
    redirectToCollections({
      status: 'error',
      message:
        'Collection deletion was not confirmed.',
    })
  }

  const result =
    await deleteCreatorCollectionAction({
      collectionId,
    })

  redirectWithActionResult({
    result,
    successMessage:
      'Collection deleted successfully.',
  })
}

async function setCollectionVisibilityFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const result =
    await setCreatorCollectionVisibilityAction(
      {
        collectionId:
          formData.get(
            'collectionId'
          ),

        visibility:
          formData.get(
            'visibility'
          ),
      }
    )

  redirectWithActionResult({
    result,
    successMessage:
      'Collection visibility updated.',
  })
}

async function setCollectionFeaturedFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const result =
    await setCreatorCollectionFeaturedAction(
      {
        collectionId:
          formData.get(
            'collectionId'
          ),

        featured:
          formData.get(
            'featured'
          ) === 'true',
      }
    )

  redirectWithActionResult({
    result,
    successMessage:
      'Featured collection setting updated.',
  })
}

async function moveCollectionFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const collectionId =
    getFormString(
      formData,
      'collectionId'
    )

  const direction =
    getFormString(
      formData,
      'direction'
    )

  const orderedIds =
    parseCollectionIds(
      formData.get(
        'orderedIds'
      )
    )

  if (
    !collectionId ||
    (
      direction !== 'up' &&
      direction !== 'down'
    ) ||
    orderedIds.length === 0
  ) {
    redirectToCollections({
      status: 'error',
      message:
        'The requested collection move was invalid.',
    })
  }

  const currentIndex =
    orderedIds.indexOf(
      collectionId
    )

  const targetIndex =
    direction === 'up'
      ? currentIndex - 1
      : currentIndex + 1

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >=
      orderedIds.length
  ) {
    redirectToCollections({
      status: 'error',
      message:
        'The collection could not be moved in that direction.',
    })
  }

  const nextOrder = [
    ...orderedIds,
  ]

  const [
    movedCollectionId,
  ] = nextOrder.splice(
    currentIndex,
    1
  )

  if (!movedCollectionId) {
    redirectToCollections({
      status: 'error',
      message:
        'The collection order could not be updated.',
    })
  }

  nextOrder.splice(
    targetIndex,
    0,
    movedCollectionId
  )

  const result =
    await reorderCreatorCollectionsAction(
      {
        collectionIds:
          nextOrder,
      }
    )

  redirectWithActionResult({
    result,
    successMessage:
      'Collection order updated.',
  })
}

/* =========================================================
 * Loader
 * ======================================================= */

async function loadCreatorCollectionsPage(): Promise<
  CollectionsPageData | null
> {
  const supabase =
    await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error(
      '[creator collections page] Authentication failed:',
      authError
    )

    return null
  }

  if (!user) {
    return null
  }

  const [
    profileResult,
    collectionsResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        username,
        creator_mode_enabled
      `)
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('creator_collections')
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
      .eq('user_id', user.id)
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      }),
  ])

  if (profileResult.error) {
    console.error(
      '[creator collections page] Profile query failed:',
      profileResult.error
    )

    throw new Error(
      'Creator collection profile could not be loaded.'
    )
  }

  if (!profileResult.data) {
    throw new Error(
      'The authenticated user has no profile row.'
    )
  }

  if (collectionsResult.error) {
    console.error(
      '[creator collections page] Collection query failed:',
      collectionsResult.error
    )

    throw new Error(
      'Creator collections could not be loaded.'
    )
  }

  const profile =
    normalizeProfileRow(
      profileResult.data,
      user.id
    )

  if (!profile) {
    throw new Error(
      'Creator collection profile data is invalid.'
    )
  }

  const collections =
    normalizeCollectionRows(
      collectionsResult.data,
      user.id
    )

  const venueCountsByCollectionId =
    await loadCollectionVenueCounts({
      supabase,
      collections,
      userId: user.id,
    })

  return {
    userId: user.id,
    profile,
    collections,
    venueCountsByCollectionId,
  }
}

/* =========================================================
 * Focused venue-layer loader
 * ======================================================= */

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createServerClient
    >
  >

async function loadCollectionVenueCounts({
  supabase,
  collections,
  userId,
}: {
  supabase: SupabaseServerClient
  collections: CreatorCollectionRow[]
  userId: string
}): Promise<CollectionVenueCountMap> {
  const counts:
    CollectionVenueCountMap = {}

  for (const collection of collections) {
    counts[collection.id] = 0
  }

  if (collections.length === 0) {
    return counts
  }

  const collectionIds =
    collections.map(
      (collection) =>
        collection.id
    )

  const result =
    await supabase
      .from(
        'creator_collection_venues'
      )
      .select('collection_id')
      .in(
        'collection_id',
        collectionIds
      )

  if (result.error) {
    console.error(
      '[creator collections page] Venue-count query failed:',
      {
        userId,
        collectionIds,
        error: result.error,
      }
    )

    return counts
  }

  const validCollectionIds =
    new Set(collectionIds)

  for (
    const row of
      result.data ?? []
  ) {
    const collectionId =
      normalizeRequiredText(
        row.collection_id
      )

    if (
      !collectionId ||
      !validCollectionIds.has(
        collectionId
      )
    ) {
      continue
    }

    counts[collectionId] =
      (counts[collectionId] ??
        0) + 1
  }

  return counts
}

/* =========================================================
 * Action redirect helpers
 * ======================================================= */

function redirectWithActionResult({
  result,
  successMessage,
}: {
  result:
    | {
        success: true
      }
    | {
        success: false
        error: string
      }
  successMessage: string
}): never {
  if (result.success) {
    redirectToCollections({
      status: 'success',
      message: successMessage,
    })
  }

  redirectToCollections({
    status: 'error',
    message:
      result.error,
  })
}

function redirectToCollections({
  status,
  message,
}: {
  status: 'success' | 'error'
  message: string
}): never {
  const query =
    new URLSearchParams({
      status,
      message: message.slice(
        0,
        300
      ),
    })

  redirect(
    `/profile/creator/collections?${query.toString()}`
  )
}

/* =========================================================
 * Row normalization
 * ======================================================= */

function normalizeProfileRow(
  value: unknown,
  expectedUserId: string
): ProfileRow | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    value.id !== expectedUserId
  ) {
    return null
  }

  return {
    id: expectedUserId,

    username:
      normalizeNullableText(
        value.username
      ),

    creator_mode_enabled:
      value.creator_mode_enabled ===
      true,
  }
}

function normalizeCollectionRows(
  value: unknown,
  expectedUserId: string
): CreatorCollectionRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  const collections =
    value
      .map((row) =>
        normalizeCollectionRow(
          row,
          expectedUserId
        )
      )
      .filter(
        (
          collection
        ): collection is CreatorCollectionRow =>
          collection !== null
      )

  return collections.sort(
    compareCollections
  )
}

function normalizeCollectionRow(
  value: unknown,
  expectedUserId: string
): CreatorCollectionRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeRequiredText(
      value.id
    )

  const userId =
    normalizeRequiredText(
      value.user_id
    )

  const title =
    normalizeRequiredText(
      value.title
    )

  const slug =
    normalizeRequiredText(
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

  const visibility =
    value.visibility === 'public' ||
    value.visibility === 'private'
      ? value.visibility
      : null

  if (
    !id ||
    userId !== expectedUserId ||
    !title ||
    !slug ||
    !visibility ||
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
      normalizeNullableText(
        value.description
      ),

    cover_image_url:
      normalizeNullableText(
        value.cover_image_url
      ),

    city:
      normalizeNullableText(
        value.city
      ),

    category:
      normalizeNullableText(
        value.category
      ),

    visibility,

    featured:
      value.featured === true,

    sort_order:
      normalizeNonNegativeInteger(
        value.sort_order
      ),

    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function compareCollections(
  first: CreatorCollectionRow,
  second: CreatorCollectionRow
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
    Date.parse(first.created_at) -
    Date.parse(second.created_at)

  if (createdComparison !== 0) {
    return createdComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

/* =========================================================
 * General helpers
 * ======================================================= */

function getNextSortOrder(
  collections: CreatorCollectionRow[]
): number {
  if (collections.length === 0) {
    return 0
  }

  return (
    Math.max(
      ...collections.map(
        (collection) =>
          collection.sort_order
      )
    ) + 1
  )
}

function parseCollectionIds(
  value: FormDataEntryValue | null
): string[] {
  if (typeof value !== 'string') {
    return []
  }

  try {
    const parsed =
      JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(
        (
          item
        ): item is string =>
          typeof item === 'string' &&
          item.trim().length > 0
      )
      .map((item) =>
        item.trim()
      )
  } catch {
    return []
  }
}

function getFormString(
  formData: FormData,
  key: string
): string | null {
  const value =
    formData.get(key)

  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeRequiredText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
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

function normalizeNonNegativeInteger(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 0
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