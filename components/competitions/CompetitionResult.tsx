'use client'

import Link from 'next/link'
import {
  useCallback,
  useMemo,
  useState,
} from 'react'

export type CompetitionResultStatus =
  | 'winner'
  | 'tie'
  | 'insufficient_evidence'
  | 'void'

export type CompetitionResultCreator = {
  userId: string
  displayName: string
  username?: string | null
  profileHref?: string | null
  avatarUrl?: string | null

  /**
   * Follow state is UI state only.
   * The parent should hydrate it from canonical relationship data.
   */
  isFollowing?: boolean
}

export type CompetitionResultVenue = {
  id: string
  name: string
  city?: string | null
  category?: string | null
}

export type CompetitionResultEvidence = {
  qualifiedParticipantCount: number
  completedParticipantCount: number
  participationCount: number
  crossCompleterCount: number

  ratingCount: number
  averageRating: number | null

  headToHeadPreferenceCount: number
  headToHeadEligibleCount: number

  completionRate: number | null
  confidenceScore: number
  finalScore: number
}

export type CompetitionResultEntry = {
  entryId: string
  contenderLabel: string

  creator: CompetitionResultCreator | null

  venues: CompetitionResultVenue[]

  isWinner: boolean

  evidence: CompetitionResultEvidence
}

export type CompetitionResultProps = {
  competitionId: string
  competitionTitle: string

  resultStatus: CompetitionResultStatus

  entries: CompetitionResultEntry[]

  /**
   * Optional explicit reason from settlement logic.
   */
  resultReason?: string | null

  /**
   * Optional save state for the winning route.
   */
  winningRouteSaved?: boolean

  /**
   * Optional endpoint overrides.
   *
   * If omitted:
   *   follow -> /api/profile/follow
   *   save   -> /api/competitions/:competitionId/save
   */
  followEndpoint?: string
  saveEndpoint?: string

  className?: string

  onFollowChange?: (
    userId: string,
    isFollowing: boolean
  ) => void

  onSaveChange?: (
    isSaved: boolean
  ) => void
}

type FollowApiResponse = {
  following?: unknown
  error?: unknown
  message?: unknown
}

type SaveApiResponse = {
  saved?: unknown
  error?: unknown
  message?: unknown
}

export default function CompetitionResult({
  competitionId,
  competitionTitle,
  resultStatus,
  entries,
  resultReason = null,
  winningRouteSaved = false,
  followEndpoint = '/api/profile/follow',
  saveEndpoint,
  className = '',
  onFollowChange,
  onSaveChange,
}: CompetitionResultProps) {
  const orderedEntries =
    useMemo(
      () =>
        [...entries].sort(
          (
            left,
            right
          ) => {
            if (
              left.isWinner !==
              right.isWinner
            ) {
              return left.isWinner
                ? -1
                : 1
            }

            return (
              right.evidence.finalScore -
              left.evidence.finalScore
            )
          }
        ),
      [
        entries,
      ]
    )

  const winner =
    orderedEntries.find(
      (
        entry
      ) =>
        entry.isWinner
    ) ??
    null

  const [saved, setSaved] =
    useState(
      winningRouteSaved
    )

  const [
    savePending,
    setSavePending,
  ] = useState(
    false
  )

  const [
    saveError,
    setSaveError,
  ] = useState<
    string | null
  >(null)

  const resolvedSaveEndpoint =
    saveEndpoint ??
    `/api/competitions/${encodeURIComponent(
      competitionId
    )}/save`

  const handleSave =
    useCallback(
      async () => {
        if (
          !winner ||
          savePending
        ) {
          return
        }

        setSavePending(
          true
        )

        setSaveError(
          null
        )

        try {
          const response =
            await fetch(
              resolvedSaveEndpoint,
              {
                method:
                  'POST',

                headers: {
                  Accept:
                    'application/json',

                  'Content-Type':
                    'application/json',
                },

                credentials:
                  'same-origin',

                cache:
                  'no-store',

                body:
                  JSON.stringify({
                    competition_id:
                      competitionId,

                    entry_id:
                      winner.entryId,

                    saved:
                      !saved,
                  }),
              }
            )

          const payload =
            await readJsonSafely<SaveApiResponse>(
              response
            )

          if (
            !response.ok
          ) {
            throw new Error(
              getApiErrorMessage(
                payload,
                'Could not update saved route.'
              )
            )
          }

          const persistedSaved =
            typeof payload?.saved ===
              'boolean'
              ? payload.saved
              : !saved

          setSaved(
            persistedSaved
          )

          onSaveChange?.(
            persistedSaved
          )
        } catch (error) {
          setSaveError(
            getUnknownErrorMessage(
              error,
              'Could not update saved route.'
            )
          )
        } finally {
          setSavePending(
            false
          )
        }
      },
      [
        winner,
        savePending,
        resolvedSaveEndpoint,
        competitionId,
        saved,
        onSaveChange,
      ]
    )

  return (
    <section
      className={[
        'space-y-6',
        className,
      ].join(' ')}
    >
      <ResultHero
        competitionTitle={
          competitionTitle
        }
        resultStatus={
          resultStatus
        }
        resultReason={
          resultReason
        }
        winner={
          winner
        }
      />

      {resultStatus ===
        'winner' &&
      winner ? (
        <WinningRoute
          competitionId={
            competitionId
          }
          winner={
            winner
          }
          saved={
            saved
          }
          savePending={
            savePending
          }
          saveError={
            saveError
          }
          onSave={
            handleSave
          }
          followEndpoint={
            followEndpoint
          }
          onFollowChange={
            onFollowChange
          }
        />
      ) : null}

      {resultStatus !==
        'winner' ? (
        <NonWinnerResult
          resultStatus={
            resultStatus
          }
          entries={
            orderedEntries
          }
          resultReason={
            resultReason
          }
          followEndpoint={
            followEndpoint
          }
          onFollowChange={
            onFollowChange
          }
        />
      ) : null}

      {resultStatus ===
        'winner' &&
      orderedEntries.length >
        1 ? (
        <div>
          <div className="mb-4 border-b border-white/[0.08] pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
              Final field
            </p>

            <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
              How the contenders
              finished
            </h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {orderedEntries.map(
              (
                entry
              ) => (
                <EntryResultCard
                  key={
                    entry.entryId
                  }
                  entry={
                    entry
                  }
                  followEndpoint={
                    followEndpoint
                  }
                  onFollowChange={
                    onFollowChange
                  }
                />
              )
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ResultHero({
  competitionTitle,
  resultStatus,
  resultReason,
  winner,
}: {
  competitionTitle: string
  resultStatus: CompetitionResultStatus
  resultReason: string | null
  winner: CompetitionResultEntry | null
}) {
  const presentation =
    getResultPresentation(
      resultStatus
    )

  return (
    <header
      className={[
        'relative overflow-hidden rounded-[30px] border p-6 text-white sm:p-8 lg:p-10',
        presentation.wrapperClassName,
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-amber-300/[0.06] blur-3xl"
      />

      <div className="relative max-w-3xl">
        <span
          className={[
            'inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
            presentation.badgeClassName,
          ].join(' ')}
        >
          {
            presentation.label
          }
        </span>

        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          {competitionTitle}
        </h2>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50 sm:text-base">
          {resultStatus ===
            'winner' &&
          winner
            ? `${winner.contenderLabel} won the duel. Creator identity and the winning route are now revealed.`
            : resultReason?.trim()
              ? resultReason
              : presentation.description}
        </p>
      </div>
    </header>
  )
}

function WinningRoute({
  competitionId,
  winner,
  saved,
  savePending,
  saveError,
  onSave,
  followEndpoint,
  onFollowChange,
}: {
  competitionId: string
  winner: CompetitionResultEntry
  saved: boolean
  savePending: boolean
  saveError: string | null
  onSave: () => void
  followEndpoint: string
  onFollowChange?: (
    userId: string,
    isFollowing: boolean
  ) => void
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.09] via-white/[0.03] to-transparent p-5 text-white sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/65">
            Winning route
          </p>

          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            {
              winner.contenderLabel
            }
          </h3>

          {winner.creator ? (
            <CreatorReveal
              creator={
                winner.creator
              }
              followEndpoint={
                followEndpoint
              }
              onFollowChange={
                onFollowChange
              }
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={
            onSave
          }
          disabled={
            savePending
          }
          className={[
            'inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
            saved
              ? 'border-amber-300/30 bg-amber-300/[0.1] text-amber-100'
              : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.07] hover:text-white',
          ].join(' ')}
        >
          {savePending
            ? 'Saving…'
            : saved
              ? 'Saved'
              : 'Save winning route'}
        </button>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <ol className="space-y-2.5">
            {winner.venues.map(
              (
                venue,
                index
              ) => (
                <li
                  key={`${winner.entryId}:${index}:${venue.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold text-white/40">
                    {index +
                      1}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white/80">
                      {
                        venue.name
                      }
                    </p>

                    {venue.category ||
                    venue.city ? (
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
        </div>

        <WhyItWon
          evidence={
            winner.evidence
          }
        />
      </div>

      {saveError ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.055] px-4 py-3 text-xs text-red-100"
        >
          {saveError}
        </div>
      ) : null}

      <div className="mt-6 border-t border-white/[0.07] pt-5">
        <VerifiedEvidence
          evidence={
            winner.evidence
          }
        />
      </div>

      <p className="mt-4 text-[10px] leading-4 text-white/25">
        Result evidence comes from
        the frozen settlement
        snapshot for this
        competition.
      </p>
    </article>
  )
}

function WhyItWon({
  evidence,
}: {
  evidence: CompetitionResultEvidence
}) {
  const reasons =
    buildWinningReasons(
      evidence
    )

  return (
    <aside className="rounded-[22px] border border-amber-300/20 bg-amber-300/[0.055] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/60">
        Why it won
      </p>

      <div className="mt-4 space-y-3">
        {reasons.map(
          (
            reason
          ) => (
            <div
              key={
                reason
              }
              className="flex items-start gap-3"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"
              />

              <p className="text-sm leading-6 text-white/55">
                {reason}
              </p>
            </div>
          )
        )}
      </div>
    </aside>
  )
}

function VerifiedEvidence({
  evidence,
}: {
  evidence: CompetitionResultEvidence
}) {
  const cells = [
    {
      label:
        'Qualified explorers',
      value:
        String(
          evidence.qualifiedParticipantCount
        ),
    },
    {
      label:
        'Completed runs',
      value:
        String(
          evidence.completedParticipantCount
        ),
    },
    {
      label:
        'Cross-completers',
      value:
        String(
          evidence.crossCompleterCount
        ),
    },
    {
      label:
        'Verified ratings',
      value:
        String(
          evidence.ratingCount
        ),
    },
    {
      label:
        'Avg. rating',
      value:
        evidence.averageRating ===
        null
          ? '—'
          : `${formatNumber(
              evidence.averageRating,
              2
            )}/5`,
    },
    {
      label:
        'H2H wins',
      value:
        `${evidence.headToHeadPreferenceCount}/${evidence.headToHeadEligibleCount}`,
    },
    {
      label:
        'Completion quality',
      value:
        evidence.completionRate ===
        null
          ? '—'
          : formatPercent(
              evidence.completionRate
            ),
    },
    {
      label:
        'Confidence',
      value:
        formatPercent(
          evidence.confidenceScore
        ),
    },
  ]

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
        Verified participation
        evidence
      </p>

      <dl className="mt-4 grid overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
        {cells.map(
          (
            cell
          ) => (
            <div
              key={
                cell.label
              }
              className="border-b border-white/[0.07] bg-[#0b0b0b] px-4 py-3.5 last:border-b-0 sm:border-r lg:[&:nth-child(4n)]:border-r-0"
            >
              <dt className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
                {
                  cell.label
                }
              </dt>

              <dd className="mt-1.5 text-sm font-semibold text-white/70">
                {
                  cell.value
                }
              </dd>
            </div>
          )
        )}
      </dl>
    </div>
  )
}

function EntryResultCard({
  entry,
  followEndpoint,
  onFollowChange,
}: {
  entry: CompetitionResultEntry
  followEndpoint: string
  onFollowChange?: (
    userId: string,
    isFollowing: boolean
  ) => void
}) {
  return (
    <article
      className={[
        'rounded-[24px] border p-5 text-white',
        entry.isWinner
          ? 'border-amber-300/20 bg-amber-300/[0.045]'
          : 'border-white/10 bg-white/[0.025]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            {
              entry.contenderLabel
            }
          </p>

          {entry.creator ? (
            <CreatorReveal
              creator={
                entry.creator
              }
              compact
              followEndpoint={
                followEndpoint
              }
              onFollowChange={
                onFollowChange
              }
            />
          ) : null}
        </div>

        {entry.isWinner ? (
          <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-100">
            Winner
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Metric
          label="Final score"
          value={formatNumber(
            entry.evidence.finalScore,
            2
          )}
        />

        <Metric
          label="Confidence"
          value={formatPercent(
            entry.evidence.confidenceScore
          )}
        />

        <Metric
          label="Qualified"
          value={String(
            entry.evidence.qualifiedParticipantCount
          )}
        />

        <Metric
          label="Ratings"
          value={String(
            entry.evidence.ratingCount
          )}
        />
      </div>
    </article>
  )
}

function NonWinnerResult({
  resultStatus,
  entries,
  resultReason,
  followEndpoint,
  onFollowChange,
}: {
  resultStatus: CompetitionResultStatus
  entries: CompetitionResultEntry[]
  resultReason: string | null
  followEndpoint: string
  onFollowChange?: (
    userId: string,
    isFollowing: boolean
  ) => void
}) {
  return (
    <div>
      <div className="mb-4 border-b border-white/[0.08] pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Result
        </p>

        <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
          {resultStatus ===
          'tie'
            ? 'No single winner'
            : resultStatus ===
                'insufficient_evidence'
              ? 'Not enough evidence to declare a winner'
              : 'Competition closed without a winner'}
        </h3>

        {resultReason ? (
          <p className="mt-2 text-sm leading-6 text-white/45">
            {
              resultReason
            }
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {entries.map(
          (
            entry
          ) => (
            <EntryResultCard
              key={
                entry.entryId
              }
              entry={
                entry
              }
              followEndpoint={
                followEndpoint
              }
              onFollowChange={
                onFollowChange
              }
            />
          )
        )}
      </div>
    </div>
  )
}

function CreatorReveal({
  creator,
  compact = false,
  followEndpoint,
  onFollowChange,
}: {
  creator: CompetitionResultCreator
  compact?: boolean
  followEndpoint: string
  onFollowChange?: (
    userId: string,
    isFollowing: boolean
  ) => void
}) {
  const [
    following,
    setFollowing,
  ] = useState(
    Boolean(
      creator.isFollowing
    )
  )

  const [
    pending,
    setPending,
  ] = useState(
    false
  )

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null)

  const handleFollow =
    useCallback(
      async () => {
        if (
          pending
        ) {
          return
        }

        setPending(
          true
        )

        setErrorMessage(
          null
        )

        try {
          const response =
            await fetch(
              followEndpoint,
              {
                method:
                  'POST',

                headers: {
                  Accept:
                    'application/json',

                  'Content-Type':
                    'application/json',
                },

                credentials:
                  'same-origin',

                cache:
                  'no-store',

                body:
                  JSON.stringify({
                    user_id:
                      creator.userId,

                    follow:
                      !following,
                  }),
              }
            )

          const payload =
            await readJsonSafely<FollowApiResponse>(
              response
            )

          if (
            !response.ok
          ) {
            throw new Error(
              getApiErrorMessage(
                payload,
                'Could not update follow state.'
              )
            )
          }

          const persistedFollowing =
            typeof payload?.following ===
              'boolean'
              ? payload.following
              : !following

          setFollowing(
            persistedFollowing
          )

          onFollowChange?.(
            creator.userId,
            persistedFollowing
          )
        } catch (error) {
          setErrorMessage(
            getUnknownErrorMessage(
              error,
              'Could not update follow state.'
            )
          )
        } finally {
          setPending(
            false
          )
        }
      },
      [
        pending,
        followEndpoint,
        creator.userId,
        following,
        onFollowChange,
      ]
    )

  const identity = (
    <div className="min-w-0">
      <p
        className={[
          'truncate font-semibold text-white',
          compact
            ? 'text-sm'
            : 'text-base',
        ].join(' ')}
      >
        {
          creator.displayName
        }
      </p>

      {creator.username ? (
        <p className="mt-0.5 truncate text-xs text-white/35">
          @
          {
            normalizeUsername(
              creator.username
            )
          }
        </p>
      ) : null}
    </div>
  )

  return (
    <div className={compact ? 'mt-2' : 'mt-4'}>
      <div className="flex flex-wrap items-center gap-3">
        {creator.profileHref ? (
          <Link
            href={
              creator.profileHref
            }
            className="min-w-0 transition hover:opacity-80"
          >
            {identity}
          </Link>
        ) : (
          identity
        )}

        <button
          type="button"
          onClick={
            handleFollow
          }
          disabled={
            pending
          }
          className={[
            'inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
            following
              ? 'border-white/10 bg-white/[0.05] text-white/55'
              : 'border-white/15 bg-white text-black hover:bg-amber-100',
          ].join(' ')}
        >
          {pending
            ? 'Saving…'
            : following
              ? 'Following'
              : 'Follow'}
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-2 text-[11px] text-red-200"
        >
          {
            errorMessage
          }
        </p>
      ) : null}
    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-semibold text-white/70">
        {value}
      </p>
    </div>
  )
}

function buildWinningReasons(
  evidence: CompetitionResultEvidence
): string[] {
  const reasons: string[] =
    []

  if (
    evidence.averageRating !==
      null &&
    evidence.ratingCount >
      0
  ) {
    reasons.push(
      `Verified participants rated the route ${formatNumber(
        evidence.averageRating,
        2
      )}/5 across ${evidence.ratingCount} ${evidence.ratingCount === 1 ? 'rating' : 'ratings'}.`
    )
  }

  if (
    evidence.completionRate !==
      null
  ) {
    reasons.push(
      `Its verified completion quality finished at ${formatPercent(
        evidence.completionRate
      )}.`
    )
  }

  if (
    evidence.headToHeadEligibleCount >
      0
  ) {
    reasons.push(
      `It won ${evidence.headToHeadPreferenceCount} of ${evidence.headToHeadEligibleCount} verified head-to-head comparisons.`
    )
  }

  if (
    evidence.crossCompleterCount >
      0
  ) {
    reasons.push(
      `${evidence.crossCompleterCount} qualified ${evidence.crossCompleterCount === 1 ? 'explorer also completed' : 'explorers also completed'} another contender, giving the result comparative evidence.`
    )
  }

  reasons.push(
    `The final confidence-adjusted score was ${formatNumber(
      evidence.finalScore,
      2
    )} with ${formatPercent(
      evidence.confidenceScore
    )} evidence confidence.`
  )

  return reasons
}

function getResultPresentation(
  status: CompetitionResultStatus
): {
  label: string
  description: string
  wrapperClassName: string
  badgeClassName: string
} {
  switch (status) {
    case 'winner':
      return {
        label:
          'Winner settled',

        description:
          'The final score snapshot produced a winning contender.',

        wrapperClassName:
          'border-amber-300/20 bg-gradient-to-br from-amber-300/[0.08] via-white/[0.025] to-transparent',

        badgeClassName:
          'border-amber-300/25 bg-amber-300/[0.08] text-amber-100',
      }

    case 'tie':
      return {
        label:
          'Tie',

        description:
          'The settled evidence did not separate the leading contenders.',

        wrapperClassName:
          'border-sky-300/15 bg-gradient-to-br from-sky-300/[0.055] via-white/[0.025] to-transparent',

        badgeClassName:
          'border-sky-300/20 bg-sky-300/[0.06] text-sky-100',
      }

    case 'insufficient_evidence':
      return {
        label:
          'Insufficient evidence',

        description:
          'The competition settled without enough verified evidence to declare a winner.',

        wrapperClassName:
          'border-white/10 bg-white/[0.025]',

        badgeClassName:
          'border-white/10 bg-white/[0.04] text-white/55',
      }

    case 'void':
    default:
      return {
        label:
          'Void',

        description:
          'This competition closed without a valid settled result.',

        wrapperClassName:
          'border-red-400/15 bg-red-400/[0.035]',

        badgeClassName:
          'border-red-400/20 bg-red-400/[0.05] text-red-100',
      }
  }
}

async function readJsonSafely<T>(
  response: Response
): Promise<T | null> {
  try {
    return (
      await response.json()
    ) as T
  } catch {
    return null
  }
}

function getApiErrorMessage(
  payload:
    | {
        error?: unknown
        message?: unknown
      }
    | null,
  fallback: string
): string {
  if (
    payload &&
    typeof payload.error ===
      'string' &&
    payload.error
      .trim()
      .length >
      0
  ) {
    return payload.error
  }

  if (
    payload &&
    typeof payload.message ===
      'string' &&
    payload.message
      .trim()
      .length >
      0
  ) {
    return payload.message
  }

  return fallback
}

function getUnknownErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof
      Error &&
    error.message
      .trim()
      .length >
      0
  ) {
    return error.message
  }

  return fallback
}

function formatPercent(
  value: number
): string {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return '—'
  }

  return `${Math.round(
    Math.max(
      0,
      Math.min(
        1,
        value
      )
    ) *
      100
  )}%`
}

function formatNumber(
  value: number,
  decimalPlaces: number
): string {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return '—'
  }

  return value.toFixed(
    decimalPlaces
  )
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