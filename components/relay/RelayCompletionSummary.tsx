// components/relay/RelayCompletionSummary.tsx

import type {
  ReactNode,
} from 'react'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayCompletionSummaryStop = {
  id:
    string

  slotIndex:
    number

  label:
    string

  prompt?:
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

  completedAt?:
    string | null

  checkedInAt?:
    string | null

  geoVerified?:
    boolean

  requiredGeoVerified?:
    boolean

  /**
   * Optional read-only venue/detail affordance supplied by
   * the parent.
   *
   * Examples:
   * - venue detail link
   * - completed visit detail
   *
   * This component never owns mutations.
   */
  detailAction?:
    ReactNode
}


export type RelayCompletionSummaryProps = {
  teamId:
    string

  relayId:
    string

  relayTitle:
    string

  relayCity?:
    string | null

  relayTheme?:
    string | null

  stops:
    RelayCompletionSummaryStop[]

  completedAt?:
    string | null

  title?:
    string

  description?:
    string

  className?:
    string

  /**
   * Optional parent-owned action for a future canonical
   * collaborative artifact / replay route.
   *
   * This component does not assume that artifact materialization
   * already exists.
   */
  primaryAction?:
    ReactNode
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayCompletionSummary({
  teamId,
  relayId,
  relayTitle,
  relayCity =
    null,
  relayTheme =
    null,
  stops,
  completedAt =
    null,
  title =
    'Your collaborative Roam',
  description =
    'Every completed stop keeps the teammate who carried that leg, preserving the route as a shared city memory.',
  className,
  primaryAction =
    null,
}: RelayCompletionSummaryProps) {
  const orderedStops =
    [...stops].sort(
      (
        left,
        right
      ) =>
        left.slotIndex -
        right.slotIndex
    )


  const contributorCount =
    countDistinctContributors(
      orderedStops
    )


  const verifiedStopCount =
    orderedStops.filter(
      (
        stop
      ) =>
        stop.geoVerified
    ).length


  return (
    <section
      className={[
        'relative',
        'overflow-hidden',
        'rounded-[30px]',
        'border',
        'border-violet-300/14',
        'bg-violet-300/[0.035]',
        'p-5',
        'sm:p-7',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      data-relay-completion-summary
      data-team-id={
        teamId
      }
      data-relay-id={
        relayId
      }
    >
      {/* ======================================================
       * AMBIENT ACCENT
       * ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 h-96 w-96 rounded-full bg-violet-300/[0.07] blur-3xl"
      />


      <div className="relative">
        {/* ====================================================
         * HEADER
         * ==================================================== */}

        <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/16 bg-violet-300/[0.055] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-100/68">
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/[0.08] text-[9px] font-bold"
                >
                  ✓
                </span>

                Relay complete
              </span>

              <span className="rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/36">
                Collaborative Roam
              </span>
            </div>


            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/26">
              {[
                relayCity,
                relayTheme,
              ]
                .filter(
                  Boolean
                )
                .join(
                  ' · '
                )}
            </p>


            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {title}
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-7 text-white/42">
              {description}
            </p>

            <p className="mt-4 text-xs font-medium text-white/32">
              {
                relayTitle
              }
            </p>
          </div>


          {primaryAction ? (
            <div className="shrink-0">
              {primaryAction}
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * SUMMARY METRICS
         * ==================================================== */}

        <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
          <SummaryMetric
            label="Stops"
            value={`${orderedStops.length}`}
          />

          <SummaryMetric
            label="Contributors"
            value={`${contributorCount}`}
          />

          <SummaryMetric
            label="Verified"
            value={`${verifiedStopCount}`}
          />

          <SummaryMetric
            label="Finished"
            value={
              completedAt
                ? formatCompletionDate(
                    completedAt
                  )
                : 'Complete'
            }
          />
        </dl>


        {/* ====================================================
         * ORDERED ROUTE
         * ==================================================== */}

        {orderedStops.length >
        0 ? (
          <ol className="relative mt-7 space-y-4">
            {orderedStops.map(
              (
                stop,
                index
              ) => (
                <CollaborativeStop
                  key={
                    stop.id
                  }
                  stop={
                    stop
                  }
                  isFirst={
                    index ===
                    0
                  }
                  isLast={
                    index ===
                    orderedStops.length -
                      1
                  }
                />
              )
            )}
          </ol>
        ) : (
          <div className="mt-7 rounded-[24px] border border-dashed border-white/[0.08] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/38">
              No completed Relay stops are available.
            </p>
          </div>
        )}


        {/* ====================================================
         * AUTHORSHIP NOTE
         * ==================================================== */}

        {orderedStops.length >
        0 ? (
          <div className="mt-7 rounded-[22px] border border-white/[0.07] bg-black/15 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-300/70"
              />

              <div>
                <p className="text-sm font-medium text-white/52">
                  Authorship stays attached to every stop.
                </p>

                <p className="mt-1 text-xs leading-5 text-white/29">
                  Each teammate is credited only for the Relay leg they
                  actually completed. The finished route is collaborative
                  without collapsing individual contribution into a
                  single author.
                </p>
              </div>
            </div>
          </div>
        ) : null}


        {/* ====================================================
         * ARTIFACT BOUNDARY
         * ==================================================== */}

        <p className="mt-6 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/21">
          This summary is a read-only projection of the completed team
          route. It does not imply that a replayable collaborative Roam
          artifact has already been materialized.
        </p>
      </div>
    </section>
  )
}


/* ============================================================
 * COLLABORATIVE STOP
 * ============================================================
 */

function CollaborativeStop({
  stop,
  isFirst,
  isLast,
}: {
  stop:
    RelayCompletionSummaryStop

  isFirst:
    boolean

  isLast:
    boolean
}) {
  const contributorDisplayLabel =
    stop.contributorIsViewer
      ? 'You'
      : stop.contributorLabel


  return (
    <li
      className="relative"
      data-relay-completion-stop
      data-slot-index={
        stop.slotIndex
      }
    >
      {/* ======================================================
       * ROUTE RAIL
       * ====================================================== */}

      {!isFirst ? (
        <div
          aria-hidden="true"
          className="absolute -top-4 left-[1.15rem] h-4 w-px bg-violet-300/18"
        />
      ) : null}


      {!isLast ? (
        <div
          aria-hidden="true"
          className="absolute -bottom-4 left-[1.15rem] h-4 w-px bg-violet-300/18"
        />
      ) : null}


      <article className="rounded-[24px] border border-white/[0.075] bg-black/15 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          {/* ==================================================
           * STOP NODE
           * ================================================== */}

          <div className="flex sm:block">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/18 bg-violet-300/[0.06] text-[10px] font-semibold text-violet-100/66">
              {
                stop.slotIndex
              }
            </div>
          </div>


          {/* ==================================================
           * STOP CONTENT
           * ================================================== */}

          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-300/12 bg-emerald-300/[0.035] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/55">
                    Completed
                  </span>

                  {stop.geoVerified ? (
                    <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.03] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/48">
                      Geo verified
                    </span>
                  ) : null}
                </div>


                <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-white/82">
                  {
                    stop.label
                  }
                </h3>


                {stop.prompt ? (
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/36">
                    {
                      stop.prompt
                    }
                  </p>
                ) : null}
              </div>


              {stop.completedAt ? (
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/21">
                    Completed
                  </p>

                  <p className="mt-1 text-xs text-white/36">
                    {formatCompletionDate(
                      stop.completedAt
                    )}
                  </p>
                </div>
              ) : null}
            </div>


            {/* =================================================
             * VENUE + AUTHOR
             * ================================================= */}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <StopDetailCard
                eyebrow="Stop"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white/66">
                    {
                      stop.venueLabel
                    }
                  </p>

                  {stop.venueSecondaryLabel ? (
                    <p className="mt-0.5 truncate text-xs text-white/27">
                      {
                        stop.venueSecondaryLabel
                      }
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-white/23">
                      Relay venue
                    </p>
                  )}
                </div>
              </StopDetailCard>


              <StopDetailCard
                eyebrow="Authored by"
              >
                <ContributorIdentity
                  label={
                    contributorDisplayLabel
                  }
                  secondaryLabel={
                    stop.contributorSecondaryLabel
                  }
                  avatarUrl={
                    stop.contributorAvatarUrl
                  }
                  isCaptain={
                    Boolean(
                      stop.contributorIsCaptain
                    )
                  }
                  isViewer={
                    Boolean(
                      stop.contributorIsViewer
                    )
                  }
                />
              </StopDetailCard>
            </div>


            {/* =================================================
             * VERIFICATION META
             * ================================================= */}

            <div className="mt-3 flex flex-wrap gap-2">
              {stop.checkedInAt ? (
                <MetaChip
                  value={`Checked in ${formatCompletionDate(
                    stop.checkedInAt
                  )}`}
                />
              ) : null}


              {stop.requiredGeoVerified ? (
                <MetaChip
                  value={
                    stop.geoVerified
                      ? 'Physical verification complete'
                      : 'Physical verification not recorded'
                  }
                  tone={
                    stop.geoVerified
                      ? 'emerald'
                      : 'neutral'
                  }
                />
              ) : (
                <MetaChip
                  value="Geo verification not required"
                />
              )}
            </div>


            {/* =================================================
             * OPTIONAL READ-ONLY ACTION
             * ================================================= */}

            {stop.detailAction ? (
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                {
                  stop.detailAction
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
 * DETAIL CARD
 * ============================================================
 */

function StopDetailCard({
  eyebrow,
  children,
}: {
  eyebrow:
    string

  children:
    ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.065] bg-[#0a0a0a] px-4 py-3.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/21">
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
          <p className="max-w-[14rem] truncate text-sm font-semibold text-white/66">
            {label}
          </p>

          {isCaptain ? (
            <span className="rounded-full border border-amber-300/10 bg-amber-300/[0.035] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-100/48">
              Captain
            </span>
          ) : null}

          {isViewer &&
          !isCaptain ? (
            <span className="rounded-full border border-violet-300/10 bg-violet-300/[0.035] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-violet-100/46">
              You
            </span>
          ) : null}
        </div>


        {secondaryLabel ? (
          <p className="mt-0.5 max-w-[14rem] truncate text-xs text-white/27">
            {
              secondaryLabel
            }
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
 * SUMMARY METRIC
 * ============================================================
 */

function SummaryMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="bg-[#0b0b0b] px-4 py-4">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
        {label}
      </dt>

      <dd className="mt-1.5 truncate text-sm font-medium text-white/62">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * META CHIP
 * ============================================================
 */

function MetaChip({
  value,
  tone =
    'neutral',
}: {
  value:
    string

  tone?:
    | 'neutral'
    | 'emerald'
}) {
  const className =
    tone ===
    'emerald'
      ? 'border-emerald-300/10 bg-emerald-300/[0.03] text-emerald-100/48'
      : 'border-white/[0.07] bg-white/[0.025] text-white/31'


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
 * HELPERS
 * ============================================================
 */

function countDistinctContributors(
  stops:
    RelayCompletionSummaryStop[]
): number {
  const contributorKeys =
    stops.map(
      (
        stop
      ) => {
        if (
          stop.contributorIsViewer
        ) {
          return 'viewer'
        }


        return [
          stop.contributorLabel,
          stop.contributorSecondaryLabel ??
            '',
        ].join(
          '::'
        )
      }
    )


  return new Set(
    contributorKeys
  ).size
}


function formatCompletionDate(
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


export default RelayCompletionSummary