import { normalizeTag } from "@/lib/prompt-engine/normalizeUtils";
import type { Venue } from "@/types/venue";

/**
 * Normalize comma-separated vibe/tag strings into array of clean lowercase tags
 */
export function vibesArray(input?: string): string[] {
  if (!input || typeof input !== "string" || !input.trim()) return [];
  return input
    .split(",")
    .map((v) => normalizeTag(v.trim()))
    .filter(Boolean);
}

/**
 * Returns the normalized vibe vector from both vibe and tags
 */
export function extractVibeVector(v: { vibe?: string; tags?: string }): string[] {
  return [...vibesArray(v.vibe), ...vibesArray(v.tags)];
}

/**
 * Simple vibe similarity score (0 to 1)
 */
function _vibeSimilarity(
  a: { vibe?: string; tags?: string },
  b: { vibe?: string; tags?: string }
): number {
  const aVibes = new Set(extractVibeVector(a));
  const bVibes = new Set(extractVibeVector(b));
  if (aVibes.size === 0 || bVibes.size === 0) return 0;

  let overlapCount = 0;
  aVibes.forEach((v) => {
    if (bVibes.has(v)) overlapCount++;
  });

  const maxLen = Math.max(aVibes.size, bVibes.size);
  return overlapCount / maxLen;
}

export { _vibeSimilarity as vibeSimilarity };

/**
 * Verbose similarity: returns score and list of matched tags
 */
export function vibeSimilarityVerbose(
  a: { vibe?: string; tags?: string },
  b: { vibe?: string; tags?: string }
): { score: number; matches: string[] } {
  const aVibes = new Set(extractVibeVector(a));
  const bVibes = new Set(extractVibeVector(b));
  if (aVibes.size === 0 || bVibes.size === 0) return { score: 0, matches: [] };

  const matches: string[] = [];
  aVibes.forEach((v) => {
    if (bVibes.has(v)) matches.push(v);
  });

  const maxLen = Math.max(aVibes.size, bVibes.size);
  return {
    score: matches.length / maxLen,
    matches,
  };
}
