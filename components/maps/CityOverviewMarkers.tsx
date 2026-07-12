'use client'

import { Marker, Tooltip } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { DivIcon } from 'leaflet'

import { CITY_CONFIGS } from '@/config/cities'
import type {
  CityActivityBySlug,
  CitySlug,
} from '@/lib/maps/mapTypes'
import {
  getCityOverviewIcon,
  getCityOverviewIconZIndex,
} from '@/lib/maps/icons'

type Props = {
  onSelectCity: (slug: string) => void
  excludedCity?: string | null

  /**
   * Optional initiative-ready inputs.
   *
   * Existing callers do not need to provide these.
   */
  selectedCity?: CitySlug | null
  markerScale?: number
  cityActivity?: CityActivityBySlug
}

type CityIconMap = Partial<Record<CitySlug, DivIcon>>

const EMPTY_CITY_ACTIVITY: CityActivityBySlug = {}

/**
 * Explicit, recognizable city abbreviations for overview markers.
 *
 * Any city not listed here still falls back to its configured abbreviation
 * or the first three letters of its display name.
 */
const CITY_OVERVIEW_ABBREVIATIONS: Partial<
  Record<CitySlug, string>
> = {
  atl: 'ATL',
  nyc: 'NYC',
  la: 'LA',
  mia: 'MIA',
  london: 'LDN',
  lisbon: 'LIS',
  porto: 'OPO',
  rome: 'ROM',
  paris: 'PAR',
}

export default function CityOverviewMarkers({
  onSelectCity,
  excludedCity = null,
  selectedCity = null,
  markerScale = 1,
  cityActivity = EMPTY_CITY_ACTIVITY,
}: Props) {
  const [cityIcons, setCityIcons] = useState<CityIconMap>({})

  const cityEntries = useMemo(
    () =>
      Object.entries(CITY_CONFIGS) as Array<
        [
          CitySlug,
          (typeof CITY_CONFIGS)[CitySlug],
        ]
      >,
    []
  )

  const visibleCities = useMemo(
    () =>
      cityEntries.filter(
        ([slug]) => slug !== excludedCity
      ),
    [cityEntries, excludedCity]
  )

  useEffect(() => {
    let active = true

    async function buildCityIcons() {
      try {
        const iconEntries = await Promise.all(
          visibleCities.map(
            async ([slug, config]) => {
              const activity =
                cityActivity[slug]

              const liveEventCount =
                activity?.liveEventCount ?? 0

              const configuredAbbreviation =
                'abbreviation' in config &&
                typeof config.abbreviation ===
                  'string'
                  ? config.abbreviation
                      .trim()
                      .toUpperCase()
                  : null

              const abbreviation =
                CITY_OVERVIEW_ABBREVIATIONS[
                  slug
                ] ??
                configuredAbbreviation ??
                config.name
                  .slice(0, 3)
                  .toUpperCase()

              const icon =
                await getCityOverviewIcon({
                  abbreviation,
                  selected:
                    selectedCity === slug,
                  scale: markerScale,
                  hasLiveActivity:
                    liveEventCount > 0,
                  venueCount:
                    activity?.venueCount ??
                    null,
                  liveEventCount,
                  interactive: true,
                })

              return [slug, icon] as const
            }
          )
        )

        if (!active) return

        setCityIcons(
          Object.fromEntries(
            iconEntries
          ) as CityIconMap
        )
      } catch (error: unknown) {
        if (
          active &&
          process.env.NODE_ENV ===
            'development'
        ) {
          console.error(
            '[CityOverviewMarkers] Failed to create city icons',
            error
          )
        }
      }
    }

    void buildCityIcons()

    return () => {
      active = false
    }
  }, [
    visibleCities,
    selectedCity,
    markerScale,
    cityActivity,
  ])

  return (
    <>
      {visibleCities.map(
        ([slug, config]) => {
          const icon = cityIcons[slug]

          if (!icon) return null

          const activity =
            cityActivity[slug]

          const liveEventCount =
            activity?.liveEventCount ?? 0

          return (
            <Marker
              key={slug}
              position={config.center}
              icon={icon}
              zIndexOffset={getCityOverviewIconZIndex(
                {
                  selected:
                    selectedCity === slug,
                  hasLiveActivity:
                    liveEventCount > 0,
                }
              )}
              eventHandlers={{
                click: () =>
                  onSelectCity(slug),
              }}
            >
              <Tooltip>
                <div>
                  <strong>
                    {config.name}
                  </strong>

                  {activity?.venueCount !==
                    null &&
                    activity?.venueCount !==
                      undefined && (
                      <div>
                        {
                          activity.venueCount
                        }{' '}
                        curated places
                      </div>
                    )}

                  {liveEventCount > 0 && (
                    <div>
                      {liveEventCount} live{' '}
                      {liveEventCount === 1
                        ? 'event'
                        : 'events'}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          )
        }
      )}
    </>
  )
}