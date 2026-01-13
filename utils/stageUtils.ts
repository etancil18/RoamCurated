// utils/stageUtils.ts

/**
 * Defines stage groupings for sequential venue types throughout the day.
 */
export const STAGE_GROUPS: string[][] = [
  ["coffee", "bakery"],                              // 0 - Morning
  ["fitness"],                                       // 1 - Morning Activity
  ["market", "breakfast", "brunch"],                 // 2 - Late Morning / Brunch
  ["park", "bookstore", "gallery"],                  // 3 - Daytime Chill
  ["lifestyle", "random gem"],                       // 4 - Mid-Afternoon
  ["lunch"],                                         // 5 - Lunch
  ["activity", "gallery", "park"],                   // 6 - Afternoon Activity
  ["cocktail", "random gem"],                        // 7 - Pre-Dinner Chill
  ["dinner"],                                        // 8 - Dinner
  ["bar", "cocktail", "speakeasy", "lounge"],        // 9 - Nightlife
];

/**
 * Themed stage plans — override default sequence with focused crawl type.
 */
export const THEME_STAGE_OVERRIDES: Record<string, string[][]> = {
  romantic: [["gallery"], ["dinner"], ["cocktail", "lounge"]],
  foodie: [["market"], ["lunch"], ["bakery"], ["dinner"]],
  nightlife: [["dinner"], ["bar"], ["speakeasy"], ["lounge"]],
  culture: [["gallery"], ["bookstore"], ["art", "museum"]],
  chill: [["park"], ["bakery"], ["coffee"], ["cocktail"]],
};

/**
 * Returns a fallback sequence of stage types based on a failed stage type.
 * Prioritizes the same group, then expands.
 */
export function getSimilarStageTypes(stageType: string): string[] {
  for (const group of STAGE_GROUPS) {
    if (group.includes(stageType)) {
      return group.filter((s) => s !== stageType);
    }
  }
  return [];
}

/**
 * Returns a short list of fallback types to try when a stage type fails.
 */
export function fallbackFlowFromStage(stageType: string, limit: number = 3): string[] {
  return [stageType, ...getSimilarStageTypes(stageType)].slice(0, limit);
}

/**
 * Determine stage sequence based on current time, available duration, and optional theme.
 * 
 * @param now - Date/time to base sequencing on
 * @param opts - Optional config:
 *  - durationHours: How many stages (stops) maximum
 *  - latestEndHour: Final allowed hour (24-hour or 27 for 3AM next day)
 *  - theme: Overrides stage plan if defined in THEME_STAGE_OVERRIDES
 */
export function sequencedStagesForNow(
  now: Date,
  opts: { durationHours?: number; latestEndHour?: number; theme?: string } = {}
): string[][] {
  const H = now.getHours() + now.getMinutes() / 60;
  const day = now.getDay(); // 0 = Sun, 6 = Sat

  const duration = opts.durationHours ?? 4;
  const latestEndHour = opts.latestEndHour ?? (day >= 4 && day <= 6 ? 27 : 24); // 3am Thu–Sat
  const timeLeft = Math.max(0, latestEndHour - H);
  const stageLimit = Math.min(Math.floor(timeLeft), duration, 6); // max 6 stages

  // Theme override
  if (opts.theme && THEME_STAGE_OVERRIDES[opts.theme.toLowerCase()]) {
    const themed = THEME_STAGE_OVERRIDES[opts.theme.toLowerCase()];
    return themed.slice(0, stageLimit);
  }

  // Time-based default indexing
  let startIdx = 0;
  if (H >= 10.5 && H < 13) startIdx = 2; // Brunch
  else if (H >= 13 && H < 16) startIdx = 4; // Chill
  else if (H >= 16 && H < 19) startIdx = 6; // Pre-Dinner
  else if (H >= 19 && H < 22) startIdx = 8; // Dinner
  else if ((day >= 4 && H >= 23) || (day === 0 && H < 3)) startIdx = 9; // Late night

  const defaultPlan = STAGE_GROUPS.slice(startIdx).concat(STAGE_GROUPS.slice(0, startIdx));
  return defaultPlan.slice(0, stageLimit);
}
