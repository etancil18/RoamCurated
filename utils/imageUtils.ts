// utils/imageUtils.ts

import type { Venue } from "@/types/venue";

/**
 * Converts a venue name into a slug format for predictable image filenames.
 * Example: "Joe's Bar & Grill" → "joes-bar-grill"
 */
export function slugifyName(name = ""): string {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates a prioritized list of potential cover image paths
 * for a given venue.
 *
 * Strategy:
 * 1. Use explicit cover if defined
 * 2. Try normalized filename
 * 3. Try slugified fallback
 * 4. Try common cover locations
 */
export function coverCandidates(ev: Venue): string[] {
  const slug = ev.slug || slugifyName(ev.name || "");

  let cover = ev.cover || null;

  if (cover && !cover.startsWith("/")) {
    cover = `/${cover}`;
  }

  // Normalize unicode filenames
  const normalizedCover = cover
    ? cover.normalize("NFC")
    : null;

  const slugFallbacks = [
    `/img/venues/${slug}.webp`,
    `/img/venues/${slug}.jpg`,
    `/img/venues/${slug}.jpeg`,
    `/img/venues/${slug}.png`,
  ];

  const guesses = [
    cover,
    normalizedCover,
    ...slugFallbacks,
    `/img/venues/${slug}/cover.webp`,
    `/img/venues/${slug}/cover.jpg`,
    `/img/venues/${slug}/cover.jpeg`,
    `/img/venues/${slug}/cover.png`,
  ].filter(Boolean) as string[];

  return [...new Set(guesses)];
}

/**
 * Builds the HTML markup for a venue’s cover image block
 * with automatic fallback logic.
 */
export function buildCoverImgHTML(ev: Venue): string {
  const candidates = coverCandidates(ev);
  if (!candidates.length) return "";

  const first = candidates[0];
  const alt = (ev.name || "Cover").replace(/"/g, "&quot;");

  return `
    <img
      src="${first}"
      alt="${alt}"
      loading="lazy"
      decoding="async"
      style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:6px 0;"
      data-candidates="${candidates.join("|")}"
      data-idx="0"
      onerror="tryNextCover(this)"
    />
  `;
}