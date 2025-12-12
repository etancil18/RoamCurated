'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  joinSponsorCrawl,
  leaveSponsorCrawl,
  getSponsorCrawlWithAttendees,
} from '@/lib/supabase/sponsor';
import { useUser } from '@/hooks/useUser';

type Props = {
  crawlId: string;
};

export default function RSVPButton({ crawlId }: Props) {
  const { user } = useUser();
  const [isJoined, setIsJoined] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Load RSVP status once user + crawlId are valid
  useEffect(() => {
    if (!user?.id || !crawlId) return;

    const fetchStatus = async () => {
      try {
        const { data, error } = await getSponsorCrawlWithAttendees(crawlId);

        if (error) {
          console.error('[RSVPButton] ❌ Failed to fetch RSVP status:', error.message || error);
          return;
        }

        if (!data || !Array.isArray(data)) {
          console.warn('[RSVPButton] ⚠️ Invalid attendee data');
          return;
        }

        const joined = data.some((r) => r.rsvp_user_id === user.id);
        setIsJoined(joined);
      } catch (err) {
        console.error('[RSVPButton] 🚨 Unexpected error:', err);
      }
    };

    fetchStatus();
  }, [user?.id, crawlId]);

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
        }
      } else {
        const { error } = await joinSponsorCrawl(crawlId);
        if (error) {
          console.error('[RSVPButton] ❌ Join failed:', error);
          alert('Failed to join crawl.');
        } else {
          setIsJoined(true);
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
