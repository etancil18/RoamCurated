// components/relay/team/RelayLockedLegCard.tsx

/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayLockedLegSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'


export type RelayLockedLegCardProps = {
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
    RelayLockedLegSelectionMode | null

  constraintLabel?:
    string | null

  batonSlotIndex?:
    number | null

  batonHolderLabel?:
    string | null

  batonHolderSecondaryLabel?:
    string | null

  batonHolderAvatarUrl?:
    string | null

  isBatonHolderCaptain?:
    boolean

  completedBeforeCount?:
    number

  totalSlotCount?:
    number

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

export function RelayLockedLegCard({
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
  batonSlotIndex =
    null,
  batonHolderLabel =
    null,
  batonHolderSecondaryLabel =
    null,
  batonHolderAvatarUrl =
    null,
  isBatonHolderCaptain =
    false,
  completedBeforeCount =
    0,
  totalSlotCount =
    0,
  title =
    'Your leg is locked',
  description =
    'Your Relay leg will unlock when the baton reaches you.',
  className,
}: RelayLockedLegCardProps) {
  const hasActiveBaton =
    batonSlotIndex !==
    null


  const batonHolderDisplay =
    batonHolderLabel ??
    'Another teammate'


  const progressLabel =
    totalSlotCount >
      0
      ? `${Math.min(
          completedBeforeCount,
          totalSlotCount
        )} of ${totalSlotCount} legs resolved`
      : null


  return (
    <section
      className={[
        'relative',
        'overflow-hidden',
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
      data-relay-locked-leg-card
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
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-300/[0.045] blur-3xl"
      />


      <div className="relative">
        {/* ====================================================
         * HEADER
         * ==================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-white/28"
                />

                Locked
              </span>

              <span className="rounded-full border border-violet-300/12 bg-violet-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-violet-100/55">
                Your leg
              </span>
            </div>


            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28">
              Relay leg {slotIndex}
            </p>

            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/42">
              {description}
            </p>
          </div>


          <div className="shrink-0 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/23">
              Your leg
            </p>

            <p className="mt-1 text-sm font-semibold text-violet-100/65">
              {slotIndex}
            </p>
          </div>
        </div>


        {/* ====================================================
         * CURRENT BATON
         * ==================================================== */}

        <div className="mt-6 rounded-[22px] border border-amber-300/12 bg-amber-300/[0.03] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/14 bg-amber-300/[0.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-amber-100/58">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-amber-300/85"
                  />

                  Baton
                </span>

                {hasActiveBaton ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
                    Leg {
                      batonSlotIndex
                    }
                  </span>
                ) : null}
              </div>


              <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white/78">
                {hasActiveBaton
                  ? `${batonHolderDisplay} has the baton`
                  : 'Waiting for the baton to activate'}
              </h3>


              <p className="mt-1.5 text-sm leading-6 text-white/38">
                {hasActiveBaton
                  ? 'Your leg stays locked until the active teammate completes the current Relay leg.'
                  : 'No active Relay leg is currently available. Your assignment remains locked until canonical execution advances.'}
              </p>
            </div>


            {hasActiveBaton ? (
              <BatonHolder
                label={
                  batonHolderDisplay
                }
                secondaryLabel={
                  batonHolderSecondaryLabel
                }
                avatarUrl={
                  batonHolderAvatarUrl
                }
                isCaptain={
                  isBatonHolderCaptain
                }
              />
            ) : null}
          </div>


          {progressLabel ? (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="text-[10px] text-white/26">
                {progressLabel}
              </p>
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * YOUR FUTURE LEG
         * ==================================================== */}

        <div className="mt-4 rounded-[22px] border border-white/[0.07] bg-black/15 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/23">
                Your assignment
              </p>

              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white/78">
                {label}
              </h3>

              {prompt ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/37">
                  {prompt}
                </p>
              ) : null}
            </div>


            {selectionMode ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/36">
                {formatSelectionMode(
                  selectionMode
                )}
              </span>
            ) : null}
          </div>


          {constraintLabel ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-violet-100/30">
                Venue rule
              </p>

              <p className="mt-1.5 text-xs leading-5 text-white/34">
                {constraintLabel}
              </p>
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * LOCK EXPLANATION
         * ==================================================== */}

        <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-white/24"
            />

            <div>
              <p className="text-sm font-medium text-white/48">
                Sequential Relay execution
              </p>

              <p className="mt-1 text-xs leading-5 text-white/29">
                Only the teammate holding the canonical active baton
                can execute a Relay leg. Your leg unlocks only after
                prior progression is completed and the server advances
                the baton to you.
              </p>
            </div>
          </div>
        </div>


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/21">
          Locked state is presentation only. This component never
          infers or advances baton progression from slot order. It
          renders the canonical active slot supplied by the team
          execution layer.
        </p>
      </div>
    </section>
  )
}


/* ============================================================
 * BATON HOLDER
 * ============================================================
 */

function BatonHolder({
  label,
  secondaryLabel,
  avatarUrl,
  isCaptain,
}: {
  label:
    string

  secondaryLabel?:
    string | null

  avatarUrl?:
    string | null

  isCaptain:
    boolean
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-3">
      <MemberAvatar
        label={
          label
        }
        avatarUrl={
          avatarUrl
        }
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="max-w-[11rem] truncate text-xs font-semibold text-white/60">
            {label}
          </p>

          {isCaptain ? (
            <span className="rounded-full border border-amber-300/10 bg-amber-300/[0.035] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-100/48">
              Captain
            </span>
          ) : null}
        </div>

        {secondaryLabel ? (
          <p className="mt-0.5 max-w-[11rem] truncate text-[10px] text-white/24">
            {secondaryLabel}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] text-amber-100/32">
            Active teammate
          </p>
        )}
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
 * HELPERS
 * ============================================================
 */

function formatSelectionMode(
  value:
    RelayLockedLegSelectionMode
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


export default RelayLockedLegCard