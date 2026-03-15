import type { Database } from '@/types/supabase'
import type { Venue, StaticVenue } from '@/types/venue'

type VenueRecord = Database['public']['Tables']['venues']['Row']

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

/* ------------------------------------------------ */
/* Merge Static + DB                                */
/* ------------------------------------------------ */

export function mergeStaticWithDb(
  staticVenues: StaticVenue[],
  dbVenues: VenueRecord[]
): Venue[] {

  const dbById = new Map(
    dbVenues.map(v => [v.id, v])
  )

  const dbBySlug = new Map(
    dbVenues.map(v => [v.slug ?? '', v])
  )

  const usedDbIds = new Set<string>()

  const mergedStatic: Venue[] = staticVenues.map((sv) => {

    let match: VenueRecord | undefined

    /* -------------------------------- */
    /* Primary match: ID                */
    /* -------------------------------- */

    if (sv.id && dbById.has(sv.id)) {
      match = dbById.get(sv.id)
    }

    /* -------------------------------- */
    /* Fallback match: slug             */
    /* -------------------------------- */

    else if (sv.slug && dbBySlug.has(sv.slug)) {
      match = dbBySlug.get(sv.slug)
    }

    if (match) {
      usedDbIds.add(match.id)
    }

    return {
      id: match?.id ?? sv.id ?? `temp-${sv.slug}`,

      slug: sv.slug ?? match?.slug ?? '',

      name: sv.name ?? match?.name ?? 'Unnamed',

      link: sv.link ?? match?.instagram_handle ?? '#',

      lat: toNumber(match?.lat ?? sv.lat),
      lon: toNumber(match?.lon ?? sv.lon),

      instagram_handle:
        match?.instagram_handle ?? sv.instagram_handle ?? undefined,

      vibe: sv.vibe ?? undefined,

      cover: sv.cover ?? match?.cover ?? undefined,

      type:
        Array.isArray(sv.type)
          ? sv.type.join(',')
          : sv.type ?? match?.type ?? undefined,

      timeCategory:
        sv.timeCategory ?? match?.time_category ?? undefined,

      energyRamp:
        sv.energyRamp ?? match?.energy_ramp ?? undefined,

      price:
        sv.price ?? match?.price ?? undefined,

      duration:
        sv.duration ?? match?.duration ?? undefined,

      tags:
        typeof sv.tags === 'string'
          ? sv.tags
          : match?.tags?.join(', ') ?? undefined,

      tier:
        sv.tier ?? match?.tier ?? undefined,

      city:
        match?.city ?? sv.city ?? undefined,

      neighborhood:
        sv.neighborhood ?? undefined,

      hours: sv.hours,
      hoursNumeric: sv.hoursNumeric,
      dayParts: sv.dayParts,
      openNow: sv.openNow,
      dateEvents: sv.dateEvents,
    }
  })

  /* -------------------------------- */
  /* Append DB-only venues            */
  /* -------------------------------- */

  const dbOnly: Venue[] = dbVenues
    .filter(v => !usedDbIds.has(v.id))
    .map((v) => ({
      id: v.id,

      name: v.name ?? 'Unnamed',

      slug: v.slug ?? '',

      link: v.instagram_handle ?? '#',

      lat: toNumber(v.lat),
      lon: toNumber(v.lon),

      instagram_handle: v.instagram_handle ?? undefined,

      city: v.city ?? undefined,

      type: v.type ?? undefined,

      cover: v.cover ?? undefined,
    }))

  return [...mergedStatic, ...dbOnly]
}