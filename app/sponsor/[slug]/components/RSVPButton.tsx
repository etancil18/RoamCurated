'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // ✅ Added
import { Button } from '@/components/ui/button';
import {
  joinSponsorCrawl,
  leaveSponsorCrawl,
} from '@/lib/supabase/sponsor';
import { useUser } from '@/hooks/useUser';

type Props = {
  crawlId: string;
  slug: string; // ✅ Needed for API state fetch
};

export default function RSVPButton({ crawlId, slug }: Props) {
  const { user } = useUser();
  const router = useRouter(); // ✅ Added
  const [isJoined, setIsJoined] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Load RSVP status via API (single source of truth)
  useEffect(() => {
    if (!user?.id || !slug) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `/api/getsponsorcrawl?slug=${slug}`,
          { credentials: 'include' }
        );

        if (!res.ok) {
          console.error('[RSVPButton] ❌ Failed to fetch crawl state');
          return;
        }

        const json = await res.json();
        setIsJoined(json.isGoing ?? false);
      } catch (err) {
        console.error('[RSVPButton] 🚨 Unexpected error:', err);
      }
    };

    fetchStatus();
  }, [user?.id, slug]);

  const handleClick = async () => {
    if (!user?.id) {
      alert('You must be logged in to RSVP.');
      return;
    }

    if (!crawlId || typeof crawlId !== 'string') {
      alert('Invalid crawl ID.');
      return;
    }

    setLoading(true);

    try {
      if (isJoined) {
        const { error } = await leaveSponsorCrawl(crawlId);

        if (error) {
          console.error('[RSVPButton] ❌ Leave failed:', error);
          alert('Failed to leave crawl.');
        } else {
          setIsJoined(false);
          router.refresh(); // ✅ Force SSR re-evaluation (chat hides instantly)
        }
      } else {
        const { error } = await joinSponsorCrawl(crawlId);

        if (error) {
          console.error('[RSVPButton] ❌ Join failed:', error);
          alert('Failed to join crawl.');
        } else {
          setIsJoined(true);
          router.refresh(); // ✅ Force SSR re-evaluation (chat appears instantly)
        }
      }
    } catch (err) {
      console.error('[RSVPButton] 🚨 Unexpected error:', err);
      alert('Unexpected error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isJoined === null) return null;

  return (
    <Button
      variant={isJoined ? 'secondary' : 'default'}
      onClick={handleClick}
      disabled={loading}
      className="w-full"
    >
      {loading
        ? 'Updating...'
        : isJoined
        ? '✅ Joined – Leave?'
        : '🎉 Join This Crawl'}
    </Button>
  );
}