'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSponsorCrawl } from '@/lib/supabase/sponsor';
import { SponsorVenue, SponsorCrawlPayload } from '@/types/sponsor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { createSlug } from '@/utils/slug';
import VenueSelector from './components/VenueSelector';
import SponsorMapPreview from './components/SponsorMapPreview';
import clsx from 'clsx';

export default function SponsorCrawlPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [datetime, setDatetime] = useState('');
  const [venues, setVenues] = useState<SponsorVenue[]>([]);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [maxCapacity, setMaxCapacity] = useState<number | ''>('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Host a Crawl</h1>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. SoHo Patio Crawl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's the vibe?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="datetime">Date & Time (optional)</Label>
        <Input
          id="datetime"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Venues</Label>
        <VenueSelector selected={venues} setSelected={setVenues} />
        <SponsorMapPreview venues={venues} />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Label htmlFor="rsvp">Allow RSVPs?</Label>
        <Switch
          id="rsvp"
          checked={rsvpEnabled}
          onCheckedChange={setRsvpEnabled}
          className={clsx(
            'bg-gray-300 data-[state=checked]:bg-green-600',
            'transition-colors relative',
            'after:content-[""] after:block after:absolute after:bg-white after:rounded-full after:h-4 after:w-4 after:top-0.5 after:left-0.5',
            'data-[state=checked]:after:translate-x-5 after:transition-transform after:duration-200',
            'w-10 h-6 rounded-full'
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxCapacity">Max Attendees (optional)</Label>
        <Input
          id="maxCapacity"
          type="number"
          value={maxCapacity}
          onChange={(e) => setMaxCapacity(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="e.g. 50"
          min={1}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Label htmlFor="isSponsored">Is this crawl sponsored?</Label>
        <Switch
          id="isSponsored"
          checked={isSponsored}
          onCheckedChange={setIsSponsored}
          className={clsx(
            'bg-gray-300 data-[state=checked]:bg-purple-600',
            'transition-colors relative',
            'after:content-[""] after:block after:absolute after:bg-white after:rounded-full after:h-4 after:w-4 after:top-0.5 after:left-0.5',
            'data-[state=checked]:after:translate-x-5 after:transition-transform after:duration-200',
            'w-10 h-6 rounded-full'
          )}
        />
      </div>

      {isSponsored && (
        <div className="space-y-2">
          <Label htmlFor="sponsorName">Sponsor Name</Label>
          <Input
            id="sponsorName"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="e.g. Liquid Death"
          />
        </div>
      )}

      <Button
        onClick={handleCreate}
        disabled={submitting}
        className="w-full mt-4"
      >
        {submitting ? 'Publishing...' : 'Publish Crawl'}
      </Button>
    </div>
  );
}
