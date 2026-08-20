'use client'

import {
  useFormStatus,
} from 'react-dom'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayReadyBlockerCode =
  | 'team_not_forming'
  | 'roster_incomplete'
  | 'pending_invitations'
  | 'slot_count_mismatch'
  | 'unassigned_slots'
  | 'duplicate_assignments'
  | 'unassigned_members'
  | 'member_not_joined'
  | 'relay_not_available'
  | 'window_closed'
  | 'unknown'


export type RelayReadyBlocker = {
  code:
    RelayReadyBlockerCode

  label:
    string

  description?:
    string | null
}


export type RelayReadyPanelProps = {
  teamId:
    string

  teamStatus:
    | 'forming'
    | 'ready'
    | 'active'
    | 'completed'
    | 'abandoned'
    | 'disqualified'

  joinedMemberCount:
    number

  requiredMemberCount:
    number

  assignedSlotCount:
    number

  requiredSlotCount:
    number

  pendingInvitationCount?:
    number

  blockers?:
    RelayReadyBlocker[]

  /**
   * Must be a server action supplied by the parent.
   *
   * Expected FormData:
   *
   * team_id
   *
   * The action should call the canonical
   * set_roam_relay_team_ready mutation path.
   *
   * The database remains authoritative for:
   * - captain authorization
   * - current team lifecycle
   * - joined roster completeness
   * - one-member-per-slot
   * - one-slot-per-member
   * - Relay availability/window
   * - concurrent roster/assignment changes
   */
  readyAction:
    (
      formData:
        FormData
    ) => Promise<void>

  canSetReady?:
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
 * COMPONENT
 * ============================================================
 */

export function RelayReadyPanel({
  teamId,
  teamStatus,
  joinedMemberCount,
  requiredMemberCount,
  assignedSlotCount,
  requiredSlotCount,
  pendingInvitationCount =
    0,
  blockers = [],
  readyAction,
  canSetReady =
    true,
  lockedReason =
    null,
  title =
    'Ready the team',
  description =
    'Confirm the roster and Relay leg assignments before locking the team into its ready state.',
  className,
}: RelayReadyPanelProps) {
  const rosterComplete =
    requiredMemberCount >
      0 &&
    joinedMemberCount ===
      requiredMemberCount

  const assignmentsComplete =
    requiredSlotCount >
      0 &&
    assignedSlotCount ===
      requiredSlotCount

  const teamAlreadyReady =
    teamStatus ===
      'ready' ||
    teamStatus ===
      'active' ||
    teamStatus ===
      'completed'

  const terminalTeam =
    teamStatus ===
      'abandoned' ||
    teamStatus ===
      'disqualified'

  const structuralReady =
    rosterComplete &&
    assignmentsComplete &&
    blockers.length ===
      0

  const canSubmit =
    teamStatus ===
      'forming' &&
    structuralReady &&
    canSetReady &&
    !terminalTeam

  const effectiveLockedReason =
    lockedReason ??
    getDefaultLockedReason({
      teamStatus,
      canSetReady,
      structuralReady,
    })


  return (
    <section
      className={[
        'rounded-[26px]',
        'border',
        teamAlreadyReady
          ? 'border-emerald-300/14 bg-emerald-300/[0.04]'
          : terminalTeam
            ? 'border-red-300/12 bg-red-300/[0.03]'
            : 'border-white/[0.08] bg-white/[0.025]',
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
      data-relay-ready-panel
      data-team-id={
        teamId
      }
      data-team-status={
        teamStatus
      }
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            Team readiness
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            {teamAlreadyReady
              ? getReadyStateTitle(
                  teamStatus
                )
              : title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/42">
            {teamAlreadyReady
              ? getReadyStateDescription(
                  teamStatus
                )
              : description}
          </p>
        </div>


        <ReadyStateBadge
          teamStatus={
            teamStatus
          }
          structuralReady={
            structuralReady
          }
        />
      </div>


      {/* ======================================================
       * READINESS METRICS
       * ====================================================== */}

      <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
        <ReadinessMetric
          label="Joined"
          value={`${joinedMemberCount}/${requiredMemberCount}`}
          complete={
            rosterComplete
          }
        />

        <ReadinessMetric
          label="Assigned"
          value={`${assignedSlotCount}/${requiredSlotCount}`}
          complete={
            assignmentsComplete
          }
        />

        <ReadinessMetric
          label="Invitations"
          value={`${pendingInvitationCount} pending`}
          complete={
            pendingInvitationCount ===
            0
          }
        />
      </dl>


      {/* ======================================================
       * BLOCKERS
       * ====================================================== */}

      {!teamAlreadyReady &&
      blockers.length >
        0 ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                Readiness blockers
              </p>

              <p className="mt-1 text-xs leading-5 text-white/30">
                Resolve every blocker before attempting to mark the
                team ready.
              </p>
            </div>

            <span className="rounded-full border border-amber-300/12 bg-amber-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/55">
              {blockers.length}{' '}
              {blockers.length ===
              1
                ? 'blocker'
                : 'blockers'}
            </span>
          </div>


          <div className="mt-3 space-y-2">
            {blockers.map(
              (
                blocker,
                index
              ) => (
                <ReadinessBlockerRow
                  key={`${blocker.code}-${index}`}
                  blocker={
                    blocker
                  }
                />
              )
            )}
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * STRUCTURAL READY STATE
       * ====================================================== */}

      {!teamAlreadyReady &&
      structuralReady ? (
        <div className="mt-5 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.035] p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300/80"
            />

            <div>
              <p className="text-sm font-semibold text-emerald-100/72">
                Readiness checks complete
              </p>

              <p className="mt-1 text-xs leading-5 text-white/34">
                Every required teammate is joined and every Relay leg
                is assigned. The database will revalidate this state
                transactionally before the team becomes ready.
              </p>
            </div>
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * LOCKED STATE
       * ====================================================== */}

      {!teamAlreadyReady &&
      !canSubmit &&
      effectiveLockedReason ? (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
            Ready action unavailable
          </p>

          <p className="mt-2 text-sm leading-6 text-white/40">
            {
              effectiveLockedReason
            }
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * READY ACTION
       * ====================================================== */}

      {!teamAlreadyReady &&
      !terminalTeam ? (
        <form
          action={
            readyAction
          }
          className="mt-5 border-t border-white/[0.06] pt-5"
        >
          <input
            type="hidden"
            name="team_id"
            value={
              teamId
            }
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-5 text-white/28">
              Setting the team ready should lock in the canonical
              roster and leg-assignment state required for Relay
              execution.
            </p>

            <SetReadySubmitButton
              disabled={
                !canSubmit
              }
            />
          </div>
        </form>
      ) : null}


      {/* ======================================================
       * READY / TERMINAL STATE
       * ====================================================== */}

      {teamAlreadyReady ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="rounded-2xl border border-emerald-300/12 bg-black/15 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-100/42">
              Canonical state
            </p>

            <p className="mt-1.5 text-sm font-medium text-white/62">
              {getCanonicalStateLabel(
                teamStatus
              )}
            </p>
          </div>
        </div>
      ) : terminalTeam ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="rounded-2xl border border-red-300/10 bg-black/15 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-red-100/38">
              Team closed
            </p>

            <p className="mt-1.5 text-sm font-medium text-white/48">
              {teamStatus ===
              'disqualified'
                ? 'This team cannot become ready because it has been disqualified.'
                : 'This team cannot become ready because it has been abandoned.'}
            </p>
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * INTEGRITY NOTE
       * ====================================================== */}

      <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/22">
        Readiness shown here is presentation state. The
        set_roam_relay_team_ready mutation must revalidate captain
        authorization, team lifecycle, joined membership, assignment
        uniqueness, and Relay availability transactionally.
      </p>
    </section>
  )
}


/* ============================================================
 * READY SUBMIT BUTTON
 * ============================================================
 */

function SetReadySubmitButton({
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
        'focus-visible:ring-emerald-300/40',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070707]',
        unavailable
          ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
          : 'border-emerald-300/18 bg-emerald-300/[0.07] text-emerald-50 hover:border-emerald-300/28 hover:bg-emerald-300/[0.11]',
      ].join(
        ' '
      )}
    >
      {pending
        ? 'Setting team ready…'
        : 'Set team ready'}
    </button>
  )
}


/* ============================================================
 * BLOCKER ROW
 * ============================================================
 */

function ReadinessBlockerRow({
  blocker,
}: {
  blocker:
    RelayReadyBlocker
}) {
  return (
    <article className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.025] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300/70"
        />

        <div>
          <p className="text-sm font-medium text-white/62">
            {
              blocker.label
            }
          </p>

          {blocker.description ? (
            <p className="mt-1 text-xs leading-5 text-white/32">
              {
                blocker.description
              }
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}


/* ============================================================
 * READINESS METRIC
 * ============================================================
 */

function ReadinessMetric({
  label,
  value,
  complete,
}: {
  label:
    string

  value:
    string

  complete:
    boolean
}) {
  return (
    <div className="bg-[#0b0b0b] px-4 py-4">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/24">
        {label}
      </dt>

      <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium text-white/64">
        <span
          aria-hidden="true"
          className={[
            'h-1.5',
            'w-1.5',
            'shrink-0',
            'rounded-full',
            complete
              ? 'bg-emerald-300/80'
              : 'bg-amber-300/65',
          ].join(
            ' '
          )}
        />

        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * READY STATE BADGE
 * ============================================================
 */

function ReadyStateBadge({
  teamStatus,
  structuralReady,
}: {
  teamStatus:
    RelayReadyPanelProps['teamStatus']

  structuralReady:
    boolean
}) {
  const presentation =
    getReadyBadgePresentation({
      teamStatus,
      structuralReady,
    })


  return (
    <span
      className={[
        'inline-flex',
        'min-h-8',
        'shrink-0',
        'items-center',
        'justify-center',
        'rounded-full',
        'border',
        'px-3',
        'text-[10px]',
        'font-semibold',
        'uppercase',
        'tracking-[0.14em]',
        presentation.className,
      ].join(
        ' '
      )}
    >
      {
        presentation.label
      }
    </span>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getReadyBadgePresentation({
  teamStatus,
  structuralReady,
}: {
  teamStatus:
    RelayReadyPanelProps['teamStatus']

  structuralReady:
    boolean
}): {
  label:
    string

  className:
    string
} {
  switch (
    teamStatus
  ) {
    case 'ready':
      return {
        label:
          'Ready',

        className:
          'border-emerald-300/16 bg-emerald-300/[0.05] text-emerald-100/70',
      }

    case 'active':
      return {
        label:
          'Active',

        className:
          'border-emerald-300/16 bg-emerald-300/[0.05] text-emerald-100/70',
      }

    case 'completed':
      return {
        label:
          'Completed',

        className:
          'border-violet-300/16 bg-violet-300/[0.05] text-violet-100/70',
      }

    case 'abandoned':
      return {
        label:
          'Abandoned',

        className:
          'border-red-300/12 bg-red-300/[0.035] text-red-100/55',
      }

    case 'disqualified':
      return {
        label:
          'Disqualified',

        className:
          'border-red-300/12 bg-red-300/[0.035] text-red-100/55',
      }

    case 'forming':
    default:
      return structuralReady
        ? {
            label:
              'Checks complete',

            className:
              'border-emerald-300/14 bg-emerald-300/[0.045] text-emerald-100/64',
          }
        : {
            label:
              'Not ready',

            className:
              'border-amber-300/12 bg-amber-300/[0.04] text-amber-100/55',
          }
  }
}


function getDefaultLockedReason({
  teamStatus,
  canSetReady,
  structuralReady,
}: {
  teamStatus:
    RelayReadyPanelProps['teamStatus']

  canSetReady:
    boolean

  structuralReady:
    boolean
}): string | null {
  if (
    teamStatus !==
    'forming'
  ) {
    switch (
      teamStatus
    ) {
      case 'ready':
        return 'This team is already ready.'

      case 'active':
        return 'This Relay has already started.'

      case 'completed':
        return 'This Relay team has already completed its route.'

      case 'abandoned':
        return 'This Relay team has been abandoned.'

      case 'disqualified':
        return 'This Relay team has been disqualified.'
    }
  }


  if (
    !canSetReady
  ) {
    return 'Only an authorized captain can set this Relay team ready.'
  }


  if (
    !structuralReady
  ) {
    return 'Resolve the readiness blockers before setting this team ready.'
  }


  return null
}


function getReadyStateTitle(
  teamStatus:
    RelayReadyPanelProps['teamStatus']
): string {
  switch (
    teamStatus
  ) {
    case 'ready':
      return 'The team is ready.'

    case 'active':
      return 'The Relay is underway.'

    case 'completed':
      return 'The Relay is complete.'

    case 'forming':
      return 'Ready the team'

    case 'abandoned':
      return 'The team was abandoned.'

    case 'disqualified':
      return 'The team was disqualified.'
  }
}


function getReadyStateDescription(
  teamStatus:
    RelayReadyPanelProps['teamStatus']
): string {
  switch (
    teamStatus
  ) {
    case 'ready':
      return 'The canonical roster and Relay leg assignments passed readiness validation.'

    case 'active':
      return 'Readiness has already been resolved and Relay execution has started.'

    case 'completed':
      return 'Readiness and execution are complete for this team.'

    case 'forming':
      return 'Confirm the roster and Relay leg assignments before locking the team into its ready state.'

    case 'abandoned':
      return 'This team can no longer advance into the ready state.'

    case 'disqualified':
      return 'This team can no longer advance into the ready state.'
  }
}


function getCanonicalStateLabel(
  teamStatus:
    RelayReadyPanelProps['teamStatus']
): string {
  switch (
    teamStatus
  ) {
    case 'ready':
      return 'Ready for Relay execution'

    case 'active':
      return 'Relay execution active'

    case 'completed':
      return 'Relay execution completed'

    case 'forming':
      return 'Team still forming'

    case 'abandoned':
      return 'Team abandoned'

    case 'disqualified':
      return 'Team disqualified'
  }
}


export default RelayReadyPanel