'use client'

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

type Props = {
  venueId: string
  venueName: string
  onCancel: () => void
  onReported: () => void
}

type EventReportResponse = {
  report?: {
    id?: string
  }
  error?: string
}

const MAX_TITLE_LENGTH = 160

export default function VenueSignalReporter({
  venueId,
  venueName,
  onCancel,
  onReported,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const [
    reportTitle,
    setReportTitle,
  ] = useState('')

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  )

  const trimmedTitle =
    reportTitle.trim()

  const canSubmit =
    !isSubmitting &&
    trimmedTitle.length > 0 &&
    trimmedTitle.length <=
      MAX_TITLE_LENGTH

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response =
        await fetch(
          '/api/event-reports',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            body: JSON.stringify({
              venue_id:
                venueId,

              reported_title:
                trimmedTitle,
            }),
          }
        )

      let body:
        | EventReportResponse
        | null = null

      try {
        body =
          (await response.json()) as
            EventReportResponse
      } catch {
        body = null
      }

      if (!response.ok) {
        if (
          response.status ===
          401
        ) {
          setError(
            'Please sign in to report what’s happening.'
          )

          return
        }

        setError(
          body?.error ??
            'We couldn’t submit your report. Please try again.'
        )

        return
      }

      /**
       * A successful POST means the user's observation was
       * accepted by Roam.
       *
       * It does NOT mean a canonical event was created.
       * Occurrence establishment, deduplication, resolution,
       * moderation, and trust remain server-owned.
       */
      setReportTitle('')

      onReported()
    } catch (submitError) {
      console.error(
        '[VenueSignalReporter] Failed to submit event report:',
        submitError
      )

      setError(
        'We couldn’t submit your report. Check your connection and try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancel() {
    if (isSubmitting) {
      return
    }

    setError(null)
    setReportTitle('')
    onCancel()
  }

  return (
    <section
      aria-labelledby="venue-signal-reporter-title"
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
    >
      <div className="mb-4">
        <p
          id="venue-signal-reporter-title"
          className="text-sm font-semibold text-white"
        >
          What&apos;s happening
          at {venueName}?
        </p>

        <p className="mt-1 text-xs leading-5 text-white/60">
          Share what you&apos;re
          seeing right now. Roam
          will check it against
          other signals.
        </p>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-3"
      >
        <div>
          <label
            htmlFor="venue-signal-report-title"
            className="sr-only"
          >
            What&apos;s
            happening at{' '}
            {venueName}?
          </label>

          <input
            ref={inputRef}
            id="venue-signal-report-title"
            type="text"
            value={
              reportTitle
            }
            onChange={(
              event
            ) => {
              setReportTitle(
                event.target
                  .value
              )

              if (error) {
                setError(
                  null
                )
              }
            }}
            maxLength={
              MAX_TITLE_LENGTH
            }
            autoComplete="off"
            enterKeyHint="send"
            disabled={
              isSubmitting
            }
            placeholder="e.g. Jazz trio playing"
            aria-invalid={
              error
                ? true
                : undefined
            }
            aria-describedby={
              error
                ? 'venue-signal-report-error'
                : 'venue-signal-report-help'
            }
            className="
              w-full
              rounded-xl
              border
              border-white/15
              bg-black/20
              px-3.5
              py-3
              text-sm
              text-white
              outline-none
              transition
              placeholder:text-white/35
              focus:border-white/35
              focus:ring-2
              focus:ring-white/10
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          />

          <div className="mt-1.5 flex items-start justify-between gap-3">
            <p
              id="venue-signal-report-help"
              className="text-[11px] leading-4 text-white/45"
            >
              Keep it short and
              specific.
            </p>

            <span
              aria-hidden="true"
              className="shrink-0 text-[11px] tabular-nums text-white/35"
            >
              {
                reportTitle
                  .length
              }
              /
              {
                MAX_TITLE_LENGTH
              }
            </span>
          </div>
        </div>

        {error ? (
          <p
            id="venue-signal-report-error"
            role="alert"
            className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100"
          >
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={
              handleCancel
            }
            disabled={
              isSubmitting
            }
            className="
              min-h-11
              flex-1
              rounded-xl
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-2.5
              text-sm
              font-medium
              text-white/75
              transition
              hover:bg-white/[0.08]
              hover:text-white
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-white/30
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              !canSubmit
            }
            className="
              min-h-11
              flex-[1.4]
              rounded-xl
              bg-white
              px-4
              py-2.5
              text-sm
              font-semibold
              text-black
              transition
              hover:bg-white/90
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-white/40
              focus-visible:ring-offset-2
              focus-visible:ring-offset-black
              disabled:cursor-not-allowed
              disabled:opacity-45
            "
          >
            {isSubmitting
              ? 'Reporting…'
              : 'Report it'}
          </button>
        </div>
      </form>
    </section>
  )
}