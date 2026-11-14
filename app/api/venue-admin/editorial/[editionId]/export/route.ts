
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = {
  params: Promise<{ editionId: string }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// =====================================================
// SOCIAL EXPORT — PLATFORM PRESETS
// =====================================================

type ExportPreset = 'instagram' | 'tiktok'

const EXPORT_PRESETS: Record<
  ExportPreset,
  { width: number; height: number }
> = {
  instagram: {
    width: 1080,
    height: 1350,
  },
  tiktok: {
    width: 1080,
    height: 1920,
  },
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

async function fetchEditorialData<T>(
  request: Request,
  path: string,
): Promise<T> {
  const url = new URL(path, request.url)

  // Preserve the current admin session when calling
  // the existing, authenticated editorial endpoints.
  const headers = new Headers()

  const cookie = request.headers.get('cookie')
  const authorization =
    request.headers.get('authorization')

  if (cookie) {
    headers.set('cookie', cookie)
  }

  if (authorization) {
    headers.set('authorization', authorization)
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  const payload: unknown = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new Error(
      `Editorial data request failed (${response.status}): ${path}`,
    )
  }

  return payload as T
}

export async function GET(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const { editionId } = await context.params

    if (!UUID_PATTERN.test(editionId)) {
      return json(
        { error: 'Invalid edition ID.' },
        400,
      )
    }

    // =====================================================
    // SOCIAL EXPORT — RESOLVE REQUESTED PRESET
    // =====================================================

    const requestedPreset =
      new URL(request.url).searchParams.get('preset') ??
      'instagram'

    if (
      requestedPreset !== 'instagram' &&
      requestedPreset !== 'tiktok'
    ) {
      return json(
        {
          error:
            'Invalid export preset. Use instagram or tiktok.',
        },
        400,
      )
    }

    const preset = requestedPreset as ExportPreset
    const dimensions = EXPORT_PRESETS[preset]

    // =====================================================
    // EXPORT PERMISSION GATE
    // =====================================================

    const { data: editionRecord, error: editionError } =
      await supabaseAdmin
        .from('roam_editorial_editions')
        .select(
          'id, featured_creator_id, source_collection_id, creator_permission_status',
        )
        .eq('id', editionId)
        .maybeSingle()

    if (editionError) {
      console.error(
        '[editorial/export] Edition lookup failed:',
        editionError,
      )

      return json(
        { error: 'Unable to verify edition permissions.' },
        500,
      )
    }

    if (!editionRecord) {
      return json(
        { error: 'Edition not found.' },
        404,
      )
    }

    const usesCreatorSource =
      Boolean(editionRecord.featured_creator_id) ||
      Boolean(editionRecord.source_collection_id)

    if (
      usesCreatorSource &&
      editionRecord.creator_permission_status !== 'approved'
    ) {
      return json(
        {
          error:
            'Creator permission must be approved before exporting this edition.',
        },
        403,
      )
    }

    // =====================================================
    // LOAD THE SAME DATA USED BY THE APPROVED PREVIEW
    // =====================================================

    const base =
      `/api/venue-admin/editorial/${encodeURIComponent(
        editionId,
      )}`

    const [
      editionResponse,
      itemsResponse,
      attributionResponse,
    ] = await Promise.all([
      fetchEditorialData<{
        edition: Record<string, unknown>
      }>(request, base),

      fetchEditorialData<{
        items: Array<{
          id: string
          position: number
          [key: string]: unknown
        }>
      }>(request, `${base}/items`),

      fetchEditorialData<{
        attribution: Record<string, unknown>
      }>(request, `${base}/attribution`),
    ])

    if (
      !editionResponse.edition ||
      !Array.isArray(itemsResponse.items) ||
      !attributionResponse.attribution
    ) {
      return json(
        { error: 'Incomplete editorial export data.' },
        500,
      )
    }

    const orderedItems = [
      ...itemsResponse.items,
    ].sort(
      (a, b) => a.position - b.position,
    )

    // =====================================================
    // RETURN VERIFIED, ORDERED EXPORT MANIFEST
    // =====================================================

    return json({
      export: {
        edition_id: editionId,
        width: dimensions.width,
        height: dimensions.height,
        format: 'png',
        slide_count: orderedItems.length + 2,
        permission_verified: true,
        edition: editionResponse.edition,
        items: orderedItems,
        attribution: attributionResponse.attribution,
      },
    })
  } catch (error) {
    console.error(
      '[editorial/export] Unexpected error:',
      error,
    )

    return json(
      {
        error: 'Unable to prepare editorial export.',
      },
      500,
    )
  }
}
