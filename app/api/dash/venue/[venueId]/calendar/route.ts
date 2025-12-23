import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { expandRecurrence } from '@/utils/recurrence'

export async function GET(
  _req: NextRequest,
  { params }: { params: { venueId: string } }
) {
  const supabase = await supabaseServerApi()
  const { venueId } = await params

  const [eventsRes, recurringRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, ends_at')
      .eq('venue_id', venueId),
    supabase
      .from('recurring_events')
      .select(
        'id, title, recurrence_rule, start_time, end_time, starts_on, ends_on'
      )
      .eq('venue_id', venueId),
  ])

  if (eventsRes.error || recurringRes.error) {
    console.error('DB Errors:', eventsRes.error, recurringRes.error)
    return NextResponse.json([], { status: 500 })
  }

  const staticEvents = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    start: e.starts_at,
    end: e.ends_at,
  }))

  const rangeStart = new Date()
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 1)

  const recurringEvents = (recurringRes.data ?? []).flatMap((e) => {
    const startTime = e.start_time
      ? new Date(`1970-01-01T${e.start_time}`)
      : null
    const endTime = e.end_time
      ? new Date(`1970-01-01T${e.end_time}`)
      : null

    const dates = expandRecurrence(
      e.recurrence_rule,
      rangeStart,
      rangeEnd
    )

    return dates.map((date, i) => {
      const dateStr = date.toISOString().split('T')[0]
      const start = startTime
        ? new Date(`${dateStr}T${startTime.toTimeString().slice(0, 8)}`)
        : date
      const end = endTime
        ? new Date(`${dateStr}T${endTime.toTimeString().slice(0, 8)}`)
        : null

      return {
        id: `${e.id}-${i}`,
        title: e.title,
        start,
        end,
      }
    })
  })

  return NextResponse.json([...staticEvents, ...recurringEvents])
}
