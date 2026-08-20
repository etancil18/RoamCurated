type TasteDuelHeroStatus =
  | 'scheduled'
  | 'live'
  | 'scoring'
  | 'completed'
  | 'cancelled'

export type TasteDuelParticipationStatus =
  | 'not_started'
  | 'in_progress'
  | 'qualified'
  | 'completed_not_qualified'
  | 'closed'
  | 'unavailable'

type TasteDuelHeroProps = {
  title: string

  city?: string | null
  category?: string | null

  startsAt?: string | null
  endsAt?: string | null

  status: TasteDuelHeroStatus

  participationStatus?: TasteDuelParticipationStatus | null

  verifiedStopCount?: number | null
  totalStopCount?: number | null
  requiredVerifiedStopCount?: number | null

  xpReward?: number | null

  anonymousEntries?: boolean

  className?: string
}

export default function TasteDuelHero({
  title,
  city,
  category,
  startsAt,
  endsAt,
  status,
  participationStatus = null,
  verifiedStopCount = null,
  totalStopCount = null,
  requiredVerifiedStopCount = null,
  xpReward = null,
  anonymousEntries = true,
  className = '',
}: TasteDuelHeroProps) {
  const competitionStatus =
    getCompetitionStatusPresentation(
      status
    )

  const participation =
    participationStatus
      ? getParticipationStatusPresentation(
          participationStatus
        )
      : null

  const normalizedVerifiedStopCount =
    normalizeNonNegativeInteger(
      verifiedStopCount
    )

  const normalizedTotalStopCount =
    normalizeNonNegativeInteger(
      totalStopCount
    )

  const normalizedRequiredVerifiedStopCount =
    normalizeNonNegativeInteger(
      requiredVerifiedStopCount
    )

  const showProgress =
    participationStatus ===
      'in_progress' ||
    participationStatus ===
      'qualified' ||
    participationStatus ===
      'completed_not_qualified'

  const progressPercent =
    showProgress &&
    normalizedTotalStopCount >
      0
      ? Math.min(
          100,
          Math.round(
            (
              normalizedVerifiedStopCount /
              normalizedTotalStopCount
            ) *
              100
          )
        )
      : 0

  return (
    <section
      className={[
        'relative overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-transparent p-6 text-white sm:p-8 lg:p-10',
        className,
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-amber-300/[0.055] blur-3xl"
      />

      {status === 'live' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-red-500/[0.06] blur-3xl"
        />
      ) : null}

      <div className="relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
                  competitionStatus.className,
                ].join(' ')}
              >
                {status ===
                'live' ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                ) : null}

                {
                  competitionStatus.label
                }
              </span>

              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Taste Duel
              </span>

              {anonymousEntries &&
              status !==
                'completed' ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Anonymous
                </span>
              ) : null}
            </div>

            <h1 className="mt-7 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              {title}
            </h1>

            <div className="mt-6 flex flex-wrap gap-2">
              {city ? (
                <HeroChip>
                  {city}
                </HeroChip>
              ) : null}

              {category ? (
                <HeroChip>
                  {category}
                </HeroChip>
              ) : null}

              {typeof xpReward ===
                'number' &&
              Number.isFinite(
                xpReward
              ) &&
              xpReward >
                0 ? (
                <HeroChip>
                  +
                  {
                    xpReward
                  }{' '}
                  XP reward
                </HeroChip>
              ) : null}
            </div>
          </div>

          {participation ? (
            <div className="w-full shrink-0 lg:w-[320px]">
              <div
                className={[
                  'rounded-[22px] border p-5',
                  participation.cardClassName,
                ].join(' ')}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  Your participation
                </p>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div>
                    <p
                      className={[
                        'text-lg font-semibold tracking-[-0.02em]',
                        participation.textClassName,
                      ].join(' ')}
                    >
                      {
                        participation.label
                      }
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/40">
                      {
                        participation.description
                      }
                    </p>
                  </div>

                  <span
                    aria-hidden="true"
                    className={[
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      participation.dotClassName,
                    ].join(' ')}
                  />
                </div>

                {showProgress &&
                normalizedTotalStopCount >
                  0 ? (
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-4 text-[11px] font-medium">
                      <span className="text-white/40">
                        Verified stops
                      </span>

                      <span className="text-white/70">
                        {
                          normalizedVerifiedStopCount
                        }
                        /
                        {
                          normalizedTotalStopCount
                        }
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={[
                          'h-full rounded-full transition-[width] duration-300',
                          participation.progressClassName,
                        ].join(' ')}
                        style={{
                          width: `${progressPercent}%`,
                        }}
                      />
                    </div>

                    {normalizedRequiredVerifiedStopCount >
                    0 ? (
                      <p className="mt-2 text-[10px] leading-4 text-white/30">
                        {
                          normalizedRequiredVerifiedStopCount
                        }{' '}
                        verified{' '}
                        {normalizedRequiredVerifiedStopCount ===
                        1
                          ? 'stop'
                          : 'stops'}{' '}
                        required to
                        qualify.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-9 grid overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2">
          <DateCell
            label="Starts"
            value={formatCompetitionDate(
              startsAt
            )}
          />

          <DateCell
            label="Ends"
            value={formatCompetitionDate(
              endsAt
            )}
          />
        </div>
      </div>
    </section>
  )
}

function HeroChip({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[11px] font-medium text-white/45">
      {children}
    </span>
  )
}

function DateCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="bg-[#0b0b0b] px-5 py-4 first:border-b first:border-white/[0.07] sm:first:border-b-0 sm:first:border-r">
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-medium text-white/65">
        {value}
      </p>
    </div>
  )
}

function getCompetitionStatusPresentation(
  status: TasteDuelHeroStatus
): {
  label: string
  className: string
} {
  switch (status) {
    case 'live':
      return {
        label: 'Live',
        className:
          'border-red-400/25 bg-red-400/[0.08] text-red-200',
      }

    case 'scheduled':
      return {
        label: 'Upcoming',
        className:
          'border-sky-300/20 bg-sky-300/[0.06] text-sky-100',
      }

    case 'scoring':
      return {
        label: 'Scoring',
        className:
          'border-violet-300/20 bg-violet-300/[0.06] text-violet-100',
      }

    case 'completed':
      return {
        label: 'Settled',
        className:
          'border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-100',
      }

    case 'cancelled':
    default:
      return {
        label: 'Cancelled',
        className:
          'border-white/10 bg-white/[0.04] text-white/45',
      }
  }
}

function getParticipationStatusPresentation(
  status: TasteDuelParticipationStatus
): {
  label: string
  description: string
  textClassName: string
  dotClassName: string
  cardClassName: string
  progressClassName: string
} {
  switch (status) {
    case 'not_started':
      return {
        label:
          'Not started',

        description:
          'Choose a contender route when you are ready to explore.',

        textClassName:
          'text-white',

        dotClassName:
          'bg-white/35',

        cardClassName:
          'border-white/10 bg-black/20',

        progressClassName:
          'bg-white/50',
      }

    case 'in_progress':
      return {
        label:
          'In progress',

        description:
          'Keep checking in at verified stops to build qualification evidence.',

        textClassName:
          'text-sky-100',

        dotClassName:
          'bg-sky-300',

        cardClassName:
          'border-sky-300/15 bg-sky-300/[0.045]',

        progressClassName:
          'bg-sky-300',
      }

    case 'qualified':
      return {
        label:
          'Qualified',

        description:
          'Your completed route has enough verified evidence to count.',

        textClassName:
          'text-emerald-100',

        dotClassName:
          'bg-emerald-300',

        cardClassName:
          'border-emerald-300/20 bg-emerald-300/[0.05]',

        progressClassName:
          'bg-emerald-300',
      }

    case 'completed_not_qualified':
      return {
        label:
          'Not qualified',

        description:
          'The route finished without enough verified stops to qualify.',

        textClassName:
          'text-amber-100',

        dotClassName:
          'bg-amber-300',

        cardClassName:
          'border-amber-300/20 bg-amber-300/[0.05]',

        progressClassName:
          'bg-amber-300',
      }

    case 'closed':
      return {
        label:
          'Closed',

        description:
          'Participation is no longer open for this competition.',

        textClassName:
          'text-violet-100',

        dotClassName:
          'bg-violet-300',

        cardClassName:
          'border-violet-300/15 bg-violet-300/[0.04]',

        progressClassName:
          'bg-violet-300',
      }

    case 'unavailable':
    default:
      return {
        label:
          'Unavailable',

        description:
          'This competition is not currently available for participation.',

        textClassName:
          'text-white/60',

        dotClassName:
          'bg-white/20',

        cardClassName:
          'border-white/10 bg-black/20',

        progressClassName:
          'bg-white/30',
      }
  }
}

function normalizeNonNegativeInteger(
  value: number | null | undefined
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isInteger(
      value
    ) ||
    value <
      0
  ) {
    return 0
  }

  return value
}

function formatCompetitionDate(
  value: string | null | undefined
): string {
  if (!value) {
    return 'TBA'
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
    return 'TBA'
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  ).format(date)
}