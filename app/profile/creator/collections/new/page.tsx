import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  createCreatorCollectionAction,
  type CollectionActionFailure,
} from '../actions'

import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'New Creator Collection | Roam',
  description:
    'Create a new public or private collection for your Roam creator profile.',
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
    error?: string
  }>
}

type ProfileRow = {
  id: string
  username: string | null
  creator_mode_enabled: boolean | null
}

type CollectionSortOrderRow = {
  sort_order: number | null
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function NewCreatorCollectionPage({
  searchParams,
}: Props) {
  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : undefined

  const pageData =
    await loadNewCollectionPageData()

  if (!pageData) {
    redirect(
      `/login?next=${encodeURIComponent(
        '/profile/creator/collections/new'
      )}`
    )
  }

  const {
    profile,
    nextSortOrder,
  } = pageData

  const errorMessage =
    normalizeFeedbackMessage(
      resolvedSearchParams?.error
    )

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <PageHeader
          username={profile.username}
        />

        <div className="mt-6 space-y-5">
          {errorMessage ? (
            <ErrorFeedback
              message={errorMessage}
            />
          ) : null}

          {!profile.creator_mode_enabled ? (
            <CreatorModeNotice />
          ) : null}

          {!profile.username ? (
            <UsernameNotice />
          ) : null}

          <NewCollectionForm
            nextSortOrder={nextSortOrder}
          />
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Header
 * ======================================================= */

function PageHeader({
  username,
}: {
  username: string | null
}) {
  const publicProfileHref =
    username
      ? `/u/${encodeURIComponent(
          username
        )}`
      : null

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
            className="inline-flex items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/20 hover:text-white"
          >
            View Public Profile →
          </Link>
        ) : null}
      </nav>

      <div className="mt-6 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-400">
          Creator Mode
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Create a collection
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          Build a focused collection of
          places, routes, properties, or
          recommendations that reflects
          your point of view.
        </p>
      </div>
    </header>
  )
}

/* =========================================================
 * Notices
 * ======================================================= */

function ErrorFeedback({
  message,
}: {
  message: string
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-red-200">
        Collection could not be created
      </p>

      <p className="mt-1 break-words text-xs leading-5 text-red-300/80">
        {message}
      </p>
    </div>
  )
}

function CreatorModeNotice() {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
      <p className="text-sm font-semibold text-amber-200">
        Creator Mode is inactive
      </p>

      <p className="mt-1 text-xs leading-5 text-amber-200/70">
        You can prepare this collection
        now, but it will not appear on your
        public creator profile until
        Creator Mode is enabled.
      </p>

      <Link
        href="/profile/creator"
        className="mt-3 inline-flex items-center text-xs font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-4 transition hover:text-white"
      >
        Manage Creator Mode
      </Link>
    </div>
  )
}

function UsernameNotice() {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3">
      <p className="text-sm font-semibold text-cyan-200">
        Public URL unavailable
      </p>

      <p className="mt-1 text-xs leading-5 text-cyan-200/70">
        Add a username in your profile
        settings before publishing or
        sharing public collection routes.
      </p>

      <Link
        href="/profile"
        className="mt-3 inline-flex items-center text-xs font-semibold text-cyan-200 underline decoration-cyan-400/40 underline-offset-4 transition hover:text-white"
      >
        Open Profile Settings
      </Link>
    </div>
  )
}

/* =========================================================
 * Form
 * ======================================================= */

function NewCollectionForm({
  nextSortOrder,
}: {
  nextSortOrder: number
}) {
  return (
    <section
      aria-labelledby="new-collection-form-title"
      className="w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/75 shadow-2xl shadow-black/20"
    >
      <div className="border-b border-neutral-800/80 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Collection details
        </p>

        <h2
          id="new-collection-form-title"
          className="mt-1 text-lg font-semibold text-white"
        >
          Define the collection
        </h2>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Start with a clear title and
          description. You can add and
          organize collection items after
          creation.
        </p>
      </div>

      <form
        action={createCollectionFormAction}
        className="space-y-5 p-4 sm:p-5"
      >
        <input
          type="hidden"
          name="sort_order"
          value={nextSortOrder}
        />

        <FormField
          id="collection-title"
          label="Title"
          required
          description="Use a specific, descriptive title. This title also determines the initial public URL slug."
        >
          <input
            id="collection-title"
            name="title"
            type="text"
            required
            autoFocus
            autoComplete="off"
            maxLength={160}
            placeholder="Chicago Date Night"
            className={inputClassName}
          />
        </FormField>

        <FormField
          id="collection-description"
          label="Description"
          description="Explain what the collection contains and why it is useful."
        >
          <textarea
            id="collection-description"
            name="description"
            rows={5}
            maxLength={1000}
            placeholder="A curated route through intimate restaurants, cocktail bars, and late-night stops."
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
              placeholder="Chicago"
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
              autoComplete="off"
              maxLength={120}
              placeholder="Date Night"
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
            placeholder="https://example.com/collection-cover.jpg"
            className={inputClassName}
          />
        </FormField>

        <VisibilitySelector />

        <FeaturedSelector />

        <CreationDisclosure />

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-800/80 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href="/profile/creator/collections"
            className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-black/30 px-5 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Create Collection
          </button>
        </div>
      </form>
    </section>
  )
}

function VisibilitySelector() {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-neutral-200">
        Visibility
      </legend>

      <p className="mt-1 text-xs leading-5 text-neutral-600">
        Private is the safest default. You
        can publish the collection after
        reviewing it.
      </p>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-4 transition hover:border-cyan-400/40">
          <input
            type="radio"
            name="visibility"
            value="private"
            defaultChecked
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
            className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400"
          />

          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Public
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Eligible to appear on your
              creator profile and public
              collection routes.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  )
}

function FeaturedSelector() {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4">
      <input
        type="checkbox"
        name="featured"
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400"
      />

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">
          Feature this collection
        </span>

        <span className="mt-1 block text-xs leading-5 text-neutral-500">
          Featured public collections
          receive priority on your creator
          profile. Private collections are
          not shown publicly even when
          marked featured.
        </span>
      </span>
    </label>
  )
}

function CreationDisclosure() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/25 px-4 py-3">
      <p className="text-xs leading-5 text-neutral-500">
        Creating this collection does not
        add venues, routes, properties, or
        snapshots automatically. After
        creation, open the collection
        manager to add and organize its
        contents.
      </p>
    </div>
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
 * Server form action
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

  if (!result.success) {
    redirectToNewCollectionError(
      result
    )
  }

  const query =
    new URLSearchParams({
      status: 'success',
      message:
        'Collection created successfully.',
    })

  redirect(
    `/profile/creator/collections?${query.toString()}`
  )
}

/* =========================================================
 * Page loader
 * ======================================================= */

async function loadNewCollectionPageData(): Promise<{
  profile: ProfileRow
  nextSortOrder: number
} | null> {
  const supabase =
    await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error(
      '[new creator collection page] Authentication failed:',
      authError
    )

    return null
  }

  if (!user) {
    return null
  }

  const [
    profileResult,
    sortOrderResult,
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
      .select('sort_order')
      .eq('user_id', user.id)
      .order('sort_order', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle<CollectionSortOrderRow>(),
  ])

  if (profileResult.error) {
    console.error(
      '[new creator collection page] Profile query failed:',
      profileResult.error
    )

    throw new Error(
      'The creator profile could not be loaded.'
    )
  }

  if (!profileResult.data) {
    throw new Error(
      'The authenticated user has no profile row.'
    )
  }

  if (sortOrderResult.error) {
    console.error(
      '[new creator collection page] Sort-order query failed:',
      sortOrderResult.error
    )

    throw new Error(
      'The collection order could not be loaded.'
    )
  }

  const profile =
    normalizeProfileRow(
      profileResult.data,
      user.id
    )

  if (!profile) {
    throw new Error(
      'The creator profile data is invalid.'
    )
  }

  return {
    profile,

    nextSortOrder:
      getNextSortOrder(
        sortOrderResult.data
      ),
  }
}

/* =========================================================
 * Error redirects
 * ======================================================= */

function redirectToNewCollectionError(
  result: CollectionActionFailure
): never {
  const fieldMessage =
    getFirstFieldError(
      result.fieldErrors
    )

  const message =
    normalizeFeedbackMessage(
      fieldMessage
    ) ??
    normalizeFeedbackMessage(
      result.error
    ) ??
    'The collection could not be created.'

  const query =
    new URLSearchParams({
      error: message.slice(
        0,
        300
      ),
    })

  redirect(
    `/profile/creator/collections/new?${query.toString()}`
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

  const preferredOrder = [
    'title',
    'description',
    'cover_image_url',
    'city',
    'category',
    'visibility',
    'featured',
    'sort_order',
  ] as const

  for (const field of preferredOrder) {
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
 * Normalization
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

function getNextSortOrder(
  value:
    | CollectionSortOrderRow
    | null
    | undefined
): number {
  const currentSortOrder =
    value?.sort_order

  if (
    typeof currentSortOrder !==
      'number' ||
    !Number.isFinite(
      currentSortOrder
    )
  ) {
    return 0
  }

  const normalized =
    Math.max(
      0,
      Math.trunc(
        currentSortOrder
      )
    )

  if (
    normalized >=
    Number.MAX_SAFE_INTEGER
  ) {
    return Number.MAX_SAFE_INTEGER
  }

  return normalized + 1
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