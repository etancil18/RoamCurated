'use client'

import { useEffect, useState } from 'react'

type AttributionOrigin =
  | 'collection'
  | 'manual'
  | 'platform'
  | 'unknown'

type AttributionStop = {
  venueId: string
  stopIndex: number
  attributionOrigin: AttributionOrigin
  originalCreatorUserId: string | null
  attributionCertified: boolean
}

type AttributionResponse = {
  snapshotId: string
  publisherUserId: string
  certifiedRoute: boolean
  stops: AttributionStop[]
}

type Props = {
  snapshotId: string
}

function isValidResponse(
  value: unknown,
  snapshotId: string
): value is AttributionResponse {
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
    !Array.isArray(record.stops)
  ) {
    return false
  }

  return record.stops.every((stop, index) => {
    if (
      !stop ||
      typeof stop !== 'object' ||
      Array.isArray(stop)
    ) {
      return false
    }

    const row = stop as Record<string, unknown>

    return (
      typeof row.venueId === 'string' &&
      row.stopIndex === index &&
      typeof row.attributionCertified === 'boolean' &&
      (
        row.originalCreatorUserId === null ||
        typeof row.originalCreatorUserId === 'string'
      ) &&
      (
        row.attributionOrigin === 'collection' ||
        row.attributionOrigin === 'manual' ||
        row.attributionOrigin === 'platform' ||
        row.attributionOrigin === 'unknown'
      )
    )
  })
}

function creatorReference(userId: string) {
  // Do not pretend we have a public username or profile.
  // This identifier is from the trusted attribution API.
  return `${userId.slice(0, 8)}…`
}

function stopAttributionLabel(stop: AttributionStop) {
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

  return stop.attributionOrigin === 'collection'
    ? `Collection creator · ${creatorReference(
        stop.originalCreatorUserId
      )}`
    : `Original contributor · ${creatorReference(
        stop.originalCreatorUserId
      )}`
}

export default function SnapshotAttributionPanel({
  snapshotId,
}: Props) {
  const [data, setData] =
    useState<AttributionResponse | null>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setData(null)

    async function load() {
      try {
        const response = await fetch(
          `/api/flow-snapshots/${encodeURIComponent(
            snapshotId
          )}/attribution`,
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }
        )

        // Disabled read flag, inaccessible private Snapshot,
        // or another error: render no potentially misleading
        // attribution rather than inventing an author.
        if (!response.ok) return

        const payload: unknown = await response.json()

        if (
          active &&
          isValidResponse(payload, snapshotId)
        ) {
          setData(payload)
        }
      } catch {
        // Attribution is additive. It must not block the
        // Snapshot's existing presentation or Replay CTA.
      }
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [snapshotId])

  if (!data || data.stops.length === 0) {
    return null
  }

  return (
    <section
      aria-label="Original stop attribution"
      className="rounded-2xl border border-white/10 bg-neutral-950 p-5 text-white"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Original stop attribution
        </h2>

        <p className="text-sm leading-6 text-neutral-400">
          The Snapshot publisher and the original
          contributors are different roles. Replaying
          this Flow does not transfer original authorship.
        </p>

        {!data.certifiedRoute ? (
          <p className="text-xs text-neutral-500">
            Historical Snapshot: original authorship
            has not been certified.
          </p>
        ) : null}
      </div>

      <ol className="mt-4 divide-y divide-white/10">
        {data.stops.map((stop) => (
          <li
            key={`${stop.stopIndex}-${stop.venueId}`}
            className="flex items-start gap-3 py-3"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold"
            >
              {stop.stopIndex + 1}
            </span>

            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-200">
                {stopAttributionLabel(stop)}
              </p>

              <p className="mt-1 break-all text-xs text-neutral-500">
                Venue {stop.venueId}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
