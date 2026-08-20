// components/relay/team/RelayMemberList.tsx

/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayMemberStatus =
  | 'invited'
  | 'joined'
  | 'declined'
  | 'left'
  | 'removed'


export type RelayMemberListItem = {
  id:
    string

  userId:
    string

  label:
    string

  secondaryLabel?:
    string | null

  avatarUrl?:
    string | null

  memberStatus:
    RelayMemberStatus

  joinedAt?:
    string | null

  leftAt?:
    string | null

  createdAt?:
    string | null

  isCaptain?:
    boolean

  isViewer?:
    boolean

  assignedSlotIndex?:
    number | null

  assignedSlotLabel?:
    string | null
}


export type RelayMemberListProps = {
  members:
    RelayMemberListItem[]

  title?:
    string

  description?:
    string | null

  className?:
    string

  compact?:
    boolean

  showAssignment?:
    boolean

  emptyLabel?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayMemberList({
  members,
  title =
    'Team members',
  description =
    'Joined teammates and invitation state for this Relay team.',
  className,
  compact =
    false,
  showAssignment =
    true,
  emptyLabel =
    'No team members yet.',
}: RelayMemberListProps) {
  const sortedMembers =
    [...members].sort(
      compareMembers
    )


  const joinedCount =
    members.filter(
      (
        member
      ) =>
        member.memberStatus ===
        'joined'
    ).length


  const invitedCount =
    members.filter(
      (
        member
      ) =>
        member.memberStatus ===
        'invited'
    ).length


  return (
    <section
      className={[
        'rounded-[26px]',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.025]',
        compact
          ? 'p-4'
          : 'p-5 sm:p-6',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      data-relay-member-list
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            Relay roster
          </p>

          <h2
            className={[
              'font-semibold',
              'tracking-[-0.03em]',
              'text-white',
              compact
                ? 'mt-1.5 text-xl'
                : 'mt-2 text-2xl',
            ].join(
              ' '
            )}
          >
            {title}
          </h2>

          {description ? (
            <p
              className={[
                'text-white/42',
                compact
                  ? 'mt-1.5 text-xs leading-5'
                  : 'mt-2 text-sm leading-6',
              ].join(
                ' '
              )}
            >
              {description}
            </p>
          ) : null}
        </div>


        <div className="flex shrink-0 gap-2">
          <RosterCount
            label="Joined"
            value={
              joinedCount
            }
            tone="emerald"
          />

          {invitedCount >
          0 ? (
            <RosterCount
              label="Invited"
              value={
                invitedCount
              }
              tone="amber"
            />
          ) : null}
        </div>
      </div>


      {/* ======================================================
       * MEMBER LIST
       * ====================================================== */}

      {sortedMembers.length >
      0 ? (
        <div
          className={[
            'grid',
            compact
              ? 'mt-4 gap-2'
              : 'mt-5 gap-3',
          ].join(
            ' '
          )}
        >
          {sortedMembers.map(
            (
              member
            ) => (
              <RelayMemberRow
                key={
                  member.id
                }
                member={
                  member
                }
                compact={
                  compact
                }
                showAssignment={
                  showAssignment
                }
              />
            )
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
          <p className="text-sm font-medium text-white/38">
            {emptyLabel}
          </p>
        </div>
      )}
    </section>
  )
}


/* ============================================================
 * MEMBER ROW
 * ============================================================
 */

function RelayMemberRow({
  member,
  compact,
  showAssignment,
}: {
  member:
    RelayMemberListItem

  compact:
    boolean

  showAssignment:
    boolean
}) {
  const statusPresentation =
    getMemberStatusPresentation(
      member.memberStatus
    )


  const assignmentLabel =
    getAssignmentLabel(
      member
    )


  const timestampLabel =
    getMemberTimestampLabel(
      member
    )


  return (
    <article
      className={[
        'rounded-2xl',
        'border',
        'border-white/[0.07]',
        'bg-black/15',
        compact
          ? 'p-3'
          : 'p-4',
      ].join(
        ' '
      )}
      data-relay-member-status={
        member.memberStatus
      }
    >
      <div className="flex items-start gap-3">
        <MemberAvatar
          label={
            member.label
          }
          avatarUrl={
            member.avatarUrl
          }
          compact={
            compact
          }
        />


        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={[
                    'truncate',
                    'font-semibold',
                    'text-white/78',
                    compact
                      ? 'text-xs'
                      : 'text-sm',
                  ].join(
                    ' '
                  )}
                >
                  {member.isViewer
                    ? 'You'
                    : member.label}
                </p>


                {member.isCaptain ? (
                  <span className="rounded-full border border-amber-300/12 bg-amber-300/[0.045] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/58">
                    Captain
                  </span>
                ) : null}


                {member.isViewer &&
                !member.isCaptain ? (
                  <span className="rounded-full border border-violet-300/12 bg-violet-300/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-100/52">
                    You
                  </span>
                ) : null}
              </div>


              {member.secondaryLabel ? (
                <p className="mt-0.5 truncate text-xs text-white/28">
                  {
                    member.secondaryLabel
                  }
                </p>
              ) : null}
            </div>


            <span
              className={[
                'inline-flex',
                'shrink-0',
                'items-center',
                'gap-1.5',
                'rounded-full',
                'border',
                'px-2.5',
                'py-1',
                'text-[9px]',
                'font-semibold',
                'uppercase',
                'tracking-[0.12em]',
                statusPresentation.className,
              ].join(
                ' '
              )}
            >
              <span
                aria-hidden="true"
                className={[
                  'h-1.5',
                  'w-1.5',
                  'rounded-full',
                  statusPresentation.dotClassName,
                ].join(
                  ' '
                )}
              />

              {
                statusPresentation.label
              }
            </span>
          </div>


          {(showAssignment ||
            timestampLabel) ? (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {showAssignment ? (
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
                      Relay leg
                    </p>

                    <p
                      className={[
                        'mt-1',
                        'truncate',
                        assignmentLabel
                          ? 'text-white/58'
                          : 'text-white/28',
                        compact
                          ? 'text-[11px]'
                          : 'text-xs',
                      ].join(
                        ' '
                      )}
                    >
                      {
                        assignmentLabel ??
                        getUnassignedLabel(
                          member.memberStatus
                        )
                      }
                    </p>
                  </div>
                ) : null}


                {timestampLabel ? (
                  <p className="shrink-0 text-[10px] text-white/24">
                    {
                      timestampLabel
                    }
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}


/* ============================================================
 * AVATAR
 * ============================================================
 */

function MemberAvatar({
  label,
  avatarUrl,
  compact,
}: {
  label:
    string

  avatarUrl?:
    string | null

  compact:
    boolean
}) {
  const fallback =
    label
      .trim()
      .charAt(
        0
      )
      .toUpperCase() ||
    '?'


  const sizeClassName =
    compact
      ? 'h-9 w-9'
      : 'h-11 w-11'


  if (
    avatarUrl
  ) {
    return (
      <div
        aria-hidden="true"
        className={[
          sizeClassName,
          'shrink-0',
          'rounded-full',
          'border',
          'border-white/[0.08]',
          'bg-cover',
          'bg-center',
          'bg-no-repeat',
        ].join(
          ' '
        )}
        style={{
          backgroundImage:
            `url("${avatarUrl}")`,
        }}
      />
    )
  }


  return (
    <div
      aria-hidden="true"
      className={[
        sizeClassName,
        'flex',
        'shrink-0',
        'items-center',
        'justify-center',
        'rounded-full',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.04]',
        'text-xs',
        'font-semibold',
        'text-white/45',
      ].join(
        ' '
      )}
    >
      {fallback}
    </div>
  )
}


/* ============================================================
 * ROSTER COUNT
 * ============================================================
 */

function RosterCount({
  label,
  value,
  tone,
}: {
  label:
    string

  value:
    number

  tone:
    'emerald'
    | 'amber'
}) {
  const toneClassName =
    tone ===
    'emerald'
      ? 'border-emerald-300/12 bg-emerald-300/[0.035] text-emerald-100/60'
      : 'border-amber-300/12 bg-amber-300/[0.035] text-amber-100/60'


  return (
    <div
      className={[
        'rounded-2xl',
        'border',
        'px-3',
        'py-2.5',
        'text-center',
        toneClassName,
      ].join(
        ' '
      )}
    >
      <p className="text-sm font-semibold">
        {value}
      </p>

      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] opacity-65">
        {label}
      </p>
    </div>
  )
}


/* ============================================================
 * STATUS PRESENTATION
 * ============================================================
 */

function getMemberStatusPresentation(
  status:
    RelayMemberStatus
): {
  label:
    string

  className:
    string

  dotClassName:
    string
} {
  switch (
    status
  ) {
    case 'joined':
      return {
        label:
          'Joined',

        className:
          'border-emerald-300/12 bg-emerald-300/[0.04] text-emerald-100/60',

        dotClassName:
          'bg-emerald-300/80',
      }

    case 'invited':
      return {
        label:
          'Invited',

        className:
          'border-amber-300/12 bg-amber-300/[0.04] text-amber-100/60',

        dotClassName:
          'bg-amber-300/80',
      }

    case 'declined':
      return {
        label:
          'Declined',

        className:
          'border-red-300/10 bg-red-300/[0.03] text-red-100/48',

        dotClassName:
          'bg-red-300/60',
      }

    case 'left':
      return {
        label:
          'Left',

        className:
          'border-white/[0.07] bg-white/[0.025] text-white/38',

        dotClassName:
          'bg-white/30',
      }

    case 'removed':
      return {
        label:
          'Removed',

        className:
          'border-white/[0.07] bg-white/[0.025] text-white/32',

        dotClassName:
          'bg-white/20',
      }
  }
}


/* ============================================================
 * ASSIGNMENT
 * ============================================================
 */

function getAssignmentLabel(
  member:
    RelayMemberListItem
): string | null {
  if (
    member.assignedSlotIndex ===
      null ||
    member.assignedSlotIndex ===
      undefined
  ) {
    return null
  }


  if (
    member.assignedSlotLabel
  ) {
    return `Leg ${member.assignedSlotIndex} · ${member.assignedSlotLabel}`
  }


  return `Leg ${member.assignedSlotIndex}`
}


function getUnassignedLabel(
  status:
    RelayMemberStatus
): string {
  switch (
    status
  ) {
    case 'joined':
      return 'Not assigned yet'

    case 'invited':
      return 'Available after joining'

    case 'declined':
      return 'Invitation declined'

    case 'left':
      return 'Membership ended'

    case 'removed':
      return 'Membership removed'
  }
}


/* ============================================================
 * SORTING
 * ============================================================
 */

function compareMembers(
  left:
    RelayMemberListItem,
  right:
    RelayMemberListItem
): number {
  if (
    left.isCaptain &&
    !right.isCaptain
  ) {
    return -1
  }


  if (
    !left.isCaptain &&
    right.isCaptain
  ) {
    return 1
  }


  if (
    left.isViewer &&
    !right.isViewer
  ) {
    return -1
  }


  if (
    !left.isViewer &&
    right.isViewer
  ) {
    return 1
  }


  const statusDifference =
    getMemberStatusPriority(
      left.memberStatus
    ) -
    getMemberStatusPriority(
      right.memberStatus
    )


  if (
    statusDifference !==
    0
  ) {
    return statusDifference
  }


  const leftTimestamp =
    getSortTimestamp(
      left.createdAt
    )


  const rightTimestamp =
    getSortTimestamp(
      right.createdAt
    )


  if (
    leftTimestamp !==
    rightTimestamp
  ) {
    return (
      leftTimestamp -
      rightTimestamp
    )
  }


  return left.label.localeCompare(
    right.label
  )
}


function getMemberStatusPriority(
  status:
    RelayMemberStatus
): number {
  switch (
    status
  ) {
    case 'joined':
      return 0

    case 'invited':
      return 1

    case 'declined':
      return 2

    case 'left':
      return 3

    case 'removed':
      return 4
  }
}


function getSortTimestamp(
  value:
    string | null | undefined
): number {
  if (
    !value
  ) {
    return Number.MAX_SAFE_INTEGER
  }


  const timestamp =
    new Date(
      value
    ).getTime()


  return Number.isNaN(
    timestamp
  )
    ? Number.MAX_SAFE_INTEGER
    : timestamp
}


/* ============================================================
 * TIMESTAMP
 * ============================================================
 */

function getMemberTimestampLabel(
  member:
    RelayMemberListItem
): string | null {
  if (
    member.memberStatus ===
      'joined' &&
    member.joinedAt
  ) {
    return `Joined ${formatMemberDate(
      member.joinedAt
    )}`
  }


  if (
    member.memberStatus ===
      'left' &&
    member.leftAt
  ) {
    return `Left ${formatMemberDate(
      member.leftAt
    )}`
  }


  if (
    member.memberStatus ===
      'invited' &&
    member.createdAt
  ) {
    return `Invited ${formatMemberDate(
      member.createdAt
    )}`
  }


  return null
}


function formatMemberDate(
  value:
    string
): string {
  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'recently'
  }


  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',
    }
  ).format(
    date
  )
}


export default RelayMemberList