
'use client'

import {
  useCallback,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { logEvent } from '@/lib/logEvent'

/* =========================================================
 * Property Guide Interaction Tracker
 *
 * Centralized, delegated analytics for property guides.
 *
 * Tracks:
 * - Links
 * - Buttons
 * - Accordion summaries
 * - Elements with explicit analytics actions
 *
 * Guarantees:
 * - Does not prevent default browser behavior
 * - Does not stop event propagation
 * - Does not replace existing click handlers
 * - Does not block navigation on analytics requests
 * - Does not modify child component state
 * - Does not duplicate the property page-view event
 *
 * Existing specialized events remain untouched.
 * ======================================================= */

type Props = {
  propertyId: string
  propertyName: string
  propertySlug: string
  city: string
  children: ReactNode
}

type TrackedElement = HTMLElement

const EVENT_NAME =
  'property_guide_interaction_clicked'

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'summary',
  '[data-analytics-action]',
].join(', ')

const SECTION_SELECTOR = [
  '[data-analytics-section]',
  'section[id]',
].join(', ')

const VENUE_SELECTOR = '[data-venue-id]'

const MAX_ACTION_LENGTH = 120

/* =========================================================
 * Small formatting helpers
 * ======================================================= */

function normalizeText(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null
  }

  const normalized = value
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length > 0
    ? normalized
    : null
}

function truncateText(
  value: string | null | undefined,
  maxLength = MAX_ACTION_LENGTH
): string | null {
  const normalized = normalizeText(value)

  if (!normalized) {
    return null
  }

  return normalized.slice(0, maxLength)
}

/* =========================================================
 * Resolve section
 *
 * Explicit analytics sections take priority when the
 * element is inside a named component or accordion.
 * ======================================================= */

function getSectionName(
  element: TrackedElement
): string {
  const section =
    element.closest<HTMLElement>(
      SECTION_SELECTOR
    )

  if (!section) {
    return 'property_guide'
  }

  return (
    normalizeText(
      section.dataset.analyticsSection
    ) ||
    normalizeText(section.id) ||
    'property_guide'
  )
}

/* =========================================================
 * Resolve action
 *
 * Prefer stable developer-defined action names.
 * Fall back to accessibility labels or visible text.
 * ======================================================= */

function getActionName(
  element: TrackedElement
): string {
  const explicitAction = truncateText(
    element.dataset.analyticsAction
  )

  if (explicitAction) {
    return explicitAction
  }

  const ariaLabel = truncateText(
    element.getAttribute('aria-label')
  )

  if (ariaLabel) {
    return ariaLabel
  }

  const title = truncateText(
    element.getAttribute('title')
  )

  if (title) {
    return title
  }

  const visibleText = truncateText(
    element.textContent
  )

  if (visibleText) {
    return visibleText
  }

  return element.tagName.toLowerCase()
}

/* =========================================================
 * Resolve venue ID
 *
 * Supports:
 * - data-venue-id on the clicked element
 * - data-venue-id on the venue card container
 *
 * Does not infer venue identity from arbitrary URLs.
 * ======================================================= */

function getVenueId(
  element: TrackedElement
): string | null {
  const directId = normalizeText(
    element.dataset.venueId
  )

  if (directId) {
    return directId
  }

  const venueContainer =
    element.closest<HTMLElement>(
      VENUE_SELECTOR
    )

  return normalizeText(
    venueContainer?.dataset.venueId
  )
}

/* =========================================================
 * Resolve safe navigation metadata
 *
 * Keep only destination pathname.
 *
 * Do not log URL query parameters because they may
 * contain user-specific or sensitive information.
 * ======================================================= */

function getSafeDestination(
  element: TrackedElement
): string | null {
  const href =
    element.getAttribute('href')

  if (!href) {
    return null
  }

  try {
    const parsed = new URL(
      href,
      window.location.href
    )

    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:'
    ) {
      return null
    }

    return parsed.pathname
  } catch {
    return null
  }
}

/* =========================================================
 * Resolve element type
 * ======================================================= */

function getElementType(
  element: TrackedElement
): string {
  return element.tagName.toLowerCase()
}

/* =========================================================
 * Ignore unavailable controls
 * ======================================================= */

function shouldIgnoreInteraction(
  element: TrackedElement
): boolean {
  if (
    element.matches(
      'button:disabled, [aria-disabled="true"]'
    )
  ) {
    return true
  }

  if (
    element.closest(
      '[inert], [aria-hidden="true"]'
    )
  ) {
    return true
  }

  if (
    element.dataset.analyticsIgnore === 'true'
  ) {
    return true
  }

  return false
}

/* =========================================================
 * Analytics
 *
 * All analytics are fire-and-forget.
 * A rejected logging request must not become an
 * unhandled promise rejection.
 * ======================================================= */

function logInteraction(
  metadata: Record<string, unknown>,
  venueId: string | null
): void {
  try {
    void Promise.resolve(
      logEvent(
        EVENT_NAME,
        {
          ...(venueId
            ? {
                venue_id: venueId,
              }
            : {}),
          metadata,
        }
      )
    ).catch((error) => {
      console.warn(
        '[PropertyGuideInteractionTracker] Analytics failed:',
        error
      )
    })
  } catch (error) {
    console.warn(
      '[PropertyGuideInteractionTracker] Analytics failed:',
      error
    )
  }
}

/* =========================================================
 * Component
 * ======================================================= */

export default function PropertyGuideInteractionTracker({
  propertyId,
  propertyName,
  propertySlug,
  city,
  children,
}: Props) {
  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const interactiveElement =
        target.closest<HTMLElement>(
          INTERACTIVE_SELECTOR
        )

      if (!interactiveElement) {
        return
      }

      if (
        !event.currentTarget.contains(
          interactiveElement
        )
      ) {
        return
      }

      if (
        shouldIgnoreInteraction(
          interactiveElement
        )
      ) {
        return
      }

      const action =
        getActionName(
          interactiveElement
        )

      const section =
        getSectionName(
          interactiveElement
        )

      const venueId =
        getVenueId(
          interactiveElement
        )

      const destination =
        getSafeDestination(
          interactiveElement
        )

      const elementType =
        getElementType(
          interactiveElement
        )

      logInteraction(
        {
          page: 'property_guide',

          property_id: propertyId,
          property_name: propertyName,
          property_slug: propertySlug,
          city,

          section,
          action,
          element_type: elementType,
          destination,

          interaction_type: 'click',
        },
        venueId
      )
    },
    [
      propertyId,
      propertyName,
      propertySlug,
      city,
    ]
  )

  return (
    <div
      data-property-guide-tracker="true"
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  )
}
