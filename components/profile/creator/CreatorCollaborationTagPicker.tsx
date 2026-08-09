'use client'

import {
  useId,
  useMemo,
  useState,
} from 'react'
import {
  AlertCircle,
  Check,
  Search,
  Tag,
  X,
} from 'lucide-react'

import {
  COLLABORATION_CATEGORY_OPTIONS,
  CREATOR_FIELD_LIMITS,
} from '@/lib/creator/constants'

import type {
  CollaborationTag,
  CollaborationTagCategory,
} from '@/lib/creator/types'

import { logEvent } from '@/lib/logEvent'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorCollaborationTagPickerProps = {
  /**
   * Canonical active collaboration tags available for selection.
   */
  tags: CollaborationTag[]

  /**
   * Controlled selected tag IDs.
   */
  selectedTagIds: readonly number[]

  /**
   * Called with the complete next selection.
   */
  onChange: (tagIds: number[]) => void

  /**
   * Optional section-level validation error.
   */
  error?: string | null

  /**
   * Prevents all interaction.
   */
  disabled?: boolean

  /**
   * Maximum selectable tags.
   *
   * Defaults to the canonical Creator Mode limit.
   */
  maxSelections?: number

  /**
   * Enables the local tag search control.
   */
  searchable?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string

  /**
   * Invoked before a user-driven mutation.
   *
   * Useful for clearing stale action results in the parent form.
   */
  onInteraction?: () => void
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorCollaborationTagPicker({
  tags,
  selectedTagIds,
  onChange,
  error = null,
  disabled = false,
  maxSelections =
    CREATOR_FIELD_LIMITS.collaborationTagsPerCreator,
  searchable = true,
  className = '',
  onInteraction,
}: CreatorCollaborationTagPickerProps) {
  const generatedId = useId()
  const headingId =
    `${generatedId}-heading`
  const descriptionId =
    `${generatedId}-description`
  const errorId = error
    ? `${generatedId}-error`
    : undefined
  const statusId =
    `${generatedId}-status`

  const [searchQuery, setSearchQuery] =
    useState('')

  const normalizedMaxSelections =
    normalizeSelectionLimit(maxSelections)

  const activeTags = useMemo(
    () =>
      normalizeAvailableTags(tags),
    [tags]
  )

  const availableTagIds = useMemo(
    () =>
      new Set(
        activeTags.map((tag) => tag.id)
      ),
    [activeTags]
  )

  const tagById = useMemo(
    () =>
      new Map(
        activeTags.map((tag) => [
          tag.id,
          tag,
        ])
      ),
    [activeTags]
  )

  const normalizedSelectedTagIds =
    useMemo(
      () =>
        normalizeSelectedTagIds({
          selectedTagIds,
          availableTagIds,
          maximum:
            normalizedMaxSelections,
        }),
      [
        availableTagIds,
        normalizedMaxSelections,
        selectedTagIds,
      ]
    )

  const selectedTagIdSet = useMemo(
    () =>
      new Set(
        normalizedSelectedTagIds
      ),
    [normalizedSelectedTagIds]
  )

  const selectedTags = useMemo(
    () =>
      activeTags
        .filter((tag) =>
          selectedTagIdSet.has(tag.id)
        )
        .sort(compareTags),
    [
      activeTags,
      selectedTagIdSet,
    ]
  )

  const filteredTags = useMemo(
    () =>
      filterTags({
        tags: activeTags,
        query: searchQuery,
      }),
    [
      activeTags,
      searchQuery,
    ]
  )

  const groupedTags = useMemo(
    () =>
      groupTagsByCategory(
        filteredTags
      ),
    [filteredTags]
  )

  const selectionCount =
    normalizedSelectedTagIds.length

  const selectionLimitReached =
    selectionCount >=
    normalizedMaxSelections

  const describedBy = [
    descriptionId,
    statusId,
    errorId,
  ]
    .filter(Boolean)
    .join(' ')

  function interact() {
    onInteraction?.()
  }

  function toggleTag(tagId: number) {
    if (
      disabled ||
      !availableTagIds.has(tagId)
    ) {
      return
    }

    const isSelected =
      selectedTagIdSet.has(tagId)

    if (
      !isSelected &&
      selectionLimitReached
    ) {
      return
    }

    interact()

    const tag =
      tagById.get(tagId)

    if (isSelected) {
      const nextSelection =
        normalizedSelectedTagIds.filter(
          (selectedId) =>
            selectedId !== tagId
        )

      safeLogCreatorEvent(
        'creator_collaboration_tag_removed',
        {
          tag_id: tagId,
          tag_label:
            tag?.label ?? null,
          tag_slug:
            tag?.slug ?? null,
          tag_category:
            tag?.category ?? null,
          previous_selection_count:
            normalizedSelectedTagIds.length,
          next_selection_count:
            nextSelection.length,
          max_selections:
            normalizedMaxSelections,
          interaction_source:
            'tag_picker_option',
        }
      )

      onChange(nextSelection)

      return
    }

    const nextSelection = [
      ...normalizedSelectedTagIds,
      tagId,
    ]

    safeLogCreatorEvent(
      'creator_collaboration_tag_selected',
      {
        tag_id: tagId,
        tag_label:
          tag?.label ?? null,
        tag_slug:
          tag?.slug ?? null,
        tag_category:
          tag?.category ?? null,
        previous_selection_count:
          normalizedSelectedTagIds.length,
        next_selection_count:
          nextSelection.length,
        max_selections:
          normalizedMaxSelections,
        interaction_source:
          'tag_picker_option',
      }
    )

    onChange(nextSelection)
  }

  function removeTag(tagId: number) {
    if (
      disabled ||
      !selectedTagIdSet.has(tagId)
    ) {
      return
    }

    interact()

    const tag =
      tagById.get(tagId)

    const nextSelection =
      normalizedSelectedTagIds.filter(
        (selectedId) =>
          selectedId !== tagId
      )

    safeLogCreatorEvent(
      'creator_collaboration_tag_removed',
      {
        tag_id: tagId,
        tag_label:
          tag?.label ?? null,
        tag_slug:
          tag?.slug ?? null,
        tag_category:
          tag?.category ?? null,
        previous_selection_count:
          normalizedSelectedTagIds.length,
        next_selection_count:
          nextSelection.length,
        max_selections:
          normalizedMaxSelections,
        interaction_source:
          'selected_tag_summary',
      }
    )

    onChange(nextSelection)
  }

  function clearAll() {
    if (
      disabled ||
      normalizedSelectedTagIds.length === 0
    ) {
      return
    }

    interact()

    safeLogCreatorEvent(
      'creator_collaboration_tags_cleared',
      {
        cleared_tag_count:
          normalizedSelectedTagIds.length,
        cleared_tag_ids:
          normalizedSelectedTagIds,
        cleared_tag_categories:
          selectedTags.map(
            (tag) => tag.category
          ),
        max_selections:
          normalizedMaxSelections,
        interaction_source:
          'selected_tag_summary',
      }
    )

    onChange([])
  }

  function handleSearchChange(
    value: string
  ) {
    setSearchQuery(value)
  }

  function clearSearch() {
    setSearchQuery('')
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={
        describedBy || undefined
      }
      className={[
        'w-full min-w-0 rounded-2xl border bg-black/25 p-4 sm:p-5',
        error
          ? 'border-red-500/50'
          : 'border-neutral-800',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <Tag
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Available for
            </p>
          </div>

          <h3
            id={headingId}
            className="mt-3 text-base font-semibold text-white"
          >
            Collaboration preferences
          </h3>

          <p
            id={descriptionId}
            className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400"
          >
            Choose the campaign types,
            deliverables, and industries
            that match work you are
            genuinely prepared to accept.
          </p>
        </div>

        <SelectionCounter
          current={selectionCount}
          maximum={
            normalizedMaxSelections
          }
        />
      </div>

      <SectionError
        id={errorId}
        message={error}
      />

      {selectedTags.length > 0 ? (
        <SelectedTagsSummary
          tags={selectedTags}
          disabled={disabled}
          onRemove={removeTag}
          onClear={clearAll}
        />
      ) : null}

      {searchable &&
      activeTags.length > 6 ? (
        <TagSearch
          id={`${generatedId}-search`}
          value={searchQuery}
          disabled={disabled}
          resultCount={
            filteredTags.length
          }
          onChange={
            handleSearchChange
          }
          onClear={clearSearch}
        />
      ) : null}

      <div
        id={statusId}
        aria-live="polite"
        className="sr-only"
      >
        {selectionCount}{' '}
        {selectionCount === 1
          ? 'collaboration tag selected'
          : 'collaboration tags selected'}
        . Maximum{' '}
        {normalizedMaxSelections}.
      </div>

      {activeTags.length === 0 ? (
        <EmptyTagState />
      ) : filteredTags.length === 0 ? (
        <NoSearchResults
          query={searchQuery}
          onClear={clearSearch}
        />
      ) : (
        <div className="mt-5 space-y-6">
          {COLLABORATION_CATEGORY_OPTIONS.map(
            (category) => {
              const categoryTags =
                groupedTags[
                  category.value
                ]

              if (
                categoryTags.length === 0
              ) {
                return null
              }

              return (
                <TagCategoryGroup
                  key={category.value}
                  category={
                    category.value
                  }
                  label={category.label}
                  description={
                    category.description
                  }
                  tags={categoryTags}
                  selectedTagIds={
                    selectedTagIdSet
                  }
                  selectionLimitReached={
                    selectionLimitReached
                  }
                  disabled={disabled}
                  onToggle={toggleTag}
                />
              )
            }
          )}
        </div>
      )}

      {selectionLimitReached ? (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-3">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
          />

          <p className="text-xs leading-5 text-amber-200/90">
            You have selected the
            maximum of{' '}
            {normalizedMaxSelections.toLocaleString()}{' '}
            collaboration tags. Remove
            one before selecting another.
          </p>
        </div>
      ) : null}
    </section>
  )
}

/* =========================================================
 * Selected-tag summary
 * ======================================================= */

function SelectedTagsSummary({
  tags,
  disabled,
  onRemove,
  onClear,
}: {
  tags: CollaborationTag[]
  disabled: boolean
  onRemove: (tagId: number) => void
  onClear: () => void
}) {
  return (
    <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
            Selected
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            These tags can appear on
            your public creator profile.
          </p>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="shrink-0 rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear all
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-black"
          >
            <span className="truncate">
              {tag.label}
            </span>

            <button
              type="button"
              aria-label={`Remove ${tag.label}`}
              title={`Remove ${tag.label}`}
              disabled={disabled}
              onClick={() =>
                onRemove(tag.id)
              }
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
 * Search
 * ======================================================= */

function TagSearch({
  id,
  value,
  disabled,
  resultCount,
  onChange,
  onClear,
}: {
  id: string
  value: string
  disabled: boolean
  resultCount: number
  onChange: (value: string) => void
  onClear: () => void
}) {
  return (
    <div className="mt-5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-neutral-300"
      >
        Search collaboration tags
      </label>

      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
        />

        <input
          id={id}
          type="search"
          value={value}
          disabled={disabled}
          placeholder="Search campaigns, deliverables, or industries"
          autoComplete="off"
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="w-full min-w-0 rounded-xl border border-neutral-800 bg-black py-2.5 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
        />

        {value ? (
          <button
            type="button"
            aria-label="Clear collaboration tag search"
            title="Clear search"
            disabled={disabled}
            onClick={onClear}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-50"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        ) : null}
      </div>

      {value ? (
        <p
          aria-live="polite"
          className="mt-1.5 text-xs text-neutral-600"
        >
          {resultCount.toLocaleString()}{' '}
          {resultCount === 1
            ? 'matching tag'
            : 'matching tags'}
        </p>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Category groups
 * ======================================================= */

function TagCategoryGroup({
  category,
  label,
  description,
  tags,
  selectedTagIds,
  selectionLimitReached,
  disabled,
  onToggle,
}: {
  category:
    CollaborationTagCategory
  label: string
  description: string
  tags: CollaborationTag[]
  selectedTagIds: Set<number>
  selectionLimitReached: boolean
  disabled: boolean
  onToggle: (tagId: number) => void
}) {
  const generatedId = useId()
  const headingId =
    `${generatedId}-${category}-heading`
  const descriptionId =
    `${generatedId}-${category}-description`

  return (
    <fieldset
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="min-w-0"
    >
      <legend className="sr-only">
        {label}
      </legend>

      <div>
        <p
          id={headingId}
          className="text-sm font-semibold text-neutral-200"
        >
          {label}
        </p>

        <p
          id={descriptionId}
          className="mt-1 text-xs leading-5 text-neutral-500"
        >
          {description}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => {
          const selected =
            selectedTagIds.has(tag.id)

          const unavailable =
            disabled ||
            (!selected &&
              selectionLimitReached)

          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              aria-label={
                selected
                  ? `Remove ${tag.label}`
                  : `Select ${tag.label}`
              }
              disabled={unavailable}
              onClick={() =>
                onToggle(tag.id)
              }
              className={[
                'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                'disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-cyan-300 bg-cyan-400 text-black'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-cyan-500/40 hover:bg-cyan-500/[0.06] hover:text-cyan-200',
              ].join(' ')}
            >
              {selected ? (
                <Check
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                />
              ) : null}

              <span className="truncate">
                {tag.label}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/* =========================================================
 * Empty states
 * ======================================================= */

function EmptyTagState() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 px-5 py-8 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-500">
        <Tag
          aria-hidden="true"
          className="h-5 w-5"
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-white">
        No collaboration tags available
      </p>

      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-neutral-500">
        Active collaboration tags have
        not been configured yet.
      </p>
    </div>
  )
}

function NoSearchResults({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 px-5 py-8 text-center">
      <Search
        aria-hidden="true"
        className="mx-auto h-5 w-5 text-neutral-600"
      />

      <p className="mt-3 text-sm font-semibold text-white">
        No matching tags
      </p>

      <p className="mx-auto mt-2 max-w-md break-words text-xs leading-5 text-neutral-500">
        No collaboration tags match
        “{query.trim()}”.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
      >
        Clear search
      </button>
    </div>
  )
}

/* =========================================================
 * Shared feedback
 * ======================================================= */

function SelectionCounter({
  current,
  maximum,
}: {
  current: number
  maximum: number
}) {
  const atLimit =
    current >= maximum

  return (
    <div
      aria-label={`${current} of ${maximum} collaboration tags selected`}
      className={[
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
        atLimit
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-neutral-800 bg-neutral-950 text-neutral-500',
      ].join(' ')}
    >
      {current.toLocaleString()}/
      {maximum.toLocaleString()}{' '}
      selected
    </div>
  )
}

function SectionError({
  id,
  message,
}: {
  id?: string
  message?: string | null
}) {
  if (!message) {
    return null
  }

  return (
    <div
      id={id}
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3"
    >
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
      />

      <p className="text-xs leading-5 text-red-200">
        {message}
      </p>
    </div>
  )
}

/* =========================================================
 * Data normalization
 * ======================================================= */

function normalizeAvailableTags(
  tags: CollaborationTag[]
): CollaborationTag[] {
  const byId = new Map<
    number,
    CollaborationTag
  >()

  for (const tag of tags) {
    if (
      !tag.active ||
      !Number.isInteger(tag.id) ||
      tag.id <= 0
    ) {
      continue
    }

    byId.set(tag.id, tag)
  }

  return [...byId.values()].sort(
    compareTags
  )
}

function normalizeSelectedTagIds({
  selectedTagIds,
  availableTagIds,
  maximum,
}: {
  selectedTagIds: readonly number[]
  availableTagIds: Set<number>
  maximum: number
}): number[] {
  const normalized: number[] = []
  const seen = new Set<number>()

  for (const tagId of selectedTagIds) {
    if (
      !Number.isInteger(tagId) ||
      tagId <= 0 ||
      seen.has(tagId) ||
      !availableTagIds.has(tagId)
    ) {
      continue
    }

    seen.add(tagId)
    normalized.push(tagId)

    if (
      normalized.length >= maximum
    ) {
      break
    }
  }

  return normalized
}

function groupTagsByCategory(
  tags: CollaborationTag[]
): Record<
  CollaborationTagCategory,
  CollaborationTag[]
> {
  const grouped: Record<
    CollaborationTagCategory,
    CollaborationTag[]
  > = {
    campaign: [],
    deliverable: [],
    industry: [],
  }

  for (const tag of tags) {
    grouped[tag.category].push(tag)
  }

  return grouped
}

function filterTags({
  tags,
  query,
}: {
  tags: CollaborationTag[]
  query: string
}): CollaborationTag[] {
  const normalizedQuery =
    query
      .trim()
      .toLocaleLowerCase()

  if (!normalizedQuery) {
    return tags
  }

  return tags.filter((tag) => {
    const searchableText = [
      tag.label,
      tag.slug,
      tag.category,
    ]
      .join(' ')
      .toLocaleLowerCase()

    return searchableText.includes(
      normalizedQuery
    )
  })
}

function compareTags(
  first: CollaborationTag,
  second: CollaborationTag
): number {
  const firstCategoryOrder =
    getCategorySortOrder(
      first.category
    )

  const secondCategoryOrder =
    getCategorySortOrder(
      second.category
    )

  if (
    firstCategoryOrder !==
    secondCategoryOrder
  ) {
    return (
      firstCategoryOrder -
      secondCategoryOrder
    )
  }

  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  const labelComparison =
    first.label.localeCompare(
      second.label,
      undefined,
      {
        sensitivity: 'base',
      }
    )

  if (labelComparison !== 0) {
    return labelComparison
  }

  return first.id - second.id
}

function getCategorySortOrder(
  category:
    CollaborationTagCategory
): number {
  const index =
    COLLABORATION_CATEGORY_OPTIONS.findIndex(
      (option) =>
        option.value === category
    )

  return index >= 0
    ? index
    : Number.MAX_SAFE_INTEGER
}

function normalizeSelectionLimit(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return CREATOR_FIELD_LIMITS
      .collaborationTagsPerCreator
  }

  return Math.min(value, 100)
}

/* =========================================================
 * Analytics
 * ======================================================= */

function safeLogCreatorEvent(
  eventName: string,
  metadata: Record<string, unknown>
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata: {
          component:
            'CreatorCollaborationTagPicker',
          creator_surface:
            'collaboration_preferences',
          ...metadata,
        },
      })
    )
  } catch (error) {
    console.warn(
      '[CreatorCollaborationTagPicker] Analytics logging failed:',
      error
    )
  }
}