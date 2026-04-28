// utils/typeUtils.ts

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .flatMap((item) => item.split(','))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

export function hasType(loc: any, desired: string[]): boolean {
  const types = normalizeStringList(loc.type);
  const desiredNormalized = desired.map((d) => d.toLowerCase());
  return types.some((t) => desiredNormalized.includes(t));
}

export function isMealType(loc: any): boolean {
  const meals = ["breakfast", "brunch", "lunch", "dinner"];
  const types = normalizeStringList(loc.type);
  return types.some((t) => meals.includes(t));
}

function hasVibeOrTagMatch(loc: any, keywords: string[]): boolean {
  const vibe = normalizeStringList(loc.vibe).join(' ');
  const tags = normalizeStringList(loc.tags).join(' ');
  const normalizedKeywords = keywords.map((kw) => kw.toLowerCase());

  return normalizedKeywords.some((kw) => vibe.includes(kw) || tags.includes(kw));
}

function matchesThemeFilters(loc: any, filters: {
  vibes?: string[];
  tags?: string[];
  price?: number[];
  timeOfDay?: string[];
}): boolean {
  if (filters.vibes) {
    const vibe = normalizeStringList(loc.vibe).join(' ');
    const normalizedVibes = filters.vibes.map((v) => v.toLowerCase());

    if (!normalizedVibes.some((v) => vibe.includes(v))) return false;
  }

  if (filters.tags) {
    const tags = normalizeStringList(loc.tags).join(' ');
    const normalizedTags = filters.tags.map((t) => t.toLowerCase());

    if (!normalizedTags.some((t) => tags.includes(t))) return false;
  }

  if (filters.price) {
    const priceSymbol = String(loc.price || '').trim();
    const priceVal = priceSymbol.length;
    if (!filters.price.includes(priceVal)) return false;
  }

  if (filters.timeOfDay && loc.timeCategory) {
    const locTimes = normalizeStringList(loc.timeCategory);
    const filterTimes = filters.timeOfDay.map((t) => t.toLowerCase());

    const hasMatch = locTimes.some((t) => filterTimes.includes(t));
    if (!hasMatch) return false;
  }

  return true;
}

/**
 * Counts keyword matches across name, description, tags, and vibe
 */
export function keywordMatchScore(loc: any, keywords: string[]): number {
  const combined = [
    String(loc.name || '').toLowerCase(),
    String(loc.description || '').toLowerCase(),
    normalizeStringList(loc.tags).join(' '),
    normalizeStringList(loc.vibe).join(' '),
  ].join(' ');

  return keywords.reduce((count, kw) =>
    combined.includes(kw.toLowerCase()) ? count + 1 : count, 0);
}

/**
 * Counts vibe matches against venue.vibe
 */
export function vibeMatchScore(loc: any, vibes: string[]): number {
  const venueVibes = normalizeStringList(loc.vibe).join(' ');

  return vibes.reduce((count, vibe) =>
    venueVibes.includes(vibe.toLowerCase()) ? count + 1 : count, 0);
}

/**
 * Counts tag matches against venue.tags
 */
export function tagMatchScore(loc: any, tags: string[]): number {
  const venueTags = normalizeStringList(loc.tags).join(' ');

  return tags.reduce((count, tag) =>
    venueTags.includes(tag.toLowerCase()) ? count + 1 : count, 0);
}

export {
  matchesThemeFilters,
  hasVibeOrTagMatch
};