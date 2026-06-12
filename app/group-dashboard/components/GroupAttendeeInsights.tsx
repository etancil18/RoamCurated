import type { SocialGroupAttendeeInsight } from '@/types/social-groups'

type GroupAttendeeInsightsProps = {
  attendees: SocialGroupAttendeeInsight[]
}

export default function GroupAttendeeInsights({
  attendees,
}: GroupAttendeeInsightsProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 p-5">
        <h2 className="text-lg font-semibold text-white">Attendee Insights</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Repeat attendance and XP earned by attendee.
        </p>
      </div>

      {attendees.length === 0 ? (
        <div className="p-5 text-sm text-neutral-500">
          No attendee data yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Attendee</th>
                <th className="px-5 py-3 font-medium">Check-ins</th>
                <th className="px-5 py-3 font-medium">XP Earned</th>
                <th className="px-5 py-3 font-medium">First Check-in</th>
                <th className="px-5 py-3 font-medium">Last Check-in</th>
              </tr>
            </thead>

            <tbody>
              {attendees.map((attendee) => (
                <tr
                  key={attendee.userId}
                  className="border-b border-neutral-900 last:border-0"
                >
                  <td className="px-5 py-4 font-medium text-white">
                    {formatUserId(attendee.userId)}
                  </td>

                  <td className="px-5 py-4 text-neutral-300">
                    {attendee.checkins.toLocaleString()}
                  </td>

                  <td className="px-5 py-4 text-neutral-300">
                    {attendee.xpEarned.toLocaleString()}
                  </td>

                  <td className="px-5 py-4 text-neutral-400">
                    {formatDate(attendee.firstCheckinAt)}
                  </td>

                  <td className="px-5 py-4 text-neutral-400">
                    {formatDate(attendee.lastCheckinAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatUserId(userId: string): string {
  if (!userId) return 'Unknown attendee'
  return `User ${userId.slice(0, 8)}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}