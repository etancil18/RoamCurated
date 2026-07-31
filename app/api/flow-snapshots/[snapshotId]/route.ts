import { NextRequest, NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'

const SNAPSHOT_BUCKET = 'flow-snapshots'
const ALLOWED_VISIBILITIES = new Set(['public', 'private'])

type SnapshotVisibility = 'public' | 'private'

type RouteContext = {
  params: Promise<{
    snapshotId: string
  }>
}

type UpdateSnapshotBody = {
  visibility?: unknown
}

type SnapshotRow = {
  id: string
  user_id: string
  source_type: string
  source_id: string
  title: string | null
  city: string | null
  status: string
  cover_image_url: string | null
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  visibility: SnapshotVisibility
  created_at: string
  updated_at: string | null
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { snapshotId } = await context.params

    if (!snapshotId?.trim()) {
      return NextResponse.json(
        { error: 'Missing snapshot ID.' },
        { status: 400 }
      )
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: snapshot, error } = await supabase
      .from('flow_snapshots')
      .select(`
        id,
        user_id,
        source_type,
        source_id,
        title,
        city,
        status,
        cover_image_url,
        route_summary,
        checked_in_count,
        total_stops,
        visibility,
        created_at,
        updated_at
      `)
      .eq('id', snapshotId)
      .eq('user_id', user.id)
      .maybeSingle<SnapshotRow>()

    if (error) {
      console.error(
        '[flow-snapshots/[snapshotId]][GET] Snapshot fetch failed:',
        error
      )

      return NextResponse.json(
        { error: 'Failed to load snapshot.' },
        { status: 500 }
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { snapshot },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      '[flow-snapshots/[snapshotId]][GET] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error: 'Unexpected error loading snapshot.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { snapshotId } = await context.params

    if (!snapshotId?.trim()) {
      return NextResponse.json(
        { error: 'Missing snapshot ID.' },
        { status: 400 }
      )
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = (await request
      .json()
      .catch(() => ({}))) as UpdateSnapshotBody

    const visibility = normalizeVisibility(body.visibility)

    if (!visibility) {
      return NextResponse.json(
        {
          error:
            'Visibility must be either "public" or "private".',
        },
        { status: 400 }
      )
    }

    const { data: existingSnapshot, error: existingError } =
      await supabase
        .from('flow_snapshots')
        .select('id, visibility')
        .eq('id', snapshotId)
        .eq('user_id', user.id)
        .maybeSingle<{
          id: string
          visibility: SnapshotVisibility
        }>()

    if (existingError) {
      console.error(
        '[flow-snapshots/[snapshotId]][PATCH] Ownership check failed:',
        existingError
      )

      return NextResponse.json(
        { error: 'Failed to verify snapshot ownership.' },
        { status: 500 }
      )
    }

    if (!existingSnapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found.' },
        { status: 404 }
      )
    }

    if (existingSnapshot.visibility === visibility) {
      const { data: unchangedSnapshot, error: unchangedError } =
        await supabase
          .from('flow_snapshots')
          .select(`
            id,
            user_id,
            source_type,
            source_id,
            title,
            city,
            status,
            cover_image_url,
            route_summary,
            checked_in_count,
            total_stops,
            visibility,
            created_at,
            updated_at
          `)
          .eq('id', snapshotId)
          .eq('user_id', user.id)
          .single<SnapshotRow>()

      if (unchangedError || !unchangedSnapshot) {
        console.error(
          '[flow-snapshots/[snapshotId]][PATCH] Unchanged snapshot fetch failed:',
          unchangedError
        )

        return NextResponse.json(
          { error: 'Failed to load updated snapshot.' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          snapshot: unchangedSnapshot,
          updated: false,
        },
        { status: 200 }
      )
    }

    const { data: snapshot, error: updateError } =
      await supabase
        .from('flow_snapshots')
        .update({
          visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', snapshotId)
        .eq('user_id', user.id)
        .select(`
          id,
          user_id,
          source_type,
          source_id,
          title,
          city,
          status,
          cover_image_url,
          route_summary,
          checked_in_count,
          total_stops,
          visibility,
          created_at,
          updated_at
        `)
        .maybeSingle<SnapshotRow>()

    if (updateError) {
      console.error(
        '[flow-snapshots/[snapshotId]][PATCH] Visibility update failed:',
        updateError
      )

      return NextResponse.json(
        { error: 'Failed to update snapshot visibility.' },
        { status: 500 }
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found.' },
        { status: 404 }
      )
    }

    await safelyRefreshCreatorReputation(
      user.id,
      {
        mutation:
          visibility === 'public'
            ? 'flow_snapshot_published'
            : 'flow_snapshot_unpublished',

        rankingRefreshMode:
          'affected',

        calculatedAt:
          snapshot.updated_at ??
          new Date().toISOString(),
      }
    )

    return NextResponse.json(
      {
        snapshot,
        updated: true,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      '[flow-snapshots/[snapshotId]][PATCH] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error: 'Unexpected error updating snapshot.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { snapshotId } = await context.params

    if (!snapshotId?.trim()) {
      return NextResponse.json(
        { error: 'Missing snapshot ID.' },
        { status: 400 }
      )
    }

    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: snapshot, error: snapshotError } =
      await supabase
        .from('flow_snapshots')
        .select(`
          id,
          user_id,
          source_type,
          source_id,
          cover_image_url,
          visibility
        `)
        .eq('id', snapshotId)
        .eq('user_id', user.id)
        .maybeSingle<{
          id: string
          user_id: string
          source_type: string
          source_id: string
          cover_image_url: string | null
          visibility: SnapshotVisibility
        }>()

    if (snapshotError) {
      console.error(
        '[flow-snapshots/[snapshotId]][DELETE] Snapshot fetch failed:',
        snapshotError
      )

      return NextResponse.json(
        { error: 'Failed to verify snapshot ownership.' },
        { status: 500 }
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found.' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('flow_snapshots')
      .delete()
      .eq('id', snapshotId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error(
        '[flow-snapshots/[snapshotId]][DELETE] Database delete failed:',
        deleteError
      )

      return NextResponse.json(
        { error: 'Failed to delete snapshot.' },
        { status: 500 }
      )
    }

    if (snapshot.visibility === 'public') {
      await safelyRefreshCreatorReputation(
        user.id,
        {
          mutation:
            'public_flow_snapshot_deleted',

          rankingRefreshMode:
            'affected',
        }
      )
    }

    const storagePaths = buildPossibleStoragePaths({
      userId: user.id,
      sourceType: snapshot.source_type,
      sourceId: snapshot.source_id,
      coverImageUrl: snapshot.cover_image_url,
    })

    let storageDeleted = true

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(SNAPSHOT_BUCKET)
        .remove(storagePaths)

      if (storageError) {
        storageDeleted = false

        console.error(
          '[flow-snapshots/[snapshotId]][DELETE] Storage cleanup failed:',
          storageError
        )
      }
    }

    return NextResponse.json(
      {
        deleted: true,
        snapshotId,
        storageDeleted,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      '[flow-snapshots/[snapshotId]][DELETE] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error: 'Unexpected error deleting snapshot.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function normalizeVisibility(
  value: unknown
): SnapshotVisibility | null {
  if (
    typeof value !== 'string' ||
    !ALLOWED_VISIBILITIES.has(value)
  ) {
    return null
  }

  return value as SnapshotVisibility
}

function buildPossibleStoragePaths({
  userId,
  sourceType,
  sourceId,
  coverImageUrl,
}: {
  userId: string
  sourceType: string
  sourceId: string
  coverImageUrl: string | null
}): string[] {
  const paths = new Set<string>()

  const pathFromPublicUrl =
    extractStoragePathFromPublicUrl(coverImageUrl)

  if (pathFromPublicUrl) {
    paths.add(pathFromPublicUrl)
  }

  const basePath = `${userId}/${sourceType}/${sourceId}/snapshot`

  paths.add(`${basePath}.png`)
  paths.add(`${basePath}.jpg`)
  paths.add(`${basePath}.jpeg`)
  paths.add(`${basePath}.webp`)
  paths.add(`${basePath}.heic`)
  paths.add(`${basePath}.heif`)

  return [...paths]
}

function extractStoragePathFromPublicUrl(
  publicUrl: string | null
): string | null {
  if (!publicUrl) return null

  try {
    const url = new URL(publicUrl)

    const marker = `/storage/v1/object/public/${SNAPSHOT_BUCKET}/`
    const markerIndex = url.pathname.indexOf(marker)

    if (markerIndex === -1) {
      return null
    }

    const encodedPath = url.pathname.slice(
      markerIndex + marker.length
    )

    if (!encodedPath) {
      return null
    }

    return decodeURIComponent(encodedPath)
  } catch {
    return null
  }
}