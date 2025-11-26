// app/api/routes/save/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { saveRoute } from '@/lib/supabase/routes'
import { RouteStopsArraySchema } from '@/validators/favorite' // <-- REUSE YOUR SCHEMA
import { z } from 'zod'

type UUID = string & { __uuidBrand: never }

// Normalize "type" to a string
function normalizeType(type: any): string | undefined {
  if (!type) return undefined
  if (typeof type === 'string') return type
  if (Array.isArray(type)) return type.join(', ')
  if (typeof type === 'object') return Object.values(type).join(', ')
  return undefined
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

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

    const body = await req.json()
    const { name, stops, city, slug, sourceUrl } = body

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Missing route name' },
        { status: 400 }
      )
    }

    if (!Array.isArray(stops)) {
      return NextResponse.json(
        { success: false, message: '"stops" must be an array' },
        { status: 400 }
      )
    }

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid slug' },
        { status: 400 }
      )
    }

    // 🔥 Normalize each stop BEFORE Zod validation
    const cleanedStops = stops.map((s: any) => ({
      name: s.name,
      lat: Number(s.lat),
      lon: Number(s.lon),
      type: normalizeType(s.type),
      image_url: typeof s.image_url === 'string' ? s.image_url : null,
    }))

    // 🔐 Validate cleaned stops with Zod
    const parsed = RouteStopsArraySchema.safeParse(cleanedStops)

    if (!parsed.success) {
      console.error('[saveRoute] Invalid stops:', parsed.error.format())
      return NextResponse.json(
        { success: false, message: 'Invalid stop structure' },
        { status: 400 }
      )
    }

    // 💾 Save to Supabase
    await saveRoute({
      userId: user.id as UUID,
      name,
      stops: parsed.data,
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
