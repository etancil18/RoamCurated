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

type SponsorVenueWithActions = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  instagram_handle: string | null;
  booking_options: {
    provider: string;
    url: string;
  }[];
};

function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, '')}`;
}

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
      public_id,
      creator_id,
      is_public
    `)
    .or(`public_id.eq.${slug},slug.eq.${slug}`)
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

  const venueIds = Array.isArray(crawl.venue_ids)
    ? crawl.venue_ids.filter(Boolean)
    : [];

  const { data: venueData, error: venueError } = await supabase
    .from('venues')
    .select('id, name, city, address, lat, lon, instagram_handle')
    .in('id', venueIds);

  if (venueError) {
    console.error('[sponsor/page] Venue fetch error:', venueError);
  }

  const { data: bookingData, error: bookingError } = await supabase
    .from('venue_bookings')
    .select('venue_id, provider, url')
    .in('venue_id', venueIds);

  if (bookingError) {
    console.error('[sponsor/page] Venue booking fetch error:', bookingError);
  }

  const venues: SponsorVenueWithActions[] = venueIds.reduce<
    SponsorVenueWithActions[]
  >((acc, venueId) => {
    const venue = venueData?.find((item) => item.id === venueId);
    if (!venue || !venue.name) return acc;

    acc.push({
      id: venue.id,
      name: venue.name,
      city: venue.city,
      address: venue.address ?? null,
      lat: venue.lat,
      lon: venue.lon,
      instagram_handle: venue.instagram_handle,
      booking_options:
        bookingData
          ?.filter(
            (booking) =>
              booking.venue_id === venueId &&
              typeof booking.provider === 'string' &&
              booking.provider.trim().length > 0 &&
              typeof booking.url === 'string' &&
              booking.url.trim().length > 0
          )
          .map((booking) => ({
            provider: booking.provider as string,
            url: normalizeExternalUrl(booking.url),
          })) ?? [],
    });

    return acc;
  }, []);

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
    slug: crawl.public_id ?? crawl.slug,
    venues,
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
        slug={crawl.public_id ?? crawl.slug ?? ''}
      />

      {isGoing && (
        <div className="scroll-mt-24">
          <SponsorChat crawlId={crawl.id} />
        </div>
      )}
    </main>
  );
}