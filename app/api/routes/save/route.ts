// app/api/routes/save/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveRoute } from '@/lib/supabase/routes'

type UUID = string & { __uuidBrand: never }

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Parse JSON body
    const body = await req.json()
    const { name, stops, city, slug, sourceUrl } = body

    // Validation
    if (!name || !Array.isArray(stops)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid data: "name" and "stops" are required',
        },
        { status: 400 }
      )
    }

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid slug' },
        { status: 400 }
      )
    }

    // Call database saver
    await saveRoute({
      userId: user.id as UUID,
      name,
      stops,
      city,
      slug,
      sourceUrl,
    })

    return NextResponse.json({ success: true, slug })
  } catch (error: any) {
    console.error('[API /routes/save] Error:', error?.message ?? error)

    return NextResponse.json(
      { success: false, message: error?.message ?? 'Unexpected server error' },
      { status: 500 }
    )
  }
}
