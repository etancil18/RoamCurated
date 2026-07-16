'use client'

import { useState } from 'react'

export type SnapshotVisibility = 'public' | 'private'

type SnapshotVisibilityResponse = {
  snapshot?: {
    id: string
    visibility: SnapshotVisibility
  }
  updated?: boolean
  error?: string
}

type Props = {
  snapshotId: string
  initialVisibility: SnapshotVisibility
  className?: string
  disabled?: boolean
  compact?: boolean
  onVisibilityChange?: (visibility: SnapshotVisibility) => void
  onError?: (message: string) => void
}

export default function SnapshotVisibilityButton({
  snapshotId,
  initialVisibility,
  className = '',
  disabled = false,
  compact = false,
  onVisibilityChange,
  onError,
}: Props) {
  const [visibility, setVisibility] =
    useState<SnapshotVisibility>(initialVisibility)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPublic = visibility === 'public'
  const nextVisibility: SnapshotVisibility = isPublic
    ? 'private'
    : 'public'

  const updateVisibility = async () => {
    if (disabled || saving || !snapshotId.trim()) return

    const previousVisibility = visibility

    setSaving(true)
    setError(null)

    // Optimistic update
    setVisibility(nextVisibility)
    onVisibilityChange?.(nextVisibility)

    try {
      const response = await fetch(
        `/api/flow-snapshots/${encodeURIComponent(snapshotId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visibility: nextVisibility,
          }),
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | SnapshotVisibilityResponse
        | null

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Failed to update snapshot visibility.'
        )
      }

      const confirmedVisibility =
        payload?.snapshot?.visibility === 'private'
          ? 'private'
          : 'public'

      setVisibility(confirmedVisibility)
      onVisibilityChange?.(confirmedVisibility)
    } catch (err) {
      console.error(
        '[SnapshotVisibilityButton] Visibility update failed:',
        err
      )

      setVisibility(previousVisibility)
      onVisibilityChange?.(previousVisibility)

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update snapshot visibility.'

      setError(message)
      onError?.(message)
    } finally {
      setSaving(false)
    }
  }

  return (
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
        onClick={() => void updateVisibility()}
        disabled={disabled || saving}
        aria-pressed={isPublic}
        aria-label={
          isPublic
            ? 'Hide snapshot from public profile'
            : 'Show snapshot on public profile'
        }
        className={[
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition',
          'disabled:cursor-not-allowed disabled:opacity-60',
          compact
            ? 'px-3 py-2 text-xs'
            : 'w-full px-4 py-2.5 text-sm',
          isPublic
            ? 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'
            : 'bg-indigo-600 text-white hover:bg-indigo-700',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'inline-flex h-2.5 w-2.5 rounded-full',
            isPublic
              ? 'bg-emerald-400'
              : 'bg-neutral-500',
          ].join(' ')}
        />

        <span>
          {saving
            ? 'Updating…'
            : isPublic
              ? 'Hide from Public Profile'
              : 'Show on Public Profile'}
        </span>
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
  )
}