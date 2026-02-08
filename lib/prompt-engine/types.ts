// lib/prompt-engine/types.ts

/**
 * Semantic Stage used by the prompt-engine and routing engine.
 * This represents ONE intent step in a crawl (e.g. coffee → gallery → dinner).
 *
 * IMPORTANT:
 * This is intentionally different from theme-engine Stage types.
 */
export interface Stage {
  /**
   * Canonical activity types for this stage
   * Examples: ["coffee"], ["dinner"], ["bar", "cocktails"]
   */
  type: string[];

  /**
   * Optional hard tags extracted from prompt
   * Examples: ["burger"], ["outdoor"], ["vegan"]
   */
  tags?: string[];

  /**
   * Optional vibe / mood keywords
   * Examples: ["romantic"], ["casual"], ["high energy"]
   */
  vibe?: string[];

  /**
   * Optional coarse time bucket
   * Examples: Morning, Midday, Afternoon, Evening, Late
   */
  timeCategory?: string;

  /**
   * Internal index used to preserve original ordering
   * (never user-facing)
   */
  __stageIndex?: number;
}

/**
 * Normalized Stage Plan (ordered list of stages)
 */
export type StagePlan = Stage[];