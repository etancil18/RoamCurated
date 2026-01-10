import { CrawlTheme } from "@/lib/theme-engine/types";

/**
 * Maps each timeOfDay to a rough hour range.
 */
export const timeOfDayToHours: Record<string, [number, number]> = {
  morning: [6, 11],
  day: [11, 17],
  evening: [17, 21],
  night: [21, 1],
  "late-night": [1, 4],
};

/**
 * Sequence fallback based on timeOfDay slot — used if a theme doesn’t define a stageFlow
 */
export const fallbackStageFlows: Record<string, string[]> = {
  morning: ["coffee", "tea", "fitness", "park", "market"],
  day: ["lunch", "gallery", "bookstore", "fitness", "cafe"],
  evening: ["dinner", "cocktail", "dessert", "wine bar"],
  night: ["bar", "club", "late-night", "speakeasy", "lounge", "wine bar"],
  "late-night": ["after hours", "speakeasy", "bar", "lounge"],
};

/**
 * Produces a stageFlow based on a theme, or generates one via fallback if missing.
 */
export function generateStageFlow(
  theme: CrawlTheme,
  fallbackTime: "morning" | "midday" | "afternoon" |"evening" | "night" | "late-night" = "evening"
): string[] {
  if (Array.isArray(theme.stageFlow) && theme.stageFlow.length > 0) {
    return theme.stageFlow;
  }

  const t = theme.filters?.timeOfDay ?? fallbackTime;

  if (typeof t === "string") {
    return fallbackStageFlows[t] || fallbackStageFlows[fallbackTime];
  }

  if (Array.isArray(t) && t.length > 0) {
    for (const slot of t) {
      if (slot in fallbackStageFlows) {
        return fallbackStageFlows[slot];
      }
    }
  }

  return fallbackStageFlows[fallbackTime];
}
