'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Props = {
  sessionId: string
  venueId: string
  stopIndex: number
  checked?: boolean
  disabled?: boolean
  onCheckedIn?: (payload: {
    progress: {
      id: string
      session_id: string
      user_id: string
      venue_id: string
      stop_index: number
      checked_in_at: string
    }
    completedStops: number
    totalStops: number
    flowCompleted: boolean
    xpEarned: number
  }) => void
}

export default function CheckInButton({
  sessionId,
  venueId,
  stopIndex,
  checked = false,
  disabled = false,
  onCheckedIn,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    if (checked || disabled || loading) return

    setLoading(true)

    try {
      const res = await fetch('/api/active-flow/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: stopIndex,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        alert(json.error ?? 'Could not check in.')
        return
      }

      onCheckedIn?.(json)
      router.refresh()
    } catch (err) {
      console.error('[CheckInButton] Check-in failed:', err)
      alert('Unexpected error checking in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      disabled={checked || disabled || loading}
      onClick={handleCheckIn}
      className={
        checked
          ? 'bg-green-700 text-white hover:bg-green-700'
          : ''
      }
    >
      {checked
        ? '✓ Checked In'
        : loading
          ? 'Checking in...'
          : 'Check In'}
    </Button>
  )
}