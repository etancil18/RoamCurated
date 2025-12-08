'use client';

import { useState } from 'react';
import { SponsorVenue } from '@/types/sponsor';

export function useSponsorBuilder() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [datetime, setDatetime] = useState('');
  const [venues, setVenues] = useState<SponsorVenue[]>([]);
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const resetBuilder = () => {
    setTitle('');
    setDescription('');
    setDatetime('');
    setVenues([]);
    setRsvpEnabled(true);
    setSubmitting(false);
  };

  return {
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
    setSubmitting,
    resetBuilder,
  };
}
