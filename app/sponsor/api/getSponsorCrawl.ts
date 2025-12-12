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

  // 1️⃣ Fetch the crawl event
  const { data: crawl, error: crawlError } = await supabase
    .from('crawl_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (crawlError || !crawl) {
    console.error('[getSponsorCrawl] Crawl not found:', crawlError);
    return NextResponse.json({ error: 'Crawl not found' }, { status: 404 });
  }

  // 2️⃣ Fetch RSVP rows
  const { data: rsvps, error: rsvpError } = await supabase
    .from('crawl_rsvps')
    .select('user_id')
    .eq('crawl_id', crawl.id)
    .not('user_id', 'is', null); // ✅ filter out null user_id

  if (rsvpError) {
    console.error('[getSponsorCrawl] RSVP fetch failed:', rsvpError);
    return NextResponse.json({ error: 'Failed to load attendees' }, { status: 500 });
  }

  // ✅ enforce correct typing
  const userIds = (rsvps ?? [])
    .map((r) => r.user_id)
    .filter((id): id is string => typeof id === 'string');

  // 3️⃣ Fetch profile info
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data: profData, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, instagram_handle, personality_style')
      .in('id', userIds);

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

  // Optional: log referral
  if (ref) {
    console.log('[getSponsorCrawl] Referral:', { from: ref, to: crawl.id, slug });
  }

  return NextResponse.json({ crawl, attendees });
}
