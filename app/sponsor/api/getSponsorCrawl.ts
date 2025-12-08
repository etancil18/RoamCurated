import { NextRequest, NextResponse } from 'next/server';
import { supabaseServerApi } from '@/lib/supabase/server-api';

type Attendee = {
  rsvp_user_id: string;
  instagram_handle?: string | null;
  personality_style?: string | null;
};

function isValidAttendee(obj: any): obj is Attendee {
  return (
    typeof obj === 'object' &&
    typeof obj.rsvp_user_id === 'string'
  );
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServerApi();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const ref = searchParams.get('ref') ?? null; // Optional: referrer tracking

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  // 1️⃣ Get the crawl event by slug
  const { data: crawl, error: crawlError } = await supabase
    .from('crawl_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (crawlError || !crawl) {
    console.error('[getSponsorCrawl] Crawl not found:', crawlError);
    return NextResponse.json({ error: 'Crawl not found' }, { status: 404 });
  }

  // 2️⃣ Get attendees via RPC
  const { data: attendeesRaw, error: rsvpError } = await supabase
    .rpc('get_crawl_with_attendees', { input_crawl_id: crawl.id });

  if (rsvpError) {
    console.error('[getSponsorCrawl] Failed to fetch attendees:', rsvpError);
    return NextResponse.json({ error: 'Failed to load attendees' }, { status: 500 });
  }

  const attendees = (attendeesRaw ?? []).filter(isValidAttendee);

  // 3️⃣ Optional: log referral for analytics
  if (ref) {
    console.log('[getSponsorCrawl] Referral detected:', {
      from: ref,
      to: crawl.id,
      slug,
    });
    // Optional: log to Supabase table or external analytics
  }

  return NextResponse.json({ crawl, attendees });
}
