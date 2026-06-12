import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

const founderAdminEmails = [
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
]

type SocialGroupInsertPayload = {
  name?: unknown
  slug?: unknown
  description?: unknown
  logo_url?: unknown
  logoUrl?: unknown
  owner_user_id?: unknown
  ownerUserId?: unknown
}

export async function GET() {
  try {
    const supabase = await supabaseServerApi()

    const { data, error } = await supabase
      .from('social_groups')
      .select('id, name, slug, description, logo_url, owner_user_id, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('Social groups fetch error:', error)

      return NextResponse.json(
        { error: 'Failed to load social groups', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ groups: data ?? [] })
  } catch (error) {
    console.error('Unexpected social groups GET error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerApi()
    const body = (await req.json()) as SocialGroupInsertPayload

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isFounderAdmin = user.email
      ? founderAdminEmails.includes(user.email.toLowerCase())
      : false

    if (!isFounderAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const requestedSlug = typeof body.slug === 'string' ? body.slug.trim() : ''
    const description =
      typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null

    const logoUrlRaw = body.logo_url ?? body.logoUrl
    const logo_url =
      typeof logoUrlRaw === 'string' && logoUrlRaw.trim().length > 0
        ? logoUrlRaw.trim()
        : null

    const ownerUserIdRaw = body.owner_user_id ?? body.ownerUserId
    const owner_user_id =
      typeof ownerUserIdRaw === 'string' && ownerUserIdRaw.trim().length > 0
        ? ownerUserIdRaw.trim()
        : user.id

    const slug = requestedSlug || slugify(name)

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    if (!slug) {
      return NextResponse.json({ error: 'Group slug is required' }, { status: 400 })
    }

    const { data: group, error: groupError } = await supabase
      .from('social_groups')
      .insert({
        name,
        slug,
        description,
        logo_url,
        owner_user_id,
      })
      .select('id, name, slug, description, logo_url, owner_user_id, created_at, updated_at')
      .single()

    if (groupError) {
      console.error('Social group insert error:', groupError)

      return NextResponse.json(
        {
          error: 'Failed to create social group',
          details: groupError.message,
        },
        { status: 500 }
      )
    }

    const { error: memberError } = await supabase
      .from('social_group_members')
      .upsert(
        {
          group_id: group.id,
          user_id: owner_user_id,
          role: 'owner',
        },
        {
          onConflict: 'group_id,user_id',
        }
      )

    if (memberError) {
      console.error('Social group owner member insert error:', memberError)

      return NextResponse.json(
        {
          error: 'Group created, but failed to assign owner membership',
          details: memberError.message,
          group,
        },
        { status: 207 }
      )
    }

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    console.error('Unexpected social groups POST error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}