// lib/outings/sequenceScoring/types.ts

import type { StopRole, VenueRecord } from "../types"

export type VenueHoursEntry = {
  open?: string | null
  close?: string | null
}

export type VenueWithHours = VenueRecord & {
  hours?: Record<string, VenueHoursEntry> | string | null
  type?: string | string[] | null
  vibe?: string | string[] | null
  tags?: string[] | string | null
}

export type CandidateVenue = VenueRecord & {
  inferredRoles: StopRole[]
  distanceMeters: number | null
  score: number
}

export type RoleCompatibleVenue = Pick<VenueRecord, "type"> & {
  inferredRoles: StopRole[]
}