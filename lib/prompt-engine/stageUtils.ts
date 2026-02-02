// lib/prompt-engine/stageUtils.ts

import type { Stage } from "@/lib/prompt-engine/types";
import { _dayKey } from "@/utils/timeUtils";

const DEFAULT_STAGE_PLAN = [
  ["coffee", "brunch", "breakfast", "cafe"],
  ["gallery", "park", "lunch", "cafe", "coffee"],
  ["dinner", "bar", "lunch", "activity"],
  ["cocktail", "music", "bar", "lounge"],
  ["club", "speakeasy", "show"],
];

/**
 * Get a sequence of default stages based on current time and options
 */
export function sequencedStagesForNow(
  start: Date,
  opts: { durationHours?: number; latestEndHour?: number; theme?: string }
): string[][] {
  const hour = start.getHours();
  const stages = [...DEFAULT_STAGE_PLAN];

  if (hour >= 22 || hour < 8) {
    // Late night: skip morning/early stages
    return stages.slice(2);
  } else if (hour >= 18) {
    return stages.slice(1);
  } else if (hour >= 12) {
    return stages;
  } else {
    return stages;
  }
}

/**
 * Normalize stages into consistent structure
 */
export function normalizeStages(raw: any[]): Stage[] {
  return raw.map((s, index) => ({
    type: Array.isArray(s.type) ? s.type.map((t: string) => t.toLowerCase()) : [],
    tags: Array.isArray(s.tags) ? s.tags.map((t: string) => t.toLowerCase()) : [],
    vibe_keywords: Array.isArray(s.vibe_keywords) ? s.vibe_keywords.map((v: string) => v.toLowerCase()) : [],
    timeCategory: typeof s.timeCategory === "string" ? s.timeCategory.toLowerCase() : undefined,
    __stageIndex: index,
  }));
}
