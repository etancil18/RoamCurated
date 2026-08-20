'use client'

import {
  useFormStatus,
} from 'react-dom'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayStartPanelProps = {
  teamId:
    string

  teamStatus:
    | 'forming'
    | 'ready'
    | 'active'
    | 'completed'
    | 'abandoned'
    | 'disqualified'

  relayStatus:
    | 'draft'
    | 'scheduled'
    | 'live'
    | 'completed'
    | 'cancelled'

  relayStartsAt?:
    string | null

  relayEndsAt?:
    string | null

  /**
   * Must be a server action supplied by the parent.
   *
   * Expected FormData:
   *
   * team_id
   *
   * The action should invoke the existing canonical
   * start_roam_relay_team mutation path.
   *
   * The database remains authoritative for:
   * - captain authorization
   * - team status === ready
   * - Relay status === live
   * - Relay execution window
   * - concurrent state changes
   * - first baton activation
   */
  startAction:
    (
      formData:
        FormData
    ) => Promise<void>

  canStart?:
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
 * WINDOW STATE
 * ============================================================
 */

type RelayWindowState =
  | 'upcoming'
  | 'open'
  | 'ended'
  | 'unscheduled'


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayStartPanel({
  teamId,
  teamStatus,
  relayStatus,
  relayStartsAt =
    null,
  relayEndsAt =
    null,
  startAction,
  canStart =
    true,
  lockedReason =
    null,
  title =
    'Start the Relay',
  description =
    'Launch the team into sequential Relay execution and activate the first canonical baton.',
  className,
}: RelayStartPanelProps) {
  const windowState =
    getRelayWindowState({
      startsAt:
        relayStartsAt,
      endsAt:
        relayEndsAt,
    })


  const teamReady =
    teamStatus ===
    'ready'


  const relayLive =
    relayStatus ===
    'live'


  const windowOpen =
    windowState ===
      'open' ||
    windowState ===
      'unscheduled'


  const teamAlreadyStarted =
    teamStatus ===
      'active' ||
    teamStatus ===
      'completed'


  const terminalTeam =
    teamStatus ===
      'abandoned' ||
    teamStatus ===
      'disqualified'


  const relayClosed =
    relayStatus ===
      'completed' ||
    relayStatus ===
      'cancelled'


  const canSubmit =
    canStart &&
    teamReady &&
    relayLive &&
    windowOpen &&
    !teamAlreadyStarted &&
    !terminalTeam &&
    !relayClosed


  const effectiveLockedReason =
    lockedReason ??
    getDefaultLockedReason({
      teamStatus,
      relayStatus,
      windowState,
      canStart,
    })


  return (
    <section
      className={[
        'rounded-[26px]',
        'border',
        teamAlreadyStarted
          ? 'border-emerald-300/14 bg-emerald-300/[0.04]'
          : terminalTeam ||
              relayClosed
            ? 'border-red-300/12 bg-red-300/[0.03]'
            : canSubmit
              ? 'border-amber-300/16 bg-amber-300/[0.04]'
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
      data-relay-start-panel
      data-team-id={
        teamId
      }
      data-team-status={
        teamStatus
      }
      data-relay-status={
        relayStatus
      }
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            Relay launch
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            {teamAlreadyStarted
              ? getStartedTitle(
                  teamStatus
                )
              : title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/42">
            {teamAlreadyStarted
              ? getStartedDescription(
                  teamStatus
                )
              : description}
          </p>
        </div>


        <StartStateBadge
          teamStatus={
            teamStatus
          }
          relayStatus={
            relayStatus
          }
          canSubmit={
            canSubmit
          }
        />
      </div>


      {/* ======================================================
       * START CONDITIONS
       * ====================================================== */}

      <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
        <StartMetric
          label="Team"
          value={
            formatTeamStatus(
              teamStatus
            )
          }
          complete={
            teamReady ||
            teamAlreadyStarted
          }
        />

        <StartMetric
          label="Relay"
          value={
            formatRelayStatus(
              relayStatus
            )
          }
          complete={
            relayLive ||
            relayStatus ===
              'completed'
          }
        />

        <StartMetric
          label="Window"
          value={
            formatWindowState(
              windowState
            )
          }
          complete={
            windowOpen ||
            teamAlreadyStarted
          }
        />
      </dl>


      {/* ======================================================
       * LIVE + READY STATE
       * ====================================================== */}

      {canSubmit ? (
        <div className="mt-5 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.035] p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300/80"
            />

            <div>
              <p className="text-sm font-semibold text-emerald-100/72">
                Team ready to launch
              </p>

              <p className="mt-1 text-xs leading-5 text-white/34">
                The team is ready and the Relay is live. Starting will
                transition the team into active execution and activate
                the first canonical Relay leg.
              </p>
            </div>
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * LOCKED STATE
       * ====================================================== */}

      {!teamAlreadyStarted &&
      !canSubmit &&
      effectiveLockedReason ? (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
            Start unavailable
          </p>

          <p className="mt-2 text-sm leading-6 text-white/40">
            {
              effectiveLockedReason
            }
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * START ACTION
       * ====================================================== */}

      {!teamAlreadyStarted &&
      !terminalTeam &&
      !relayClosed ? (
        <form
          action={
            startAction
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
              Starting is irreversible from this screen. The canonical
              mutation should transition the team once and initialize
              the first active baton transactionally.
            </p>

            <StartRelayButton
              disabled={
                !canSubmit
              }
            />
          </div>
        </form>
      ) : null}


      {/* ======================================================
       * ACTIVE / COMPLETED STATE
       * ====================================================== */}

      {teamAlreadyStarted ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="rounded-2xl border border-emerald-300/12 bg-black/15 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-100/42">
              Canonical execution state
            </p>

            <p className="mt-1.5 text-sm font-medium text-white/62">
              {teamStatus ===
              'active'
                ? 'Relay execution is active.'
                : 'Relay execution is complete.'}
            </p>
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * TERMINAL STATE
       * ====================================================== */}

      {!teamAlreadyStarted &&
      (
        terminalTeam ||
        relayClosed
      ) ? (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="rounded-2xl border border-red-300/10 bg-black/15 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-red-100/38">
              Launch closed
            </p>

            <p className="mt-1.5 text-sm font-medium text-white/48">
              {getTerminalStateLabel({
                teamStatus,
                relayStatus,
              })}
            </p>
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * INTEGRITY NOTE
       * ====================================================== */}

      <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/22">
        Start availability shown here is presentation state. The
        start_roam_relay_team mutation must revalidate captain
        authorization, team readiness, Relay lifecycle, execution
        window, and first-slot activation transactionally.
      </p>
    </section>
  )
}


/* ============================================================
 * START BUTTON
 * ============================================================
 */

function StartRelayButton({
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
        ? 'Starting Relay…'
        : 'Start Relay'}
    </button>
  )
}


/* ============================================================
 * METRIC
 * ============================================================
 */

function StartMetric({
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
 * STATE BADGE
 * ============================================================
 */

function StartStateBadge({
  teamStatus,
  relayStatus,
  canSubmit,
}: {
  teamStatus:
    RelayStartPanelProps['teamStatus']

  relayStatus:
    RelayStartPanelProps['relayStatus']

  canSubmit:
    boolean
}) {
  const presentation =
    getStartBadgePresentation({
      teamStatus,
      relayStatus,
      canSubmit,
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

function getRelayWindowState({
  startsAt,
  endsAt,
}: {
  startsAt:
    string | null

  endsAt:
    string | null
}): RelayWindowState {
  const now =
    Date.now()


  const startsAtTimestamp =
    startsAt
      ? new Date(
          startsAt
        ).getTime()
      : null


  const endsAtTimestamp =
    endsAt
      ? new Date(
          endsAt
        ).getTime()
      : null


  const validStartsAt =
    startsAtTimestamp !==
      null &&
    !Number.isNaN(
      startsAtTimestamp
    )
      ? startsAtTimestamp
      : null


  const validEndsAt =
    endsAtTimestamp !==
      null &&
    !Number.isNaN(
      endsAtTimestamp
    )
      ? endsAtTimestamp
      : null


  if (
    validStartsAt ===
      null &&
    validEndsAt ===
      null
  ) {
    return 'unscheduled'
  }


  if (
    validStartsAt !==
      null &&
    now <
      validStartsAt
  ) {
    return 'upcoming'
  }


  if (
    validEndsAt !==
      null &&
    now >=
      validEndsAt
  ) {
    return 'ended'
  }


  return 'open'
}


function getDefaultLockedReason({
  teamStatus,
  relayStatus,
  windowState,
  canStart,
}: {
  teamStatus:
    RelayStartPanelProps['teamStatus']

  relayStatus:
    RelayStartPanelProps['relayStatus']

  windowState:
    RelayWindowState

  canStart:
    boolean
}): string | null {
  if (
    teamStatus ===
    'forming'
  ) {
    return 'The team must be set ready before Relay execution can begin.'
  }


  if (
    teamStatus ===
    'active'
  ) {
    return 'This Relay team has already started.'
  }


  if (
    teamStatus ===
    'completed'
  ) {
    return 'This Relay team has already completed its route.'
  }


  if (
    teamStatus ===
    'abandoned'
  ) {
    return 'This Relay team has been abandoned.'
  }


  if (
    teamStatus ===
    'disqualified'
  ) {
    return 'This Relay team has been disqualified.'
  }


  if (
    relayStatus ===
    'draft'
  ) {
    return 'This Relay is still in draft.'
  }


  if (
    relayStatus ===
    'scheduled'
  ) {
    return 'This Relay is scheduled but not live yet.'
  }


  if (
    relayStatus ===
    'completed'
  ) {
    return 'This Relay has already ended.'
  }


  if (
    relayStatus ===
    'cancelled'
  ) {
    return 'This Relay has been cancelled.'
  }


  if (
    windowState ===
    'upcoming'
  ) {
    return 'The Relay execution window has not opened yet.'
  }


  if (
    windowState ===
    'ended'
  ) {
    return 'The Relay execution window has closed.'
  }


  if (
    !canStart
  ) {
    return 'Only an authorized captain can start this Relay team.'
  }


  return null
}


function getStartBadgePresentation({
  teamStatus,
  relayStatus,
  canSubmit,
}: {
  teamStatus:
    RelayStartPanelProps['teamStatus']

  relayStatus:
    RelayStartPanelProps['relayStatus']

  canSubmit:
    boolean
}): {
  label:
    string

  className:
    string
} {
  if (
    teamStatus ===
    'active'
  ) {
    return {
      label:
        'Active',

      className:
        'border-emerald-300/16 bg-emerald-300/[0.05] text-emerald-100/70',
    }
  }


  if (
    teamStatus ===
    'completed'
  ) {
    return {
      label:
        'Completed',

      className:
        'border-violet-300/16 bg-violet-300/[0.05] text-violet-100/70',
    }
  }


  if (
    teamStatus ===
      'abandoned' ||
    teamStatus ===
      'disqualified' ||
    relayStatus ===
      'cancelled'
  ) {
    return {
      label:
        'Closed',

      className:
        'border-red-300/12 bg-red-300/[0.035] text-red-100/55',
    }
  }


  if (
    canSubmit
  ) {
    return {
      label:
        'Ready to start',

      className:
        'border-amber-300/16 bg-amber-300/[0.05] text-amber-100/70',
    }
  }


  return {
    label:
      'Waiting',

    className:
      'border-white/[0.08] bg-white/[0.03] text-white/42',
  }
}


function getStartedTitle(
  teamStatus:
    RelayStartPanelProps['teamStatus']
): string {
  if (
    teamStatus ===
    'active'
  ) {
    return 'The Relay is underway.'
  }


  return 'The Relay is complete.'
}


function getStartedDescription(
  teamStatus:
    RelayStartPanelProps['teamStatus']
): string {
  if (
    teamStatus ===
    'active'
  ) {
    return 'The team has entered active Relay execution and the canonical baton is in motion.'
  }


  return 'The team has completed Relay execution.'
}


function getTerminalStateLabel({
  teamStatus,
  relayStatus,
}: {
  teamStatus:
    RelayStartPanelProps['teamStatus']

  relayStatus:
    RelayStartPanelProps['relayStatus']
}): string {
  if (
    teamStatus ===
    'disqualified'
  ) {
    return 'This team cannot start because it has been disqualified.'
  }


  if (
    teamStatus ===
    'abandoned'
  ) {
    return 'This team cannot start because it has been abandoned.'
  }


  if (
    relayStatus ===
    'cancelled'
  ) {
    return 'This Relay cannot start because it has been cancelled.'
  }


  if (
    relayStatus ===
    'completed'
  ) {
    return 'This Relay can no longer be started because it has ended.'
  }


  return 'Relay launch is unavailable.'
}


function formatTeamStatus(
  status:
    RelayStartPanelProps['teamStatus']
): string {
  switch (
    status
  ) {
    case 'forming':
      return 'Forming'

    case 'ready':
      return 'Ready'

    case 'active':
      return 'Active'

    case 'completed':
      return 'Completed'

    case 'abandoned':
      return 'Abandoned'

    case 'disqualified':
      return 'Disqualified'
  }
}


function formatRelayStatus(
  status:
    RelayStartPanelProps['relayStatus']
): string {
  switch (
    status
  ) {
    case 'draft':
      return 'Draft'

    case 'scheduled':
      return 'Scheduled'

    case 'live':
      return 'Live'

    case 'completed':
      return 'Completed'

    case 'cancelled':
      return 'Cancelled'
  }
}


function formatWindowState(
  state:
    RelayWindowState
): string {
  switch (
    state
  ) {
    case 'upcoming':
      return 'Upcoming'

    case 'open':
      return 'Open'

    case 'ended':
      return 'Ended'

    case 'unscheduled':
      return 'Open'
  }
}


export default RelayStartPanel