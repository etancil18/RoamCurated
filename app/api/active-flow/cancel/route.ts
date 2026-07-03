import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

type CancelActiveFlowBody = {
  session_id?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const body = (await req.json()) as CancelActiveFlowBody
    const sessionId = body.session_id

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id.' },
        { status: 400 }
      )
    }

    const { data: session, error: sessionError } = await supabase
      .from('active_flow_sessions')
      .select('id, user_id, status, source, source_id, title, city, metadata')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError) {
      console.error('[active-flow/cancel] Session fetch failed:', sessionError)

      return NextResponse.json(
        { error: 'Could not fetch active flow.' },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Flow not found.' },
        { status: 404 }
      )
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Completed flows cannot be cancelled.' },
        { status: 400 }
      )
    }

    if (session.status === 'cancelled') {
      return NextResponse.json(
        {
          session,
          message: 'Flow already cancelled.',
          source: session.source ?? null,
          sourceId: session.source_id ?? null,
        },
        { status: 200 }
      )
    }

    const now = new Date().toISOString()

    const { data: updatedSession, error: updateError } = await supabase
      .from('active_flow_sessions')
      .update({
        status: 'cancelled',
        updated_at: now,
      })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError || !updatedSession) {
      console.error('[active-flow/cancel] Cancel update failed:', updateError)

      return NextResponse.json(
        { error: 'Could not cancel flow.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        session: updatedSession,
        source: updatedSession.source ?? null,
        sourceId: updatedSession.source_id ?? null,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[active-flow/cancel] Unexpected error:', err)

    return NextResponse.json(
      { error: 'Unexpected error cancelling flow.' },
      { status: 500 }
    )
  }
}