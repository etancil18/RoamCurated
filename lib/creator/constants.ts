/**
 * Creator Mode runtime constants and product configuration.
 *
 * This file contains fixed Creator Mode vocabulary and defaults used by:
 *
 * - validation schemas
 * - settings forms
 * - public creator profiles
 * - server actions
 * - social-link validation
 * - collection editors
 *
 * Domain types and primitive unions live in:
 *
 *   lib/creator/types.ts
 *
 * Keep database constraints, validation schemas, and the limits in this file
 * aligned whenever Creator Mode fields change.
 */

import {
  COLLABORATION_TAG_CATEGORIES,
  CREATOR_COLLECTION_SOURCE_TYPES,
  CREATOR_COLLECTION_VISIBILITIES,
  CREATOR_SOCIAL_PLATFORMS,
  type CollaborationTagCategory,
  type CreatorCollectionSourceType,
  type CreatorCollectionVisibility,
  type CreatorSocialPlatform,
} from './types'

/* =========================================================
 * Creator Mode product defaults
 * ======================================================= */

export const CREATOR_MODE_DEFAULTS = {
  enabled: false,
  availableForTravel: false,
  acceptingCollaborations: true,
  socialLinksPublic: true,
  collectionVisibility: 'public',
  collectionFeatured: false,
} as const satisfies {
  enabled: boolean
  availableForTravel: boolean
  acceptingCollaborations: boolean
  socialLinksPublic: boolean
  collectionVisibility: CreatorCollectionVisibility
  collectionFeatured: boolean
}

/* =========================================================
 * Creator Mode field limits
 *
 * Keep these synchronized with:
 *
 * - Supabase database constraints
 * - lib/creator/schemas.ts
 * - form input maxLength values
 * ======================================================= */

export const CREATOR_FIELD_LIMITS = {
  headline: 100,
  bio: 600,
  primaryCity: 100,
  publicEmail: 320,

  socialUrl: 2048,
  socialHandle: 100,
  socialLinksPerCreator: 10,

  collaborationTagsPerCreator: 20,

  collectionTitle: 120,
  collectionSlug: 140,
  collectionDescription: 1000,
  collectionCoverImageUrl: 2048,
  collectionCity: 100,
  collectionCategory: 100,
  collectionsFeaturedPerCreator: 6,

  collectionItemTitle: 160,
  collectionItemNote: 600,
  collectionItemImageUrl: 2048,
  collectionItemsPerCollection: 100,
} as const

/* =========================================================
 * Social-platform configuration
 * ======================================================= */

export type CreatorSocialPlatformDefinition = {
  value: CreatorSocialPlatform
  label: string
  shortLabel: string
  iconKey:
    | 'instagram'
    | 'tiktok'
    | 'youtube'
    | 'globe'
    | 'linkedin'
    | 'threads'
    | 'pinterest'
    | 'x'
  allowedHosts: readonly string[]
  placeholder: string
  handlePlaceholder: string
  profileUrlPrefix: string | null
  supportsHandle: boolean
  isGeneralWebsite: boolean
}

export const CREATOR_SOCIAL_PLATFORM_DEFINITIONS = {
  instagram: {
    value: 'instagram',
    label: 'Instagram',
    shortLabel: 'Instagram',
    iconKey: 'instagram',
    allowedHosts: [
      'instagram.com',
      'www.instagram.com',
    ],
    placeholder: 'https://instagram.com/yourhandle',
    handlePlaceholder: '@yourhandle',
    profileUrlPrefix: 'https://instagram.com/',
    supportsHandle: true,
    isGeneralWebsite: false,
  },

  tiktok: {
    value: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    iconKey: 'tiktok',
    allowedHosts: [
      'tiktok.com',
      'www.tiktok.com',
      'vm.tiktok.com',
    ],
    placeholder: 'https://tiktok.com/@yourhandle',
    handlePlaceholder: '@yourhandle',
    profileUrlPrefix: 'https://tiktok.com/@',
    supportsHandle: true,
    isGeneralWebsite: false,
  },

  youtube: {
    value: 'youtube',
    label: 'YouTube',
    shortLabel: 'YouTube',
    iconKey: 'youtube',
    allowedHosts: [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
    ],
    placeholder: 'https://youtube.com/@yourchannel',
    handlePlaceholder: '@yourchannel',
    profileUrlPrefix: 'https://youtube.com/@',
    supportsHandle: true,
    isGeneralWebsite: false,
  },

  website: {
    value: 'website',
    label: 'Website',
    shortLabel: 'Website',
    iconKey: 'globe',
    allowedHosts: [],
    placeholder: 'https://yourwebsite.com',
    handlePlaceholder: 'yourwebsite.com',
    profileUrlPrefix: null,
    supportsHandle: false,
    isGeneralWebsite: true,
  },

  linkedin: {
    value: 'linkedin',
    label: 'LinkedIn',
    shortLabel: 'LinkedIn',
    iconKey: 'linkedin',
    allowedHosts: [
      'linkedin.com',
      'www.linkedin.com',
    ],
    placeholder: 'https://linkedin.com/in/yourname',
    handlePlaceholder: 'Your name',
    profileUrlPrefix: 'https://linkedin.com/in/',
    supportsHandle: true,
    isGeneralWebsite: false,
  },

  threads: {
    value: 'threads',
    label: 'Threads',
    shortLabel: 'Threads',
    iconKey: 'threads',
    allowedHosts: [
      'threads.net',
      'www.threads.net',
    ],
    placeholder: 'https://threads.net/@yourhandle',
    handlePlaceholder: '@yourhandle',
    profileUrlPrefix: 'https://threads.net/@',
    supportsHandle: true,
    isGeneralWebsite: false,
  },

  pinterest: {
    value: 'pinterest',
    label: 'Pinterest',
    shortLabel: 'Pinterest',
    iconKey: 'pinterest',
    allowedHosts: [
      'pinterest.com',
      'www.pinterest.com',
      'pinterest.ca',
      'www.pinterest.ca',
      'pinterest.co.uk',
      'www.pinterest.co.uk',
    ],
    placeholder: 'https://pinterest.com/yourhandle',
    handlePlaceholder: '@yourhandle',
    profileUrlPrefix: 'https://pinterest.com/',
    supportsHandle: true,
    isGeneralWebsite: false,
  },

  x: {
    value: 'x',
    label: 'X',
    shortLabel: 'X',
    iconKey: 'x',
    allowedHosts: [
      'x.com',
      'www.x.com',
      'twitter.com',
      'www.twitter.com',
      'mobile.twitter.com',
    ],
    placeholder: 'https://x.com/yourhandle',
    handlePlaceholder: '@yourhandle',
    profileUrlPrefix: 'https://x.com/',
    supportsHandle: true,
    isGeneralWebsite: false,
  },
} as const satisfies Record<
  CreatorSocialPlatform,
  CreatorSocialPlatformDefinition
>

/**
 * Social definitions in the canonical display order defined by
 * CREATOR_SOCIAL_PLATFORMS.
 */
export const CREATOR_SOCIAL_PLATFORM_OPTIONS =
  CREATOR_SOCIAL_PLATFORMS.map(
    (platform) =>
      CREATOR_SOCIAL_PLATFORM_DEFINITIONS[platform]
  )

/**
 * Hostnames that must never be accepted as a creator website.
 *
 * This prevents accidental development URLs and local-network addresses
 * from appearing on public profiles.
 */
export const BLOCKED_PUBLIC_WEBSITE_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
] as const

/* =========================================================
 * Collaboration-tag categories
 * ======================================================= */

export type CollaborationCategoryDefinition = {
  value: CollaborationTagCategory
  label: string
  singularLabel: string
  description: string
  sortOrder: number
}

export const COLLABORATION_CATEGORY_DEFINITIONS = {
  campaign: {
    value: 'campaign',
    label: 'Campaigns',
    singularLabel: 'Campaign',
    description:
      'The campaign opportunities this creator is open to.',
    sortOrder: 10,
  },

  deliverable: {
    value: 'deliverable',
    label: 'Deliverables',
    singularLabel: 'Deliverable',
    description:
      'The content formats and production services this creator offers.',
    sortOrder: 20,
  },

  industry: {
    value: 'industry',
    label: 'Industries',
    singularLabel: 'Industry',
    description:
      'The industries and experience categories this creator specializes in.',
    sortOrder: 30,
  },
} as const satisfies Record<
  CollaborationTagCategory,
  CollaborationCategoryDefinition
>

export const COLLABORATION_CATEGORY_OPTIONS =
  COLLABORATION_TAG_CATEGORIES.map(
    (category) =>
      COLLABORATION_CATEGORY_DEFINITIONS[category]
  )

export const COLLABORATION_CATEGORY_LABELS =
  Object.fromEntries(
    COLLABORATION_CATEGORY_OPTIONS.map(
      ({ value, label }) => [value, label]
    )
  ) as Record<CollaborationTagCategory, string>

/* =========================================================
 * Seeded collaboration tags
 *
 * These must remain aligned with the rows seeded in the
 * Creator Mode database migration.
 * ======================================================= */

export type SeededCollaborationTag = {
  slug: string
  label: string
  category: CollaborationTagCategory
  sortOrder: number
}

export const SEEDED_COLLABORATION_TAGS = [
  {
    slug: 'restaurant-openings',
    label: 'Restaurant Openings',
    category: 'campaign',
    sortOrder: 10,
  },
  {
    slug: 'hotel-stays',
    label: 'Hotel Stays',
    category: 'campaign',
    sortOrder: 20,
  },
  {
    slug: 'destination-campaigns',
    label: 'Destination Campaigns',
    category: 'campaign',
    sortOrder: 30,
  },
  {
    slug: 'event-coverage',
    label: 'Event Coverage',
    category: 'campaign',
    sortOrder: 40,
  },

  {
    slug: 'short-form-video',
    label: 'Short-form Video',
    category: 'deliverable',
    sortOrder: 10,
  },
  {
    slug: 'photography',
    label: 'Photography',
    category: 'deliverable',
    sortOrder: 20,
  },
  {
    slug: 'voiceover',
    label: 'Voiceover',
    category: 'deliverable',
    sortOrder: 30,
  },
  {
    slug: 'on-camera',
    label: 'On-camera Content',
    category: 'deliverable',
    sortOrder: 40,
  },
  {
    slug: 'raw-footage',
    label: 'Raw Footage',
    category: 'deliverable',
    sortOrder: 50,
  },
  {
    slug: 'paid-social',
    label: 'Paid Social Creative',
    category: 'deliverable',
    sortOrder: 60,
  },

  {
    slug: 'food-and-beverage',
    label: 'Food & Beverage',
    category: 'industry',
    sortOrder: 10,
  },
  {
    slug: 'hospitality',
    label: 'Hospitality',
    category: 'industry',
    sortOrder: 20,
  },
  {
    slug: 'travel',
    label: 'Travel',
    category: 'industry',
    sortOrder: 30,
  },
  {
    slug: 'nightlife',
    label: 'Nightlife',
    category: 'industry',
    sortOrder: 40,
  },
  {
    slug: 'local-experiences',
    label: 'Local Experiences',
    category: 'industry',
    sortOrder: 50,
  },
] as const satisfies readonly SeededCollaborationTag[]

/* =========================================================
 * Creator-collection visibility
 * ======================================================= */

export type CreatorCollectionVisibilityDefinition = {
  value: CreatorCollectionVisibility
  label: string
  description: string
}

export const CREATOR_COLLECTION_VISIBILITY_DEFINITIONS = {
  public: {
    value: 'public',
    label: 'Public',
    description:
      'Visible on your public creator profile and shareable collection page.',
  },

  private: {
    value: 'private',
    label: 'Private',
    description:
      'Visible only to you while editing Creator Mode.',
  },
} as const satisfies Record<
  CreatorCollectionVisibility,
  CreatorCollectionVisibilityDefinition
>

export const CREATOR_COLLECTION_VISIBILITY_OPTIONS =
  CREATOR_COLLECTION_VISIBILITIES.map(
    (visibility) =>
      CREATOR_COLLECTION_VISIBILITY_DEFINITIONS[
        visibility
      ]
  )

/* =========================================================
 * Creator-collection source types
 * ======================================================= */

export type CreatorCollectionSourceDefinition = {
  value: CreatorCollectionSourceType
  label: string
  pluralLabel: string
  description: string
  iconKey: 'map-pin' | 'building' | 'route' | 'camera'
}

export const CREATOR_COLLECTION_SOURCE_DEFINITIONS = {
  venue: {
    value: 'venue',
    label: 'Venue',
    pluralLabel: 'Venues',
    description:
      'A venue or place available within Roam.',
    iconKey: 'map-pin',
  },

  property: {
    value: 'property',
    label: 'Property Guide',
    pluralLabel: 'Property Guides',
    description:
      'A saved Roam property or neighborhood guide.',
    iconKey: 'building',
  },

  flow: {
    value: 'flow',
    label: 'Flow',
    pluralLabel: 'Flows',
    description:
      'A Roam flow, crawl, or curated route.',
    iconKey: 'route',
  },

  snapshot: {
    value: 'snapshot',
    label: 'Flow Snapshot',
    pluralLabel: 'Flow Snapshots',
    description:
      'A saved visual snapshot from a completed flow.',
    iconKey: 'camera',
  },
} as const satisfies Record<
  CreatorCollectionSourceType,
  CreatorCollectionSourceDefinition
>

export const CREATOR_COLLECTION_SOURCE_OPTIONS =
  CREATOR_COLLECTION_SOURCE_TYPES.map(
    (sourceType) =>
      CREATOR_COLLECTION_SOURCE_DEFINITIONS[
        sourceType
      ]
  )

/* =========================================================
 * Creator-profile public sections
 * ======================================================= */

export const CREATOR_PUBLIC_SECTION_ORDER = [
  'identity',
  'socials',
  'collaborations',
  'authority',
  'collections',
] as const

export const CREATOR_PUBLIC_SECTION_LABELS = {
  identity: 'Creator Profile',
  socials: 'Socials',
  collaborations: 'Available For',
  authority: 'Local Footprint',
  collections: 'Featured Collections',
} as const satisfies Record<
  (typeof CREATOR_PUBLIC_SECTION_ORDER)[number],
  string
>

/* =========================================================
 * Creator Mode copy
 * ======================================================= */

export const CREATOR_MODE_COPY = {
  eyebrow: 'Creator Mode',

  setupTitle: 'Build your creator profile',

  setupDescription:
    'Turn your Roam activity into a public portfolio built around real local experience.',

  activeTitle: 'Creator Mode is active',

  inactiveTitle: 'Build your creator profile',

  activeDescription:
    'Manage your creator identity, social links, collaboration availability, and collections.',

  inactiveDescription:
    'Add social links, collaboration tags, local authority, and public collections.',

  enableLabel: 'Enable Creator Mode',

  disableLabel: 'Disable Creator Mode',

  manageLabel: 'Manage Creator Mode',

  setupLabel: 'Set Up Creator Mode',

  acceptingCollaborationsLabel:
    'Open to collaborations',

  notAcceptingCollaborationsLabel:
    'Not currently accepting collaborations',

  travelAvailableLabel:
    'Available for travel',

  authorityHeading: 'Local Footprint',

  authorityDescription:
    'Creator credibility based on real activity recorded in Roam.',

  collectionsHeading: 'Featured Collections',

  collectionsDescription:
    'Curated places, routes, and experiences selected by this creator.',
} as const

/* =========================================================
 * Creator Mode analytics events
 * ======================================================= */

export const CREATOR_ANALYTICS_EVENTS = {
  modeEnabled: 'creator_mode_enabled',
  modeDisabled: 'creator_mode_disabled',
  settingsSaved: 'creator_settings_saved',

  profileViewed: 'creator_profile_viewed',
  socialLinkClicked: 'creator_social_link_clicked',
  collaborationTagClicked:
    'creator_collaboration_tag_clicked',

  collectionCreated: 'creator_collection_created',
  collectionUpdated: 'creator_collection_updated',
  collectionDeleted: 'creator_collection_deleted',
  collectionViewed: 'creator_collection_viewed',
  collectionItemClicked:
    'creator_collection_item_clicked',
} as const

export type CreatorAnalyticsEventName =
  (typeof CREATOR_ANALYTICS_EVENTS)[keyof typeof CREATOR_ANALYTICS_EVENTS]

/* =========================================================
 * Creator Mode route constants
 * ======================================================= */

export const CREATOR_ROUTES = {
  settings: '/profile/creator',
  collections: '/profile/creator/collections',
  newCollection: '/profile/creator/collections/new',

  publicProfile(username: string): string {
    return `/u/${encodeURIComponent(username)}`
  },

  publicCollection(
    username: string,
    slug: string
  ): string {
    return `/u/${encodeURIComponent(
      username
    )}/collections/${encodeURIComponent(slug)}`
  },

  editCollection(collectionId: string): string {
    return `/profile/creator/collections/${encodeURIComponent(
      collectionId
    )}`
  },
} as const

/* =========================================================
 * Utility accessors
 * ======================================================= */

export function getCreatorSocialPlatformDefinition(
  platform: CreatorSocialPlatform
): CreatorSocialPlatformDefinition {
  return CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
    platform
  ]
}

export function getCollaborationCategoryDefinition(
  category: CollaborationTagCategory
): CollaborationCategoryDefinition {
  return COLLABORATION_CATEGORY_DEFINITIONS[
    category
  ]
}

export function getCreatorCollectionVisibilityDefinition(
  visibility: CreatorCollectionVisibility
): CreatorCollectionVisibilityDefinition {
  return CREATOR_COLLECTION_VISIBILITY_DEFINITIONS[
    visibility
  ]
}

export function getCreatorCollectionSourceDefinition(
  sourceType: CreatorCollectionSourceType
): CreatorCollectionSourceDefinition {
  return CREATOR_COLLECTION_SOURCE_DEFINITIONS[
    sourceType
  ]
}

/**
 * Normalizes a social handle for display.
 *
 * This does not validate ownership or confirm that the linked account exists.
 */
export function formatCreatorSocialHandle(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('@')
    ? trimmed
    : `@${trimmed}`
}

/**
 * Returns a human-readable social label.
 *
 * Priority:
 *
 * 1. configured handle
 * 2. platform label
 */
export function getCreatorSocialDisplayLabel({
  platform,
  handle,
}: {
  platform: CreatorSocialPlatform
  handle: string | null | undefined
}): string {
  const definition =
    getCreatorSocialPlatformDefinition(platform)

  if (!definition.supportsHandle) {
    return definition.label
  }

  return (
    formatCreatorSocialHandle(handle) ??
    definition.label
  )
}

/**
 * Returns true when a hostname matches an allowed social domain.
 *
 * Subdomains are accepted. For example:
 *
 *   creator.instagram.com
 *
 * matches:
 *
 *   instagram.com
 */
export function hostnameMatchesAllowedHost(
  hostname: string,
  allowedHost: string
): boolean {
  const normalizedHostname = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')

  const normalizedAllowedHost = allowedHost
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')

  return (
    normalizedHostname === normalizedAllowedHost ||
    normalizedHostname.endsWith(
      `.${normalizedAllowedHost}`
    )
  )
}