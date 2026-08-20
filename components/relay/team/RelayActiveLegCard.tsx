// components/relay/team/RelayActiveLegCard.tsx

import Link from 'next/link'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayActiveLegSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'


export type RelayActiveLegFlowAction =
  | {
      kind:
        'start'

      href:
        string

      label?:
        string
    }
  | {
      kind:
        'continue'

      href:
        string

      label?:
        string
    }
  | {
      kind:
        'check_in'

      href:
        string

      label?:
        string
    }
  | {
      kind:
        'locked'

      label?:
        string

      description?:
        string | null
    }


export type RelayActiveLegCardProps = {
  teamId:
    string

  slotId:
    string

  slotIndex:
    number

  label:
    string

  prompt?:
    string | null

  selectionMode?:
    RelayActiveLegSelectionMode | null

  constraintLabel?:
    string | null

  venueLabel?:
    string | null

  checkedInAt?:
    string | null

  geoVerified?:
    boolean

  requiredGeoVerified?:
    boolean

  /**
   * Normalized Active Flow handoff supplied by the parent.
   *
   * The component never:
   * - creates a flow session
   * - writes a venue visit
   * - performs GPS verification
   * - completes the Relay slot
   *
   * It only routes the assigned user into the canonical flow.
   */
  flowAction:
    RelayActiveLegFlowAction

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

export function RelayActiveLegCard({
  teamId,
  slotId,
  slotIndex,
  label,
  prompt =
    null,
  selectionMode =
    null,
  constraintLabel =
    null,
  venueLabel =
    null,
  checkedInAt =
    null,
  geoVerified =
    false,
  requiredGeoVerified =
    true,
  flowAction,
  title =
    'Your leg is live',
  description =
    'The Relay baton is yours. Complete this leg through Active Flow to move the team forward.',
  className,
}: RelayActiveLegCardProps) {
  const checkedIn =
    Boolean(
      checkedInAt
    )


  return (
    <section
      className={[
        'relative',
        'overflow-hidden',
        'rounded-[28px]',
        'border',
        'border-amber-300/18',
        'bg-amber-300/[0.045]',
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
      data-relay-active-leg-card
      data-team-id={
        teamId
      }
      data-slot-id={
        slotId
      }
      data-slot-index={
        slotIndex
      }
    >
      {/* ======================================================
       * AMBIENT ACCENT
       * ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/[0.07] blur-3xl"
      />


      <div className="relative">
        {/* ====================================================
         * HEADER
         * ==================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/18 bg-amber-300/[0.065] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-100/72">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-amber-300"
                />

                Baton active
              </span>

              <span className="rounded-full border border-violet-300/12 bg-violet-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-violet-100/58">
                Your leg
              </span>
            </div>


            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28">
              Relay leg {slotIndex}
            </p>

            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/44">
              {description}
            </p>
          </div>


          <div className="shrink-0 rounded-2xl border border-amber-300/12 bg-black/15 px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/24">
              Current leg
            </p>

            <p className="mt-1 text-sm font-semibold text-amber-50/75">
              {slotIndex}
            </p>
          </div>
        </div>


        {/* ====================================================
         * LEG BRIEF
         * ==================================================== */}

        <div className="mt-6 rounded-[22px] border border-white/[0.07] bg-black/15 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/23">
                Assignment
              </p>

              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white/82">
                {label}
              </h3>

              {prompt ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/39">
                  {prompt}
                </p>
              ) : null}
            </div>


            {selectionMode ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/38">
                {formatSelectionMode(
                  selectionMode
                )}
              </span>
            ) : null}
          </div>


          {constraintLabel ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-amber-100/32">
                Venue rule
              </p>

              <p className="mt-1.5 text-xs leading-5 text-amber-50/48">
                {constraintLabel}
              </p>
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * EXECUTION STATE
         * ==================================================== */}

        <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
          <ExecutionMetric
            label="Venue"
            value={
              venueLabel ??
              getVenueStateLabel(
                selectionMode
              )
            }
            complete={
              Boolean(
                venueLabel
              )
            }
          />

          <ExecutionMetric
            label="Check-in"
            value={
              checkedIn
                ? formatExecutionDate(
                    checkedInAt
                  )
                : 'Pending'
            }
            complete={
              checkedIn
            }
          />

          <ExecutionMetric
            label="Verification"
            value={
              requiredGeoVerified
                ? geoVerified
                  ? 'Verified'
                  : 'Required'
                : 'Not required'
            }
            complete={
              !requiredGeoVerified ||
              geoVerified
            }
          />
        </dl>


        {/* ====================================================
         * FLOW HANDOFF
         * ==================================================== */}

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          {flowAction.kind ===
          'locked' ? (
            <LockedFlowState
              action={
                flowAction
              }
            />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-lg">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
                  Active Flow
                </p>

                <p className="mt-1.5 text-xs leading-5 text-white/32">
                  {getFlowActionDescription(
                    flowAction.kind
                  )}
                </p>
              </div>


              <Link
                href={
                  flowAction.href
                }
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-amber-300/22 bg-amber-300/[0.10] px-5 text-sm font-semibold text-amber-50 transition hover:border-amber-300/32 hover:bg-amber-300/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
              >
                {flowAction.label ??
                  getFlowActionLabel(
                    flowAction.kind
                  )}
              </Link>
            </div>
          )}
        </div>


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/22">
          This card only hands the active Relay leg into the canonical
          Active Flow. Venue visits, physical verification, leg
          completion, and baton advancement remain authoritative in
          the existing execution and Relay mutation layers.
        </p>
      </div>
    </section>
  )
}


/* ============================================================
 * EXECUTION METRIC
 * ============================================================
 */

function ExecutionMetric({
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
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/23">
        {label}
      </dt>

      <dd className="mt-1.5 flex min-w-0 items-center gap-2 text-sm font-medium text-white/62">
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

        <span className="truncate">
          {value}
        </span>
      </dd>
    </div>
  )
}


/* ============================================================
 * LOCKED FLOW STATE
 * ============================================================
 */

function LockedFlowState({
  action,
}: {
  action:
    Extract<
      RelayActiveLegFlowAction,
      {
        kind:
          'locked'
      }
    >
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/24">
        Active Flow unavailable
      </p>

      <p className="mt-1.5 text-sm font-medium text-white/48">
        {action.label ??
          'This leg cannot be opened yet.'}
      </p>

      {action.description ? (
        <p className="mt-1 text-xs leading-5 text-white/30">
          {action.description}
        </p>
      ) : null}
    </div>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getFlowActionLabel(
  kind:
    Exclude<
      RelayActiveLegFlowAction['kind'],
      'locked'
    >
): string {
  switch (
    kind
  ) {
    case 'start':
      return 'Start my leg'

    case 'continue':
      return 'Continue my leg'

    case 'check_in':
      return 'Open check-in'
  }
}


function getFlowActionDescription(
  kind:
    Exclude<
      RelayActiveLegFlowAction['kind'],
      'locked'
    >
): string {
  switch (
    kind
  ) {
    case 'start':
      return 'Open Active Flow to begin venue selection and execution for your assigned Relay leg.'

    case 'continue':
      return 'Return to the canonical Active Flow already associated with this Relay leg.'

    case 'check_in':
      return 'Open the existing Active Flow check-in path to complete the required real-world verification.'
  }
}


function getVenueStateLabel(
  selectionMode:
    RelayActiveLegSelectionMode | null
): string {
  switch (
    selectionMode
  ) {
    case 'exact_venue':
      return 'Assigned venue'

    case 'venue_pool':
      return 'Choose eligible venue'

    case 'category':
      return 'Choose matching venue'

    case 'open':
      return 'Choose venue'

    case null:
      return 'Not selected'
  }
}


function formatSelectionMode(
  value:
    RelayActiveLegSelectionMode
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


function formatExecutionDate(
  value:
    string | null
): string {
  if (
    !value
  ) {
    return 'Pending'
  }


  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Completed'
  }


  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',

      hour:
        'numeric',

      minute:
        '2-digit',
    }
  ).format(
    date
  )
}


export default RelayActiveLegCard