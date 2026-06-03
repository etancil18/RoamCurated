'use client';

import { useEffect, useState } from 'react';
import { SponsorCrawlWithAttendees, SponsorVenue } from '@/types/sponsor';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SponsorMapPreview from '@/app/sponsor-crawl/components/SponsorMapPreview';
import RSVPButton from './RSVPButton';
import SponsorEditButton from './SponsorEditButton';
import { supabaseBrowser } from '@/lib/supabase/client';

async function fetchAttendeeDetails(userIds: string[]) {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, instagram_handle, personality_style')
    .in('id', userIds);

  if (error) {
    console.error('[SponsorDetail] Failed to fetch profile details:', error);
    return [];
  }

  return data || [];
}

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
  const [checkedStops, setCheckedStops] = useState<number[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [attendeesWithDetails, setAttendeesWithDetails] = useState<any[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');

  if (!crawl || crawl.length === 0) {
    console.warn('[SponsorDetail] No crawl data passed');
    return <p>No flow found.</p>;
  }

  const meta = crawl[0];

  useEffect(() => {
    setEditedTitle(meta.title ?? '');
    setEditedDescription(meta.description ?? '');
  }, [meta.title, meta.description]);

  if (!meta.venue_ids || !Array.isArray(meta.venue_ids)) {
    console.error('[SponsorDetail] Invalid or missing venue_ids:', meta.venue_ids);
    return <p>Error loading flow itinerary.</p>;
  }

  const attendees = crawl.filter(
    (item) => typeof item.rsvp_user_id === 'string' && item.rsvp_user_id !== ''
  );

  const currentCount = attendees.length;
  const maxCapacity = (meta as any).max_capacity ?? 0;

  const totalStops = venues.length;
  const completedStops = checkedStops.length;

  const progressPercent =
    totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const flowStarted = completedStops > 0;
  const flowCompleted = totalStops > 0 && completedStops === totalStops;

  const estimatedXP =
    25 +
    completedStops * 25 +
    (flowCompleted ? 100 : 0);

  useEffect(() => {
    const preloadProfiles = async () => {
      const validIds = attendees
        .map((a) => a.rsvp_user_id)
        .filter((id): id is string => !!id);

      if (validIds.length === 0) {
        setAttendeesWithDetails([]);
        return;
      }

      const profiles = await fetchAttendeeDetails(validIds);

      const enriched = attendees.map((a) => {
        const profile = profiles.find((p) => p.id === a.rsvp_user_id);

        return {
          ...a,
          full_name: profile?.full_name ?? 'anonymous',
          instagram_handle: profile?.instagram_handle ?? null,
          personality_style: profile?.personality_style ?? null,
        };
      });

      setAttendeesWithDetails(enriched);
    };

    if (attendees.length > 0) preloadProfiles();
  }, [attendees]);

  useEffect(() => {
    if (!meta.datetime) return;

    const target = new Date(meta.datetime).getTime();

    const update = () => {
      const diff = target - Date.now();

      if (diff <= 0) {
        setTimeLeft('Event started');
        return;
      }

      const totalMinutes = Math.floor(diff / 60000);
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);

      setTimeLeft(parts.join(' '));
    };

    update();

    const timer = setInterval(update, 60000);

    return () => clearInterval(timer);
  }, [meta.datetime]);

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

      if (!data) return;

      const ordered: SponsorVenue[] = meta.venue_ids
        .map((id) => data.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => !!v)
        .map((v): SponsorVenue => ({
          id: v.id,
          name: v.name ?? '',
          city: v.city ?? '',
          lat: v.lat ?? 0,
          lon: v.lon ?? 0,
          instagram_handle: v.instagram_handle ?? null,
        }));

      setVenues(ordered);
    };

    if (meta.venue_ids?.length) fetchVenues();
  }, [meta]);

  useEffect(() => {
    const loadProgress = async () => {
      const supabase = supabaseBrowser();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      const { data: progressData, error } = await supabase
        .from('crawl_progress')
        .select('stop_index')
        .eq('user_id', user.id)
        .eq('crawl_id', meta.crawl_id);

      if (error) {
        console.error('[SponsorDetail] Progress fetch failed:', error);
        return;
      }

      setCheckedStops(progressData?.map((p) => p.stop_index) || []);
    };

    loadProgress();
  }, [meta.crawl_id]);

  const toggleStop = async (index: number) => {
    if (!userId) {
      alert('Sign in to check in and track your flow progress.');
      return;
    }

    const supabase = supabaseBrowser();
    const alreadyChecked = checkedStops.includes(index);

    let updated: number[];

    if (alreadyChecked) {
      const { error } = await supabase
        .from('crawl_progress')
        .delete()
        .eq('crawl_id', meta.crawl_id)
        .eq('user_id', userId)
        .eq('stop_index', index);

      if (error) {
        console.error('[SponsorDetail] Failed to remove stop progress:', error);
        return;
      }

      updated = checkedStops.filter((i) => i !== index);
    } else {
      const { error } = await supabase.from('crawl_progress').insert({
        crawl_id: meta.crawl_id,
        user_id: userId,
        stop_index: index,
        completed_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[SponsorDetail] Failed to save stop progress:', error);
        return;
      }

      updated = [...checkedStops, index];
    }

    setCheckedStops(updated);
  };

  const handleSave = async () => {
    const supabase = supabaseBrowser();

    const { error } = await supabase
      .from('crawl_events')
      .update({
        title: editedTitle,
        description: editedDescription,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meta.crawl_id)
      .eq('creator_id', meta.creator_id);

    if (error) {
      alert('Failed to update flow.');
      return;
    }

    setIsEditing(false);
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      {meta.is_sponsored && (
        <div className="rounded-md border-l-4 border-orange-400 bg-orange-50 p-4">
          <h2 className="text-lg font-semibold">🍹 Sponsored Flow</h2>

          <p className="text-sm text-muted-foreground">
            Someone planned the good times — you just need to join.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {isEditing ? (
          <input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full rounded border px-3 py-2 text-2xl font-bold"
          />
        ) : (
          <h1 className="text-2xl font-bold">
            {meta.title ?? 'Untitled Flow'}
          </h1>
        )}

        {isEditing ? (
          <textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            className="w-full rounded border px-3 py-2 whitespace-pre-line"
          />
        ) : (
          <p className="whitespace-pre-line text-muted-foreground">
            {meta.description ?? ''}
          </p>
        )}

        <SponsorEditButton
          creatorId={meta.creator_id}
          isEditing={isEditing}
          onToggleEdit={() => setIsEditing((prev) => !prev)}
        />

        {isEditing && (
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave}>
              Save Changes
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setEditedTitle(meta.title ?? '');
                setEditedDescription(meta.description ?? '');
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {meta.sponsor_name && (
          <p className="text-sm font-semibold text-purple-600">
            Sponsored by {meta.sponsor_name}
          </p>
        )}

        {meta.datetime && (
          <div className="text-sm text-muted-foreground">
            📅{' '}
            {new Date(meta.datetime).toLocaleString(undefined, {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
            &nbsp;•&nbsp; ⏳ Starts in: <strong>{timeLeft}</strong>
          </div>
        )}

        {maxCapacity > 0 && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              {currentCount} of {maxCapacity} spots claimed
            </p>

            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-2 ${
                  currentCount / maxCapacity > 0.8 ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{
                  width: `${Math.min((currentCount / maxCapacity) * 100, 100)}%`,
                }}
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

      <RSVPButton
        crawlId={meta.crawl_id}
        slug={meta.slug ?? ''}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">🗺️ Flow Stops</h3>

        {venues.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Loading flow stops...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {venues.map((v) => (
                <Card key={v.id} className="flex items-center space-x-3 p-3">
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

                    <div className="text-xs text-muted-foreground">
                      {v.city}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-2">
              <SponsorMapPreview
                key={`map-${meta.crawl_id}`}
                venues={venues}
                useStreetPolyline
                heightPx={300}
              />
            </div>
          </>
        )}
      </div>

      {venues.length > 0 && (
        <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Active Flow
              </p>

              <h3 className="text-lg font-semibold">
                {flowCompleted
                  ? 'Flow completed'
                  : flowStarted
                    ? 'Keep roaming'
                    : 'Start this flow'}
              </h3>

              <p className="text-sm text-muted-foreground">
                Check in at each stop to build progress, earn XP, and complete the crawl.
              </p>
            </div>

            <div className="rounded-full border px-3 py-1 text-sm font-semibold">
              +{estimatedXP} XP
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {completedStops} of {totalStops} stops
              </span>

              <span>{progressPercent}% complete</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {!flowStarted && !flowCompleted && (
            <Button
              type="button"
              className="mt-4 w-full bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => {
                const firstStopButton = document.getElementById('flow-stop-0');
                firstStopButton?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }}
            >
              ▶ Start Flow
            </Button>
          )}

          <ul className="mt-4 space-y-2">
            {venues.map((v, i) => {
              const checked = checkedStops.includes(i);

              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      id={`flow-stop-${i}`}
                      type="button"
                      onClick={() => toggleStop(i)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                        checked
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300 text-gray-400'
                      }`}
                    >
                      {checked ? '✓' : i + 1}
                    </button>

                    <div>
                      <p className="text-sm font-medium">{v.name}</p>

                      <p className="text-xs text-muted-foreground">
                        {checked ? '+25 XP checked in' : 'Tap to check in'}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {flowCompleted && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-semibold text-green-700">
                Flow complete. Badge unlocked: Crawl Finisher.
              </p>

              <p className="text-xs text-green-700/80">
                This completion now contributes to your Roam Passport.
              </p>
            </div>
          )}
        </div>
      )}

      {attendeesWithDetails.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="text-sm font-semibold">
            People joining this flow:
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {attendeesWithDetails.map((a) => (
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