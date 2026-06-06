'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSponsorCrawl } from '@/lib/supabase/sponsor';
import { SponsorVenue, SponsorCrawlPayload } from '@/types/sponsor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createSlug } from '@/utils/slug';
import VenueSelector from './components/VenueSelector';
import { SponsorMapPreview } from '@/components/maps/map-dynamic-wrapper';
import CrawlSearch from './components/CrawlSearch';
import clsx from 'clsx';

const MAPBOX_TOKEN: string = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export default function SponsorCrawlPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [datetime, setDatetime] = useState('');
  const [venues, setVenues] = useState<SponsorVenue[]>([]);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState<number | ''>('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!searchParams) return;

    const slugParam = searchParams.get('slugs');
    if (!slugParam) return;

    const slugs = slugParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (slugs.length > 0) {
      fetch(`/api/venues/by-slugs?slugs=${slugs.join(',')}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.venues)) {
            setVenues(data.venues);
          }
        })
        .catch((err) => {
          console.error('Error preloading venues:', err);
        });
    }
  }, [searchParams]);

  const handleCreate = async () => {
    if (!title || venues.length < 2) {
      alert('Title and at least 2 venues required.');
      return;
    }

    try {
      setSubmitting(true);
      const slug = createSlug(title);

      const payload: SponsorCrawlPayload = {
        title,
        description,
        datetime: datetime ? new Date(datetime).toISOString() : null,
        venue_ids: venues.map((v) => v.id),
        city: venues[0]?.city || '',
        vibe_tags: [],
        rsvp_enabled: rsvpEnabled,
        slug,
        max_capacity: maxCapacity === '' ? undefined : Number(maxCapacity),
        is_sponsored: isSponsored,
        sponsor_name: isSponsored ? sponsorName : undefined,
        is_public: isPublic,
      };

      const { data, error } = await createSponsorCrawl(payload);

      if (error || !data?.slug) {
        console.error('Creation error:', error);
        alert('Failed to create crawl.');
        return;
      }

      const redirectSlug = data.public_id ?? data.slug;

      router.push(`/sponsor/${redirectSlug}`);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 pb-4 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">
      {/* 🔎 SEARCH SECTION */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔎 Discover Flows
          </h2>

          <p className="text-sm text-muted-foreground dark:text-neutral-400">
            Search for playable city flows created by Roam users.
          </p>
        </div>

        <CrawlSearch />
      </section>

      <div className="border-t border-gray-200 dark:border-neutral-700" />

      {/* 🧱 CREATE SECTION */}
      <section className="space-y-6 rounded-lg bg-white p-4 text-gray-900 shadow-md dark:bg-gray-900 dark:text-gray-100 sm:p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Creator Mode
          </p>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Host a Crawl / Create a Flow
          </h2>

          <p className="text-sm text-muted-foreground dark:text-neutral-400">
            Build a multi-stop experience people can join, share, complete, and
            remember. Every published flow contributes to your Roam Passport.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">
            Title
          </Label>

          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SoHo Patio Crawl"
            className="border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="description"
            className="text-gray-700 dark:text-gray-300"
          >
            Description
          </Label>

          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the vibe?"
            className="border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="datetime"
            className="text-gray-700 dark:text-gray-300"
          >
            Date & Time (optional)
          </Label>

          <Input
            id="datetime"
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-700 dark:text-gray-300">Venues</Label>

          <VenueSelector selected={venues} setSelected={setVenues} />

          <SponsorMapPreview
            venues={venues}
            mapboxAccessToken={MAPBOX_TOKEN}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Label htmlFor="rsvp" className="text-gray-700 dark:text-gray-300">
            Allow RSVPs?
          </Label>

          <Switch
            id="rsvp"
            checked={rsvpEnabled}
            onCheckedChange={setRsvpEnabled}
            className={clsx(
              'relative h-6 w-10 rounded-full bg-gray-300 transition-colors dark:bg-gray-700 data-[state=checked]:bg-green-600',
              'after:absolute after:left-0.5 after:top-0.5 after:block after:h-4 after:w-4 after:rounded-full after:bg-white after:content-[""]',
              'after:transition-transform after:duration-200 data-[state=checked]:after:translate-x-5'
            )}
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="maxCapacity"
            className="text-gray-700 dark:text-gray-300"
          >
            Max Attendees (optional)
          </Label>

          <Input
            id="maxCapacity"
            type="number"
            value={maxCapacity}
            onChange={(e) =>
              setMaxCapacity(e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder="e.g. 50"
            min={1}
            className="border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Label
            htmlFor="isPublic"
            className="text-gray-700 dark:text-gray-300"
          >
            Make this flow public?
          </Label>

          <Switch
            id="isPublic"
            checked={isPublic}
            onCheckedChange={setIsPublic}
            className={clsx(
              'relative h-6 w-10 rounded-full bg-gray-300 transition-colors dark:bg-gray-700 data-[state=checked]:bg-indigo-600',
              'after:absolute after:left-0.5 after:top-0.5 after:block after:h-4 after:w-4 after:rounded-full after:bg-white after:content-[""]',
              'after:transition-transform after:duration-200 data-[state=checked]:after:translate-x-5'
            )}
          />
        </div>

        <p className="text-xs text-muted-foreground dark:text-neutral-400">
          {isPublic
            ? 'Visible to everyone in search, discovery, and future rankings.'
            : 'Hidden from discovery. Still accessible via direct link.'}
        </p>

        <div className="flex items-center justify-between pt-2">
          <Label
            htmlFor="isSponsored"
            className="text-gray-700 dark:text-gray-300"
          >
            Is this flow sponsored?
          </Label>

          <Switch
            id="isSponsored"
            checked={isSponsored}
            onCheckedChange={setIsSponsored}
            className={clsx(
              'relative h-6 w-10 rounded-full bg-gray-300 transition-colors dark:bg-gray-700 data-[state=checked]:bg-purple-600',
              'after:absolute after:left-0.5 after:top-0.5 after:block after:h-4 after:w-4 after:rounded-full after:bg-white after:content-[""]',
              'after:transition-transform after:duration-200 data-[state=checked]:after:translate-x-5'
            )}
          />
        </div>

        {isSponsored && (
          <div className="space-y-2">
            <Label
              htmlFor="sponsorName"
              className="text-gray-700 dark:text-gray-300"
            >
              Sponsor Name
            </Label>

            <Input
              id="sponsorName"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              placeholder="e.g. Liquid Death"
              className="border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        )}

        {/* 🕹️ FLOW REWARDS PREVIEW */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Flow Rewards
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Publish this as a playable city flow
            </h3>

            <p className="text-sm text-muted-foreground dark:text-neutral-400">
              Crawls you host become part of your Roam Passport. Friends can
              join, complete the flow, and help increase your creator reputation.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-black/30">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                +75 XP
              </p>

              <p className="text-xs text-muted-foreground dark:text-neutral-400">
                Host reward
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-black/30">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {venues.length}
              </p>

              <p className="text-xs text-muted-foreground dark:text-neutral-400">
                Stops in flow
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900/50 dark:bg-black/30">
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {isPublic ? 'Ranked' : 'Private'}
              </p>

              <p className="text-xs text-muted-foreground dark:text-neutral-400">
                Discovery status
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white p-3 text-xs text-muted-foreground dark:bg-black/30 dark:text-neutral-400">
            Flow Score starts building from saves, shares, RSVPs, completions,
            and repeat usage.
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={submitting}
          className="mt-4 w-full bg-blue-600 font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {submitting ? 'Publishing Flow...' : 'Publish Flow'}
        </Button>
      </section>
    </div>
  );
}