'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  joinSponsorCrawl,
  leaveSponsorCrawl,
} from '@/lib/supabase/sponsor';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';

type Props = {
  crawlId: string;
  slug: string;
};

export default function RSVPButton({ crawlId }: Props) {
  const { user } = useUser();
  const router = useRouter();

  const [isJoined, setIsJoined] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !crawlId) {
      setIsJoined(false);
      return;
    }

    const fetchStatus = async () => {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase
        .from('crawl_rsvps')
        .select('id')
        .eq('crawl_id', crawlId)
        .eq('user_id', user.id)
        .eq('status', 'Confirmed')
        .maybeSingle();

      if (error) {
        console.error('[RSVPButton] Failed to fetch RSVP state:', error);
        setIsJoined(false);
        return;
      }

      setIsJoined(!!data);
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
          console.error('[RSVPButton] Leave failed:', error);
          alert('Failed to leave flow.');
          return;
        }

        setIsJoined(false);
        router.refresh();
      } else {
        const { error } = await joinSponsorCrawl(crawlId);

        if (error) {
          console.error('[RSVPButton] Join failed:', error);
          alert('Failed to join flow.');
          return;
        }

        setIsJoined(true);
        router.refresh();
      }
    } catch (err) {
      console.error('[RSVPButton] Unexpected error:', err);
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
          : '🎉 Join This Flow'}
    </Button>
  );
}