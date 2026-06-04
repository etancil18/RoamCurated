'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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
        alert(json.error ?? 'Could not complete flow.')
        return
      }

      onCompleted?.(json)
      router.refresh()
    } catch (err) {
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