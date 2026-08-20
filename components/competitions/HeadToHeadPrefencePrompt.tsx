'use client'

import {
  useCallback,
  useMemo,
  useState,
} from 'react'

type ContenderOption = {
  entryId: string
  contenderLabel: string
  subtitle?: string | null
}

export type HeadToHeadPreferencePromptProps = {
  competitionId: string

  entryA: ContenderOption
  entryB: ContenderOption

  /**
   * Existing persisted preference, if one already exists.
   */
  initialPreferredEntryId?: string | null

  /**
   * UX-only gate.
   *
   * The preference API remains the authoritative eligibility check.
   */
  canSubmit?: boolean

  unavailableReason?: string | null

  className?: string

  onSubmitted?: (
    preferredEntryId: string
  ) => void
}

type PreferenceApiResponse = {
  preference?: {
    id?: unknown
    competitionId?: unknown
    entryAId?: unknown
    entryBId?: unknown
    preferredEntryId?: unknown
    updatedAt?: unknown
  } | null

  qualifiedEntryCount?: unknown

  error?: unknown
  message?: unknown
}

export default function HeadToHeadPreferencePrompt({
  competitionId,
  entryA,
  entryB,
  initialPreferredEntryId = null,
  canSubmit = true,
  unavailableReason = null,
  className = '',
  onSubmitted,
}: HeadToHeadPreferencePromptProps) {
  const normalizedInitialPreference =
    normalizeInitialPreference(
      initialPreferredEntryId,
      entryA.entryId,
      entryB.entryId
    )

  const [
    selectedEntryId,
    setSelectedEntryId,
  ] = useState<string | null>(
    normalizedInitialPreference
  )

  const [
    savedEntryId,
    setSavedEntryId,
  ] = useState<string | null>(
    normalizedInitialPreference
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

  const hasUnsavedChange =
    selectedEntryId !==
      null &&
    selectedEntryId !==
      savedEntryId

  const submitLabel =
    useMemo(() => {
      if (submitting) {
        return 'Saving…'
      }

      if (savedEntryId) {
        return hasUnsavedChange
          ? 'Update preference'
          : 'Preference saved'
      }

      return 'Submit preference'
    }, [
      submitting,
      savedEntryId,
      hasUnsavedChange,
    ])

  const handleSelect =
    useCallback(
      (
        entryId: string
      ) => {
        if (
          !canSubmit ||
          submitting
        ) {
          return
        }

        setSelectedEntryId(
          entryId
        )

        setErrorMessage(
          null
        )

        setSuccessMessage(
          null
        )
      },
      [
        canSubmit,
        submitting,
      ]
    )

  const handleSubmit =
    useCallback(
      async () => {
        if (
          !canSubmit ||
          submitting ||
          !selectedEntryId ||
          selectedEntryId ===
            savedEntryId
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
              )}/preference`,
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
                    entry_a_id:
                      entryA.entryId,

                    entry_b_id:
                      entryB.entryId,

                    preferred_entry_id:
                      selectedEntryId,
                  }),
              }
            )

          const payload =
            await readJsonSafely<PreferenceApiResponse>(
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

          const persistedPreference =
            readPersistedPreferredEntryId(
              payload,
              entryA.entryId,
              entryB.entryId
            )

          if (
            !persistedPreference
          ) {
            throw new Error(
              'The preference was accepted, but the server did not return a valid saved preference.'
            )
          }

          setSelectedEntryId(
            persistedPreference
          )

          setSavedEntryId(
            persistedPreference
          )

          setSuccessMessage(
            normalizedInitialPreference
              ? 'Preference updated.'
              : 'Preference saved.'
          )

          onSubmitted?.(
            persistedPreference
          )
        } catch (error) {
          setErrorMessage(
            getUnknownErrorMessage(
              error,
              'Could not save your preference.'
            )
          )
        } finally {
          setSubmitting(
            false
          )
        }
      },
      [
        canSubmit,
        submitting,
        selectedEntryId,
        savedEntryId,
        competitionId,
        entryA.entryId,
        entryB.entryId,
        normalizedInitialPreference,
        onSubmitted,
      ]
    )

  if (!canSubmit) {
    return (
      <section
        className={[
          'rounded-[24px] border border-white/10 bg-white/[0.025] p-5 text-white sm:p-6',
          className,
        ].join(' ')}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Head-to-head
        </p>

        <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white/65">
          Preference unavailable
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/40">
          {unavailableReason?.trim()
            ? unavailableReason
            : 'Complete and qualify for both contenders before choosing between them.'}
        </p>
      </section>
    )
  }

  return (
    <section
      className={[
        'rounded-[26px] border border-white/10 bg-white/[0.025] p-5 text-white sm:p-6',
        className,
      ].join(' ')}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Head-to-head
        </p>

        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
          You tried both. Which
          one actually won?
        </h3>

        <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
          Pick the route you would
          choose again based on the
          experience itself.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Choose the stronger contender"
        className="mt-6 grid gap-3 sm:grid-cols-2"
      >
        <PreferenceOption
          entry={
            entryA
          }
          selected={
            selectedEntryId ===
            entryA.entryId
          }
          disabled={
            submitting
          }
          onSelect={() =>
            handleSelect(
              entryA.entryId
            )
          }
        />

        <PreferenceOption
          entry={
            entryB
          }
          selected={
            selectedEntryId ===
            entryB.entryId
          }
          disabled={
            submitting
          }
          onSelect={() =>
            handleSelect(
              entryB.entryId
            )
          }
        />
      </div>

      {savedEntryId ? (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Your saved preference
          </p>

          <p className="mt-1 text-sm font-semibold text-white/70">
            {
              getContenderLabelForEntry(
                savedEntryId,
                entryA,
                entryB
              )
            }
          </p>
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
          !selectedEntryId ||
          selectedEntryId ===
            savedEntryId
        }
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitLabel}
      </button>

      <p className="mt-3 text-center text-[10px] leading-4 text-white/25">
        Only qualified completion
        on both contenders can
        submit this preference.
        Eligibility is verified
        again by the server.
      </p>
    </section>
  )
}

function PreferenceOption({
  entry,
  selected,
  disabled,
  onSelect,
}: {
  entry: ContenderOption
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={
        selected
      }
      disabled={
        disabled
      }
      onClick={
        onSelect
      }
      className={[
        'group relative min-h-[132px] rounded-[22px] border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-amber-300/45 bg-amber-300/[0.09]'
          : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Contender
          </p>

          <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
            {
              entry.contenderLabel
            }
          </p>

          {entry.subtitle ? (
            <p className="mt-2 text-xs leading-5 text-white/40">
              {
                entry.subtitle
              }
            </p>
          ) : null}
        </div>

        <span
          aria-hidden="true"
          className={[
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
            selected
              ? 'border-amber-300 bg-amber-300'
              : 'border-white/20 bg-transparent',
          ].join(' ')}
        >
          {selected ? (
            <span className="h-2 w-2 rounded-full bg-black" />
          ) : null}
        </span>
      </div>
    </button>
  )
}

function normalizeInitialPreference(
  value: unknown,
  entryAId: string,
  entryBId: string
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  return value ===
      entryAId ||
    value ===
      entryBId
    ? value
    : null
}

function readPersistedPreferredEntryId(
  payload:
    | PreferenceApiResponse
    | null,
  entryAId: string,
  entryBId: string
): string | null {
  if (
    !payload ||
    !payload.preference
  ) {
    return null
  }

  const value =
    payload.preference
      .preferredEntryId

  return normalizeInitialPreference(
    value,
    entryAId,
    entryBId
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
      return 'Choose a valid contender preference.'

    case 401:
      return 'Sign in before submitting a preference.'

    case 403:
      return 'You must qualify on both contenders before submitting a preference.'

    case 404:
      return 'One or more competition contenders could not be found.'

    case 409:
      return 'Head-to-head preference is not currently open for this competition.'

    case 429:
      return 'Too many attempts. Try again shortly.'

    default:
      return 'Could not save your preference.'
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

function getContenderLabelForEntry(
  entryId: string,
  entryA: ContenderOption,
  entryB: ContenderOption
): string {
  if (
    entryId ===
    entryA.entryId
  ) {
    return entryA.contenderLabel
  }

  if (
    entryId ===
    entryB.entryId
  ) {
    return entryB.contenderLabel
  }

  return 'Saved contender'
}