'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

type Crawl = {
  id: string;
  title: string;
  slug: string;
  public_id: string | null;
  datetime: string | null;
  city: string | null;
};

export default function CrawlSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Crawl[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('crawl_events')
        .select('id, title, slug, public_id, datetime, city')
        .eq('is_public', true)
        .or(`title.ilike.%${query}%,city.ilike.%${query}%`)
        .order('datetime', { ascending: true })
        .limit(10);

      if (!error && data) {
        setResults(data);
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(delay);
  }, [query]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search existing crawls..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white"
      />

      {loading && (
        <p className="text-sm text-muted-foreground dark:text-neutral-400">
          Searching...
        </p>
      )}

      {results.length > 0 && (
        <div className="grid gap-2">
          {results.map((crawl) => (
            <Link
              key={crawl.id}
              href={`/sponsor/${crawl.public_id ?? crawl.slug}`}
            >
              <Card className="hover:shadow-md transition cursor-pointer bg-white dark:bg-neutral-800 border dark:border-neutral-700">
                <CardContent className="p-3">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {crawl.title}
                  </p>

                  <p className="text-xs text-muted-foreground dark:text-neutral-400">
                    {crawl.city} •{' '}
                    {crawl.datetime
                      ? new Date(crawl.datetime).toLocaleDateString()
                      : 'No date'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}