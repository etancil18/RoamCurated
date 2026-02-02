// lib/prompt-engine/normalizeUtils.ts

/**
 * Normalize common synonyms and map tags to consistent lowercase terms
 */
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
