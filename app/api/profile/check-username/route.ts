import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const username = cleanUsername(searchParams.get('username'))

    if (!username) {
      return NextResponse.json(
        {
          available: false,
          error: 'Username must be 3–30 characters and contain only letters, numbers, or underscores.',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle()

    if (error) {
      console.error('Username availability lookup error:', error)

      return NextResponse.json(
        {
          available: false,
          error: 'Failed to check username',
          details: error.message,
        },
        { status: 500 }
      )
    }

    const available = !data || data.id === user.id

    return NextResponse.json(
      {
        username,
        available,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected username availability error:', error)

    return NextResponse.json(
      {
        available: false,
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function cleanUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')

  if (cleaned.length < 3 || cleaned.length > 30) return null

  return cleaned
}