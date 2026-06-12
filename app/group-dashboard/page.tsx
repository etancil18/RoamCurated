import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import GroupDashboardMetrics from './components/GroupDashboardMetrics'
import GroupEventsTable from './components/GroupEventsTable'
import GroupAttendeeInsights from './components/GroupAttendeeInsights'

const founderAdminEmails = [
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
]

type Props = {
  searchParams?: Promise<{
    groupId?: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function GroupDashboardPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams
  const selectedGroupId = resolvedSearchParams?.groupId ?? null

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isFounderAdmin = user.email
    ? founderAdminEmails.includes(user.email.toLowerCase())
    : false

  const { data: allGroups } = isFounderAdmin
    ? await supabase
        .from('social_groups')
        .select('id, name, slug, description, logo_url')
        .order('name', { ascending: true })
    : { data: null }

  const { data: memberships } = !isFounderAdmin
    ? await supabase
        .from('social_group_members')
        .select(`
          group_id,
          role,
          social_groups (
            id,
            name,
            slug,
            description,
            logo_url
          )
        `)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
    : { data: null }

  const groups = isFounderAdmin
    ? allGroups ?? []
    : (memberships ?? [])
        .map((membership: any) => membership.social_groups)
        .filter(Boolean)

  if (groups.length === 0) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-24">
        <h1 className="text-3xl font-bold text-white">Group Dashboard</h1>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-400">
          You do not have access to any group dashboards yet.
        </div>
      </main>
    )
  }

  const activeGroup = selectedGroupId
    ? groups.find((group: any) => group.id === selectedGroupId) ?? groups[0]
    : groups[0]

  const groupId = activeGroup.id

  const [
    { data: events },
    { data: checkins },
    { data: xpLedger },
  ] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('social_group_id', groupId)
      .order('starts_at', { ascending: false }),

    supabase
      .from('event_checkins')
      .select('id, event_id, user_id, checked_in_at')
      .eq('social_group_id', groupId)
      .order('checked_in_at', { ascending: false }),

    supabase
      .from('event_xp_ledger')
      .select('id, event_id, user_id, xp_amount, created_at')
      .eq('social_group_id', groupId)
      .order('created_at', { ascending: false }),
  ])

  const safeEvents = events ?? []
  const safeCheckins = checkins ?? []
  const safeXpLedger = xpLedger ?? []

  const uniqueAttendees = new Set(safeCheckins.map((row) => row.user_id))

  const checkinsByUser = safeCheckins.reduce<Record<string, number>>((acc, row) => {
    acc[row.user_id] = (acc[row.user_id] ?? 0) + 1
    return acc
  }, {})

  const repeatAttendees = Object.values(checkinsByUser).filter((count) => count > 1).length

  const xpByEvent = safeXpLedger.reduce<Record<string, number>>((acc, row) => {
    acc[row.event_id] = (acc[row.event_id] ?? 0) + (row.xp_amount ?? 0)
    return acc
  }, {})

  const xpByUser = safeXpLedger.reduce<Record<string, number>>((acc, row) => {
    acc[row.user_id] = (acc[row.user_id] ?? 0) + (row.xp_amount ?? 0)
    return acc
  }, {})

  const checkinsByEvent = safeCheckins.reduce<Record<string, typeof safeCheckins>>((acc, row) => {
    if (!acc[row.event_id]) acc[row.event_id] = []
    acc[row.event_id].push(row)
    return acc
  }, {})

  const totalXpAwarded = safeXpLedger.reduce((sum, row) => {
    return sum + (row.xp_amount ?? 0)
  }, 0)

  const metrics = {
    groupId,
    totalEvents: safeEvents.length,
    totalCheckins: safeCheckins.length,
    uniqueAttendees: uniqueAttendees.size,
    repeatAttendees,
    totalXpAwarded,
  }

  const eventMetrics = safeEvents.map((event) => {
    const eventCheckins = checkinsByEvent[event.id] ?? []
    const eventUniqueAttendees = new Set(eventCheckins.map((row) => row.user_id))

    return {
      eventId: event.id,
      title: event.title,
      startsAt: event.starts_at,
      checkins: eventCheckins.length,
      uniqueAttendees: eventUniqueAttendees.size,
      xpAwarded: xpByEvent[event.id] ?? 0,
    }
  })

  const attendeeInsights = Object.entries(checkinsByUser)
    .map(([userId, checkinCount]) => {
      const userCheckins = safeCheckins
        .filter((row) => row.user_id === userId)
        .sort(
          (a, b) =>
            new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
        )

      return {
        userId,
        checkins: checkinCount,
        xpEarned: xpByUser[userId] ?? 0,
        firstCheckinAt: userCheckins[0]?.checked_in_at ?? null,
        lastCheckinAt: userCheckins[userCheckins.length - 1]?.checked_in_at ?? null,
      }
    })
    .sort((a, b) => b.checkins - a.checkins)

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
            Organizer Analytics
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {activeGroup.name}
          </h1>
          {activeGroup.description && (
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              {activeGroup.description}
            </p>
          )}
        </div>

        {groups.length > 1 && (
          <form>
            <label className="mb-1 block text-sm text-neutral-400">
              Switch Group
            </label>
            <select
              name="groupId"
              defaultValue={groupId}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            >
              {groups.map((group: any) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <button className="ml-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black">
              View
            </button>
          </form>
        )}
      </div>

      <GroupDashboardMetrics metrics={metrics} />
      <GroupEventsTable events={eventMetrics} />
      <GroupAttendeeInsights attendees={attendeeInsights} />
    </main>
  )
}