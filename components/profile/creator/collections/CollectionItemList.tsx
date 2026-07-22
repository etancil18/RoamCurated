'use client'

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  CalendarDays,
  ExternalLink,
  FolderOpen,
  GripVertical,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Route,
  Trash2,
} from 'lucide-react'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CollectionItemType =
  | 'venue'
  | 'property'
  | 'flow'
  | 'snapshot'
  | 'custom'

export type CollectionItemListItem = {
  id: string
  collection_id: string
  item_type: CollectionItemType
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

export type CollectionItemMutationFailure = {
  success: false
  error: string
}

export type CollectionItemMutationSuccess = {
  success: true
}

export type CollectionItemMutationResult =
  | CollectionItemMutationSuccess
  | CollectionItemMutationFailure

export type CollectionItemRemoveInput = {
  collectionId: string
  collectionItemId: string
}

export type CollectionItemsReorderInput = {
  collectionId: string
  collectionItemIds: string[]
}

export type CollectionItemListProps = {
  /**
   * Collection that owns every supplied item.
   */
  collectionId: string

  /**
   * Owner-scoped collection-item projection loaded by the
   * server page.
   */
  initialItems:
    readonly CollectionItemListItem[]

  /**
   * Optional section title.
   */
  title?: string

  /**
   * Optional supporting description.
   */
  description?: string

  /**
   * Controls whether the section heading is rendered.
   */
  showHeading?: boolean

  /**
   * Controls whether management actions are displayed.
   *
   * Reorder and remove buttons are rendered only when their
   * respective action functions are also supplied.
   */
  editable?: boolean

  /**
   * Optional destination for adding collection items.
   *
   * Example:
   * `/profile/creator/collections/[collectionId]/items/new`
   */
  addItemHref?: string | null

  /**
   * Owner-scoped server action used to remove one item.
   */
  removeItemAction?: (
    input: CollectionItemRemoveInput
  ) => Promise<CollectionItemMutationResult>

  /**
   * Owner-scoped server action used to persist the complete
   * ordered list of collection-item IDs.
   */
  reorderItemsAction?: (
    input: CollectionItemsReorderInput
  ) => Promise<CollectionItemMutationResult>

  /**
   * Optional callback after a successful removal.
   */
  onItemRemoved?: (
    collectionItemId: string
  ) => void

  /**
   * Optional callback after a successful reorder.
   */
  onItemsReordered?: (
    collectionItemIds: string[]
  ) => void

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Internal state
 * ======================================================= */

type PendingOperationType =
  | 'remove'
  | 'reorder'

type PendingOperation =
  | {
      type: PendingOperationType
      itemId: string
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

export default function CollectionItemList({
  collectionId,
  initialItems,
  title = 'Collection items',
  description =
    'The places, properties, flows, snapshots, and custom recommendations included in this collection.',
  showHeading = true,
  editable = true,
  addItemHref,
  removeItemAction,
  reorderItemsAction,
  onItemRemoved,
  onItemsReordered,
  className = '',
}: CollectionItemListProps) {
  const normalizedCollectionId =
    normalizeIdentifier(collectionId)

  const normalizedInitialItems =
    useMemo(
      () =>
        normalizeCollectionItems({
          items: initialItems,
          collectionId:
            normalizedCollectionId,
        }),
      [
        initialItems,
        normalizedCollectionId,
      ]
    )

  const [
    items,
    setItems,
  ] = useState<
    CollectionItemListItem[]
  >(normalizedInitialItems)

  const [
    pendingOperation,
    setPendingOperation,
  ] = useState<PendingOperation>(null)

  const [
    feedback,
    setFeedback,
  ] = useState<Feedback>(null)

  const [
    isPending,
    startTransition,
  ] = useTransition()

  useEffect(() => {
    setItems(
      normalizedInitialItems
    )
  }, [normalizedInitialItems])

  const normalizedAddItemHref =
    normalizeInternalHref(
      addItemHref
    )

  const canRemove =
    editable &&
    typeof removeItemAction ===
      'function'

  const canReorder =
    editable &&
    typeof reorderItemsAction ===
      'function' &&
    items.length > 1

  const isBusy =
    isPending ||
    pendingOperation !== null

  function handleMove({
    itemId,
    direction,
  }: {
    itemId: string
    direction: 'up' | 'down'
  }) {
    if (
      !canReorder ||
      !normalizedCollectionId ||
      isBusy
    ) {
      return
    }

    const currentIndex =
      items.findIndex(
        (item) =>
          item.id === itemId
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
      targetIndex >= items.length
    ) {
      return
    }

    const previousItems = [
      ...items,
    ]

    const nextItems = [
      ...items,
    ]

    const [movedItem] =
      nextItems.splice(
        currentIndex,
        1
      )

    if (!movedItem) {
      return
    }

    nextItems.splice(
      targetIndex,
      0,
      movedItem
    )

    const normalizedNextItems =
      nextItems.map(
        (item, index) => ({
          ...item,
          sort_order: index,
        })
      )

    const collectionItemIds =
      normalizedNextItems.map(
        (item) => item.id
      )

    setFeedback(null)
    setItems(
      normalizedNextItems
    )

    setPendingOperation({
      type: 'reorder',
      itemId,
    })

    startTransition(() => {
      void reorderItemsAction({
        collectionId:
          normalizedCollectionId,
        collectionItemIds,
      })
        .then((result) => {
          if (!result.success) {
            setItems(
              previousItems
            )

            setFeedback({
              type: 'error',
              message:
                normalizeFeedbackMessage(
                  result.error
                ) ??
                'The collection-item order could not be saved.',
            })

            return
          }

          setFeedback({
            type: 'success',
            message:
              'Collection-item order updated.',
          })

          onItemsReordered?.(
            collectionItemIds
          )
        })
        .catch((error: unknown) => {
          console.error(
            '[CollectionItemList] Reorder failed:',
            error
          )

          setItems(previousItems)

          setFeedback({
            type: 'error',
            message:
              'The collection-item order could not be saved. Refresh the page and try again.',
          })
        })
        .finally(() => {
          setPendingOperation(null)
        })
    })
  }

  function handleRemove(
    item: CollectionItemListItem
  ) {
    if (
      !canRemove ||
      !normalizedCollectionId ||
      isBusy
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Remove "${item.title}" from this collection? The underlying ${getItemTypeLabel(
          item.item_type
        ).toLowerCase()} will not be deleted.`
      )

    if (!confirmed) {
      return
    }

    const previousItems = [
      ...items,
    ]

    const nextItems =
      items
        .filter(
          (candidate) =>
            candidate.id !==
            item.id
        )
        .map(
          (
            candidate,
            index
          ) => ({
            ...candidate,
            sort_order: index,
          })
        )

    setFeedback(null)
    setItems(nextItems)

    setPendingOperation({
      type: 'remove',
      itemId: item.id,
    })

    startTransition(() => {
      void removeItemAction({
        collectionId:
          normalizedCollectionId,
        collectionItemId:
          item.id,
      })
        .then((result) => {
          if (!result.success) {
            setItems(
              previousItems
            )

            setFeedback({
              type: 'error',
              message:
                normalizeFeedbackMessage(
                  result.error
                ) ??
                'The item could not be removed from the collection.',
            })

            return
          }

          setFeedback({
            type: 'success',
            message:
              'Item removed from the collection.',
          })

          onItemRemoved?.(
            item.id
          )
        })
        .catch((error: unknown) => {
          console.error(
            '[CollectionItemList] Removal failed:',
            error
          )

          setItems(previousItems)

          setFeedback({
            type: 'error',
            message:
              'The item could not be removed. Refresh the page and try again.',
          })
        })
        .finally(() => {
          setPendingOperation(null)
        })
    })
  }

  if (!normalizedCollectionId) {
    return (
      <InvalidCollectionState
        className={className}
      />
    )
  }

  return (
    <section
      aria-labelledby={
        showHeading
          ? 'creator-collection-items-title'
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
        <CollectionItemsHeading
          title={title}
          description={description}
          itemCount={items.length}
          addItemHref={
            editable
              ? normalizedAddItemHref
              : null
          }
        />
      ) : null}

      {feedback ? (
        <CollectionItemFeedback
          feedback={feedback}
          className={
            showHeading
              ? 'mt-4'
              : ''
          }
        />
      ) : null}

      {items.length === 0 ? (
        <CollectionItemsEmptyState
          addItemHref={
            editable
              ? normalizedAddItemHref
              : null
          }
          className={
            showHeading ||
            feedback
              ? 'mt-5'
              : ''
          }
        />
      ) : (
        <ol
          aria-label="Items in this creator collection"
          aria-busy={isBusy}
          className={[
            'space-y-3',
            showHeading ||
            feedback
              ? 'mt-5'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {items.map(
            (
              item,
              index
            ) => {
              const itemPending =
                pendingOperation
                  ?.itemId ===
                item.id

              return (
                <li
                  key={item.id}
                  className="min-w-0"
                >
                  <CollectionItemCard
                    item={item}
                    position={
                      index + 1
                    }
                    canMoveUp={
                      canReorder &&
                      index > 0
                    }
                    canMoveDown={
                      canReorder &&
                      index <
                        items.length -
                          1
                    }
                    canRemove={
                      canRemove
                    }
                    pending={
                      itemPending
                    }
                    pendingType={
                      itemPending
                        ? pendingOperation.type
                        : null
                    }
                    onMoveUp={() =>
                      handleMove({
                        itemId:
                          item.id,
                        direction:
                          'up',
                      })
                    }
                    onMoveDown={() =>
                      handleMove({
                        itemId:
                          item.id,
                        direction:
                          'down',
                      })
                    }
                    onRemove={() =>
                      handleRemove(
                        item
                      )
                    }
                  />
                </li>
              )
            }
          )}
        </ol>
      )}

      {!showHeading &&
      editable &&
      normalizedAddItemHref &&
      items.length > 0 ? (
        <div className="mt-5">
          <AddCollectionItemLink
            href={
              normalizedAddItemHref
            }
          />
        </div>
      ) : null}
    </section>
  )
}

/* =========================================================
 * Heading
 * ======================================================= */

function CollectionItemsHeading({
  title,
  description,
  itemCount,
  addItemHref,
}: {
  title: string
  description: string
  itemCount: number
  addItemHref: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
            <FolderOpen
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">
            Collection contents
          </p>
        </div>

        <h2
          id="creator-collection-items-title"
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
          <FolderOpen
            aria-hidden="true"
            className="h-3.5 w-3.5 text-indigo-400"
          />

          {itemCount.toLocaleString()}
        </span>

        {addItemHref ? (
          <AddCollectionItemLink
            href={addItemHref}
          />
        ) : null}
      </div>
    </div>
  )
}

function AddCollectionItemLink({
  href,
}: {
  href: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <Plus
        aria-hidden="true"
        className="h-4 w-4"
      />

      Add Item
    </Link>
  )
}

/* =========================================================
 * Item card
 * ======================================================= */

function CollectionItemCard({
  item,
  position,
  canMoveUp,
  canMoveDown,
  canRemove,
  pending,
  pendingType,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: CollectionItemListItem
  position: number
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  pending: boolean
  pendingType:
  | PendingOperationType
  | null
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
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

  return (
    <article
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-800/90 bg-neutral-950/75 transition',
        pending
          ? 'opacity-75'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {pending ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs font-semibold text-neutral-300 shadow-xl">
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin text-cyan-400"
            />

            {pendingType ===
            'remove'
              ? 'Removing item'
              : 'Saving order'}
          </span>
        </div>
      ) : null}

      <div className="grid min-w-0 sm:grid-cols-[132px_minmax(0,1fr)]">
        <CollectionItemImage
          item={item}
        />

        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ItemTypeBadge
                  itemType={
                    item.item_type
                  }
                />

                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-700">
                  <GripVertical
                    aria-hidden="true"
                    className="h-3 w-3"
                  />

                  Position {position}
                </span>
              </div>

              <h3 className="mt-3 break-words text-base font-semibold text-white">
                {item.title}
              </h3>

              {item.subtitle ? (
                <p className="mt-1 break-words text-xs font-medium text-neutral-400">
                  {item.subtitle}
                </p>
              ) : null}

              {item.description ? (
                <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-neutral-500">
                  {item.description}
                </p>
              ) : null}

              {item.city ? (
                <p className="mt-3 flex min-w-0 items-center gap-2 text-xs text-neutral-500">
                  <MapPin
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-cyan-400"
                  />

                  <span className="truncate">
                    {item.city}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {(internalHref ||
                externalHref) ? (
                internalHref ? (
                  <Link
                    href={
                      internalHref
                    }
                    aria-label={`Open ${item.title}`}
                    className={iconLinkClassName}
                  >
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </Link>
                ) : (
                  <a
                    href={
                      externalHref ??
                      undefined
                    }
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={`Open ${item.title} in a new tab`}
                    className={iconLinkClassName}
                  >
                    <ExternalLink
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </a>
                )
              ) : null}

              <ItemIconButton
                label="Move item up"
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
              </ItemIconButton>

              <ItemIconButton
                label="Move item down"
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
              </ItemIconButton>

              {canRemove ? (
                <ItemIconButton
                  label="Remove item from collection"
                  disabled={pending}
                  destructive
                  onClick={onRemove}
                >
                  <Trash2
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </ItemIconButton>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/* =========================================================
 * Item image
 * ======================================================= */

function CollectionItemImage({
  item,
}: {
  item: CollectionItemListItem
}) {
  return (
    <div className="relative min-h-32 overflow-hidden border-b border-neutral-800 bg-neutral-900 sm:min-h-full sm:border-b-0 sm:border-r">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          loading="lazy"
          className="h-full min-h-32 w-full object-cover sm:absolute sm:inset-0"
        />
      ) : (
        <div className="flex h-full min-h-32 w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_42%),#09090b]">
          <ItemTypeIcon
            itemType={
              item.item_type
            }
            className="h-7 w-7 text-indigo-300/60"
          />
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
      />
    </div>
  )
}

/* =========================================================
 * Item types
 * ======================================================= */

function ItemTypeBadge({
  itemType,
}: {
  itemType: CollectionItemType
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
      <ItemTypeIcon
        itemType={itemType}
        className="h-3 w-3 text-indigo-300"
      />

      {getItemTypeLabel(
        itemType
      )}
    </span>
  )
}

function ItemTypeIcon({
  itemType,
  className,
}: {
  itemType: CollectionItemType
  className: string
}) {
  switch (itemType) {
    case 'venue':
      return (
        <Building2
          aria-hidden="true"
          className={className}
        />
      )

    case 'property':
      return (
        <MapPin
          aria-hidden="true"
          className={className}
        />
      )

    case 'flow':
      return (
        <Route
          aria-hidden="true"
          className={className}
        />
      )

    case 'snapshot':
      return (
        <ImageIcon
          aria-hidden="true"
          className={className}
        />
      )

    case 'custom':
      return (
        <CalendarDays
          aria-hidden="true"
          className={className}
        />
      )
  }
}

function getItemTypeLabel(
  itemType: CollectionItemType
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
      return 'Custom'
  }
}

/* =========================================================
 * Buttons
 * ======================================================= */

function ItemIconButton({
  label,
  disabled,
  destructive = false,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  destructive?: boolean
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
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-full border bg-black/30 transition',
        destructive
          ? 'border-red-900/60 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200'
          : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white',
        'disabled:cursor-not-allowed disabled:opacity-30',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

const iconLinkClassName = [
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-black/30 text-neutral-400 transition',
  'hover:border-indigo-500/40 hover:text-indigo-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50',
].join(' ')

/* =========================================================
 * Feedback and empty states
 * ======================================================= */

function CollectionItemFeedback({
  feedback,
  className = '',
}: {
  feedback: Exclude<
    Feedback,
    null
  >
  className?: string
}) {
  const isError =
    feedback.type === 'error'

  return (
    <div
      role={
        isError
          ? 'alert'
          : 'status'
      }
      className={[
        'rounded-2xl border px-4 py-3',
        isError
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
          isError
            ? 'text-red-200'
            : 'text-emerald-200',
        ].join(' ')}
      >
        {isError
          ? 'Collection item change failed'
          : 'Collection items updated'}
      </p>

      <p
        className={[
          'mt-1 break-words text-xs leading-5',
          isError
            ? 'text-red-300/80'
            : 'text-emerald-300/80',
        ].join(' ')}
      >
        {feedback.message}
      </p>
    </div>
  )
}

function CollectionItemsEmptyState({
  addItemHref,
  className = '',
}: {
  addItemHref: string | null
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
        <FolderOpen
          aria-hidden="true"
          className="h-5 w-5"
        />
      </span>

      <h3 className="mt-4 text-lg font-semibold text-white">
        This collection is empty
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Add focused places, properties,
        flows, snapshots, or custom
        recommendations that support the
        collection’s theme.
      </p>

      {addItemHref ? (
        <Link
          href={addItemHref}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-indigo-300"
        >
          <Plus
            aria-hidden="true"
            className="h-4 w-4"
          />

          Add First Item
        </Link>
      ) : null}
    </div>
  )
}

function InvalidCollectionState({
  className,
}: {
  className: string
}) {
  return (
    <section
      role="alert"
      className={[
        'w-full min-w-0 rounded-[1.75rem] border border-red-500/30 bg-red-500/10 p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="text-base font-semibold text-red-100">
        Collection identifier missing
      </h2>

      <p className="mt-2 text-sm leading-6 text-red-200/75">
        Collection items cannot be managed
        without a valid parent collection
        identifier.
      </p>
    </section>
  )
}

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizeCollectionItems({
  items,
  collectionId,
}: {
  items:
    readonly CollectionItemListItem[]
  collectionId: string | null
}): CollectionItemListItem[] {
  if (!collectionId) {
    return []
  }

  const byId =
    new Map<
      string,
      CollectionItemListItem
    >()

  for (const item of items) {
    const normalizedItem =
      normalizeCollectionItem({
        item,
        collectionId,
      })

    if (!normalizedItem) {
      continue
    }

    const existing =
      byId.get(
        normalizedItem.id
      )

    if (
      existing &&
      compareCollectionItems(
        existing,
        normalizedItem
      ) <= 0
    ) {
      continue
    }

    byId.set(
      normalizedItem.id,
      normalizedItem
    )
  }

  return [...byId.values()]
    .sort(compareCollectionItems)
    .map((item, index) => ({
      ...item,
      sort_order: index,
    }))
}

function normalizeCollectionItem({
  item,
  collectionId,
}: {
  item: CollectionItemListItem
  collectionId: string
}): CollectionItemListItem | null {
  if (
    !item ||
    typeof item !== 'object'
  ) {
    return null
  }

  const id =
    normalizeIdentifier(
      item.id
    )

  const normalizedCollectionId =
    normalizeIdentifier(
      item.collection_id
    )

  const title =
    normalizeRequiredText(
      item.title,
      240
    )

  const createdAt =
    normalizeIsoDate(
      item.created_at
    )

  if (
    !id ||
    normalizedCollectionId !==
      collectionId ||
    !title ||
    !createdAt ||
    !isCollectionItemType(
      item.item_type
    )
  ) {
    return null
  }

  return {
    id,
    collection_id:
      normalizedCollectionId,

    item_type:
      item.item_type,

    item_id:
      normalizeIdentifier(
        item.item_id
      ),

    title,

    subtitle:
      normalizeOptionalText(
        item.subtitle,
        240
      ),

    description:
      normalizeOptionalText(
        item.description,
        1_000
      ),

    image_url:
      normalizePublicImageUrl(
        item.image_url
      ),

    href:
      normalizeItemHref(
        item.href
      ),

    city:
      normalizeOptionalText(
        item.city,
        160
      ),

    sort_order:
      normalizeSortOrder(
        item.sort_order
      ),

    created_at:
      createdAt,

    updated_at:
      normalizeIsoDate(
        item.updated_at
      ),
  }
}

function compareCollectionItems(
  first: CollectionItemListItem,
  second: CollectionItemListItem
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
 * Primitive helpers
 * ======================================================= */

function isCollectionItemType(
  value: unknown
): value is CollectionItemType {
  return (
    value === 'venue' ||
    value === 'property' ||
    value === 'flow' ||
    value === 'snapshot' ||
    value === 'custom'
  )
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
    normalized.length > 200
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

  if (!normalized) {
    return null
  }

  return normalized.slice(
    0,
    maximumLength
  )
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

function normalizePublicImageUrl(
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

function normalizeItemHref(
  value: unknown
): string | null {
  return (
    normalizeInternalHref(
      value
    ) ??
    normalizeExternalHref(
      value
    )
  )
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

    return parsed.toString()
  } catch {
    return null
  }
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