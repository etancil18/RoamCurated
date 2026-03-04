'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface Props {
  creatorId: string;
  onToggleEdit: () => void;
  isEditing: boolean;
}

export default function SponsorEditButton({
  creatorId,
  onToggleEdit,
  isEditing,
}: Props) {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOwnership = async () => {
      const supabase = supabaseBrowser();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsOwner(false);
        return;
      }

      setIsOwner(user.id === creatorId);
    };

    checkOwnership();
  }, [creatorId]);

  // prevent UI flicker while auth check runs
  if (isOwner === null) return null;

  // hide button for non-creators
  if (!isOwner) return null;

  return (
    <Button
      variant={isEditing ? 'secondary' : 'default'}
      onClick={onToggleEdit}
    >
      {isEditing ? 'Cancel Editing' : 'Edit Crawl'}
    </Button>
  );
}