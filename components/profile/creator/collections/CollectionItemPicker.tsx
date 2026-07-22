'use client'

import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
} from 'react'
import type {
  ChangeEvent,
  ReactNode,
} from 'react'
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  Route,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CollectionItemPickerType =
  | 'venue'
  | 'property'
  | 'flow'
  | 'snapshot'
  | 'custom'

export type CollectionItemPickerCandidate = {
  /**
   * Stable identifier for the underlying source record.
   */
  id: string

  /**
   * Source type persisted with the collection item.
   */
  item_type: CollectionItemPickerType

  /**
   * Primary display title.
   */
  title: string

  /**
   * Optional supporting label.
   */
  subtitle?: string | null

  /**
   * Optional description.
   */
  description?: string | null

  /**
   * Optional public image URL.
   */
  image_url?: string | null

  /**
   * Optional city or location label.
   */
  city?: string | null

  /**
   * Optional internal or public destination.
   */
  href?: string | null

  /**
   * Optional search aliases not displayed in the UI.
   */
  search_terms?: readonly string[] | null

  /**
   * Optional source timestamp used for deterministic sorting.
   */
  created_at?: string | null
}

export type AddCollectionItemsInput = {
  collectionId: string

  items: Array<{
    itemType: CollectionItemPickerType
    itemId: string
  }>
}

export type AddCollectionItemsSuccess = {
  success: true

  /**
   * IDs of source items successfully added.
   */
  addedItemIds?: string[]
}

export type AddCollectionItemsFailure = {
  success: false
  error: string

  /**
   * Optional source IDs rejected by the server.
   */
  rejectedItemIds?: string[]
}

export type AddCollectionItemsResult =
  | AddCollectionItemsSuccess
  | AddCollectionItemsFailure

export type CollectionItemPickerProps = {
  /**
   * Parent collection receiving the selected items.
   */
  collectionId: string

  /**
   * Server-authorized candidate projection.
   */
  candidates:
    readonly CollectionItemPickerCandidate[]

  /**
   * Source IDs already present in the collection.
   *
   * These candidates remain visible but cannot be selected.
   */
  existingItemIds?: readonly string[]

  /**
   * Owner-scoped server action that performs final validation
   * and persistence.
   */
  addItemsAction: (
    input: AddCollectionItemsInput
  ) => Promise<AddCollectionItemsResult>

  /**
   * Optional picker heading.
   */
  title?: string

  /**
   * Optional supporting copy.
   */
  description?: string

  /**
   * Optional initial type filter.
   */
  initialType?:
    | CollectionItemPickerType
    | 'all'

  /**
   * Maximum number of items selectable in one submission.
   */
  selectionLimit?: number

  /**
   * Called after a successful addition.
   */
  onItemsAdded?: (
    addedItemIds: string[]
  ) => void

  /**
   * Optional cancel callback.
   */
  onCancel?: () => void

  /**
   * Optional submit-label override.
   */
  submitLabel?: string

  /**
   * Disables all picker interactions.
   */
  disabled?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Internal contracts
 * ======================================================= */

type Feedback =
  | {
      type: 'success' | 'error'
      message: string
    }
  | null

const DEFAULT_SELECTION_LIMIT = 25

const TYPE_OPTIONS: Array<{
  value:
    | CollectionItemPickerType
    | 'all'
  label: string
}> = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'venue',
    label: 'Venues',
  },
  {
    value: 'property',
    label: 'Properties',
  },
  {
    value: 'flow',
    label: 'Flows',
  },
  {
    value: 'snapshot',
    label: 'Snapshots',
  },
  {
    value: 'custom',
    label: 'Custom',
  },
]

/* =========================================================
 * Main component
 * ======================================================= */

export default function CollectionItemPicker({
  collectionId,
  candidates,
  existingItemIds = [],
  addItemsAction,
  title = 'Add collection items',
  description =
    'Search the available places, properties, flows, snapshots, and recommendations, then add the strongest matches to this collection.',
  initialType = 'all',
  selectionLimit =
    DEFAULT_SELECTION_LIMIT,
  onItemsAdded,
  onCancel,
  submitLabel = 'Add Selected Items',
  disabled = false,
  className = '',
}: CollectionItemPickerProps) {
  const normalizedCollectionId =
    normalizeIdentifier(collectionId)

  const normalizedSelectionLimit =
    normalizeSelectionLimit(
      selectionLimit
    )

  const normalizedCandidates =
    useMemo(
      () =>
        normalizeCandidates(
          candidates
        ),
      [candidates]
    )

  const existingIds =
    useMemo(
      () =>
        new Set(
          existingItemIds
            .map(normalizeIdentifier)
            .filter(
              (
                value
              ): value is string =>
                value !== null
            )
        ),
      [existingItemIds]
    )

  const [
    query,
    setQuery,
  ] = useState('')

  const deferredQuery =
    useDeferredValue(query)

  const [
    activeType,
    setActiveType,
  ] = useState<
    | CollectionItemPickerType
    | 'all'
  >(
    isPickerFilterType(
      initialType
    )
      ? initialType
      : 'all'
  )

  const [
    selectedIds,
    setSelectedIds,
  ] = useState<Set<string>>(
    () => new Set()
  )

  const [
    feedback,
    setFeedback,
  ] = useState<Feedback>(null)

  const [
    isPending,
    startTransition,
  ] = useTransition()

  const filteredCandidates =
    useMemo(
      () =>
        filterCandidates({
          candidates:
            normalizedCandidates,
          query:
            deferredQuery,
          activeType,
        }),
      [
        normalizedCandidates,
        deferredQuery,
        activeType,
      ]
    )

  const selectedCandidates =
    useMemo(
      () =>
        normalizedCandidates.filter(
          (candidate) =>
            selectedIds.has(
              candidate.id
            ) &&
            !existingIds.has(
              candidate.id
            )
        ),
      [
        normalizedCandidates,
        selectedIds,
        existingIds,
      ]
    )

  const isBusy =
    disabled || isPending

  const selectionCount =
    selectedCandidates.length

  const selectionLimitReached =
    selectionCount >=
    normalizedSelectionLimit

  function handleQueryChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setQuery(event.target.value)

    if (
      feedback?.type === 'error'
    ) {
      setFeedback(null)
    }
  }

  function toggleCandidate(
    candidateId: string
  ) {
    if (
      isBusy ||
      existingIds.has(candidateId)
    ) {
      return
    }

    setFeedback(null)

    setSelectedIds(
      (current) => {
        const next =
          new Set(current)

        if (
          next.has(candidateId)
        ) {
          next.delete(candidateId)

          return next
        }

        if (
          next.size >=
          normalizedSelectionLimit
        ) {
          setFeedback({
            type: 'error',
            message: `You can add at most ${normalizedSelectionLimit} items at once.`,
          })

          return current
        }

        next.add(candidateId)

        return next
      }
    )
  }

  function clearSelection() {
    if (isBusy) {
      return
    }

    setSelectedIds(new Set())
    setFeedback(null)
  }

  function handleSubmit() {
    if (
      isBusy ||
      !normalizedCollectionId
    ) {
      return
    }

    if (
      selectedCandidates.length ===
      0
    ) {
      setFeedback({
        type: 'error',
        message:
          'Select at least one item before submitting.',
      })

      return
    }

    const submittedIds =
      selectedCandidates.map(
        (candidate) =>
          candidate.id
      )

    setFeedback(null)

    startTransition(() => {
      void addItemsAction({
        collectionId:
          normalizedCollectionId,

        items:
          selectedCandidates.map(
            (candidate) => ({
              itemType:
                candidate.item_type,
              itemId:
                candidate.id,
            })
          ),
      })
        .then((result) => {
          if (!result.success) {
            const rejectedIds =
              normalizeIdentifierList(
                result.rejectedItemIds
              )

            if (
              rejectedIds.length >
              0
            ) {
              setSelectedIds(
                new Set(
                  rejectedIds
                )
              )
            }

            setFeedback({
              type: 'error',
              message:
                normalizeFeedbackMessage(
                  result.error
                ) ??
                'The selected items could not be added.',
            })

            return
          }

          const addedItemIds =
            normalizeIdentifierList(
              result.addedItemIds
            )

          const resolvedAddedIds =
            addedItemIds.length > 0
              ? addedItemIds
              : submittedIds

          setSelectedIds(
            new Set()
          )

          setFeedback({
            type: 'success',
            message:
              resolvedAddedIds.length ===
              1
                ? 'Item added to the collection.'
                : `${resolvedAddedIds.length} items added to the collection.`,
          })

          onItemsAdded?.(
            resolvedAddedIds
          )
        })
        .catch(
          (error: unknown) => {
            console.error(
              '[CollectionItemPicker] Add-items action failed:',
              error
            )

            setFeedback({
              type: 'error',
              message:
                'The selected items could not be added. Refresh the page and try again.',
            })
          }
        )
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
      aria-labelledby="collection-item-picker-title"
      className={[
        'w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/75 text-white shadow-2xl shadow-black/20',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <PickerHeader
        title={title}
        description={description}
        candidateCount={
          normalizedCandidates.length
        }
        selectionCount={
          selectionCount
        }
        selectionLimit={
          normalizedSelectionLimit
        }
      />

      <div className="border-b border-neutral-800/80 p-4 sm:p-5">
        <SearchAndFilters
          query={query}
          activeType={activeType}
          disabled={isBusy}
          onQueryChange={
            handleQueryChange
          }
          onTypeChange={
            setActiveType
          }
        />
      </div>

      <div className="min-w-0 p-4 sm:p-5">
        {feedback ? (
          <PickerFeedback
            feedback={feedback}
          />
        ) : null}

        {filteredCandidates.length ===
        0 ? (
          <PickerEmptyState
            hasCandidates={
              normalizedCandidates.length >
              0
            }
            query={query}
            activeType={activeType}
            className={
              feedback
                ? 'mt-4'
                : ''
            }
          />
        ) : (
          <ul
            aria-label="Available collection items"
            aria-busy={isPending}
            className={[
              'grid min-w-0 gap-3 md:grid-cols-2',
              feedback
                ? 'mt-4'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {filteredCandidates.map(
              (candidate) => {
                const alreadyAdded =
                  existingIds.has(
                    candidate.id
                  )

                const selected =
                  selectedIds.has(
                    candidate.id
                  )

                const selectionDisabled =
                  isBusy ||
                  alreadyAdded ||
                  (
                    selectionLimitReached &&
                    !selected
                  )

                return (
                  <li
                    key={`${candidate.item_type}:${candidate.id}`}
                    className="min-w-0"
                  >
                    <CandidateCard
                      candidate={
                        candidate
                      }
                      selected={
                        selected
                      }
                      alreadyAdded={
                        alreadyAdded
                      }
                      disabled={
                        selectionDisabled
                      }
                      onToggle={() =>
                        toggleCandidate(
                          candidate.id
                        )
                      }
                    />
                  </li>
                )
              }
            )}
          </ul>
        )}
      </div>

      <PickerFooter
        selectionCount={
          selectionCount
        }
        selectionLimit={
          normalizedSelectionLimit
        }
        isPending={isPending}
        disabled={disabled}
        submitLabel={submitLabel}
        showCancel={
          typeof onCancel ===
          'function'
        }
        onClear={clearSelection}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />
    </section>
  )
}

/* =========================================================
 * Header
 * ======================================================= */

function PickerHeader({
  title,
  description,
  candidateCount,
  selectionCount,
  selectionLimit,
}: {
  title: string
  description: string
  candidateCount: number
  selectionCount: number
  selectionLimit: number
}) {
  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-neutral-800/80 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Collection contents
        </p>

        <h2
          id="collection-item-picker-title"
          className="mt-1 break-words text-lg font-semibold text-white"
        >
          {title}
        </h2>

        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <MetricBadge
          label="Available"
          value={candidateCount}
        />

        <MetricBadge
          label="Selected"
          value={`${selectionCount}/${selectionLimit}`}
          highlighted={
            selectionCount > 0
          }
        />
      </div>
    </header>
  )
}

function MetricBadge({
  label,
  value,
  highlighted = false,
}: {
  label: string
  value: number | string
  highlighted?: boolean
}) {
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2 text-center',
        highlighted
          ? 'border-indigo-500/30 bg-indigo-500/10'
          : 'border-neutral-800 bg-black/30',
      ].join(' ')}
    >
      <p
        className={[
          'text-sm font-semibold',
          highlighted
            ? 'text-indigo-200'
            : 'text-white',
        ].join(' ')}
      >
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </p>

      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        {label}
      </p>
    </div>
  )
}

/* =========================================================
 * Search and filters
 * ======================================================= */

function SearchAndFilters({
  query,
  activeType,
  disabled,
  onQueryChange,
  onTypeChange,
}: {
  query: string
  activeType:
    | CollectionItemPickerType
    | 'all'
  disabled: boolean
  onQueryChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void
  onTypeChange: (
    value:
      | CollectionItemPickerType
      | 'all'
  ) => void
}) {
  return (
    <div className="space-y-4">
      <label className="relative block min-w-0">
        <span className="sr-only">
          Search available collection
          items
        </span>

        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
        />

        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={onQueryChange}
          placeholder="Search by title, city, category, or description"
          className="w-full min-w-0 rounded-xl border border-neutral-800 bg-black py-2.5 pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {query ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const syntheticEvent = {
                target: {
                  value: '',
                },
              } as ChangeEvent<HTMLInputElement>

              onQueryChange(
                syntheticEvent
              )
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-900 hover:text-white disabled:opacity-50"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        ) : null}
      </label>

      <div
        role="group"
        aria-label="Filter collection items by type"
        className="flex min-w-0 flex-wrap gap-2"
      >
        {TYPE_OPTIONS.map(
          (option) => {
            const active =
              option.value ===
              activeType

            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() =>
                  onTypeChange(
                    option.value
                  )
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  active
                    ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200'
                    : 'border-neutral-800 bg-black/30 text-neutral-500 hover:border-neutral-600 hover:text-white',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          }
        )}
      </div>
    </div>
  )
}

/* =========================================================
 * Candidate card
 * ======================================================= */

function CandidateCard({
  candidate,
  selected,
  alreadyAdded,
  disabled,
  onToggle,
}: {
  candidate:
    CollectionItemPickerCandidate
  selected: boolean
  alreadyAdded: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onToggle}
      className={[
        'group relative flex w-full min-w-0 overflow-hidden rounded-2xl border text-left transition',
        selected
          ? 'border-indigo-400/60 bg-indigo-500/[0.08]'
          : 'border-neutral-800/90 bg-black/25 hover:border-neutral-600 hover:bg-neutral-900/50',
        alreadyAdded
          ? 'cursor-default opacity-60'
          : '',
        disabled &&
        !alreadyAdded
          ? 'cursor-not-allowed opacity-50'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CandidateImage
        candidate={candidate}
      />

      <div className="min-w-0 flex-1 p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <TypeBadge
              itemType={
                candidate.item_type
              }
            />

            <h3 className="mt-2 line-clamp-2 break-words text-sm font-semibold text-white">
              {candidate.title}
            </h3>
          </div>

          <SelectionIndicator
            selected={selected}
            alreadyAdded={
              alreadyAdded
            }
          />
        </div>

        {candidate.subtitle ? (
          <p className="mt-1 truncate text-xs font-medium text-neutral-400">
            {candidate.subtitle}
          </p>
        ) : null}

        {candidate.description ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-600">
            {candidate.description}
          </p>
        ) : null}

        {candidate.city ? (
          <p className="mt-3 flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-500">
            <MapPin
              aria-hidden="true"
              className="h-3 w-3 shrink-0 text-cyan-400"
            />

            <span className="truncate">
              {candidate.city}
            </span>
          </p>
        ) : null}
      </div>
    </button>
  )
}

function CandidateImage({
  candidate,
}: {
  candidate:
    CollectionItemPickerCandidate
}) {
  return (
    <div className="relative w-24 shrink-0 overflow-hidden border-r border-neutral-800 bg-neutral-900 sm:w-28">
      {candidate.image_url ? (
        <img
          src={candidate.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-36 w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_42%),#09090b]">
          <PickerTypeIcon
            itemType={
              candidate.item_type
            }
            className="h-6 w-6 text-indigo-300/60"
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

function SelectionIndicator({
  selected,
  alreadyAdded,
}: {
  selected: boolean
  alreadyAdded: boolean
}) {
  if (alreadyAdded) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-300">
        <Check
          aria-hidden="true"
          className="h-3 w-3"
        />

        Added
      </span>
    )
  }

  return (
    <span
      className={[
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
        selected
          ? 'border-indigo-300 bg-indigo-400 text-black'
          : 'border-neutral-700 bg-black/30 text-transparent group-hover:border-neutral-500',
      ].join(' ')}
    >
      <Check
        aria-hidden="true"
        className="h-3.5 w-3.5"
      />
    </span>
  )
}

/* =========================================================
 * Type presentation
 * ======================================================= */

function TypeBadge({
  itemType,
}: {
  itemType:
    CollectionItemPickerType
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-black/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
      <PickerTypeIcon
        itemType={itemType}
        className="h-3 w-3 text-indigo-300"
      />

      {getTypeLabel(itemType)}
    </span>
  )
}

function PickerTypeIcon({
  itemType,
  className,
}: {
  itemType:
    CollectionItemPickerType
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
        <Sparkles
          aria-hidden="true"
          className={className}
        />
      )
  }
}

function getTypeLabel(
  itemType:
    CollectionItemPickerType
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
 * Feedback and empty states
 * ======================================================= */

function PickerFeedback({
  feedback,
}: {
  feedback: Exclude<
    Feedback,
    null
  >
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
        'flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3',
        isError
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-emerald-500/30 bg-emerald-500/10',
      ].join(' ')}
    >
      {isError ? (
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
        />
      ) : (
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
        />
      )}

      <div className="min-w-0">
        <p
          className={[
            'text-sm font-semibold',
            isError
              ? 'text-red-200'
              : 'text-emerald-200',
          ].join(' ')}
        >
          {isError
            ? 'Items could not be added'
            : 'Collection updated'}
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
    </div>
  )
}

function PickerEmptyState({
  hasCandidates,
  query,
  activeType,
  className = '',
}: {
  hasCandidates: boolean
  query: string
  activeType:
    | CollectionItemPickerType
    | 'all'
  className?: string
}) {
  const hasFilters =
    query.trim().length > 0 ||
    activeType !== 'all'

  return (
    <div
      className={[
        'rounded-[1.5rem] border border-dashed border-neutral-800 bg-black/20 px-5 py-10 text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-500">
        <Search
          aria-hidden="true"
          className="h-5 w-5"
        />
      </span>

      <h3 className="mt-4 text-base font-semibold text-white">
        {hasCandidates &&
        hasFilters
          ? 'No matching items'
          : 'No items available'}
      </h3>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        {hasCandidates &&
        hasFilters
          ? 'Change the search terms or type filter to reveal more candidates.'
          : 'The server did not provide any eligible items for this collection.'}
      </p>
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
        Items cannot be added without a
        valid parent collection identifier.
      </p>
    </section>
  )
}

/* =========================================================
 * Footer
 * ======================================================= */

function PickerFooter({
  selectionCount,
  selectionLimit,
  isPending,
  disabled,
  submitLabel,
  showCancel,
  onClear,
  onCancel,
  onSubmit,
}: {
  selectionCount: number
  selectionLimit: number
  isPending: boolean
  disabled: boolean
  submitLabel: string
  showCancel: boolean
  onClear: () => void
  onCancel?: () => void
  onSubmit: () => void
}) {
  const isDisabled =
    disabled || isPending

  return (
    <footer className="flex min-w-0 flex-col gap-4 border-t border-neutral-800/80 bg-black/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-400">
          {selectionCount === 0
            ? 'No items selected'
            : `${selectionCount.toLocaleString()} ${
                selectionCount === 1
                  ? 'item'
                  : 'items'
              } selected`}
        </p>

        <p className="mt-1 text-[11px] text-neutral-600">
          Maximum{' '}
          {selectionLimit.toLocaleString()}{' '}
          items per submission.
        </p>
      </div>

      <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
        {showCancel ? (
          <button
            type="button"
            disabled={isDisabled}
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}

        <button
          type="button"
          disabled={
            isDisabled ||
            selectionCount === 0
          }
          onClick={onClear}
          className="inline-flex items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>

        <button
          type="button"
          disabled={
            isDisabled ||
            selectionCount === 0
          }
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Plus
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}

          {isPending
            ? 'Adding…'
            : submitLabel}
        </button>
      </div>
    </footer>
  )
}

/* =========================================================
 * Filtering
 * ======================================================= */

function filterCandidates({
  candidates,
  query,
  activeType,
}: {
  candidates:
    CollectionItemPickerCandidate[]
  query: string
  activeType:
    | CollectionItemPickerType
    | 'all'
}): CollectionItemPickerCandidate[] {
  const normalizedQuery =
    normalizeSearchText(query)

  return candidates.filter(
    (candidate) => {
      if (
        activeType !== 'all' &&
        candidate.item_type !==
          activeType
      ) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return buildSearchHaystack(
        candidate
      ).includes(
        normalizedQuery
      )
    }
  )
}

function buildSearchHaystack(
  candidate:
    CollectionItemPickerCandidate
): string {
  return normalizeSearchText(
    [
      candidate.title,
      candidate.subtitle,
      candidate.description,
      candidate.city,
      getTypeLabel(
        candidate.item_type
      ),
      ...(candidate.search_terms ??
        []),
    ]
      .filter(
        (
          value
        ): value is string =>
          typeof value ===
          'string'
      )
      .join(' ')
  )
}

function normalizeSearchText(
  value: string
): string {
  return value
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/* =========================================================
 * Candidate normalization
 * ======================================================= */

function normalizeCandidates(
  values:
    readonly CollectionItemPickerCandidate[]
): CollectionItemPickerCandidate[] {
  const byCompositeKey =
    new Map<
      string,
      CollectionItemPickerCandidate
    >()

  for (const value of values) {
    const candidate =
      normalizeCandidate(value)

    if (!candidate) {
      continue
    }

    const key =
      `${candidate.item_type}:${candidate.id}`

    const existing =
      byCompositeKey.get(key)

    if (
      !existing ||
      compareCandidates(
        candidate,
        existing
      ) < 0
    ) {
      byCompositeKey.set(
        key,
        candidate
      )
    }
  }

  return [
    ...byCompositeKey.values(),
  ].sort(compareCandidates)
}

function normalizeCandidate(
  value:
    CollectionItemPickerCandidate
): CollectionItemPickerCandidate | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  const id =
    normalizeIdentifier(
      value.id
    )

  const title =
    normalizeRequiredText(
      value.title,
      240
    )

  if (
    !id ||
    !title ||
    !isPickerItemType(
      value.item_type
    )
  ) {
    return null
  }

  return {
    id,

    item_type:
      value.item_type,

    title,

    subtitle:
      normalizeOptionalText(
        value.subtitle,
        240
      ),

    description:
      normalizeOptionalText(
        value.description,
        1_000
      ),

    image_url:
      normalizePublicImageUrl(
        value.image_url
      ),

    city:
      normalizeOptionalText(
        value.city,
        160
      ),

    href:
      normalizeSafeHref(
        value.href
      ),

    search_terms:
      normalizeSearchTerms(
        value.search_terms
      ),

    created_at:
      normalizeIsoDate(
        value.created_at
      ),
  }
}

function compareCandidates(
  first:
    CollectionItemPickerCandidate,
  second:
    CollectionItemPickerCandidate
): number {
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

  const firstTimestamp =
    first.created_at
      ? Date.parse(
          first.created_at
        )
      : 0

  const secondTimestamp =
    second.created_at
      ? Date.parse(
          second.created_at
        )
      : 0

  if (
    firstTimestamp !==
    secondTimestamp
  ) {
    return (
      secondTimestamp -
      firstTimestamp
    )
  }

  return first.id.localeCompare(
    second.id
  )
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function isPickerItemType(
  value: unknown
): value is CollectionItemPickerType {
  return (
    value === 'venue' ||
    value === 'property' ||
    value === 'flow' ||
    value === 'snapshot' ||
    value === 'custom'
  )
}

function isPickerFilterType(
  value: unknown
): value is
  | CollectionItemPickerType
  | 'all' {
  return (
    value === 'all' ||
    isPickerItemType(value)
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
    normalized.length > 200 ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function normalizeIdentifierList(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value
        .map(normalizeIdentifier)
        .filter(
          (
            item
          ): item is string =>
            item !== null
        )
    ),
  ]
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

function normalizeSearchTerms(
  value: unknown
): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const terms = [
    ...new Set(
      value
        .filter(
          (
            item
          ): item is string =>
            typeof item ===
            'string'
        )
        .map((item) =>
          item
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 160)
        )
        .filter(Boolean)
    ),
  ].slice(0, 30)

  return terms.length > 0
    ? terms
    : null
}

function normalizeSelectionLimit(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_SELECTION_LIMIT
  }

  return Math.min(
    100,
    Math.max(
      1,
      Math.trunc(value)
    )
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

function normalizeSafeHref(
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

  if (
    normalized.startsWith('/') &&
    !normalized.startsWith('//') &&
    !normalized.includes('\\') &&
    !/[\r\n]/.test(normalized)
  ) {
    return normalized
  }

  try {
    const parsed =
      new URL(normalized)

    if (
      (
        parsed.protocol !==
          'https:' &&
        parsed.protocol !==
          'http:'
      ) ||
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

/* =========================================================
 * Optional utility shell
 * ======================================================= */

export function CollectionItemPickerPanel({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="w-full min-w-0">
      {children}
    </div>
  )
}