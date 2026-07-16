'use client'

import { useState } from 'react'

type DeleteSnapshotResponse = {
  deleted?: boolean
  snapshotId?: string
  storageDeleted?: boolean
  error?: string
}

type Props = {
  snapshotId: string
  snapshotTitle?: string | null
  className?: string
  disabled?: boolean
  compact?: boolean
  confirmTitle?: string
  confirmDescription?: string
  onDeleted?: (snapshotId: string) => void
  onError?: (message: string) => void
}

export default function DeleteSnapshotButton({
  snapshotId,
  snapshotTitle = null,
  className = '',
  disabled = false,
  compact = false,
  confirmTitle = 'Delete this snapshot?',
  confirmDescription,
  onDeleted,
  onError,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedDescription =
    confirmDescription ??
    `“${snapshotTitle?.trim() || 'Roam Flow'}” will be removed from your snapshot library and public profile. This action cannot be undone.`

  const openConfirmation = () => {
    if (disabled || deleting || !snapshotId.trim()) return

    setError(null)
    setConfirmOpen(true)
  }

  const closeConfirmation = () => {
    if (deleting) return

    setConfirmOpen(false)
  }

  const deleteSnapshot = async () => {
    if (disabled || deleting || !snapshotId.trim()) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/flow-snapshots/${encodeURIComponent(snapshotId)}`,
        {
          method: 'DELETE',
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | DeleteSnapshotResponse
        | null

      if (!response.ok) {
        throw new Error(
          payload?.error || 'Failed to delete snapshot.'
        )
      }

      if (payload?.deleted !== true) {
        throw new Error(
          'The server did not confirm that the snapshot was deleted.'
        )
      }

      setConfirmOpen(false)
      onDeleted?.(payload.snapshotId ?? snapshotId)
    } catch (err) {
      console.error(
        '[DeleteSnapshotButton] Snapshot delete failed:',
        err
      )

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to delete snapshot.'

      setError(message)
      onError?.(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className={[
          'space-y-2',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          onClick={openConfirmation}
          disabled={disabled || deleting || !snapshotId.trim()}
          className={[
            'inline-flex items-center justify-center rounded-xl border border-red-900/60 bg-red-950/20 font-medium text-red-300 transition',
            'hover:border-red-800 hover:bg-red-950/40 hover:text-red-200',
            'disabled:cursor-not-allowed disabled:opacity-60',
            compact
              ? 'px-3 py-2 text-xs'
              : 'w-full px-4 py-2.5 text-sm',
          ].join(' ')}
        >
          {deleting ? 'Deleting…' : 'Delete Snapshot'}
        </button>

        {error ? (
          <p
            role="alert"
            className="max-w-sm text-xs leading-5 text-red-400"
          >
            {error}
          </p>
        ) : null}
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 text-white"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-snapshot-dialog-title"
          aria-describedby="delete-snapshot-dialog-description"
          onClick={closeConfirmation}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-900/60 bg-red-950/30 text-xl">
                🗑️
              </div>

              <div className="min-w-0 flex-1">
                <p
                  id="delete-snapshot-dialog-title"
                  className="text-lg font-semibold text-white"
                >
                  {confirmTitle}
                </p>

                <p
                  id="delete-snapshot-dialog-description"
                  className="mt-2 text-sm leading-6 text-neutral-400"
                >
                  {resolvedDescription}
                </p>
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-900/60 bg-red-950/25 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={deleting}
                className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void deleteSnapshot()}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete Snapshot'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}