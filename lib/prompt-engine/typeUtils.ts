// lib/prompt-engine/typeUtils.ts

import type { Venue } from "@/types/venue";

const MEAL_TYPES = ["brunch", "lunch", "dinner"];

/**
 * Determines if a venue is a meal type
 */
export function isMealType(v: Venue): boolean {
  const typeArray = Array.isArray(v.type)
    ? v.type.map((t) => t.toLowerCase())
    : typeof v.type === "string"
    ? [v.type.toLowerCase()]
    : [];

  return typeArray.some((t) => MEAL_TYPES.includes(t));
}

/**
 * Determines if a venue has any of the desired types
 */
export function hasType(v: Venue, types: string[]): boolean {
  const venueTypes = Array.isArray(v.type)
    ? v.type.map((t) => t.toLowerCase())
    : typeof v.type === "string"
    ? [v.type.toLowerCase()]
    : [];

  return types.some((t) => venueTypes.includes(t.toLowerCase()));
}