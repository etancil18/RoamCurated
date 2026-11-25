
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

// =====================================================
// CONTEXT SLIDES — EXPORT DATA CONTRACT
// =====================================================

type ExportItem = {
  id: string
  position: number
  [key: string]: unknown
}

type ExportContextSlide = {
  id: string
  after_item_id: string
  position: number
  heading: string | null
  body: string
  image_source: 'none' | 'venue_cover' | 'creator_media'
  creator_media_id: string | null
  image_url: string | null
}

type ExportSlide =
  | { kind: 'cover'; id: string }
  | {
      kind: 'venue'
      id: string
      item_id: string
    }
  | {
      kind: 'context'
      id: string
      context_id: string
      item_id: string
      page_number: number
      page_count: number
      body: string
    }
  | { kind: 'closing'; id: string }

// =====================================================
// CONTEXT SLIDES — PRODUCTION-MATCHED EXPORT SEQUENCE
//
// One saved context record = exactly one export slide.
//
// This matches the published RoamEditionReader and the
// updated RoamEditionSlidePreview component.
//
// Instagram and TikTok retain their individual output
// dimensions, but neither preset changes slide count.
//
// Cover → Venue → Context(s) → Venue → Closing
//
// page_number and page_count remain in the manifest
// for compatibility with its existing data contract,
// but are always 1 for each context slide.
// =====================================================

function buildExportSlides(
  items: ExportItem[],
  contexts: ExportContextSlide[],
): ExportSlide[] {
  const contextsByItem = new Map<
    string,
    ExportContextSlide[]
  >()

  for (const context of contexts) {
    const existing =
      contextsByItem.get(context.after_item_id) ?? []

    existing.push(context)
    contextsByItem.set(context.after_item_id, existing)
  }

  for (const group of contextsByItem.values()) {
    group.sort(
      (a, b) =>
        a.position - b.position ||
        a.id.localeCompare(b.id),
    )
  }

  const slides: ExportSlide[] = [
    { kind: 'cover', id: 'cover' },
  ]

  for (const item of items) {
    slides.push({
      kind: 'venue',
      id: item.id,
      item_id: item.id,
    })

    for (
      const context of
      contextsByItem.get(item.id) ?? []
    ) {
      // One context record produces one complete slide.
      // No text splitting or additional page generation.
      slides.push({
        kind: 'context',
        id: `context-${context.id}`,
        context_id: context.id,
        item_id: item.id,
        page_number: 1,
        page_count: 1,
        body: context.body,
      })
    }
  }

  slides.push({
    kind: 'closing',
    id: 'closing',
  })

  return slides
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
    // EXPORT PERMISSION GATE — PRESERVED
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
    // LOAD EDITORIAL DATA — ADD CONTEXT SLIDES ONLY
    // =====================================================

    const base =
      `/api/venue-admin/editorial/${encodeURIComponent(
        editionId,
      )}`

    const [
      editionResponse,
      itemsResponse,
      attributionResponse,
      contextsResponse,
    ] = await Promise.all([
      fetchEditorialData<{
        edition: Record<string, unknown>
      }>(request, base),

      fetchEditorialData<{
        items: ExportItem[]
      }>(request, `${base}/items`),

      fetchEditorialData<{
        attribution: Record<string, unknown>
      }>(request, `${base}/attribution`),

      // The existing context API performs the
      // creator/collection/venue media eligibility check.
      fetchEditorialData<{
        slides: ExportContextSlide[]
      }>(request, `${base}/context-slides`),
    ])

    if (
      !editionResponse.edition ||
      !Array.isArray(itemsResponse.items) ||
      !attributionResponse.attribution ||
      !Array.isArray(contextsResponse.slides)
    ) {
      return json(
        { error: 'Incomplete editorial export data.' },
        500,
      )
    }

    const orderedItems = [
      ...itemsResponse.items,
    ].sort(
      (a, b) =>
        a.position - b.position ||
        a.id.localeCompare(b.id),
    )

    // =====================================================
    // CONTEXT SLIDES — SAME-EDITION INTEGRITY
    //
    // The context API has already checked media eligibility.
    // Verify its returned slide structure and membership
    // before putting anything into an export manifest.
    // =====================================================

    const itemIds = new Set(
      orderedItems.map((item) => item.id),
    )

    const orderedContexts: ExportContextSlide[] = []

    for (const slide of contextsResponse.slides) {
      if (
        !UUID_PATTERN.test(slide.id) ||
        !itemIds.has(slide.after_item_id) ||
        !Number.isInteger(slide.position) ||
        slide.position < 0 ||
        typeof slide.body !== 'string' ||
        slide.body.trim().length < 1 ||
        slide.body.trim().length > 1500 ||
        !(
          slide.heading === null ||
          (
            typeof slide.heading === 'string' &&
            slide.heading.trim().length <= 160
          )
        ) ||
        ![
          'none',
          'venue_cover',
          'creator_media',
        ].includes(slide.image_source)
      ) {
        return json(
          {
            error:
              'Invalid context-slide data in export manifest.',
          },
          500,
        )
      }

      // If a previously selected photo is no longer
      // eligible, the context API returns no public image
      // URL. The preview uses the canonical venue cover.
      orderedContexts.push({
        id: slide.id,
        after_item_id: slide.after_item_id,
        position: slide.position,
        heading: slide.heading,
        body: slide.body,
        image_source: slide.image_source,
        creator_media_id:
          slide.image_source === 'creator_media' &&
          typeof slide.image_url === 'string'
            ? slide.creator_media_id
            : null,
        image_url:
          slide.image_source === 'creator_media' &&
          typeof slide.image_url === 'string'
            ? slide.image_url
            : null,
      })
    }

    orderedContexts.sort((a, b) => {
      const aIndex = orderedItems.findIndex(
        (item) => item.id === a.after_item_id,
      )
      const bIndex = orderedItems.findIndex(
        (item) => item.id === b.after_item_id,
      )

      return (
        aIndex - bIndex ||
        a.position - b.position ||
        a.id.localeCompare(b.id)
      )
    })

    // =====================================================
    // CONTEXT SLIDES — EXACT PRODUCTION SLIDE COUNT
    //
    // Cover + all venues + all context records + closing.
    //
    // Each context record contributes exactly one slide,
    // independently of the Instagram/TikTok preset.
    // =====================================================

    const orderedSlides = buildExportSlides(
      orderedItems,
      orderedContexts,
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
        slide_count: orderedSlides.length,
        permission_verified: true,
        edition: editionResponse.edition,
        items: orderedItems,
        context_slides: orderedContexts,
        slides: orderedSlides,
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
