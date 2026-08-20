'use client'

import {
  useState,
  useTransition,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

import {
  publishRelay,
} from '@/lib/relay/actions'
import type {
  RelayId,
} from '@/lib/relay/types'

type PublishableRelayStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'cancelled'

type PublishRelayButtonProps = {
  relayId: RelayId
  status: PublishableRelayStatus
}

export default function PublishRelayButton({
  relayId,
  status,
}: PublishRelayButtonProps) {
  const router =
    useRouter()

  const [
    isPending,
    startTransition,
  ] =
    useTransition()

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null
    )

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(
      null
    )

  const isDraft =
    status ===
    'draft'

  function handlePublish() {
    if (
      !isDraft ||
      isPending
    ) {
      return
    }

    const confirmed =
      window.confirm(
        'Publish this Relay? If its start time has already been reached it will become live immediately. Otherwise it will become scheduled.'
      )

    if (!confirmed) {
      return
    }

    setError(
      null
    )

    setSuccess(
      null
    )

    startTransition(
      async () => {
        try {
          const result =
            await publishRelay(
              relayId
            )

          if (
            result.relayId !==
            relayId
          ) {
            throw new Error(
              'Relay publication returned an unexpected Relay ID.'
            )
          }

          setSuccess(
            'Relay published.'
          )

          router.refresh()
        } catch (
          publishError
        ) {
          console.error(
            '[PublishRelayButton] Relay publication failed:',
            publishError
          )

          setError(
            getPublishErrorMessage(
              publishError
            )
          )
        }
      }
    )
  }

  if (!isDraft) {
    return null
  }

  return (
    <div>
      <button
        type="button"
        onClick={
          handlePublish
        }
        disabled={
          isPending
        }
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-4 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.13] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
      >
        {isPending
          ? 'Publishing…'
          : 'Publish Relay'}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 max-w-md text-xs leading-5 text-red-300"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          role="status"
          className="mt-2 max-w-md text-xs leading-5 text-emerald-300"
        >
          {success}
        </p>
      ) : null}
    </div>
  )
}

function getPublishErrorMessage(
  error: unknown
): string {
  if (
    error instanceof
      Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return 'Relay publication failed. Please try again.'
}