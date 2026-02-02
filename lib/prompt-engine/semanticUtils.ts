import type { Venue } from "@/types/venue";
import type { Stage } from "@/lib/prompt-engine/types";

/**
 * Synonym map
 * Every value is ALWAYS an array
 */
const TYPE_SYNONYMS: Record<string, string[]> = {
  lunch: ["dinner"],
  dinner: ["lunch"],
  lounge: ["bar"],
  speakeasy: ["cocktails"],
  wine: ["wine bar"],
  fitness: ["activity"],
  activity: ["fitness"],
  gallery: ["art"],
  museum: ["art"],
  art: ["gallery", "museum"],
  reading: ["bookstore"],
  read: ["bookstore"],
  sandwich: ["lunch"],
  beer: ["bar"],
  cocktail: ["cocktails", "rooftop"],
  outside: ["park", "garden"],
  nightcap: ["bar", "lounge"],
};

/**
 * Expand a type into itself + synonyms
 */
function expandType(type: string): string[] {
  const t = type.toLowerCase();
  return [t, ...(TYPE_SYNONYMS[t] ?? [])];
}

/**
 * Loose type matching between venue and stage
 */
export function looseHasType(
  venue: Venue,
  stageTypes: string[]
): boolean {
  if (!Array.isArray(stageTypes) || stageTypes.length === 0) return false;

  const venueTypes: string[] = Array.isArray(venue.type)
    ? venue.type.map((v) => v.toLowerCase())
    : typeof venue.type === "string"
    ? [venue.type.toLowerCase()]
    : [];

  if (venueTypes.length === 0) return false;

  const expandedStage = stageTypes.flatMap(expandType);
  const expandedVenue = venueTypes.flatMap(expandType);

  return expandedStage.some((st) =>
    expandedVenue.includes(st)
  );
}

/**
 * Scoring weights
 */
export const WEIGHTS = {
  type: 3,
  tags: 2,
  vibe: 2,
  timeCategory: 1,
};

/**
 * Core semantic scoring between a venue and a stage
 */
export function semanticMatchScore(
  venue: Venue,
  stage: Stage
): number {
  let score = 0;

  /* ---------------- TYPE ---------------- */
  if (looseHasType(venue, stage.type)) {
    score += WEIGHTS.type;
  }

  /* ---------------- TAGS ---------------- */
  const venueTags: string[] =
    typeof venue.tags === "string"
      ? venue.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [];

  if (
    Array.isArray(stage.tags) &&
    stage.tags.some((tag) =>
      venueTags.includes(tag.toLowerCase())
    )
  ) {
    score += WEIGHTS.tags;
  }

  /* ---------------- VIBE ---------------- */
  const venueVibe =
    typeof venue.vibe === "string"
      ? venue.vibe.toLowerCase()
      : "";

  if (
    venueVibe &&
    Array.isArray(stage.vibe_keywords) &&
    stage.vibe_keywords.some((kw) =>
      venueVibe.includes(kw.toLowerCase())
    )
  ) {
    score += WEIGHTS.vibe;
  }

  /* ---------------- TIME CATEGORY ---------------- */
  if (
    typeof stage.timeCategory === "string" &&
    typeof venue.timeCategory === "string"
  ) {
    const venueTimeCats = venue.timeCategory
      .split(",")
      .map((tc) => tc.trim().toLowerCase());

    if (venueTimeCats.includes(stage.timeCategory.toLowerCase())) {
      score += WEIGHTS.timeCategory;
    }
  }

  return score;
}
