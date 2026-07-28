/**
 * Shared Creator Mode domain types.
 *
 * This file intentionally contains no React, Supabase client,
 * database queries, or runtime validation logic.
 *
 * Runtime validation belongs in:
 *   lib/creator/schemas.ts
 *
 * Database access belongs in:
 *   lib/creator/getCreatorSettings.ts
 *   lib/creator/getPublicCreatorProfile.ts
 *
 * Public Creator Exploration Map contracts belong in:
 *   lib/creator/mapTypes.ts
 *
 * Keep these types aligned with the Creator Mode database migration.
 */

/* =========================================================
 * Primitive Creator Mode unions
 * ======================================================= */

export const CREATOR_SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'website',
  'linkedin',
  'threads',
  'pinterest',
  'x',
] as const

export type CreatorSocialPlatform =
  (typeof CREATOR_SOCIAL_PLATFORMS)[number]

export const COLLABORATION_TAG_CATEGORIES = [
  'campaign',
  'deliverable',
  'industry',
] as const

export type CollaborationTagCategory =
  (typeof COLLABORATION_TAG_CATEGORIES)[number]

export const CREATOR_COLLECTION_VISIBILITIES = [
  'public',
  'private',
] as const

export type CreatorCollectionVisibility =
  (typeof CREATOR_COLLECTION_VISIBILITIES)[number]

export const CREATOR_COLLECTION_SOURCE_TYPES = [
  'venue',
  'property',
  'flow',
  'snapshot',
] as const

export type CreatorCollectionSourceType =
  (typeof CREATOR_COLLECTION_SOURCE_TYPES)[number]

/* =========================================================
 * Profiles table Creator Mode fields
 * ======================================================= */

/**
 * Creator Mode fields added to the existing `profiles` table.
 *
 * `show_public_exploration_map` is an explicit, default-off
 * creator opt-in. Creator Mode must also be enabled before the
 * public map may be displayed.
 */
export type CreatorBaseProfileFields = {
  creator_mode_enabled: boolean
  creator_headline: string | null
  show_public_exploration_map: boolean
}

/**
 * Minimal profile identity needed by Creator Mode loaders.
 */
export type CreatorBaseProfile = CreatorBaseProfileFields & {
  id: string
  username: string | null
}

/* =========================================================
 * creator_profiles
 * ======================================================= */

export type CreatorProfile = {
  user_id: string
  creator_bio: string | null
  primary_city: string | null
  available_for_travel: boolean
  accepting_collaborations: boolean
  public_email: string | null
  created_at: string
  updated_at: string
}

/**
 * Fields editable by the account owner.
 *
 * `user_id`, timestamps, and ownership are intentionally excluded.
 * The authenticated user ID must always be derived server-side.
 */
export type CreatorProfileInput = {
  creator_bio: string | null
  primary_city: string | null
  available_for_travel: boolean
  accepting_collaborations: boolean
  public_email: string | null
}

/* =========================================================
 * creator_social_links
 * ======================================================= */

export type CreatorSocialLink = {
  id: string
  user_id: string
  platform: CreatorSocialPlatform
  url: string
  handle: string | null
  sort_order: number
  is_public: boolean
  created_at: string
  updated_at: string
}

/**
 * Client/server-action shape for editing a social link.
 *
 * `id` is optional because newly added links do not yet have
 * a database-generated UUID.
 */
export type CreatorSocialLinkInput = {
  id?: string
  platform: CreatorSocialPlatform
  url: string
  handle: string | null
  sort_order: number
  is_public: boolean
}

/**
 * Public-safe social-link projection.
 */
export type PublicCreatorSocialLink = Pick<
  CreatorSocialLink,
  | 'id'
  | 'platform'
  | 'url'
  | 'handle'
  | 'sort_order'
>

/* =========================================================
 * collaboration_tags
 * ======================================================= */

export type CollaborationTag = {
  id: number
  slug: string
  label: string
  category: CollaborationTagCategory
  active: boolean
  sort_order: number
  created_at: string
}

export type CreatorCollaborationTag = {
  user_id: string
  tag_id: number
  created_at: string
}

/**
 * Join result shape commonly returned by Supabase nested selects.
 *
 * Example:
 *
 * creator_collaboration_tags (
 *   collaboration_tags (...)
 * )
 */
export type CreatorCollaborationTagWithTag = {
  tag_id?: number
  collaboration_tags: CollaborationTag | null
}

/**
 * Tags grouped for rendering in settings and public profiles.
 */
export type GroupedCollaborationTags = Record<
  CollaborationTagCategory,
  CollaborationTag[]
>

/* =========================================================
 * creator_collections
 * ======================================================= */

export type CreatorCollection = {
  id: string
  user_id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  city: string | null
  category: string | null
  visibility: CreatorCollectionVisibility
  featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CreatorCollectionInput = {
  id?: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  city: string | null
  category: string | null
  visibility: CreatorCollectionVisibility
  featured: boolean
  sort_order: number
}

/* =========================================================
 * creator_collection_items
 * ======================================================= */

export type CreatorCollectionItem = {
  id: string
  collection_id: string
  source_type: CreatorCollectionSourceType
  source_id: string
  custom_title: string | null
  creator_note: string | null
  image_url: string | null
  sort_order: number
  created_at: string
}

export type CreatorCollectionItemInput = {
  id?: string
  collection_id?: string
  source_type: CreatorCollectionSourceType
  source_id: string
  custom_title: string | null
  creator_note: string | null
  image_url: string | null
  sort_order: number
}

/**
 * Collection with its ordered items.
 */
export type CreatorCollectionWithItems = CreatorCollection & {
  items: CreatorCollectionItem[]
}

/**
 * Public collection projection.
 *
 * This prevents public pages from accidentally depending on
 * internal ownership fields.
 */
export type PublicCreatorCollection = Pick<
  CreatorCollection,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'cover_image_url'
  | 'city'
  | 'category'
  | 'featured'
  | 'sort_order'
  | 'created_at'
  | 'updated_at'
>

export type PublicCreatorCollectionWithItems =
  PublicCreatorCollection & {
    items: CreatorCollectionItem[]
  }

/* =========================================================
 * Creator authority
 * ======================================================= */

/**
 * Factual Creator Mode authority metrics derived from Roam data.
 *
 * Do not add subjective metrics such as:
 * - influence score
 * - creator rank
 * - authority percentage
 *
 * unless the calculation is transparent and defensible.
 */
export type CreatorAuthorityStats = {
  primaryCity: string | null
  verifiedVisitCount: number
  completedFlowCount: number
  publicSnapshotCount: number
  publicCollectionCount: number
}

/**
 * Optional future expansion for richer local authority.
 *
 * These fields should only be populated after the underlying
 * venue geography/category data is reliable.
 */
export type ExtendedCreatorAuthorityStats =
  CreatorAuthorityStats & {
    cityCount?: number
    neighborhoodCount?: number
    topCategories?: string[]
  }

/* =========================================================
 * Public Creator Mode bundle
 * ======================================================= */

/**
 * Data required to render the Creator Mode layer on:
 *
 *   app/u/[username]/page.tsx
 */
export type PublicCreatorBundle = {
  profile: CreatorProfile
  socialLinks: PublicCreatorSocialLink[]
  collaborationTags: CollaborationTag[]
  featuredCollections: PublicCreatorCollection[]
}

/**
 * Public Creator Mode bundle with derived authority metrics.
 *
 * Useful when the page loader prefers to return one complete object.
 */
export type PublicCreatorProfileViewModel =
  PublicCreatorBundle & {
    headline: string | null
    authority: CreatorAuthorityStats
  }

/* =========================================================
 * Authenticated Creator settings
 * ======================================================= */

export type CreatorSettingsBaseProfile = {
  id: string
  username: string | null
  creator_mode_enabled: boolean
  creator_headline: string | null
  show_public_exploration_map: boolean
}

export type CreatorSettingsData = {
  userId: string
  baseProfile: CreatorSettingsBaseProfile
  creatorProfile: CreatorProfile | null
  socialLinks: CreatorSocialLink[]
  selectedTagIds: number[]
  availableTags: CollaborationTag[]
}

/**
 * Complete payload sent from the Creator Mode settings form
 * to the save server action.
 */
export type CreatorSettingsInput = {
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
  creatorHeadline: string | null
  creatorBio: string | null
  primaryCity: string | null
  availableForTravel: boolean
  acceptingCollaborations: boolean
  publicEmail: string | null
  socialLinks: CreatorSocialLinkInput[]
  collaborationTagIds: number[]
}

/* =========================================================
 * Server-action result types
 * ======================================================= */

export type CreatorActionFieldErrors = Partial<
  Record<
    | 'creatorModeEnabled'
    | 'showPublicExplorationMap'
    | 'creatorHeadline'
    | 'creatorBio'
    | 'primaryCity'
    | 'availableForTravel'
    | 'acceptingCollaborations'
    | 'publicEmail'
    | 'socialLinks'
    | 'collaborationTagIds'
    | 'title'
    | 'slug'
    | 'description'
    | 'coverImageUrl'
    | 'city'
    | 'category'
    | 'visibility'
    | 'featured'
    | 'items',
    string[]
  >
>

export type CreatorActionSuccess<T = undefined> = {
  success: true
  data?: T
  error?: never
  fieldErrors?: never
}

export type CreatorActionFailure = {
  success: false
  error: string
  fieldErrors?: CreatorActionFieldErrors
  data?: never
}

export type CreatorActionResult<T = undefined> =
  | CreatorActionSuccess<T>
  | CreatorActionFailure

/* =========================================================
 * Public creator-page utility types
 * ======================================================= */

export type CreatorAvailability = {
  acceptingCollaborations: boolean
  availableForTravel: boolean
}

export type CreatorIdentity = {
  headline: string | null
  bio: string | null
  primaryCity: string | null
  availability: CreatorAvailability
}

export type CreatorPublicProfileSection =
  | 'identity'
  | 'socials'
  | 'collaborations'
  | 'authority'
  | 'collections'

/* =========================================================
 * Type guards
 * ======================================================= */

export function isCreatorSocialPlatform(
  value: unknown
): value is CreatorSocialPlatform {
  return (
    typeof value === 'string' &&
    (
      CREATOR_SOCIAL_PLATFORMS as readonly string[]
    ).includes(value)
  )
}

export function isCollaborationTagCategory(
  value: unknown
): value is CollaborationTagCategory {
  return (
    typeof value === 'string' &&
    (
      COLLABORATION_TAG_CATEGORIES as readonly string[]
    ).includes(value)
  )
}

export function isCreatorCollectionVisibility(
  value: unknown
): value is CreatorCollectionVisibility {
  return (
    typeof value === 'string' &&
    (
      CREATOR_COLLECTION_VISIBILITIES as readonly string[]
    ).includes(value)
  )
}

export function isCreatorCollectionSourceType(
  value: unknown
): value is CreatorCollectionSourceType {
  return (
    typeof value === 'string' &&
    (
      CREATOR_COLLECTION_SOURCE_TYPES as readonly string[]
    ).includes(value)
  )
}

/* =========================================================
 * Collection helpers
 * ======================================================= */

export function groupCollaborationTags(
  tags: CollaborationTag[]
): GroupedCollaborationTags {
  return tags.reduce<GroupedCollaborationTags>(
    (groups, tag) => {
      groups[tag.category].push(tag)
      return groups
    },
    {
      campaign: [],
      deliverable: [],
      industry: [],
    }
  )
}

export function sortCreatorSocialLinks<
  T extends Pick<CreatorSocialLink, 'sort_order'>
>(links: T[]): T[] {
  return [...links].sort(
    (a, b) => a.sort_order - b.sort_order
  )
}

export function sortCreatorCollections<
  T extends Pick<
    CreatorCollection,
    'featured' | 'sort_order' | 'created_at'
  >
>(collections: T[]): T[] {
  return [...collections].sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1
    }

    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order
    }

    return (
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
    )
  })
}

export function sortCreatorCollectionItems<
  T extends Pick<CreatorCollectionItem, 'sort_order'>
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order
  )
}