import { Card, CardContent } from '@/components/ui/card'
import type { SocialGroupMetrics } from '@/types/social-groups'

type GroupDashboardMetricsProps = {
  metrics: SocialGroupMetrics
}

export default function GroupDashboardMetrics({
  metrics,
}: GroupDashboardMetricsProps) {
  const cards = [
    {
      label: 'Events',
      value: metrics.totalEvents,
      helper: 'Group-linked events',
    },
    {
      label: 'Check-ins',
      value: metrics.totalCheckins,
      helper: 'Verified attendance actions',
    },
    {
      label: 'Unique Attendees',
      value: metrics.uniqueAttendees,
      helper: 'Distinct people reached',
    },
    {
      label: 'Repeat Attendees',
      value: metrics.repeatAttendees,
      helper: 'People who came back',
    },
    {
      label: 'XP Awarded',
      value: metrics.totalXpAwarded,
      helper: 'Passport engagement issued',
    },
  ]

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="border-neutral-800 bg-neutral-950">
          <CardContent className="p-5">
            <p className="text-sm text-neutral-500">{card.label}</p>

            <p className="mt-2 text-3xl font-semibold text-white">
              {card.value.toLocaleString()}
            </p>

            <p className="mt-2 text-xs text-neutral-500">
              {card.helper}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}