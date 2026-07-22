'use client'

import {
  startTransition,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  FolderHeart,
  GripVertical,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'

import {
  deleteCreatorCollectionAction,
  reorderCreatorCollectionsAction,
  setCreatorCollectionFeaturedAction,
  setCreatorCollectionVisibilityAction,
} from '@/app/profile/creator/collections/actions'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CollectionListItem = {
  id: string
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

export type CollectionListProps = {
  /**
   * Owner-scoped creator collections.
   *
   * Collections should already be loaded and authorized by the
   * server page before being passed into this client component.
   */
  initialCollections: readonly CollectionListItem[]

  /**
   * Public profile username without the leading `@`.
   *
   * Public preview links are omitted when no username exists.
   */
  username?: string | null

  /**
   * Optional heading.
   */
  title?: string

  /**
   * Optional supporting copy.
   */
  description?: string

  /**
   * Controls whether the list heading is rendered.
   */
  showHeading?: boolean

  /**
   * Controls whether the empty state exposes a create link.
   */
  showCreateAction?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Optimistic state
 * ======================================================= */

type OptimisticAction =
  | {
      type: 'replace'
      collections: CollectionListItem[]
    }
  | {
      type: 'remove'
      collectionId: string
    }
  | {
      type: 'visibility'
      collectionId: string
      visibility: 'public' | 'private'
    }
  | {
      type: 'featured'
      collectionId: string
      featured: boolean
    }
  | {
      type: 'reorder'
      collectionIds: string[]
    }

type PendingOperationType =
  | 'delete'
  | 'visibility'
  | 'featured'
  | 'reorder'

type PendingOperation =
  | {
      type: PendingOperationType
      collectionId: string
    }
  | null

type Feedback =
  | {
      type: 'success' | 'error'
      message: string
    }
  | null

/* =========================================================
 * Main component
 * ======================================================= */

export default function CollectionList({
  initialCollections,
  username,
  title = 'Your collections',
  description =
    'Create, publish, feature, and order the collections shown across your creator profile.',
  showHeading = true,
  showCreateAction = true,
  className = '',
}: CollectionListProps) {
  const normalizedInitialCollections =
    useMemo(
      () =>
        normalizeCollections(
          initialCollections
        ),
      [initialCollections]
    )

  const [
    optimisticCollections,
    applyOptimisticAction,
  ] = useOptimistic(
    normalizedInitialCollections,
    optimisticReducer
  )

  const [
    isTransitionPending,
    startActionTransition,
  ] = useTransition()

  const [
    pendingOperation,
    setPendingOperation,
  ] = useState<PendingOperation>(null)

  const [
    feedback,
    setFeedback,
  ] = useState<Feedback>(null)

  const normalizedUsername =
    normalizeUsername(username)

  const orderedCollections =
    useMemo(
      () =>
        [...optimisticCollections].sort(
          compareCollections
        ),
      [optimisticCollections]
    )

  const collectionIds =
    useMemo(
      () =>
        orderedCollections.map(
          (collection) =>
            collection.id
        ),
      [orderedCollections]
    )

  function runAction({
    operation,
    optimisticAction,
    action,
    successMessage,
  }: {
    operation: Exclude<
      PendingOperation,
      null
    >
    optimisticAction: OptimisticAction
    action: () => Promise<
      | {
          success: true
        }
      | {
          success: false
          error: string
        }
    >
    successMessage: string
  }) {
    setFeedback(null)
    setPendingOperation(operation)

    startActionTransition(() => {
      applyOptimisticAction(
        optimisticAction
      )

      void action()
        .then((result) => {
          if (!result.success) {
            applyOptimisticAction({
              type: 'replace',
              collections:
                normalizedInitialCollections,
            })

            setFeedback({
              type: 'error',
              message:
                normalizeFeedbackMessage(
                  result.error
                ) ??
                'The collection change could not be saved.',
            })

            return
          }

          setFeedback({
            type: 'success',
            message: successMessage,
          })
        })
        .catch((error: unknown) => {
          console.error(
            '[CollectionList] Collection action failed:',
            error
          )

          applyOptimisticAction({
            type: 'replace',
            collections:
              normalizedInitialCollections,
          })

          setFeedback({
            type: 'error',
            message:
              'The collection change could not be saved. Refresh the page and try again.',
          })
        })
        .finally(() => {
          setPendingOperation(null)
        })
    })
  }

  function handleVisibilityToggle(
    collection: CollectionListItem
  ) {
    const visibility =
      collection.visibility ===
      'public'
        ? 'private'
        : 'public'

    runAction({
      operation: {
        type: 'visibility',
        collectionId:
          collection.id,
      },

      optimisticAction: {
        type: 'visibility',
        collectionId:
          collection.id,
        visibility,
      },

      action: () =>
        setCreatorCollectionVisibilityAction(
          {
            collectionId:
              collection.id,
            visibility,
          }
        ),

      successMessage:
        visibility === 'public'
          ? 'Collection published.'
          : 'Collection made private.',
    })
  }

  function handleFeaturedToggle(
    collection: CollectionListItem
  ) {
    const featured =
      !collection.featured

    runAction({
      operation: {
        type: 'featured',
        collectionId:
          collection.id,
      },

      optimisticAction: {
        type: 'featured',
        collectionId:
          collection.id,
        featured,
      },

      action: () =>
        setCreatorCollectionFeaturedAction(
          {
            collectionId:
              collection.id,
            featured,
          }
        ),

      successMessage: featured
        ? 'Collection featured.'
        : 'Collection removed from featured placement.',
    })
  }

  function handleDelete(
    collection: CollectionListItem
  ) {
    const confirmed =
      window.confirm(
        `Delete "${collection.title}" permanently? This action cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    runAction({
      operation: {
        type: 'delete',
        collectionId:
          collection.id,
      },

      optimisticAction: {
        type: 'remove',
        collectionId:
          collection.id,
      },

      action: () =>
        deleteCreatorCollectionAction(
          {
            collectionId:
              collection.id,
          }
        ),

      successMessage:
        'Collection deleted.',
    })
  }

  function handleMove(
    collectionId: string,
    direction: 'up' | 'down'
  ) {
    const currentIndex =
      collectionIds.indexOf(
        collectionId
      )

    if (currentIndex < 0) {
      return
    }

    const targetIndex =
      direction === 'up'
        ? currentIndex - 1
        : currentIndex + 1

    if (
      targetIndex < 0 ||
      targetIndex >=
        collectionIds.length
    ) {
      return
    }

    const nextIds = [
      ...collectionIds,
    ]

    const [
      movedCollectionId,
    ] = nextIds.splice(
      currentIndex,
      1
    )

    if (!movedCollectionId) {
      return
    }

    nextIds.splice(
      targetIndex,
      0,
      movedCollectionId
    )

    runAction({
      operation: {
        type: 'reorder',
        collectionId,
      },

      optimisticAction: {
        type: 'reorder',
        collectionIds: nextIds,
      },

      action: () =>
        reorderCreatorCollectionsAction(
          {
            collectionIds:
              nextIds,
          }
        ),

      successMessage:
        'Collection order updated.',
    })
  }

  const isBusy =
    isTransitionPending ||
    pendingOperation !== null

  if (
    orderedCollections.length === 0
  ) {
    return (
      <section
        className={[
          'w-full min-w-0',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {showHeading ? (
          <CollectionListHeading
            title={title}
            description={description}
            collectionCount={0}
            showCreateAction={
              showCreateAction
            }
          />
        ) : null}

        <CollectionEmptyState
          showCreateAction={
            showCreateAction
          }
          className={
            showHeading ? 'mt-5' : ''
          }
        />
      </section>
    )
  }

  return (
    <section
      aria-labelledby={
        showHeading
          ? 'creator-collection-list-title'
          : undefined
      }
      className={[
        'w-full min-w-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showHeading ? (
        <CollectionListHeading
          title={title}
          description={description}
          collectionCount={
            orderedCollections.length
          }
          showCreateAction={
            showCreateAction
          }
        />
      ) : null}

      {feedback ? (
        <CollectionFeedback
          feedback={feedback}
          className={
            showHeading ? 'mt-4' : ''
          }
        />
      ) : null}

      <ul
        aria-label="Creator collections"
        aria-busy={isBusy}
        className={[
          'space-y-4',
          showHeading || feedback
            ? 'mt-5'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {orderedCollections.map(
          (
            collection,
            index
          ) => {
            const operationPending =
              pendingOperation
                ?.collectionId ===
              collection.id

            return (
              <li
                key={collection.id}
                className="min-w-0"
              >
                <CollectionCard
                  collection={
                    collection
                  }
                  username={
                    normalizedUsername
                  }
                  position={
                    index + 1
                  }
                  canMoveUp={
                    index > 0
                  }
                  canMoveDown={
                    index <
                    orderedCollections.length -
                      1
                  }
                  pending={
                    operationPending
                  }
                  pendingType={
                    operationPending
                      ? pendingOperation.type
                      : null
                  }
                  onMoveUp={() =>
                    handleMove(
                      collection.id,
                      'up'
                    )
                  }
                  onMoveDown={() =>
                    handleMove(
                      collection.id,
                      'down'
                    )
                  }
                  onVisibilityToggle={() =>
                    handleVisibilityToggle(
                      collection
                    )
                  }
                  onFeaturedToggle={() =>
                    handleFeaturedToggle(
                      collection
                    )
                  }
                  onDelete={() =>
                    handleDelete(
                      collection
                    )
                  }
                />
              </li>
            )
          }
        )}
      </ul>
    </section>
  )
}

/* =========================================================
 * Heading
 * ======================================================= */

function CollectionListHeading({
  title,
  description,
  collectionCount,
  showCreateAction,
}: {
  title: string
  description: string
  collectionCount: number
  showCreateAction: boolean
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
            Creator library
          </p>
        </div>

        <h2
          id="creator-collection-list-title"
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
        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-xs font-semibold text-neutral-400">
          <FolderHeart
            aria-hidden="true"
            className="h-3.5 w-3.5 text-indigo-400"
          />

          {collectionCount.toLocaleString()}
        </span>

        {showCreateAction ? (
          <Link
            href="/profile/creator/collections/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Plus
              aria-hidden="true"
              className="h-4 w-4"
            />

            New Collection
          </Link>
        ) : null}
      </div>
    </div>
  )
}

/* =========================================================
 * Collection card
 * ======================================================= */

function CollectionCard({
  collection,
  username,
  position,
  canMoveUp,
  canMoveDown,
  pending,
  pendingType,
  onMoveUp,
  onMoveDown,
  onVisibilityToggle,
  onFeaturedToggle,
  onDelete,
}: {
  collection: CollectionListItem
  username: string | null
  position: number
  canMoveUp: boolean
  canMoveDown: boolean
  pending: boolean
  pendingType:
    | PendingOperationType
    | null
  onMoveUp: () => void
  onMoveDown: () => void
  onVisibilityToggle: () => void
  onFeaturedToggle: () => void
  onDelete: () => void
}) {
  const publicHref =
    username &&
    collection.visibility ===
      'public'
      ? `/u/${encodeURIComponent(
          username
        )}/collections/${encodeURIComponent(
          collection.slug
        )}`
      : null

  const editHref =
    `/profile/creator/collections/${encodeURIComponent(
      collection.id
    )}`

  return (
    <article
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border bg-neutral-950/75 transition',
        collection.featured
          ? 'border-indigo-500/30'
          : 'border-neutral-800/90',
        pending
          ? 'opacity-75'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {pending ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs font-semibold text-neutral-300 shadow-xl">
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin text-cyan-400"
            />

            {getPendingLabel(
              pendingType
            )}
          </span>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
        <CollectionCover
          collection={collection}
        />

        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 flex-col gap-4 border-b border-neutral-800/80 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <VisibilityBadge
                  visibility={
                    collection.visibility
                  }
                />

                {collection.featured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300">
                    <Sparkles
                      aria-hidden="true"
                      className="h-3 w-3"
                    />

                    Featured
                  </span>
                ) : null}

                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-700">
                  <GripVertical
                    aria-hidden="true"
                    className="h-3 w-3"
                  />

                  Position {position}
                </span>
              </div>

              <h3 className="mt-3 break-words text-lg font-semibold text-white">
                {collection.title}
              </h3>

              <p className="mt-1 break-all text-xs text-neutral-600">
                /{collection.slug}
              </p>

              {collection.description ? (
                <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-neutral-400">
                  {
                    collection.description
                  }
                </p>
              ) : null}

              <CollectionMetadata
                collection={
                  collection
                }
              />
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <IconButton
                label="Move collection up"
                disabled={
                  !canMoveUp ||
                  pending
                }
                onClick={onMoveUp}
              >
                <ArrowUp
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </IconButton>

              <IconButton
                label="Move collection down"
                disabled={
                  !canMoveDown ||
                  pending
                }
                onClick={onMoveDown}
              >
                <ArrowDown
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </IconButton>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
            <Link
              href={editHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <Pencil
                aria-hidden="true"
                className="h-4 w-4"
              />

              Edit
            </Link>

            <button
              type="button"
              disabled={pending}
              onClick={
                onVisibilityToggle
              }
              className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-700 bg-black/30 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-cyan-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {collection.visibility ===
              'public' ? (
                <>
                  <EyeOff
                    aria-hidden="true"
                    className="h-4 w-4"
                  />

                  Make Private
                </>
              ) : (
                <>
                  <Eye
                    aria-hidden="true"
                    className="h-4 w-4"
                  />

                  Publish
                </>
              )}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={
                onFeaturedToggle
              }
              className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/[0.06] px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-400/60 hover:bg-indigo-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Star
                aria-hidden="true"
                className={[
                  'h-4 w-4',
                  collection.featured
                    ? 'fill-current'
                    : '',
                ].join(' ')}
              />

              {collection.featured
                ? 'Unfeature'
                : 'Feature'}
            </button>

            {publicHref ? (
              <Link
                href={publicHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-700 bg-black/30 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-indigo-500/40 hover:text-white"
              >
                Preview

                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Link>
            ) : null}

            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-red-900/60 bg-red-950/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
            >
              <Trash2
                aria-hidden="true"
                className="h-4 w-4"
              />

              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

/* =========================================================
 * Cover
 * ======================================================= */

function CollectionCover({
  collection,
}: {
  collection: CollectionListItem
}) {
  return (
    <div className="relative min-h-44 overflow-hidden border-b border-neutral-800 bg-neutral-900 sm:min-h-full sm:border-b-0 sm:border-r">
      {collection.cover_image_url ? (
        <img
          src={
            collection.cover_image_url
          }
          alt=""
          loading="lazy"
          className="h-full min-h-44 w-full object-cover sm:absolute sm:inset-0"
        />
      ) : (
        <div className="flex h-full min-h-44 w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.25),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_42%),#09090b]">
          <div className="text-center">
            <FolderHeart
              aria-hidden="true"
              className="mx-auto h-8 w-8 text-indigo-300/60"
            />

            <p className="mt-3 text-xs font-medium text-neutral-600">
              No cover image
            </p>
          </div>
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
      />
    </div>
  )
}

/* =========================================================
 * Metadata
 * ======================================================= */

function CollectionMetadata({
  collection,
}: {
  collection: CollectionListItem
}) {
  if (
    !collection.city &&
    !collection.category
  ) {
    return null
  }

  return (
    <div className="mt-4 flex min-w-0 flex-wrap gap-2">
      {collection.city ? (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-800 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-500">
          <MapPin
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-cyan-400"
          />

          <span className="truncate">
            {collection.city}
          </span>
        </span>
      ) : null}

      {collection.category ? (
        <span className="inline-flex max-w-full items-center rounded-full border border-neutral-800 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-500">
          <span className="truncate">
            {collection.category}
          </span>
        </span>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Badges and buttons
 * ======================================================= */

function VisibilityBadge({
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
        isPublic
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-400',
      ].join(' ')}
    >
      {isPublic ? (
        <Eye
          aria-hidden="true"
          className="h-3 w-3"
        />
      ) : (
        <Lock
          aria-hidden="true"
          className="h-3 w-3"
        />
      )}

      {isPublic
        ? 'Public'
        : 'Private'}
    </span>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-black/30 text-neutral-400 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/* =========================================================
 * Feedback and empty state
 * ======================================================= */

function CollectionFeedback({
  feedback,
  className = '',
}: {
  feedback: Exclude<
    Feedback,
    null
  >
  className?: string
}) {
  return (
    <div
      role={
        feedback.type === 'error'
          ? 'alert'
          : 'status'
      }
      className={[
        'rounded-2xl border px-4 py-3',
        feedback.type === 'error'
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-emerald-500/30 bg-emerald-500/10',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p
        className={[
          'text-sm font-semibold',
          feedback.type === 'error'
            ? 'text-red-200'
            : 'text-emerald-200',
        ].join(' ')}
      >
        {feedback.type === 'error'
          ? 'Collection change failed'
          : 'Collection updated'}
      </p>

      <p
        className={[
          'mt-1 break-words text-xs leading-5',
          feedback.type === 'error'
            ? 'text-red-300/80'
            : 'text-emerald-300/80',
        ].join(' ')}
      >
        {feedback.message}
      </p>
    </div>
  )
}

function CollectionEmptyState({
  showCreateAction,
  className = '',
}: {
  showCreateAction: boolean
  className?: string
}) {
  return (
    <div
      className={[
        'rounded-[1.75rem] border border-dashed border-neutral-800 bg-neutral-950/50 px-5 py-12 text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-indigo-300">
        <FolderHeart
          aria-hidden="true"
          className="h-5 w-5"
        />
      </span>

      <h3 className="mt-4 text-lg font-semibold text-white">
        No creator collections yet
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Build a focused collection of
        places, routes, properties, or
        recommendations that demonstrates
        your local point of view.
      </p>

      {showCreateAction ? (
        <Link
          href="/profile/creator/collections/new"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-indigo-300"
        >
          <Plus
            aria-hidden="true"
            className="h-4 w-4"
          />

          Create First Collection
        </Link>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Optimistic reducer
 * ======================================================= */

function optimisticReducer(
  currentCollections:
    CollectionListItem[],
  action: OptimisticAction
): CollectionListItem[] {
  switch (action.type) {
    case 'replace':
      return normalizeCollections(
        action.collections
      )

    case 'remove':
      return currentCollections.filter(
        (collection) =>
          collection.id !==
          action.collectionId
      )

    case 'visibility':
      return currentCollections.map(
        (collection) =>
          collection.id ===
          action.collectionId
            ? {
                ...collection,
                visibility:
                  action.visibility,
                updated_at:
                  new Date().toISOString(),
              }
            : collection
      )

    case 'featured':
      return currentCollections.map(
        (collection) =>
          collection.id ===
          action.collectionId
            ? {
                ...collection,
                featured:
                  action.featured,
                updated_at:
                  new Date().toISOString(),
              }
            : collection
      )

    case 'reorder': {
      const positionById =
        new Map(
          action.collectionIds.map(
            (
              collectionId,
              index
            ) => [
              collectionId,
              index,
            ]
          )
        )

      return currentCollections
        .map((collection) => {
          const nextSortOrder =
            positionById.get(
              collection.id
            )

          if (
            nextSortOrder ===
            undefined
          ) {
            return collection
          }

          return {
            ...collection,
            sort_order:
              nextSortOrder,
            updated_at:
              new Date().toISOString(),
          }
        })
        .sort(compareCollections)
    }
  }
}

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizeCollections(
  value:
    readonly CollectionListItem[]
): CollectionListItem[] {
  const byId = new Map<
    string,
    CollectionListItem
  >()

  for (const collection of value) {
    const normalized =
      normalizeCollection(
        collection
      )

    if (!normalized) {
      continue
    }

    byId.set(
      normalized.id,
      normalized
    )
  }

  return [...byId.values()].sort(
    compareCollections
  )
}

function normalizeCollection(
  value: CollectionListItem
): CollectionListItem | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  const id =
    normalizeRequiredText(
      value.id
    )

  const title =
    normalizeRequiredText(
      value.title
    )

  const slug =
    normalizeSlug(value.slug)

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
    title,
    slug,

    description:
      normalizeNullableText(
        value.description
      ),

    cover_image_url:
      normalizePublicImageUrl(
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
      normalizeSortOrder(
        value.sort_order
      ),

    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function compareCollections(
  first: CollectionListItem,
  second: CollectionListItem
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
    Date.parse(first.created_at) -
    Date.parse(second.created_at)

  if (
    createdAtComparison !== 0
  ) {
    return createdAtComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

function normalizeUsername(
  value:
    | string
    | null
    | undefined
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

function normalizeSlug(
  value: unknown
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

function normalizeSortOrder(
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

function normalizePublicImageUrl(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

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
      !parsed.hostname
    ) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
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

function getPendingLabel(
  pendingType:
    | PendingOperationType
    | null
): string {
  switch (pendingType) {
    case 'delete':
      return 'Deleting'

    case 'visibility':
      return 'Updating visibility'

    case 'featured':
      return 'Updating placement'

    case 'reorder':
      return 'Saving order'

    default:
      return 'Saving'
  }
}