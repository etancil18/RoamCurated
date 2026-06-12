import type { SocialGroupEventMetric } from '@/types/social-groups'

type GroupEventsTableProps = {
  events: SocialGroupEventMetric[]
}

export default function GroupEventsTable({
  events,
}: GroupEventsTableProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 p-5">
        <h2 className="text-lg font-semibold text-white">Group Events</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Attendance and XP performance by event.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="p-5 text-sm text-neutral-500">
          No linked events yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Check-ins</th>
                <th className="px-5 py-3 font-medium">Unique Attendees</th>
                <th className="px-5 py-3 font-medium">XP Awarded</th>
              </tr>
            </thead>

            <tbody>
              {events.map((event) => (
                <tr
                  key={event.eventId}
                  className="border-b border-neutral-900 last:border-0"
                >
                  <td className="px-5 py-4 font-medium text-white">
                    {event.title ?? 'Untitled Event'}
                  </td>

                  <td className="px-5 py-4 text-neutral-400">
                    {formatDate(event.startsAt)}
                  </td>

                  <td className="px-5 py-4 text-neutral-300">
                    {event.checkins.toLocaleString()}
                  </td>

                  <td className="px-5 py-4 text-neutral-300">
                    {event.uniqueAttendees.toLocaleString()}
                  </td>

                  <td className="px-5 py-4 text-neutral-300">
                    {event.xpAwarded.toLocaleString()}
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

function formatDate(value: string | null): string {
  if (!value) return 'No date'

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