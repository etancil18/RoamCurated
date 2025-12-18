// app/dash/messages/page.tsx

import { createServerClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'

export default async function DashMessagesPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 🧠 Guard against undefined emails
  if (!user?.email) return null

  const { data: venueUser } = await supabase
    .from('venue_users')
    .select('venue_id')
    .eq('email', user.email)
    .single()

  if (!venueUser) return null

  const venueId = venueUser.venue_id

  const { data: messages } = await supabase
    .from('venue_messages')
    .select('id, user_id, message, direction, created_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Messages from Roam Guests</h1>
      <div className="space-y-4">
        {messages && messages.length > 0 ? (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-xl text-sm border ${
                msg.direction === 'from_user'
                  ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  : 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700'
              }`}
            >
              {/* Message Text */}
              <p className="mb-1 whitespace-pre-line">{msg.message}</p>

              {/* Time & Direction */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {msg.direction === 'from_user' ? 'Guest → Venue' : 'You → Guest'} ·{' '}
                {msg.created_at
                  ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })
                  : ''}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No messages yet. When Roam users message your venue, they’ll appear here.
          </p>
        )}
      </div>
    </div>
  )
}
