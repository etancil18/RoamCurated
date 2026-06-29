'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { logEvent } from '@/lib/logEvent'

type Props = {
  sessionId: string
  disabled?: boolean
  completed?: boolean
  cancelled?: boolean
  onCompleted?: (payload: {
    session: any
    xpEarned?: number
    badgeUnlocked?: string
  }) => void
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function CompleteFlowButton({
  sessionId,
  disabled = false,
  completed = false,
  cancelled = false,
  onCompleted,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    if (disabled || completed || cancelled || loading) return

    safeLogEvent('complete_flow_button_clicked', {
      session_id: sessionId,
    })

    setLoading(true)

    try {
      const res = await fetch('/api/active-flow/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        safeLogEvent('complete_flow_failed', {
          session_id: sessionId,
          status: res.status,
          error: json.error ?? null,
        })

        alert(json.error ?? 'Could not complete flow.')
        return
      }

      safeLogEvent('complete_flow_succeeded', {
        session_id: sessionId,
        xp_earned: json?.xpEarned ?? null,
        badge_unlocked: json?.badgeUnlocked ?? null,
      })

      onCompleted?.(json)
      router.refresh()
    } catch (err) {
      safeLogEvent('complete_flow_error', {
        session_id: sessionId,
        message: err instanceof Error ? err.message : 'Unexpected error completing flow.',
      })

      console.error('[CompleteFlowButton] Complete failed:', err)
      alert('Unexpected error completing flow.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700"
      disabled={disabled || completed || cancelled || loading}
      onClick={handleComplete}
    >
      {loading
        ? 'Completing...'
        : completed
          ? 'Flow Completed'
          : 'Complete Flow'}
    </Button>
  )
}