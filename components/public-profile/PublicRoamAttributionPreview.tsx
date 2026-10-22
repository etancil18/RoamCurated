'use client'

import { useEffect, useState } from 'react'

type AttributedStop = {
  venueId: string
  stopIndex: number
  attributionOrigin: 'collection' | 'manual' | 'platform' | 'unknown'
  originalCreatorUserId: string | null
  attributionCertified: boolean
}

type AttributionData = {
  snapshotId: string
  publisherUserId: string
  certifiedRoute: boolean
  stops: AttributedStop[]
}

type Props = {
  snapshotId: string
}

function isAttributionData(
  value: unknown,
  snapshotId: string
): value is AttributionData {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  const record = value as Record<string, unknown>

  if (
    record.snapshotId !== snapshotId ||
    typeof record.publisherUserId !== 'string' ||
    typeof record.certifiedRoute !== 'boolean' ||
    !Array.isArray(record.stops) ||
    record.stops.length < 2
  ) {
    return false
  }

  return record.stops.every((value, index) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return false
    }

    const stop = value as Record<string, unknown>

    return (
      typeof stop.venueId === 'string' &&
      stop.stopIndex === index &&
      typeof stop.attributionCertified === 'boolean' &&
      (
        stop.originalCreatorUserId === null ||
        typeof stop.originalCreatorUserId === 'string'
      ) &&
      (
        stop.attributionOrigin === 'collection' ||
        stop.attributionOrigin === 'manual' ||
        stop.attributionOrigin === 'platform' ||
        stop.attributionOrigin === 'unknown'
      )
    )
  })
}

function describeStop(stop: AttributedStop): string {
  if (
    !stop.attributionCertified ||
    stop.attributionOrigin === 'unknown'
  ) {
    return 'Original attribution unavailable'
  }

  if (stop.attributionOrigin === 'platform') {
    return 'Added by Roam'
  }

  if (!stop.originalCreatorUserId) {
    return 'Original attribution unavailable'
  }

  if (stop.attributionOrigin === 'collection') {
    return 'Original Collection creator'
  }

  return 'Original contributor'
}

export default function PublicRoamAttributionPreview({
  snapshotId,
}: Props) {
  const [data, setData] = useState<AttributionData | null>(null)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    setData(null)

    async function load() {
      try {
        const response = await fetch(
          `/api/flow-snapshots/${encodeURIComponent(snapshotId)}/attribution`,
          {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        )

        if (!response.ok) return

        const payload: unknown = await response.json()

        if (
          mounted &&
          isAttributionData(payload, snapshotId)
        ) {
          setData(payload)
        }
      } catch {
        // Attribution is additive, not a dependency
        // of the existing Replay action.
      }
    }

    void load()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [snapshotId])

  // While the API flag is OFF, preserve today's card UI.
  if (!data) {
    return null
  }

  return (
    <section
      aria-label="Original Flow contributors"
      className="border-t border-neutral-800 px-4 py-4 sm:px-5"
    >
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
          Original stop contributions
        </h3>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Original authorship remains with the contributor,
          even when someone else saves or replays this Flow.
        </p>
      </div>

      <ol className="space-y-2">
        {data.stops.map((stop) => (
          <li
            key={`${stop.stopIndex}-${stop.venueId}`}
            className="flex items-center gap-3 text-xs"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-300">
              {stop.stopIndex + 1}
            </span>

            <span
              className={
                stop.attributionCertified &&
                stop.attributionOrigin !== 'unknown'
                  ? 'text-neutral-300'
                  : 'text-neutral-500'
              }
            >
              {describeStop(stop)}
            </span>
          </li>
        ))}
      </ol>

      {!data.certifiedRoute ? (
        <p className="mt-3 text-xs text-neutral-500">
          Historical Snapshot — original attribution
          has not been certified.
        </p>
      ) : null}
    </section>
  )
}
