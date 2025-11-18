import { NextResponse } from 'next/server'
import { getVenueBySlug } from '@/lib/supabase/venues'
import { addVenueToFavorites } from '@/lib/supabase/favorites'
import { z } from 'zod'

type UUID = string & { __uuidBrand: never }

const requestSchema = z.object({
  slug: z.string(),
  venue_id: z.string(),
  data: z.object({
    name: z.string(),
    lat: z.number(),
    lon: z.number(),
    instagram_handle: z.string().nullable().optional(),
    type: z.string().optional(),
    image_url: z.string().nullable().optional(),
    vibe_tags: z.array(z.string()).optional(),
    price_tier: z.number().optional(),
    city: z.string().optional(),
  }),
})

function validate_uuid(uuid: string): uuid is UUID {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)
}

export async function POST(req: Request) {
  try {
    const { supabase, userId } = await (async () => {
      const supabase = await import('@/lib/supabase/server').then(m => m.createServerClient())
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error) throw new Error(`Auth error: ${error.message}`)
      if (!user) throw new Error('User not authenticated')

      return { supabase, userId: user.id as UUID }
    })()

    const body = await req.json()
    const parse = requestSchema.safeParse(body)

    if (!parse.success) {
      console.warn('❌ Validation error in request body:', parse.error.flatten())
      return NextResponse.json(
        { success: false, message: 'invalid_request_format' },
        { status: 400 }
      )
    }

    const { slug, venue_id, data } = parse.data
    const venue = await getVenueBySlug(slug)

    let finalVenueId: UUID
    let finalVenueData = data
    let finalCity: string | null = data.city ?? null

    if (venue && validate_uuid(venue.id)) {
      finalVenueId = venue.id as UUID
      finalCity = venue.city ?? finalCity
    } else {
      if (!validate_uuid(venue_id)) {
        console.warn('⚠️ fallback venue_id is not a UUID:', venue_id)
        return NextResponse.json(
          { success: false, message: 'invalid_fallback_venue_id' },
          { status: 422 }
        )
      }
      finalVenueId = venue_id as UUID
    }

    const result = await addVenueToFavorites({
      userId,
      venueId: finalVenueId,
      venueData: finalVenueData,
      city: finalCity,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[api/favorites/add] error:', error.message || error)
    return NextResponse.json(
      { success: false, message: error.message || 'unexpected_error' },
      { status: 500 }
    )
  }
}
