// app/sponsor/api/getsponsorcrawl.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerApi } from '@/lib/supabase/server-api';

export async function GET(req: NextRequest) {
  const supabase = await supabaseServerApi();
  const { searchParams } = new URL(req.url);

  const slug = searchParams.get('slug');
  const ref = searchParams.get('ref') ?? null;

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  // 🔐 Get current user (for isGoing + chat unlock)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1️⃣ Fetch crawl event (avoid select *)
  const { data: crawl, error: crawlError } = await supabase
    .from('crawl_events')
    .select(
      `
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
      creator_id,
      created_at,
      is_public
      `
    )
    .or(`public_id.eq.${slug},slug.eq.${slug}`)
    .single();

  if (crawlError || !crawl) {
    console.error('[getSponsorCrawl] Crawl not found:', crawlError);
    return NextResponse.json({ error: 'Crawl not found' }, { status: 404 });
  }

  // 2️⃣ Fetch RSVP rows (ONLY "going")
  const { data: rsvps, error: rsvpError } = await supabase
    .from('crawl_rsvps')
    .select('user_id')
    .eq('crawl_id', crawl.id)
    .eq('status', 'going')
    .not('user_id', 'is', null);

  if (rsvpError) {
    console.error('[getSponsorCrawl] RSVP fetch failed:', rsvpError);
    return NextResponse.json(
      { error: 'Failed to load attendees' },
      { status: 500 }
    );
  }

  const attendeeUserIds = (rsvps ?? [])
    .map((r) => r.user_id)
    .filter((id): id is string => typeof id === 'string');

  // 3️⃣ Fetch profile info
  let profiles: any[] = [];

  if (attendeeUserIds.length > 0) {
    const { data: profData, error: profError } = await supabase
      .from('profiles')
      .select(
        'id, full_name, instagram_handle, personality_style'
      )
      .in('id', attendeeUserIds);

    if (profError) {
      console.error('[getSponsorCrawl] Profile fetch failed:', profError);
    } else {
      profiles = profData ?? [];
    }
  }

  // 4️⃣ Merge RSVP + profile data
  const attendees = (rsvps ?? []).map((r) => {
    const profile = profiles.find((p) => p.id === r.user_id);

    return {
      rsvp_user_id: r.user_id,
      full_name: profile?.full_name ?? null,
      instagram_handle: profile?.instagram_handle ?? null,
      personality_style: profile?.personality_style ?? null,
    };
  });

  // 5️⃣ Determine if current user is going
  let isGoing = false;

  if (user) {
    isGoing = attendeeUserIds.includes(user.id);
  }

  // 6️⃣ Capacity logic
  const attendeeCount = attendeeUserIds.length;
  const remainingCapacity =
    crawl.max_capacity != null
      ? Math.max(crawl.max_capacity - attendeeCount, 0)
      : null;

  // 7️⃣ Chat unlock logic
  const chatEnabled =
    crawl.rsvp_enabled === true && isGoing === true;

  // Optional referral logging
  if (ref) {
    console.log('[getSponsorCrawl] Referral:', {
      from: ref,
      to: crawl.id,
      slug,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    crawl,
    attendees,
    attendeeCount,
    remainingCapacity,
    isGoing,
    chatEnabled,
  });
}