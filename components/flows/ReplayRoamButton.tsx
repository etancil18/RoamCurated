'use client'

import {
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

type ReplayRoamButtonProps = {
  snapshotId: string

  className?: string

  label?: string
}

type ReplayResponse = {
  session?: {
    id?: string
  } | null

  activeSession?: {
    id?: string
  } | null

  redirectTo?: string | null

  authRequired?: boolean

  code?: string | null

  error?: string | null
}

export default function ReplayRoamButton({
  snapshotId,
  className = '',
  label = 'Replay this Roam',
}: ReplayRoamButtonProps) {
  const router =
    useRouter()

  const [
    starting,
    setStarting,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null)

  const handleReplay =
    async () => {
      if (
        starting ||
        !snapshotId
          .trim()
      ) {
        return
      }

      setStarting(
        true
      )

      setError(
        null
      )

      try {
        const response =
          await fetch(
            `/api/flow-snapshots/${encodeURIComponent(
              snapshotId
            )}/replay`,
            {
              method:
                'POST',

              credentials:
                'same-origin',

              cache:
                'no-store',

              headers: {
                Accept:
                  'application/json',
              },
            }
          )

        const payload =
          (
            await response
              .json()
              .catch(
                () => null
              )
          ) as
            | ReplayResponse
            | null

        /*
         * Unauthenticated visitors are sent through the existing
         * auth flow.
         *
         * The replay endpoint remains the canonical authority for
         * deciding whether authentication is required.
         */
        if (
          response.status ===
            401 &&
          payload?.authRequired ===
            true
        ) {
          const redirectTo =
            normalizeInternalPath(
              payload.redirectTo
            ) ??
            '/login'

          router.push(
            redirectTo
          )

          return
        }

        /*
         * If the user already has an active Flow, the replay
         * endpoint returns its canonical route.
         *
         * Do not create or infer another session client-side.
         */
        if (
          response.status ===
            409 &&
          payload?.redirectTo
        ) {
          const redirectTo =
            normalizeInternalPath(
              payload.redirectTo
            )

          if (
            redirectTo
          ) {
            router.push(
              redirectTo
            )

            return
          }
        }

        if (
          !response.ok
        ) {
          throw new Error(
            normalizeErrorMessage(
              payload?.error
            ) ??
              'Could not start this Roam.'
          )
        }

        const redirectTo =
          normalizeInternalPath(
            payload?.redirectTo
          )

        if (
          !redirectTo
        ) {
          throw new Error(
            'The Roam started, but its active Flow destination was not returned.'
          )
        }

        router.push(
          redirectTo
        )
      } catch (err) {
        console.error(
          '[ReplayRoamButton] Failed to replay snapshot:',
          {
            snapshotId,
            error:
              err,
          }
        )

        setError(
          err instanceof
            Error
            ? err.message
            : 'Could not start this Roam.'
        )
      } finally {
        setStarting(
          false
        )
      }
    }

  return (
    <div
      className={[
        'w-full',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
    >
      <button
        type="button"
        onClick={
          handleReplay
        }
        disabled={
          starting
        }
        aria-busy={
          starting
        }
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting
          ? 'Starting Roam…'
          : label}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-xs leading-5 text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

function normalizeInternalPath(
  value:
    | string
    | null
    | undefined
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    !normalized.startsWith(
      '/'
    ) ||
    normalized.startsWith(
      '//'
    )
  ) {
    return null
  }

  return normalized
}

function normalizeErrorMessage(
  value:
    | string
    | null
    | undefined
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}