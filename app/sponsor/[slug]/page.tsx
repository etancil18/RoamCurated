import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import SponsorDetail from './components/SponsorDetail';
import SharePreview from './components/SharePreview';
import SponsorChat from './components/SponsorChat';
import { SponsorCrawlWithAttendees } from '@/types/sponsor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Crawl | Roam',
  description: 'Discover and join curated city crawls',
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SponsorPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createServerClient();

  // 1️⃣ Get crawl metadata (SAFE VERSION)
const { data, error } = await supabase
  .from('crawl_events')
  .select(
    'id, title, description, datetime, venue_ids, city, vibe_tags, is_sponsored, sponsor_name, max_capacity, rsvp_enabled, slug, creator_id'
  )
  .eq('slug', slug)
  .limit(1);

const crawl = data?.[0] ?? null;

if (error || !crawl) {
  console.error('Crawl fetch error:', error);

  return (
    <div className="max-w-2xl mx-auto text-center p-6">
      <h2 className="text-xl font-bold">Crawl not found</h2>
      <p className="text-muted-foreground">
        It may have been removed, is private, or doesn’t exist.
      </p>
    </div>
  );
}

  // 2️⃣ Fetch attendees
  const { data: attendees, error: rsvpError } = await supabase.rpc(
    'get_crawl_with_attendees',
    { input_crawl_id: crawl.id }
  );

  if (rsvpError) {
    console.warn('RSVP fetch error:', rsvpError);
  }

  // 3️⃣ Determine if current user is RSVP'd
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isGoing = false;

  if (user) {
    const { data: rsvp } = await supabase
      .from('crawl_rsvps')
      .select('id')
      .eq('crawl_id', crawl.id)
      .eq('user_id', user.id)
      .eq('status', 'Confirmed')
      .maybeSingle();

    isGoing = !!rsvp;
  }

  // 4️⃣ Enrich data
  const enriched: SponsorCrawlWithAttendees[] = (attendees || []).map((a) => ({
    ...a,
    title: crawl.title ?? '',
    description: crawl.description ?? '',
    vibe_tags: crawl.vibe_tags ?? [],
    datetime: crawl.datetime ?? '',
    city: crawl.city ?? '',
    venue_ids: crawl.venue_ids,
    is_sponsored: crawl.is_sponsored ?? false,
    sponsor_name: crawl.sponsor_name ?? null,
    max_capacity: crawl.max_capacity ?? null,
    full_name: a.full_name ?? null,
    creator_id: crawl.creator_id,
    slug: crawl.slug,
  }));

  return (
    <main
      className="
        max-w-3xl
        mx-auto
        p-4
        space-y-8
        min-h-screen
        overscroll-y-auto
        scroll-smooth
      "
    >
      <SponsorDetail crawl={enriched} />

      <SharePreview
        title={crawl.title ?? ''}
        city={crawl.city ?? ''}
        slug={crawl.slug ?? ''}
      />

      {/* 💬 Chat only visible to RSVP'd users */}
      {isGoing && (
        <div className="scroll-mt-24">
          <SponsorChat crawlId={crawl.id} />
        </div>
      )}
    </main>
  );
}