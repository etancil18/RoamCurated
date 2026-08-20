// components/relay/RelaySlotList.tsx

import type {
  RelaySlotSelectionMode,
  RelaySlotTemplate,
} from '@/lib/relay/types'
import {
  formatRelaySlotHeading,
} from '@/lib/relay/format'


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelaySlotListVariant =
  | 'default'
  | 'preview'
  | 'compact'


export type RelaySlotListProps = {
  slots: RelaySlotTemplate[]

  /**
   * default:
   *   Consumer/detail presentation.
   *
   * preview:
   *   Slightly more explicit authoring metadata.
   *
   * compact:
   *   Reduced vertical density for cards/sidebars.
   */
  variant?: RelaySlotListVariant

  /**
   * Show the slot prompt beneath the title when present.
   */
  showPrompts?: boolean

  /**
   * Show selection-mode / constraint metadata.
   */
  showConstraints?: boolean

  /**
   * Optional accessible label for the ordered list.
   */
  ariaLabel?: string

  className?: string
}


/* ============================================================
 * INTERNAL DISPLAY MODEL
 * ============================================================
 */

type SlotConstraintDisplay = {
  primary: string
  secondary: string | null
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getConstraintDisplay(
  slot: RelaySlotTemplate
): SlotConstraintDisplay {
  switch (
    slot.selectionMode
  ) {
    case 'open':
      return {
        primary:
          'Choose any venue',

        secondary:
          null,
      }

    case 'category':
      return {
        primary:
          'Choose by category',

        secondary:
          slot.categoryConstraint
            ?.trim() ||
          'Choose a venue that fits this category',
      }

    case 'venue_pool': {
      const venueCount =
        slot.eligibleVenueIds.length

      return {
        primary:
          'Choose from the list',

        secondary:
          venueCount > 0
            ? `${venueCount} ${
                venueCount === 1
                  ? 'venue option'
                  : 'venue options'
              }`
            : 'Choose from the available venues',
      }
    }

    case 'exact_venue':
      return {
        primary:
          'Specific venue',

        secondary:
          slot.exactVenue?.name ??
          (
            slot.exactVenueId
              ? 'This stop has a set venue'
              : 'A specific venue is required'
          ),
      }
  }
}


function getConstraintToneClasses(
  mode:
    RelaySlotSelectionMode
): string {
  switch (mode) {
    case 'open':
      return [
        'border-white/10',
        'bg-white/[0.04]',
        'text-white/60',
      ].join(' ')

    case 'category':
      return [
        'border-sky-300/15',
        'bg-sky-300/[0.06]',
        'text-sky-100/80',
      ].join(' ')

    case 'venue_pool':
      return [
        'border-violet-300/15',
        'bg-violet-300/[0.06]',
        'text-violet-100/80',
      ].join(' ')

    case 'exact_venue':
      return [
        'border-amber-300/15',
        'bg-amber-300/[0.06]',
        'text-amber-100/85',
      ].join(' ')
  }
}


function getSortedSlots(
  slots: RelaySlotTemplate[]
): RelaySlotTemplate[] {
  return [
    ...slots,
  ].sort(
    (
      left,
      right
    ) =>
      left.slotIndex -
      right.slotIndex
  )
}


/* ============================================================
 * EMPTY STATE
 * ============================================================
 */

function EmptyRelaySlotList({
  variant,
}: {
  variant:
    RelaySlotListVariant
}) {
  const compact =
    variant ===
    'compact'

  return (
    <div
      className={[
        'rounded-2xl',
        'border',
        'border-dashed',
        'border-white/10',
        'bg-white/[0.025]',
        compact
          ? 'px-4 py-4'
          : 'px-5 py-6',
      ].join(' ')}
    >
      <p
        className={[
          'font-medium',
          'text-white/55',
          compact
            ? 'text-xs'
            : 'text-sm',
        ].join(' ')}
      >
        No stops have been
        added to this Relay yet.
      </p>
    </div>
  )
}


/* ============================================================
 * SLOT ITEM
 * ============================================================
 */

function RelaySlotListItem({
  slot,
  variant,
  showPrompts,
  showConstraints,
  isLast,
}: {
  slot: RelaySlotTemplate
  variant:
    RelaySlotListVariant
  showPrompts: boolean
  showConstraints: boolean
  isLast: boolean
}) {
  const compact =
    variant ===
    'compact'

  const preview =
    variant ===
    'preview'

  const constraint =
    getConstraintDisplay(
      slot
    )

  const heading =
    formatRelaySlotHeading(
      slot.slotIndex,
      slot.label
    )

  return (
    <li
      className="relative flex gap-3 sm:gap-4"
      data-relay-slot-id={
        slot.id
      }
      data-relay-slot-index={
        slot.slotIndex
      }
      data-relay-slot-selection-mode={
        slot.selectionMode
      }
    >
      {/* Timeline rail */}
      <div
        className="relative flex shrink-0 flex-col items-center"
        aria-hidden="true"
      >
        <div
          className={[
            'relative',
            'z-10',
            'grid',
            'place-items-center',
            'rounded-full',
            'border',
            'border-white/12',
            'bg-[#111111]',
            'font-semibold',
            'tabular-nums',
            'text-white/72',
            'shadow-[0_8px_30px_rgba(0,0,0,0.28)]',
            compact
              ? 'h-7 w-7 text-[10px]'
              : 'h-9 w-9 text-xs',
          ].join(' ')}
        >
          {slot.slotIndex}
        </div>

        {!isLast ? (
          <div
            className={[
              'absolute',
              'top-7',
              'bottom-[-1rem]',
              'w-px',
              'bg-gradient-to-b',
              'from-white/14',
              'via-white/[0.08]',
              'to-white/[0.04]',
              compact
                ? 'top-6'
                : 'top-8',
            ].join(' ')}
          />
        ) : null}
      </div>

      {/* Content */}
      <div
        className={[
          'min-w-0',
          'flex-1',
          isLast
            ? ''
            : compact
              ? 'pb-4'
              : 'pb-6',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            'rounded-2xl',
            'border',
            'border-white/[0.08]',
            'bg-white/[0.035]',
            'transition-colors',
            'hover:border-white/[0.12]',
            'hover:bg-white/[0.045]',
            compact
              ? 'px-3.5 py-3'
              : 'px-4 py-4 sm:px-5',
          ].join(' ')}
        >
          {/* Heading row */}
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={[
                  'font-semibold',
                  'tracking-[-0.01em]',
                  'text-white',
                  compact
                    ? 'text-sm'
                    : 'text-[15px] sm:text-base',
                ].join(' ')}
              >
                {heading}
              </p>

              {showPrompts &&
              slot.prompt
                ?.trim() ? (
                <p
                  className={[
                    'mt-1.5',
                    'max-w-2xl',
                    'leading-relaxed',
                    'text-white/55',
                    compact
                      ? 'text-xs'
                      : 'text-sm',
                  ].join(' ')}
                >
                  {slot.prompt}
                </p>
              ) : null}
            </div>

            {slot.requiredGeoVerified ? (
              <span
                className={[
                  'shrink-0',
                  'rounded-full',
                  'border',
                  'border-emerald-300/12',
                  'bg-emerald-300/[0.055]',
                  'font-medium',
                  'uppercase',
                  'tracking-[0.12em]',
                  'text-emerald-100/70',
                  compact
                    ? 'px-2 py-1 text-[9px]'
                    : 'px-2.5 py-1.5 text-[10px]',
                ].join(' ')}
                title="Visit this stop in person and check in to complete it."
              >
                Check-in required
              </span>
            ) : null}
          </div>

          {/* Constraint information */}
          {showConstraints ? (
            <div
              className={[
                'flex',
                'flex-wrap',
                'items-center',
                'gap-2',
                compact
                  ? 'mt-2.5'
                  : 'mt-3.5',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex',
                  'items-center',
                  'rounded-full',
                  'border',
                  'font-medium',
                  'uppercase',
                  'tracking-[0.11em]',
                  compact
                    ? 'px-2 py-1 text-[9px]'
                    : 'px-2.5 py-1.5 text-[10px]',
                  getConstraintToneClasses(
                    slot.selectionMode
                  ),
                ].join(' ')}
              >
                {constraint.primary}
              </span>

              {constraint.secondary ? (
                <span
                  className={[
                    'truncate',
                    'text-white/45',
                    compact
                      ? 'text-[11px]'
                      : 'text-xs',
                  ].join(' ')}
                  title={
                    constraint.secondary
                  }
                >
                  {
                    constraint.secondary
                  }
                </span>
              ) : null}

              {preview &&
              slot.selectionMode ===
                'venue_pool' &&
              slot.eligibleVenues &&
              slot.eligibleVenues
                .length > 0 ? (
                <span
                  className={[
                    'basis-full',
                    'pt-0.5',
                    'text-white/35',
                    compact
                      ? 'text-[10px]'
                      : 'text-[11px]',
                  ].join(' ')}
                >
                  {slot.eligibleVenues
                    .map(
                      (venue) =>
                        venue.name
                    )
                    .join(' · ')}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelaySlotList({
  slots,
  variant = 'default',
  showPrompts = true,
  showConstraints = true,
  ariaLabel =
    'Relay route stops',
  className,
}: RelaySlotListProps) {
  const orderedSlots =
    getSortedSlots(
      slots
    )

  if (
    orderedSlots.length ===
    0
  ) {
    return (
      <div
        className={
          className
        }
      >
        <EmptyRelaySlotList
          variant={
            variant
          }
        />
      </div>
    )
  }

  return (
    <div
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ol
        aria-label={
          ariaLabel
        }
        className="m-0 list-none p-0"
      >
        {orderedSlots.map(
          (
            slot,
            index
          ) => (
            <RelaySlotListItem
              key={
                slot.id
              }
              slot={
                slot
              }
              variant={
                variant
              }
              showPrompts={
                showPrompts
              }
              showConstraints={
                showConstraints
              }
              isLast={
                index ===
                orderedSlots.length -
                  1
              }
            />
          )
        )}
      </ol>
    </div>
  )
}


export default RelaySlotList