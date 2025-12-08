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

  // ✅ Load RSVP status when user + crawlId are valid
  useEffect(() => {
    if (!user?.id || !crawlId) {
      console.warn('[RSVPButton] ⚠️ Missing user or crawlId');
      return;
    }

    const fetchStatus = async () => {
      console.log('[RSVPButton] 👤 Fetching RSVP status for user:', user.id);
      const { data, error } = await getSponsorCrawlWithAttendees(crawlId);

      if (error) {
        console.error('[RSVPButton] ❌ Failed to fetch RSVP status:', error.message || error);
        return;
      }

      if (!data || !Array.isArray(data)) {
        console.warn('[RSVPButton] ⚠️ No attendee data returned or wrong shape');
        return;
      }

      const joined = data.some((r) => r.rsvp_user_id === user.id);
      console.log('[RSVPButton] ✅ User joined status:', joined);
      setIsJoined(joined);
    };

    fetchStatus();
  }, [user?.id, crawlId]);

  const handleClick = async () => {
    if (!user?.id) {
      alert('You must be logged in to RSVP.');
      return;
    }

    if (!crawlId || typeof crawlId !== 'string') {
      console.error('[RSVPButton] ❌ Invalid crawlId:', crawlId);
      alert('Invalid crawl ID.');
      return;
    }

    setLoading(true);

    if (isJoined) {
      console.log('[RSVPButton] 🔄 Leaving crawl:', crawlId);
      const { error } = await leaveSponsorCrawl(crawlId);
      if (error) {
        console.error('[RSVPButton] ❌ Failed to leave crawl:', error.message || error);
        alert('Error leaving crawl. Try again.');
      } else {
        setIsJoined(false);
      }
    } else {
      console.log('[RSVPButton] ➕ Joining crawl:', crawlId);
      const { error } = await joinSponsorCrawl(crawlId);
      if (error) {
        console.error('[RSVPButton] ❌ Failed to join crawl:', error.message || error);
        alert('Error joining crawl. Try again.');
      } else {
        setIsJoined(true);
      }
    }

    setLoading(false);
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
