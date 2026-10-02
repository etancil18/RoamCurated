'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

type OpportunityCandidate = {
  eventId: string
  occurrenceId: string

  venueId: string
  title: string

  startsAt: string
  endsAt: string | null
  timezone: string | null

  venue: {
    id: string
    name: string
    lat: number | null
    lon: number | null
  }

  venueAlreadyInRemainingFlow: boolean
  remainingFlowPosition: number | null
}

type InterventionFeasibilityReason =
  | 'opportunity_not_actionable'
  | 'no_target'
  | 'same_venue'
  | 'venue_already_executable'
  | 'target_has_active_detour'

type InterventionFeasibility = {
  feasible: boolean
  reason:
    InterventionFeasibilityReason | null
}

type InterventionRecommendation = {
  kind:
    | 'detour'
    | 'swap'
    | 'none'

  reason:
    | 'preserve_original_route'
    | 'detour_unavailable'
    | 'no_feasible_intervention'
}

type ScoredOpportunity = {
  candidate: OpportunityCandidate

  actionable: boolean

  ineligibleReason:
    | 'expired'
    | 'too_early'
    | 'insufficient_route_context'
    | 'excessive_route_cost'
    | null

  score: number | null

  interventions: {
    swap: InterventionFeasibility
    detour: InterventionFeasibility
  }

  recommendation:
    InterventionRecommendation
}

type OpportunityResponse = {
  asOf?: string

  scoredOpportunities?: ScoredOpportunity[]
}

type Props = {
  sessionId: string
}

/**
 * 018E.1 — Passive opportunity monitoring is intentionally sparse.
 *
 * User-driven lifecycle changes refetch immediately.
 * This interval exists only as a fallback for opportunities whose
 * actionability changes because time passes while the Flow remains open.
 */
const REFRESH_INTERVAL_MS =
  5 * 60_000


function getStartsInLabel(
  startsAt: string,
  nowMs: number
): string | null {
  const startsAtMs =
    Date.parse(
      startsAt
    )

  if (
    !Number.isFinite(
      startsAtMs
    )
  ) {
    return null
  }

  const differenceMinutes =
    Math.ceil(
      (
        startsAtMs -
        nowMs
      ) /
        60_000
    )

  if (
    differenceMinutes <= 0
  ) {
    return 'Happening now'
  }

  if (
    differenceMinutes < 60
  ) {
    return `Starts in ${differenceMinutes}m`
  }

  const hours =
    Math.floor(
      differenceMinutes /
        60
    )

  const minutes =
    differenceMinutes %
    60

  if (minutes === 0) {
    return `Starts in ${hours}h`
  }

  return `Starts in ${hours}h ${minutes}m`
}


export default function ActiveFlowOpportunitySurface({
  sessionId,
}: Props) {
  const router =
    useRouter()

  const [
    opportunity,
    setOpportunity,
  ] =
    useState<ScoredOpportunity | null>(
      null
    )

  const [
    nowMs,
    setNowMs,
  ] =
    useState(
      () =>
        Date.now()
    )

  const [
    swapping,
    setSwapping,
  ] =
    useState(
      false
    )

  const [
    swapError,
    setSwapError,
  ] =
    useState<string | null>(
      null
    )

  const [
    addingDetour,
    setAddingDetour,
  ] =
    useState(
      false
    )

  const [
    detourError,
    setDetourError,
  ] =
    useState<string | null>(
      null
    )

  /**
   * 018E — Dismissal is presentation preference only.
   *
   * It is deliberately independent from Swap / Detour mutation state.
   */
  const [
    dismissing,
    setDismissing,
  ] =
    useState(
      false
    )

  const [
    dismissError,
    setDismissError,
  ] =
    useState<string | null>(
      null
    )

  /**
   * 018E.1 — Incrementing this value requests an immediate
   * authoritative opportunity reload through the existing loader.
   *
   * It does not contain opportunity state and does not perform
   * client-side scoring or suppression.
   */
  const [
    opportunityRefreshGeneration,
    setOpportunityRefreshGeneration,
  ] =
    useState(
      0
    )

  useEffect(
    () => {
      let cancelled =
        false

      let requestController:
        AbortController | null =
        null

      async function loadOpportunity() {
        requestController?.abort()

        const controller =
          new AbortController()

        requestController =
          controller

        try {
          const response =
            await fetch(
              `/api/active-flow/opportunities?session_id=${encodeURIComponent(
                sessionId
              )}`,
              {
                method: 'GET',
                cache: 'no-store',
                signal:
                  controller.signal,
              }
            )

          if (
            !response.ok
          ) {
            console.warn(
              '[active-flow/opportunity-surface] Opportunity fetch returned non-success status:',
              response.status
            )

            return
          }

          const payload =
            (await response.json()) as OpportunityResponse

          if (cancelled) {
            return
          }

          const nextOpportunity =
            Array.isArray(
              payload.scoredOpportunities
            )
              ? payload.scoredOpportunities.find(
                  (
                    scoredOpportunity
                  ) =>
                    scoredOpportunity.actionable ===
                      true &&
                    scoredOpportunity.score !=
                      null
                ) ?? null
              : null

          setOpportunity(
            nextOpportunity
          )

          setNowMs(
            Date.now()
          )
        } catch (error) {
          if (
            controller.signal.aborted ||
            cancelled
          ) {
            return
          }

          console.warn(
            '[active-flow/opportunity-surface] Opportunity fetch failed:',
            error
          )
        }
      }

      void loadOpportunity()

      const intervalId =
        window.setInterval(
          () => {
            setNowMs(
              Date.now()
            )

            void loadOpportunity()
          },
          REFRESH_INTERVAL_MS
        )

      return () => {
        cancelled =
          true

        requestController?.abort()

        window.clearInterval(
          intervalId
        )
      }
    },

    [
      sessionId,
      opportunityRefreshGeneration,
    ]
  )

  const startsInLabel =
    useMemo(
      () =>
        opportunity
          ? getStartsInLabel(
              opportunity.candidate
                .startsAt,
              nowMs
            )
          : null,
      [
        opportunity,
        nowMs,
      ]
    )

  const handleSwapIntoFlow =
    async () => {
      if (
        !opportunity ||
        opportunity.interventions.swap
          .feasible !== true ||
        swapping ||
        addingDetour ||
        dismissing
      ) {
        return
      }

      setSwapping(
        true
      )

      setSwapError(
        null
      )

      setDetourError(
        null
      )

      setDismissError(
        null
      )

      try {
        const response =
          await fetch(
            '/api/active-flow/opportunities/swap',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  session_id:
                    sessionId,

                  event_id:
                    opportunity.candidate
                      .eventId,
                }),
            }
          )

        const payload =
          (await response.json()) as {
            error?: unknown
          }

        if (
          !response.ok
        ) {
          setSwapError(
            typeof payload.error ===
              'string'
              ? payload.error
              : 'This opportunity could not be added to your Flow.'
          )

          return
        }

        setOpportunity(
          null
        )

        router.refresh()
      } catch (error) {
        console.warn(
          '[active-flow/opportunity-surface] Swap failed:',
          error
        )

        setSwapError(
          'This opportunity could not be added to your Flow.'
        )
      } finally {
        setSwapping(
          false
        )
      }
    }

  const handleAddDetourToFlow =
    async () => {
      if (
        !opportunity ||
        opportunity.interventions.detour
          .feasible !== true ||
        addingDetour ||
        swapping ||
        dismissing
      ) {
        return
      }

      setAddingDetour(
        true
      )

      setDetourError(
        null
      )

      setSwapError(
        null
      )

      setDismissError(
        null
      )

      try {
        const response =
          await fetch(
            '/api/active-flow/opportunities/detour',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  session_id:
                    sessionId,

                  event_id:
                    opportunity.candidate
                      .eventId,
                }),
            }
          )

        const payload =
          (await response.json()) as {
            error?: unknown
          }

        if (
          !response.ok
        ) {
          setDetourError(
            typeof payload.error ===
              'string'
              ? payload.error
              : 'This detour could not be added to your Flow.'
          )

          return
        }

        setOpportunity(
          null
        )

        router.refresh()
      } catch (error) {
        console.warn(
          '[active-flow/opportunity-surface] Detour failed:',
          error
        )

        setDetourError(
          'This detour could not be added to your Flow.'
        )
      } finally {
        setAddingDetour(
          false
        )
      }
    }

  /**
   * 018E — "Not this one"
   *
   * Browser authority is limited to the existing session + event identity.
   *
   * The authenticated writer independently re-establishes:
   *
   * - user identity
   * - session ownership / active state
   * - adaptive eligibility
   * - current candidate state
   * - current opportunity actionability
   *
   * Successful dismissal clears the current card immediately.
   * 018D persisted suppression prevents the same event from returning
   * on subsequent opportunity polling.
   */
  const handleDismissOpportunity =
    async () => {
      if (
        !opportunity ||
        dismissing ||
        swapping ||
        addingDetour
      ) {
        return
      }

      setDismissing(
        true
      )

      setDismissError(
        null
      )

      setSwapError(
        null
      )

      setDetourError(
        null
      )

      try {
        const response =
          await fetch(
            '/api/active-flow/opportunities/dismiss',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  session_id:
                    sessionId,

                  event_id:
                    opportunity.candidate
                      .eventId,
                }),
            }
          )

        const payload =
          (await response.json()) as {
            error?: unknown
          }

        if (
          !response.ok
        ) {
          setDismissError(
            typeof payload.error ===
              'string'
              ? payload.error
              : 'This opportunity could not be dismissed.'
          )

          return
        }

        /**
         * 018E.1 — Remove the dismissed card immediately, then
         * request the next server-authoritative presentation.
         *
         * 018D persisted suppression ensures the dismissed event
         * cannot simply return in the successful response.
         */
        setOpportunity(
          null
        )

        setOpportunityRefreshGeneration(
          (
            generation
          ) =>
            generation + 1
        )
      } catch (error) {
        console.warn(
          '[active-flow/opportunity-surface] Dismissal failed:',
          error
        )

        setDismissError(
          'This opportunity could not be dismissed.'
        )
      } finally {
        setDismissing(
          false
        )
      }
    }

  if (!opportunity) {
    return null
  }

  const {
    candidate,
  } = opportunity

  return (
    <section
      aria-labelledby="active-flow-live-opportunity-title"
      className="mt-6"
    >
      <div className="overflow-hidden rounded-[1.5rem] bg-cyan-300/[0.055] shadow-[0_18px_60px_rgba(0,0,0,0.2)] ring-1 ring-cyan-200/[0.12]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]"
            />

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">
              Live near your flow
            </p>
          </div>

          <div className="mt-4">
            <h2
              id="active-flow-live-opportunity-title"
              className="text-lg font-black tracking-[-0.025em] text-white"
            >
              {candidate.title}
            </h2>

            <p className="mt-1.5 text-sm font-bold text-zinc-300">
              {candidate.venue.name}
            </p>
          </div>

          {startsInLabel ? (
            <div className="mt-4">
              <span className="inline-flex rounded-full bg-black/20 px-3 py-1.5 text-[11px] font-black text-cyan-100 ring-1 ring-white/[0.06]">
                {startsInLabel}
              </span>
            </div>
          ) : null}

          <div className="mt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {opportunity.recommendation.kind ===
              'detour' ? (
                <>
                  <button
                    type="button"
                    disabled={
                      opportunity.interventions.detour
                        .feasible !== true ||
                      addingDetour ||
                      swapping ||
                      dismissing
                    }
                    onClick={
                      handleAddDetourToFlow
                    }
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500 sm:w-auto"
                  >
                    {addingDetour
                      ? 'Adding detour…'
                      : 'Add as detour'}
                  </button>

                  {opportunity.interventions.swap
                    .feasible === true ? (
                    <button
                      type="button"
                      disabled={
                        swapping ||
                        addingDetour ||
                        dismissing
                      }
                      onClick={
                        handleSwapIntoFlow
                      }
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-cyan-300/10 px-5 text-sm font-black text-cyan-100 ring-1 ring-cyan-200/20 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-zinc-500 disabled:ring-white/[0.06] sm:w-auto"
                    >
                      {swapping
                        ? 'Updating your Flow…'
                        : 'Swap instead'}
                    </button>
                  ) : null}
                </>
              ) : null}

              {opportunity.recommendation.kind ===
              'swap' ? (
                <button
                  type="button"
                  disabled={
                    opportunity.interventions.swap
                      .feasible !== true ||
                    swapping ||
                    addingDetour ||
                    dismissing
                  }
                  onClick={
                    handleSwapIntoFlow
                  }
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500 sm:w-auto"
                >
                  {swapping
                    ? 'Updating your Flow…'
                    : 'Swap into my Flow'}
                </button>
              ) : null}

              <button
                type="button"
                disabled={
                  dismissing ||
                  swapping ||
                  addingDetour
                }
                onClick={
                  handleDismissOpportunity
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-xs font-black text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600 sm:w-auto"
              >
                {dismissing
                  ? 'Dismissing…'
                  : 'Not this one'}
              </button>
            </div>

            {swapError ? (
              <p
                role="alert"
                className="mt-3 text-xs font-medium leading-5 text-red-300"
              >
                {swapError}
              </p>
            ) : null}

            {detourError ? (
              <p
                role="alert"
                className="mt-3 text-xs font-medium leading-5 text-red-300"
              >
                {detourError}
              </p>
            ) : null}

            {dismissError ? (
              <p
                role="alert"
                className="mt-3 text-xs font-medium leading-5 text-red-300"
              >
                {dismissError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}