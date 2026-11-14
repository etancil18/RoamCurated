
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  getCreatorSuggestionEligibility,
} from '@/lib/creator/getCreatorSuggestionEligibility'

import {
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin'

import {
  createServerClient,
} from '@/lib/supabase/server'

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value.trim() || null
        : value === undefined
          ? null
          : value,
    z.string().max(maxLength).nullable()
  )

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value.trim() || null
      : value === undefined
        ? null
        : value,
  z
    .string()
    .max(2048)
    .nullable()
    .refine(
      (value) => {
        if (value === null) return true

        try {
          const url = new URL(value)

          return (
            (url.protocol === 'https:' ||
              url.protocol === 'http:') &&
            Boolean(url.hostname) &&
            !url.username &&
            !url.password
          )
        } catch {
          return false
        }
      },
      'Enter a valid HTTP or HTTPS URL.'
    )
)

const suggestionSchema = z.object({
  collectionId: z.string().uuid().nullable(),

  venueName: z.string().trim().min(1).max(160),

  city: z.string().trim().min(1).max(160),

  address: optionalText(300),

  category: optionalText(120),

  websiteUrl: optionalUrl,

  instagramUrl: optionalUrl,

  creatorNote: optionalText(600),
}).strict()

export type SuggestCreatorVenueResult =
  | {
      success: true
      data: {
        submissionId: string
        collectionItemId: string | null
        reused: boolean
      }
    }
  | {
      success: false
      error: string
    }

type SubmissionRpcRow = {
  submission_id: string
  collection_item_id: string | null
  reused: boolean
}

export async function suggestCreatorVenueAction(
  input: unknown
): Promise<SuggestCreatorVenueResult> {
  const parsed = suggestionSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error:
        'Check the place details and try again.',
    }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      success: false,
      error:
        'Sign in to suggest a place.',
    }
  }

  let eligibility: Awaited<
    ReturnType<typeof getCreatorSuggestionEligibility>
  >

  try {
    eligibility =
      await getCreatorSuggestionEligibility()
  } catch (error) {
    console.error(
      '[suggestCreatorVenueAction] Eligibility failed:',
      error
    )

    return {
      success: false,
      error:
        'Creator eligibility could not be verified. Please try again.',
    }
  }

  if (
    !eligibility.userId ||
    eligibility.userId !== user.id
  ) {
    return {
      success: false,
      error:
        'Your session could not be verified.',
    }
  }

  const collectionId = parsed.data.collectionId

  if (collectionId) {
    if (!eligibility.canSuggestInCollection) {
      return {
        success: false,
        error:
          'Complete all five creator readiness requirements and activate Creator Mode before suggesting places.',
      }
    }
  } else if (!eligibility.canSuggestStandalone) {
    return {
      success: false,
      error:
        'Activate Creator Mode, complete your creator readiness requirements, and create at least one public collection to suggest a place.',
    }
  }

  const normalizedCity = normalizeCityKey(
    parsed.data.city
  )

  if (
    !normalizedCity ||
    !isSupportedCityKey(normalizedCity)
  ) {
    return {
      success: false,
      error:
        'Select a supported Roam city.',
    }
  }

  let collectionSlug: string | null = null

  if (collectionId) {
    const { data: collection, error } =
      await supabase
        .from('creator_collections')
        .select('id, slug, city')
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) {
      return {
        success: false,
        error:
          'Could not verify collection ownership.',
      }
    }

    if (!collection) {
      return {
        success: false,
        error:
          'Collection not found or access denied.',
      }
    }

    collectionSlug = collection.slug

    if (
      collection.city &&
      normalizeCityKey(collection.city) !==
        normalizedCity
    ) {
      return {
        success: false,
        error:
          'The suggested place must match the collection city.',
      }
    }
  }

  // This client must remain exclusively server-side.
  // Never expose the service-role key to the browser.
  const admin = getSupabaseAdmin()

  const { data, error } = await admin.rpc(
    'roam_submit_creator_venue',
    {
      p_creator_id: user.id,
      p_venue_name: parsed.data.venueName,
      p_city: normalizedCity,
      p_collection_id: collectionId,
      p_address: parsed.data.address,
      p_category: parsed.data.category,
      p_website_url: parsed.data.websiteUrl,
      p_instagram_url: parsed.data.instagramUrl,
      p_creator_note: parsed.data.creatorNote,
    }
  )

  if (error) {
    console.error(
      '[suggestCreatorVenueAction] Submission failed:',
      {
        code: error.code,
        message: error.message,
      }
    )

    if (
      error.message.includes(
        'Daily suggestion limit reached'
      )
    ) {
      return {
        success: false,
        error:
          'You have reached the daily suggestion limit. Try again later.',
      }
    }

    if (
      error.message.includes(
        'Collection has reached its item limit'
      )
    ) {
      return {
        success: false,
        error:
          'This collection has reached its item limit.',
      }
    }

    return {
      success: false,
      error:
        'The place could not be submitted. Please review the details and try again.',
    }
  }

  const row = (
    Array.isArray(data) ? data[0] : null
  ) as SubmissionRpcRow | null

  if (
    !row ||
    typeof row.submission_id !== 'string' ||
    (
      collectionId !== null &&
      typeof row.collection_item_id !== 'string'
    )
  ) {
    console.error(
      '[suggestCreatorVenueAction] Invalid RPC response.'
    )

    return {
      success: false,
      error:
        'The submission result could not be confirmed. Refresh the page before trying again.',
    }
  }

  revalidatePath('/profile')
  revalidatePath('/profile/creator')
  revalidatePath('/profile/creator/collections')

  if (collectionId) {
    revalidatePath(
      `/profile/creator/collections/${collectionId}`
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.username && collectionSlug) {
      revalidatePath(
        `/u/${encodeURIComponent(
          profile.username
        )}/collections/${encodeURIComponent(
          collectionSlug
        )}`
      )
    }
  }

  return {
    success: true,
    data: {
      submissionId: row.submission_id,
      collectionItemId:
        row.collection_item_id,
      reused: row.reused === true,
    },
  }
}
