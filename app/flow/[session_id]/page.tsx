import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import ActiveFlowCard from './components/ActiveFlowCard'
import FlowMap from './components/FlowMap'
import FlowProgress from './components/FlowProgress'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    session_id: string
  }>
}

type Venue = {
  id: string
  name: string
  city: string | null
  lat: number | null
  lon: number | null
  instagram_handle: string | null
}

function normalizeTravelMode(
  value: string | null
): 'walking' | 'cycling' | 'driving' | null {
  if (value === 'walking' || value === 'cycling' || value === 'driving') {
    return value
  }

  return null
}

function normalizeStatus(
  value: string
): 'active' | 'completed' | 'cancelled' {
  if (value === 'active' || value === 'completed' || value === 'cancelled') {
    return value
  }

  return 'active'
}

export default async function ActiveFlowPage({ params }: PageProps) {
  const { session_id } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const { data: session, error: sessionError } = await supabase
    .from('active_flow_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (sessionError) {
    console.error('[flow/page] Session fetch error:', sessionError)
    notFound()
  }

  if (!session) {
    notFound()
  }

  const venueIds = Array.isArray(session.venue_ids)
    ? session.venue_ids.filter(Boolean)
    : []

  const { data: venueData, error: venueError } = await supabase
    .from('venues')
    .select('id, name, city, lat, lon, instagram_handle')
    .in('id', venueIds)

  if (venueError) {
    console.error('[flow/page] Venue fetch error:', venueError)
  }

  const venues: Venue[] = venueIds
    .map((venueId) => venueData?.find((venue) => venue.id === venueId))
    .filter((venue): venue is Venue => Boolean(venue))

  const { data: progressData, error: progressError } = await supabase
    .from('active_flow_progress')
    .select('*')
    .eq('session_id', session.id)
    .eq('user_id', user.id)
    .order('stop_index', { ascending: true })

  if (progressError) {
    console.error('[flow/page] Progress fetch error:', progressError)
  }

  const progress = progressData ?? []
  const completedVenueIds = progress.map((row) => row.venue_id)

  const currentVenueId =
    venueIds.find((venueId) => !completedVenueIds.includes(venueId)) ?? null

  const normalizedSession = {
    ...session,
    travel_mode: normalizeTravelMode(session.travel_mode),
    status: normalizeStatus(session.status),
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-10 text-white">
      <div className="mx-auto max-w-3xl space-y-6 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">
        <ActiveFlowCard
          session={normalizedSession}
          venues={venues}
          progress={progress}
        />

        <FlowMap
          venues={venues}
          completedVenueIds={completedVenueIds}
          currentVenueId={currentVenueId}
          heightPx={320}
        />

        <FlowProgress
          venueIds={venueIds}
          venues={venues}
          progress={progress}
        />
      </div>
    </main>
  )
}