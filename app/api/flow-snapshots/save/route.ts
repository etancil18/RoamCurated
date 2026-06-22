import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'

const SNAPSHOT_BUCKET = 'flow-snapshots'
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const ALLOWED_SOURCE_TYPES = new Set(['active_flow', 'hosted_flow'])
const ALLOWED_STATUSES = new Set(['active', 'completed', 'cancelled', 'partial'])
const ALLOWED_VISIBILITIES = new Set(['public', 'private'])

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerApi()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()

    const file = formData.get('file')
    const sourceType = stringValue(formData.get('source_type'))
    const sourceId = stringValue(formData.get('source_id'))
    const title = nullableStringValue(formData.get('title'))
    const city = nullableStringValue(formData.get('city'))
    const status = nullableStringValue(formData.get('status')) ?? 'completed'
    const routeSummary = nullableStringValue(formData.get('route_summary'))
    const visibility = nullableStringValue(formData.get('visibility')) ?? 'public'
    const checkedInCount = numberValue(formData.get('checked_in_count')) ?? 0
    const totalStops = numberValue(formData.get('total_stops')) ?? 0

    if (!(file instanceof File)) {
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
        { error: 'Snapshot image is too large.' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Snapshot must be an image.' },
        { status: 400 }
      )
    }

    if (!sourceType || !ALLOWED_SOURCE_TYPES.has(sourceType)) {
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

    if (!ALLOWED_VISIBILITIES.has(visibility)) {
      return NextResponse.json(
        { error: 'Invalid snapshot visibility.' },
        { status: 400 }
      )
    }

    const extension = extensionForMimeType(file.type)
    const storagePath = `${user.id}/${sourceType}/${sourceId}/snapshot.${extension}`

    const uploadBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(SNAPSHOT_BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[flow-snapshots/save] Upload failed:', uploadError)

      return NextResponse.json(
        { error: 'Failed to upload snapshot image.' },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(SNAPSHOT_BUCKET)
      .getPublicUrl(storagePath)

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
    }

    const { data: snapshot, error: snapshotError } = await supabase
      .from('flow_snapshots')
      .upsert(snapshotPayload as any, {
        onConflict: 'user_id,source_type,source_id',
      })
      .select('*')
      .single()

    if (snapshotError || !snapshot) {
      console.error('[flow-snapshots/save] Snapshot upsert failed:', snapshotError)

      return NextResponse.json(
        { error: 'Failed to save snapshot.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        snapshot,
        coverImageUrl: publicUrl,
        saved: true,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[flow-snapshots/save] Unexpected error:', error)

    return NextResponse.json(
      {
        error: 'Unexpected error saving snapshot.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function stringValue(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nullableStringValue(value: FormDataEntryValue | null): string | null {
  return stringValue(value)
}

function numberValue(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'

  return 'png'
}