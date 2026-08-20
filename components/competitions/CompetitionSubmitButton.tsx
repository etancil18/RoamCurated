'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SubmissionIntent =
  | {
      source: 'active_flow'
      flowSessionId: string
      visitDate: null
    }
  | {
      source: 'visit_history'
      flowSessionId: null
      visitDate: string
    }

type CompetitionSubmitButtonProps = {
  competitionId: string
  submissionIntent: SubmissionIntent
}

type CompetitionSubmissionApiResponse = {
  submission?: {
    id?: string
    status?: string
    competition_entry_id?: string | null
  }
  message?: string
  error?: string
}

export default function CompetitionSubmitButton({
  competitionId,
  submissionIntent,
}: CompetitionSubmitButtonProps) {
  const router = useRouter()

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (
      submitting ||
      submitted
    ) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const requestBody =
        submissionIntent.source === 'active_flow'
          ? {
              competition_id:
                competitionId,

              submission_source:
                'active_flow' as const,

              flow_session_id:
                submissionIntent.flowSessionId,
            }
          : {
              competition_id:
                competitionId,

              submission_source:
                'visit_history' as const,

              visit_date:
                submissionIntent.visitDate,
            }

      const response =
        await fetch(
          '/api/competitions/submissions',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                requestBody
              ),

            cache:
              'no-store',
          }
        )

      const payload =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | CompetitionSubmissionApiResponse
          | null

      if (!response.ok) {
        const message =
          payload?.error ??
          `Submission failed with status ${response.status}.`

        /**
         * If the canonical submission already exists, the user has
         * effectively completed this action already.
         *
         * Treat that state as submitted rather than leaving them
         * with a repeatable error state.
         */
        if (
          response.status === 409 &&
          message
            .toLowerCase()
            .includes(
              'already been submitted'
            )
        ) {
          setSubmitted(true)

          router.refresh()

          return
        }

        throw new Error(
          message
        )
      }

      /**
       * The current submission endpoint returns:
       *
       * {
       *   submission,
       *   message
       * }
       *
       * A successful 2xx response is sufficient to transition the
       * local CTA into its completed state.
       */
      setSubmitted(true)

      /**
       * Refresh Server Component data without changing the current
       * submission context or navigating away from the page.
       */
      router.refresh()
    } catch (submitError) {
      console.error(
        '[CompetitionSubmitButton] Submission failed:',
        {
          competitionId,
          submissionIntent,
          error:
            submitError,
        }
      )

      setError(
        submitError instanceof Error &&
        submitError.message.trim()
          ? submitError.message
          : 'Could not submit this route.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 text-xs font-semibold text-emerald-200">
        Submitted for review
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() =>
          void handleSubmit()
        }
        disabled={submitting}
        aria-busy={submitting}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-xs font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? 'Submitting…'
          : 'Submit to this duel'}
      </button>

      {error ? (
        <p
          role="alert"
          className="max-w-xs text-right text-xs leading-5 text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}