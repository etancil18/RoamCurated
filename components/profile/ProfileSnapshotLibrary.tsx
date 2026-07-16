'use client'

import { useMemo, useState } from 'react'

type SnapshotVisibility = 'public' | 'private'

export type ProfileSnapshot = {
  id: string
  title: string | null
  city: string | null
  cover_image_url: string | null
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  visibility: SnapshotVisibility
  source_type?: string | null
  source_id?: string | null
  created_at: string
  updated_at?: string | null
}

type SnapshotMutationResponse = {
  snapshot?: ProfileSnapshot
  deleted?: boolean
  error?: string
  details?: string
  code?: string | null
  hint?: string | null
}

type Props = {
  initialSnapshots: ProfileSnapshot[]
  className?: string
}

export default function ProfileSnapshotLibrary({
  initialSnapshots,
  className = '',
}: Props) {
  const [snapshots, setSnapshots] =
    useState<ProfileSnapshot[]>(initialSnapshots)

  const [selectedSnapshot, setSelectedSnapshot] =
    useState<ProfileSnapshot | null>(null)

  const [busySnapshotId, setBusySnapshotId] =
    useState<string | null>(null)

  const [deleteCandidate, setDeleteCandidate] =
    useState<ProfileSnapshot | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const publicCount = useMemo(
    () =>
      snapshots.filter(
        (snapshot) => snapshot.visibility === 'public'
      ).length,
    [snapshots]
  )

  const clearMessages = () => {
    setError(null)
    setNotice(null)
  }

  const updateVisibility = async (
    snapshot: ProfileSnapshot,
    visibility: SnapshotVisibility
  ) => {
    if (
      busySnapshotId ||
      snapshot.visibility === visibility
    ) {
      return
    }

    clearMessages()
    setBusySnapshotId(snapshot.id)

    const previousSnapshots = snapshots

    setSnapshots((current) =>
      current.map((item) =>
        item.id === snapshot.id
          ? {
              ...item,
              visibility,
            }
          : item
      )
    )

    setSelectedSnapshot((current) =>
      current?.id === snapshot.id
        ? {
            ...current,
            visibility,
          }
        : current
    )

    try {
      const response = await fetch(
        `/api/flow-snapshots/${encodeURIComponent(snapshot.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visibility,
          }),
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | SnapshotMutationResponse
        | null

      if (!response.ok) {
        throw new Error(
          buildMutationErrorMessage({
            payload,
            fallback: `Failed to update snapshot visibility (${response.status}).`,
          })
        )
      }

      const updatedSnapshot = payload?.snapshot

      if (updatedSnapshot) {
        setSnapshots((current) =>
          current.map((item) =>
            item.id === updatedSnapshot.id
              ? normalizeSnapshot(updatedSnapshot)
              : item
          )
        )

        setSelectedSnapshot((current) =>
          current?.id === updatedSnapshot.id
            ? normalizeSnapshot(updatedSnapshot)
            : current
        )
      }

      setNotice(
        visibility === 'public'
          ? 'Snapshot added to your public profile.'
          : 'Snapshot hidden from your public profile.'
      )
    } catch (err) {
      console.error(
        '[ProfileSnapshotLibrary] Visibility update failed:',
        err
      )

      setSnapshots(previousSnapshots)

      setSelectedSnapshot((current) =>
        current?.id === snapshot.id ? snapshot : current
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update snapshot visibility.'
      )
    } finally {
      setBusySnapshotId(null)
    }
  }

  const deleteSnapshot = async (
    snapshot: ProfileSnapshot
  ) => {
    if (busySnapshotId) return

    clearMessages()
    setBusySnapshotId(snapshot.id)

    try {
      const response = await fetch(
        `/api/flow-snapshots/${encodeURIComponent(snapshot.id)}`,
        {
          method: 'DELETE',
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | SnapshotMutationResponse
        | null

      if (!response.ok) {
        throw new Error(
          buildMutationErrorMessage({
            payload,
            fallback: `Failed to delete snapshot (${response.status}).`,
          })
        )
      }

      setSnapshots((current) =>
        current.filter((item) => item.id !== snapshot.id)
      )

      setSelectedSnapshot((current) =>
        current?.id === snapshot.id ? null : current
      )

      setDeleteCandidate(null)
      setNotice('Snapshot deleted.')
    } catch (err) {
      console.error(
        '[ProfileSnapshotLibrary] Snapshot delete failed:',
        err
      )

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete snapshot.'
      )
    } finally {
      setBusySnapshotId(null)
    }
  }

  return (
    <>
      <section
        className={[
          'rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400">
              Flow snapshots
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Your snapshot library
            </h2>

            <p className="mt-1 text-sm text-neutral-400">
              Manage which completed flows appear on your public
              profile.
            </p>
          </div>

          <div className="flex gap-2">
            <SnapshotCount
              label="Total"
              value={snapshots.length}
            />

            <SnapshotCount
              label="Public"
              value={publicCount}
            />
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-300"
          >
            {notice}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-900/60 bg-red-950/25 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}

        {snapshots.length === 0 ? (
          <EmptySnapshotLibrary />
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snapshots.map((snapshot) => {
              const busy = busySnapshotId === snapshot.id
              const isPublic =
                snapshot.visibility === 'public'

              return (
                <article
                  key={snapshot.id}
                  className="group overflow-hidden rounded-2xl border border-neutral-800 bg-black/30"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSnapshot(snapshot)
                    }
                    className="relative block aspect-square w-full overflow-hidden bg-neutral-900 text-left"
                    aria-label={`Preview ${
                      snapshot.title ?? 'Roam flow snapshot'
                    }`}
                  >
                    {snapshot.cover_image_url ? (
                      <img
                        src={snapshot.cover_image_url}
                        alt={
                          snapshot.title ??
                          'Roam flow snapshot'
                        }
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_42%),#09090b]">
                        <span className="text-4xl">🗺️</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />

                    <div className="absolute left-3 top-3">
                      <VisibilityBadge
                        visibility={snapshot.visibility}
                      />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="line-clamp-2 text-base font-semibold text-white">
                        {snapshot.title ?? 'Roam Flow'}
                      </p>

                      <p className="mt-1 text-xs text-neutral-300">
                        {buildSnapshotMetadata(snapshot)}
                      </p>
                    </div>
                  </button>

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {snapshot.title ?? 'Roam Flow'}
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          {formatSnapshotDate(
                            snapshot.created_at
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSnapshot(snapshot)
                        }
                        className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
                      >
                        Preview
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void updateVisibility(
                          snapshot,
                          isPublic ? 'private' : 'public'
                        )
                      }
                      disabled={busy}
                      className={[
                        'flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                        isPublic
                          ? 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700',
                      ].join(' ')}
                    >
                      {busy
                        ? 'Updating…'
                        : isPublic
                          ? 'Hide from Public Profile'
                          : 'Show on Public Profile'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteCandidate(snapshot)
                      }
                      disabled={busy}
                      className="w-full rounded-xl border border-red-900/60 bg-red-950/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete Snapshot
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selectedSnapshot ? (
        <SnapshotPreviewModal
          snapshot={selectedSnapshot}
          busy={busySnapshotId === selectedSnapshot.id}
          onClose={() => setSelectedSnapshot(null)}
          onVisibilityChange={(visibility) =>
            void updateVisibility(
              selectedSnapshot,
              visibility
            )
          }
          onDelete={() =>
            setDeleteCandidate(selectedSnapshot)
          }
        />
      ) : null}

      {deleteCandidate ? (
        <DeleteSnapshotDialog
          snapshot={deleteCandidate}
          deleting={busySnapshotId === deleteCandidate.id}
          onCancel={() => {
            if (busySnapshotId) return
            setDeleteCandidate(null)
          }}
          onConfirm={() =>
            void deleteSnapshot(deleteCandidate)
          }
        />
      ) : null}
    </>
  )
}

function SnapshotPreviewModal({
  snapshot,
  busy,
  onClose,
  onVisibilityChange,
  onDelete,
}: {
  snapshot: ProfileSnapshot
  busy: boolean
  onClose: () => void
  onVisibilityChange: (
    visibility: SnapshotVisibility
  ) => void
  onDelete: () => void
}) {
  const isPublic = snapshot.visibility === 'public'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-preview-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 p-4">
          <div className="min-w-0">
            <p
              id="snapshot-preview-title"
              className="truncate text-base font-semibold text-white"
            >
              {snapshot.title ?? 'Roam Flow'}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              {buildSnapshotMetadata(snapshot)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-neutral-900 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="p-4">
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black">
            {snapshot.cover_image_url ? (
              <img
                src={snapshot.cover_image_url}
                alt={
                  snapshot.title ??
                  'Roam flow snapshot preview'
                }
                className="h-auto w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[9/16] items-center justify-center bg-neutral-900 text-5xl">
                🗺️
              </div>
            )}
          </div>

          {snapshot.route_summary ? (
            <div className="mt-4 rounded-xl border border-neutral-800 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Route
              </p>

              <p className="mt-2 text-sm leading-6 text-neutral-300">
                {snapshot.route_summary}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <SnapshotDetail
              label="Stops"
              value={`${snapshot.checked_in_count ?? 0}/${
                snapshot.total_stops ?? 0
              }`}
            />

            <SnapshotDetail
              label="Visibility"
              value={isPublic ? 'Public' : 'Private'}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                onVisibilityChange(
                  isPublic ? 'private' : 'public'
                )
              }
              disabled={busy}
              className={[
                'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                isPublic
                  ? 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700',
              ].join(' ')}
            >
              {busy
                ? 'Updating…'
                : isPublic
                  ? 'Hide from Public Profile'
                  : 'Show on Public Profile'}
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteSnapshotDialog({
  snapshot,
  deleting,
  onCancel,
  onConfirm,
}: {
  snapshot: ProfileSnapshot
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 text-white"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-snapshot-title"
      aria-describedby="delete-snapshot-description"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p
          id="delete-snapshot-title"
          className="text-lg font-semibold text-white"
        >
          Delete this snapshot?
        </p>

        <p
          id="delete-snapshot-description"
          className="mt-2 text-sm leading-6 text-neutral-400"
        >
          “{snapshot.title ?? 'Roam Flow'}” will be removed from
          your library and public profile. This action cannot be
          undone.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-900 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete Snapshot'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SnapshotCount({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="min-w-[72px] rounded-xl border border-neutral-800 bg-black/30 px-3 py-2 text-center">
      <p className="text-base font-semibold text-white">
        {value.toLocaleString()}
      </p>

      <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
    </div>
  )
}

function SnapshotDetail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-neutral-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  )
}

function VisibilityBadge({
  visibility,
}: {
  visibility: SnapshotVisibility
}) {
  const isPublic = visibility === 'public'

  return (
    <span
      className={[
        'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur',
        isPublic
          ? 'border-emerald-400/40 bg-emerald-950/75 text-emerald-200'
          : 'border-neutral-500/40 bg-black/70 text-neutral-300',
      ].join(' ')}
    >
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}

function EmptySnapshotLibrary() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 bg-black/20 px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-2xl">
        📸
      </div>

      <p className="mt-4 text-sm font-semibold text-white">
        No flow snapshots yet
      </p>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Complete a Roam Flow, then save its snapshot. You can
        choose which snapshots appear on your public profile.
      </p>
    </div>
  )
}

function normalizeSnapshot(
  snapshot: ProfileSnapshot
): ProfileSnapshot {
  return {
    ...snapshot,
    visibility:
      snapshot.visibility === 'private'
        ? 'private'
        : 'public',
    checked_in_count:
      typeof snapshot.checked_in_count === 'number'
        ? snapshot.checked_in_count
        : 0,
    total_stops:
      typeof snapshot.total_stops === 'number'
        ? snapshot.total_stops
        : 0,
  }
}

function buildMutationErrorMessage({
  payload,
  fallback,
}: {
  payload: SnapshotMutationResponse | null
  fallback: string
}): string {
  const messageParts = [
    payload?.error,
    payload?.details,
    payload?.code
      ? `Code: ${payload.code}`
      : null,
    payload?.hint
      ? `Hint: ${payload.hint}`
      : null,
  ].filter(
    (value): value is string =>
      typeof value === 'string' &&
      value.trim().length > 0
  )

  return messageParts.length > 0
    ? messageParts.join(' — ')
    : fallback
}

function buildSnapshotMetadata(
  snapshot: ProfileSnapshot
): string {
  const parts: string[] = []

  if (snapshot.city?.trim()) {
    parts.push(snapshot.city.trim())
  }

  const checkedInCount =
    snapshot.checked_in_count ?? 0

  const totalStops =
    snapshot.total_stops ?? 0

  parts.push(
    `${checkedInCount}/${totalStops} ${
      totalStops === 1 ? 'stop' : 'stops'
    }`
  )

  return parts.join(' · ')
}

function formatSnapshotDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}