'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createPortal,
} from 'react-dom'

import FlowRouteSticker from '@/app/flow/[session_id]/components/FlowRouteSticker'
import StickerComposer from '@/components/flows/StickerComposer'

type RouteLinePoint = {
  lat: number
  lon: number
}

type ProfileVisit = {
  id: string
  venueId: string
  venueName: string
  city: string
  visitedAt: string
  localDate: string
  localTime: string
  rating: number | null
  lat: number | null
  lon: number | null
  geoVerified: boolean
  checkInSource: string
  distanceMeters: number | null
  locationAccuracyMeters: number | null
}

type VisitDayGroup = {
  date: string
  label: string
  visitCount: number
  canCreateSticker: boolean
  stickerEligibleVisitCount: number
  visits: ProfileVisit[]
}

type VisitCityGroup = {
  city: string
  visitCount: number
  days: VisitDayGroup[]
}

type VisitHistoryResponse = {
  cities?: VisitCityGroup[]
  visits?: ProfileVisit[]
  totalVisits?: number
  returnedVisits?: number
  error?: string
}

type StickerStop = {
  id: string
  venueId: string
  stopOrder: number
  title: string | null
  city?: string | null
  checkedInAt?: string | null
  lat?: number | null
  lon?: number | null
}

type StickerSelection = {
  city: string
  date: string
  label: string
  stops: StickerStop[]
}

type Props = {
  initialCities?: VisitCityGroup[]
  initialTotalVisits?: number
  className?: string
}

export default function VisitHistorySection({
  initialCities,
  initialTotalVisits,
  className = '',
}: Props) {
  const transparentStickerRef =
    useRef<HTMLDivElement>(null)

  const [
    cities,
    setCities,
  ] = useState<VisitCityGroup[]>(
    initialCities ?? []
  )

  const [
    totalVisits,
    setTotalVisits,
  ] = useState(
    initialTotalVisits ?? 0
  )

  const [
    loading,
    setLoading,
  ] = useState(
    !initialCities
  )

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null)

  const [
    expandedCities,
    setExpandedCities,
  ] = useState<
    Set<string>
  >(
    () => new Set()
  )

  const [
    selectedSticker,
    setSelectedSticker,
  ] = useState<
    StickerSelection | null
  >(null)

  const [
    stickerRouteLine,
    setStickerRouteLine,
  ] = useState<
    RouteLinePoint[]
  >([])

  const [
    stickerOpen,
    setStickerOpen,
  ] = useState(false)

  const [
    stickerLoading,
    setStickerLoading,
  ] = useState(false)

  const [
    exporting,
    setExporting,
  ] = useState(false)

  const [
    portalMounted,
    setPortalMounted,
  ] = useState(false)

  useEffect(() => {
    setPortalMounted(true)

    return () => {
      setPortalMounted(false)
    }
  }, [])

  const loadVisitHistory =
    useCallback(
      async () => {
        setLoading(true)
        setError(null)

        try {
          const timezone =
            Intl.DateTimeFormat()
              .resolvedOptions()
              .timeZone ||
            'UTC'

          const params =
            new URLSearchParams({
              timezone,
              limit: '500',
            })

          const response =
            await fetch(
              `/api/profile/visits?${params.toString()}`,
              {
                method:
                  'GET',

                cache:
                  'no-store',
              }
            )

          const payload =
            (
              await response
                .json()
                .catch(
                  () => null
                )
            ) as
              | VisitHistoryResponse
              | null

          if (
            !response.ok
          ) {
            throw new Error(
              payload?.error ||
                'Failed to load visit history.'
            )
          }

          const nextCities =
            Array.isArray(
              payload?.cities
            )
              ? payload.cities
              : []

          setCities(
            nextCities
          )

          setTotalVisits(
            typeof payload
              ?.totalVisits ===
              'number'
              ? payload
                  .totalVisits
              : nextCities.reduce(
                  (
                    sum,
                    city
                  ) =>
                    sum +
                    city.visitCount,
                  0
                )
          )

          setExpandedCities(
            (
              current
            ) => {
              if (
                current.size >
                  0 ||
                nextCities.length ===
                  0
              ) {
                return current
              }

              return new Set([
                nextCities[0]
                  .city,
              ])
            }
          )
        } catch (err) {
          console.error(
            '[VisitHistorySection] Failed to load visit history:',
            err
          )

          setError(
            err instanceof
              Error
              ? err.message
              : 'Failed to load visit history.'
          )
        } finally {
          setLoading(
            false
          )
        }
      },
      []
    )

  useEffect(() => {
    if (initialCities) {
      if (
        initialCities.length >
        0
      ) {
        setExpandedCities(
          new Set([
            initialCities[0]
              .city,
          ])
        )
      }

      return
    }

    void loadVisitHistory()
  }, [
    initialCities,
    loadVisitHistory,
  ])

  const totalCities =
    cities.length

  const toggleCity = (
    city: string
  ) => {
    setExpandedCities(
      (
        current
      ) => {
        const next =
          new Set(
            current
          )

        if (
          next.has(city)
        ) {
          next.delete(
            city
          )
        } else {
          next.add(
            city
          )
        }

        return next
      }
    )
  }

  const openDaySticker =
    async ({
      city,
      day,
    }: {
      city: string
      day: VisitDayGroup
    }) => {
      if (
        stickerLoading ||
        exporting
      ) {
        return
      }

      const eligibleVisits =
        day.visits
          .filter(
            hasValidVisitCoordinate
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                a.visitedAt
              ).getTime() -
              new Date(
                b.visitedAt
              ).getTime()
          )

      if (
        eligibleVisits.length <
        2
      ) {
        setError(
          'At least two mapped visits are required to create a route sticker.'
        )

        return
      }

      const stops:
        StickerStop[] =
        eligibleVisits.map(
          (
            visit,
            index
          ) => ({
            id:
              visit.id,

            venueId:
              visit.venueId,

            stopOrder:
              index + 1,

            title:
              visit.venueName,

            city:
              visit.city,

            checkedInAt:
              visit.visitedAt,

            lat:
              visit.lat,

            lon:
              visit.lon,
          })
        )

      setStickerLoading(
        true
      )

      setError(null)

      try {
        const routeLine =
          await fetchRouteLine(
            stops
          )

        setSelectedSticker({
          city,
          date:
            day.date,
          label:
            day.label,
          stops,
        })

        setStickerRouteLine(
          routeLine
        )

        setStickerOpen(
          true
        )
      } catch (err) {
        console.error(
          '[VisitHistorySection] Failed to build day route:',
          err
        )

        setError(
          err instanceof
            Error
            ? err.message
            : 'Failed to build the route sticker.'
        )
      } finally {
        setStickerLoading(
          false
        )
      }
    }

  const exportSticker =
    async (
      _composerTarget:
        HTMLElement
    ) => {
      if (
        !selectedSticker ||
        exporting
      ) {
        return
      }

      setExporting(
        true
      )

      setError(null)

      try {
        await waitForFonts()

        await new Promise(
          (
            resolve
          ) =>
            window.setTimeout(
              resolve,
              200
            )
        )

        const target =
          transparentStickerRef
            .current

        if (!target) {
          throw new Error(
            'Transparent sticker export target was not found.'
          )
        }

        const {
          toBlob,
        } =
          await import(
            'html-to-image'
          )

        const blob =
          await toBlob(
            target,
            {
              width:
                1080,

              height:
                1080,

              canvasWidth:
                1080,

              canvasHeight:
                1080,

              pixelRatio:
                2,

              cacheBust:
                true,
            }
          )

        if (!blob) {
          throw new Error(
            'Failed to create transparent route sticker.'
          )
        }

        const safeCity =
          slugify(
            selectedSticker.city
          )

        const fileName =
          `roam-${safeCity}-${selectedSticker.date}-route-sticker.png`

        const file =
          new File(
            [
              blob,
            ],
            fileName,
            {
              type:
                'image/png',
            }
          )

        const canShareFile =
          typeof navigator !==
            'undefined' &&
          typeof navigator.share ===
            'function' &&
          typeof navigator.canShare ===
            'function' &&
          navigator.canShare({
            files: [
              file,
            ],
          })

        if (
          canShareFile
        ) {
          try {
            await navigator.share({
              title:
                `${selectedSticker.city} Roam Route`,

              text:
                buildShareText({
                  city:
                    selectedSticker.city,

                  dateLabel:
                    selectedSticker.label,

                  visitCount:
                    selectedSticker
                      .stops
                      .length,
                }),

              files: [
                file,
              ],
            })

            return
          } catch (
            shareError
          ) {
            if (
              isShareCancellation(
                shareError
              )
            ) {
              return
            }

            console.warn(
              '[VisitHistorySection] Native sharing failed; downloading instead:',
              shareError
            )
          }
        }

        downloadBlob(
          blob,
          fileName
        )
      } catch (err) {
        console.error(
          '[VisitHistorySection] Sticker export failed:',
          err
        )

        setError(
          err instanceof
            Error
            ? err.message
            : 'Failed to export transparent route sticker.'
        )
      } finally {
        setExporting(
          false
        )
      }
    }

  const summary =
    useMemo(
      () => {
        if (
          totalVisits ===
          0
        ) {
          return 'No recorded visits yet.'
        }

        const visitLabel =
          totalVisits ===
          1
            ? 'place'
            : 'places'

        const cityLabel =
          totalCities ===
          1
            ? 'city'
            : 'cities'

        return `${totalVisits} ${visitLabel} across ${totalCities} ${cityLabel}.`
      },
      [
        totalCities,
        totalVisits,
      ]
    )

  return (
    <>
      <section
        className={[
          'rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-white',
          className,
        ]
          .filter(
            Boolean
          )
          .join(
            ' '
          )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
              Places visited
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Your Roam
              history
            </h2>

            <p className="mt-1 text-sm text-neutral-400">
              {summary}
            </p>
          </div>

          {!loading &&
          error ? (
            <button
              type="button"
              onClick={() =>
                void loadVisitHistory()
              }
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800"
            >
              Try Again
            </button>
          ) : null}
        </div>

        {loading ? (
          <VisitHistorySkeleton />
        ) : error &&
          cities.length ===
            0 ? (
          <div className="mt-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
            <p className="text-sm text-red-300">
              {error}
            </p>
          </div>
        ) : cities.length ===
          0 ? (
          <EmptyVisitHistory />
        ) : (
          <div className="mt-5 space-y-3">
            {cities.map(
              (
                cityGroup
              ) => {
                const expanded =
                  expandedCities.has(
                    cityGroup.city
                  )

                return (
                  <article
                    key={
                      cityGroup.city
                    }
                    className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/30"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleCity(
                          cityGroup.city
                        )
                      }
                      aria-expanded={
                        expanded
                      }
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">
                          {
                            cityGroup.city
                          }
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          {
                            cityGroup.visitCount
                          }{' '}
                          {cityGroup.visitCount ===
                          1
                            ? 'visit'
                            : 'visits'}
                        </p>
                      </div>

                      <span
                        aria-hidden="true"
                        className={[
                          'text-lg text-neutral-500 transition-transform',
                          expanded
                            ? 'rotate-180'
                            : '',
                        ].join(
                          ' '
                        )}
                      >
                        ⌄
                      </span>
                    </button>

                    {expanded ? (
                      <div className="border-t border-neutral-800 px-4 pb-4">
                        <div className="space-y-4 pt-4">
                          {cityGroup.days.map(
                            (
                              day
                            ) => (
                              <VisitDayCard
                                key={`${cityGroup.city}-${day.date}`}
                                city={
                                  cityGroup.city
                                }
                                day={
                                  day
                                }
                                stickerLoading={
                                  stickerLoading
                                }
                                exporting={
                                  exporting
                                }
                                onCreateSticker={() =>
                                  void openDaySticker({
                                    city:
                                      cityGroup.city,

                                    day,
                                  })
                                }
                              />
                            )
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              }
            )}
          </div>
        )}

        {error &&
        cities.length >
          0 ? (
          <p className="mt-4 text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </section>

      <div
        className="pointer-events-none fixed"
        aria-hidden="true"
        style={{
          left:
            '-10000px',

          top:
            0,

          width:
            1080,

          height:
            1080,

          background:
            'transparent',

          zIndex:
            -1,

          overflow:
            'visible',
        }}
      >
        <div
          ref={
            transparentStickerRef
          }
          style={{
            width:
              1080,

            height:
              1080,

            background:
              'transparent',
          }}
        >
          {selectedSticker ? (
            <FlowRouteSticker
              title={`${selectedSticker.city} · ${selectedSticker.label}`}
              city={
                selectedSticker.city
              }
              stops={
                selectedSticker.stops
              }
              routeLine={
                stickerRouteLine
              }
              width={
                1080
              }
              height={
                1080
              }
              variant="transparent-export"
              routeKind="personal"
            />
          ) : null}
        </div>
      </div>

      {portalMounted &&
      stickerOpen &&
      selectedSticker
        ? createPortal(
            <StickerComposer
              open
              title="Day Route Sticker"
              exporting={
                exporting
              }
              exportLabel="Export Sticker"
              onClose={() => {
                if (
                  exporting
                ) {
                  return
                }

                setStickerOpen(
                  false
                )

                setSelectedSticker(
                  null
                )

                setStickerRouteLine(
                  []
                )
              }}
              onExport={
                exportSticker
              }
              sticker={
                <FlowRouteSticker
                  title={`${selectedSticker.city} · ${selectedSticker.label}`}
                  city={
                    selectedSticker.city
                  }
                  stops={
                    selectedSticker.stops
                  }
                  routeLine={
                    stickerRouteLine
                  }
                  routeKind="personal"
                />
              }
            />,
            document.body
          )
        : null}
    </>
  )
}

function VisitDayCard({
  city,
  day,
  stickerLoading,
  exporting,
  onCreateSticker,
}: {
  city: string
  day: VisitDayGroup
  stickerLoading: boolean
  exporting: boolean
  onCreateSticker: () => void
}) {
  const disabled =
    stickerLoading ||
    exporting

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            {day.label}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {
              day.visitCount
            }{' '}
            {day.visitCount ===
            1
              ? 'place visited'
              : 'places visited'}
          </p>
        </div>

        {day.canCreateSticker ? (
          <button
            type="button"
            onClick={
              onCreateSticker
            }
            disabled={
              disabled
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-cyan-700 bg-cyan-950/40 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {stickerLoading
              ? 'Building Route…'
              : 'Create Sticker'}
          </button>
        ) : (
          <p className="text-xs text-neutral-600">
            Visit two mapped
            places in one day
            to create a
            sticker.
          </p>
        )}
      </div>

      <ol className="mt-4 space-y-3">
        {day.visits.map(
          (
            visit,
            index
          ) => (
            <li
              key={
                visit.id
              }
              className="flex items-start gap-3 rounded-xl border border-neutral-800/80 bg-black/30 p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {
                        visit.venueName
                      }
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      {visit.localTime ||
                        city}
                    </p>
                  </div>

                  {visit.rating ? (
                    <p
                      className="shrink-0 text-xs text-amber-400"
                      aria-label={`${visit.rating} out of 5 stars`}
                    >
                      {'★'.repeat(
                        visit.rating
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {visit.geoVerified ? (
                    <span className="rounded-full border border-emerald-800/70 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      Verified
                      visit
                    </span>
                  ) : null}

                  {visit.checkInSource &&
                  visit.checkInSource !==
                    'unknown' ? (
                    <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500">
                      {humanizeSource(
                        visit.checkInSource
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          )
        )}
      </ol>
    </section>
  )
}

function VisitHistorySkeleton() {
  return (
    <div
      className="mt-5 space-y-3"
      aria-label="Loading visit history"
    >
      {[0, 1].map(
        (
          item
        ) => (
          <div
            key={
              item
            }
            className="animate-pulse rounded-2xl border border-neutral-800 bg-black/30 p-4"
          >
            <div className="h-4 w-32 rounded bg-neutral-800" />

            <div className="mt-2 h-3 w-20 rounded bg-neutral-900" />

            <div className="mt-5 space-y-3">
              <div className="h-16 rounded-xl bg-neutral-900" />

              <div className="h-16 rounded-xl bg-neutral-900" />
            </div>
          </div>
        )
      )}
    </div>
  )
}

function EmptyVisitHistory() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 bg-black/20 px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-2xl">
        📍
      </div>

      <p className="mt-4 text-sm font-semibold text-white">
        Your visited
        places will
        appear here
      </p>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Check in at
        venues while
        roaming. Visits
        will be organized
        by city and date,
        and eligible days
        can become route
        stickers.
      </p>
    </div>
  )
}

async function fetchRouteLine(
  stops: StickerStop[]
): Promise<
  RouteLinePoint[]
> {
  const validStops =
    stops.filter(
      (
        stop
      ): stop is
        StickerStop & {
          lat: number
          lon: number
        } =>
        typeof stop.lat ===
          'number' &&
        Number.isFinite(
          stop.lat
        ) &&
        Math.abs(
          stop.lat
        ) <=
          90 &&
        typeof stop.lon ===
          'number' &&
        Number.isFinite(
          stop.lon
        ) &&
        Math.abs(
          stop.lon
        ) <=
          180
    )

  if (
    validStops.length <
    2
  ) {
    throw new Error(
      'At least two mapped visits are required to build a route.'
    )
  }

  const origin =
    validStops[0]

  const destination =
    validStops[
      validStops.length -
        1
    ]

  const waypoints =
    validStops.slice(
      1,
      -1
    )

  const fullRouteResponse =
    await fetch(
      '/api/mapbox',
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            origin: {
              lat:
                origin.lat,

              lng:
                origin.lon,
            },

            destination:
              {
                lat:
                  destination.lat,

                lng:
                  destination.lon,
              },

            waypoints:
              waypoints.map(
                (
                  stop
                ) => ({
                  lat:
                    stop.lat,

                  lng:
                    stop.lon,
                })
              ),

            travelMode:
              'walking',

            geometries:
              'geojson',

            overview:
              'full',
          }),
      }
    )

  const fullRoutePayload =
    await fullRouteResponse
      .json()
      .catch(
        () => null
      )

  const fullRouteLine =
    extractRouteLineFromMapboxResponse(
      fullRoutePayload
    )

  if (
    fullRouteResponse.ok &&
    fullRouteLine.length >=
      2
  ) {
    return fullRouteLine
  }

  const routedLine:
    RouteLinePoint[] =
    []

  for (
    let index =
      1;
    index <
    validStops.length;
    index +=
    1
  ) {
    const from =
      validStops[
        index - 1
      ]

    const to =
      validStops[
        index
      ]

    const response =
      await fetch(
        '/api/mapbox',
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              {
                origin:
                  {
                    lat:
                      from.lat,

                    lng:
                      from.lon,
                  },

                destination:
                  {
                    lat:
                      to.lat,

                    lng:
                      to.lon,
                  },

                waypoints:
                  [],

                travelMode:
                  'walking',

                geometries:
                  'geojson',

                overview:
                  'full',
              }
            ),
        }
      )

    const payload =
      await response
        .json()
        .catch(
          () => null
        )

    if (
      !response.ok
    ) {
      throw new Error(
        payload?.error ||
          'Failed to build route between visits.'
      )
    }

    const segment =
      extractRouteLineFromMapboxResponse(
        payload
      )

    if (
      segment.length <
      2
    ) {
      throw new Error(
        'Mapbox route geometry was unavailable.'
      )
    }

    routedLine.push(
      ...(routedLine.length >
      0
        ? segment.slice(
            1
          )
        : segment)
    )
  }

  if (
    routedLine.length <
    2
  ) {
    throw new Error(
      'The visit route could not be generated.'
    )
  }

  return routedLine
}

function extractRouteLineFromMapboxResponse(
  data: unknown
): RouteLinePoint[] {
  const payload =
    data as
      | {
          geometry?:
            unknown

          routeGeometry?:
            unknown

          route?: {
            geometry?:
              unknown
          }

          routes?: Array<{
            geometry?:
              unknown
          }>
        }
      | null

  const candidates = [
    getGeometryCoordinates(
      payload?.geometry
    ),

    getGeometryCoordinates(
      payload
        ?.routeGeometry
    ),

    getGeometryCoordinates(
      payload?.route
        ?.geometry
    ),

    getGeometryCoordinates(
      payload?.routes?.[0]
        ?.geometry
    ),

    payload?.routes?.[0]
      ?.geometry,

    payload?.geometry,
  ]

  for (
    const candidate of
      candidates
  ) {
    const parsed =
      parseRouteGeometry(
        candidate
      )

    if (
      parsed.length >=
      2
    ) {
      return parsed
    }
  }

  return []
}

function getGeometryCoordinates(
  value: unknown
): unknown {
  if (
    typeof value ===
      'object' &&
    value !==
      null &&
    'coordinates' in
      value
  ) {
    return (
      value as {
        coordinates?:
          unknown
      }
    ).coordinates
  }

  return value
}

function parseRouteGeometry(
  value: unknown
): RouteLinePoint[] {
  if (!value) {
    return []
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        (
          coordinate
        ) => {
          if (
            Array.isArray(
              coordinate
            ) &&
            typeof coordinate[0] ===
              'number' &&
            typeof coordinate[1] ===
              'number'
          ) {
            return {
              lon:
                coordinate[0],

              lat:
                coordinate[1],
            }
          }

          return null
        }
      )
      .filter(
        (
          point
        ): point is RouteLinePoint => {
          if (!point) {
            return false
          }

          return (
            Number.isFinite(
              point.lat
            ) &&
            Number.isFinite(
              point.lon
            ) &&
            Math.abs(
              point.lat
            ) <=
              90 &&
            Math.abs(
              point.lon
            ) <=
              180
          )
        }
      )
  }

  if (
    typeof value ===
      'object' &&
    value !==
      null
  ) {
    const objectValue =
      value as {
        type?:
          string

        coordinates?:
          unknown

        geometry?:
          unknown
      }

    if (
      objectValue.type ===
      'LineString'
    ) {
      return parseRouteGeometry(
        objectValue.coordinates
      )
    }

    if (
      objectValue.geometry
    ) {
      return parseRouteGeometry(
        objectValue.geometry
      )
    }

    if (
      objectValue.coordinates
    ) {
      return parseRouteGeometry(
        objectValue.coordinates
      )
    }
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
      .length >
      0
  ) {
    const polyline6 =
      decodePolyline(
        value,
        6
      )

    if (
      polyline6.length >=
      2
    ) {
      return polyline6
    }

    const polyline5 =
      decodePolyline(
        value,
        5
      )

    if (
      polyline5.length >=
      2
    ) {
      return polyline5
    }
  }

  return []
}

function decodePolyline(
  encoded: string,
  precision: number
): RouteLinePoint[] {
  const coordinates:
    RouteLinePoint[] =
    []

  const factor =
    Math.pow(
      10,
      precision
    )

  let index =
    0

  let latitude =
    0

  let longitude =
    0

  while (
    index <
    encoded.length
  ) {
    let result =
      0

    let shift =
      0

    let byte =
      0

    do {
      byte =
        encoded.charCodeAt(
          index++
        ) -
        63

      result |=
        (
          byte &
          0x1f
        ) <<
        shift

      shift +=
        5
    } while (
      byte >=
        0x20 &&
      index <
        encoded.length
    )

    const latitudeDelta =
      result &
      1
        ? ~(
            result >>
            1
          )
        : result >>
          1

    latitude +=
      latitudeDelta

    result =
      0

    shift =
      0

    do {
      byte =
        encoded.charCodeAt(
          index++
        ) -
        63

      result |=
        (
          byte &
          0x1f
        ) <<
        shift

      shift +=
        5
    } while (
      byte >=
        0x20 &&
      index <
        encoded.length
    )

    const longitudeDelta =
      result &
      1
        ? ~(
            result >>
            1
          )
        : result >>
          1

    longitude +=
      longitudeDelta

    const point = {
      lat:
        latitude /
        factor,

      lon:
        longitude /
        factor,
    }

    if (
      Number.isFinite(
        point.lat
      ) &&
      Number.isFinite(
        point.lon
      ) &&
      Math.abs(
        point.lat
      ) <=
        90 &&
      Math.abs(
        point.lon
      ) <=
        180
    ) {
      coordinates.push(
        point
      )
    }
  }

  return coordinates
}

function hasValidVisitCoordinate(
  visit: ProfileVisit
): boolean {
  return (
    typeof visit.lat ===
      'number' &&
    Number.isFinite(
      visit.lat
    ) &&
    Math.abs(
      visit.lat
    ) <=
      90 &&
    typeof visit.lon ===
      'number' &&
    Number.isFinite(
      visit.lon
    ) &&
    Math.abs(
      visit.lon
    ) <=
      180
  )
}

function humanizeSource(
  value: string
): string {
  return value
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    )
}

function slugify(
  value: string
): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      ) ||
    'city'
  )
}

function buildShareText({
  city,
  dateLabel,
  visitCount,
}: {
  city: string
  dateLabel: string
  visitCount: number
}): string {
  return `I visited ${visitCount} places across ${city} on ${dateLabel}.`
}

function downloadBlob(
  blob: Blob,
  fileName: string
) {
  const url =
    URL.createObjectURL(
      blob
    )

  const link =
    document.createElement(
      'a'
    )

  link.href =
    url

  link.download =
    fileName

  link.rel =
    'noopener'

  link.style.position =
    'fixed'

  link.style.left =
    '-9999px'

  link.style.top =
    '0'

  document.body.appendChild(
    link
  )

  link.click()

  window.setTimeout(
    () => {
      link.remove()

      URL.revokeObjectURL(
        url
      )
    },
    1500
  )
}

async function waitForFonts() {
  if (
    typeof document !==
      'undefined' &&
    'fonts' in
      document
  ) {
    await document
      .fonts
      .ready
  }

  await new Promise(
    (
      resolve
    ) =>
      window.setTimeout(
        resolve,
        100
      )
  )
}

function isShareCancellation(
  error: unknown
): boolean {
  return (
    error instanceof
      DOMException &&
    error.name ===
      'AbortError'
  )
}