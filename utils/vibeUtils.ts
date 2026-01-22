export function vibesArray(input?: string): string[] {
  if (!input?.trim()) return [];
  return input
    .split(",")
    .map((v) => normalizeTag(v.trim()))
    .filter(Boolean);
}

export function normalizeTag(tag: string): string {
  const t = tag.toLowerCase();
  const synonymMap: Record<string, string> = {
    speakeasy: "cocktail",
    mixology: "cocktail",
    dive: "casual",
    pub: "casual",
    rooftop: "view",
    romantic: "date night",
    intimate: "date night",
    museum: "art",
    gallery: "art",
    lifestyle: "fashion",
    karaoke: "music",
    live: "music",
  };
  return synonymMap[t] ?? t;
}

/**
 * Returns the normalized vibe vector from both vibe + tags
 */
export function extractVibeVector(v: { vibe?: string; tags?: string }): string[] {
  return [
    ...vibesArray(v.vibe),
    ...vibesArray(v.tags),
  ];
}

/**
 * Simple similarity score between two vibe/tag vectors (0 to 1)
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
 * Verbose similarity: returns score and matching tags
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
