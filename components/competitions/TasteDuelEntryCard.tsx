import type { ReactNode } from 'react'

export type TasteDuelContenderSlot =
  | 1
  | 2
  | 3
  | 4

export type TasteDuelEntryCompetitionStatus =
  | 'scheduled'
  | 'live'
  | 'scoring'
  | 'completed'

export type TasteDuelEntryVenue = {
  id: string
  name: string
  city?: string | null
  category?: string | null
}

export type TasteDuelSettledIdentity = {
  displayName: string
  username?: string | null
}

type TasteDuelEntryCardBaseProps = {
  entryId: string

  contenderSlot: TasteDuelContenderSlot

  venues: TasteDuelEntryVenue[]

  isWinner?: boolean

  score?: number | null

  qualifiedParticipantCount?: number | null

  children?: ReactNode

  className?: string
}

/**
 * Before settlement, creator identity is not part of the component
 * contract at all.
 *
 * This prevents accidental rendering of:
 *
 * - display name
 * - username
 * - follower count
 * - profile link
 *
 * while the competition is scheduled, live, or scoring.
 */
type AnonymousTasteDuelEntryCardProps =
  TasteDuelEntryCardBaseProps & {
    competitionStatus:
      | 'scheduled'
      | 'live'
      | 'scoring'

    settledIdentity?: never
  }

/**
 * Creator identity may be supplied only once the competition has
 * settled.
 *
 * Profile URLs and follower counts remain intentionally unsupported
 * by this component.
 */
type SettledTasteDuelEntryCardProps =
  TasteDuelEntryCardBaseProps & {
    competitionStatus:
      'completed'

    settledIdentity?:
      | TasteDuelSettledIdentity
      | null
  }

export type TasteDuelEntryCardProps =
  | AnonymousTasteDuelEntryCardProps
  | SettledTasteDuelEntryCardProps

export default function TasteDuelEntryCard(
  props: TasteDuelEntryCardProps
) {
  const {
    entryId,
    contenderSlot,
    competitionStatus,
    venues,
    isWinner = false,
    score = null,
    qualifiedParticipantCount = null,
    children,
    className = '',
  } = props

  const contenderLabel =
    getContenderLabel(
      contenderSlot
    )

  const settled =
    competitionStatus ===
    'completed'

  const settledIdentity =
    settled
      ? props.settledIdentity ??
        null
      : null

  const normalizedScore =
    normalizeFiniteNumber(
      score
    )

  const normalizedQualifiedParticipantCount =
    normalizeNonNegativeInteger(
      qualifiedParticipantCount
    )

  return (
    <article
      data-entry-id={
        entryId
      }
      data-contender-slot={
        contenderSlot
      }
      className={[
        'relative overflow-hidden rounded-[26px] border p-5 text-white sm:p-6',
        isWinner &&
        settled
          ? 'border-amber-300/30 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.025] to-transparent'
          : competitionStatus ===
              'live'
            ? 'border-red-400/15 bg-gradient-to-br from-red-400/[0.045] via-white/[0.025] to-transparent'
            : 'border-white/10 bg-white/[0.025]',
        className,
      ].join(
        ' '
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-200/[0.035] blur-3xl"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Contender
              </span>

              {competitionStatus ===
              'live' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-red-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-300" />

                  Live
                </span>
              ) : null}

              {isWinner &&
              settled ? (
                <span className="inline-flex items-center rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                  Winner
                </span>
              ) : null}
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
              {
                contenderLabel
              }
            </h2>

            {!settled ? (
              <p className="mt-1.5 text-xs leading-5 text-white/35">
                Identity hidden
                until settlement.
              </p>
            ) : settledIdentity ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-white/75">
                  {
                    settledIdentity.displayName
                  }
                </p>

                {settledIdentity.username ? (
                  <p className="mt-0.5 text-xs text-white/35">
                    @
                    {
                      normalizeUsername(
                        settledIdentity.username
                      )
                    }
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1.5 text-xs leading-5 text-white/35">
                Creator
                identity
                unavailable.
              </p>
            )}
          </div>

          <div className="shrink-0 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs font-medium text-white/45">
            {
              venues.length
            }{' '}
            {venues.length ===
            1
              ? 'stop'
              : 'stops'}
          </div>
        </div>

        <ol className="mt-6 space-y-2.5">
          {venues.map(
            (
              venue,
              index
            ) => (
              <li
                key={`${entryId}:${index}:${venue.id}`}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold text-white/40">
                  {index +
                    1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/80">
                    {
                      venue.name
                    }
                  </p>

                  {venue.city ||
                  venue.category ? (
                    <p className="mt-0.5 truncate text-[11px] text-white/30">
                      {[
                        venue.category,
                        venue.city,
                      ]
                        .filter(
                          Boolean
                        )
                        .join(
                          ' · '
                        )}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          )}
        </ol>

        {venues.length ===
        0 ? (
          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-5 text-center">
            <p className="text-xs text-white/35">
              Route stops are not
              available yet.
            </p>
          </div>
        ) : null}

        {settled &&
        (
          normalizedScore !==
            null ||
          normalizedQualifiedParticipantCount !==
            null
        ) ? (
          <dl className="mt-6 grid overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-2">
            {normalizedScore !==
            null ? (
              <ResultCell
                label="Final score"
                value={formatScore(
                  normalizedScore
                )}
              />
            ) : null}

            {normalizedQualifiedParticipantCount !==
            null ? (
              <ResultCell
                label="Qualified explorers"
                value={String(
                  normalizedQualifiedParticipantCount
                )}
              />
            ) : null}
          </dl>
        ) : null}

        {children ? (
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            {children}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function ResultCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="bg-[#0b0b0b] px-4 py-3.5 first:border-b first:border-white/[0.07] sm:first:border-b-0 sm:first:border-r">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-semibold text-white/70">
        {value}
      </dd>
    </div>
  )
}

function getContenderLabel(
  slot: TasteDuelContenderSlot
): string {
  switch (slot) {
    case 1:
      return 'Contender A'

    case 2:
      return 'Contender B'

    case 3:
      return 'Contender C'

    case 4:
      return 'Contender D'
  }
}

function normalizeNonNegativeInteger(
  value:
    | number
    | null
    | undefined
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isInteger(
      value
    ) ||
    value < 0
  ) {
    return null
  }

  return value
}

function normalizeFiniteNumber(
  value:
    | number
    | null
    | undefined
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return null
  }

  return value
}

function normalizeUsername(
  value: string
): string {
  return value
    .trim()
    .replace(
      /^@+/,
      ''
    )
}

function formatScore(
  value: number
): string {
  if (
    Number.isInteger(
      value
    )
  ) {
    return String(
      value
    )
  }

  return value.toFixed(
    2
  )
}