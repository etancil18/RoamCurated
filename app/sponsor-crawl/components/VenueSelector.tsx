'use client';

import { useState, useEffect } from 'react';
import { SponsorVenue } from '@/types/sponsor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabaseBrowser } from '@/lib/supabase/client';

type Props = {
  selected: SponsorVenue[];
  setSelected: (v: SponsorVenue[]) => void;
};

export default function VenueSelector({ selected, setSelected }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SponsorVenue[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = supabaseBrowser();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const fetchVenues = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, lat, lon, city')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (error) {
        console.error('Venue fetch error:', error);
      } else {
        // ✅ Fix: Map Supabase “lon” → SponsorVenue “lng”
        const mapped = (data || []).map((v) => ({
          id: v.id,
          name: v.name ?? '',
          lat: v.lat ?? 0,
          lng: v.lon ?? 0,
          city: v.city ?? '',
        }));
        setResults(mapped);
      }
      setLoading(false);
    };

    const delay = setTimeout(fetchVenues, 300);
    return () => clearTimeout(delay);
  }, [query]);

  const addVenue = (venue: SponsorVenue) => {
    if (selected.find((v) => v.id === venue.id)) return;
    if (selected.length >= 6) {
      alert('Max 6 venues per crawl.');
      return;
    }
    setSelected([...selected, venue]);
  };

  const removeVenue = (id: string) => {
    setSelected(selected.filter((v) => v.id !== id));
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search venues by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {results.length > 0 && (
        <div className="space-y-2 border p-3 rounded-md bg-muted">
          {results.map((venue) => (
            <div
              key={venue.id}
              className={cn(
                'flex items-center justify-between px-2 py-1 rounded-md',
                selected.find((v) => v.id === venue.id)
                  ? 'bg-muted-foreground/10'
                  : ''
              )}
            >
              <div>
                <div className="font-medium">{venue.name}</div>
                <div className="text-sm text-muted-foreground">{venue.city}</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => addVenue(venue)}
                disabled={!!selected.find((v) => v.id === venue.id)}
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Selected Venues:</h4>
          <ul className="space-y-1">
            {selected.map((v, i) => (
              <li
                key={v.id}
                className="flex items-center justify-between bg-muted p-2 rounded-md"
              >
                <span>
                  {i + 1}. {v.name} — {v.city}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVenue(v.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
