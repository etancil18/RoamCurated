import { supabaseBrowser } from '@/lib/supabase/client';
import { getCurrentUserId } from '@/lib/supabase/session';
import type {
  SponsorCrawl,
  SponsorCrawlPayload,
  SponsorCrawlWithAttendees,
} from '@/types/sponsor';

// 🧠 Create a new sponsored crawl
export async function createSponsorCrawl(payload: SponsorCrawlPayload) {
  const supabase = supabaseBrowser();
  const creator_id = await getCurrentUserId();

  if (!creator_id) {
    console.error('[createSponsorCrawl] ❌ User not authenticated');
    return { data: null, error: new Error('User not authenticated') };
  }

  console.log('[createSponsorCrawl] 🧱 Creating crawl with payload:', payload);

  const { data, error } = await supabase
    .from('crawl_events')
    .insert({ ...payload, creator_id })
    .select('slug')
    .single();

  if (error) console.error('[createSponsorCrawl] ❌ Supabase insert error:', error);
  else console.log('[createSponsorCrawl] ✅ Crawl created:', data);

  return { data, error };
}

// 📍 Get one crawl by slug
export async function getSponsorCrawlBySlug(slug: string) {
  const supabase = supabaseBrowser();
  console.log('[getSponsorCrawlBySlug] 🔍 Fetching crawl for slug:', slug);

  const { data, error } = await supabase
    .from('crawl_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) console.error('[getSponsorCrawlBySlug] ❌ Error:', error);
  else console.log('[getSponsorCrawlBySlug] ✅ Found crawl:', data?.id);

  return { data: data as SponsorCrawl | null, error };
}

// 👥 Get crawl and attendees (via RPC)
export async function getSponsorCrawlWithAttendees(crawlId: string) {
  const supabase = supabaseBrowser();
  console.log('[getSponsorCrawlWithAttendees] 🔍 Calling RPC get_crawl_with_attendees with:', crawlId);

  const { data, error } = await supabase.rpc('get_crawl_with_attendees', {
    input_crawl_id: crawlId,
  });

  if (error) {
    console.error('[getSponsorCrawlWithAttendees] ❌ RPC error:', error);
    return { data: null, error };
  }

  const enriched = (data as SponsorCrawlWithAttendees[]).map((a) => ({
    ...a,
    sponsor_name: a.sponsor_name ?? null,
    max_capacity: a.max_capacity ?? null,
  }));

  return {
    data: enriched,
    error: null,
  };
}

// ➕ RSVP to a crawl (via RPC)
export async function joinSponsorCrawl(crawlId: string) {
  const supabase = supabaseBrowser();
  console.log('[joinSponsorCrawl] 🟢 Attempting join for crawlId:', crawlId);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) console.error('[joinSponsorCrawl] ❌ Auth retrieval error:', userError);
  if (!user) {
    console.error('[joinSponsorCrawl] ❌ No authenticated user found');
    return { error: new Error('User not authenticated') };
  }

  try {
    const { data, error, status } = await supabase.rpc('join_crawl', {
      input_crawl_id: crawlId,
    });

    console.log('[joinSponsorCrawl] 📡 RPC Response:', { status, data, error });

    if (error) {
      console.error('[joinSponsorCrawl] ❌ RPC join_crawl failed:', error.message || error);
      return { error };
    }

    console.log('[joinSponsorCrawl] ✅ Successfully joined crawl');
    return { error: null };
  } catch (err) {
    console.error('[joinSponsorCrawl] 💥 Unexpected exception:', err);
    return { error: err as Error };
  }
}

// ➖ Leave a crawl (via RPC)
export async function leaveSponsorCrawl(crawlId: string) {
  const supabase = supabaseBrowser();
  console.log('[leaveSponsorCrawl] 🟡 Attempting leave for crawlId:', crawlId);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) console.error('[leaveSponsorCrawl] ❌ Auth retrieval error:', userError);
  if (!user) {
    console.error('[leaveSponsorCrawl] ❌ No authenticated user found');
    return { error: new Error('User not authenticated') };
  }

  try {
    const { data, error, status } = await supabase.rpc('leave_crawl', {
      crawl_id: crawlId,
    });

    console.log('[leaveSponsorCrawl] 📡 RPC Response:', { status, data, error });

    if (error) {
      console.error('[leaveSponsorCrawl] ❌ RPC leave_crawl failed:', error.message || error);
      return { error };
    }

    console.log('[leaveSponsorCrawl] ✅ Successfully left crawl');
    return { error: null };
  } catch (err) {
    console.error('[leaveSponsorCrawl] 💥 Unexpected exception:', err);
    return { error: err as Error };
  }
}

// ✏️ Update a sponsored crawl (creator-only)
export async function updateSponsorCrawl(crawlId: string, updates: Partial<SponsorCrawlPayload>) {
  const supabase = supabaseBrowser();
  const userId = await getCurrentUserId();

  if (!userId) {
    console.error('[updateSponsorCrawl] ❌ User not authenticated');
    return { error: new Error('User not authenticated'), data: null };
  }

  console.log('[updateSponsorCrawl] ✏️ Attempting update:', { crawlId, updates });

  const { data, error } = await supabase
    .from('crawl_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', crawlId)
    .eq('creator_id', userId)
    .select('*')
    .single();

  if (error) {
    console.error('[updateSponsorCrawl] ❌ Update failed:', error);
    return { error, data: null };
  }

  console.log('[updateSponsorCrawl] ✅ Successfully updated crawl:', data);
  return { data, error: null };
}

// 📅 List public crawls in a city within a date range (via RPC)
export async function listSponsorCrawlsByCity(city: string, start: string, end: string) {
  const supabase = supabaseBrowser();
  console.log('[listSponsorCrawlsByCity] 🌆 Fetching crawls:', { city, start, end });

  const { data, error } = await supabase.rpc('list_public_crawls', {
    city,
    start_date: start,
    end_date: end,
  });

  if (error) {
    console.error('[listSponsorCrawlsByCity] ❌ RPC error:', error);
  } else {
    console.log('[listSponsorCrawlsByCity] ✅ Found crawls:', data?.length || 0);
  }

  return {
    data: data as {
      crawl_id: string;
      title: string;
      slug: string;
      datetime: string;
      vibe_tags: string[];
      creator_id: string;
      is_sponsored: boolean;
      rsvp_count: number;
    }[] | null,
    error,
  };
}
