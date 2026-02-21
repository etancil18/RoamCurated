// utils/imageUtils.ts

import type { Venue } from "@/types/venue";

/**
 * Converts a venue name into a slug format for predictable image filenames.
 * Example: "Joe's Bar & Grill" → "joes-bar-grill"
 */
export function slugifyName(name = ""): string {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates a prioritized list of potential cover image paths
 * for a given venue. Falls back to local images if remote cover is not defined.
 */
export function coverCandidates(ev: Venue): string[] {
  const s = slugifyName(ev.name || "");
  const guesses = [
    ev.cover || null,
    `img/venues/${s}/cover.jpg`,
    `img/venues/${s}/cover.jpeg`,
    `img/venues/${s}/cover.webp`,
    `img/venues/${s}/cover.png`,
    `img/venues/${s}.jpg`,
    `img/venues/${s}.jpeg`,
    `img/venues/${s}.webp`,
    `img/venues/${s}.png`,
  ].filter(Boolean) as string[];

  return [...new Set(guesses)];
}

/**
 * Builds the HTML markup for a venue’s cover image block with
 * multiple fallback sources.
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
      style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:6px 0;"
      data-candidates="${candidates.join("|")}"
      data-idx="0"
      onerror="tryNextCover(this)"
    />
  `;
}
