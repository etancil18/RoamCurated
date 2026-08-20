// components/relay/team/RelayCompletedLegCard.tsx

/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayCompletedLegSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'


export type RelayCompletedLegCardProps = {
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
    RelayCompletedLegSelectionMode | null

  constraintLabel?:
    string | null

  contributorLabel:
    string

  contributorSecondaryLabel?:
    string | null

  contributorAvatarUrl?:
    string | null

  contributorIsCaptain?:
    boolean

  contributorIsViewer?:
    boolean

  venueId?:
    string | null

  venueLabel:
    string

  venueSecondaryLabel?:
    string | null

  checkedInAt?:
    string | null

  completedAt:
    string

  geoVerified?:
    boolean

  requiredGeoVerified?:
    boolean

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

export function RelayCompletedLegCard({
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
  contributorLabel,
  contributorSecondaryLabel =
    null,
  contributorAvatarUrl =
    null,
  contributorIsCaptain =
    false,
  contributorIsViewer =
    false,
  venueId =
    null,
  venueLabel,
  venueSecondaryLabel =
    null,
  checkedInAt =
    null,
  completedAt,
  geoVerified =
    false,
  requiredGeoVerified =
    true,
  title =
    'Leg completed',
  description =
    'This Relay leg is frozen as part of the team’s completed route.',
  className,
}: RelayCompletedLegCardProps) {
  return (
    <section
      className={[
        'relative',
        'overflow-hidden',
        'rounded-[28px]',
        'border',
        'border-emerald-300/12',
        'bg-emerald-300/[0.03]',
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
      data-relay-completed-leg-card
      data-team-id={
        teamId
      }
      data-slot-id={
        slotId
      }
      data-slot-index={
        slotIndex
      }
      data-venue-id={
        venueId ??
        undefined
      }
    >
      {/* ======================================================
       * AMBIENT ACCENT
       * ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-300/[0.045] blur-3xl"
      />


      <div className="relative">
        {/* ====================================================
         * HEADER
         * ==================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/14 bg-emerald-300/[0.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/62">
                <span
                  aria-hidden="true"
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] text-[8px] font-bold text-emerald-100/75"
                >
                  ✓
                </span>

                Completed
              </span>

              <span className="rounded-full border border-white/[0.07] bg-black/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/34">
                Relay leg {slotIndex}
              </span>
            </div>


            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">
              {description}
            </p>
          </div>


          <div className="shrink-0 rounded-2xl border border-emerald-300/10 bg-black/15 px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/22">
              Completed
            </p>

            <p className="mt-1 text-xs font-medium text-emerald-100/58">
              {formatCompletedDate(
                completedAt
              )}
            </p>
          </div>
        </div>


        {/* ====================================================
         * ASSIGNMENT
         * ==================================================== */}

        <div className="mt-6 rounded-[22px] border border-white/[0.07] bg-black/15 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                Assignment
              </p>

              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white/78">
                {label}
              </h3>

              {prompt ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/36">
                  {prompt}
                </p>
              ) : null}
            </div>


            {selectionMode ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/34">
                {formatSelectionMode(
                  selectionMode
                )}
              </span>
            ) : null}
          </div>


          {constraintLabel ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100/26">
                Venue rule
              </p>

              <p className="mt-1.5 text-xs leading-5 text-white/32">
                {constraintLabel}
              </p>
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * FROZEN RESULT
         * ==================================================== */}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <FrozenDetailCard
            eyebrow="Contributor"
          >
            <ContributorIdentity
              label={
                contributorLabel
              }
              secondaryLabel={
                contributorSecondaryLabel
              }
              avatarUrl={
                contributorAvatarUrl
              }
              isCaptain={
                contributorIsCaptain
              }
              isViewer={
                contributorIsViewer
              }
            />
          </FrozenDetailCard>


          <FrozenDetailCard
            eyebrow="Venue"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white/68">
                {venueLabel}
              </p>

              {venueSecondaryLabel ? (
                <p className="mt-0.5 truncate text-xs text-white/28">
                  {venueSecondaryLabel}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-white/24">
                  Verified Relay stop
                </p>
              )}
            </div>
          </FrozenDetailCard>
        </div>


        {/* ====================================================
         * VERIFICATION RECORD
         * ==================================================== */}

        <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
          <CompletionMetric
            label="Check-in"
            value={
              checkedInAt
                ? formatCompletedDate(
                    checkedInAt
                  )
                : 'Not recorded'
            }
            complete={
              Boolean(
                checkedInAt
              )
            }
          />

          <CompletionMetric
            label="Verification"
            value={
              requiredGeoVerified
                ? geoVerified
                  ? 'Geo verified'
                  : 'Not verified'
                : 'Not required'
            }
            complete={
              !requiredGeoVerified ||
              geoVerified
            }
          />

          <CompletionMetric
            label="Completion"
            value={
              formatCompletedDate(
                completedAt
              )
            }
            complete
          />
        </dl>


        {/* ====================================================
         * FROZEN STATE
         * ==================================================== */}

        <div className="mt-4 rounded-2xl border border-emerald-300/10 bg-black/15 px-4 py-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/14 bg-emerald-300/[0.05] text-xs font-bold text-emerald-100/65"
            >
              ✓
            </span>

            <div>
              <p className="text-sm font-medium text-white/52">
                Frozen Relay result
              </p>

              <p className="mt-1 text-xs leading-5 text-white/29">
                Contributor, venue, verification, and completion data
                shown here are read-only projections of the canonical
                completed team slot.
              </p>
            </div>
          </div>
        </div>


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/21">
          This component exposes no execution or editing controls.
          Completed Relay legs should only change through explicit
          canonical correction or administrative integrity flows.
        </p>
      </div>
    </section>
  )
}


/* ============================================================
 * FROZEN DETAIL CARD
 * ============================================================
 */

function FrozenDetailCard({
  eyebrow,
  children,
}: {
  eyebrow:
    string

  children:
    React.ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/15 p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/22">
        {eyebrow}
      </p>

      <div className="mt-2">
        {children}
      </div>
    </div>
  )
}


/* ============================================================
 * CONTRIBUTOR
 * ============================================================
 */

function ContributorIdentity({
  label,
  secondaryLabel,
  avatarUrl,
  isCaptain,
  isViewer,
}: {
  label:
    string

  secondaryLabel?:
    string | null

  avatarUrl?:
    string | null

  isCaptain:
    boolean

  isViewer:
    boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <ContributorAvatar
        label={
          label
        }
        avatarUrl={
          avatarUrl
        }
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="max-w-[14rem] truncate text-sm font-semibold text-white/68">
            {isViewer
              ? 'You'
              : label}
          </p>

          {isCaptain ? (
            <span className="rounded-full border border-amber-300/10 bg-amber-300/[0.035] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-100/48">
              Captain
            </span>
          ) : null}

          {isViewer &&
          !isCaptain ? (
            <span className="rounded-full border border-violet-300/10 bg-violet-300/[0.035] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-violet-100/45">
              You
            </span>
          ) : null}
        </div>

        {secondaryLabel ? (
          <p className="mt-0.5 max-w-[14rem] truncate text-xs text-white/27">
            {secondaryLabel}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-white/23">
            Relay contributor
          </p>
        )}
      </div>
    </div>
  )
}


/* ============================================================
 * CONTRIBUTOR AVATAR
 * ============================================================
 */

function ContributorAvatar({
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
        className="h-10 w-10 shrink-0 rounded-full border border-white/[0.08] bg-cover bg-center bg-no-repeat"
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
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-white/42"
    >
      {fallback}
    </div>
  )
}


/* ============================================================
 * COMPLETION METRIC
 * ============================================================
 */

function CompletionMetric({
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
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
        {label}
      </dt>

      <dd className="mt-1.5 flex min-w-0 items-center gap-2 text-sm font-medium text-white/60">
        <span
          aria-hidden="true"
          className={[
            'h-1.5',
            'w-1.5',
            'shrink-0',
            'rounded-full',
            complete
              ? 'bg-emerald-300/75'
              : 'bg-white/22',
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
 * HELPERS
 * ============================================================
 */

function formatSelectionMode(
  value:
    RelayCompletedLegSelectionMode
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


function formatCompletedDate(
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
    return 'Recorded'
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


export default RelayCompletedLegCard