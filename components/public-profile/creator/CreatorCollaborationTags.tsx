import {
  BriefcaseBusiness,
  Check,
  Layers3,
  Tag,
} from 'lucide-react'

import {
  COLLABORATION_CATEGORY_OPTIONS,
} from '@/lib/creator/constants'

import type {
  CollaborationTag,
  CollaborationTagCategory,
} from '@/lib/creator/types'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorCollaborationTagsProps = {
  /**
   * Canonical collaboration tags returned by the public creator
   * profile loader.
   *
   * Only active tags should normally reach this component.
   * Defensive normalization is still performed before rendering.
   */
  tags: readonly CollaborationTag[]

  /**
   * Optional section title.
   */
  title?: string

  /**
   * Optional supporting copy.
   */
  description?: string

  /**
   * Maximum number of tags rendered.
   *
   * Defaults to every valid supplied tag, capped at a safe
   * presentation limit.
   */
  limit?: number

  /**
   * Controls whether the section heading and description render.
   *
   * Disable this when placing the tag list inside another panel
   * that already supplies its own heading.
   */
  showHeading?: boolean

  /**
   * Groups tags by campaign, deliverable, and industry.
   *
   * When false, all tags render in one flat list.
   */
  groupByCategory?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorCollaborationTags({
  tags,
  title = 'Open to collaboration',
  description =
    'Campaign types, deliverables, and industries this creator is currently interested in working across.',
  limit,
  showHeading = true,
  groupByCategory = true,
  className = '',
}: CreatorCollaborationTagsProps) {
  const normalizedTags =
    normalizePublicCollaborationTags({
      tags,
      limit,
    })

  if (normalizedTags.length === 0) {
    return null
  }

  const groupedTags =
    groupCollaborationTags(
      normalizedTags
    )

  const headingId =
    'creator-collaboration-tags-title'

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
        <CollaborationTagsHeading
          id={headingId}
          title={title}
          description={description}
          tagCount={
            normalizedTags.length
          }
        />
      ) : null}

      {groupByCategory ? (
        <div
          className={[
            'space-y-6',
            showHeading ? 'mt-5' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
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
                <CollaborationTagGroup
                  key={category.value}
                  category={
                    category.value
                  }
                  label={category.label}
                  description={
                    category.description
                  }
                  tags={categoryTags}
                />
              )
            }
          )}
        </div>
      ) : (
        <CollaborationTagList
          tags={normalizedTags}
          className={
            showHeading ? 'mt-5' : ''
          }
        />
      )}
    </section>
  )
}

/* =========================================================
 * Heading
 * ======================================================= */

function CollaborationTagsHeading({
  id,
  title,
  description,
  tagCount,
}: {
  id: string
  title: string
  description: string
  tagCount: number
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <BriefcaseBusiness
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
            Collaboration
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

      <span
        aria-label={`${tagCount} collaboration ${
          tagCount === 1
            ? 'preference'
            : 'preferences'
        }`}
        className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-xs font-semibold text-neutral-400"
      >
        <Tag
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />

        {tagCount.toLocaleString()}
      </span>
    </div>
  )
}

/* =========================================================
 * Category group
 * ======================================================= */

function CollaborationTagGroup({
  category,
  label,
  description,
  tags,
}: {
  category:
    CollaborationTagCategory
  label: string
  description: string
  tags: NormalizedCollaborationTag[]
}) {
  const headingId =
    `creator-collaboration-${category}-title`

  return (
    <div
      aria-labelledby={headingId}
      className="min-w-0"
    >
      <div className="flex min-w-0 items-start gap-3">
        <CategoryIcon
          category={category}
        />

        <div className="min-w-0">
          <h3
            id={headingId}
            className="text-sm font-semibold text-neutral-200"
          >
            {label}
          </h3>

          {description ? (
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <CollaborationTagList
        tags={tags}
        className="mt-3"
      />
    </div>
  )
}

/* =========================================================
 * Tag list
 * ======================================================= */

function CollaborationTagList({
  tags,
  className = '',
}: {
  tags: NormalizedCollaborationTag[]
  className?: string
}) {
  return (
    <ul
      aria-label="Creator collaboration preferences"
      className={[
        'flex min-w-0 flex-wrap gap-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tags.map((tag) => (
        <li
          key={tag.id}
          className="max-w-full"
        >
          <span
            title={tag.label}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-black/35 px-3 py-2 text-xs font-semibold text-neutral-300"
          >
            <Check
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-cyan-400"
            />

            <span className="break-words">
              {tag.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/* =========================================================
 * Category icons
 * ======================================================= */

function CategoryIcon({
  category,
}: {
  category:
    CollaborationTagCategory
}) {
  const wrapperClassName =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-400'

  switch (category) {
    case 'campaign':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <BriefcaseBusiness className="h-4 w-4" />
        </span>
      )

    case 'deliverable':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <Layers3 className="h-4 w-4" />
        </span>
      )

    case 'industry':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <Tag className="h-4 w-4" />
        </span>
      )
  }
}

/* =========================================================
 * Normalized internal shape
 * ======================================================= */

type NormalizedCollaborationTag =
  CollaborationTag & {
    id: number
    slug: string
    label: string
    category:
      CollaborationTagCategory
    active: true
    sort_order: number
  }

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizePublicCollaborationTags({
  tags,
  limit,
}: {
  tags:
    readonly CollaborationTag[]
  limit?: number
}): NormalizedCollaborationTag[] {
  const normalizedLimit =
    normalizeLimit(limit)

  const tagsById = new Map<
    number,
    NormalizedCollaborationTag
  >()

  const tagIdsBySlug =
    new Map<string, number>()

  for (const tag of tags) {
    const normalizedTag =
      normalizePublicCollaborationTag(
        tag
      )

    if (!normalizedTag) {
      continue
    }

    const existingTagId =
      tagIdsBySlug.get(
        normalizedTag.slug
      )

    /**
     * Canonical collaboration tags should have unique IDs and
     * slugs. If malformed upstream data contains a duplicate
     * slug, preserve the highest-priority valid row.
     */
    if (
      existingTagId !== undefined
    ) {
      const existingTag =
        tagsById.get(existingTagId)

      if (
        existingTag &&
        compareCollaborationTags(
          existingTag,
          normalizedTag
        ) <= 0
      ) {
        continue
      }

      tagsById.delete(existingTagId)
    }

    const existingById =
      tagsById.get(
        normalizedTag.id
      )

    if (
      existingById &&
      compareCollaborationTags(
        existingById,
        normalizedTag
      ) <= 0
    ) {
      continue
    }

    if (existingById) {
      tagIdsBySlug.delete(
        existingById.slug
      )
    }

    tagsById.set(
      normalizedTag.id,
      normalizedTag
    )

    tagIdsBySlug.set(
      normalizedTag.slug,
      normalizedTag.id
    )
  }

  return [...tagsById.values()]
    .sort(compareCollaborationTags)
    .slice(0, normalizedLimit)
}

function normalizePublicCollaborationTag(
  value: CollaborationTag
): NormalizedCollaborationTag | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  if (
    typeof value.id !== 'number' ||
    !Number.isInteger(value.id) ||
    value.id <= 0
  ) {
    return null
  }

  if (
    value.active !== true
  ) {
    return null
  }

  if (
    !isCollaborationTagCategory(
      value.category
    )
  ) {
    return null
  }

  const slug =
    normalizeSlug(value.slug)

  const label =
    normalizeLabel(value.label)

  if (!slug || !label) {
    return null
  }

  return {
    ...value,
    id: value.id,
    slug,
    label,
    category: value.category,
    active: true,
    sort_order:
      normalizeSortOrder(
        value.sort_order
      ),
  }
}

/* =========================================================
 * Grouping and sorting
 * ======================================================= */

function groupCollaborationTags(
  tags: readonly NormalizedCollaborationTag[]
): Record<
  CollaborationTagCategory,
  NormalizedCollaborationTag[]
> {
  const grouped: Record<
    CollaborationTagCategory,
    NormalizedCollaborationTag[]
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

function compareCollaborationTags(
  first:
    NormalizedCollaborationTag,
  second:
    NormalizedCollaborationTag
): number {
  const categoryComparison =
    getCategorySortOrder(
      first.category
    ) -
    getCategorySortOrder(
      second.category
    )

  if (categoryComparison !== 0) {
    return categoryComparison
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

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeLimit(
  value: number | undefined
): number {
  const defaultLimit = 24
  const maximumLimit = 50

  if (value === undefined) {
    return defaultLimit
  }

  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return defaultLimit
  }

  return Math.min(
    maximumLimit,
    Math.max(0, value)
  )
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
    normalized.length > 120 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}

function normalizeLabel(
  value: string
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  if (
    !normalized ||
    normalized.length > 100
  ) {
    return null
  }

  return normalized
}

function isCollaborationTagCategory(
  value: unknown
): value is CollaborationTagCategory {
  return (
    value === 'campaign' ||
    value === 'deliverable' ||
    value === 'industry'
  )
}