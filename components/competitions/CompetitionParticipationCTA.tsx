'use client'

import Link from 'next/link'
import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

export type CompetitionParticipationCTAStatus =
  | 'not_started'
  | 'in_progress'
  | 'ready_to_complete'
  | 'qualified'
  | 'completed_not_qualified'
  | 'closed'
  | 'unavailable'

type StartCompetitionResponse = {
  competitionId?: unknown
  competitionEntryId?: unknown
  flowSessionId?: unknown
  participationId?: unknown

  competition_id?: unknown
  competition_entry_id?: unknown
  flow_session_id?: unknown
  participation_id?: unknown

  created?: unknown

  error?: unknown
  message?: unknown
}

type CompleteFlowResponse = {
  session?: {
    id?: unknown
    status?: unknown
  } | null

  error?: unknown
  message?: unknown
}

export type CompetitionParticipationCTAProps = {
  competitionId: string
  entryId: string

  status: CompetitionParticipationCTAStatus

  /**
   * Existing Active Flow session for an already-started
   * participation.
   */
  flowSessionId?: string | null

  /**
   * Optional explicit URL for the Active Flow experience.
   *
   * If omitted, the component uses:
   *
   *   /active-flow?session_id=<flowSessionId>
   */
  continueHref?: string | null

  /**
   * Optional explicit URL to use immediately after a new
   * participation is started.
   *
   * If omitted, the canonical flow session returned from the start
   * endpoint is converted to:
   *
   *   /active-flow?session_id=<flowSessionId>
   */
  startedFlowHref?: string | null

  /**
   * Optional progress context for CTA copy.
   */
  verifiedStopCount?: number | null
  totalStopCount?: number | null
  requiredVerifiedStopCount?: number | null

  /**
   * Set false when the current viewer is not authenticated.
   */
  signedIn?: boolean

  /**
   * Set true when the viewer owns this competition entry.
   *
   * The server endpoint must still enforce the ownership rule.
   * This prop is only for immediate UX feedback.
   */
  isOwnEntry?: boolean

  /**
   * Allows the parent to suppress starting even while the
   * competition itself is live.
   */
  canStart?: boolean

  /**
   * Optional login destination.
   */
  loginHref?: string

  className?: string
}

export default function CompetitionParticipationCTA({
  competitionId,
  entryId,
  status,
  flowSessionId = null,
  continueHref = null,
  startedFlowHref = null,
  verifiedStopCount = null,
  totalStopCount = null,
  requiredVerifiedStopCount = null,
  signedIn = true,
  isOwnEntry = false,
  canStart = true,
  loginHref = '/login',
  className = '',
}: CompetitionParticipationCTAProps) {
  const router =
    useRouter()

  const [
    pendingAction,
    setPendingAction,
  ] = useState<
    'start' | 'complete' | null
  >(null)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null)

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

  const resolvedContinueHref =
    useMemo(
      () =>
        resolveContinueHref({
          explicitHref:
            continueHref,

          flowSessionId,
        }),
      [
        continueHref,
        flowSessionId,
      ]
    )

  const handleStart =
    useCallback(
      async () => {
        if (
          pendingAction ||
          isOwnEntry ||
          !canStart
        ) {
          return
        }

        setErrorMessage(
          null
        )

        setPendingAction(
          'start'
        )

        try {
          const response =
            await fetch(
              `/api/competitions/${encodeURIComponent(
                competitionId
              )}/entries/${encodeURIComponent(
                entryId
              )}/start`,
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
              }
            )

          const payload =
            await readJsonSafely<StartCompetitionResponse>(
              response
            )

          if (
            !response.ok
          ) {
            throw new Error(
              getApiErrorMessage(
                payload,
                getStartFallbackMessage(
                  response.status
                )
              )
            )
          }

          const returnedFlowSessionId =
            readFlowSessionId(
              payload
            )

          if (
            !returnedFlowSessionId
          ) {
            throw new Error(
              'The competition started, but no Active Flow session was returned.'
            )
          }

          const destination =
            startedFlowHref ??
            resolvedContinueHref ??
            buildDefaultFlowHref(
              returnedFlowSessionId
            )

          router.push(
            destination
          )

          router.refresh()
        } catch (error) {
          setErrorMessage(
            getUnknownErrorMessage(
              error,
              'Could not start this contender route.'
            )
          )
        } finally {
          setPendingAction(
            null
          )
        }
      },
      [
        pendingAction,
        isOwnEntry,
        canStart,
        competitionId,
        entryId,
        startedFlowHref,
        resolvedContinueHref,
        router,
      ]
    )

  const handleComplete =
    useCallback(
      async () => {
        if (
          pendingAction ||
          !flowSessionId
        ) {
          return
        }

        setErrorMessage(
          null
        )

        setPendingAction(
          'complete'
        )

        try {
          const response =
            await fetch(
              '/api/active-flow/complete',
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
                    session_id:
                      flowSessionId,
                  }),
              }
            )

          const payload =
            await readJsonSafely<CompleteFlowResponse>(
              response
            )

          if (
            !response.ok
          ) {
            throw new Error(
              getApiErrorMessage(
                payload,
                getCompletionFallbackMessage(
                  response.status
                )
              )
            )
          }

          /**
           * /api/active-flow/complete is the canonical completion
           * boundary.
           *
           * Competition-linked sessions are reconciled and
           * finalized there. The CTA only refreshes the rendered
           * server state afterward.
           */
          router.refresh()
        } catch (error) {
          setErrorMessage(
            getUnknownErrorMessage(
              error,
              'Could not complete this contender route.'
            )
          )
        } finally {
          setPendingAction(
            null
          )
        }
      },
      [
        pendingAction,
        flowSessionId,
        router,
      ]
    )

  return (
    <div
      className={[
        'w-full',
        className,
      ].join(' ')}
    >
      {status ===
      'not_started' ? (
        <NotStartedAction
          signedIn={
            signedIn
          }
          loginHref={
            loginHref
          }
          isOwnEntry={
            isOwnEntry
          }
          canStart={
            canStart
          }
          pending={
            pendingAction ===
            'start'
          }
          onStart={
            handleStart
          }
        />
      ) : null}

      {status ===
      'in_progress' ? (
        <InProgressAction
          continueHref={
            resolvedContinueHref
          }
          verifiedStopCount={
            normalizedVerifiedStopCount
          }
          totalStopCount={
            normalizedTotalStopCount
          }
          requiredVerifiedStopCount={
            normalizedRequiredVerifiedStopCount
          }
        />
      ) : null}

      {status ===
      'ready_to_complete' ? (
        <ReadyToCompleteAction
          continueHref={
            resolvedContinueHref
          }
          canComplete={
            Boolean(
              flowSessionId
            )
          }
          pending={
            pendingAction ===
            'complete'
          }
          onComplete={
            handleComplete
          }
        />
      ) : null}

      {status ===
      'qualified' ? (
        <QualifiedState
          verifiedStopCount={
            normalizedVerifiedStopCount
          }
          totalStopCount={
            normalizedTotalStopCount
          }
        />
      ) : null}

      {status ===
      'completed_not_qualified' ? (
        <CompletedNotQualifiedState
          verifiedStopCount={
            normalizedVerifiedStopCount
          }
          requiredVerifiedStopCount={
            normalizedRequiredVerifiedStopCount
          }
        />
      ) : null}

      {status ===
      'closed' ? (
        <PassiveState
          title="Participation closed"
          description="This competition is no longer accepting contender runs."
          tone="violet"
        />
      ) : null}

      {status ===
      'unavailable' ? (
        <PassiveState
          title="Unavailable"
          description="This contender route cannot currently be started."
          tone="neutral"
        />
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/[0.055] px-4 py-3 text-xs leading-5 text-red-100"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}

// ============================================================
// STATES
// ============================================================

function NotStartedAction({
  signedIn,
  loginHref,
  isOwnEntry,
  canStart,
  pending,
  onStart,
}: {
  signedIn: boolean
  loginHref: string
  isOwnEntry: boolean
  canStart: boolean
  pending: boolean
  onStart: () => void
}) {
  if (!signedIn) {
    return (
      <Link
        href={
          loginHref
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100"
      >
        Sign in to start
      </Link>
    )
  }

  if (isOwnEntry) {
    return (
      <PassiveState
        title="Your contender"
        description="You cannot participate in your own competition entry."
        tone="neutral"
      />
    )
  }

  if (!canStart) {
    return (
      <PassiveState
        title="Not open"
        description="This contender is not currently available to start."
        tone="neutral"
      />
    )
  }

  return (
    <button
      type="button"
      disabled={
        pending
      }
      onClick={
        onStart
      }
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending
        ? 'Starting…'
        : 'Start this contender'}
    </button>
  )
}

function InProgressAction({
  continueHref,
  verifiedStopCount,
  totalStopCount,
  requiredVerifiedStopCount,
}: {
  continueHref: string | null
  verifiedStopCount: number
  totalStopCount: number
  requiredVerifiedStopCount: number
}) {
  return (
    <div className="space-y-3">
      <ProgressSummary
        verifiedStopCount={
          verifiedStopCount
        }
        totalStopCount={
          totalStopCount
        }
        requiredVerifiedStopCount={
          requiredVerifiedStopCount
        }
      />

      {continueHref ? (
        <Link
          href={
            continueHref
          }
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100"
        >
          Continue contender
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/35"
        >
          Continue unavailable
        </button>
      )}
    </div>
  )
}

function ReadyToCompleteAction({
  continueHref,
  canComplete,
  pending,
  onComplete,
}: {
  continueHref: string | null
  canComplete: boolean
  pending: boolean
  onComplete: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] px-4 py-3">
        <p className="text-xs font-semibold text-emerald-100">
          All route stops
          checked in
        </p>

        <p className="mt-1 text-[11px] leading-5 text-white/40">
          Finish the Active
          Flow to finalize your
          competition
          participation.
        </p>
      </div>

      <button
        type="button"
        disabled={
          pending ||
          !canComplete
        }
        onClick={
          onComplete
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-200 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending
          ? 'Completing…'
          : 'Complete contender'}
      </button>

      {continueHref ? (
        <Link
          href={
            continueHref
          }
          className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/10 px-4 text-xs font-semibold text-white/50 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          Review route
        </Link>
      ) : null}
    </div>
  )
}

function QualifiedState({
  verifiedStopCount,
  totalStopCount,
}: {
  verifiedStopCount: number
  totalStopCount: number
}) {
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300"
        />

        <div>
          <p className="text-sm font-semibold text-emerald-100">
            Qualified
          </p>

          <p className="mt-1 text-xs leading-5 text-white/45">
            Your completed
            contender has enough
            verified evidence to
            count.
            {totalStopCount >
            0
              ? ` ${verifiedStopCount}/${totalStopCount} stops verified.`
              : ''}
          </p>
        </div>
      </div>
    </div>
  )
}

function CompletedNotQualifiedState({
  verifiedStopCount,
  requiredVerifiedStopCount,
}: {
  verifiedStopCount: number
  requiredVerifiedStopCount: number
}) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300"
        />

        <div>
          <p className="text-sm font-semibold text-amber-100">
            Completed — not
            qualified
          </p>

          <p className="mt-1 text-xs leading-5 text-white/45">
            The route completed
            with{' '}
            {
              verifiedStopCount
            }{' '}
            verified{' '}
            {verifiedStopCount ===
            1
              ? 'stop'
              : 'stops'}
            {requiredVerifiedStopCount >
            0
              ? `; ${requiredVerifiedStopCount} were required.`
              : '.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function PassiveState({
  title,
  description,
  tone,
}: {
  title: string
  description: string
  tone:
    | 'neutral'
    | 'violet'
}) {
  const styles =
    tone ===
    'violet'
      ? {
          wrapper:
            'border-violet-300/15 bg-violet-300/[0.045]',

          dot:
            'bg-violet-300',

          title:
            'text-violet-100',
        }
      : {
          wrapper:
            'border-white/10 bg-white/[0.03]',

          dot:
            'bg-white/25',

          title:
            'text-white/65',
        }

  return (
    <div
      className={[
        'rounded-2xl border px-4 py-4',
        styles.wrapper,
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={[
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            styles.dot,
          ].join(' ')}
        />

        <div>
          <p
            className={[
              'text-sm font-semibold',
              styles.title,
            ].join(' ')}
          >
            {title}
          </p>

          <p className="mt-1 text-xs leading-5 text-white/40">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PROGRESS
// ============================================================

function ProgressSummary({
  verifiedStopCount,
  totalStopCount,
  requiredVerifiedStopCount,
}: {
  verifiedStopCount: number
  totalStopCount: number
  requiredVerifiedStopCount: number
}) {
  const progressPercent =
    totalStopCount >
    0
      ? Math.min(
          100,
          Math.round(
            (
              verifiedStopCount /
              totalStopCount
            ) *
              100
          )
        )
      : 0

  return (
    <div className="rounded-2xl border border-sky-300/15 bg-sky-300/[0.04] px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-sky-100">
            In progress
          </p>

          <p className="mt-1 text-[11px] text-white/40">
            Verified stops
          </p>
        </div>

        <span className="text-sm font-semibold text-white/70">
          {
            verifiedStopCount
          }
          /
          {
            totalStopCount
          }
        </span>
      </div>

      {totalStopCount >
      0 ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-sky-300 transition-[width] duration-300"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>
      ) : null}

      {requiredVerifiedStopCount >
      0 ? (
        <p className="mt-2 text-[10px] leading-4 text-white/30">
          {
            requiredVerifiedStopCount
          }{' '}
          verified{' '}
          {requiredVerifiedStopCount ===
          1
            ? 'stop'
            : 'stops'}{' '}
          required to
          qualify.
        </p>
      ) : null}
    </div>
  )
}

// ============================================================
// API HELPERS
// ============================================================

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

function readFlowSessionId(
  payload:
    | StartCompetitionResponse
    | null
): string | null {
  if (!payload) {
    return null
  }

  const candidates =
    [
      payload.flowSessionId,
      payload.flow_session_id,
    ]

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate ===
        'string' &&
      candidate
        .trim()
        .length >
        0
    ) {
      return candidate
    }
  }

  return null
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

function getStartFallbackMessage(
  status: number
): string {
  switch (status) {
    case 401:
      return 'Sign in before starting this contender.'

    case 403:
      return 'You are not allowed to start this contender.'

    case 404:
      return 'This competition contender is no longer available.'

    case 409:
      return 'This contender cannot be started in its current state.'

    case 429:
      return 'Too many attempts. Try again shortly.'

    default:
      return 'Could not start this contender route.'
  }
}

function getCompletionFallbackMessage(
  status: number
): string {
  switch (status) {
    case 401:
      return 'Sign in before completing this contender.'

    case 404:
      return 'The Active Flow could not be found.'

    case 409:
      return 'This contender route is not complete yet.'

    case 429:
      return 'Too many attempts. Try again shortly.'

    default:
      return 'Could not complete this contender route.'
  }
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

// ============================================================
// NAVIGATION
// ============================================================

function resolveContinueHref({
  explicitHref,
  flowSessionId,
}: {
  explicitHref:
    | string
    | null
  flowSessionId:
    | string
    | null
}): string | null {
  if (
    explicitHref &&
    explicitHref
      .trim()
      .length >
      0
  ) {
    return explicitHref
  }

  if (
    !flowSessionId ||
    flowSessionId
      .trim()
      .length ===
      0
  ) {
    return null
  }

  return buildDefaultFlowHref(
    flowSessionId
  )
}

function buildDefaultFlowHref(
  flowSessionId: string
): string {
  const params =
    new URLSearchParams({
      session_id:
        flowSessionId,
    })

  return `/active-flow?${params.toString()}`
}

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeNonNegativeInteger(
  value:
    | number
    | null
    | undefined
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