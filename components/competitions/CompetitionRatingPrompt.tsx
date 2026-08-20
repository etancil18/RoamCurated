'use client'

import {
  useCallback,
  useMemo,
  useState,
} from 'react'

export type CompetitionRatingPromptProps = {
  competitionId: string
  entryId: string

  /**
   * Existing persisted rating, if the user already rated this entry.
   */
  initialRating?: number | null

  /**
   * Controls whether the rating UI should be interactive.
   *
   * This is UX-only. The API remains the authoritative
   * qualification boundary.
   */
  canRate?: boolean

  /**
   * Optional parent-provided reason when rating is unavailable.
   */
  unavailableReason?: string | null

  /**
   * Optional copy override.
   */
  title?: string
  description?: string

  className?: string

  /**
   * Optional callback after the server confirms the rating.
   */
  onRated?: (
    rating: number
  ) => void
}

type RatingApiResponse = {
  rating?: {
    id?: unknown
    competitionId?: unknown
    competitionEntryId?: unknown
    rating?: unknown
    updatedAt?: unknown
  } | null

  qualifiedParticipation?: unknown

  error?: unknown
  message?: unknown
}

const MIN_RATING = 1
const MAX_RATING = 5

export default function CompetitionRatingPrompt({
  competitionId,
  entryId,
  initialRating = null,
  canRate = true,
  unavailableReason = null,
  title = 'Rate this contender',
  description = 'How well did this route hold up in the real world?',
  className = '',
  onRated,
}: CompetitionRatingPromptProps) {
  const normalizedInitialRating =
    normalizeRating(
      initialRating
    )

  const [
    selectedRating,
    setSelectedRating,
  ] = useState<number | null>(
    normalizedInitialRating
  )

  const [
    savedRating,
    setSavedRating,
  ] = useState<number | null>(
    normalizedInitialRating
  )

  const [
    hoveredRating,
    setHoveredRating,
  ] = useState<number | null>(
    null
  )

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  )

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null
  )

  const displayRating =
    hoveredRating ??
    selectedRating ??
    0

  const hasUnsavedChange =
    selectedRating !==
      null &&
    selectedRating !==
      savedRating

  const submitLabel =
    useMemo(
      () => {
        if (submitting) {
          return 'Saving…'
        }

        if (
          savedRating !==
            null
        ) {
          return hasUnsavedChange
            ? 'Update rating'
            : 'Rating saved'
        }

        return 'Submit rating'
      },
      [
        submitting,
        savedRating,
        hasUnsavedChange,
      ]
    )

  const handleSelect =
    useCallback(
      (
        rating: number
      ) => {
        if (
          !canRate ||
          submitting
        ) {
          return
        }

        setSelectedRating(
          rating
        )

        setErrorMessage(
          null
        )

        setSuccessMessage(
          null
        )
      },
      [
        canRate,
        submitting,
      ]
    )

  const handleSubmit =
    useCallback(
      async () => {
        if (
          !canRate ||
          submitting ||
          selectedRating ===
            null ||
          selectedRating ===
            savedRating
        ) {
          return
        }

        setSubmitting(
          true
        )

        setErrorMessage(
          null
        )

        setSuccessMessage(
          null
        )

        try {
          const response =
            await fetch(
              `/api/competitions/${encodeURIComponent(
                competitionId
              )}/rate`,
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
                    entry_id:
                      entryId,

                    rating:
                      selectedRating,
                  }),
              }
            )

          const payload =
            await readJsonSafely<RatingApiResponse>(
              response
            )

          if (!response.ok) {
            throw new Error(
              getApiErrorMessage(
                payload,
                getFallbackErrorMessage(
                  response.status
                )
              )
            )
          }

          const persistedRating =
            readPersistedRating(
              payload
            )

          if (
            persistedRating ===
              null
          ) {
            throw new Error(
              'The rating was accepted, but the server did not return a valid saved rating.'
            )
          }

          setSelectedRating(
            persistedRating
          )

          setSavedRating(
            persistedRating
          )

          setSuccessMessage(
            normalizedInitialRating ===
              null
              ? 'Rating saved.'
              : 'Rating updated.'
          )

          onRated?.(
            persistedRating
          )
        } catch (error) {
          setErrorMessage(
            getUnknownErrorMessage(
              error,
              'Could not save your rating.'
            )
          )
        } finally {
          setSubmitting(
            false
          )
        }
      },
      [
        canRate,
        submitting,
        selectedRating,
        savedRating,
        competitionId,
        entryId,
        normalizedInitialRating,
        onRated,
      ]
    )

  if (!canRate) {
    return (
      <section
        className={[
          'rounded-[22px] border border-white/10 bg-white/[0.025] p-5 text-white',
          className,
        ].join(' ')}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Rating
        </p>

        <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white/65">
          Rating unavailable
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/40">
          {unavailableReason?.trim()
            ? unavailableReason
            : 'Complete and qualify for this contender before rating it.'}
        </p>
      </section>
    )
  }

  return (
    <section
      className={[
        'rounded-[24px] border border-white/10 bg-white/[0.025] p-5 text-white sm:p-6',
        className,
      ].join(' ')}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Post-completion rating
        </p>

        <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
          {title}
        </h3>

        <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
          {description}
        </p>
      </div>

      <fieldset
        className="mt-6"
        disabled={
          submitting
        }
      >
        <legend className="sr-only">
          Choose a rating from 1
          to 5
        </legend>

        <div
          className="flex flex-wrap gap-2"
          onMouseLeave={() =>
            setHoveredRating(
              null
            )
          }
        >
          {RATING_VALUES.map(
            (
              rating
            ) => {
              const active =
                rating <=
                displayRating

              const selected =
                rating ===
                selectedRating

              return (
                <button
                  key={
                    rating
                  }
                  type="button"
                  disabled={
                    submitting
                  }
                  aria-label={`${rating} out of ${MAX_RATING}`}
                  aria-pressed={
                    selected
                  }
                  onMouseEnter={() =>
                    setHoveredRating(
                      rating
                    )
                  }
                  onFocus={() =>
                    setHoveredRating(
                      rating
                    )
                  }
                  onBlur={() =>
                    setHoveredRating(
                      null
                    )
                  }
                  onClick={() =>
                    handleSelect(
                      rating
                    )
                  }
                  className={[
                    'group flex h-12 w-12 items-center justify-center rounded-2xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 disabled:cursor-not-allowed disabled:opacity-60',
                    selected
                      ? 'border-amber-300/50 bg-amber-300/[0.12]'
                      : active
                        ? 'border-amber-300/25 bg-amber-300/[0.06]'
                        : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]',
                  ].join(
                    ' '
                  )}
                >
                  <StarIcon
                    active={
                      active
                    }
                  />
                </button>
              )
            }
          )}
        </div>
      </fieldset>

      <div className="mt-4 min-h-5">
        {selectedRating ? (
          <p className="text-xs font-medium text-white/45">
            {
              getRatingLabel(
                selectedRating
              )
            }
            {' · '}
            {
              selectedRating
            }
            /
            {
              MAX_RATING
            }
          </p>
        ) : (
          <p className="text-xs text-white/30">
            Select a rating.
          </p>
        )}
      </div>

      {savedRating !==
      null ? (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                Your saved rating
              </p>

              <p className="mt-1 text-sm font-semibold text-white/70">
                {
                  savedRating
                }
                /
                {
                  MAX_RATING
                }
              </p>
            </div>

            <div
              aria-hidden="true"
              className="flex gap-1"
            >
              {RATING_VALUES.map(
                (
                  rating
                ) => (
                  <StarIcon
                    key={
                      rating
                    }
                    active={
                      rating <=
                      savedRating
                    }
                    small
                  />
                )
              )}
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.055] px-4 py-3 text-xs leading-5 text-red-100"
        >
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] px-4 py-3 text-xs leading-5 text-emerald-100"
        >
          {successMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={
          handleSubmit
        }
        disabled={
          submitting ||
          selectedRating ===
            null ||
          selectedRating ===
            savedRating
        }
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitLabel}
      </button>

      <p className="mt-3 text-center text-[10px] leading-4 text-white/25">
        Only qualified
        participation can submit a
        rating. Eligibility is
        verified again by the
        server.
      </p>
    </section>
  )
}

const RATING_VALUES = [
  1,
  2,
  3,
  4,
  5,
] as const

function StarIcon({
  active,
  small = false,
}: {
  active: boolean
  small?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={[
        small
          ? 'h-4 w-4'
          : 'h-6 w-6',
        active
          ? 'fill-amber-300 text-amber-300'
          : 'fill-transparent text-white/25',
      ].join(' ')}
    >
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94l-5.56 2.93 1.06-6.2L3 9.28l6.22-.9L12 2.75Z"
      />
    </svg>
  )
}

function normalizeRating(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isInteger(
      value
    ) ||
    value <
      MIN_RATING ||
    value >
      MAX_RATING
  ) {
    return null
  }

  return value
}

function readPersistedRating(
  payload:
    | RatingApiResponse
    | null
): number | null {
  if (
    !payload ||
    !payload.rating
  ) {
    return null
  }

  return normalizeRating(
    payload.rating.rating
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

function getFallbackErrorMessage(
  status: number
): string {
  switch (status) {
    case 400:
      return 'Choose a valid rating from 1 to 5.'

    case 401:
      return 'Sign in before rating this contender.'

    case 403:
      return 'Only qualified participants can rate this contender.'

    case 404:
      return 'This competition contender could not be found.'

    case 409:
      return 'This contender is not currently eligible for rating.'

    case 429:
      return 'Too many rating attempts. Try again shortly.'

    default:
      return 'Could not save your rating.'
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

function getRatingLabel(
  rating: number
): string {
  switch (rating) {
    case 1:
      return 'Missed the mark'

    case 2:
      return 'Some good moments'

    case 3:
      return 'Solid route'

    case 4:
      return 'Strong taste'

    case 5:
      return 'Exceptional'

    default:
      return 'Selected'
  }
}