import type { Venue } from '@/types/venue'
import { DateTime } from 'luxon'

import {
  sequencedStagesForNow,
  fallbackFlowFromStage,
} from '@/utils/stageUtils'

import {
  isVenueOpenNow,
  daypartAllowedAtTime,
} from '@/utils/timeUtils'

import {
  venueMatchesAnyType,
  sortVenuesByDistance,
  getVenueTypes
} from '@/lib/venues/typeMatching'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type CrawlStageResult = {
  stageTypes: readonly string[]
  venue: Venue
}

export type CrawlResult = {
  venues: Venue[]
  stages: CrawlStageResult[]
}

export type ThemedCrawlResult = {
  theme: CrawlTheme
  crawl: CrawlResult
}

type CrawlTheme =
  | 'dateNight'
  | 'nightOut'
  | 'morningFlow'
  | 'soloExplorer'

/* ------------------------------------------------ */
/* Config                                           */
/* ------------------------------------------------ */

const MAX_STAGES = 6
const MIN_VENUE_DISTANCE_METERS = 80

/* ------------------------------------------------ */
/* Stage Type Exclusions                            */
/* ------------------------------------------------ */

const STAGE_TYPE_EXCLUSIONS: Record<string,string[]> = {
  club: ['coffee','bakery','dessert','cafe'],
  bar: ['coffee','bakery','dessert'],
  cocktail: ['coffee','bakery','dessert']
}

/* ------------------------------------------------ */
/* Canonical Roam Day Flow                          */
/* ------------------------------------------------ */

const DEFAULT_DAY_TRAJECTORY: readonly (readonly string[])[] = [
  ['fitness','yoga','spa'],
  ['coffee','cafe','bakery','breakfast'],
  ['brunch','lunch','restaurant'],
  ['gallery','park','cafe'],
  ['wine bar','dinner','music'],
  ['bar','cocktail','speakeasy','club'],
]

/* ------------------------------------------------ */
/* Theme Stage Flows                                */
/* ------------------------------------------------ */

const THEME_STAGE_FLOWS: Record<
  CrawlTheme,
  readonly (readonly string[])[]
> = {

  dateNight: [
    ['dinner','restaurant'],
    ['wine bar','cocktail'],
    ['cocktail','lounge','speakeasy'],
    ['dessert','bakery']
  ],

  nightOut: [
    ['dinner'],
    ['cocktail','wine bar'],
    ['bar','lounge'],
    ['club','dance']
  ],

  morningFlow: [
    ['fitness','yoga','pilates'],
    ['coffee','cafe','bakery'],
    ['park','garden','market'],
    ['spa','bookstore'],
    ['lunch','cafe']
  ],

  soloExplorer: [
    ['coffee','cafe','bakery'],
    ['gallery','bookstore','lifestyle'],
    ['park','garden'],
    ['lunch','wine bar','dessert'],
    ['gallery','random gem']
  ]

}

/* ------------------------------------------------ */
/* Theme Signals                                    */
/* ------------------------------------------------ */

const CRAWL_THEME_SIGNALS: Record<
  CrawlTheme,
  { vibes: string[]; tags: string[] }
> = {

  dateNight: {
    vibes: ['romantic','intimate','moody','sultry'],
    tags: ['wine','dessert','cocktail']
  },

  nightOut: {
    vibes: ['lively','energetic'],
    tags: ['dj','dance','club','cocktail']
  },

  morningFlow: {
    vibes: ['calm','peaceful','fresh'],
    tags: ['coffee','bakery','yoga','tea']
  },

  soloExplorer: {
    vibes: ['cozy','quiet','introspective'],
    tags: ['bookstore','gallery','cafe']
  }

}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function venueMatchesTags(venue: Venue, tags: string[]) {

  const venueTags = (venue.tags ?? '')
    .toLowerCase()
    .split(',')
    .map(t => t.trim())

  return tags.some(tag =>
    venueTags.includes(tag.toLowerCase())
  )
}

function venueMatchesVibe(venue: Venue, vibes: string[]) {

  const venueVibes = (venue.vibe ?? '')
    .toLowerCase()
    .split(',')
    .map(v => v.trim())

  return vibes.some(v =>
    venueVibes.includes(v.toLowerCase())
  )
}

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
    Math.sin(Δφ/2)**2 +
    Math.cos(φ1)*Math.cos(φ2)*
    Math.sin(Δλ/2)**2

  const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))

  return R*c
}

/* ------------------------------------------------ */
/* Venue Stage Matching                             */
/* ------------------------------------------------ */

function filterStageCandidates(
  venues: Venue[],
  stageTypes: readonly string[],
  now: DateTime
){

  return venues.filter(v => {

    if(!venueMatchesAnyType(v,stageTypes)) return false
    if(!isVenueOpenNow(v,now)) return false

    return true
  })
}

/* ------------------------------------------------ */
/* Venue Scoring                                    */
/* ------------------------------------------------ */

function scoreVenue(
  venue: Venue,
  stageTypes: readonly string[],
  now: DateTime,
  theme?: CrawlTheme
){

  let score = 0

  const types = getVenueTypes(venue)

  if(types.some(t => stageTypes.includes(t))){
    score += 3
  }

  if(venue.energyRamp){
    score += venue.energyRamp * 0.25
  }

  if(daypartAllowedAtTime(venue,now)){
    score += 1
  }

  if(theme){

    const signals = CRAWL_THEME_SIGNALS[theme]

    if(venueMatchesTags(venue,signals.tags)) score += 2
    if(venueMatchesVibe(venue,signals.vibes)) score += 3

  }

  return score
}

/* ------------------------------------------------ */
/* Venue Selector                                   */
/* ------------------------------------------------ */

function selectVenueForStage(
  venues: Venue[],
  stageTypes: readonly string[],
  usedIds: Set<string>,
  usedTypes: Record<string,number>,
  now: DateTime,
  originLat:number,
  originLon:number,
  opts?:{ theme?:CrawlTheme }
){

  let candidates = filterStageCandidates(
    venues,
    stageTypes,
    now
  ).filter(v => !usedIds.has(v.id))

  if(candidates.length===0){

    const fallbackTypes = stageTypes.flatMap(
      t => fallbackFlowFromStage(t)
    )

    candidates = filterStageCandidates(
      venues,
      fallbackTypes,
      now
    ).filter(v => !usedIds.has(v.id))
  }

  if(candidates.length===0) return null

  const scored = candidates.map(v => ({
    venue: v,
    score: scoreVenue(v,stageTypes,now,opts?.theme)
  }))

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
    const stage = stageTypes[0]

    if(
      STAGE_TYPE_EXCLUSIONS[stage]?.some(t =>
        venueTypes.includes(t)
      )
    ){
      continue
    }

    const dist = distanceMeters(
      originLat,
      originLon,
      v.lat,
      v.lon
    )

    if(dist < MIN_VENUE_DISTANCE_METERS) continue

    const typeKey = venueTypes[0] ?? 'unknown'

    if((usedTypes[typeKey] ?? 0) >= 2) continue

    usedTypes[typeKey] = (usedTypes[typeKey] ?? 0)+1

    return v
  }

  return null
}

/* ------------------------------------------------ */
/* Stage Plan Resolver                              */
/* ------------------------------------------------ */

function resolveStagePlan(
  now: DateTime,
  opts:{
    durationHours?:number
    latestEndHour?:number
    theme?:CrawlTheme
  }
){

  if(opts?.theme && THEME_STAGE_FLOWS[opts.theme]){
    return THEME_STAGE_FLOWS[opts.theme]
  }

  const sequenced = sequencedStagesForNow(
    now.toJSDate(),
    opts
  )

  if(sequenced?.length) return sequenced

  return DEFAULT_DAY_TRAJECTORY
}

/* ------------------------------------------------ */
/* Main Crawl Generator                             */
/* ------------------------------------------------ */

export function generateCrawl(
  venues: Venue[],
  originLat:number,
  originLon:number,
  now: DateTime,
  opts:{
    durationHours?:number
    latestEndHour?:number
    theme?:CrawlTheme
  }={}
):CrawlResult|null{

  const stagePlan = resolveStagePlan(now,opts)
    .slice(0,MAX_STAGES)

  const usedIds = new Set<string>()
  const usedTypes:Record<string,number> = {}

  const stages:CrawlStageResult[]=[]
  const selectedVenues:Venue[]=[]

  let currentLat=originLat
  let currentLon=originLon

  for(const stageTypes of stagePlan){

    const venue = selectVenueForStage(
      venues,
      stageTypes,
      usedIds,
      usedTypes,
      now,
      currentLat,
      currentLon,
      opts
    )

    if(!venue) continue

    usedIds.add(venue.id)

    stages.push({stageTypes,venue})
    selectedVenues.push(venue)

    currentLat=venue.lat
    currentLon=venue.lon
  }

  if(selectedVenues.length<1) return null

  return{
    venues:selectedVenues,
    stages
  }
}

/* ------------------------------------------------ */
/* Multi Crawl Generator                            */
/* ------------------------------------------------ */

export function generatePropertyCrawls(
  venues:Venue[],
  originLat:number,
  originLon:number,
  now:DateTime
):ThemedCrawlResult[]{

  const crawls:ThemedCrawlResult[]=[]

  const themes:CrawlTheme[] = [
    'dateNight',
    'nightOut',
    'morningFlow',
    'soloExplorer'
  ]

  for(const theme of themes){

    const crawl = generateCrawl(
      venues,
      originLat,
      originLon,
      now,
      {theme}
    )

    if(crawl){
      crawls.push({theme,crawl})
    }
  }

  return crawls
}

export {}