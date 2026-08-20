'use client'

import {
  useCallback,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

type StartCompetitionEntryButtonProps = {
  competitionId: string
  entryId: string

  /**
   * Optional button copy.
   */
  label?: string

  /**
   * Optional destination builder.
   *
   * Defaults to:
   *
   *   /flow/<flowSessionId>
   *
   * Override this only if your canonical Active Flow route differs.
   */
  getFlowHref?: (
    flowSessionId: string
  ) => string

  /**
   * UX-only disable state.
   *
   * Server authorization remains authoritative.
   */
  disabled?: boolean

  /**
   * Optional reason shown when disabled.
   */
  disabledReason?: string | null

  className?: string

  /**
   * Optional callback after the server has returned canonical
   * competition participation state.
   */
  onStarted?: (
    result: StartCompetitionEntryResult
  ) => void
}

export type StartCompetitionEntryResult = {
  created: boolean

  competition: {
    id: string
  }

  entry: {
    id: string
  }

  flowSession: {
    id: string
    user_id: string

    title: string | null
    city: string | null

    venue_ids: string[]

    status:
      | 'active'
      | 'completed'
      | 'cancelled'

    started_at: string
    completed_at: string | null
  }

  participation: {
    id: string

    competition_id: string
    competition_entry_id: string
    user_id: string

    flow_session_id: string

    verified_stop_count: number
    total_stop_count: number

    qualified: boolean

    started_at: string
    completed_at: string | null
  }
}

type StartCompetitionEntryApiResponse =
  | StartCompetitionEntryResult
  | {
      error?: unknown
      message?: unknown
    }

export default function StartCompetitionEntryButton({
  competitionId,
  entryId,
  label = 'Start contender',
  getFlowHref = getDefaultFlowHref,
  disabled = false,
  disabledReason = null,
  className = '',
  onStarted,
}: StartCompetitionEntryButtonProps) {
  const router =
    useRouter()

  const [
    pending,
    setPending,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  )

  const handleStart =
    useCallback(
      async () => {
        if (
          disabled ||
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
                },

                credentials:
                  'same-origin',

                cache:
                  'no-store',
              }
            )

          const payload =
            await readJsonSafely<StartCompetitionEntryApiResponse>(
              response
            )

          if (
            !response.ok
          ) {
            throw new Error(
              getApiErrorMessage(
                payload,
                getFallbackErrorMessage(
                  response.status
                )
              )
            )
          }

          if (
            !isStartCompetitionEntryResult(
              payload
            )
          ) {
            throw new Error(
              'Competition entry started, but the server returned invalid state.'
            )
          }

          /**
           * Defensive identity check.
           *
           * The API already verifies this, but the client should
           * refuse to navigate if a malformed response ever crosses
           * the boundary.
           */
          if (
            payload.competition.id !==
              competitionId ||
            payload.entry.id !==
              entryId
          ) {
            throw new Error(
              'Competition entry start returned inconsistent state.'
            )
          }

          onStarted?.(
            payload
          )

          const href =
            getFlowHref(
              payload.flowSession.id
            )

          router.push(
            href
          )
        } catch (error) {
          setErrorMessage(
            getUnknownErrorMessage(
              error,
              'Could not start this contender.'
            )
          )
        } finally {
          setPending(
            false
          )
        }
      },
      [
        disabled,
        pending,
        competitionId,
        entryId,
        onStarted,
        getFlowHref,
        router,
      ]
    )

  return (
    <div
      className={[
        'min-w-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        onClick={
          handleStart
        }
        disabled={
          disabled ||
          pending
        }
        aria-busy={
          pending
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-45"
      >
        {pending
          ? 'Starting…'
          : label}
      </button>

      {disabled &&
      disabledReason ? (
        <p className="mt-2 text-center text-[11px] leading-5 text-white/35">
          {
            disabledReason
          }
        </p>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/[0.055] px-4 py-3 text-xs leading-5 text-red-100"
        >
          {
            errorMessage
          }
        </div>
      ) : null}
    </div>
  )
}

function getDefaultFlowHref(
  flowSessionId: string
): string {
  return `/flow/${encodeURIComponent(
    flowSessionId
  )}`
}

function isStartCompetitionEntryResult(
  value: unknown
): value is StartCompetitionEntryResult {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false
  }

  const result =
    value as Record<
      string,
      unknown
    >

  if (
    typeof result.created !==
      'boolean' ||
    !isRecord(
      result.competition
    ) ||
    !isRecord(
      result.entry
    ) ||
    !isRecord(
      result.flowSession
    ) ||
    !isRecord(
      result.participation
    )
  ) {
    return false
  }

  const competition =
    result.competition

  const entry =
    result.entry

  const flowSession =
    result.flowSession

  const participation =
    result.participation

  return (
    isUuid(
      competition.id
    ) &&
    isUuid(
      entry.id
    ) &&
    isUuid(
      flowSession.id
    ) &&
    isUuid(
      flowSession.user_id
    ) &&
    (
      flowSession.title ===
        null ||
      typeof flowSession.title ===
        'string'
    ) &&
    (
      flowSession.city ===
        null ||
      typeof flowSession.city ===
        'string'
    ) &&
    Array.isArray(
      flowSession.venue_ids
    ) &&
    flowSession.venue_ids.every(
      (
        venueId
      ) =>
        typeof venueId ===
        'string'
    ) &&
    (
      flowSession.status ===
        'active' ||
      flowSession.status ===
        'completed' ||
      flowSession.status ===
        'cancelled'
    ) &&
    typeof flowSession.started_at ===
      'string' &&
    (
      flowSession.completed_at ===
        null ||
      typeof flowSession.completed_at ===
        'string'
    ) &&
    isUuid(
      participation.id
    ) &&
    isUuid(
      participation.competition_id
    ) &&
    isUuid(
      participation.competition_entry_id
    ) &&
    isUuid(
      participation.user_id
    ) &&
    isUuid(
      participation.flow_session_id
    ) &&
    isNonNegativeSafeInteger(
      participation.verified_stop_count
    ) &&
    isNonNegativeSafeInteger(
      participation.total_stop_count
    ) &&
    participation.total_stop_count >=
      3 &&
    participation.verified_stop_count <=
      participation.total_stop_count &&
    typeof participation.qualified ===
      'boolean' &&
    typeof participation.started_at ===
      'string' &&
    (
      participation.completed_at ===
        null ||
      typeof participation.completed_at ===
        'string'
    )
  )
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    Boolean(
      value
    ) &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value
    )
  )
}

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value ===
      'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

function isNonNegativeSafeInteger(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isSafeInteger(
      value
    ) &&
    value >=
      0
  )
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
  payload: unknown,
  fallback: string
): string {
  if (
    !payload ||
    typeof payload !==
      'object'
  ) {
    return fallback
  }

  const record =
    payload as Record<
      string,
      unknown
    >

  if (
    typeof record.error ===
      'string' &&
    record.error
      .trim()
      .length >
      0
  ) {
    return record.error
  }

  if (
    typeof record.message ===
      'string' &&
    record.message
      .trim()
      .length >
      0
  ) {
    return record.message
  }

  return fallback
}

function getFallbackErrorMessage(
  status: number
): string {
  switch (status) {
    case 400:
      return 'This competition entry could not be started.'

    case 401:
      return 'Sign in before starting this contender.'

    case 403:
      return 'You are not allowed to start this contender.'

    case 404:
      return 'This competition contender could not be found.'

    case 409:
      return 'This contender is not currently available to start.'

    case 429:
      return 'Too many attempts. Try again shortly.'

    default:
      return 'Could not start this contender.'
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