import { supabaseBrowser } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/session';
import type {
  SponsorCrawl,
  SponsorCrawlPayload,
} from '@/types/sponsor';

function createPublicId(length = 10) {
  return crypto.randomUUID().replaceAll('-', '').slice(0, length);
}

/**
 * 🧠 Create a new sponsored crawl
 */
export async function createSponsorCrawl(payload: SponsorCrawlPayload) {
  const supabase = supabaseBrowser();
  const creator_id = await getCurrentUserId();

  if (!creator_id) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const public_id = createPublicId();

  const { data, error } = await supabase
    .from('crawl_events')
    .insert({ ...payload, creator_id, public_id })
    .select('slug, public_id')
    .single();

  return { data, error };
}

/**
 * 📍 Get crawl by slug or public_id (minimal safe fields)
 */
export async function getSponsorCrawlBySlug(slug: string) {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from('crawl_events')
    .select(`
      id,
      title,
      description,
      datetime,
      venue_ids,
      city,
      vibe_tags,
      is_sponsored,
      sponsor_name,
      max_capacity,
      rsvp_enabled,
      slug,
      public_id,
      creator_id
    `)
    .or(`public_id.eq.${slug},slug.eq.${slug}`)
    .single();

  return { data: data as SponsorCrawl | null, error };
}

/**
 * 👥 Fetch crawl + attendees + state via API
 * (Single source of truth)
 */
export async function fetchSponsorCrawlState(slug: string) {
  try {
    const res = await fetch(
      `/api/getsponsorcrawl?slug=${slug}`,
      { credentials: 'include' }
    );

    if (!res.ok) {
      const error = await res.json();
      return { data: null, error };
    }

    const json = await res.json();
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * ➕ RSVP via API (NOT RPC)
 */
export async function joinSponsorCrawl(crawlId: string) {
  try {
    const res = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ crawl_id: crawlId }),
    });

    const json = await res.json();

    if (!res.ok) {
      return { error: json.error || 'Failed to RSVP' };
    }

    return { error: null, rsvpStatus: json.rsvpStatus };
  } catch (err) {
    return { error: err };
  }
}

/**
 * ➖ Leave crawl via API (NOT RPC)
 */
export async function leaveSponsorCrawl(crawlId: string) {
  try {
    const res = await fetch('/api/rsvp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ crawl_id: crawlId }),
    });

    const json = await res.json();

    if (!res.ok) {
      return { error: json.error || 'Failed to leave crawl' };
    }

    return { error: null, rsvpStatus: json.rsvpStatus };
  } catch (err) {
    return { error: err };
  }
}

/**
 * ✏️ Update crawl (creator only)
 */
export async function updateSponsorCrawl(
  crawlId: string,
  updates: Partial<SponsorCrawlPayload>
) {
  const supabase = supabaseBrowser();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: new Error('User not authenticated'), data: null };
  }

  const { data, error } = await supabase
    .from('crawl_events')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', crawlId)
    .eq('creator_id', userId)
    .select('*')
    .single();

  return { data, error };
}