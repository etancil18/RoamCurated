import type { Metadata } from 'next'
import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import {
  deleteCreatorCollectionAction,
  setCreatorCollectionFeaturedAction,
  setCreatorCollectionVisibilityAction,
  updateCreatorCollectionAction,
  type CollectionActionFailure,
} from '../actions'

import {
  createServerClient,
} from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Manage Creator Collection | Roam',
  description:
    'Edit, publish, feature, and manage a Roam creator collection.',
  robots: {
    index: false,
    follow: false,
  },
}

/* =========================================================
 * Page contracts
 * ======================================================= */

type Props = {
  params: Promise<{
    collectionId: string
  }>

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

type CollectionPageData = {
  profile: ProfileRow
  collection: CreatorCollectionRow
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function CreatorCollectionPage({
  params,
  searchParams,
}: Props) {
  const {
    collectionId: rawCollectionId,
  } = await params

  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : undefined

  const collectionId =
    normalizeCollectionId(
      rawCollectionId
    )

  if (!collectionId) {
    notFound()
  }

  const pageData =
    await loadCollectionPageData(
      collectionId
    )

  if (
    pageData.status ===
    'unauthenticated'
  ) {
    const nextPath =
      `/profile/creator/collections/${encodeURIComponent(
        collectionId
      )}`

    redirect(
      `/login?next=${encodeURIComponent(
        nextPath
      )}`
    )
  }

  if (
    pageData.status === 'not-found'
  ) {
    notFound()
  }

  const {
    profile,
    collection,
  } = pageData.data

  const feedback =
    normalizeActionFeedback({
      status:
        resolvedSearchParams?.status,

      message:
        resolvedSearchParams?.message,
    })

  const publicProfileHref =
    profile.username
      ? `/u/${encodeURIComponent(
          profile.username
        )}`
      : null

  const publicCollectionHref =
    profile.username &&
    collection.visibility === 'public'
      ? `/u/${encodeURIComponent(
          profile.username
        )}/collections/${encodeURIComponent(
          collection.slug
        )}`
      : null

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-4xl">
        <CollectionPageHeader
          collection={collection}
          publicProfileHref={
            publicProfileHref
          }
          publicCollectionHref={
            publicCollectionHref
          }
        />

        <div className="mt-6 space-y-5">
          {feedback ? (
            <ActionFeedback
              status={feedback.status}
              message={feedback.message}
            />
          ) : null}

          {!profile.creator_mode_enabled ? (
            <CreatorModeInactiveNotice />
          ) : null}

          {!profile.username ? (
            <UsernameMissingNotice />
          ) : null}

          <CollectionStatusOverview
            collection={collection}
          />

          <CollectionEditor
            collection={collection}
          />

          <CollectionPublishingControls
            collection={collection}
          />

          <CollectionDangerZone
            collection={collection}
          />
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Header
 * ======================================================= */

function CollectionPageHeader({
  collection,
  publicProfileHref,
  publicCollectionHref,
}: {
  collection: CreatorCollectionRow
  publicProfileHref: string | null
  publicCollectionHref: string | null
}) {
  return (
    <header className="w-full min-w-0">
      <nav
        aria-label="Creator collection navigation"
        className="flex flex-wrap gap-2"
      >
        <Link
          href="/profile/creator/collections"
          className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
        >
          ← Collections
        </Link>

        <Link
          href="/profile/creator"
          className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
        >
          Creator Settings
        </Link>

        {publicProfileHref ? (
          <Link
            href={publicProfileHref}
            className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-cyan-400/40 hover:text-white"
          >
            Public Profile
          </Link>
        ) : null}

        {publicCollectionHref ? (
          <Link
            href={publicCollectionHref}
            className="inline-flex items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white"
          >
            Preview Collection →
          </Link>
        ) : null}
      </nav>

      <div className="mt-6 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-400">
          Creator Collection
        </p>

        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {collection.title}
        </h1>

        <p className="mt-2 break-all text-sm text-neutral-600">
          /{collection.slug}
        </p>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          Edit the collection’s public
          identity, publishing status, and
          featured placement.
        </p>
      </div>
    </header>
  )
}

/* =========================================================
 * Feedback
 * ======================================================= */

function ActionFeedback({
  status,
  message,
}: {
  status: 'success' | 'error'
  message: string
}) {
  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
      >
        <p className="text-sm font-semibold text-emerald-200">
          Collection updated
        </p>

        <p className="mt-1 break-words text-xs leading-5 text-emerald-300/80">
          {message}
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

      <p className="mt-1 break-words text-xs leading-5 text-red-300/80">
        {message}
      </p>
    </div>
  )
}

/* =========================================================
 * Notices
 * ======================================================= */

function CreatorModeInactiveNotice() {
  return (
    <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
      <p className="text-sm font-semibold text-amber-200">
        Creator Mode is inactive
      </p>

      <p className="mt-1 text-xs leading-5 text-amber-200/70">
        You can continue editing this
        collection, but it will not appear
        through the Creator Mode sections
        of your public profile until
        Creator Mode is enabled.
      </p>

      <Link
        href="/profile/creator"
        className="mt-3 inline-flex text-xs font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-4 transition hover:text-white"
      >
        Manage Creator Mode
      </Link>
    </section>
  )
}

function UsernameMissingNotice() {
  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3">
      <p className="text-sm font-semibold text-cyan-200">
        Public collection URL unavailable
      </p>

      <p className="mt-1 text-xs leading-5 text-cyan-200/70">
        Add a username before publishing
        and sharing this collection through
        a public URL.
      </p>

      <Link
        href="/profile"
        className="mt-3 inline-flex text-xs font-semibold text-cyan-200 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-white"
      >
        Open Profile Settings
      </Link>
    </section>
  )
}

/* =========================================================
 * Status overview
 * ======================================================= */

function CollectionStatusOverview({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <section
      aria-label="Collection status"
      className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-gradient-to-br from-neutral-950 to-black p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <VisibilityBadge
              visibility={
                collection.visibility
              }
            />

            <FeaturedBadge
              featured={
                collection.featured
              }
            />
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400">
            Public collections are
            eligible for public collection
            routes. Featured public
            collections receive priority
            in the creator profile’s
            featured collection section.
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-2">
          <StatusMetric
            label="Order"
            value={
              collection.sort_order + 1
            }
          />

          <StatusMetric
            label="Updated"
            value={formatDate(
              collection.updated_at
            )}
          />
        </dl>
      </div>
    </section>
  )
}

function VisibilityBadge({
  visibility,
}: {
  visibility: 'public' | 'private'
}) {
  const isPublic =
    visibility === 'public'

  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
        isPublic
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-400',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'h-2 w-2 rounded-full',
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

function FeaturedBadge({
  featured,
}: {
  featured: boolean
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold',
        featured
          ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
          : 'border-neutral-800 bg-black/30 text-neutral-600',
      ].join(' ')}
    >
      {featured
        ? 'Featured'
        : 'Not featured'}
    </span>
  )
}

function StatusMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="min-w-[92px] rounded-2xl border border-neutral-800 bg-black/30 px-3 py-3 text-center">
      <dd className="break-words text-sm font-semibold text-white">
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </dd>

      <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        {label}
      </dt>
    </div>
  )
}

/* =========================================================
 * Main editor
 * ======================================================= */

function CollectionEditor({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <section
      aria-labelledby="collection-editor-title"
      className="w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/75 shadow-2xl shadow-black/20"
    >
      <div className="border-b border-neutral-800/80 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Collection identity
        </p>

        <h2
          id="collection-editor-title"
          className="mt-1 text-lg font-semibold text-white"
        >
          Edit collection details
        </h2>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Updating the title does not
          change the existing collection
          URL slug.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <form
          action={updateCollectionFormAction}
          className="min-w-0 space-y-5"
        >
          <input
            type="hidden"
            name="collectionId"
            value={collection.id}
          />

          <input
            type="hidden"
            name="sort_order"
            value={collection.sort_order}
          />

          <FormField
            id="collection-title"
            label="Title"
            required
            description="Changing the title preserves the existing public URL."
          >
            <input
              id="collection-title"
              name="title"
              type="text"
              required
              maxLength={160}
              defaultValue={
                collection.title
              }
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="collection-description"
            label="Description"
            description="Explain what this collection contains and why it is useful."
          >
            <textarea
              id="collection-description"
              name="description"
              rows={5}
              maxLength={1000}
              defaultValue={
                collection.description ??
                ''
              }
              className={`${inputClassName} resize-y leading-6`}
            />
          </FormField>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <FormField
              id="collection-city"
              label="City"
            >
              <input
                id="collection-city"
                name="city"
                type="text"
                autoComplete="address-level2"
                maxLength={160}
                defaultValue={
                  collection.city ?? ''
                }
                className={inputClassName}
              />
            </FormField>

            <FormField
              id="collection-category"
              label="Category"
            >
              <input
                id="collection-category"
                name="category"
                type="text"
                maxLength={120}
                defaultValue={
                  collection.category ??
                  ''
                }
                className={inputClassName}
              />
            </FormField>
          </div>

          <FormField
            id="collection-cover-image"
            label="Cover image URL"
            description="Use a public http:// or https:// image URL. Local and private-network URLs are rejected."
          >
            <input
              id="collection-cover-image"
              name="cover_image_url"
              type="url"
              inputMode="url"
              autoComplete="url"
              maxLength={2048}
              defaultValue={
                collection.cover_image_url ??
                ''
              }
              className={inputClassName}
            />
          </FormField>

          <VisibilityFields
            collection={collection}
          />

          <FeaturedField
            collection={collection}
          />

          <div className="flex flex-wrap gap-3 border-t border-neutral-800/80 pt-5">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Save Changes
            </button>

            <Link
              href="/profile/creator/collections"
              className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-black/30 px-5 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </form>

        <CollectionCoverPreview
          collection={collection}
        />
      </div>
    </section>
  )
}

function VisibilityFields({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-neutral-200">
        Visibility
      </legend>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-4 transition hover:border-neutral-600">
          <input
            type="radio"
            name="visibility"
            value="private"
            defaultChecked={
              collection.visibility ===
              'private'
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
          />

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Private
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Visible only inside your
              creator collection manager.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-4 transition hover:border-indigo-500/40">
          <input
            type="radio"
            name="visibility"
            value="public"
            defaultChecked={
              collection.visibility ===
              'public'
            }
            className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400"
          />

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Public
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Eligible for public profile
              and collection routes.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  )
}

function FeaturedField({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4">
      <input
        type="checkbox"
        name="featured"
        defaultChecked={
          collection.featured
        }
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400"
      />

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">
          Feature this collection
        </span>

        <span className="mt-1 block text-xs leading-5 text-neutral-500">
          Featured public collections
          receive priority on the creator
          profile. Private collections
          remain hidden even when featured.
        </span>
      </span>
    </label>
  )
}

/* =========================================================
 * Cover preview
 * ======================================================= */

function CollectionCoverPreview({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <aside className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        Current cover
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-800 bg-black/30">
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
          {collection.cover_image_url ? (
            <img
              src={
                collection.cover_image_url
              }
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_42%),#09090b]">
              <div className="text-center">
                <span className="text-3xl">
                  🗺️
                </span>

                <p className="mt-2 text-xs font-medium text-neutral-500">
                  No cover image
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-3">
          <p className="line-clamp-2 break-words text-sm font-semibold text-white">
            {collection.title}
          </p>

          {collection.city ? (
            <p className="mt-1 truncate text-xs text-neutral-500">
              {collection.city}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-neutral-600">
        This preview reflects the currently
        saved cover. Submit the form before
        a new URL appears here.
      </p>
    </aside>
  )
}

/* =========================================================
 * Publishing controls
 * ======================================================= */

function CollectionPublishingControls({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  const nextVisibility =
    collection.visibility === 'public'
      ? 'private'
      : 'public'

  return (
    <section
      aria-labelledby="collection-publishing-title"
      className="w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/75 p-4 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        Quick controls
      </p>

      <h2
        id="collection-publishing-title"
        className="mt-1 text-lg font-semibold text-white"
      >
        Publishing and placement
      </h2>

      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <form
          action={
            setVisibilityFormAction
          }
          className="rounded-2xl border border-neutral-800 bg-black/30 p-4"
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

          <p className="mt-2 text-sm font-semibold text-white">
            Currently{' '}
            {collection.visibility}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            Change only the visibility
            state without submitting the
            full editor form.
          </p>

          <button
            type="submit"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/[0.06] px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/10 hover:text-white"
          >
            Make {nextVisibility}
          </button>
        </form>

        <form
          action={
            setFeaturedFormAction
          }
          className="rounded-2xl border border-neutral-800 bg-black/30 p-4"
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
            Featured placement
          </p>

          <p className="mt-2 text-sm font-semibold text-white">
            {collection.featured
              ? 'Featured'
              : 'Not featured'}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            Change featured placement
            without modifying the remaining
            collection fields.
          </p>

          <button
            type="submit"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/[0.06] px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/10 hover:text-white"
          >
            {collection.featured
              ? 'Remove Feature'
              : 'Feature Collection'}
          </button>
        </form>
      </div>
    </section>
  )
}

/* =========================================================
 * Danger zone
 * ======================================================= */

function CollectionDangerZone({
  collection,
}: {
  collection: CreatorCollectionRow
}) {
  return (
    <section
      aria-labelledby="collection-danger-title"
      className="w-full min-w-0 rounded-[1.75rem] border border-red-900/50 bg-red-950/10 p-4 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
        Danger zone
      </p>

      <h2
        id="collection-danger-title"
        className="mt-1 text-lg font-semibold text-white"
      >
        Delete collection
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-red-200/60">
        Deleting this collection is
        permanent. Associated collection
        items may also be removed by
        database cascade rules.
      </p>

      <details className="mt-4 rounded-2xl border border-red-900/50 bg-black/20">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-red-300">
          Permanently delete this collection
        </summary>

        <form
          action={
            deleteCollectionFormAction
          }
          className="border-t border-red-900/40 p-4"
        >
          <input
            type="hidden"
            name="collectionId"
            value={collection.id}
          />

          <p className="text-xs leading-5 text-red-200/70">
            Confirm deletion of{' '}
            <strong className="font-semibold text-red-200">
              {collection.title}
            </strong>
            .
          </p>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-xs leading-5 text-red-200">
            <input
              type="checkbox"
              name="confirmDelete"
              value={collection.id}
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-red-500"
            />

            <span>
              I understand this action
              cannot be undone.
            </span>
          </label>

          <button
            type="submit"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Permanently Delete
          </button>
        </form>
      </details>
    </section>
  )
}

/* =========================================================
 * Form field
 * ======================================================= */

function FormField({
  id,
  label,
  required = false,
  description,
  children,
}: {
  id: string
  label: string
  required?: boolean
  description?: string
  children: React.ReactNode
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
 * Server form actions
 * ======================================================= */

async function updateCollectionFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const collectionId =
    getRequiredFormString(
      formData,
      'collectionId'
    )

  if (!collectionId) {
    redirectToCollectionsManager({
      status: 'error',
      message:
        'The collection identifier was missing.',
    })
  }

  const result =
    await updateCreatorCollectionAction({
      collectionId,

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

  redirectWithCollectionResult({
    collectionId,
    result,
    successMessage:
      'Collection details saved successfully.',
  })
}

async function setVisibilityFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const collectionId =
    getRequiredFormString(
      formData,
      'collectionId'
    )

  if (!collectionId) {
    redirectToCollectionsManager({
      status: 'error',
      message:
        'The collection identifier was missing.',
    })
  }

  const result =
    await setCreatorCollectionVisibilityAction(
      {
        collectionId,

        visibility:
          formData.get(
            'visibility'
          ),
      }
    )

  redirectWithCollectionResult({
    collectionId,
    result,
    successMessage:
      'Collection visibility updated successfully.',
  })
}

async function setFeaturedFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const collectionId =
    getRequiredFormString(
      formData,
      'collectionId'
    )

  if (!collectionId) {
    redirectToCollectionsManager({
      status: 'error',
      message:
        'The collection identifier was missing.',
    })
  }

  const result =
    await setCreatorCollectionFeaturedAction(
      {
        collectionId,

        featured:
          formData.get(
            'featured'
          ) === 'true',
      }
    )

  redirectWithCollectionResult({
    collectionId,
    result,
    successMessage:
      'Featured collection setting updated successfully.',
  })
}

async function deleteCollectionFormAction(
  formData: FormData
): Promise<void> {
  'use server'

  const collectionId =
    getRequiredFormString(
      formData,
      'collectionId'
    )

  const confirmation =
    getRequiredFormString(
      formData,
      'confirmDelete'
    )

  if (
    !collectionId ||
    confirmation !== collectionId
  ) {
    if (collectionId) {
      redirectToCollection({
        collectionId,
        status: 'error',
        message:
          'Collection deletion was not confirmed.',
      })
    }

    redirectToCollectionsManager({
      status: 'error',
      message:
        'Collection deletion was not confirmed.',
    })
  }

  const result =
    await deleteCreatorCollectionAction({
      collectionId,
    })

  if (!result.success) {
    redirectToCollection({
      collectionId,
      status: 'error',
      message:
        getActionErrorMessage(
          result
        ),
    })
  }

  redirectToCollectionsManager({
    status: 'success',
    message:
      'Collection deleted successfully.',
  })
}

/* =========================================================
 * Page loader
 * ======================================================= */

type CollectionPageLoadResult =
  | {
      status: 'success'
      data: CollectionPageData
    }
  | {
      status: 'unauthenticated'
    }
  | {
      status: 'not-found'
    }

async function loadCollectionPageData(
  collectionId: string
): Promise<CollectionPageLoadResult> {
  const supabase =
    await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error(
      '[creator collection page] Authentication failed:',
      authError
    )

    return {
      status: 'unauthenticated',
    }
  }

  if (!user) {
    return {
      status: 'unauthenticated',
    }
  }

  const [
    profileResult,
    collectionResult,
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
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (profileResult.error) {
    console.error(
      '[creator collection page] Profile query failed:',
      profileResult.error
    )

    throw new Error(
      'The creator profile could not be loaded.'
    )
  }

  if (collectionResult.error) {
    console.error(
      '[creator collection page] Collection query failed:',
      collectionResult.error
    )

    throw new Error(
      'The creator collection could not be loaded.'
    )
  }

  if (
    !profileResult.data ||
    !collectionResult.data
  ) {
    return {
      status: 'not-found',
    }
  }

  const profile =
    normalizeProfileRow(
      profileResult.data,
      user.id
    )

  const collection =
    normalizeCollectionRow(
      collectionResult.data,
      user.id,
      collectionId
    )

  if (!profile || !collection) {
    return {
      status: 'not-found',
    }
  }

  return {
    status: 'success',
    data: {
      profile,
      collection,
    },
  }
}

/* =========================================================
 * Redirect helpers
 * ======================================================= */

function redirectWithCollectionResult({
  collectionId,
  result,
  successMessage,
}: {
  collectionId: string

  result:
    | {
        success: true
      }
    | CollectionActionFailure

  successMessage: string
}): never {
  if (result.success) {
    redirectToCollection({
      collectionId,
      status: 'success',
      message: successMessage,
    })
  }

  redirectToCollection({
    collectionId,
    status: 'error',
    message:
      getActionErrorMessage(
        result
      ),
  })
}

function redirectToCollection({
  collectionId,
  status,
  message,
}: {
  collectionId: string
  status: 'success' | 'error'
  message: string
}): never {
  const query =
    new URLSearchParams({
      status,
      message:
        normalizeFeedbackMessage(
          message
        ) ??
        'Collection action completed.',
    })

  redirect(
    `/profile/creator/collections/${encodeURIComponent(
      collectionId
    )}?${query.toString()}`
  )
}

function redirectToCollectionsManager({
  status,
  message,
}: {
  status: 'success' | 'error'
  message: string
}): never {
  const query =
    new URLSearchParams({
      status,
      message:
        normalizeFeedbackMessage(
          message
        ) ??
        'Collection action completed.',
    })

  redirect(
    `/profile/creator/collections?${query.toString()}`
  )
}

function getActionErrorMessage(
  result: CollectionActionFailure
): string {
  const fieldMessage =
    getFirstFieldError(
      result.fieldErrors
    )

  return (
    normalizeFeedbackMessage(
      fieldMessage
    ) ??
    normalizeFeedbackMessage(
      result.error
    ) ??
    'The collection could not be updated.'
  )
}

function getFirstFieldError(
  fieldErrors:
    | CollectionActionFailure['fieldErrors']
    | undefined
): string | null {
  if (!fieldErrors) {
    return null
  }

  const preferredFields = [
    'title',
    'description',
    'cover_image_url',
    'city',
    'category',
    'visibility',
    'featured',
    'sort_order',
    'collectionId',
  ] as const

  for (
    const field of preferredFields
  ) {
    const message =
      fieldErrors[field]?.[0]

    if (message) {
      return message
    }
  }

  for (
    const messages of Object.values(
      fieldErrors
    )
  ) {
    const message =
      messages?.[0]

    if (message) {
      return message
    }
  }

  return null
}

/* =========================================================
 * Feedback normalization
 * ======================================================= */

function normalizeActionFeedback({
  status,
  message,
}: {
  status: unknown
  message: unknown
}):
  | {
      status: 'success' | 'error'
      message: string
    }
  | null {
  if (
    status !== 'success' &&
    status !== 'error'
  ) {
    return null
  }

  return {
    status,
    message:
      normalizeFeedbackMessage(
        message
      ) ??
      (status === 'success'
        ? 'Collection updated successfully.'
        : 'The requested collection change could not be completed.'),
  }
}

function normalizeFeedbackMessage(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 300)

  return normalized.length > 0
    ? normalized
    : null
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

function normalizeCollectionRow(
  value: unknown,
  expectedUserId: string,
  expectedCollectionId: string
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

  const visibility =
    value.visibility === 'public' ||
    value.visibility === 'private'
      ? value.visibility
      : null

  const createdAt =
    normalizeIsoDate(
      value.created_at
    )

  const updatedAt =
    normalizeIsoDate(
      value.updated_at
    )

  if (
    id !== expectedCollectionId ||
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

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeCollectionId(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  if (
    !normalized ||
    !isUuid(normalized)
  ) {
    return null
  }

  return normalized
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function getRequiredFormString(
  formData: FormData,
  key: string
): string | null {
  const value =
    formData.get(key)

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

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

  const normalized = value.trim()

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