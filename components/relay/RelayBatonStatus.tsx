// components/relay/RelayBatonStatus.tsx

import type {
  RelayBatonState,
  RelayTeamSlot,
  UserId,
} from '@/lib/relay/types'
import {
  formatRelayBatonActionText,
  formatRelayBatonStatus,
  formatRelaySlotHeading,
} from '@/lib/relay/format'
import RelayStatusBadge from '@/components/relay/RelayStatusBadge'


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayBatonStatusVariant =
  | 'default'
  | 'compact'


export type RelayBatonStatusProps = {
  baton:
    RelayBatonState

  slots:
    RelayTeamSlot[]

  /**
   * Optional current viewer.
   *
   * Used only for presentation copy such as:
   *
   *   Your leg is live
   *
   * Never use this component for authorization.
   */
  viewerUserId?:
    UserId | null

  /**
   * When profile display data is already resolved on team-slot
   * assignedUser, this component can show a teammate name.
   */
  showAssigneeNames?:
    boolean

  variant?:
    RelayBatonStatusVariant

  ariaLabel?:
    string

  className?:
    string
}


/* ============================================================
 * INTERNAL DISPLAY MODEL
 * ============================================================
 */

type RelayBatonTimelineItem = {
  slot:
    RelayTeamSlot

  relation:
    | 'completed'
    | 'current'
    | 'next'
    | 'later'
    | 'unavailable'
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getOrderedSlots(
  slots: RelayTeamSlot[]
): RelayTeamSlot[] {
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


function getAssignedUserName(
  slot:
    RelayTeamSlot
): string | null {
  const displayName =
    slot.assignedUser
      ?.displayName
      ?.trim()

  return displayName || null
}


function getActiveSlot(
  baton:
    RelayBatonState,
  slots:
    RelayTeamSlot[]
): RelayTeamSlot | null {
  if (
    baton.state !==
    'active'
  ) {
    return null
  }

  return (
    slots.find(
      (slot) =>
        slot.id ===
        baton.activeTeamSlotId
    ) ??
    null
  )
}


function getNextLockedSlot(
  activeSlot:
    RelayTeamSlot | null,
  slots:
    RelayTeamSlot[]
): RelayTeamSlot | null {
  if (!activeSlot) {
    return null
  }

  return (
    slots.find(
      (slot) =>
        slot.slotIndex >
          activeSlot.slotIndex &&
        slot.status ===
          'locked'
    ) ??
    null
  )
}


function buildTimeline(
  baton:
    RelayBatonState,
  slots:
    RelayTeamSlot[]
): RelayBatonTimelineItem[] {
  const orderedSlots =
    getOrderedSlots(
      slots
    )

  if (
    baton.state ===
    'completed'
  ) {
    return orderedSlots.map(
      (slot) => ({
        slot,
        relation:
          slot.status ===
          'completed'
            ? 'completed'
            : 'unavailable',
      })
    )
  }

  if (
    baton.state !==
    'active'
  ) {
    return orderedSlots.map(
      (slot) => ({
        slot,
        relation:
          slot.status ===
          'completed'
            ? 'completed'
            : 'unavailable',
      })
    )
  }

  const activeSlot =
    getActiveSlot(
      baton,
      orderedSlots
    )

  if (!activeSlot) {
    return orderedSlots.map(
      (slot) => ({
        slot,
        relation:
          slot.status ===
          'completed'
            ? 'completed'
            : 'unavailable',
      })
    )
  }

  const nextLockedSlot =
    getNextLockedSlot(
      activeSlot,
      orderedSlots
    )

  return orderedSlots.map(
    (slot) => {
      if (
        slot.status ===
        'completed'
      ) {
        return {
          slot,
          relation:
            'completed',
        }
      }

      if (
        slot.id ===
        activeSlot.id
      ) {
        return {
          slot,
          relation:
            'current',
        }
      }

      if (
        nextLockedSlot &&
        slot.id ===
          nextLockedSlot.id
      ) {
        return {
          slot,
          relation:
            'next',
        }
      }

      if (
        slot.slotIndex >
        activeSlot.slotIndex
      ) {
        return {
          slot,
          relation:
            'later',
        }
      }

      return {
        slot,
        relation:
          'unavailable',
      }
    }
  )
}


function getRelationLabel(
  relation:
    RelayBatonTimelineItem['relation']
): string {
  switch (relation) {
    case 'completed':
      return 'Done'

    case 'current':
      return 'Baton'

    case 'next':
      return 'Next'

    case 'later':
      return 'Locked'

    case 'unavailable':
      return 'Unavailable'
  }
}


function getRelationToneClasses(
  relation:
    RelayBatonTimelineItem['relation']
): string {
  switch (relation) {
    case 'completed':
      return [
        'border-emerald-300/14',
        'bg-emerald-300/[0.055]',
        'text-emerald-100/72',
      ].join(' ')

    case 'current':
      return [
        'border-amber-300/20',
        'bg-amber-300/[0.085]',
        'text-amber-100',
        'shadow-[0_0_20px_rgba(251,191,36,0.07)]',
      ].join(' ')

    case 'next':
      return [
        'border-sky-300/14',
        'bg-sky-300/[0.055]',
        'text-sky-100/78',
      ].join(' ')

    case 'later':
      return [
        'border-white/[0.07]',
        'bg-white/[0.025]',
        'text-white/42',
      ].join(' ')

    case 'unavailable':
      return [
        'border-white/[0.06]',
        'bg-white/[0.018]',
        'text-white/30',
      ].join(' ')
  }
}


function getTimelineConnectorClasses(
  relation:
    RelayBatonTimelineItem['relation']
): string {
  switch (relation) {
    case 'completed':
      return [
        'from-emerald-300/24',
        'via-emerald-300/12',
        'to-white/[0.05]',
      ].join(' ')

    case 'current':
      return [
        'from-amber-300/25',
        'via-amber-300/10',
        'to-white/[0.05]',
      ].join(' ')

    case 'next':
    case 'later':
    case 'unavailable':
      return [
        'from-white/10',
        'via-white/[0.06]',
        'to-white/[0.03]',
      ].join(' ')
  }
}


/* ============================================================
 * SUMMARY HEADER
 * ============================================================
 */

function RelayBatonSummary({
  baton,
  activeSlot,
  viewerUserId,
  showAssigneeNames,
  compact,
}: {
  baton:
    RelayBatonState

  activeSlot:
    RelayTeamSlot | null

  viewerUserId:
    UserId | null

  showAssigneeNames:
    boolean

  compact:
    boolean
}) {
  const activeUserName =
    (
      showAssigneeNames &&
      activeSlot
    )
      ? getAssignedUserName(
          activeSlot
        )
      : null

  const activeSlotLabel =
    activeSlot
      ? formatRelaySlotHeading(
          activeSlot.slotIndex,
          activeSlot.template.label
        )
      : null

  const statusText =
    formatRelayBatonStatus(
      baton,
      {
        activeUserName,
        activeSlotLabel,
      }
    )

  const actionText =
    formatRelayBatonActionText(
      baton,
      viewerUserId
    )

  const viewerOwnsBaton =
    Boolean(
      baton.state ===
        'active' &&
      viewerUserId &&
      baton.activeUserId ===
        viewerUserId
    )

  return (
    <div
      className={[
        'rounded-2xl',
        'border',
        viewerOwnsBaton
          ? [
              'border-amber-300/18',
              'bg-amber-300/[0.055]',
              'shadow-[0_18px_50px_rgba(251,191,36,0.045)]',
            ].join(' ')
          : [
              'border-white/[0.08]',
              'bg-white/[0.03]',
            ].join(' '),
        compact
          ? 'px-4 py-4'
          : 'px-5 py-5 sm:px-6',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={[
              'font-medium',
              'uppercase',
              'tracking-[0.14em]',
              viewerOwnsBaton
                ? 'text-amber-100/72'
                : 'text-white/38',
              compact
                ? 'text-[10px]'
                : 'text-[11px]',
            ].join(' ')}
          >
            Relay baton
          </p>

          <h2
            className={[
              'mt-1.5',
              'font-semibold',
              'tracking-[-0.02em]',
              viewerOwnsBaton
                ? 'text-amber-50'
                : 'text-white',
              compact
                ? 'text-base'
                : 'text-lg sm:text-xl',
            ].join(' ')}
          >
            {actionText}
          </h2>

          <p
            className={[
              'mt-2',
              'max-w-2xl',
              'leading-relaxed',
              viewerOwnsBaton
                ? 'text-amber-50/58'
                : 'text-white/48',
              compact
                ? 'text-xs'
                : 'text-sm',
            ].join(' ')}
          >
            {statusText}
          </p>
        </div>

        {activeSlot ? (
          <RelayStatusBadge
            kind="slot"
            status={
              activeSlot.status
            }
            compact={
              compact
            }
          />
        ) : null}
      </div>
    </div>
  )
}


/* ============================================================
 * TIMELINE ITEM
 * ============================================================
 */

function RelayBatonTimelineItemView({
  item,
  isLast,
  viewerUserId,
  showAssigneeNames,
  compact,
}: {
  item:
    RelayBatonTimelineItem

  isLast:
    boolean

  viewerUserId:
    UserId | null

  showAssigneeNames:
    boolean

  compact:
    boolean
}) {
  const {
    slot,
    relation,
  } = item

  const slotHeading =
    formatRelaySlotHeading(
      slot.slotIndex,
      slot.template.label
    )

  const assignedUserName =
    showAssigneeNames
      ? getAssignedUserName(
          slot
        )
      : null

  const viewerOwnsSlot =
    Boolean(
      viewerUserId &&
      slot.assignedUserId ===
        viewerUserId
    )

  const isCurrent =
    relation ===
    'current'

  const relationLabel =
    getRelationLabel(
      relation
    )

  return (
    <li
      className="relative flex gap-3 sm:gap-4"
      data-relay-team-slot-id={
        slot.id
      }
      data-relay-slot-relation={
        relation
      }
    >
      {/* Rail */}
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
            'font-semibold',
            'tabular-nums',
            getRelationToneClasses(
              relation
            ),
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
              compact
                ? 'top-6'
                : 'top-8',
              'bottom-[-1rem]',
              'w-px',
              'bg-gradient-to-b',
              getTimelineConnectorClasses(
                relation
              ),
            ].join(' ')}
          />
        ) : null}
      </div>

      {/* Content */}
      <div
        className={[
          'min-w-0',
          'flex-1',
          !isLast
            ? compact
              ? 'pb-4'
              : 'pb-5'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            'rounded-2xl',
            'border',
            getRelationToneClasses(
              relation
            ),
            isCurrent
              ? 'shadow-[0_14px_40px_rgba(251,191,36,0.045)]'
              : '',
            compact
              ? 'px-3.5 py-3'
              : 'px-4 py-4',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p
                  className={[
                    'min-w-0',
                    'truncate',
                    'font-semibold',
                    'tracking-[-0.01em]',
                    compact
                      ? 'text-sm'
                      : 'text-[15px]',
                  ].join(' ')}
                  title={
                    slotHeading
                  }
                >
                  {slotHeading}
                </p>

                <span
                  className={[
                    'inline-flex',
                    'shrink-0',
                    'items-center',
                    'rounded-full',
                    'border',
                    'border-current/10',
                    'bg-black/10',
                    'font-medium',
                    'uppercase',
                    'tracking-[0.11em]',
                    compact
                      ? 'px-2 py-1 text-[9px]'
                      : 'px-2.5 py-1.5 text-[10px]',
                  ].join(' ')}
                >
                  {relationLabel}
                </span>
              </div>

              {slot.assignedUserId ? (
                <p
                  className={[
                    'mt-1.5',
                    compact
                      ? 'text-[11px]'
                      : 'text-xs',
                    isCurrent
                      ? 'text-amber-50/60'
                      : 'text-white/42',
                  ].join(' ')}
                >
                  {viewerOwnsSlot
                    ? 'You'
                    : assignedUserName ??
                      'Assigned teammate'}
                </p>
              ) : (
                <p
                  className={[
                    'mt-1.5',
                    compact
                      ? 'text-[11px]'
                      : 'text-xs',
                    'text-white/32',
                  ].join(' ')}
                >
                  Unassigned
                </p>
              )}
            </div>

            <RelayStatusBadge
              kind="slot"
              status={
                slot.status
              }
              compact
            />
          </div>

          {slot.venue?.name ? (
            <p
              className={[
                'mt-2.5',
                'truncate',
                compact
                  ? 'text-[11px]'
                  : 'text-xs',
                slot.status ===
                  'completed'
                  ? 'text-emerald-50/55'
                  : 'text-white/36',
              ].join(' ')}
              title={
                slot.venue.name
              }
            >
              {slot.venue.name}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}


/* ============================================================
 * EMPTY STATE
 * ============================================================
 */

function EmptyRelayBatonStatus({
  compact,
}: {
  compact:
    boolean
}) {
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
          'text-white/50',
          compact
            ? 'text-xs'
            : 'text-sm',
        ].join(' ')}
      >
        Baton status is unavailable.
      </p>
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayBatonStatus({
  baton,
  slots,
  viewerUserId = null,
  showAssigneeNames = true,
  variant = 'default',
  ariaLabel =
    'Relay baton status',
  className,
}: RelayBatonStatusProps) {
  const compact =
    variant ===
    'compact'

  const orderedSlots =
    getOrderedSlots(
      slots
    )

  if (
    orderedSlots.length ===
    0
  ) {
    return (
      <section
        aria-label={
          ariaLabel
        }
        className={
          className
        }
      >
        <EmptyRelayBatonStatus
          compact={
            compact
          }
        />
      </section>
    )
  }

  const activeSlot =
    getActiveSlot(
      baton,
      orderedSlots
    )

  const timeline =
    buildTimeline(
      baton,
      orderedSlots
    )

  return (
    <section
      aria-label={
        ariaLabel
      }
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <RelayBatonSummary
        baton={
          baton
        }
        activeSlot={
          activeSlot
        }
        viewerUserId={
          viewerUserId
        }
        showAssigneeNames={
          showAssigneeNames
        }
        compact={
          compact
        }
      />

      <ol
        className={[
          'm-0',
          'mt-4',
          'list-none',
          'p-0',
          compact
            ? 'mt-3'
            : 'mt-5',
        ].join(' ')}
      >
        {timeline.map(
          (
            item,
            index
          ) => (
            <RelayBatonTimelineItemView
              key={
                item.slot.id
              }
              item={
                item
              }
              isLast={
                index ===
                timeline.length -
                  1
              }
              viewerUserId={
                viewerUserId
              }
              showAssigneeNames={
                showAssigneeNames
              }
              compact={
                compact
              }
            />
          )
        )}
      </ol>
    </section>
  )
}


export default RelayBatonStatus