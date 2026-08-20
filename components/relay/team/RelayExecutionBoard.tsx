// components/relay/team/RelayExecutionBoard.tsx

import type {
  ReactNode,
} from 'react'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayExecutionSlotStatus =
  | 'locked'
  | 'active'
  | 'completed'
  | 'skipped'


export type RelayExecutionSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'


export type RelayExecutionSlot = {
  id:
    string

  slotIndex:
    number

  label:
    string

  prompt?:
    string | null

  selectionMode?:
    RelayExecutionSelectionMode | null

  constraintLabel?:
    string | null

  status:
    RelayExecutionSlotStatus

  assignedUserId?:
    string | null

  assignedMemberLabel?:
    string | null

  assignedMemberSecondaryLabel?:
    string | null

  assignedMemberAvatarUrl?:
    string | null

  isAssignedToViewer?:
    boolean

  isAssignedToCaptain?:
    boolean

  venueId?:
    string | null

  venueLabel?:
    string | null

  checkedInAt?:
    string | null

  completedAt?:
    string | null

  geoVerified?:
    boolean

  requiredGeoVerified?:
    boolean

  /**
   * Optional slot-scoped execution UI supplied by the parent.
   *
   * Examples:
   * - "Open Active Flow"
   * - "Check in"
   * - "Continue verification"
   *
   * This board deliberately does not own those mutations.
   */
  action?:
    ReactNode
}


export type RelayExecutionBoardProps = {
  teamId:
    string

  teamStatus:
    | 'forming'
    | 'ready'
    | 'active'
    | 'completed'
    | 'abandoned'
    | 'disqualified'

  slots:
    RelayExecutionSlot[]

  viewerUserId?:
    string | null

  title?:
    string

  description?:
    string

  className?:
    string

  emptyLabel?:
    string

  /**
   * Optional top-level action supplied by the parent.
   *
   * Useful for navigation into canonical Active Flow execution
   * when the viewer currently owns the baton.
   */
  primaryAction?:
    ReactNode
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayExecutionBoard({
  teamId,
  teamStatus,
  slots,
  viewerUserId =
    null,
  title =
    'Relay execution',
  description =
    'Follow the baton as each teammate completes their assigned Relay leg in sequence.',
  className,
  emptyLabel =
    'No materialized Relay legs are available.',
  primaryAction =
    null,
}: RelayExecutionBoardProps) {
  const sortedSlots =
    [...slots].sort(
      (
        left,
        right
      ) =>
        left.slotIndex -
        right.slotIndex
    )


  const totalSlots =
    sortedSlots.length


  const completedSlots =
    sortedSlots.filter(
      (
        slot
      ) =>
        slot.status ===
        'completed'
    )


  const skippedSlots =
    sortedSlots.filter(
      (
        slot
      ) =>
        slot.status ===
        'skipped'
    )


  const activeSlot =
    sortedSlots.find(
      (
        slot
      ) =>
        slot.status ===
        'active'
    ) ??
    null


  const activeSlotBelongsToViewer =
    Boolean(
      activeSlot &&
      (
        activeSlot.isAssignedToViewer ||
        (
          viewerUserId &&
          activeSlot.assignedUserId ===
            viewerUserId
        )
      )
    )


  const resolvedSlots =
    completedSlots.length +
    skippedSlots.length


  const progressPercentage =
    totalSlots >
      0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              resolvedSlots /
              totalSlots
            ) *
              100
          )
        )
      : 0


  const teamIsActive =
    teamStatus ===
    'active'


  const teamCompleted =
    teamStatus ===
    'completed'


  const terminalTeam =
    teamStatus ===
      'abandoned' ||
    teamStatus ===
      'disqualified'


  return (
    <section
      className={[
        'rounded-[28px]',
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
      data-relay-execution-board
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

      <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
              Baton progression
            </p>

            <ExecutionStateBadge
              teamStatus={
                teamStatus
              }
            />
          </div>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/42">
            {description}
          </p>
        </div>


        {primaryAction ? (
          <div className="shrink-0">
            {primaryAction}
          </div>
        ) : null}
      </div>


      {/* ======================================================
       * PROGRESS SUMMARY
       * ====================================================== */}

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/24">
              Route progress
            </p>

            <p className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white/74">
              {totalSlots >
              0
                ? `${completedSlots.length} of ${totalSlots} legs complete`
                : 'No Relay legs'}
            </p>
          </div>


          <div className="flex flex-wrap gap-2">
            <ProgressChip
              label="Completed"
              value={
                completedSlots.length
              }
              tone="emerald"
            />

            <ProgressChip
              label="Active"
              value={
                activeSlot
                  ? 1
                  : 0
              }
              tone="amber"
            />

            {skippedSlots.length >
            0 ? (
              <ProgressChip
                label="Skipped"
                value={
                  skippedSlots.length
                }
                tone="red"
              />
            ) : null}
          </div>
        </div>


        {totalSlots >
        0 ? (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 via-emerald-300/75 to-amber-300/70 transition-[width]"
                style={{
                  width:
                    `${progressPercentage}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>


      {/* ======================================================
       * CURRENT BATON
       * ====================================================== */}

      {activeSlot ? (
        <div className="mt-5 rounded-[22px] border border-amber-300/16 bg-amber-300/[0.045] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/16 bg-amber-300/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-amber-100/65">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-amber-300"
                  />

                  Baton active
                </span>

                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/26">
                  Leg {
                    activeSlot.slotIndex
                  }
                </span>
              </div>


              <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
                {
                  activeSlot.label
                }
              </h3>


              <p className="mt-1.5 text-sm leading-6 text-white/42">
                {activeSlotBelongsToViewer
                  ? 'The baton is yours. Complete this leg through the canonical Active Flow to advance the team.'
                  : activeSlot.assignedMemberLabel
                    ? `Waiting for ${activeSlot.assignedMemberLabel} to complete this Relay leg.`
                    : 'Waiting for the assigned teammate to complete this Relay leg.'}
              </p>
            </div>


            {activeSlot.action ? (
              <div className="shrink-0">
                {
                  activeSlot.action
                }
              </div>
            ) : null}
          </div>
        </div>
      ) : teamIsActive ? (
        <ExecutionWarning
          title="No active baton found"
          description="The team is marked active, but no materialized Relay slot currently has active status. Canonical baton reconciliation should resolve this state before further execution."
        />
      ) : teamCompleted ? (
        <ExecutionCompleteState />
      ) : terminalTeam ? (
        <ExecutionClosedState
          teamStatus={
            teamStatus
          }
        />
      ) : null}


      {/* ======================================================
       * SLOT PROGRESSION
       * ====================================================== */}

      {sortedSlots.length >
      0 ? (
        <ol className="relative mt-6 space-y-3">
          {sortedSlots.map(
            (
              slot,
              index
            ) => (
              <ExecutionSlotRow
                key={
                  slot.id
                }
                slot={
                  slot
                }
                isFirst={
                  index ===
                  0
                }
                isLast={
                  index ===
                  sortedSlots.length -
                    1
                }
                viewerUserId={
                  viewerUserId
                }
              />
            )
          )}
        </ol>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/[0.08] px-4 py-9 text-center">
          <p className="text-sm font-medium text-white/38">
            {emptyLabel}
          </p>
        </div>
      )}


      {/* ======================================================
       * INTEGRITY NOTE
       * ====================================================== */}

      <p className="mt-6 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/22">
        This board renders canonical materialized Relay team-slot
        state. Active Flow verification, venue resolution, baton
        advancement, and completion must remain authoritative in the
        Relay mutation layer.
      </p>
    </section>
  )
}


/* ============================================================
 * EXECUTION SLOT
 * ============================================================
 */

function ExecutionSlotRow({
  slot,
  isFirst,
  isLast,
  viewerUserId,
}: {
  slot:
    RelayExecutionSlot

  isFirst:
    boolean

  isLast:
    boolean

  viewerUserId:
    string | null
}) {
  const presentation =
    getSlotPresentation(
      slot.status
    )


  const assignedToViewer =
    Boolean(
      slot.isAssignedToViewer ||
      (
        viewerUserId &&
        slot.assignedUserId ===
          viewerUserId
      )
    )


  return (
    <li
      className="relative"
      data-relay-execution-slot
      data-slot-index={
        slot.slotIndex
      }
      data-slot-status={
        slot.status
      }
    >
      {/* ======================================================
       * PROGRESSION RAIL
       * ====================================================== */}

      {!isFirst ? (
        <div
          aria-hidden="true"
          className={[
            'absolute',
            '-top-3',
            'left-[1.1rem]',
            'h-3',
            'w-px',
            slot.status ===
              'completed'
              ? 'bg-emerald-300/35'
              : 'bg-white/[0.08]',
          ].join(
            ' '
          )}
        />
      ) : null}


      {!isLast ? (
        <div
          aria-hidden="true"
          className={[
            'absolute',
            '-bottom-3',
            'left-[1.1rem]',
            'h-3',
            'w-px',
            slot.status ===
              'completed'
              ? 'bg-emerald-300/35'
              : 'bg-white/[0.08]',
          ].join(
            ' '
          )}
        />
      ) : null}


      <article
        className={[
          'relative',
          'overflow-hidden',
          'rounded-[22px]',
          'border',
          presentation.containerClassName,
          'p-4',
          'sm:p-5',
        ].join(
          ' '
        )}
      >
        {slot.status ===
        'active' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-300/[0.055] blur-3xl"
          />
        ) : null}


        <div className="relative grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          {/* ==================================================
           * STATUS NODE
           * ================================================== */}

          <div className="flex sm:block">
            <div
              className={[
                'flex',
                'h-9',
                'w-9',
                'shrink-0',
                'items-center',
                'justify-center',
                'rounded-full',
                'border',
                presentation.nodeClassName,
              ].join(
                ' '
              )}
            >
              <SlotNodeContent
                status={
                  slot.status
                }
                slotIndex={
                  slot.slotIndex
                }
              />
            </div>
          </div>


          {/* ==================================================
           * SLOT BODY
           * ================================================== */}

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      'inline-flex',
                      'items-center',
                      'rounded-full',
                      'border',
                      'px-2.5',
                      'py-1',
                      'text-[9px]',
                      'font-semibold',
                      'uppercase',
                      'tracking-[0.12em]',
                      presentation.badgeClassName,
                    ].join(
                      ' '
                    )}
                  >
                    {
                      presentation.label
                    }
                  </span>


                  {assignedToViewer ? (
                    <span className="rounded-full border border-violet-300/12 bg-violet-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-100/55">
                      Your leg
                    </span>
                  ) : null}


                  {slot.geoVerified ? (
                    <span className="rounded-full border border-emerald-300/12 bg-emerald-300/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/55">
                      Geo verified
                    </span>
                  ) : null}
                </div>


                <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white/82">
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
              </div>


              <div className="shrink-0 text-left sm:text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
                  Leg
                </p>

                <p className="mt-1 text-sm font-semibold text-white/52">
                  {
                    slot.slotIndex
                  }
                </p>
              </div>
            </div>


            {/* =================================================
             * ASSIGNMENT
             * ================================================= */}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <ExecutionDetailCard
                label="Assigned teammate"
              >
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    label={
                      slot.assignedMemberLabel ??
                      'Teammate'
                    }
                    avatarUrl={
                      slot.assignedMemberAvatarUrl
                    }
                  />

                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/60">
                      {assignedToViewer
                        ? 'You'
                        : slot.assignedMemberLabel ??
                          'Assigned teammate'}
                    </p>

                    {slot.assignedMemberSecondaryLabel ? (
                      <p className="mt-0.5 truncate text-[10px] text-white/25">
                        {
                          slot.assignedMemberSecondaryLabel
                        }
                      </p>
                    ) : slot.isAssignedToCaptain ? (
                      <p className="mt-0.5 text-[10px] text-amber-100/38">
                        Captain
                      </p>
                    ) : null}
                  </div>
                </div>
              </ExecutionDetailCard>


              <ExecutionDetailCard
                label="Venue"
              >
                <p
                  className={[
                    'text-xs',
                    'font-medium',
                    slot.venueLabel
                      ? 'text-white/60'
                      : 'text-white/28',
                  ].join(
                    ' '
                  )}
                >
                  {
                    slot.venueLabel ??
                    getVenueStateLabel(
                      slot
                    )
                  }
                </p>
              </ExecutionDetailCard>
            </div>


            {/* =================================================
             * SLOT META
             * ================================================= */}

            <div className="mt-3 flex flex-wrap gap-2">
              {slot.selectionMode ? (
                <SlotMetaChip
                  value={
                    formatSelectionMode(
                      slot.selectionMode
                    )
                  }
                />
              ) : null}


              {slot.constraintLabel ? (
                <SlotMetaChip
                  value={
                    slot.constraintLabel
                  }
                  tone="amber"
                />
              ) : null}


              {slot.requiredGeoVerified ? (
                <SlotMetaChip
                  value={
                    slot.geoVerified
                      ? 'Verification complete'
                      : 'Geo verification required'
                  }
                  tone={
                    slot.geoVerified
                      ? 'emerald'
                      : 'neutral'
                  }
                />
              ) : null}


              {slot.checkedInAt ? (
                <SlotMetaChip
                  value={`Checked in ${formatExecutionDate(
                    slot.checkedInAt
                  )}`}
                />
              ) : null}


              {slot.completedAt ? (
                <SlotMetaChip
                  value={`Completed ${formatExecutionDate(
                    slot.completedAt
                  )}`}
                  tone="emerald"
                />
              ) : null}
            </div>


            {/* =================================================
             * SLOT ACTION
             * ================================================= */}

            {slot.action ? (
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                {
                  slot.action
                }
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  )
}


/* ============================================================
 * SLOT NODE
 * ============================================================
 */

function SlotNodeContent({
  status,
  slotIndex,
}: {
  status:
    RelayExecutionSlotStatus

  slotIndex:
    number
}) {
  if (
    status ===
    'completed'
  ) {
    return (
      <span
        aria-label="Completed"
        className="text-sm font-bold text-emerald-100/75"
      >
        ✓
      </span>
    )
  }


  if (
    status ===
    'active'
  ) {
    return (
      <span
        aria-label="Active"
        className="h-2.5 w-2.5 rounded-full bg-amber-300"
      />
    )
  }


  if (
    status ===
    'skipped'
  ) {
    return (
      <span
        aria-label="Skipped"
        className="text-xs font-bold text-red-100/55"
      >
        —
      </span>
    )
  }


  return (
    <span className="text-[10px] font-semibold text-white/34">
      {slotIndex}
    </span>
  )
}


/* ============================================================
 * EXECUTION DETAIL CARD
 * ============================================================
 */

function ExecutionDetailCard({
  label,
  children,
}: {
  label:
    string

  children:
    ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/15 px-3.5 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/21">
        {label}
      </p>

      <div className="mt-2">
        {children}
      </div>
    </div>
  )
}


/* ============================================================
 * MEMBER AVATAR
 * ============================================================
 */

function MemberAvatar({
  label,
  avatarUrl,
}: {
  label:
    string

  avatarUrl?:
    string | null
}) {
  const fallback =
    label
      .trim()
      .charAt(
        0
      )
      .toUpperCase() ||
    '?'


  if (
    avatarUrl
  ) {
    return (
      <div
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-full border border-white/[0.08] bg-cover bg-center bg-no-repeat"
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] font-semibold text-white/42"
    >
      {fallback}
    </div>
  )
}


/* ============================================================
 * META CHIP
 * ============================================================
 */

function SlotMetaChip({
  value,
  tone =
    'neutral',
}: {
  value:
    string

  tone?:
    | 'neutral'
    | 'amber'
    | 'emerald'
}) {
  const className =
    tone ===
    'amber'
      ? 'border-amber-300/10 bg-amber-300/[0.03] text-amber-100/45'
      : tone ===
          'emerald'
        ? 'border-emerald-300/10 bg-emerald-300/[0.03] text-emerald-100/48'
        : 'border-white/[0.07] bg-white/[0.025] text-white/32'


  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'rounded-full',
        'border',
        'px-2.5',
        'py-1',
        'text-[9px]',
        'font-medium',
        className,
      ].join(
        ' '
      )}
    >
      {value}
    </span>
  )
}


/* ============================================================
 * PROGRESS CHIP
 * ============================================================
 */

function ProgressChip({
  label,
  value,
  tone,
}: {
  label:
    string

  value:
    number

  tone:
    | 'emerald'
    | 'amber'
    | 'red'
}) {
  const className =
    tone ===
    'emerald'
      ? 'border-emerald-300/10 bg-emerald-300/[0.03] text-emerald-100/52'
      : tone ===
          'amber'
        ? 'border-amber-300/10 bg-amber-300/[0.03] text-amber-100/52'
        : 'border-red-300/10 bg-red-300/[0.03] text-red-100/48'


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
        'tracking-[0.1em]',
        className,
      ].join(
        ' '
      )}
    >
      <span>
        {value}
      </span>

      <span className="opacity-65">
        {label}
      </span>
    </span>
  )
}


/* ============================================================
 * EXECUTION STATE BADGE
 * ============================================================
 */

function ExecutionStateBadge({
  teamStatus,
}: {
  teamStatus:
    RelayExecutionBoardProps['teamStatus']
}) {
  const presentation =
    getExecutionStatePresentation(
      teamStatus
    )


  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'rounded-full',
        'border',
        'px-2.5',
        'py-1',
        'text-[9px]',
        'font-semibold',
        'uppercase',
        'tracking-[0.13em]',
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
 * EXECUTION WARNING
 * ============================================================
 */

function ExecutionWarning({
  title,
  description,
}: {
  title:
    string

  description:
    string
}) {
  return (
    <div className="mt-5 rounded-[22px] border border-amber-300/12 bg-amber-300/[0.03] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-100/45">
        Execution state
      </p>

      <p className="mt-1.5 text-sm font-semibold text-white/60">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-white/32">
        {description}
      </p>
    </div>
  )
}


/* ============================================================
 * COMPLETED STATE
 * ============================================================
 */

function ExecutionCompleteState() {
  return (
    <div className="mt-5 rounded-[22px] border border-emerald-300/12 bg-emerald-300/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-300/[0.06] text-xs font-bold text-emerald-100/70"
        >
          ✓
        </span>

        <div>
          <p className="text-sm font-semibold text-emerald-100/70">
            Relay completed
          </p>

          <p className="mt-1 text-xs leading-5 text-white/34">
            The canonical team execution state is complete. The final
            route can now flow into Relay artifact materialization.
          </p>
        </div>
      </div>
    </div>
  )
}


/* ============================================================
 * CLOSED STATE
 * ============================================================
 */

function ExecutionClosedState({
  teamStatus,
}: {
  teamStatus:
    'abandoned'
    | 'disqualified'
}) {
  return (
    <div className="mt-5 rounded-[22px] border border-red-300/10 bg-red-300/[0.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-red-100/40">
        Execution closed
      </p>

      <p className="mt-1.5 text-sm font-medium text-white/50">
        {teamStatus ===
        'disqualified'
          ? 'This team has been disqualified and cannot continue Relay execution.'
          : 'This team has been abandoned and cannot continue Relay execution.'}
      </p>
    </div>
  )
}


/* ============================================================
 * PRESENTATION HELPERS
 * ============================================================
 */

function getSlotPresentation(
  status:
    RelayExecutionSlotStatus
): {
  label:
    string

  containerClassName:
    string

  nodeClassName:
    string

  badgeClassName:
    string
} {
  switch (
    status
  ) {
    case 'completed':
      return {
        label:
          'Completed',

        containerClassName:
          'border-emerald-300/10 bg-emerald-300/[0.025]',

        nodeClassName:
          'border-emerald-300/16 bg-emerald-300/[0.055]',

        badgeClassName:
          'border-emerald-300/12 bg-emerald-300/[0.04] text-emerald-100/58',
      }

    case 'active':
      return {
        label:
          'Active',

        containerClassName:
          'border-amber-300/16 bg-amber-300/[0.04]',

        nodeClassName:
          'border-amber-300/20 bg-amber-300/[0.07] shadow-[0_0_22px_rgba(252,211,77,0.08)]',

        badgeClassName:
          'border-amber-300/16 bg-amber-300/[0.055] text-amber-100/68',
      }

    case 'skipped':
      return {
        label:
          'Skipped',

        containerClassName:
          'border-red-300/10 bg-red-300/[0.02]',

        nodeClassName:
          'border-red-300/12 bg-red-300/[0.035]',

        badgeClassName:
          'border-red-300/10 bg-red-300/[0.03] text-red-100/48',
      }

    case 'locked':
      return {
        label:
          'Locked',

        containerClassName:
          'border-white/[0.065] bg-black/15',

        nodeClassName:
          'border-white/[0.08] bg-white/[0.025]',

        badgeClassName:
          'border-white/[0.07] bg-white/[0.025] text-white/32',
      }
  }
}


function getExecutionStatePresentation(
  teamStatus:
    RelayExecutionBoardProps['teamStatus']
): {
  label:
    string

  className:
    string
} {
  switch (
    teamStatus
  ) {
    case 'forming':
      return {
        label:
          'Forming',

        className:
          'border-white/[0.08] bg-white/[0.03] text-white/38',
      }

    case 'ready':
      return {
        label:
          'Ready',

        className:
          'border-amber-300/12 bg-amber-300/[0.04] text-amber-100/55',
      }

    case 'active':
      return {
        label:
          'Active',

        className:
          'border-emerald-300/14 bg-emerald-300/[0.045] text-emerald-100/65',
      }

    case 'completed':
      return {
        label:
          'Completed',

        className:
          'border-violet-300/14 bg-violet-300/[0.045] text-violet-100/62',
      }

    case 'abandoned':
      return {
        label:
          'Abandoned',

        className:
          'border-red-300/10 bg-red-300/[0.03] text-red-100/48',
      }

    case 'disqualified':
      return {
        label:
          'Disqualified',

        className:
          'border-red-300/10 bg-red-300/[0.03] text-red-100/48',
      }
  }
}


function getVenueStateLabel(
  slot:
    RelayExecutionSlot
): string {
  if (
    slot.status ===
    'locked'
  ) {
    return 'Not resolved yet'
  }


  if (
    slot.selectionMode ===
    'exact_venue'
  ) {
    return 'Venue unavailable'
  }


  if (
    slot.status ===
    'active'
  ) {
    return 'Awaiting venue resolution'
  }


  return 'No venue recorded'
}


function formatSelectionMode(
  value:
    RelayExecutionSelectionMode
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

      hour:
        'numeric',

      minute:
        '2-digit',
    }
  ).format(
    date
  )
}


export default RelayExecutionBoard