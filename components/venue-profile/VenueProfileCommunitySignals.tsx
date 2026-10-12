'use client'

import {
  useMemo,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import type {
  CommunityHappeningIntelligence,
  CommunityPlaceSignalIntelligence,
} from '@/lib/community-signals/liveIntelligence'

type Props = {
  happenings:
    readonly CommunityHappeningIntelligence[]

  placeSignals:
    readonly CommunityPlaceSignalIntelligence[]
}

type SignalAction =
  | 'confirm'
  | 'absent'

type ActionState = {
  signalId: string
  action: SignalAction
} | null

type ActionErrorMap =
  Record<
    string,
    string
  >

function getPlaceSignalLabel(
  signal:
    CommunityPlaceSignalIntelligence
): string {
  if (
    signal.signalType ===
    'temporary_closure'
  ) {
    return 'Temporary closure'
  }

  return 'Line'
}

function getHappeningConfidenceLabel(
  signal:
    CommunityHappeningIntelligence
): string {
  if (
    signal.confidenceBand ===
    'strong'
  ) {
    return 'Strong'
  }

  if (
    signal.confidenceBand ===
    'supported'
  ) {
    return 'Supported'
  }

  return 'Emerging'
}

async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body =
      (await response.json()) as {
        error?: unknown
      }

    if (
      typeof body?.error ===
        'string' &&
      body.error.trim().length >
        0
    ) {
      return body.error.trim()
    }
  } catch {
    // Preserve the caller's stable fallback.
  }

  return fallback
}

export default function VenueProfileCommunitySignals({
  happenings,
  placeSignals,
}: Props) {
  const router =
    useRouter()

  const [
    activeAction,
    setActiveAction,
  ] =
    useState<ActionState>(
      null
    )

  const [
    confirmedSignalIds,
    setConfirmedSignalIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set<string>()
    )

  const [
    absentSignalIds,
    setAbsentSignalIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set<string>()
    )

  const [
    errorBySignalId,
    setErrorBySignalId,
  ] =
    useState<ActionErrorMap>(
      {}
    )

  const visiblePlaceSignals =
    useMemo(
      () =>
        placeSignals.filter(
          signal =>
            signal.signalState ===
            'present'
        ),
      [
        placeSignals,
      ]
    )

  const hasSignals =
    happenings.length >
      0 ||
    visiblePlaceSignals.length >
      0

  const clearSignalError =
    (
      signalId: string
    ) => {
      setErrorBySignalId(
        current => {
          if (
            !current[
              signalId
            ]
          ) {
            return current
          }

          const next = {
            ...current,
          }

          delete next[
            signalId
          ]

          return next
        }
      )
    }

  const setSignalError =
    (
      signalId: string,
      message: string
    ) => {
      setErrorBySignalId(
        current => ({
          ...current,

          [signalId]:
            message,
        })
      )
    }

  const refreshAuthoritativeState =
    () => {
      /**
       * The profile is a server-rendered surface.
       *
       * Refreshing causes the parent page to rerun the authoritative
       * Community Signals server loaders rather than attempting to
       * reproduce confidence, freshness, correction, or resolution
       * logic in this client component.
       */
      router.refresh()
    }

  const confirmHappening =
    async (
      signal:
        CommunityHappeningIntelligence
    ) => {
      const signalId =
        signal.intelligenceId

      if (
        activeAction !==
          null ||
        signal.viewerResponse !==
          null ||
        confirmedSignalIds.has(
          signalId
        ) ||
        absentSignalIds.has(
          signalId
        )
      ) {
        return
      }

      clearSignalError(
        signalId
      )

      setActiveAction({
        signalId,
        action:
          'confirm',
      })

      try {
        const response =
          await fetch(
            `/api/event-occurrences/${encodeURIComponent(
              signal.occurrenceId
            )}/confirmations`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify(
                  {}
                ),
            }
          )

        if (
          !response.ok
        ) {
          throw new Error(
            await readErrorMessage(
              response,
              'Could not confirm this signal.'
            )
          )
        }

        setConfirmedSignalIds(
          current => {
            const next =
              new Set(
                current
              )

            next.add(
              signalId
            )

            return next
          }
        )

        refreshAuthoritativeState()
      } catch (
        error
      ) {
        setSignalError(
          signalId,
          error instanceof
            Error
            ? error.message
            : 'Could not confirm this signal.'
        )
      } finally {
        setActiveAction(
          null
        )
      }
    }

  const reportHappeningAbsent =
    async (
      signal:
        CommunityHappeningIntelligence
    ) => {
      const signalId =
        signal.intelligenceId

      if (
        activeAction !==
          null ||
        signal.viewerResponse !==
          null ||
        confirmedSignalIds.has(
          signalId
        ) ||
        absentSignalIds.has(
          signalId
        )
      ) {
        return
      }

      clearSignalError(
        signalId
      )

      setActiveAction({
        signalId,
        action:
          'absent',
      })

      try {
        const response =
          await fetch(
            `/api/event-occurrences/${encodeURIComponent(
              signal.occurrenceId
            )}/corrections`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify({
                  correction_type:
                    'canceled',

                  claim: {},
                }),
            }
          )

        if (
          !response.ok
        ) {
          throw new Error(
            await readErrorMessage(
              response,
              'Could not report this signal.'
            )
          )
        }

        setAbsentSignalIds(
          current => {
            const next =
              new Set(
                current
              )

            next.add(
              signalId
            )

            return next
          }
        )

        refreshAuthoritativeState()
      } catch (
        error
      ) {
        setSignalError(
          signalId,
          error instanceof
            Error
            ? error.message
            : 'Could not report this signal.'
        )
      } finally {
        setActiveAction(
          null
        )
      }
    }

  const confirmPlaceSignal =
    async (
      signal:
        CommunityPlaceSignalIntelligence
    ) => {
      const signalId =
        signal.intelligenceId

      if (
        activeAction !==
          null ||
        confirmedSignalIds.has(
          signalId
        )
      ) {
        return
      }

      clearSignalError(
        signalId
      )

      setActiveAction({
        signalId,
        action:
          'confirm',
      })

      try {
        const response =
          await fetch(
            '/api/community-signals/place',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify({
                  venue_id:
                    signal.venueId,

                  signal_type:
                    signal.signalType,

                  signal_state:
                    'present',
                }),
            }
          )

        if (
          !response.ok
        ) {
          throw new Error(
            await readErrorMessage(
              response,
              'Could not confirm this signal.'
            )
          )
        }

        setConfirmedSignalIds(
          current => {
            const next =
              new Set(
                current
              )

            next.add(
              signalId
            )

            return next
          }
        )

        refreshAuthoritativeState()
      } catch (
        error
      ) {
        setSignalError(
          signalId,
          error instanceof
            Error
            ? error.message
            : 'Could not confirm this signal.'
        )
      } finally {
        setActiveAction(
          null
        )
      }
    }

  const reportPlaceSignalAbsent =
    async (
      signal:
        CommunityPlaceSignalIntelligence
    ) => {
      const signalId =
        signal.intelligenceId

      if (
        activeAction !==
          null ||
        absentSignalIds.has(
          signalId
        )
      ) {
        return
      }

      clearSignalError(
        signalId
      )

      setActiveAction({
        signalId,
        action:
          'absent',
      })

      try {
        const response =
          await fetch(
            '/api/community-signals/place',
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify({
                  venue_id:
                    signal.venueId,

                  signal_type:
                    signal.signalType,

                  signal_state:
                    'absent',
                }),
            }
          )

        if (
          !response.ok
        ) {
          throw new Error(
            await readErrorMessage(
              response,
              'Could not report this signal.'
            )
          )
        }

        setAbsentSignalIds(
          current => {
            const next =
              new Set(
                current
              )

            next.add(
              signalId
            )

            return next
          }
        )

        refreshAuthoritativeState()
      } catch (
        error
      ) {
        setSignalError(
          signalId,
          error instanceof
            Error
            ? error.message
            : 'Could not report this signal.'
        )
      } finally {
        setActiveAction(
          null
        )
      }
    }

  if (
    !hasSignals
  ) {
    return null
  }

  return (
    <section
      aria-labelledby="venue-community-signals-heading"
      className="
        rounded-[1.75rem]
        border
        border-cyan-400/15
        bg-cyan-400/[0.055]
        p-5
        shadow-2xl
        backdrop-blur-xl
      "
    >
      <div className="mb-4 space-y-1">
        <h2
          id="venue-community-signals-heading"
          className="
            text-sm
            font-black
            uppercase
            tracking-[0.22em]
            text-cyan-200
          "
        >
          Community Signals
        </h2>

        <p
          className="
            text-sm
            leading-6
            text-slate-400
          "
        >
          Live community intelligence reported at this venue.
        </p>
      </div>

      <ul className="space-y-3">
        {visiblePlaceSignals.map(
          signal => {
            const signalId =
              signal.intelligenceId

            const isConfirmed =
              confirmedSignalIds.has(
                signalId
              )

            const isAbsent =
              absentSignalIds.has(
                signalId
              )

            const isConfirming =
              activeAction?.signalId ===
                signalId &&
              activeAction.action ===
                'confirm'

            const isReportingAbsent =
              activeAction?.signalId ===
                signalId &&
              activeAction.action ===
                'absent'

            const label =
              getPlaceSignalLabel(
                signal
              )

            return (
              <li
                key={
                  signalId
                }
                className="
                  rounded-2xl
                  border
                  border-white/[0.08]
                  bg-black/25
                  p-4
                "
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="
                          rounded-full
                          border
                          border-cyan-300/20
                          bg-cyan-300/10
                          px-2.5
                          py-1
                          text-[10px]
                          font-black
                          uppercase
                          tracking-[0.14em]
                          text-cyan-200
                        "
                      >
                        Current
                      </span>

                      <h3 className="font-bold text-white">
                        {label}
                      </h3>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {signal.supportingContributors >=
                      2
                        ? `${signal.supportingContributors} community members support this signal.`
                        : 'Recently reported by the community.'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {isConfirmed ? (
                      <span
                        role="status"
                        className="
                          inline-flex
                          min-h-9
                          items-center
                          rounded-xl
                          border
                          border-emerald-400/20
                          bg-emerald-400/10
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-emerald-200
                        "
                      >
                        Thanks — confirmed
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          activeAction !==
                            null ||
                          isAbsent
                        }
                        aria-busy={
                          isConfirming
                        }
                        onClick={
                          () => {
                            void confirmPlaceSignal(
                              signal
                            )
                          }
                        }
                        className="
                          min-h-9
                          rounded-xl
                          border
                          border-cyan-300/20
                          bg-cyan-300/[0.07]
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-cyan-100
                          transition
                          hover:border-cyan-300/40
                          hover:bg-cyan-300/10
                          focus-visible:outline-none
                          focus-visible:ring-2
                          focus-visible:ring-cyan-300
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        {isConfirming
                          ? 'Confirming…'
                          : 'Still happening'}
                      </button>
                    )}

                    {isAbsent ? (
                      <span
                        role="status"
                        className="
                          inline-flex
                          min-h-9
                          items-center
                          rounded-xl
                          border
                          border-emerald-400/20
                          bg-emerald-400/10
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-emerald-200
                        "
                      >
                        Thanks — reported
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          activeAction !==
                            null ||
                          isConfirmed
                        }
                        aria-busy={
                          isReportingAbsent
                        }
                        onClick={
                          () => {
                            void reportPlaceSignalAbsent(
                              signal
                            )
                          }
                        }
                        className="
                          min-h-9
                          rounded-xl
                          border
                          border-rose-300/20
                          bg-rose-300/[0.06]
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-rose-100
                          transition
                          hover:border-rose-300/40
                          hover:bg-rose-300/10
                          focus-visible:outline-none
                          focus-visible:ring-2
                          focus-visible:ring-rose-300
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        {isReportingAbsent
                          ? 'Reporting…'
                          : 'Not there'}
                      </button>
                    )}
                  </div>
                </div>

                {errorBySignalId[
                  signalId
                ] ? (
                  <p
                    role="alert"
                    className="mt-3 text-xs leading-5 text-rose-300"
                  >
                    {
                      errorBySignalId[
                        signalId
                      ]
                    }
                  </p>
                ) : null}
              </li>
            )
          }
        )}

        {happenings.map(
          signal => {
            const signalId =
              signal.intelligenceId

            const localViewerResponse =
              confirmedSignalIds.has(
                signalId
              )
                ? 'confirmed'
                : absentSignalIds.has(
                      signalId
                    )
                  ? 'not_there'
                  : null

            const viewerResponse =
              signal.viewerResponse ??
              localViewerResponse

            const isConfirming =
              activeAction?.signalId ===
                signalId &&
              activeAction.action ===
                'confirm'

            const isReportingAbsent =
              activeAction?.signalId ===
                signalId &&
              activeAction.action ===
                'absent'

            const confidenceLabel =
              getHappeningConfidenceLabel(
                signal
              )

            return (
              <li
                key={
                  signalId
                }
                className="
                  rounded-2xl
                  border
                  border-white/[0.08]
                  bg-black/25
                  p-4
                "
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="
                          rounded-full
                          border
                          border-cyan-300/20
                          bg-cyan-300/10
                          px-2.5
                          py-1
                          text-[10px]
                          font-black
                          uppercase
                          tracking-[0.14em]
                          text-cyan-200
                        "
                      >
                        {
                          confidenceLabel
                        }
                      </span>

                      <h3 className="font-bold text-white">
                        {
                          signal.title
                        }
                      </h3>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {signal.contributors >=
                      2
                        ? `${signal.contributors} community members report this.`
                        : 'Recently reported by the community.'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {viewerResponse ===
                    'confirmed' ? (
                      <span
                        role="status"
                        className="
                          inline-flex
                          min-h-9
                          items-center
                          rounded-xl
                          border
                          border-emerald-400/20
                          bg-emerald-400/10
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-emerald-200
                        "
                      >
                        Thanks — confirmed
                      </span>
                    ) : viewerResponse ===
                      'not_there' ? (
                      <span
                        role="status"
                        className="
                          inline-flex
                          min-h-9
                          items-center
                          rounded-xl
                          border
                          border-emerald-400/20
                          bg-emerald-400/10
                          px-3
                          py-2
                          text-xs
                          font-bold
                          text-emerald-200
                        "
                      >
                        Thanks — reported
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={
                            activeAction !==
                              null
                          }
                          aria-busy={
                            isConfirming
                          }
                          onClick={
                            () => {
                              void confirmHappening(
                                signal
                              )
                            }
                          }
                          className="
                            min-h-9
                            rounded-xl
                            border
                            border-cyan-300/20
                            bg-cyan-300/[0.07]
                            px-3
                            py-2
                            text-xs
                            font-bold
                            text-cyan-100
                            transition
                            hover:border-cyan-300/40
                            hover:bg-cyan-300/10
                            focus-visible:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-cyan-300
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          {isConfirming
                            ? 'Confirming…'
                            : 'Still happening'}
                        </button>

                        <button
                          type="button"
                          disabled={
                            activeAction !==
                              null
                          }
                          aria-busy={
                            isReportingAbsent
                          }
                          onClick={
                            () => {
                              void reportHappeningAbsent(
                                signal
                              )
                            }
                          }
                          className="
                            min-h-9
                            rounded-xl
                            border
                            border-rose-300/20
                            bg-rose-300/[0.06]
                            px-3
                            py-2
                            text-xs
                            font-bold
                            text-rose-100
                            transition
                            hover:border-rose-300/40
                            hover:bg-rose-300/10
                            focus-visible:outline-none
                            focus-visible:ring-2
                            focus-visible:ring-rose-300
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          {isReportingAbsent
                            ? 'Reporting…'
                            : 'Not there'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {errorBySignalId[
                  signalId
                ] ? (
                  <p
                    role="alert"
                    className="mt-3 text-xs leading-5 text-rose-300"
                  >
                    {
                      errorBySignalId[
                        signalId
                      ]
                    }
                  </p>
                ) : null}
              </li>
            )
          }
        )}
      </ul>
    </section>
  )
}