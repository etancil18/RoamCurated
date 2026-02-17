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
 * StageFlow types
 */
export type StageFlowEntry =
  | string
  | string[]
  | { optional: true; stage: string };

export type StageFlow = StageFlowEntry[];

/**
 * Sequence fallback based on timeOfDay slot — used if a theme doesn’t define a stageFlow
 * (fallbacks remain flat by design)
 */
export const fallbackStageFlows: Record<string, StageFlow> = {
  morning: [
    ["fitness", "yoga", "pilates"],
    ["coffee", "tea"],
    ["breakfast", "brunch", "cafe", "café"],
    ["park", "market", "lifestyle", "gallery", "bookstore", "showroom"],
    "lunch"
  ],
  midday: [
    "lunch",
    ["gallery", "bookstore", "showroom", "lifestyle"],
    ["wine bar", "random gem"],
    ["park", "market", "lifestyle"],
    ["dinner", "wine bar"]
  ],
  afternoon: [
    "lunch",
    ["random gem", "cafe", "café"],
    ["lifestyle", "gallery", "bookstore"],
    "dinner"
  ],
  day: [
    "lunch",
    ["gallery", "bookstore", "showroom", "lifestyle"],
    ["park", "wine bar", "random gem"],
    "dinner"
  ],
  evening: [
    "dinner",
    ["wine bar", "cocktail", "speakeasy", "dessert"],
    "cocktail"
  ],
  night: [
    "dinner",
    ["wine bar", "bar", "cocktail"],
    ["club", "rooftop", "speakeasy", "lounge", "bar"]
  ],
  "late-night": [
    ["cocktail", "bar", "club"],
    ["club", "lounge"]
  ],
};


/**
 * Produces a stageFlow based on a theme, or generates one via fallback if missing.
 * NOTE: Returned flow may be structured (branching / optional)
 */
function generateStageFlow(
  theme: CrawlTheme,
  fallbackTime: "morning" | "midday" | "afternoon" | "evening" | "night" | "late-night" = "evening"
): { flow: StageFlow; isFallback: boolean; reason: string } {
  if (Array.isArray(theme.stageFlow) && theme.stageFlow.length > 0) {
    return {
      flow: theme.stageFlow as StageFlow,
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

/**
 * Resolves a structured StageFlow into a concrete string[]
 * - string → included as-is
 * - string[] → one option selected (random by default)
 * - { optional } → included based on provided condition
 */
export function resolveStageFlow(
  flow: StageFlow,
  options?: {
    includeOptional?: boolean;
    pick?: (choices: string[]) => string;
  }
): string[] {
  const {
    includeOptional = true,
    pick = (choices: string[]) => choices[Math.floor(Math.random() * choices.length)],
  } = options || {};

  const resolved: string[] = [];

  for (const entry of flow) {
    if (typeof entry === "string") {
      resolved.push(entry);
      continue;
    }

    if (Array.isArray(entry)) {
      resolved.push(pick(entry));
      continue;
    }

    if (typeof entry === "object" && entry.optional) {
      if (includeOptional) {
        resolved.push(entry.stage);
      }
    }
  }

  return resolved;
}

/**
 * Resolves a StageFlowEntry into a single string (e.g. for stage-by-stage crawl logic)
 */
export function resolveStageEntry(
  entry: StageFlowEntry,
  pick: (choices: string[]) => string = (choices) =>
    choices[Math.floor(Math.random() * choices.length)]
): string | null {
  if (typeof entry === "string") return entry;
  if (Array.isArray(entry)) return pick(entry);
  if (typeof entry === "object" && entry.optional) return entry.stage;
  return null;
}

export { generateStageFlow };
