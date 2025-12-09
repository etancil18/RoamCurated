'use client';

import { useEffect, useState } from 'react';
import { SponsorCrawlWithAttendees, SponsorVenue } from '@/types/sponsor';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import SponsorMapPreview from '@/app/sponsor-crawl/components/SponsorMapPreview';
import RSVPButton from './RSVPButton';
import SponsorEditButton from './SponsorEditButton';
import { supabaseBrowser } from '@/lib/supabase/client';

type Props = {
  crawl: SponsorCrawlWithAttendees[];
};

const venueMoodEmojiMap: Record<string, string> = {
  bar: '🍻',
  cafe: '☕️',
  club: '🎶',
  gallery: '🎨',
  restaurant: '🍴',
  default: '📍',
};

function getEmojiForVenue(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('bar')) return venueMoodEmojiMap.bar;
  if (lower.includes('cafe') || lower.includes('coffee')) return venueMoodEmojiMap.cafe;
  if (lower.includes('club') || lower.includes('music')) return venueMoodEmojiMap.club;
  if (lower.includes('gallery') || lower.includes('art')) return venueMoodEmojiMap.gallery;
  if (lower.includes('restaurant') || lower.includes('grill')) return venueMoodEmojiMap.restaurant;
  return venueMoodEmojiMap.default;
}

export default function SponsorDetail({ crawl }: Props) {
  const [venues, setVenues] = useState<SponsorVenue[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');

  if (!crawl || crawl.length === 0) {
    console.warn('[SponsorDetail] No crawl data passed');
    return <p>No crawl found.</p>;
  }

  const meta = crawl[0];

  if (!meta.venue_ids || !Array.isArray(meta.venue_ids)) {
    console.error('[SponsorDetail] Invalid or missing venue_ids:', meta.venue_ids);
    return <p>Error loading crawl itinerary.</p>;
  }

  const attendees = crawl.filter(
    (item) => typeof item.rsvp_user_id === 'string' && item.rsvp_user_id !== ''
  );

  const currentCount = attendees.length;
  const maxCapacity = (meta as any).max_capacity ?? 0;

  // ⏳ Countdown timer
  useEffect(() => {
    if (!meta.datetime) return;
    const target = new Date(meta.datetime).getTime();

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft('Event started');
      } else {
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${hrs}h ${mins}m ${secs}s`);
      }
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [meta.datetime]);

  // 📍 Fetch Venues
  useEffect(() => {
    const fetchVenues = async () => {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase
        .from('venues')
        .select('id, name, city, lat, lon, instagram_handle')
        .in('id', meta.venue_ids);

      if (error) {
        console.error('[SponsorDetail] Venue fetch failed:', error);
        return;
      }

      if (!data) {
        console.warn('[SponsorDetail] No venue data returned');
        return;
      }

      const ordered: SponsorVenue[] = meta.venue_ids
        .map((id) => data.find((v) => v.id === id))
        .filter(
          (v): v is {
            id: string;
            name: string | null;
            city: string | null;
            lat: number | null;
            lon: number | null;
            instagram_handle: string | null;
          } => !!v
        )
        .map((v) => ({
          id: v.id,
          name: v.name ?? '',
          city: v.city ?? '',
          lat: v.lat ?? 0,
          lng: v.lon ?? 0,
          instagram_handle: v.instagram_handle ?? null,
        }));

      setVenues(ordered);
    };

    if (meta.venue_ids?.length) {
      fetchVenues();
    }
  }, [meta]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      {/* 🧃 Hosted Crawl Notice */}
      {meta.is_sponsored && (
        <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-md">
          <h2 className="text-lg font-semibold">🍹 Hosted Crawl</h2>
          <p className="text-sm text-muted-foreground">
            Someone planned the good times — you just need to join.
          </p>
        </div>
      )}

      {/* Crawl metadata */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{meta.title ?? 'Untitled Crawl'}</h1>
        <p className="text-muted-foreground">{meta.description ?? ''}</p>

        {meta.sponsor_name && (
          <p className="text-sm text-purple-600 font-semibold">
            Sponsored by {meta.sponsor_name}
          </p>
        )}

        {meta.datetime && (
          <div className="text-sm text-muted-foreground">
            📅 {new Date(meta.datetime).toLocaleString()} &nbsp;•&nbsp; ⏳ Starts in:{' '}
            <strong>{timeLeft}</strong>
          </div>
        )}

        {maxCapacity > 0 && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              {currentCount} of {maxCapacity} spots claimed
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 ${
                  currentCount / maxCapacity > 0.8 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((currentCount / maxCapacity) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {meta.vibe_tags?.map((tag, i) => (
            <Badge key={i} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* 🗺️ Itinerary */}
      {venues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">🗺️ Itinerary:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {venues.map((v) => (
              <Card key={v.id} className="p-3 flex items-center space-x-3">
                <div className="text-2xl">{getEmojiForVenue(v.name)}</div>
                <div>
                  <div className="font-medium">
                    {v.instagram_handle ? (
                      <a
                        href={`https://instagram.com/${v.instagram_handle.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {v.name}
                      </a>
                    ) : (
                      v.name
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{v.city}</div>
                </div>
              </Card>
            ))}
          </div>

          <SponsorMapPreview venues={venues} useStreetPolyline heightPx={300} />
        </div>
      )}

      {/* RSVP + Edit */}
      <RSVPButton crawlId={meta.crawl_id} />
      <SponsorEditButton creatorId={meta.creator_id} slug={meta.slug ?? ''} />

      {/* 👥 Attendees */}
      {attendees.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="text-sm font-semibold">People joining:</h3>
          <div className="grid grid-cols-2 gap-2">
            {attendees.map((a) => (
              <Card key={a.rsvp_user_id}>
                <CardContent className="p-3">
                  <p className="text-sm font-medium">
                    {a.instagram_handle ? (
                      <a
                        href={`https://instagram.com/${a.instagram_handle.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {a.full_name || 'anonymous'}
                      </a>
                    ) : (
                      a.full_name || 'anonymous'
                    )}
                  </p>

                  {a.personality_style && (
                    <p className="text-xs text-muted-foreground">
                      Style: {a.personality_style}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
