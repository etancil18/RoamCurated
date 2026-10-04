'use client'

import {
  useState,
} from 'react'

type Props = {
  venueId: string
  venueName: string
  onCancel: () => void
  onReported: () => void
}

type SignalIntent =
  | 'line'
  | 'pop_up'
  | 'temporary_closure'
  | 'dj_set'
  | 'live_music'

type SignalOption = {
  intent: SignalIntent
  label: string
  description: string
}

type ApiResponse = {
  error?: string
}

const SIGNAL_OPTIONS: SignalOption[] = [
  {
    intent: 'line',
    label: 'Line',
    description:
      'There’s a line here right now.',
  },
  {
    intent: 'pop_up',
    label: 'Pop-up',
    description:
      'A pop-up is happening here.',
  },
  {
    intent: 'temporary_closure',
    label: 'Temporary closure',
    description:
      'This place is temporarily closed.',
  },
  {
    intent: 'dj_set',
    label: 'DJ set',
    description:
      'A DJ is playing here right now.',
  },
  {
    intent: 'live_music',
    label: 'Live music',
    description:
      'Live music is happening here.',
  },
]

function getRequestForIntent({
  intent,
  venueId,
}: {
  intent: SignalIntent
  venueId: string
}): {
  url: string
  body: Record<string, unknown>
} {
  if (intent === 'line') {
    return {
      url:
        '/api/community-signals/place',
      body: {
        venue_id:
          venueId,
        signal_type:
          'line',
        signal_state:
          'present',
      },
    }
  }

  if (
    intent ===
    'temporary_closure'
  ) {
    return {
      url:
        '/api/community-signals/place',
      body: {
        venue_id:
          venueId,
        signal_type:
          'temporary_closure',
        signal_state:
          'present',
      },
    }
  }

  if (intent === 'pop_up') {
    return {
      url:
        '/api/event-reports',
      body: {
        venue_id:
          venueId,
        reported_title:
          'Pop-up',
      },
    }
  }

  if (intent === 'dj_set') {
    return {
      url:
        '/api/event-reports',
      body: {
        venue_id:
          venueId,
        reported_title:
          'DJ set',
        reported_archetype:
          'nightlife',
      },
    }
  }

  return {
    url:
      '/api/event-reports',
    body: {
      venue_id:
        venueId,
      reported_title:
        'Live music',
      reported_archetype:
        'music',
    },
  }
}

export default function VenueSignalReporter({
  venueId,
  venueName,
  onCancel,
  onReported,
}: Props) {
  const [
    submittingIntent,
    setSubmittingIntent,
  ] = useState<SignalIntent | null>(
    null
  )

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  )

  const isSubmitting =
    submittingIntent !== null

  async function handleReport(
    intent: SignalIntent
  ) {
    if (isSubmitting) {
      return
    }

    setSubmittingIntent(intent)
    setError(null)

    const request =
      getRequestForIntent({
        intent,
        venueId,
      })

    try {
      const response =
        await fetch(
          request.url,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            body: JSON.stringify(
              request.body
            ),
          }
        )

      let body:
        | ApiResponse
        | null = null

      try {
        body =
          (await response.json()) as
            ApiResponse
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
            'We couldn’t submit your signal. Please try again.'
        )

        return
      }

      /**
       * Success means Roam accepted the user's observation.
       *
       * It does NOT mean:
       *
       * - a place-state observation is automatically true
       * - a canonical event was created
       * - an event occurrence was canonicalized
       * - the user visited the venue
       * - the user participated in an event
       *
       * Existing server-owned evidence, trust, deduplication,
       * moderation, freshness, and resolution semantics remain
       * authoritative.
       */
      onReported()
    } catch (submitError) {
      console.error(
        '[VenueSignalReporter] Failed to submit community signal:',
        submitError
      )

      setError(
        'We couldn’t submit your signal. Check your connection and try again.'
      )
    } finally {
      setSubmittingIntent(null)
    }
  }

  function handleCancel() {
    if (isSubmitting) {
      return
    }

    setError(null)
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
          Tap what you&apos;re
          seeing right now. Roam
          will check it against
          other community signals.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2"
        aria-label="Community signal options"
      >
        {SIGNAL_OPTIONS.map(
          option => {
            const isThisSubmitting =
              submittingIntent ===
              option.intent

            return (
              <button
                key={option.intent}
                type="button"
                disabled={
                  isSubmitting
                }
                onClick={() => {
                  void handleReport(
                    option.intent
                  )
                }}
                aria-label={
                  option.description
                }
                className={`
                  min-h-[4.5rem]
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-3
                  py-3
                  text-left
                  transition
                  hover:border-white/20
                  hover:bg-white/[0.08]
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white/30
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  ${
                    option.intent ===
                    'temporary_closure'
                      ? 'col-span-2'
                      : ''
                  }
                `}
              >
                <span className="block text-sm font-semibold text-white">
                  {isThisSubmitting
                    ? 'Reporting…'
                    : option.label}
                </span>

                <span className="mt-1 block text-[11px] leading-4 text-white/45">
                  {
                    option.description
                  }
                </span>
              </button>
            )
          }
        )}
      </div>

      {error ? (
        <p
          id="venue-signal-report-error"
          role="alert"
          className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-100"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={
          handleCancel
        }
        disabled={
          isSubmitting
        }
        className="
          mt-3
          min-h-11
          w-full
          rounded-xl
          border
          border-white/10
          bg-transparent
          px-4
          py-2.5
          text-sm
          font-medium
          text-white/60
          transition
          hover:bg-white/[0.05]
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
    </section>
  )
}