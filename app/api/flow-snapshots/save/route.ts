import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { safelyRefreshCreatorReputation } from '@/lib/reputation/safelyRefreshCreatorReputation'
import {
  getRoamHistorySourceWindow,
  loadQualifyingRoamDays,
} from '@/lib/roam/loadQualifyingRoamDays'

const SNAPSHOT_BUCKET = 'flow-snapshots'
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

const ALLOWED_SOURCE_TYPES = new Set([
  'active_flow',
  'hosted_flow',
  'roam_history',
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

type SnapshotStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'partial'

type ExistingSnapshotRow = {
  id: string
  visibility: SnapshotVisibility | null
  cover_image_url: string | null
}

type ActiveFlowSnapshotSourceRow = {
  id: string
  title: string | null
  city: string | null
  status: string
  venue_ids: unknown
}

type HostedFlowSnapshotSourceRow = {
  id: string
  creator_id: string
  title: string
  city: string | null
  venue_ids: unknown
}

type CanonicalSnapshotSource = {
  title: string | null
  city: string | null
  status: SnapshotStatus
  venueIds: string[]
  checkedInCount: number
  totalStops: number
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
     * Replay initiative:
     *
     * Resolve canonical snapshot evidence from the source on
     * every save.
     *
     * Active-flow snapshots resolve from:
     *   active_flow_sessions
     *   active_flow_progress
     *
     * Hosted-flow snapshots resolve from:
     *   crawl_events
     *   crawl_progress
     *
     * Roam-history snapshots resolve from:
     *   append-only venue_visits
     *   through the canonical qualifying-roam loader
     *
     * Only newly created snapshots persist immutable ordered
     * flow_snapshot_stops. Existing snapshot stops are never
     * rewritten during a re-save.
     */
    let canonicalSource: CanonicalSnapshotSource | null =
      null

    if (sourceType === 'active_flow') {
      const {
        data: sourceFlow,
        error: sourceFlowError,
      } = await supabase
        .from('active_flow_sessions')
        .select(
          'id, title, city, status, venue_ids'
        )
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .maybeSingle<ActiveFlowSnapshotSourceRow>()

      if (sourceFlowError) {
        console.error(
          '[flow-snapshots/save] Active-flow source lookup failed:',
          sourceFlowError
        )

        return NextResponse.json(
          {
            error:
              'Failed to verify the source flow.',
          },
          { status: 500 }
        )
      }

      if (!sourceFlow) {
        return NextResponse.json(
          {
            error:
              'The source flow was not found.',
          },
          { status: 404 }
        )
      }

      const venueIds =
        normalizeCanonicalSnapshotVenueIds(
          sourceFlow.venue_ids
        )

      if (
        !venueIds ||
        venueIds.length < 2
      ) {
        return NextResponse.json(
          {
            error:
              'The source flow does not contain a valid replayable route.',
          },
          { status: 400 }
        )
      }

      const {
        data: progressRows,
        error: progressError,
      } = await supabase
        .from('active_flow_progress')
        .select('stop_index')
        .eq('session_id', sourceId)
        .eq('user_id', user.id)

      if (progressError) {
        console.error(
          '[flow-snapshots/save] Active-flow progress lookup failed:',
          progressError
        )

        return NextResponse.json(
          {
            error:
              'Failed to verify the source flow progress.',
          },
          { status: 500 }
        )
      }

      const canonicalCheckedInCount =
        countCanonicalCompletedStops(
          progressRows,
          venueIds.length
        )

      const canonicalStatus =
        normalizeActiveFlowSnapshotStatus(
          sourceFlow.status,
          canonicalCheckedInCount
        )

      if (!canonicalStatus) {
        console.error(
          '[flow-snapshots/save] Active-flow source returned an invalid status:',
          sourceFlow.status
        )

        return NextResponse.json(
          {
            error:
              'The source flow has an invalid status.',
          },
          { status: 500 }
        )
      }

      canonicalSource = {
        title:
          normalizeNullableSourceText(
            sourceFlow.title
          ),
        city:
          normalizeNullableSourceText(
            sourceFlow.city
          ),
        status:
          canonicalStatus,
        venueIds,
        checkedInCount:
          canonicalCheckedInCount,
        totalStops:
          venueIds.length,
      }
    }

    if (sourceType === 'hosted_flow') {
      const {
        data: sourceFlow,
        error: sourceFlowError,
      } = await supabase
        .from('crawl_events')
        .select(
          'id, creator_id, title, city, venue_ids'
        )
        .eq('id', sourceId)
        .eq('creator_id', user.id)
        .maybeSingle<HostedFlowSnapshotSourceRow>()

      if (sourceFlowError) {
        console.error(
          '[flow-snapshots/save] Hosted-flow source lookup failed:',
          sourceFlowError
        )

        return NextResponse.json(
          {
            error:
              'Failed to verify the hosted flow source.',
          },
          { status: 500 }
        )
      }

      if (!sourceFlow) {
        return NextResponse.json(
          {
            error:
              'The hosted flow source was not found.',
          },
          { status: 404 }
        )
      }

      const venueIds =
        normalizeCanonicalSnapshotVenueIds(
          sourceFlow.venue_ids
        )

      if (
        !venueIds ||
        venueIds.length < 2
      ) {
        return NextResponse.json(
          {
            error:
              'The hosted flow does not contain a valid replayable route.',
          },
          { status: 400 }
        )
      }

      const {
        data: progressRows,
        error: progressError,
      } = await supabase
        .from('crawl_progress')
        .select('stop_index')
        .eq('crawl_id', sourceId)
        .eq('user_id', user.id)

      if (progressError) {
        console.error(
          '[flow-snapshots/save] Hosted-flow progress lookup failed:',
          progressError
        )

        return NextResponse.json(
          {
            error:
              'Failed to verify the hosted flow progress.',
          },
          { status: 500 }
        )
      }

      const canonicalCheckedInCount =
        countCanonicalCompletedStops(
          progressRows,
          venueIds.length
        )

      canonicalSource = {
        title:
          normalizeNullableSourceText(
            sourceFlow.title
          ),
        city:
          normalizeNullableSourceText(
            sourceFlow.city
          ),
        status:
          deriveHostedFlowSnapshotStatus({
            checkedInCount:
              canonicalCheckedInCount,
            totalStops:
              venueIds.length,
          }),
        venueIds,
        checkedInCount:
          canonicalCheckedInCount,
        totalStops:
          venueIds.length,
      }
    }

    /*
     * Roam history:
     *
     * The client submits only the stable roam source identifier.
     * It cannot submit or control the canonical venue set.
     *
     * First reconstruct the exact 03:00 -> 03:00 source window
     * represented by source_id. Then ask the canonical loader to
     * qualify only that historical window.
     *
     * This avoids depending on the loader's normal result limit
     * and guarantees that an older valid roam can still be saved.
     */
    if (sourceType === 'roam_history') {
      const sourceWindow =
        getRoamHistorySourceWindow(
          sourceId
        )

      if (!sourceWindow) {
        return NextResponse.json(
          {
            error:
              'Invalid roam history source_id.',
          },
          { status: 400 }
        )
      }

      let qualifyingRoams

      try {
        qualifyingRoams =
          await loadQualifyingRoamDays({
            supabase,
            userId:
              user.id,
            visitedAfter:
              sourceWindow.windowStartAt,
            visitedBefore:
              sourceWindow.windowEndAt,
            limit:
              10,
          })
      } catch (error) {
        console.error(
          '[flow-snapshots/save] Roam-history source lookup failed:',
          error
        )

        return NextResponse.json(
          {
            error:
              'Failed to verify the roam history source.',
          },
          { status: 500 }
        )
      }

      const sourceRoam =
        qualifyingRoams.find(
          (roam) =>
            roam.sourceId ===
            sourceId
        ) ?? null

      if (!sourceRoam) {
        return NextResponse.json(
          {
            error:
              'The qualifying roam was not found.',
          },
          { status: 404 }
        )
      }

      const venueIds =
        normalizeCanonicalSnapshotVenueIds(
          sourceRoam.stops.map(
            (stop) =>
              stop.venueId
          )
        )

      if (
        !venueIds ||
        venueIds.length < 3
      ) {
        return NextResponse.json(
          {
            error:
              'A roam snapshot requires at least 3 distinct venues.',
          },
          { status: 400 }
        )
      }

      const roamDay =
        normalizeNullableSourceText(
          sourceRoam.roamDay
        )

      canonicalSource = {
        title:
          roamDay
            ? `Roam · ${roamDay}`
            : 'Roam',
        city:
          normalizeNullableSourceText(
            sourceRoam.city
          ) ??
          normalizeNullableSourceText(
            sourceWindow.city
          ),
        status:
          'completed',
        venueIds,
        checkedInCount:
          venueIds.length,
        totalStops:
          venueIds.length,
      }
    }

    if (!canonicalSource) {
      return NextResponse.json(
        {
          error:
            'The snapshot source could not be resolved.',
        },
        { status: 400 }
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

    /*
     * Replay initiative:
     *
     * Evidence-bearing snapshot values are persisted from the
     * canonical server-side source rather than client FormData.
     *
     * route_summary remains presentation metadata supplied by
     * the snapshot renderer.
     */
    const snapshotPayload = {
      user_id: user.id,
      source_type: sourceType,
      source_id: sourceId,
      title:
        canonicalSource.title,
      city:
        canonicalSource.city,
      status:
        canonicalSource.status,
      cover_image_url: publicUrl,
      route_summary: routeSummary,
      checked_in_count:
        canonicalSource.checkedInCount,
      total_stops:
        canonicalSource.totalStops,
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
     * Replay initiative:
     *
     * Persist immutable ordered route evidence only when this
     * snapshot is first created.
     */
    if (!existingSnapshot) {
      const snapshotStopRows =
        canonicalSource.venueIds.map(
          (venueId, stopIndex) => ({
            snapshot_id: snapshot.id,
            venue_id: venueId,
            stop_index: stopIndex,
          })
        )

      const {
        error: snapshotStopsError,
      } = await supabase
        .from('flow_snapshot_stops')
        .insert(snapshotStopRows)

      if (snapshotStopsError) {
        console.error(
          '[flow-snapshots/save] Canonical snapshot stop persistence failed:',
          snapshotStopsError
        )

        /*
         * The parent snapshot was created specifically for this
         * request. If canonical route persistence fails, remove
         * that new snapshot so a route-less replay artifact is
         * not left behind.
         */
        const {
          error: snapshotCleanupError,
        } = await supabase
          .from('flow_snapshots')
          .delete()
          .eq('id', snapshot.id)
          .eq('user_id', user.id)

        if (snapshotCleanupError) {
          console.error(
            '[flow-snapshots/save] Failed to clean up snapshot after stop persistence failure:',
            snapshotCleanupError
          )
        } else {
          const {
            error: storageCleanupError,
          } = await supabase.storage
            .from(SNAPSHOT_BUCKET)
            .remove([storagePath])

          if (storageCleanupError) {
            console.error(
              '[flow-snapshots/save] Failed to clean up snapshot image after stop persistence failure:',
              storageCleanupError
            )
          }
        }

        return NextResponse.json(
          {
            error:
              'Failed to preserve the snapshot route.',
          },
          { status: 500 }
        )
      }
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

    if (
      snapshot.visibility ===
      'public'
    ) {
      await safelyRefreshCreatorReputation(
        user.id,
        {
          mutation:
            existingSnapshot
              ? 'public_flow_snapshot_updated'
              : 'public_flow_snapshot_created',

          rankingRefreshMode:
            'affected',

          calculatedAt:
            now,
        }
      )
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

/*
 * Replay initiative:
 *
 * Normalize canonical snapshot routes without changing their
 * order. Repeated venues are intentionally rejected because
 * repeated venues are not a supported Flow invariant.
 */
function normalizeCanonicalSnapshotVenueIds(
  value: unknown
): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const venueIds: string[] = []

  for (const rawVenueId of value) {
    if (typeof rawVenueId !== 'string') {
      return null
    }

    const venueId = rawVenueId.trim()

    if (!venueId) {
      return null
    }

    venueIds.push(venueId)
  }

  if (
    new Set(venueIds).size !==
    venueIds.length
  ) {
    return null
  }

  return venueIds
}

/*
 * Replay initiative:
 *
 * Count only distinct, valid canonical stop indexes.
 *
 * This is especially important for crawl_progress because its
 * current schema does not enforce uniqueness for
 * crawl_id + user_id + stop_index.
 */
function countCanonicalCompletedStops(
  value: unknown,
  totalStops: number
): number {
  if (!Array.isArray(value)) {
    return 0
  }

  const stopIndexes =
    new Set<number>()

  for (const row of value) {
    if (
      typeof row !== 'object' ||
      row === null ||
      Array.isArray(row)
    ) {
      continue
    }

    const stopIndex =
      (row as Record<string, unknown>)
        .stop_index

    if (
      typeof stopIndex !== 'number' ||
      !Number.isInteger(stopIndex) ||
      stopIndex < 0 ||
      stopIndex >= totalStops
    ) {
      continue
    }

    stopIndexes.add(stopIndex)
  }

  return stopIndexes.size
}

function normalizeActiveFlowSnapshotStatus(
  value: unknown,
  checkedInCount: number
): SnapshotStatus | null {
  if (value === 'completed') {
    return 'completed'
  }

  if (value === 'cancelled') {
    return 'cancelled'
  }

  if (value === 'active') {
    return checkedInCount > 0
      ? 'partial'
      : 'active'
  }

  return null
}

function deriveHostedFlowSnapshotStatus({
  checkedInCount,
  totalStops,
}: {
  checkedInCount: number
  totalStops: number
}): SnapshotStatus {
  if (
    totalStops > 0 &&
    checkedInCount === totalStops
  ) {
    return 'completed'
  }

  if (checkedInCount > 0) {
    return 'partial'
  }

  return 'active'
}

function normalizeNullableSourceText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
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