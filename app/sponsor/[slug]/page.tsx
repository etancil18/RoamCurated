// app/sponsor/[slug]/page.tsx

import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import SponsorDetail from './components/SponsorDetail';
import SharePreview from './components/SharePreview';

export const dynamic = 'force-dynamic'; // Ensures fresh SSR per request

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

  // 1️⃣ Get crawl metadata
  const { data: crawl, error: crawlError } = await supabase
    .from('crawl_events')
    .select(
      'id, title, description, datetime, venue_ids, city, vibe_tags, is_sponsored, rsvp_enabled, slug'
    )
    .eq('slug', slug)
    .single();

  if (crawlError || !crawl) {
    console.error('Crawl fetch error:', crawlError);
    return (
      <div className="max-w-2xl mx-auto text-center p-6">
        <h2 className="text-xl font-bold">Crawl not found</h2>
        <p className="text-muted-foreground">
          It may have been removed or doesn’t exist.
        </p>
      </div>
    );
  }

  // 2️⃣ Fetch attendees via RPC
  const { data: attendees, error: rsvpError } = await supabase.rpc(
    'get_crawl_with_attendees',
    { input_crawl_id: crawl.id }
  );

  if (rsvpError) {
    console.warn('RSVP fetch error:', rsvpError);
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-8">
      <SponsorDetail crawl={attendees || []} />
      <SharePreview />
    </main>
  );
}
