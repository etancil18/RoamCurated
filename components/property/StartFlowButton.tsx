'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { logEvent } from '@/lib/logEvent'

type TravelMode = 'walking' | 'cycling' | 'driving'

export type PropertyFlowSource =
  | 'property_guide'
  | 'property_crawl'
  | 'property_event_journey'
  | 'white_label_guide_suggested_flow'

type Props = {
  title: string
  city?: string | null
  propertyId?: string | null
  propertySlug?: string | null
  venueIds: string[]
  source?: PropertyFlowSource
  themeId?: string | null
  travelMode?: TravelMode
  metadata?: Record<string, unknown>

  label?: string
  loadingLabel?: string

  disabled?: boolean
  className?: string
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']

  onStarted?: (session: any) => void
  onConflict?: (activeSession: any) => void
}

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn('[PropertyStartFlowButton]', error)
  }
}

function normalizeVenueIds(ids: string[]) {
  return Array.from(
    new Set(
      (ids ?? [])
        .map((id) => String(id).trim())
        .filter(Boolean)
    )
  )
}

export default function StartFlowButton({
  title,
  city = null,
  propertyId = null,
  propertySlug = null,
  venueIds,

  source = 'property_guide',
  themeId = null,
  travelMode = 'walking',
  metadata = {},

  label = 'Start Experience',
  loadingLabel = 'Starting...',

  disabled = false,
  className,

  variant = 'default',
  size,

  onStarted,
  onConflict,
}: Props) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  const normalizedVenueIds = normalizeVenueIds(venueIds)

  const canStart = normalizedVenueIds.length >= 2

  async function startFlow() {
    if (loading || disabled || !canStart) return

    setLoading(true)

    const analytics = {
      title,
      city,
      property_id: propertyId,
      property_slug: propertySlug,
      source,
      theme_id: themeId,
      travel_mode: travelMode,
      stop_count: normalizedVenueIds.length,
      venue_ids: normalizedVenueIds,
      ...metadata,
    }

    safeLogEvent(
      'property_flow_start_clicked',
      analytics
    )

    try {
      const response = await fetch('/api/active-flow/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          city,

          source,

          source_id: propertyId,

          venue_ids: normalizedVenueIds,

          theme_id: themeId,

          travel_mode: travelMode,

          metadata: {
            property_id: propertyId,
            property_slug: propertySlug,
            ...metadata,
          },
        }),
      })

      const json = await response.json().catch(() => null)

      if (response.status === 409 && json?.activeSession) {
        safeLogEvent(
          'property_flow_existing_session',
          {
            ...analytics,
            active_session_id: json.activeSession.id,
          }
        )

        onConflict?.(json.activeSession)

        const resume = window.confirm(
          'You already have an active experience. Resume it?'
        )

        if (resume) {
          router.push(`/flow/${json.activeSession.id}`)
        }

        return
      }

      if (!response.ok) {
        safeLogEvent(
          'property_flow_start_failed',
          {
            ...analytics,
            status: response.status,
            error: json?.error,
          }
        )

        alert(json?.error ?? 'Unable to start experience.')

        return
      }

      const session = json?.session

      if (!session?.id) {
        alert('Flow started but session was not returned.')
        return
      }

      safeLogEvent(
        'property_flow_started',
        {
          ...analytics,
          session_id: session.id,
        }
      )

      onStarted?.(session)

      router.push(
        json?.redirectTo ??
          `/flow/${session.id}`
      )
    } catch (error) {
      console.error(error)

      safeLogEvent(
        'property_flow_start_error',
        {
          ...analytics,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error',
        }
      )

      alert('Unexpected error starting experience.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={startFlow}
      disabled={!canStart || disabled || loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? loadingLabel : label}
    </Button>
  )
}