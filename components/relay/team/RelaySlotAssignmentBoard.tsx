'use client'

import {
  useMemo,
  useState,
} from 'react'

import {
  useFormStatus,
} from 'react-dom'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayAssignmentMember = {
  userId:
    string

  label:
    string

  secondaryLabel?:
    string | null

  avatarUrl?:
    string | null

  isCaptain?:
    boolean

  isViewer?:
    boolean
}


export type RelayAssignmentSlot = {
  id:
    string

  slotIndex:
    number

  label:
    string

  prompt?:
    string | null

  selectionMode?:
    | 'open'
    | 'category'
    | 'venue_pool'
    | 'exact_venue'

  constraintLabel?:
    string | null

  assignedUserId?:
    string | null
}


export type RelaySlotAssignmentBoardProps = {
  teamId:
    string

  members:
    RelayAssignmentMember[]

  slots:
    RelayAssignmentSlot[]

  /**
   * Must be a server action supplied by the parent.
   *
   * Expected FormData:
   *
   * team_id
   * assignments_json
   *
   * assignments_json is:
   *
   * [
   *   {
   *     "slotId": "uuid",
   *     "userId": "uuid"
   *   }
   * ]
   *
   * The server action / canonical RPC remains authoritative for:
   *
   * - captain authorization
   * - team lifecycle
   * - joined membership
   * - one-member-per-slot
   * - one-slot-per-member
   * - slot ownership
   * - concurrent roster changes
   */
  assignAction:
    (
      formData:
        FormData
    ) => Promise<void>

  canAssign?:
    boolean

  lockedReason?:
    string | null

  title?:
    string

  description?:
    string

  className?:
    string
}


/* ============================================================
 * INTERNAL TYPES
 * ============================================================
 */

type AssignmentMap =
  Record<
    string,
    string
  >


type AssignmentPayloadItem = {
  slotId:
    string

  userId:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelaySlotAssignmentBoard({
  teamId,
  members,
  slots,
  assignAction,
  canAssign = true,
  lockedReason = null,
  title =
    'Assign Relay legs',
  description =
    'Give every joined teammate exactly one Relay leg before the team becomes ready.',
  className,
}: RelaySlotAssignmentBoardProps) {
  const initialAssignments =
    useMemo(
      () =>
        buildInitialAssignments(
          slots
        ),
      [
        slots,
      ]
    )


  const [
    assignments,
    setAssignments,
  ] =
    useState<AssignmentMap>(
      initialAssignments
    )


  const sortedMembers =
    useMemo(
      () =>
        [...members].sort(
          compareMembers
        ),
      [
        members,
      ]
    )


  const sortedSlots =
    useMemo(
      () =>
        [...slots].sort(
          (
            left,
            right
          ) =>
            left.slotIndex -
            right.slotIndex
        ),
      [
        slots,
      ]
    )


  const assignedUserIds =
    Object.values(
      assignments
    ).filter(
      Boolean
    )


  const assignedUserIdSet =
    new Set(
      assignedUserIds
    )


  const allSlotsAssigned =
    sortedSlots.length >
      0 &&
    sortedSlots.every(
      (
        slot
      ) =>
        Boolean(
          assignments[
            slot.id
          ]
        )
    )


  const assignmentsUnique =
    assignedUserIds.length ===
    assignedUserIdSet.size


  const rosterMatchesSlots =
    sortedMembers.length ===
    sortedSlots.length


  const allMembersAssigned =
    sortedMembers.length >
      0 &&
    sortedMembers.every(
      (
        member
      ) =>
        assignedUserIdSet.has(
          member.userId
        )
    )


  const assignmentComplete =
    allSlotsAssigned &&
    assignmentsUnique &&
    rosterMatchesSlots &&
    allMembersAssigned


  const hasChanges =
    !assignmentMapsEqual(
      assignments,
      initialAssignments,
      sortedSlots
    )


  const boardLocked =
    !canAssign


  const assignmentPayload:
    AssignmentPayloadItem[] =
    sortedSlots
      .map(
        (
          slot
        ) => {
          const userId =
            assignments[
              slot.id
            ]


          if (
            !userId
          ) {
            return null
          }


          return {
            slotId:
              slot.id,

            userId,
          }
        }
      )
      .filter(
        (
          value
        ): value is AssignmentPayloadItem =>
          value !==
          null
      )


  const effectiveLockedReason =
    lockedReason ??
    (
      !canAssign
        ? 'Relay leg assignments are currently locked.'
        : null
    )


  return (
    <section
      className={[
        'rounded-[26px]',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.025]',
        'p-5',
        'sm:p-6',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      data-relay-slot-assignment-board
      data-team-id={
        teamId
      }
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            Captain controls
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/42">
            {description}
          </p>
        </div>


        <div className="grid shrink-0 grid-cols-2 gap-2">
          <BoardMetric
            label="Joined"
            value={
              `${sortedMembers.length}`
            }
          />

          <BoardMetric
            label="Legs"
            value={
              `${sortedSlots.length}`
            }
          />
        </div>
      </div>


      {/* ======================================================
       * STRUCTURE WARNING
       * ====================================================== */}

      {!rosterMatchesSlots ? (
        <div className="mt-5 rounded-2xl border border-amber-300/14 bg-amber-300/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/48">
            Roster not ready
          </p>

          <p className="mt-2 text-sm leading-6 text-white/42">
            This Relay requires one joined teammate per leg. There
            are currently {sortedMembers.length}{' '}
            joined teammate
            {sortedMembers.length ===
            1
              ? ''
              : 's'}{' '}
            for {sortedSlots.length}{' '}
            Relay leg
            {sortedSlots.length ===
            1
              ? ''
              : 's'}.
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * LOCKED STATE
       * ====================================================== */}

      {boardLocked ? (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
            Assignments locked
          </p>

          <p className="mt-2 text-sm leading-6 text-white/40">
            {
              effectiveLockedReason
            }
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * ASSIGNMENT FORM
       * ====================================================== */}

      <form
        action={
          assignAction
        }
        className="mt-5"
      >
        <input
          type="hidden"
          name="team_id"
          value={
            teamId
          }
        />

        <input
          type="hidden"
          name="assignments_json"
          value={
            JSON.stringify(
              assignmentPayload
            )
          }
        />


        {sortedSlots.length >
        0 ? (
          <ol className="space-y-3">
            {sortedSlots.map(
              (
                slot
              ) => {
                const selectedUserId =
                  assignments[
                    slot.id
                  ] ??
                  ''


                return (
                  <AssignmentRow
                    key={
                      slot.id
                    }
                    slot={
                      slot
                    }
                    members={
                      sortedMembers
                    }
                    selectedUserId={
                      selectedUserId
                    }
                    assignments={
                      assignments
                    }
                    disabled={
                      boardLocked
                    }
                    onChange={(
                      userId
                    ) => {
                      setAssignments(
                        (
                          current
                        ) => ({
                          ...current,

                          [
                            slot.id
                          ]:
                            userId,
                        })
                      )
                    }}
                  />
                )
              }
            )}
          </ol>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
            <p className="text-sm font-medium text-white/38">
              No Relay legs available.
            </p>
          </div>
        )}


        {/* ====================================================
         * COMPLETENESS
         * ==================================================== */}

        {sortedSlots.length >
        0 ? (
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
                  Assignment state
                </p>

                <p
                  className={[
                    'mt-1.5',
                    'text-sm',
                    'font-medium',
                    assignmentComplete
                      ? 'text-emerald-100/68'
                      : 'text-white/46',
                  ].join(
                    ' '
                  )}
                >
                  {assignmentComplete
                    ? 'Every joined teammate owns exactly one Relay leg.'
                    : getIncompleteAssignmentLabel({
                        allSlotsAssigned,
                        assignmentsUnique,
                        rosterMatchesSlots,
                        allMembersAssigned,
                      })}
                </p>
              </div>


              <div className="flex flex-wrap gap-2">
                <StateChip
                  label="Every leg"
                  complete={
                    allSlotsAssigned
                  }
                />

                <StateChip
                  label="Unique"
                  complete={
                    assignmentsUnique
                  }
                />

                <StateChip
                  label="Every member"
                  complete={
                    allMembersAssigned &&
                    rosterMatchesSlots
                  }
                />
              </div>
            </div>
          </div>
        ) : null}


        {/* ====================================================
         * SAVE
         * ==================================================== */}

        {!boardLocked &&
        sortedSlots.length >
          0 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-5 text-white/28">
              Saving replaces the team&apos;s current assignment
              mapping through the canonical Relay mutation path.
            </p>

            <AssignmentSubmitButton
              disabled={
                !assignmentComplete ||
                !hasChanges
              }
            />
          </div>
        ) : null}
      </form>


      {/* ======================================================
       * INTEGRITY NOTE
       * ====================================================== */}

      <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/22">
        The browser prevents obvious duplicate assignments, but the
        server action and Relay RPC must revalidate that every
        assignee is still joined, every slot belongs to this team,
        and each member owns exactly one leg.
      </p>
    </section>
  )
}


/* ============================================================
 * ASSIGNMENT ROW
 * ============================================================
 */

function AssignmentRow({
  slot,
  members,
  selectedUserId,
  assignments,
  disabled,
  onChange,
}: {
  slot:
    RelayAssignmentSlot

  members:
    RelayAssignmentMember[]

  selectedUserId:
    string

  assignments:
    AssignmentMap

  disabled:
    boolean

  onChange:
    (
      userId:
        string
    ) => void
}) {
  const selectedMember =
    members.find(
      (
        member
      ) =>
        member.userId ===
        selectedUserId
    ) ??
    null


  return (
    <li className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
              Leg {
                slot.slotIndex
              }
            </span>

            {slot.selectionMode ? (
              <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.11em] text-white/34">
                {formatSelectionMode(
                  slot.selectionMode
                )}
              </span>
            ) : null}
          </div>


          <h3 className="mt-2 text-lg font-semibold text-white/82">
            {
              slot.label
            }
          </h3>


          {slot.prompt ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/38">
              {
                slot.prompt
              }
            </p>
          ) : null}


          {slot.constraintLabel ? (
            <p className="mt-2 text-xs leading-5 text-amber-100/42">
              {
                slot.constraintLabel
              }
            </p>
          ) : null}
        </div>


        <div>
          <label
            htmlFor={
              `relay-slot-${slot.id}`
            }
            className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/24"
          >
            Assigned teammate
          </label>

          <select
            id={
              `relay-slot-${slot.id}`
            }
            value={
              selectedUserId
            }
            disabled={
              disabled
            }
            onChange={(
              event
            ) => {
              onChange(
                event.target.value
              )
            }}
            className={[
              'mt-2',
              'min-h-11',
              'w-full',
              'rounded-xl',
              'border',
              'border-white/[0.09]',
              'bg-[#0b0b0b]',
              'px-3',
              'text-sm',
              'text-white/70',
              'outline-none',
              'transition',
              'focus:border-amber-300/30',
              'focus:ring-2',
              'focus:ring-amber-300/15',
              disabled
                ? 'cursor-not-allowed opacity-45'
                : '',
            ]
              .filter(
                Boolean
              )
              .join(
                ' '
              )}
          >
            <option value="">
              Select teammate
            </option>

            {members.map(
              (
                member
              ) => {
                const assignedElsewhere =
                  isUserAssignedElsewhere({
                    assignments,
                    slotId:
                      slot.id,
                    userId:
                      member.userId,
                  })


                return (
                  <option
                    key={
                      member.userId
                    }
                    value={
                      member.userId
                    }
                    disabled={
                      assignedElsewhere
                    }
                  >
                    {getMemberOptionLabel(
                      member
                    )}
                  </option>
                )
              }
            )}
          </select>


          {selectedMember ? (
            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" />

              {selectedMember.isViewer
                ? 'Assigned to you'
                : selectedMember.isCaptain
                  ? 'Assigned to captain'
                  : 'Assigned'}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/24">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />

              Unassigned
            </div>
          )}
        </div>
      </div>
    </li>
  )
}


/* ============================================================
 * SUBMIT BUTTON
 * ============================================================
 */

function AssignmentSubmitButton({
  disabled,
}: {
  disabled:
    boolean
}) {
  const {
    pending,
  } =
    useFormStatus()


  const unavailable =
    disabled ||
    pending


  return (
    <button
      type="submit"
      disabled={
        unavailable
      }
      className={[
        'inline-flex',
        'min-h-11',
        'shrink-0',
        'items-center',
        'justify-center',
        'rounded-full',
        'border',
        'px-5',
        'text-sm',
        'font-semibold',
        'transition',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-amber-300/40',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070707]',
        unavailable
          ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
          : 'border-amber-300/20 bg-amber-300/[0.09] text-amber-50 hover:border-amber-300/30 hover:bg-amber-300/[0.14]',
      ].join(
        ' '
      )}
    >
      {pending
        ? 'Saving assignments…'
        : disabled
          ? 'Assignments unchanged'
          : 'Save assignments'}
    </button>
  )
}


/* ============================================================
 * METRICS
 * ============================================================
 */

function BoardMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-[72px] rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-2.5 text-center">
      <p className="text-sm font-semibold text-white/68">
        {value}
      </p>

      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/24">
        {label}
      </p>
    </div>
  )
}


/* ============================================================
 * STATE CHIP
 * ============================================================
 */

function StateChip({
  label,
  complete,
}: {
  label:
    string

  complete:
    boolean
}) {
  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'gap-1.5',
        'rounded-full',
        'border',
        'px-2.5',
        'py-1',
        'text-[9px]',
        'font-semibold',
        'uppercase',
        'tracking-[0.11em]',
        complete
          ? 'border-emerald-300/12 bg-emerald-300/[0.04] text-emerald-100/58'
          : 'border-white/[0.07] bg-white/[0.025] text-white/30',
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
          complete
            ? 'bg-emerald-300/75'
            : 'bg-white/20',
        ].join(
          ' '
        )}
      />

      {label}
    </span>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function buildInitialAssignments(
  slots:
    RelayAssignmentSlot[]
): AssignmentMap {
  const assignments:
    AssignmentMap = {}


  for (
    const slot
    of slots
  ) {
    assignments[
      slot.id
    ] =
      slot.assignedUserId ??
      ''
  }


  return assignments
}


function assignmentMapsEqual(
  current:
    AssignmentMap,
  initial:
    AssignmentMap,
  slots:
    RelayAssignmentSlot[]
): boolean {
  return slots.every(
    (
      slot
    ) =>
      (
        current[
          slot.id
        ] ??
        ''
      ) ===
      (
        initial[
          slot.id
        ] ??
        ''
      )
  )
}


function isUserAssignedElsewhere({
  assignments,
  slotId,
  userId,
}: {
  assignments:
    AssignmentMap

  slotId:
    string

  userId:
    string
}): boolean {
  return Object.entries(
    assignments
  ).some(
    (
      [
        candidateSlotId,
        assignedUserId,
      ]
    ) =>
      candidateSlotId !==
        slotId &&
      assignedUserId ===
        userId
  )
}


function compareMembers(
  left:
    RelayAssignmentMember,
  right:
    RelayAssignmentMember
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


  return left.label.localeCompare(
    right.label
  )
}


function getMemberOptionLabel(
  member:
    RelayAssignmentMember
): string {
  const suffixes:
    string[] = []


  if (
    member.isCaptain
  ) {
    suffixes.push(
      'Captain'
    )
  }


  if (
    member.isViewer
  ) {
    suffixes.push(
      'You'
    )
  }


  if (
    suffixes.length ===
    0
  ) {
    return member.label
  }


  return `${member.label} · ${suffixes.join(
    ' · '
  )}`
}


function formatSelectionMode(
  value:
    NonNullable<
      RelayAssignmentSlot[
        'selectionMode'
      ]
    >
): string {
  switch (
    value
  ) {
    case 'open':
      return 'Open venue'

    case 'category':
      return 'Category'

    case 'venue_pool':
      return 'Venue pool'

    case 'exact_venue':
      return 'Exact venue'
  }
}


function getIncompleteAssignmentLabel({
  allSlotsAssigned,
  assignmentsUnique,
  rosterMatchesSlots,
  allMembersAssigned,
}: {
  allSlotsAssigned:
    boolean

  assignmentsUnique:
    boolean

  rosterMatchesSlots:
    boolean

  allMembersAssigned:
    boolean
}): string {
  if (
    !rosterMatchesSlots
  ) {
    return 'The joined roster must match the number of Relay legs.'
  }


  if (
    !allSlotsAssigned
  ) {
    return 'Every Relay leg needs an assigned teammate.'
  }


  if (
    !assignmentsUnique
  ) {
    return 'A teammate cannot own more than one Relay leg.'
  }


  if (
    !allMembersAssigned
  ) {
    return 'Every joined teammate must own exactly one Relay leg.'
  }


  return 'Assignments are incomplete.'
}


export default RelaySlotAssignmentBoard