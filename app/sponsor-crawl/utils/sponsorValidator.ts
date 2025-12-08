import { SponsorVenue } from '@/types/sponsor';

type ValidationError = {
  field: string;
  message: string;
};

export function validateSponsorCrawl({
  title,
  venues,
}: {
  title: string;
  venues: SponsorVenue[];
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!title || title.trim().length < 3) {
    errors.push({
      field: 'title',
      message: 'Title must be at least 3 characters long.',
    });
  }

  if (!venues || venues.length < 2) {
    errors.push({
      field: 'venues',
      message: 'You must select at least 2 venues.',
    });
  }

  if (venues.length > 6) {
    errors.push({
      field: 'venues',
      message: 'You can select up to 6 venues only.',
    });
  }

  return errors;
}
