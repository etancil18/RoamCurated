// lib/outings/sequenceScoring/rank.ts

import type {
  PlanningContext,
  StopRole,
  VenueRecord,
} from "../types"
import { haversineMeters } from "./geometry"
import { inferVenueRoles } from "./roles"
import {
  scoreArchetypeFit,
  scoreBudgetFit,
  scoreDistanceFromAnchor,
  scoreGroupFit,
  scoreVibeFit,
} from "./bias"

export type CandidateVenue = VenueRecord & {
  inferredRoles: StopRole[]
  distanceMeters: number | null
  score: number
}

export function rankVenueCandidates(
  venues: VenueRecord[],
  context: PlanningContext
): CandidateVenue[] {
  const anchorLat = context.anchorVenue?.lat ?? null
  const anchorLon = context.anchorVenue?.lon ?? null
  const desiredRoles = getDesiredRolesForRanking(context)

  return venues
    .map((venue) => {
      const inferredRoles = inferVenueRoles(venue)
      const distanceMeters =
        anchorLat != null &&
        anchorLon != null &&
        venue.lat != null &&
        venue.lon != null
          ? haversineMeters(anchorLat, anchorLon, venue.lat, venue.lon)
          : null

      let score = 0

      score += inferredRoles.filter((role) => desiredRoles.includes(role)).length * 30
      score += scoreDistanceFromAnchor(distanceMeters, context.mobility)
      score += scoreBudgetFit(venue.price, context.budget)
      score += scoreVibeFit(venue, context.vibeTags)
      score += scoreArchetypeFit(venue, context)
      score += scoreGroupFit(venue, context.groupSize)
      score += scoreMetadataRichness(venue)
      score += scoreNetworkingVenueFit(venue, context)

      return {
        ...venue,
        inferredRoles,
        distanceMeters,
        score,
      }
    })
    .sort((a, b) => {
      const scoreDelta = b.score - a.score
      if (Math.abs(scoreDelta) > 0.001) return scoreDelta

      const distanceA = a.distanceMeters ?? Number.POSITIVE_INFINITY
      const distanceB = b.distanceMeters ?? Number.POSITIVE_INFINITY
      const distanceDelta = distanceA - distanceB
      if (Math.abs(distanceDelta) > 1) return distanceDelta

      return a.id.localeCompare(b.id)
    })
}

function scoreMetadataRichness(venue: VenueRecord): number {
  let score = 0

  const typeCount = venue.type?.length ?? 0
  const vibeCount = venue.vibe?.length ?? 0
  const tagCount = venue.tags?.length ?? 0

  if (typeCount > 0) score += 8
  if (typeCount >= 2) score += 3

  if (vibeCount > 0) score += 10
  if (vibeCount >= 3) score += 4

  if (tagCount > 0) score += 6
  if (tagCount >= 5) score += 3

  if (venue.hours) score += 5
  if (venue.address?.trim()) score += 2
  if (venue.lat != null && venue.lon != null) score += 4

  return score
}

function scoreNetworkingVenueFit(
  venue: VenueRecord,
  context: PlanningContext
): number {
  if (context.eventArchetype !== "networking") return 0

  const tokens = normalizeVenueTokens(venue)
  let score = 0

  if (
    tokens.some((token) =>
      [
        "lounge",
        "wine bar",
        "cocktail",
        "bar",
        "rooftop",
        "hotel bar",
        "hotel lobby",
        "social club",
        "coworking",
        "cafe",
        "café",
        "coffee",
        "lunch",
      ].includes(token)
    )
  ) {
    score += 14
  }

  if (
    tokens.some((token) =>
      [
        "social",
        "conversation",
        "professional",
        "networking",
        "business",
        "founder",
        "founders",
        "startup",
        "community",
        "upscale",
        "polished",
        "quiet",
        "lively",
      ].includes(token)
    )
  ) {
    score += 8
  }

  if (
    tokens.some((token) =>
      ["club", "sports bar", "fitness", "spa", "bakery", "breakfast"].includes(token)
    )
  ) {
    score -= 8
  }

  return score
}

function normalizeVenueTokens(venue: VenueRecord): string[] {
  return [
    ...(venue.type ?? []),
    ...(venue.vibe ?? []),
    ...(venue.tags ?? []),
    venue.name ?? "",
  ]
    .flatMap((value) =>
      String(value)
        .toLowerCase()
        .split(/[\s,./|_-]+/)
    )
    .map((token) => token.trim())
    .filter(Boolean)
}

function getDesiredRolesForRanking(context: PlanningContext): StopRole[] {
  if (context.slots?.length) {
    return uniqueRoles(
      context.slots.flatMap((slot) =>
        slot.flexibleRole ? [slot.role, slot.flexibleRole] : [slot.role]
      )
    )
  }

  return getDesiredRoles(context)
}

function getDesiredRoles(context: PlanningContext): StopRole[] {
  if (context.slots?.length) {
    return context.slots.map((slot) => slot.role)
  }

  return context.desiredRoles
}

function uniqueRoles(roles: StopRole[]): StopRole[] {
  return Array.from(new Set(roles))
}