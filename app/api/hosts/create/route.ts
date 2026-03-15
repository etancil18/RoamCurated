import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

async function geocodeAddress(address: string) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  if (!token) {
    console.warn('Missing Mapbox token — skipping geocoding')
    return null
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?limit=1&access_token=${token}`

  const res = await fetch(url)

  if (!res.ok) return null

  const data = await res.json()

  if (!data.features?.length) return null

  const [lon, lat] = data.features[0].center

  return { lat, lon }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()

    const { name, city, address, website } = await req.json()

    if (!name || !city || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const normalizedCity = city.toLowerCase().trim()
    const slug = slugify(name)

    // Geocode address
    const coords = await geocodeAddress(address)

    const lat = coords?.lat ?? null
    const lon = coords?.lon ?? null

    const { data, error } = await supabase
      .from('properties')
      .insert({
        name,
        slug,
        city: normalizedCity,
        address,
        website: website ?? null,
        lat,
        lon,
      })
      .select()
      .single()

    if (error) {
      console.error('Property insert error:', error)

      return NextResponse.json(
        { error: 'Failed to create property' },
        { status: 500 }
      )
    }

    const url = `/property/${normalizedCity}/${slug}`

    return NextResponse.json({
      success: true,
      url,
      property: data,
    })
  } catch (err) {
    console.error('Host creation error:', err)

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    )
  }
}