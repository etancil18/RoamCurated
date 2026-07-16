import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

const SNAPSHOT_BUCKET = 'flow-snapshots'
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

const ALLOWED_SOURCE_TYPES = new Set([
  'active_flow',
  'hosted_flow',
])

const ALLOWED_STATUSES = new Set([
  'active',
  'completed',
  'cancelled',
  'partial',
])

const ALLOWED_VISIBILITIES = new Set([
  'public',
  'private',
])

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

type SnapshotVisibility = 'public' | 'private'

type ExistingSnapshotRow = {
  id: string
  visibility: SnapshotVisibility | null
  cover_image_url: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()

    const file = formData.get('file')
    const sourceType = stringValue(
      formData.get('source_type')
    )
    const sourceId = stringValue(
      formData.get('source_id')
    )
    const title = nullableStringValue(
      formData.get('title')
    )
    const city = nullableStringValue(
      formData.get('city')
    )
    const status =
      nullableStringValue(formData.get('status')) ??
      'completed'
    const routeSummary = nullableStringValue(
      formData.get('route_summary')
    )
    const requestedVisibility =
      nullableStringValue(formData.get('visibility')) ??
      'public'
    const checkedInCount =
      integerValue(formData.get('checked_in_count')) ??
      0
    const totalStops =
      integerValue(formData.get('total_stops')) ??
      0

    if (!isUploadedFile(file)) {
      return NextResponse.json(
        { error: 'Missing snapshot image file.' },
        { status: 400 }
      )
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: 'Snapshot image is empty.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            'Snapshot image is too large. The maximum size is 25 MB.',
        },
        { status: 400 }
      )
    }

    if (
      !file.type ||
      !ALLOWED_IMAGE_MIME_TYPES.has(file.type)
    ) {
      return NextResponse.json(
        {
          error:
            'Snapshot must be a PNG, JPEG, WebP, HEIC, or HEIF image.',
        },
        { status: 400 }
      )
    }

    if (
      !sourceType ||
      !ALLOWED_SOURCE_TYPES.has(sourceType)
    ) {
      return NextResponse.json(
        { error: 'Invalid source_type.' },
        { status: 400 }
      )
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: 'Missing source_id.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'Invalid snapshot status.' },
        { status: 400 }
      )
    }

    if (
      !ALLOWED_VISIBILITIES.has(
        requestedVisibility
      )
    ) {
      return NextResponse.json(
        { error: 'Invalid snapshot visibility.' },
        { status: 400 }
      )
    }

    if (
      checkedInCount < 0 ||
      totalStops < 0
    ) {
      return NextResponse.json(
        {
          error:
            'Snapshot stop counts cannot be negative.',
        },
        { status: 400 }
      )
    }

    if (
      totalStops > 0 &&
      checkedInCount > totalStops
    ) {
      return NextResponse.json(
        {
          error:
            'checked_in_count cannot exceed total_stops.',
        },
        { status: 400 }
      )
    }

    const {
      data: existingSnapshot,
      error: existingSnapshotError,
    } = await supabase
      .from('flow_snapshots')
      .select(
        'id, visibility, cover_image_url'
      )
      .eq('user_id', user.id)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .maybeSingle<ExistingSnapshotRow>()

    if (existingSnapshotError) {
      console.error(
        '[flow-snapshots/save] Existing snapshot lookup failed:',
        existingSnapshotError
      )

      return NextResponse.json(
        {
          error:
            'Failed to verify the existing snapshot.',
        },
        { status: 500 }
      )
    }

    /*
     * Preserve the user's existing visibility choice.
     *
     * This prevents re-saving a flow from automatically
     * re-publishing a snapshot the user previously made private.
     * New snapshots use the visibility supplied by the client.
     */
    const visibility: SnapshotVisibility =
      existingSnapshot?.visibility === 'private'
        ? 'private'
        : existingSnapshot?.visibility === 'public'
          ? 'public'
          : requestedVisibility === 'private'
            ? 'private'
            : 'public'

    const extension = extensionForMimeType(
      file.type
    )

    const storagePath =
      `${user.id}/${sourceType}/${sourceId}` +
      `/snapshot.${extension}`

    const previousStoragePath =
      extractStoragePathFromPublicUrl(
        existingSnapshot?.cover_image_url ?? null
      )

    const uploadBuffer = Buffer.from(
      await file.arrayBuffer()
    )

    const { error: uploadError } =
      await supabase.storage
        .from(SNAPSHOT_BUCKET)
        .upload(storagePath, uploadBuffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true,
        })

    if (uploadError) {
      console.error(
        '[flow-snapshots/save] Upload failed:',
        uploadError
      )

      return NextResponse.json(
        {
          error:
            'Failed to upload snapshot image.',
        },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(SNAPSHOT_BUCKET)
      .getPublicUrl(storagePath)

    const now = new Date().toISOString()

    const snapshotPayload = {
      user_id: user.id,
      source_type: sourceType,
      source_id: sourceId,
      title,
      city,
      status,
      cover_image_url: publicUrl,
      route_summary: routeSummary,
      checked_in_count: checkedInCount,
      total_stops: totalStops,
      visibility,
      updated_at: now,
    }

    const {
      data: snapshot,
      error: snapshotError,
    } = await supabase
      .from('flow_snapshots')
      .upsert(snapshotPayload as any, {
        onConflict:
          'user_id,source_type,source_id',
      })
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
      .single()

    if (snapshotError || !snapshot) {
      console.error(
        '[flow-snapshots/save] Snapshot upsert failed:',
        snapshotError
      )

      /*
       * Only remove the uploaded object when this was a new
       * snapshot. For an existing snapshot, the upload may have
       * overwritten its previous object and deleting it would
       * make the existing database record point to a missing file.
       */
      if (!existingSnapshot) {
        const { error: cleanupError } =
          await supabase.storage
            .from(SNAPSHOT_BUCKET)
            .remove([storagePath])

        if (cleanupError) {
          console.error(
            '[flow-snapshots/save] Failed to clean up orphaned upload:',
            cleanupError
          )
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to save snapshot.',
          details:
            snapshotError?.message ??
            'Snapshot row was not returned.',
        },
        { status: 500 }
      )
    }

    /*
     * Remove an older file only when the MIME type changed and
     * therefore produced a different extension/path.
     */
    if (
      previousStoragePath &&
      previousStoragePath !== storagePath
    ) {
      const { error: previousFileDeleteError } =
        await supabase.storage
          .from(SNAPSHOT_BUCKET)
          .remove([previousStoragePath])

      if (previousFileDeleteError) {
        console.warn(
          '[flow-snapshots/save] Previous snapshot file cleanup failed:',
          previousFileDeleteError
        )
      }
    }

    return NextResponse.json(
      {
        snapshot,
        coverImageUrl: publicUrl,
        saved: true,
        created: !existingSnapshot,
        visibilityPreserved:
          Boolean(existingSnapshot),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error(
      '[flow-snapshots/save] Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected error saving snapshot.',
        details:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function isUploadedFile(
  value: unknown
): value is Blob {
  return (
    value instanceof Blob &&
    typeof value.size === 'number' &&
    typeof value.type === 'string' &&
    typeof value.arrayBuffer === 'function'
  )
}

function stringValue(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function nullableStringValue(
  value: FormDataEntryValue | null
): string | null {
  return stringValue(value)
}

function integerValue(
  value: FormDataEntryValue | null
): number | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isInteger(parsed)
    ? parsed
    : null
}

function extensionForMimeType(
  mimeType: string
): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg'
  }

  if (mimeType === 'image/webp') {
    return 'webp'
  }

  if (mimeType === 'image/png') {
    return 'png'
  }

  if (mimeType === 'image/heic') {
    return 'heic'
  }

  if (mimeType === 'image/heif') {
    return 'heif'
  }

  return 'png'
}

function extractStoragePathFromPublicUrl(
  publicUrl: string | null
): string | null {
  if (!publicUrl) {
    return null
  }

  try {
    const url = new URL(publicUrl)

    const marker =
      `/storage/v1/object/public/` +
      `${SNAPSHOT_BUCKET}/`

    const markerIndex =
      url.pathname.indexOf(marker)

    if (markerIndex === -1) {
      return null
    }

    const encodedPath =
      url.pathname.slice(
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