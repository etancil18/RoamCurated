// utils/typeUtils.ts

export function hasType(loc: any, desired: string[]): boolean {
  const types = Array.isArray(loc.type)
    ? loc.type.map((t: string) => t.toLowerCase())
    : String(loc.type || '').split(',').map((s) => s.trim().toLowerCase());
  return types.some((t: string) => desired.includes(t));
}

export function isMealType(loc: any): boolean {
  const meals = ["breakfast", "brunch", "lunch", "dinner"];
  const types = Array.isArray(loc.type)
    ? loc.type.map((t: string) => t.toLowerCase())
    : String(loc.type || '').split(',').map((s) => s.trim().toLowerCase());
  return types.some((t: string) => meals.includes(t));
}

function hasVibeOrTagMatch(loc: any, keywords: string[]): boolean {
  const vibe = (loc.vibe || '').toLowerCase();
  const tags = (loc.tags || '').toLowerCase();
  return keywords.some((kw) => vibe.includes(kw) || tags.includes(kw));
}

function matchesThemeFilters(loc: any, filters: {
  vibes?: string[];
  tags?: string[];
  price?: number[];
  timeOfDay?: string[];
}): boolean {
  if (filters.vibes) {
    const vibe = (loc.vibe || '').toLowerCase();
    if (!filters.vibes.some(v => vibe.includes(v))) return false;
  }

  if (filters.tags) {
    const tags = (loc.tags || '').toLowerCase();
    if (!filters.tags.some(t => tags.includes(t))) return false;
  }

  if (filters.price) {
    const priceSymbol = (loc.price || '').trim();
    const priceVal = priceSymbol.length;
    if (!filters.price.includes(priceVal)) return false;
  }

if (filters.timeOfDay && loc.timeCategory) {
  const locTimes = loc.timeCategory
    .toLowerCase()
    .split(',')
    .map((s: string) => s.trim());

  const hasMatch = locTimes.some((t: string) => filters.timeOfDay!.includes(t));
  if (!hasMatch) return false;
}


  return true;
}

/**
 * Counts keyword matches across name, description, tags, and vibe
 */
export function keywordMatchScore(loc: any, keywords: string[]): number {
  const combined = [
    (loc.name || '').toLowerCase(),
    (loc.description || '').toLowerCase(),
    (loc.tags || '').toLowerCase(),
    (loc.vibe || '').toLowerCase(),
  ].join(' ');
  return keywords.reduce((count, kw) =>
    combined.includes(kw.toLowerCase()) ? count + 1 : count, 0);
}

/**
 * Counts vibe matches against venue.vibe
 */
export function vibeMatchScore(loc: any, vibes: string[]): number {
  const v = (loc.vibe || '').toLowerCase();
  return vibes.reduce((count, vibe) =>
    v.includes(vibe.toLowerCase()) ? count + 1 : count, 0);
}

/**
 * Counts tag matches against venue.tags
 */
export function tagMatchScore(loc: any, tags: string[]): number {
  const t = (loc.tags || '').toLowerCase();
  return tags.reduce((count, tag) =>
    t.includes(tag.toLowerCase()) ? count + 1 : count, 0);
}

export {
  matchesThemeFilters,
  hasVibeOrTagMatch
};
