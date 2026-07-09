'use client';

// app/sponsor-crawl/page.tsx

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
        alert('Failed to create flow.');
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
    <main className="min-h-screen overflow-hidden bg-black px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-12%] h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
            Creator Mode
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Host a Flow
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Build a multi-stop city experience people can join, share, complete, and remember.
          </p>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-black tracking-tight text-white">
              Discover Flows
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Search playable city flows created by Roam users.
            </p>
          </div>

          <CrawlSearch />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="mb-7 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
              Flow Builder
            </p>

            <h2 className="text-2xl font-black tracking-tight text-white">
              Create a Playable City Flow
            </h2>

            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              Published flows contribute to your Roam Passport and can earn creator reputation through saves, shares, RSVPs, completions, and repeat usage.
            </p>
          </div>

          <div className="grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-bold text-slate-300">
                Flow Title
              </Label>

              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SoHo Patio Flow"
                className="h-12 rounded-2xl border-white/10 bg-black/45 text-white placeholder:text-slate-600 focus:border-cyan-400/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold text-slate-300">
                Description
              </Label>

              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is the vibe? Who is this flow for?"
                className="min-h-28 rounded-2xl border-white/10 bg-black/45 text-white placeholder:text-slate-600 focus:border-cyan-400/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="datetime" className="text-sm font-bold text-slate-300">
                Date & Time Optional
              </Label>

              <Input
                id="datetime"
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-black/45 text-white focus:border-cyan-400/60"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-300">
                Flow Stops
              </Label>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <VenueSelector selected={venues} setSelected={setVenues} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <SponsorMapPreview
                  venues={venues}
                  mapboxAccessToken={MAPBOX_TOKEN}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleCard
                label="Allow RSVPs"
                description="Let people join this flow."
                checked={rsvpEnabled}
                onCheckedChange={setRsvpEnabled}
                id="rsvp"
                color="green"
              />

              <ToggleCard
                label="Public Flow"
                description={isPublic ? 'Visible in discovery.' : 'Direct link only.'}
                checked={isPublic}
                onCheckedChange={setIsPublic}
                id="isPublic"
                color="indigo"
              />

              <ToggleCard
                label="Sponsored"
                description="Attach a sponsor name."
                checked={isSponsored}
                onCheckedChange={setIsSponsored}
                id="isSponsored"
                color="purple"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxCapacity" className="text-sm font-bold text-slate-300">
                Max Attendees Optional
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
                className="h-12 rounded-2xl border-white/10 bg-black/45 text-white placeholder:text-slate-600 focus:border-cyan-400/60"
              />
            </div>

            {isSponsored && (
              <div className="space-y-2">
                <Label htmlFor="sponsorName" className="text-sm font-bold text-slate-300">
                  Sponsor Name
                </Label>

                <Input
                  id="sponsorName"
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder="e.g. Liquid Death"
                  className="h-12 rounded-2xl border-white/10 bg-black/45 text-white placeholder:text-slate-600 focus:border-cyan-400/60"
                />
              </div>
            )}

            <div className="rounded-[1.5rem] border border-indigo-400/25 bg-indigo-500/10 p-5 shadow-inner">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
                Flow Rewards
              </p>

              <h3 className="mt-2 text-xl font-black text-white">
                Publish this as a playable city flow
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Flows you host become part of your Roam Passport. Friends can join, complete the flow, and help increase your creator reputation.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <RewardCard label="Host reward" value="+75 XP" />
                <RewardCard label="Stops in flow" value={String(venues.length)} />
                <RewardCard label="Discovery status" value={isPublic ? 'Ranked' : 'Private'} />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-slate-400">
                Flow Score starts building from saves, shares, RSVPs, completions, and repeat usage.
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-sm font-black text-white shadow-lg shadow-cyan-950/30 transition hover:from-indigo-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Publishing Flow...' : 'Publish Flow'}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ToggleCard({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  color,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  color: 'green' | 'indigo' | 'purple';
}) {
  const checkedColor =
    color === 'green'
      ? 'data-[state=checked]:bg-emerald-500'
      : color === 'purple'
        ? 'data-[state=checked]:bg-purple-500'
        : 'data-[state=checked]:bg-indigo-500';

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-black text-white">
          {label}
        </Label>

        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          className={clsx(
            'relative h-6 w-10 rounded-full bg-slate-700 transition-colors',
            checkedColor,
            'after:absolute after:left-0.5 after:top-0.5 after:block after:h-5 after:w-5 after:rounded-full after:bg-white after:content-[""]',
            'after:transition-transform after:duration-200 data-[state=checked]:after:translate-x-4'
          )}
        />
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function RewardCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}