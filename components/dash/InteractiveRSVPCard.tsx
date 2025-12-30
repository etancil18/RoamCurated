'use client'

import { format } from 'date-fns'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import cn from 'classnames'

type RSVPStatus = 'Confirmed' | 'Checked In' | 'Did Not Attend'

type RSVP = {
  crawl_rsvp_id: string
  profile_name: string | null
  instagram_handle: string | null
  note: string | null
  datetime: string | null
  status: RSVPStatus | null
  crawl_name?: string | null
}

export default function InteractiveRSVPCard({ rsvp }: { rsvp: RSVP }) {
  // Default to Confirmed if null sneaks through
  const [status, setStatus] = useState<RSVPStatus>(
    rsvp.status ?? 'Confirmed'
  )

  const handleStatusUpdate = async (newStatus: RSVPStatus) => {
    const supabase = supabaseBrowser()

    const update: {
      status: RSVPStatus
      checked_in_at?: string
    } = {
      status: newStatus,
    }

    if (newStatus === 'Checked In') {
      update.checked_in_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('crawl_rsvps')
      .update(update)
      .eq('id', rsvp.crawl_rsvp_id)

    if (error) {
      console.error('Status update failed:', error.message)
      return
    }

    setStatus(newStatus)
  }

  const displayName =
    rsvp.profile_name ??
    (rsvp.instagram_handle ? `@${rsvp.instagram_handle}` : 'Unknown Guest')

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-colors',
        'bg-white dark:bg-gray-800',
        status === 'Checked In'
          ? 'border-green-400'
          : status === 'Did Not Attend'
          ? 'border-red-400'
          : 'border-gray-300 dark:border-gray-700'
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-xs text-gray-400">
            Crawl: {rsvp.crawl_name ?? 'Unknown'}
          </p>
        </div>

        <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
          {status}
        </span>
      </div>

      <p className="text-sm">
        <span className="font-semibold">Arrival Time:</span>{' '}
        {rsvp.datetime
          ? format(new Date(rsvp.datetime), 'PPpp')
          : 'Unknown'}
      </p>

      {rsvp.note && (
        <p className="mt-2 text-sm italic text-gray-500 dark:text-gray-400">
          “{rsvp.note}”
        </p>
      )}

      <div className="mt-4 flex space-x-2">
        {status === 'Confirmed' && (
          <button
            onClick={() => handleStatusUpdate('Checked In')}
            className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
          >
            Check In
          </button>
        )}

        {status !== 'Confirmed' && (
          <button
            onClick={() => handleStatusUpdate('Confirmed')}
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  )
}
