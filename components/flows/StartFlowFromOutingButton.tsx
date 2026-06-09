'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  eventId: string
  plannedOutingId: string
  existingSessionId?: string | null
  className?: string
  label?: string
  loadingLabel?: string
  disabled?: boolean
  onStarted?: (payload: {
    session: {
      id: string
      [key: string]: unknown
    }
  }) => void
}

export default function StartFlowFromOutingButton({
  eventId,
  plannedOutingId,
  existingSessionId = null,
  className = '',
  label = 'Start Flow',
  loadingLabel = 'Starting Flow…',
  disabled = false,
  onStarted,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartFlow = async () => {
    if (loading || disabled) return

    setLoading(true)
    setError(null)

    if (existingSessionId) {
      router.push(`/flow/${existingSessionId}`)
      return
    }

    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/outing/${encodeURIComponent(
          plannedOutingId
        )}/start-flow`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )

      const text = await res.text()
      let json: any = null

      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }

      if (!res.ok) {
        console.error('[StartFlowFromOutingButton] start-flow failed:', {
          status: res.status,
          statusText: res.statusText,
          response: json ?? text,
        })

        const message =
          json?.details ||
          json?.error ||
          text ||
          `Could not start this flow. Server returned ${res.status}.`

        setError(message)
        return
      }

      const sessionId = json?.session?.id

      if (!sessionId || typeof sessionId !== 'string') {
        console.error('[StartFlowFromOutingButton] Missing session id:', json)
        setError('Flow started, but no session was returned.')
        return
      }

      onStarted?.(json)

      router.push(`/flow/${sessionId}`)
    } catch (err) {
      console.error('[StartFlowFromOutingButton] Failed to start flow:', err)
      setError('Unexpected error starting this flow.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleStartFlow}
        disabled={disabled || loading}
        className={
          className ||
          'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60'
        }
      >
        {loading ? loadingLabel : label}
      </button>

      {error ? (
        <p className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}