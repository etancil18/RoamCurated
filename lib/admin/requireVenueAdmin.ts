import 'server-only'

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const ALLOWED_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

type AdminUser = {
  id: string
  email: string
}

type VenueAdminAuthResult =
  | {
      ok: true
      user: AdminUser
    }
  | {
      ok: false
      response: NextResponse
    }

export async function requireVenueAdmin(): Promise<VenueAdminAuthResult> {
  const supabase = await createServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'User not authenticated.' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    }
  }

  const email = user.email?.trim().toLowerCase() ?? ''

  if (!email || !ALLOWED_ADMIN_EMAILS.has(email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        {
          status: 403,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email,
    },
  }
}