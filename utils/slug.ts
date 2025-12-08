// /utils/slug.ts

/**
 * Create a clean, URL-safe slug from a title string.
 * Examples:
 *  "Date Night in Soho!" → "date-night-in-soho"
 *  "🔥 Wild Crawl!  "     → "wild-crawl"
 */
export function createSlug(input: string): string {
  return input
    .normalize('NFKD') // Normalize unicode
    .replace(/[^\w\s-]/g, '') // Remove non-word characters (except hyphen/space)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-') // Collapse whitespace and underscores into hyphens
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Create a unique slug by appending a short ID (e.g., for duplicates)
 * Examples:
 *   generateUniqueSlug("sunset crawl", "abc123") → "sunset-crawl-abc123"
 */
export function generateUniqueSlug(base: string, suffix: string | number): string {
  return `${createSlug(base)}-${suffix}`;
}
