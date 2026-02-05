'use client';

import { SponsorVenue } from '@/types/sponsor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import VenueSelector from './VenueSelector';
import { SponsorMapPreview } from '@/components/maps/map-dynamic-wrapper'


type Props = {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  datetime: string;
  setDatetime: (val: string) => void;
  venues: SponsorVenue[];
  setVenues: (v: SponsorVenue[]) => void;
  rsvpEnabled: boolean;
  setRsvpEnabled: (v: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
};

export default function SponsorForm({
  title,
  setTitle,
  description,
  setDescription,
  datetime,
  setDatetime,
  venues,
  setVenues,
  rsvpEnabled,
  setRsvpEnabled,
  submitting,
  onSubmit,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sunset Rooftop Crawl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's the vibe of this crawl?"
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
        <Switch id="rsvp" checked={rsvpEnabled} onCheckedChange={setRsvpEnabled} />
      </div>

      <Button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full mt-4"
      >
        {submitting ? 'Publishing...' : 'Publish Crawl'}
      </Button>
    </div>
  );
}
