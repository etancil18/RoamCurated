import type { FavoriteRecord, SavedRouteRecord } from '@/types/supabase'
import type { RouteStop } from '@/validators/favorite'
import { parseFavoriteVenueData, parseRouteStops } from '@/validators/favorite'

/**
 * Parse a single FavoriteRecord into a UI-safe structure.
 *
 * NOTE:
 * We DO NOT change the shape of the record.
 * We preserve all snake_case Supabase fields exactly.
 */
export function parseFavoriteRecord(row: FavoriteRecord) {
  const parsed = parseFavoriteVenueData(row.data)
  if (!parsed) return null

  return {
    ...row, // id, user_id, venue_id, created_at, data, city
    data: parsed, // parsed venue snapshot
  }
}

/**
 * Parse a list of favorite venue records.
 */
export function parseFavoriteList(rows: FavoriteRecord[]) {
  return rows
    .map(parseFavoriteRecord)
    .filter(Boolean) as Array<ReturnType<typeof parseFavoriteRecord>>
}

/**
 * Parse a single saved route record.
 *
 * NOTE:
 * We DO NOT rename fields. We keep all snake_case from Supabase.
 * Only transform `stops` from JSON → RouteStop[].
 */
export function parseRouteRecord(row: SavedRouteRecord) {
  const rawStops = Array.isArray(row.stops) ? row.stops : []

  const normalizedStops = rawStops.map((stop: any) => ({
    ...stop,
    type:
      typeof stop?.type === 'string'
        ? stop.type.split(',')[0]?.trim() || undefined
        : Array.isArray(stop?.type)
          ? String(stop.type[0] ?? '').trim() || undefined
          : undefined,
  }))

  const stops: RouteStop[] = parseRouteStops(normalizedStops)

  return {
    ...row, // id, user_id, name, city, created_at, source_url, slug
    stops, // parsed stops array
  }
}

/**
 * Parse a list of saved routes.
 */
export function parseRouteList(rows: SavedRouteRecord[]) {
  return rows.map(parseRouteRecord)
}