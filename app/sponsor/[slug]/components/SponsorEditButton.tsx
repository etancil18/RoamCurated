// app/sponsor/[slug]/components/SponsorEditButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface Props {
  creatorId: string;
  slug: string;
}

export default function SponsorEditButton({ creatorId, slug }: Props) {
  const [canEdit, setCanEdit] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error('[SponsorEditButton] auth error:', error);
        return;
      }
      if (user?.id === creatorId) {
        setCanEdit(true);
      }
    };
    checkUser();
  }, [creatorId]);

  if (!canEdit) return null;

  return (
    <Button onClick={() => router.push(`/sponsor/${slug}/edit`)}>
      Edit Crawl
    </Button>
  );
}
