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

  // ✅ Pre-populate venues from slug query param
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
      };

      const { data, error } = await createSponsorCrawl(payload);

      if (error || !data?.slug) {
        console.error('Creation error:', error);
        alert('Failed to create crawl.');
        return;
      }

      router.push(`/sponsor/${data.slug}`);
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg shadow-md sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Host a Crawl</h1>

      <div className="space-y-2">
        <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. SoHo Patio Crawl"
          className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's the vibe?"
          className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="datetime" className="text-gray-700 dark:text-gray-300">Date & Time (optional)</Label>
        <Input
          id="datetime"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-gray-700 dark:text-gray-300">Venues</Label>
        <VenueSelector selected={venues} setSelected={setVenues} />
        <SponsorMapPreview venues={venues} 
        mapboxAccessToken={MAPBOX_TOKEN}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Label htmlFor="rsvp" className="text-gray-700 dark:text-gray-300">Allow RSVPs?</Label>
        <Switch
          id="rsvp"
          checked={rsvpEnabled}
          onCheckedChange={setRsvpEnabled}
          className={clsx(
            'bg-gray-300 dark:bg-gray-700 data-[state=checked]:bg-green-600',
            'transition-colors relative',
            'after:content-[""] after:block after:absolute after:bg-white after:rounded-full after:h-4 after:w-4 after:top-0.5 after:left-0.5',
            'data-[state=checked]:after:translate-x-5 after:transition-transform after:duration-200',
            'w-10 h-6 rounded-full'
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxCapacity" className="text-gray-700 dark:text-gray-300">Max Attendees (optional)</Label>
        <Input
          id="maxCapacity"
          type="number"
          value={maxCapacity}
          onChange={(e) =>
            setMaxCapacity(e.target.value === '' ? '' : Number(e.target.value))
          }
          placeholder="e.g. 50"
          min={1}
          className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Label htmlFor="isSponsored" className="text-gray-700 dark:text-gray-300">Is this crawl sponsored?</Label>
        <Switch
          id="isSponsored"
          checked={isSponsored}
          onCheckedChange={setIsSponsored}
          className={clsx(
            'bg-gray-300 dark:bg-gray-700 data-[state=checked]:bg-purple-600',
            'transition-colors relative',
            'after:content-[""] after:block after:absolute after:bg-white after:rounded-full after:h-4 after:w-4 after:top-0.5 after:left-0.5',
            'data-[state=checked]:after:translate-x-5 after:transition-transform after:duration-200',
            'w-10 h-6 rounded-full'
          )}
        />
      </div>

      {isSponsored && (
        <div className="space-y-2">
          <Label htmlFor="sponsorName" className="text-gray-700 dark:text-gray-300">Sponsor Name</Label>
          <Input
            id="sponsorName"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="e.g. Liquid Death"
            className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      )}

      <Button
        onClick={handleCreate}
        disabled={submitting}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold"
      >
        {submitting ? 'Publishing...' : 'Publish Crawl'}
      </Button>
    </div>
  );
}
