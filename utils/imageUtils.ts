// utils/imageUtils.ts

import type { Venue } from "@/types/venue";

/**
 * Converts a venue name into a slug format for predictable image filenames.
 */
export function slugifyName(name = ""): string {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deterministic image resolution.
 * Priority:
 * 1. Explicit cover
 * 2. Slug-based image
 */
export function coverCandidates(ev: Venue): string[] {
  const slug = ev.slug || slugifyName(ev.name || "");

  const candidates = [];

  if (ev.cover) {
    const cover = ev.cover.startsWith("/") ? ev.cover : `/${ev.cover}`;
    candidates.push(cover);
  }

  candidates.push(`/img/venues/${slug}.webp`);
  candidates.push(`/img/venues/${slug}.jpg`);
  candidates.push(`/img/venues/${slug}.jpeg`);
  candidates.push(`/img/venues/${slug}.png`);

  return candidates;
}

/**
 * Generates HTML markup for venue cover with a single fallback.
 */
export function buildCoverImgHTML(ev: Venue): string {
  const [primary, fallback] = coverCandidates(ev);

  if (!primary) return "";

  const alt = (ev.name || "Cover").replace(/"/g, "&quot;");

  return `
    <img
      src="${primary}"
      alt="${alt}"
      loading="lazy"
      decoding="async"
      style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin:6px 0;"
      onerror="this.onerror=null;this.src='${fallback || ""}'"
    />
  `;
}