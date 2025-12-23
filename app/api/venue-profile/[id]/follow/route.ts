import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await supabaseServerApi()
  const { id: venueId } = params

  // require login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('venue_followers')
    .select('id')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ following: !!data })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await supabaseServerApi()
  const { id: venueId } = params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('venue_followers')
    .insert({ venue_id: venueId, user_id: user.id })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await supabaseServerApi()
  const { id: venueId } = params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('venue_followers')
    .delete()
    .eq('venue_id', venueId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
