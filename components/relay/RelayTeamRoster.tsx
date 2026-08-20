// components/relay/RelayTeamRoster.tsx

import type {
  RelayTeamMember,
  RelayTeamSlot,
  RelayTeamStatus,
  UserId,
} from '@/lib/relay/types'
import {
  formatRelayMemberStatusLabel,
  formatRelaySlotHeading,
  formatRelayTeamSlotStatusLabel,
} from '@/lib/relay/format'
import RelayStatusBadge from '@/components/relay/RelayStatusBadge'


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayTeamRosterVariant =
  | 'default'
  | 'compact'


export type RelayTeamRosterProps = {
  members:
    RelayTeamMember[]

  slots:
    RelayTeamSlot[]

  captainUserId:
    UserId

  teamStatus:
    RelayTeamStatus

  /**
   * Optional current viewer.
   *
   * Used only for presentation copy such as "You".
   * Never use this component for authorization.
   */
  viewerUserId?:
    UserId | null

  /**
   * Show each joined member's assigned Relay leg when available.
   */
  showAssignments?:
    boolean

  /**
   * Show invited/declined/left/removed members.
   *
   * Consumer/public surfaces may choose false.
   */
  showNonJoinedMembers?:
    boolean

  variant?:
    RelayTeamRosterVariant

  ariaLabel?:
    string

  className?:
    string
}


/* ============================================================
 * INTERNAL DISPLAY MODEL
 * ============================================================
 */

type RelayRosterEntry = {
  member:
    RelayTeamMember

  assignedSlot:
    RelayTeamSlot | null

  isCaptain:
    boolean

  isViewer:
    boolean
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getDisplayName(
  member: RelayTeamMember,
  isViewer: boolean
): string {
  if (isViewer) {
    return 'You'
  }

  const displayName =
    member.user
      ?.displayName
      ?.trim()

  if (displayName) {
    return displayName
  }

  return 'Teammate'
}


function getInitials(
  member: RelayTeamMember,
  isViewer: boolean
): string {
  if (isViewer) {
    return 'Y'
  }

  const displayName =
    member.user
      ?.displayName
      ?.trim()

  if (!displayName) {
    return 'R'
  }

  const words =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)

  const initials =
    words
      .map(
        (word) =>
          word[0]
            ?.toUpperCase()
      )
      .filter(Boolean)
      .join('')

  return initials || 'R'
}


function getMemberStatusToneClasses(
  member:
    RelayTeamMember
): string {
  switch (
    member.memberStatus
  ) {
    case 'joined':
      return [
        'border-emerald-300/12',
        'bg-emerald-300/[0.055]',
        'text-emerald-100/75',
      ].join(' ')

    case 'invited':
      return [
        'border-sky-300/12',
        'bg-sky-300/[0.055]',
        'text-sky-100/75',
      ].join(' ')

    case 'declined':
      return [
        'border-white/[0.07]',
        'bg-white/[0.025]',
        'text-white/40',
      ].join(' ')

    case 'left':
      return [
        'border-white/[0.07]',
        'bg-white/[0.025]',
        'text-white/40',
      ].join(' ')

    case 'removed':
      return [
        'border-rose-300/12',
        'bg-rose-300/[0.045]',
        'text-rose-100/65',
      ].join(' ')
  }
}


function getRosterEntries(
  members:
    RelayTeamMember[],
  slots:
    RelayTeamSlot[],
  captainUserId:
    UserId,
  viewerUserId:
    UserId | null | undefined
): RelayRosterEntry[] {
  const slotByUserId =
    new Map<
      UserId,
      RelayTeamSlot
    >()

  for (
    const slot
    of slots
  ) {
    if (
      slot.assignedUserId
    ) {
      slotByUserId.set(
        slot.assignedUserId,
        slot
      )
    }
  }

  return members
    .map(
      (
        member
      ): RelayRosterEntry => ({
        member,

        assignedSlot:
          slotByUserId.get(
            member.userId
          ) ??
          null,

        isCaptain:
          member.userId ===
          captainUserId,

        isViewer:
          Boolean(
            viewerUserId &&
            member.userId ===
              viewerUserId
          ),
      })
    )
    .sort(
      (
        left,
        right
      ) => {
        /*
         * Captain first.
         */
        if (
          left.isCaptain !==
          right.isCaptain
        ) {
          return left.isCaptain
            ? -1
            : 1
        }

        /*
         * Joined members before non-joined members.
         */
        const leftJoined =
          left.member
            .memberStatus ===
          'joined'

        const rightJoined =
          right.member
            .memberStatus ===
          'joined'

        if (
          leftJoined !==
          rightJoined
        ) {
          return leftJoined
            ? -1
            : 1
        }

        /*
         * Assigned joined members follow canonical slot order.
         */
        const leftIndex =
          left.assignedSlot
            ?.slotIndex ??
          Number.MAX_SAFE_INTEGER

        const rightIndex =
          right.assignedSlot
            ?.slotIndex ??
          Number.MAX_SAFE_INTEGER

        if (
          leftIndex !==
          rightIndex
        ) {
          return (
            leftIndex -
            rightIndex
          )
        }

        /*
         * Stable final ordering.
         */
        return (
          new Date(
            left.member
              .createdAt
          ).getTime() -
          new Date(
            right.member
              .createdAt
          ).getTime()
        )
      }
    )
}


/* ============================================================
 * AVATAR
 * ============================================================
 */

function RelayRosterAvatar({
  member,
  isViewer,
  compact,
}: {
  member:
    RelayTeamMember

  isViewer:
    boolean

  compact:
    boolean
}) {
  const imageUrl =
    member.user
      ?.avatarUrl
      ?.trim() ||
    null

  const initials =
    getInitials(
      member,
      isViewer
    )

  return (
    <div
      className={[
        'relative',
        'shrink-0',
        'overflow-hidden',
        'rounded-full',
        'border',
        'border-white/10',
        'bg-white/[0.055]',
        'shadow-[0_8px_30px_rgba(0,0,0,0.22)]',
        compact
          ? 'h-9 w-9'
          : 'h-11 w-11',
      ].join(' ')}
      aria-hidden="true"
    >
      {imageUrl ? (
        // Intentionally using a plain img so this shared component
        // does not require remote-domain configuration in next/image.
        // The surrounding app can replace this later if desired.
        <img
          src={
            imageUrl
          }
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={[
            'grid',
            'h-full',
            'w-full',
            'place-items-center',
            'font-semibold',
            'tracking-[-0.02em]',
            'text-white/72',
            compact
              ? 'text-xs'
              : 'text-sm',
          ].join(' ')}
        >
          {initials}
        </div>
      )}
    </div>
  )
}


/* ============================================================
 * ASSIGNMENT DISPLAY
 * ============================================================
 */

function RelayRosterAssignment({
  slot,
  compact,
}: {
  slot:
    RelayTeamSlot

  compact:
    boolean
}) {
  const label =
    formatRelaySlotHeading(
      slot.slotIndex,
      slot.template.label
    )

  return (
    <div
      className={[
        'mt-2.5',
        'flex',
        'min-w-0',
        'flex-wrap',
        'items-center',
        'gap-2',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex',
          'min-w-0',
          'items-center',
          'rounded-full',
          'border',
          'border-white/[0.08]',
          'bg-white/[0.035]',
          'font-medium',
          'text-white/60',
          compact
            ? 'max-w-[15rem] px-2 py-1 text-[10px]'
            : 'max-w-[20rem] px-2.5 py-1.5 text-[11px]',
        ].join(' ')}
        title={
          label
        }
      >
        <span className="truncate">
          {label}
        </span>
      </span>

      <RelayStatusBadge
        kind="slot"
        status={
          slot.status
        }
        compact
      />
    </div>
  )
}


/* ============================================================
 * ROSTER ITEM
 * ============================================================
 */

function RelayTeamRosterItem({
  entry,
  teamStatus,
  showAssignments,
  compact,
}: {
  entry:
    RelayRosterEntry

  teamStatus:
    RelayTeamStatus

  showAssignments:
    boolean

  compact:
    boolean
}) {
  const {
    member,
    assignedSlot,
    isCaptain,
    isViewer,
  } = entry

  const displayName =
    getDisplayName(
      member,
      isViewer
    )

  const memberStatusLabel =
    formatRelayMemberStatusLabel(
      member.memberStatus
    )

  const showUnassigned =
    (
      showAssignments &&
      member.memberStatus ===
        'joined' &&
      !assignedSlot &&
      (
        teamStatus ===
          'forming' ||
        teamStatus ===
          'ready'
      )
    )

  return (
    <li
      className={[
        'rounded-2xl',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.03]',
        'transition-colors',
        'hover:border-white/[0.11]',
        'hover:bg-white/[0.04]',
        compact
          ? 'px-3 py-3'
          : 'px-4 py-4',
      ].join(' ')}
      data-relay-team-member-id={
        member.id
      }
      data-relay-user-id={
        member.userId
      }
      data-relay-member-status={
        member.memberStatus
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        <RelayRosterAvatar
          member={
            member
          }
          isViewer={
            isViewer
          }
          compact={
            compact
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className={[
                'min-w-0',
                'truncate',
                'font-semibold',
                'tracking-[-0.01em]',
                'text-white',
                compact
                  ? 'text-sm'
                  : 'text-[15px]',
              ].join(' ')}
              title={
                displayName
              }
            >
              {displayName}
            </p>

            {isCaptain ? (
              <span
                className={[
                  'inline-flex',
                  'shrink-0',
                  'items-center',
                  'rounded-full',
                  'border',
                  'border-amber-300/12',
                  'bg-amber-300/[0.055]',
                  'font-medium',
                  'uppercase',
                  'tracking-[0.11em]',
                  'text-amber-100/75',
                  compact
                    ? 'px-2 py-1 text-[9px]'
                    : 'px-2.5 py-1.5 text-[10px]',
                ].join(' ')}
              >
                Captain
              </span>
            ) : null}

            <span
              className={[
                'inline-flex',
                'shrink-0',
                'items-center',
                'rounded-full',
                'border',
                'font-medium',
                'uppercase',
                'tracking-[0.11em]',
                compact
                  ? 'px-2 py-1 text-[9px]'
                  : 'px-2.5 py-1.5 text-[10px]',
                getMemberStatusToneClasses(
                  member
                ),
              ].join(' ')}
            >
              {memberStatusLabel}
            </span>
          </div>

          {showAssignments &&
          assignedSlot ? (
            <RelayRosterAssignment
              slot={
                assignedSlot
              }
              compact={
                compact
              }
            />
          ) : null}

          {showUnassigned ? (
            <p
              className={[
                'mt-2',
                'text-white/38',
                compact
                  ? 'text-[11px]'
                  : 'text-xs',
              ].join(' ')}
            >
              No Relay leg assigned yet.
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

function EmptyRelayTeamRoster({
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
        No teammates yet.
      </p>
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayTeamRoster({
  members,
  slots,
  captainUserId,
  teamStatus,
  viewerUserId = null,
  showAssignments = true,
  showNonJoinedMembers = true,
  variant = 'default',
  ariaLabel =
    'Relay team roster',
  className,
}: RelayTeamRosterProps) {
  const compact =
    variant ===
    'compact'

  const entries =
    getRosterEntries(
      members,
      slots,
      captainUserId,
      viewerUserId
    )
      .filter(
        (entry) =>
          showNonJoinedMembers
            ? true
            : entry.member
                .memberStatus ===
              'joined'
      )

  if (
    entries.length ===
    0
  ) {
    return (
      <div
        className={
          className
        }
      >
        <EmptyRelayTeamRoster
          compact={
            compact
          }
        />
      </div>
    )
  }

  const joinedCount =
    entries.filter(
      (entry) =>
        entry.member
          .memberStatus ===
        'joined'
    ).length

  const assignedCount =
    entries.filter(
      (entry) =>
        entry.member
          .memberStatus ===
          'joined' &&
        entry.assignedSlot
    ).length

  return (
    <section
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={
        ariaLabel
      }
    >
      <div
        className={[
          'mb-3',
          'flex',
          'items-end',
          'justify-between',
          'gap-3',
        ].join(' ')}
      >
        <div>
          <p
            className={[
              'font-semibold',
              'tracking-[-0.01em]',
              'text-white',
              compact
                ? 'text-sm'
                : 'text-base',
            ].join(' ')}
          >
            Team
          </p>

          <p
            className={[
              'mt-1',
              'text-white/40',
              compact
                ? 'text-[11px]'
                : 'text-xs',
            ].join(' ')}
          >
            {joinedCount}{' '}
            {joinedCount === 1
              ? 'joined teammate'
              : 'joined teammates'}
            {showAssignments
              ? ` · ${assignedCount} assigned`
              : ''}
          </p>
        </div>
      </div>

      <ul
        className={[
          'm-0',
          'grid',
          'list-none',
          'p-0',
          compact
            ? 'gap-2'
            : 'gap-2.5',
        ].join(' ')}
      >
        {entries.map(
          (entry) => (
            <RelayTeamRosterItem
              key={
                entry.member.id
              }
              entry={
                entry
              }
              teamStatus={
                teamStatus
              }
              showAssignments={
                showAssignments
              }
              compact={
                compact
              }
            />
          )
        )}
      </ul>
    </section>
  )
}


export default RelayTeamRoster