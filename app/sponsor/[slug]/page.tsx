import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import SponsorDetail from './components/SponsorDetail';
import SharePreview from './components/SharePreview';
import SponsorChat from './components/SponsorChat';
import { SponsorCrawlWithAttendees } from '@/types/sponsor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Flow | Roam',
  description: 'Join, share, and complete playable city flows.',
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SponsorPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('crawl_events')
    .select(`
      id,
      crawl_id:id,
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
      creator_id
    `)
    .eq('slug', slug)
    .limit(1);

  const crawl = data?.[0] ?? null;

  if (error || !crawl) {
    console.error('Flow fetch error:', error);

    return (
      <div className="max-w-2xl mx-auto text-center p-6">
        <h2 className="text-xl font-bold">Flow not found</h2>

        <p className="text-muted-foreground">
          It may have been removed, is private, or doesn’t exist.
        </p>
      </div>
    );
  }

  const { data: attendees, error: rsvpError } = await supabase.rpc(
    'get_crawl_with_attendees',
    { input_crawl_id: crawl.id }
  );

  if (rsvpError) {
    console.warn('RSVP fetch error:', rsvpError);
  }

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
        mx-auto
        max-w-3xl
        space-y-8
        min-h-screen
        overscroll-y-auto
        scroll-smooth
        px-4
        pb-4
        pt-[calc(4rem+env(safe-area-inset-top)+1rem)]
      "
    >
      <SponsorDetail crawl={enriched} />

      <SharePreview
        title={crawl.title ?? ''}
        city={crawl.city ?? ''}
        slug={crawl.slug ?? ''}
      />

      {isGoing && (
        <div className="scroll-mt-24">
          <SponsorChat crawlId={crawl.id} />
        </div>
      )}
    </main>
  );
}