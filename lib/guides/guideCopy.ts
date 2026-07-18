// lib/guides/guideCopy.ts

import type {
  GuideMode,
  GuideSectionKey,
  GuideStatus,
} from './types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideCopyTone =
  | 'roam'
  | 'hospitality'
  | 'editorial'
  | 'concierge'
  | 'premium'
  | 'casual'

export type GuideCopyContext = {
  mode?: GuideMode | null
  tone?: GuideCopyTone | null

  propertyName?: string | null
  brandName?: string | null
  city?: string | null

  guideTitle?: string | null
  guideSubtitle?: string | null

  welcomeHeading?: string | null
  welcomeDescription?: string | null

  poweredByRoam?: boolean | null
}

export type GuideSectionCopy = {
  eyebrow: string | null
  title: string
  subtitle: string | null
  emptyTitle: string | null
  emptyDescription: string | null
  ctaLabel: string | null
}

export type GuideActionCopy = {
  startFlow: string
  continueFlow: string
  resumeFlow: string
  viewRoute: string
  viewVenue: string
  viewDetails: string
  viewDescription: string
  hideDescription: string
  openMap: string
  getDirections: string
  save: string
  saved: string
  share: string
  exploreMore: string
  seeAll: string
  showLess: string
  backToGuide: string
  previewGuide: string
  publishGuide: string
  unpublishGuide: string
}

export type GuideStatusCopy = {
  draft: string
  active: string
  archived: string
}

export type GuideNavigationCopy = {
  guideLabel: string
  homeLabel: string
  favoritesLabel: string
  routesLabel: string
  diningLabel: string
  coffeeLabel: string
  barsLabel: string
  wellnessLabel: string
  eventsLabel: string
  mapLabel: string
  offersLabel: string
}

export type GuideSystemCopy = {
  loading: string
  unavailable: string
  unavailableDescription: string
  error: string
  errorDescription: string
  noResults: string
  noResultsDescription: string
  poweredBy: string
  poweredByRoam: string
  curatedBy: string
  recommendedBy: string
  nearby: string
  walkable: string
  openNow: string
  closed: string
  openingSoon: string
}

export type GuideCopy = {
  mode: GuideMode
  tone: GuideCopyTone

  pageTitle: string
  pageSubtitle: string | null

  welcomeHeading: string
  welcomeDescription: string | null

  actions: GuideActionCopy
  navigation: GuideNavigationCopy
  system: GuideSystemCopy
  statuses: GuideStatusCopy

  sections: Record<GuideSectionKey, GuideSectionCopy>
}

/* ------------------------------------------------ */
/* Defaults                                         */
/* ------------------------------------------------ */

const DEFAULT_ACTION_COPY: GuideActionCopy = {
  startFlow: 'Start Flow',
  continueFlow: 'Continue Flow',
  resumeFlow: 'Resume Flow',
  viewRoute: 'View Route',
  viewVenue: 'View Venue',
  viewDetails: 'View Details',
  viewDescription: 'View Description',
  hideDescription: 'Hide Description',
  openMap: 'Open Map',
  getDirections: 'Get Directions',
  save: 'Save',
  saved: 'Saved',
  share: 'Share',
  exploreMore: 'Explore More',
  seeAll: 'See All',
  showLess: 'Show Less',
  backToGuide: 'Back to Guide',
  previewGuide: 'Preview Guide',
  publishGuide: 'Publish Guide',
  unpublishGuide: 'Unpublish Guide',
}

const DEFAULT_STATUS_COPY: GuideStatusCopy = {
  draft: 'Draft',
  active: 'Published',
  archived: 'Archived',
}

const DEFAULT_SYSTEM_COPY: GuideSystemCopy = {
  loading: 'Loading your guide…',
  unavailable: 'Guide unavailable',
  unavailableDescription:
    'This guide is not currently available. Please check back soon.',
  error: 'Something went wrong',
  errorDescription:
    'We could not load this guide. Please refresh and try again.',
  noResults: 'Nothing to show yet',
  noResultsDescription:
    'Recommendations are still being added to this section.',
  poweredBy: 'Powered by',
  poweredByRoam: 'Powered by Roam',
  curatedBy: 'Curated by',
  recommendedBy: 'Recommended by',
  nearby: 'Nearby',
  walkable: 'Walkable',
  openNow: 'Open now',
  closed: 'Closed',
  openingSoon: 'Opening soon',
}

/* ------------------------------------------------ */
/* Public API                                       */
/* ------------------------------------------------ */

export function getGuideCopy(
  context: GuideCopyContext = {}
): GuideCopy {
  const mode = normalizeGuideMode(context.mode)
  const tone = normalizeGuideCopyTone(context.tone, mode)

  const propertyName = cleanText(context.propertyName)
  const brandName = cleanText(context.brandName)
  const city = cleanText(context.city)

  const pageTitle =
    cleanText(context.guideTitle) ||
    getDefaultPageTitle({
      mode,
      tone,
      propertyName,
      brandName,
      city,
    })

  const pageSubtitle =
    cleanText(context.guideSubtitle) ||
    getDefaultPageSubtitle({
      mode,
      tone,
      propertyName,
      brandName,
      city,
    })

  const welcomeHeading =
    cleanText(context.welcomeHeading) ||
    getDefaultWelcomeHeading({
      mode,
      propertyName,
      brandName,
      city,
    })

  const welcomeDescription =
    cleanText(context.welcomeDescription) ||
    getDefaultWelcomeDescription({
      mode,
      tone,
      propertyName,
      brandName,
      city,
    })

  return {
    mode,
    tone,
    pageTitle,
    pageSubtitle,
    welcomeHeading,
    welcomeDescription,
    actions: getGuideActionCopy(mode, tone),
    navigation: getGuideNavigationCopy(mode),
    system: getGuideSystemCopy({
      mode,
      brandName,
      propertyName,
      poweredByRoam: context.poweredByRoam,
    }),
    statuses: DEFAULT_STATUS_COPY,
    sections: getGuideSectionCopyMap({
      mode,
      tone,
      propertyName,
      brandName,
      city,
    }),
  }
}

export function getGuideSectionCopy(
  sectionKey: GuideSectionKey,
  context: GuideCopyContext = {}
): GuideSectionCopy {
  return getGuideCopy(context).sections[sectionKey]
}

export function getGuideActionCopy(
  mode: GuideMode = 'roam',
  tone?: GuideCopyTone | null
): GuideActionCopy {
  const resolvedTone = normalizeGuideCopyTone(tone, mode)

  if (mode === 'hotel' || resolvedTone === 'hospitality') {
    return {
      ...DEFAULT_ACTION_COPY,
      startFlow: 'Start This Route',
      continueFlow: 'Continue Your Route',
      resumeFlow: 'Resume Your Route',
      viewRoute: 'View Route',
      viewVenue: 'View Place',
      openMap: 'Explore on Map',
      exploreMore: 'Explore More Nearby',
      backToGuide: 'Back to Neighborhood Guide',
    }
  }

  if (mode === 'concierge' || resolvedTone === 'concierge') {
    return {
      ...DEFAULT_ACTION_COPY,
      startFlow: 'Follow This Plan',
      continueFlow: 'Continue the Plan',
      resumeFlow: 'Resume the Plan',
      viewRoute: 'View the Plan',
      viewVenue: 'View Recommendation',
      openMap: 'See on Map',
      exploreMore: 'See More Recommendations',
      backToGuide: 'Back to Concierge Guide',
    }
  }

  if (mode === 'partner') {
    return {
      ...DEFAULT_ACTION_COPY,
      startFlow: 'Start Experience',
      continueFlow: 'Continue Experience',
      resumeFlow: 'Resume Experience',
      viewRoute: 'View Experience',
      viewVenue: 'View Partner',
      openMap: 'View Nearby',
      exploreMore: 'Discover More',
      backToGuide: 'Back to Guide',
    }
  }

  return DEFAULT_ACTION_COPY
}

export function getGuideNavigationCopy(
  mode: GuideMode = 'roam'
): GuideNavigationCopy {
  if (mode === 'hotel') {
    return {
      guideLabel: 'Neighborhood Guide',
      homeLabel: 'Welcome',
      favoritesLabel: 'Our Recommendations',
      routesLabel: 'Suggested Routes',
      diningLabel: 'Places to Eat',
      coffeeLabel: 'Coffee Nearby',
      barsLabel: 'Drinks Nearby',
      wellnessLabel: 'Wellness Nearby',
      eventsLabel: 'What’s On',
      mapLabel: 'Neighborhood Map',
      offersLabel: 'Guest Perks',
    }
  }

  if (mode === 'concierge') {
    return {
      guideLabel: 'Concierge Guide',
      homeLabel: 'Welcome',
      favoritesLabel: 'Concierge Picks',
      routesLabel: 'Curated Plans',
      diningLabel: 'Dining',
      coffeeLabel: 'Coffee',
      barsLabel: 'Drinks',
      wellnessLabel: 'Wellness',
      eventsLabel: 'Events',
      mapLabel: 'Map',
      offersLabel: 'Exclusive Perks',
    }
  }

  if (mode === 'partner') {
    return {
      guideLabel: 'Local Guide',
      homeLabel: 'Overview',
      favoritesLabel: 'Featured Places',
      routesLabel: 'Experiences',
      diningLabel: 'Dining',
      coffeeLabel: 'Coffee',
      barsLabel: 'Drinks',
      wellnessLabel: 'Wellness',
      eventsLabel: 'Events',
      mapLabel: 'Map',
      offersLabel: 'Partner Offers',
    }
  }

  return {
    guideLabel: 'Roam Guide',
    homeLabel: 'Guide',
    favoritesLabel: 'Property Favorites',
    routesLabel: 'Suggested Flows',
    diningLabel: 'Dining',
    coffeeLabel: 'Coffee',
    barsLabel: 'Drinks',
    wellnessLabel: 'Wellness',
    eventsLabel: 'Nearby Events',
    mapLabel: 'Map',
    offersLabel: 'Offers',
  }
}

export function getGuideSystemCopy({
  mode = 'roam',
  brandName,
  propertyName,
  poweredByRoam,
}: {
  mode?: GuideMode
  brandName?: string | null
  propertyName?: string | null
  poweredByRoam?: boolean | null
} = {}): GuideSystemCopy {
  const resolvedBrandName = cleanText(brandName)
  const resolvedPropertyName = cleanText(propertyName)

  const curator =
    resolvedBrandName ||
    resolvedPropertyName ||
    (mode === 'hotel' ? 'the hotel team' : 'Roam')

  return {
    ...DEFAULT_SYSTEM_COPY,
    curatedBy: `Curated by ${curator}`,
    recommendedBy: `Recommended by ${curator}`,
    poweredByRoam:
      poweredByRoam === false
        ? ''
        : DEFAULT_SYSTEM_COPY.poweredByRoam,
  }
}

export function getGuideStatusLabel(
  status: GuideStatus
): string {
  return DEFAULT_STATUS_COPY[status]
}

/* ------------------------------------------------ */
/* Section Copy                                     */
/* ------------------------------------------------ */

function getGuideSectionCopyMap({
  mode,
  tone,
  propertyName,
  brandName,
  city,
}: {
  mode: GuideMode
  tone: GuideCopyTone
  propertyName: string | null
  brandName: string | null
  city: string | null
}): Record<GuideSectionKey, GuideSectionCopy> {
  const curatorName =
    brandName ||
    propertyName ||
    (mode === 'hotel' ? 'Our Team' : 'Roam')

  const locationLabel = city ? ` in ${city}` : ''

  if (mode === 'hotel') {
    return {
      welcome: {
        eyebrow: 'Welcome',
        title: 'Your Neighborhood Guide',
        subtitle:
          'A practical collection of nearby places and experiences for your stay.',
        emptyTitle: null,
        emptyDescription: null,
        ctaLabel: null,
      },

      favorites: {
        eyebrow: 'Recommended',
        title: 'Recommended by Our Team',
        subtitle:
          'A handpicked selection of places we think are worth your time.',
        emptyTitle: 'Recommendations are being added',
        emptyDescription:
          'Our team is still curating the strongest nearby places.',
        ctaLabel: 'See All Recommendations',
      },

      suggested_routes: {
        eyebrow: 'Explore',
        title: 'Suggested Routes',
        subtitle:
          'Low-friction neighborhood plans organized around timing, distance, and flow.',
        emptyTitle: 'No routes available right now',
        emptyDescription:
          'New nearby routes are being prepared for this guide.',
        ctaLabel: 'View All Routes',
      },

      coffee: {
        eyebrow: 'Nearby',
        title: 'Coffee Nearby',
        subtitle:
          'Reliable places for coffee, tea, breakfast, or a slower start.',
        emptyTitle: 'No coffee recommendations yet',
        emptyDescription:
          'Coffee and breakfast options are still being curated.',
        ctaLabel: 'View Coffee Options',
      },

      dining: {
        eyebrow: 'Nearby',
        title: 'Places to Eat',
        subtitle:
          'Dining options selected for convenience, quality, and neighborhood fit.',
        emptyTitle: 'No dining recommendations yet',
        emptyDescription:
          'Dining recommendations are still being added.',
        ctaLabel: 'View Dining Options',
      },

      bars: {
        eyebrow: 'After Hours',
        title: 'Drinks Nearby',
        subtitle:
          'Nearby bars, lounges, rooftops, and places for an easy evening.',
        emptyTitle: 'No drinks recommendations yet',
        emptyDescription:
          'Evening recommendations are still being curated.',
        ctaLabel: 'View Drinks Nearby',
      },

      wellness: {
        eyebrow: 'Reset',
        title: 'Wellness Nearby',
        subtitle:
          'Nearby options for movement, recovery, and a lighter pace.',
        emptyTitle: 'No wellness recommendations yet',
        emptyDescription:
          'Wellness options are still being added.',
        ctaLabel: 'View Wellness Options',
      },

      events: {
        eyebrow: 'Happening Nearby',
        title: 'What’s On',
        subtitle:
          'Events and local moments that may be worth fitting into your stay.',
        emptyTitle: 'No nearby events right now',
        emptyDescription:
          'There are no current events available for this guide.',
        ctaLabel: 'View All Events',
      },

      map: {
        eyebrow: 'Explore',
        title: 'Neighborhood Map',
        subtitle:
          'See recommendations, routes, and nearby places in one view.',
        emptyTitle: 'Map unavailable',
        emptyDescription:
          'Map information is not currently available.',
        ctaLabel: 'Open Neighborhood Map',
      },

      partner_offers: {
        eyebrow: 'Guest Access',
        title: 'Guest Perks',
        subtitle:
          'Available offers and partner benefits selected for guests.',
        emptyTitle: 'No guest perks available',
        emptyDescription:
          'There are no active partner offers at the moment.',
        ctaLabel: 'View Guest Perks',
      },

      custom: {
        eyebrow: null,
        title: 'More from Your Guide',
        subtitle: null,
        emptyTitle: 'Nothing here yet',
        emptyDescription:
          'This section is still being prepared.',
        ctaLabel: null,
      },
    }
  }

  if (mode === 'concierge') {
    return {
      welcome: {
        eyebrow: 'Welcome',
        title: 'A Guide Built Around Your Stay',
        subtitle:
          'Curated recommendations designed to make the next decision easier.',
        emptyTitle: null,
        emptyDescription: null,
        ctaLabel: null,
      },

      favorites: {
        eyebrow: 'Selected',
        title: 'Concierge Picks',
        subtitle:
          `A curated selection from ${curatorName}.`,
        emptyTitle: 'No concierge picks yet',
        emptyDescription:
          'Recommendations are still being curated.',
        ctaLabel: 'See All Picks',
      },

      suggested_routes: {
        eyebrow: 'Curated Plans',
        title: 'Plans Worth Following',
        subtitle:
          'Sequenced recommendations that remove the work from planning.',
        emptyTitle: 'No plans available',
        emptyDescription:
          'Curated plans are still being prepared.',
        ctaLabel: 'View All Plans',
      },

      coffee: {
        eyebrow: 'Morning',
        title: 'Coffee & Breakfast',
        subtitle:
          'Strong nearby options for an easy start.',
        emptyTitle: 'No morning recommendations yet',
        emptyDescription:
          'Morning options are still being curated.',
        ctaLabel: 'See Morning Picks',
      },

      dining: {
        eyebrow: 'Dining',
        title: 'Where to Eat',
        subtitle:
          'Dining recommendations selected for the occasion, timing, and location.',
        emptyTitle: 'No dining picks yet',
        emptyDescription:
          'Dining recommendations are still being curated.',
        ctaLabel: 'See Dining Picks',
      },

      bars: {
        eyebrow: 'Evening',
        title: 'Where to Drink',
        subtitle:
          'Bars, lounges, and evening stops selected for the right kind of night.',
        emptyTitle: 'No evening picks yet',
        emptyDescription:
          'Evening recommendations are still being curated.',
        ctaLabel: 'See Evening Picks',
      },

      wellness: {
        eyebrow: 'Reset',
        title: 'Wellness & Recovery',
        subtitle:
          'Places to move, reset, recharge, or slow down.',
        emptyTitle: 'No wellness picks yet',
        emptyDescription:
          'Wellness recommendations are still being curated.',
        ctaLabel: 'See Wellness Picks',
      },

      events: {
        eyebrow: 'What’s On',
        title: 'Events Worth Knowing About',
        subtitle:
          `A current look at what is happening${locationLabel}.`,
        emptyTitle: 'No current events',
        emptyDescription:
          'There are no events available right now.',
        ctaLabel: 'See All Events',
      },

      map: {
        eyebrow: 'Location',
        title: 'Explore the Area',
        subtitle:
          'See recommendations and routes across the neighborhood.',
        emptyTitle: 'Map unavailable',
        emptyDescription:
          'The map is not currently available.',
        ctaLabel: 'Open the Map',
      },

      partner_offers: {
        eyebrow: 'Exclusive',
        title: 'Guest Benefits',
        subtitle:
          'Available offers and perks connected to this guide.',
        emptyTitle: 'No benefits available',
        emptyDescription:
          'There are no active guest benefits right now.',
        ctaLabel: 'View Benefits',
      },

      custom: {
        eyebrow: null,
        title: 'More Recommendations',
        subtitle: null,
        emptyTitle: 'Nothing here yet',
        emptyDescription:
          'This section is still being curated.',
        ctaLabel: null,
      },
    }
  }

  if (mode === 'partner') {
    return {
      welcome: {
        eyebrow: 'Welcome',
        title: 'Your Local Guide',
        subtitle:
          'Featured places, experiences, and offers from nearby partners.',
        emptyTitle: null,
        emptyDescription: null,
        ctaLabel: null,
      },

      favorites: {
        eyebrow: 'Featured',
        title: 'Featured Places',
        subtitle:
          'Selected local venues worth discovering.',
        emptyTitle: 'No featured places yet',
        emptyDescription:
          'Featured places are still being added.',
        ctaLabel: 'See All Featured Places',
      },

      suggested_routes: {
        eyebrow: 'Experiences',
        title: 'Suggested Experiences',
        subtitle:
          'Local sequences built around timing, proximity, and ease.',
        emptyTitle: 'No experiences available',
        emptyDescription:
          'New experiences are still being created.',
        ctaLabel: 'View All Experiences',
      },

      coffee: {
        eyebrow: 'Nearby',
        title: 'Coffee',
        subtitle:
          'Coffee, tea, breakfast, and casual daytime stops.',
        emptyTitle: 'No coffee options yet',
        emptyDescription:
          'Coffee recommendations are still being added.',
        ctaLabel: 'View Coffee',
      },

      dining: {
        eyebrow: 'Nearby',
        title: 'Dining',
        subtitle:
          'Local places to eat across different moments of the day.',
        emptyTitle: 'No dining options yet',
        emptyDescription:
          'Dining recommendations are still being added.',
        ctaLabel: 'View Dining',
      },

      bars: {
        eyebrow: 'Nearby',
        title: 'Drinks',
        subtitle:
          'Bars, lounges, and social stops nearby.',
        emptyTitle: 'No drinks options yet',
        emptyDescription:
          'Drinks recommendations are still being added.',
        ctaLabel: 'View Drinks',
      },

      wellness: {
        eyebrow: 'Nearby',
        title: 'Wellness',
        subtitle:
          'Places for movement, recovery, and reset.',
        emptyTitle: 'No wellness options yet',
        emptyDescription:
          'Wellness recommendations are still being added.',
        ctaLabel: 'View Wellness',
      },

      events: {
        eyebrow: 'Local',
        title: 'Events',
        subtitle:
          'Nearby events and moments worth knowing about.',
        emptyTitle: 'No events available',
        emptyDescription:
          'There are no current events listed.',
        ctaLabel: 'View Events',
      },

      map: {
        eyebrow: 'Explore',
        title: 'Local Map',
        subtitle:
          'See nearby recommendations and experiences.',
        emptyTitle: 'Map unavailable',
        emptyDescription:
          'Map information is not currently available.',
        ctaLabel: 'Open Map',
      },

      partner_offers: {
        eyebrow: 'Offers',
        title: 'Partner Offers',
        subtitle:
          'Current perks and benefits from participating partners.',
        emptyTitle: 'No active offers',
        emptyDescription:
          'There are no partner offers available right now.',
        ctaLabel: 'View Offers',
      },

      custom: {
        eyebrow: null,
        title: 'More to Explore',
        subtitle: null,
        emptyTitle: 'Nothing here yet',
        emptyDescription:
          'This section is still being prepared.',
        ctaLabel: null,
      },
    }
  }

  return {
    welcome: {
      eyebrow: 'Roam Guide',
      title: 'Explore What’s Nearby',
      subtitle:
        'Contextual recommendations organized around where you are and what fits now.',
      emptyTitle: null,
      emptyDescription: null,
      ctaLabel: null,
    },

    favorites: {
      eyebrow: 'Saved',
      title: 'Property Favorites',
      subtitle:
        'Handpicked places connected to this property.',
      emptyTitle: 'No favorites yet',
      emptyDescription:
        'Property favorites are still being added.',
      ctaLabel: 'See All Favorites',
    },

    suggested_routes: {
      eyebrow: 'Suggested',
      title: 'Suggested Flows',
      subtitle:
        'Nearby plans ranked for timing, walkability, and sequence quality.',
      emptyTitle: 'No flows available right now',
      emptyDescription:
        'New flows are being prepared for this area.',
      ctaLabel: 'View All Flows',
    },

    coffee: {
      eyebrow: 'Nearby',
      title: 'Coffee',
      subtitle:
        'Coffee, tea, breakfast, and easy daytime stops.',
      emptyTitle: 'No coffee options yet',
      emptyDescription:
        'Coffee recommendations are still being added.',
      ctaLabel: 'View Coffee',
    },

    dining: {
      eyebrow: 'Nearby',
      title: 'Dining',
      subtitle:
        'Nearby places to eat across different times of day.',
      emptyTitle: 'No dining options yet',
      emptyDescription:
        'Dining recommendations are still being added.',
      ctaLabel: 'View Dining',
    },

    bars: {
      eyebrow: 'Nearby',
      title: 'Drinks',
      subtitle:
        'Bars, lounges, rooftops, and social stops.',
      emptyTitle: 'No drinks options yet',
      emptyDescription:
        'Drinks recommendations are still being added.',
      ctaLabel: 'View Drinks',
    },

    wellness: {
      eyebrow: 'Nearby',
      title: 'Wellness',
      subtitle:
        'Places for movement, recovery, and reset.',
      emptyTitle: 'No wellness options yet',
      emptyDescription:
        'Wellness recommendations are still being added.',
      ctaLabel: 'View Wellness',
    },

    events: {
      eyebrow: 'Nearby',
      title: 'Events',
      subtitle:
        'Events and local moments happening nearby.',
      emptyTitle: 'No nearby events',
      emptyDescription:
        'There are no current events available.',
      ctaLabel: 'View Events',
    },

    map: {
      eyebrow: 'Explore',
      title: 'Map',
      subtitle:
        'See nearby venues, routes, and recommendations in one place.',
      emptyTitle: 'Map unavailable',
      emptyDescription:
        'Map information is not currently available.',
      ctaLabel: 'Open Map',
    },

    partner_offers: {
      eyebrow: 'Offers',
      title: 'Partner Offers',
      subtitle:
        'Available offers from participating Roam partners.',
      emptyTitle: 'No active offers',
      emptyDescription:
        'There are no current partner offers available.',
      ctaLabel: 'View Offers',
    },

    custom: {
      eyebrow: null,
      title: 'More to Explore',
      subtitle: null,
      emptyTitle: 'Nothing here yet',
      emptyDescription:
        'This section is still being prepared.',
      ctaLabel: null,
    },
  }
}

/* ------------------------------------------------ */
/* Page Copy                                        */
/* ------------------------------------------------ */

function getDefaultPageTitle({
  mode,
  propertyName,
  brandName,
  city,
}: {
  mode: GuideMode
  tone: GuideCopyTone
  propertyName: string | null
  brandName: string | null
  city: string | null
}): string {
  if (mode === 'hotel') {
    if (propertyName) return `${propertyName} Neighborhood Guide`
    if (brandName) return `${brandName} Neighborhood Guide`
    return city ? `${city} Neighborhood Guide` : 'Neighborhood Guide'
  }

  if (mode === 'concierge') {
    if (propertyName) return `${propertyName} Concierge Guide`
    return city ? `${city} Concierge Guide` : 'Concierge Guide'
  }

  if (mode === 'partner') {
    if (brandName) return `${brandName} Local Guide`
    return city ? `${city} Local Guide` : 'Local Guide'
  }

  if (propertyName) return `${propertyName} Guide`
  return city ? `Roam ${city}` : 'Roam Guide'
}

function getDefaultPageSubtitle({
  mode,
  tone,
  city,
}: {
  mode: GuideMode
  tone: GuideCopyTone
  propertyName: string | null
  brandName: string | null
  city: string | null
}): string {
  const location = city ? ` in ${city}` : ''

  if (mode === 'hotel') {
    return `Curated places, routes, and local experiences for your stay${location}.`
  }

  if (mode === 'concierge') {
    return `Thoughtful recommendations designed to make exploring${location} easier.`
  }

  if (mode === 'partner') {
    return `Featured local places, experiences, and offers${location}.`
  }

  if (tone === 'editorial') {
    return `A considered guide to places and experiences worth your time${location}.`
  }

  return `Nearby places, events, and flows organized around what fits now${location}.`
}

function getDefaultWelcomeHeading({
  mode,
  propertyName,
  brandName,
  city,
}: {
  mode: GuideMode
  propertyName: string | null
  brandName: string | null
  city: string | null
}): string {
  if (mode === 'hotel') {
    if (propertyName) return `Welcome to ${propertyName}`
    if (brandName) return `Welcome from ${brandName}`
    return city ? `Welcome to ${city}` : 'Welcome'
  }

  if (mode === 'concierge') {
    return city ? `Make the Most of ${city}` : 'Make the Most of Your Stay'
  }

  if (mode === 'partner') {
    return city ? `Discover ${city}` : 'Discover What’s Nearby'
  }

  return city ? `Explore ${city}` : 'Explore What’s Nearby'
}

function getDefaultWelcomeDescription({
  mode,
  tone,
  city,
}: {
  mode: GuideMode
  tone: GuideCopyTone
  propertyName: string | null
  brandName: string | null
  city: string | null
}): string {
  const location = city ? ` around ${city}` : ' nearby'

  if (mode === 'hotel') {
    return `Use this guide to find trusted places, easy routes, and local experiences${location} without having to plan everything yourself.`
  }

  if (mode === 'concierge') {
    return `A curated starting point for making better decisions about where to go and what to do next${location}.`
  }

  if (mode === 'partner') {
    return `Explore featured local places, experiences, and offers${location}.`
  }

  if (tone === 'premium') {
    return `A refined selection of nearby places and experiences organized around timing, distance, and quality.`
  }

  return `Find nearby places, events, and flows organized around your location and the current moment.`
}

/* ------------------------------------------------ */
/* Normalization                                    */
/* ------------------------------------------------ */

function normalizeGuideMode(
  value: GuideMode | string | null | undefined
): GuideMode {
  if (value === 'hotel') return 'hotel'
  if (value === 'partner') return 'partner'
  if (value === 'concierge') return 'concierge'
  return 'roam'
}

function normalizeGuideCopyTone(
  tone: GuideCopyTone | string | null | undefined,
  mode: GuideMode
): GuideCopyTone {
  if (tone === 'hospitality') return 'hospitality'
  if (tone === 'editorial') return 'editorial'
  if (tone === 'concierge') return 'concierge'
  if (tone === 'premium') return 'premium'
  if (tone === 'casual') return 'casual'
  if (tone === 'roam') return 'roam'

  if (mode === 'hotel') return 'hospitality'
  if (mode === 'concierge') return 'concierge'
  if (mode === 'partner') return 'editorial'

  return 'roam'
}

function cleanText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}