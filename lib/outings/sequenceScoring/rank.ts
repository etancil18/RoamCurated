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

      return {
        ...venue,
        inferredRoles,
        distanceMeters,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)
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