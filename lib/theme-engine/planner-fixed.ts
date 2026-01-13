import { CrawlTheme } from "@/lib/theme-engine/types";

/**
 * Maps each timeOfDay to a rough hour range.
 */
export const timeOfDayToHours: Record<string, [number, number]> = {
  morning: [6, 11],
  midday: [11, 14],
  afternoon: [14, 17],
  day: [11, 17],
  evening: [17, 21],
  night: [21, 1],
  "late-night": [1, 4],
};

/**
 * Sequence fallback based on timeOfDay slot — used if a theme doesn’t define a stageFlow
 */
export const fallbackStageFlows: Record<string, string[]> = {
  morning: ["fitness", "coffee", "breakfast", "tea", "park", "market", "lunch"],
  midday: ["lunch", "gallery", "wine bar", "random gem", "park", "bookstore", "dinner"],
  afternoon: ["lunch", "random gem", "cafe", "lifestyle", "gallery", "bookstore", "dinner"],
  day: ["lunch", "gallery", "bookstore", "park", "wine bar", "random gem", "dinner"],
  evening: ["dinner", "wine bar", "cocktail", "activity", "dessert"],
  night: ["dinner", "club", "rooftop", "speakeasy", "lounge", "wine bar"],
  "late-night": ["cocktail", "club", "lounge"],
};

/**
 * Produces a stageFlow based on a theme, or generates one via fallback if missing.
 */
function generateStageFlow(
  theme: CrawlTheme,
  fallbackTime: "morning" | "midday" | "afternoon" | "evening" | "night" | "late-night" = "evening"
): { flow: string[]; isFallback: boolean; reason: string } {
  if (Array.isArray(theme.stageFlow) && theme.stageFlow.length > 0) {
    return {
      flow: theme.stageFlow,
      isFallback: false,
      reason: "Theme defined stageFlow explicitly.",
    };
  }

  const t = theme.filters?.timeOfDay ?? fallbackTime;

  if (typeof t === "string") {
    return {
      flow: fallbackStageFlows[t] || fallbackStageFlows[fallbackTime],
      isFallback: true,
      reason: `Used fallback flow for timeOfDay: '${t}'`,
    };
  }

  if (Array.isArray(t) && t.length > 0) {
    for (const slot of t) {
      if (slot in fallbackStageFlows) {
        return {
          flow: fallbackStageFlows[slot],
          isFallback: true,
          reason: `Used fallback flow from timeOfDay array: '${slot}'`,
        };
      }
    }
  }

  return {
    flow: fallbackStageFlows[fallbackTime],
    isFallback: true,
    reason: `Defaulted to fallbackTime: '${fallbackTime}'`,
  };
}

export { generateStageFlow };
