// lib/guides/types.ts

/* ------------------------------------------------ */
/* Shared JSON                                      */
/* ------------------------------------------------ */

export type GuideJsonPrimitive = string | number | boolean | null

export type GuideJson =
  | GuideJsonPrimitive
  | GuideJson[]
  | { [key: string]: GuideJson | undefined }

/* ------------------------------------------------ */
/* Core Unions                                      */
/* ------------------------------------------------ */

export type GuideMode =
  | 'roam'
  | 'hotel'
  | 'partner'
  | 'concierge'

export type GuideStatus =
  | 'draft'
  | 'active'
  | 'archived'

export type GuideBrandingMode =
  | 'roam'
  | 'co_branded'
  | 'white_label'

export type GuideTravelMode =
  | 'walking'
  | 'driving'
  | 'transit'
  | 'rideshare'

export type GuideSectionKey =
  | 'welcome'
  | 'favorites'
  | 'suggested_routes'
  | 'coffee'
  | 'dining'
  | 'bars'
  | 'wellness'
  | 'events'
  | 'map'
  | 'partner_offers'
  | 'custom'

export type GuideSectionDisplayStyle =
  | 'grid'
  | 'list'
  | 'carousel'
  | 'compact'
  | 'featured'

/* ------------------------------------------------ */
/* Database Row Shapes                              */
/* ------------------------------------------------ */

export type GuideBrandRow = {
  id: string
  name: string
  slug: string

  logo_url: string | null
  favicon_url: string | null

  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  background_color: string | null
  surface_color: string | null
  text_color: string | null
  muted_text_color: string | null
  button_text_color: string | null

  font_family: string | null
  branding_mode: GuideBrandingMode
  powered_by_roam: boolean
  custom_css: string | null

  created_at: string
  updated_at: string
}

export type PropertyGuideRow = {
  id: string
  property_id: string
  brand_id: string | null

  title: string
  subtitle: string | null
  slug: string

  status: GuideStatus
  guide_mode: GuideMode

  welcome_heading: string | null
  welcome_description: string | null
  hero_image_url: string | null

  show_property_favorites: boolean
  show_suggested_routes: boolean
  show_nearby_events: boolean
  show_partner_offers: boolean

  default_travel_mode: GuideTravelMode
  powered_by_roam: boolean

  published_at: string | null
  created_at: string
  updated_at: string
}

export type PropertyGuideSectionRow = {
  id: string
  guide_id: string

  section_key: GuideSectionKey
  title: string | null
  subtitle: string | null

  position: number
  is_visible: boolean
  config: GuideJson | null

  created_at: string
  updated_at: string
}

export type GuideFeaturedVenueRow = {
  id: string
  guide_id: string
  venue_id: string

  section_key: GuideSectionKey
  label: string | null
  description: string | null
  concierge_note: string | null

  position: number
  is_featured: boolean
  is_visible: boolean

  visible_from: string | null
  visible_until: string | null

  created_at: string
  updated_at: string
}

/* ------------------------------------------------ */
/* Supporting Property / Venue Shapes               */
/* ------------------------------------------------ */

export type GuidePropertySummary = {
  id: string
  name: string
  slug: string
  city: string
  lat: number
  lon: number

  address?: string | null
  website?: string | null
  welcomeDescription?: string | null
  hostName?: string | null
}

export type GuideVenueSummary = {
  id: string
  name: string

  city?: string | null
  description?: string | null
  address?: string | null
  cover?: string | null
  link?: string | null

  type?: string | string[] | null
  tags?: string | string[] | null
  vibe?: string | string[] | null

  lat?: number | null
  lon?: number | null
}

/* ------------------------------------------------ */
/* Normalized Brand Configuration                   */
/* ------------------------------------------------ */

export type GuideBrandConfig = {
  id: string
  name: string
  slug: string

  logoUrl: string | null
  faviconUrl: string | null

  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  buttonTextColor: string

  fontFamily: string | null
  brandingMode: GuideBrandingMode
  poweredByRoam: boolean
  customCss: string | null
}

/* ------------------------------------------------ */
/* Normalized Section Configuration                 */
/* ------------------------------------------------ */

export type GuideSectionConfig = {
  id: string
  guideId: string

  key: GuideSectionKey
  title: string | null
  subtitle: string | null

  position: number
  isVisible: boolean
  config: GuideSectionOptions
}

export type GuideSectionOptions = {
  limit?: number
  displayStyle?: GuideSectionDisplayStyle
  titleOverride?: string
  subtitleOverride?: string

  showDescriptions?: boolean
  showDistance?: boolean
  showImages?: boolean
  showMapLink?: boolean

  routeTheme?: string
  venueTypes?: string[]

  [key: string]: GuideJson | undefined
}

/* ------------------------------------------------ */
/* Normalized Featured Venue                        */
/* ------------------------------------------------ */

export type GuideFeaturedVenueConfig = {
  id: string
  guideId: string
  venueId: string

  sectionKey: GuideSectionKey
  label: string | null
  description: string | null
  conciergeNote: string | null

  position: number
  isFeatured: boolean
  isVisible: boolean

  visibleFrom: string | null
  visibleUntil: string | null

  venue?: GuideVenueSummary | null
}

/* ------------------------------------------------ */
/* Complete Public Guide Configuration              */
/* ------------------------------------------------ */

export type GuideConfig = {
  id: string
  propertyId: string
  brandId: string | null

  title: string
  subtitle: string | null
  slug: string

  status: GuideStatus
  guideMode: GuideMode

  welcomeHeading: string | null
  welcomeDescription: string | null
  heroImageUrl: string | null

  showPropertyFavorites: boolean
  showSuggestedRoutes: boolean
  showNearbyEvents: boolean
  showPartnerOffers: boolean

  defaultTravelMode: GuideTravelMode
  poweredByRoam: boolean

  publishedAt: string | null
  createdAt: string
  updatedAt: string

  property: GuidePropertySummary
  brand: GuideBrandConfig
  sections: GuideSectionConfig[]
  featuredVenues: GuideFeaturedVenueConfig[]
}

/* ------------------------------------------------ */
/* Guide Loader Results                             */
/* ------------------------------------------------ */

export type GuideLookupResult = {
  guide: PropertyGuideRow
  property: GuidePropertySummary
  brand: GuideBrandRow | null
  sections: PropertyGuideSectionRow[]
  featuredVenues: Array<
    GuideFeaturedVenueRow & {
      venue?: GuideVenueSummary | null
    }
  >
}

export type GuideConfigResult =
  | {
      found: true
      config: GuideConfig
    }
  | {
      found: false
      config: null
      reason:
        | 'not_found'
        | 'inactive'
        | 'missing_property'
        | 'invalid_configuration'
    }

/* ------------------------------------------------ */
/* Admin Form Inputs                                */
/* ------------------------------------------------ */

export type CreateGuideInput = {
  propertyId: string
  brandId?: string | null

  title: string
  subtitle?: string | null
  slug: string

  guideMode?: GuideMode
  status?: GuideStatus

  welcomeHeading?: string | null
  welcomeDescription?: string | null
  heroImageUrl?: string | null

  defaultTravelMode?: GuideTravelMode
  poweredByRoam?: boolean
}

export type UpdateGuideInput = {
  guideId: string

  brandId?: string | null
  title?: string
  subtitle?: string | null
  slug?: string

  guideMode?: GuideMode
  status?: GuideStatus

  welcomeHeading?: string | null
  welcomeDescription?: string | null
  heroImageUrl?: string | null

  showPropertyFavorites?: boolean
  showSuggestedRoutes?: boolean
  showNearbyEvents?: boolean
  showPartnerOffers?: boolean

  defaultTravelMode?: GuideTravelMode
  poweredByRoam?: boolean
}

export type CreateGuideBrandInput = {
  name: string
  slug: string

  logoUrl?: string | null
  faviconUrl?: string | null

  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundColor?: string
  surfaceColor?: string
  textColor?: string
  mutedTextColor?: string
  buttonTextColor?: string

  fontFamily?: string | null
  brandingMode?: GuideBrandingMode
  poweredByRoam?: boolean
  customCss?: string | null
}

export type UpdateGuideBrandInput = Partial<CreateGuideBrandInput> & {
  brandId: string
}

export type UpsertGuideSectionInput = {
  guideId: string
  sectionId?: string

  sectionKey: GuideSectionKey
  title?: string | null
  subtitle?: string | null

  position: number
  isVisible: boolean
  config?: GuideSectionOptions
}

export type ReorderGuideSectionsInput = {
  guideId: string
  sections: Array<{
    sectionId: string
    position: number
  }>
}

export type AddGuideFeaturedVenueInput = {
  guideId: string
  venueId: string

  sectionKey: GuideSectionKey
  label?: string | null
  description?: string | null
  conciergeNote?: string | null

  position?: number
  isFeatured?: boolean
  isVisible?: boolean

  visibleFrom?: string | null
  visibleUntil?: string | null
}

export type UpdateGuideFeaturedVenueInput = {
  featuredVenueId: string

  sectionKey?: GuideSectionKey
  label?: string | null
  description?: string | null
  conciergeNote?: string | null

  position?: number
  isFeatured?: boolean
  isVisible?: boolean

  visibleFrom?: string | null
  visibleUntil?: string | null
}

/* ------------------------------------------------ */
/* Preview / Publishing                             */
/* ------------------------------------------------ */

export type GuideAccessMode =
  | 'public'
  | 'preview'
  | 'admin'

export type GuidePageContext = {
  accessMode: GuideAccessMode
  isPreview: boolean
  canEdit: boolean
}

export type PublishGuideInput = {
  guideId: string
  status: Extract<GuideStatus, 'active' | 'draft' | 'archived'>
}

/* ------------------------------------------------ */
/* Analytics                                        */
/* ------------------------------------------------ */

export type GuideAnalyticsEventName =
  | 'guide_viewed'
  | 'guide_section_viewed'
  | 'guide_flow_started'
  | 'guide_venue_clicked'
  | 'guide_offer_viewed'
  | 'guide_offer_redeemed'
  | 'guide_map_opened'
  | 'guide_share_clicked'

export type GuideAnalyticsEvent = {
  guideId: string
  propertyId: string
  brandId?: string | null
  venueId?: string | null

  eventName: GuideAnalyticsEventName
  sessionId?: string | null
  userId?: string | null

  metadata?: Record<string, GuideJson | undefined>
}

/* ------------------------------------------------ */
/* Default Values                                   */
/* ------------------------------------------------ */

export const DEFAULT_GUIDE_BRAND_COLORS = {
  primaryColor: '#22d3ee',
  secondaryColor: '#0f172a',
  accentColor: '#22d3ee',
  backgroundColor: '#020617',
  surfaceColor: '#0f172a',
  textColor: '#f8fafc',
  mutedTextColor: '#94a3b8',
  buttonTextColor: '#020617',
} as const

export const DEFAULT_GUIDE_SECTIONS: ReadonlyArray<{
  key: GuideSectionKey
  position: number
  isVisible: boolean
}> = [
  {
    key: 'welcome',
    position: 0,
    isVisible: true,
  },
  {
    key: 'favorites',
    position: 1,
    isVisible: true,
  },
  {
    key: 'suggested_routes',
    position: 2,
    isVisible: true,
  },
  {
    key: 'coffee',
    position: 3,
    isVisible: true,
  },
  {
    key: 'dining',
    position: 4,
    isVisible: true,
  },
  {
    key: 'wellness',
    position: 5,
    isVisible: true,
  },
  {
    key: 'events',
    position: 6,
    isVisible: true,
  },
  {
    key: 'map',
    position: 7,
    isVisible: true,
  },
]