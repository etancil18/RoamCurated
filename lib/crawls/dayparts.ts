import type { Venue } from '@/types/venue'
import { DateTime } from 'luxon'

import {
  venueMatchesAnyType,
  sortVenuesByDistance,
  getVenueTypes
} from '@/lib/venues/typeMatching'

import {
  sequencedStagesForNow,
  fallbackFlowFromStage
} from '@/utils/stageUtils'

import {
  isVenueOpenNow,
  daypartAllowedAtTime
} from '@/utils/timeUtils'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type CrawlStage = {
  stageTypes: string[]
  venues: Venue[]
}

export type CrawlRoute = {
  stages: CrawlStage[]
  venues: Venue[]
}

/* ------------------------------------------------ */
/* Config                                           */
/* ------------------------------------------------ */

const MAX_STAGES = 6
const MIN_VENUE_DISTANCE_METERS = 80

/* ------------------------------------------------ */
/* Distance utility                                 */
/* ------------------------------------------------ */

function distanceMeters(
  lat1:number,
  lon1:number,
  lat2:number,
  lon2:number
){
  const R = 6371e3

  const φ1 = lat1*Math.PI/180
  const φ2 = lat2*Math.PI/180

  const Δφ = (lat2-lat1)*Math.PI/180
  const Δλ = (lon2-lon1)*Math.PI/180

  const a =
    Math.sin(Δφ/2)*Math.sin(Δφ/2)+
    Math.cos(φ1)*Math.cos(φ2)*
    Math.sin(Δλ/2)*Math.sin(Δλ/2)

  const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

  return R*c
}

/* ------------------------------------------------ */
/* Venue filtering                                  */
/* ------------------------------------------------ */

function venueMatchesStage(
  venue: Venue,
  stageTypes: string[]
): boolean {

  const venueTypes = getVenueTypes(venue)

  return stageTypes.some(type =>
    venueTypes.includes(type.toLowerCase())
  )
}

function filterStageVenues(
  venues: Venue[],
  stageTypes: string[],
  now: DateTime
): Venue[] {

  return venues.filter((v) => {

    if (!venueMatchesStage(v, stageTypes)) return false

    if (!isVenueOpenNow(v, now)) return false

    return true
  })
}

/* ------------------------------------------------ */
/* Venue scoring                                    */
/* ------------------------------------------------ */

function scoreVenue(
  venue: Venue,
  stageTypes: string[],
  now: DateTime
){

  let score = 0

  const types = getVenueTypes(venue)

  /* stage match boost */

  if(types.some(t => stageTypes.includes(t))){
    score += 3
  }

  /* energy ramp */

  if(venue.energyRamp){
    score += venue.energyRamp * 0.25
  }

  /* soft daypart preference */

  if(daypartAllowedAtTime(venue, now)){
    score += 1
  }

  return score
}

/* ------------------------------------------------ */
/* Stage venue selection                            */
/* ------------------------------------------------ */

function selectVenueForStage(
  stageTypes: string[],
  venues: Venue[],
  usedVenueIds: Set<string>,
  usedTypes: Record<string,number>,
  now: DateTime,
  originLat: number,
  originLon: number
): Venue | null {

  let candidates = filterStageVenues(
    venues,
    stageTypes,
    now
  ).filter(v => !usedVenueIds.has(v.id))

  /* fallback stage expansion */

  if (candidates.length === 0) {

    const fallbackTypes = stageTypes.flatMap(t =>
      fallbackFlowFromStage(t)
    )

    candidates = filterStageVenues(
      venues,
      fallbackTypes,
      now
    ).filter(v => !usedVenueIds.has(v.id))
  }

  if (candidates.length === 0) return null

  /* score candidates */

  const scored = candidates.map(v => ({
    venue: v,
    score: scoreVenue(v,stageTypes,now)
  }))

  /* sort by score then distance */

  const sorted = scored
    .sort((a,b)=>b.score-a.score)
    .map(s=>s.venue)

  const distanceSorted = sortVenuesByDistance(
    sorted,
    originLat,
    originLon
  )

  for(const v of distanceSorted){

    const venueTypes = getVenueTypes(v)

    const dist = distanceMeters(
      originLat,
      originLon,
      v.lat,
      v.lon
    )

    if(dist < MIN_VENUE_DISTANCE_METERS) continue

    const typeKey = venueTypes[0] ?? 'unknown'

    if((usedTypes[typeKey] ?? 0) >= 2) continue

    usedTypes[typeKey] = (usedTypes[typeKey] ?? 0) + 1

    return v
  }

  return null
}

/* ------------------------------------------------ */
/* Crawl generation                                 */
/* ------------------------------------------------ */

export function generateDaypartCrawl(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime,
  opts: {
    durationHours?: number
    latestEndHour?: number
    theme?: string
  } = {}
): CrawlRoute | null {

  let stagePlan = sequencedStagesForNow(
    now.toJSDate(),
    opts
  )

  if(!stagePlan || stagePlan.length === 0){
    stagePlan = [['coffee'],['lunch'],['dinner']]
  }

  stagePlan = stagePlan.slice(0,MAX_STAGES)

  const used = new Set<string>()
  const usedTypes:Record<string,number> = {}

  const stages: CrawlStage[] = []
  const selectedVenues: Venue[] = []

  let currentLat = originLat
  let currentLon = originLon

  for (const stageTypes of stagePlan) {

    const venue = selectVenueForStage(
      stageTypes,
      venues,
      used,
      usedTypes,
      now,
      currentLat,
      currentLon
    )

    if (!venue) continue

    used.add(venue.id)

    stages.push({
      stageTypes,
      venues:[venue]
    })

    selectedVenues.push(venue)

    currentLat = venue.lat
    currentLon = venue.lon
  }

  if (selectedVenues.length < 1) return null

  return {
    stages,
    venues: selectedVenues
  }
}

/* ------------------------------------------------ */
/* Multi-crawl generator                            */
/* ------------------------------------------------ */

export function generateDaypartCrawls(
  venues: Venue[],
  originLat: number,
  originLon: number,
  now: DateTime
): CrawlRoute[] {

  const crawls: CrawlRoute[] = []

  const base = generateDaypartCrawl(
    venues,
    originLat,
    originLon,
    now
  )

  if (base) crawls.push(base)

  const romantic = generateDaypartCrawl(
    venues,
    originLat,
    originLon,
    now,
    { theme:'romantic' }
  )

  if (romantic) crawls.push(romantic)

  const foodie = generateDaypartCrawl(
    venues,
    originLat,
    originLon,
    now,
    { theme:'foodie' }
  )

  if (foodie) crawls.push(foodie)

  const nightlife = generateDaypartCrawl(
    venues,
    originLat,
    originLon,
    now,
    { theme:'nightlife' }
  )

  if (nightlife) crawls.push(nightlife)

  return crawls
}