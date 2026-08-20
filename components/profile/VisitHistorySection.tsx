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
import {
  useRouter,
} from 'next/navigation'

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

type QualifyingRoamStop = {
  visitId: string
  venueId: string
  stopIndex: number
  visitedAt: string
  rating: number | null
  checkInSource: string | null
  venue: {
    id: string
    name: string | null
    city: string | null
    address: string | null
    lat: number | null
    lon: number | null
  }
}

type QualifyingRoamSnapshot = {
  id: string
  visibility: 'public' | 'private'
  replayable: boolean
  status: string | null
  createdAt: string
}

type QualifyingRoamDay = {
  sourceId: string
  roamDay: string
  cityKey: string
  city: string | null
  timezone: string
  windowStartAt: string
  windowEndAt: string
  firstVisitedAt: string
  lastVisitedAt: string
  distinctVenueCount: number
  stops: QualifyingRoamStop[]
  snapshot: QualifyingRoamSnapshot | null
  alreadySnapshotted: boolean
}

type VisitHistoryResponse = {
  cities?: VisitCityGroup[]
  visits?: ProfileVisit[]
  qualifyingRoams?: QualifyingRoamDay[]
  totalVisits?: number
  returnedVisits?: number
  error?: string
}

type SaveRoamSnapshotResponse = {
  snapshot?: {
    id: string
    visibility?: 'public' | 'private' | null
    replayable?: boolean | null
    status?: string | null
    created_at?: string | null
  }
  error?: string
  details?: string
}

type UpdateRoamSnapshotResponse = {
  snapshot?: {
    id: string
    visibility?: 'public' | 'private' | null
    replayable?: boolean | null
    status?: string | null
    created_at?: string | null
  }
  updated?: boolean
  error?: string
  details?: string
}

type SnapshotLifecycleField =
  | 'visibility'
  | 'replayable'

type SnapshotLifecycleUpdate = {
  sourceId: string
  field: SnapshotLifecycleField
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

type RoamSnapshotSelection = {
  sourceId: string
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
  const router =
    useRouter()

  const transparentStickerRef =
    useRef<HTMLDivElement>(null)

  const roamSnapshotRef =
    useRef<HTMLDivElement>(null)

  const [
    cities,
    setCities,
  ] = useState<VisitCityGroup[]>(
    initialCities ?? []
  )

  const [
    qualifyingRoams,
    setQualifyingRoams,
  ] = useState<QualifyingRoamDay[]>([])

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

  const [
    savingRoamSourceId,
    setSavingRoamSourceId,
  ] = useState<string | null>(
    null
  )

  const [
    snapshotLifecycleUpdate,
    setSnapshotLifecycleUpdate,
  ] = useState<
    SnapshotLifecycleUpdate | null
  >(null)

  const [
    roamSnapshotSelection,
    setRoamSnapshotSelection,
  ] = useState<
    RoamSnapshotSelection | null
  >(null)

  const [
    roamSnapshotRouteLine,
    setRoamSnapshotRouteLine,
  ] = useState<
    RouteLinePoint[]
  >([])

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

          const nextQualifyingRoams =
            Array.isArray(
              payload?.qualifyingRoams
            )
              ? payload.qualifyingRoams
              : []

          setCities(
            nextCities
          )

          setQualifyingRoams(
            nextQualifyingRoams
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

  const loadQualifyingRoams =
    useCallback(
      async () => {
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
                'Failed to load qualifying roams.'
            )
          }

          setQualifyingRoams(
            Array.isArray(
              payload?.qualifyingRoams
            )
              ? payload.qualifyingRoams
              : []
          )
        } catch (err) {
          console.error(
            '[VisitHistorySection] Failed to load qualifying roams:',
            err
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

      void loadQualifyingRoams()

      return
    }

    void loadVisitHistory()
  }, [
    initialCities,
    loadQualifyingRoams,
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

  /**
   * Competition submission starts with explicit competition
   * selection.
   *
   * The browser carries only the canonical Visit History day.
   * The competition submissions API later re-fetches that user's
   * venue_visits for the day and remains authoritative for route
   * ownership and eligibility.
   */
  const submitVisitDayToCompetition =
    (
      day: VisitDayGroup
    ) => {
      const verifiedVenueIds =
        getVerifiedCompetitionVenueIds(
          day
        )

      if (
        verifiedVenueIds.length <
        3
      ) {
        return
      }

      const params =
        new URLSearchParams({
          submit_source:
            'visit_history',

          visit_date:
            day.date,
        })

      router.push(
        `/competitions?${params.toString()}`
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

  const saveRoamSnapshot =
    async (
      roam: QualifyingRoamDay
    ) => {
      if (
        savingRoamSourceId ||
        roam.alreadySnapshotted
      ) {
        return
      }

      const stops:
        StickerStop[] =
        roam.stops.map(
          (
            stop,
            index
          ) => ({
            id:
              stop.visitId,

            venueId:
              stop.venueId,

            stopOrder:
              index + 1,

            title:
              stop.venue.name,

            city:
              stop.venue.city ??
              roam.city,

            checkedInAt:
              stop.visitedAt,

            lat:
              stop.venue.lat,

            lon:
              stop.venue.lon,
          })
        )

      if (
        stops.length <
        3
      ) {
        setError(
          'This roam no longer contains enough qualifying stops to save.'
        )

        return
      }

      const cityName =
        roam.city ??
        roam.cityKey

      const label =
        formatRoamDayLabel(
          roam.roamDay
        )

      setSavingRoamSourceId(
        roam.sourceId
      )

      setError(null)

      try {
        const routeLine =
          await buildSnapshotRouteLine(
            stops
          )

        setRoamSnapshotSelection({
          sourceId:
            roam.sourceId,

          city:
            cityName,

          date:
            roam.roamDay,

          label,

          stops,
        })

        setRoamSnapshotRouteLine(
          routeLine
        )

        await waitForFonts()
        await waitForDomPaint()

        const target =
          roamSnapshotRef.current

        if (!target) {
          throw new Error(
            'Roam snapshot export target was not found.'
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

              backgroundColor:
                '#020617',
            }
          )

        if (!blob) {
          throw new Error(
            'Failed to create the roam snapshot image.'
          )
        }

        const file =
          new File(
            [
              blob,
            ],
            `roam-${slugify(
              cityName
            )}-${roam.roamDay}-snapshot.png`,
            {
              type:
                'image/png',
            }
          )

        const formData =
          new FormData()

        formData.append(
          'file',
          file
        )

        formData.append(
          'source_type',
          'roam_history'
        )

        formData.append(
          'source_id',
          roam.sourceId
        )

        formData.append(
          'route_summary',
          stops
            .map(
              (
                stop
              ) =>
                stop.title ??
                `Stop ${stop.stopOrder}`
            )
            .join(
              ' → '
            )
        )

        /*
         * Saving historical evidence should not silently publish
         * it. The visibility lifecycle remains an explicit action.
         */
        formData.append(
          'visibility',
          'private'
        )

        const response =
          await fetch(
            '/api/flow-snapshots/save',
            {
              method:
                'POST',

              body:
                formData,
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
            | SaveRoamSnapshotResponse
            | null

        if (
          !response.ok
        ) {
          throw new Error(
            payload?.error ||
              payload?.details ||
              'Failed to save roam snapshot.'
          )
        }

        if (
          !payload?.snapshot?.id
        ) {
          throw new Error(
            'The roam snapshot was saved but no snapshot record was returned.'
          )
        }

        const snapshot =
          payload.snapshot

        setQualifyingRoams(
          (
            current
          ) =>
            current.map(
              (
                candidate
              ) => {
                if (
                  candidate.sourceId !==
                  roam.sourceId
                ) {
                  return candidate
                }

                return {
                  ...candidate,

                  alreadySnapshotted:
                    true,

                  snapshot: {
                    id:
                      snapshot.id,

                    visibility:
                      snapshot.visibility ===
                      'public'
                        ? 'public'
                        : 'private',

                    replayable:
                      snapshot.replayable ===
                      true,

                    status:
                      typeof snapshot.status ===
                        'string'
                        ? snapshot.status
                        : 'completed',

                    createdAt:
                      typeof snapshot.created_at ===
                        'string'
                        ? snapshot.created_at
                        : new Date()
                            .toISOString(),
                  },
                }
              }
            )
        )
      } catch (err) {
        console.error(
          '[VisitHistorySection] Failed to save qualifying roam snapshot:',
          err
        )

        setError(
          err instanceof
            Error
            ? err.message
            : 'Failed to save roam snapshot.'
        )
      } finally {
        setSavingRoamSourceId(
          null
        )
      }
    }

  /*
   * Snapshot visibility and replayability are intentionally
   * independent lifecycle controls.
   *
   * Each action PATCHes only the field the user explicitly chose.
   * Server-side policy remains authoritative for combinations
   * such as private + replayable.
   */
  const updateRoamSnapshotLifecycle =
    async ({
      roam,
      field,
      value,
    }: {
      roam: QualifyingRoamDay
      field: SnapshotLifecycleField
      value:
        | 'public'
        | 'private'
        | boolean
    }) => {
      const snapshot =
        roam.snapshot

      if (
        !snapshot ||
        snapshotLifecycleUpdate
      ) {
        return
      }

      if (
        field ===
          'visibility' &&
        value !==
          'public' &&
        value !==
          'private'
      ) {
        return
      }

      if (
        field ===
          'replayable' &&
        typeof value !==
          'boolean'
      ) {
        return
      }

      setSnapshotLifecycleUpdate({
        sourceId:
          roam.sourceId,
        field,
      })

      setError(null)

      try {
        const response =
          await fetch(
            `/api/flow-snapshots/${encodeURIComponent(
              snapshot.id
            )}`,
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  [field]:
                    value,
                }),
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
            | UpdateRoamSnapshotResponse
            | null

        if (
          !response.ok
        ) {
          throw new Error(
            payload?.error ||
              payload?.details ||
              'Failed to update snapshot.'
          )
        }

        if (
          !payload?.snapshot?.id
        ) {
          throw new Error(
            'The snapshot was updated but no snapshot record was returned.'
          )
        }

        const updatedSnapshot =
          payload.snapshot

        setQualifyingRoams(
          (
            current
          ) =>
            current.map(
              (
                candidate
              ) => {
                if (
                  candidate.sourceId !==
                  roam.sourceId ||
                  !candidate.snapshot
                ) {
                  return candidate
                }

                return {
                  ...candidate,

                  snapshot: {
                    ...candidate.snapshot,

                    visibility:
                      updatedSnapshot.visibility ===
                      'public'
                        ? 'public'
                        : 'private',

                    replayable:
                      updatedSnapshot.replayable ===
                      true,

                    status:
                      typeof updatedSnapshot.status ===
                        'string'
                        ? updatedSnapshot.status
                        : candidate.snapshot.status,

                    createdAt:
                      typeof updatedSnapshot.created_at ===
                        'string'
                        ? updatedSnapshot.created_at
                        : candidate.snapshot.createdAt,
                  },
                }
              }
            )
        )
      } catch (err) {
        console.error(
          '[VisitHistorySection] Failed to update roam snapshot lifecycle:',
          err
        )

        setError(
          err instanceof
            Error
            ? err.message
            : 'Failed to update snapshot.'
        )
      } finally {
        setSnapshotLifecycleUpdate(
          null
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
          return 'Your city history starts with the first place you actually go.'
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
          'relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-white/[0.045] to-white/[0.02] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.065] sm:p-6',
          className,
        ]
          .filter(
            Boolean
          )
          .join(
            ' '
          )}
      >
        <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-52 w-52 rounded-full bg-cyan-400/[0.07] blur-[90px]" />

        <div className="relative z-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/70" />

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                  Where you have been
                </p>
              </div>

              <h2 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-[1.75rem]">
                Your city history
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
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
                className="inline-flex min-h-10 w-fit items-center justify-center rounded-full bg-white/[0.055] px-4 py-2 text-xs font-bold text-zinc-300 ring-1 ring-white/[0.08] transition hover:bg-white/[0.09] hover:text-white"
              >
                Try again
              </button>
            ) : null}
          </div>

          {!loading &&
          qualifyingRoams.length >
            0 ? (
            <QualifyingRoamsPanel
              roams={
                qualifyingRoams
              }
              savingRoamSourceId={
                savingRoamSourceId
              }
              snapshotLifecycleUpdate={
                snapshotLifecycleUpdate
              }
              onSaveSnapshot={(
                roam
              ) =>
                void saveRoamSnapshot(
                  roam
                )
              }
              onUpdateVisibility={(
                roam,
                visibility
              ) =>
                void updateRoamSnapshotLifecycle({
                  roam,
                  field:
                    'visibility',
                  value:
                    visibility,
                })
              }
              onUpdateReplayable={(
                roam,
                replayable
              ) =>
                void updateRoamSnapshotLifecycle({
                  roam,
                  field:
                    'replayable',
                  value:
                    replayable,
                })
              }
            />
          ) : null}

          {loading ? (
            <VisitHistorySkeleton />
          ) : error &&
            cities.length ===
              0 ? (
            <div className="mt-6 rounded-[1.5rem] bg-red-950/15 p-4 ring-1 ring-red-500/20">
              <p className="text-sm leading-6 text-red-300/80">
                {error}
              </p>
            </div>
          ) : cities.length ===
            0 ? (
            <EmptyVisitHistory />
          ) : (
            <div className="mt-7 space-y-3">
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
                      className="overflow-hidden rounded-[1.75rem] bg-black/25 ring-1 ring-white/[0.06]"
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
                        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:px-5 sm:py-5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black tracking-tight text-white">
                            {
                              cityGroup.city
                            }
                          </p>

                          <p className="mt-1.5 text-xs font-medium text-zinc-600">
                            {
                              cityGroup.visitCount
                            }{' '}
                            {cityGroup.visitCount ===
                            1
                              ? 'place in your history'
                              : 'places in your history'}
                          </p>
                        </div>

                        <span
                          aria-hidden="true"
                          className={[
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-base text-zinc-500 ring-1 ring-white/[0.06] transition group-hover:text-white',
                            expanded
                              ? 'rotate-180 bg-cyan-300 text-black ring-cyan-300'
                              : '',
                          ].join(
                            ' '
                          )}
                        >
                          ↓
                        </span>
                      </button>

                      {expanded ? (
                        <div className="border-t border-white/[0.055] px-3 pb-3 sm:px-4 sm:pb-4">
                          <div className="space-y-3 pt-3 sm:pt-4">
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
                                  onSubmitToCompetition={() =>
                                    submitVisitDayToCompetition(
                                      day
                                    )
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
            <p className="mt-4 rounded-xl bg-red-950/15 px-3 py-2.5 text-sm text-red-300/80 ring-1 ring-red-500/20">
              {error}
            </p>
          ) : null}
        </div>
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

      <div
        className="pointer-events-none fixed"
        aria-hidden="true"
        style={{
          left:
            '-12000px',

          top:
            0,

          width:
            1080,

          height:
            1080,

          background:
            '#020617',

          zIndex:
            -1,

          overflow:
            'hidden',
        }}
      >
        <div
          ref={
            roamSnapshotRef
          }
          style={{
            width:
              1080,

            height:
              1080,

            background:
              '#020617',
          }}
        >
          {roamSnapshotSelection ? (
            <FlowRouteSticker
              title={`${roamSnapshotSelection.city} · ${roamSnapshotSelection.label}`}
              city={
                roamSnapshotSelection.city
              }
              stops={
                roamSnapshotSelection.stops
              }
              routeLine={
                roamSnapshotRouteLine
              }
              width={
                1080
              }
              height={
                1080
              }
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

function QualifyingRoamsPanel({
  roams,
  savingRoamSourceId,
  snapshotLifecycleUpdate,
  onSaveSnapshot,
  onUpdateVisibility,
  onUpdateReplayable,
}: {
  roams: QualifyingRoamDay[]
  savingRoamSourceId: string | null
  snapshotLifecycleUpdate:
    SnapshotLifecycleUpdate | null
  onSaveSnapshot: (
    roam: QualifyingRoamDay
  ) => void
  onUpdateVisibility: (
    roam: QualifyingRoamDay,
    visibility:
      | 'public'
      | 'private'
  ) => void
  onUpdateReplayable: (
    roam: QualifyingRoamDay,
    replayable: boolean
  ) => void
}) {
  return (
    <section className="relative mt-7 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-indigo-400/[0.08] via-white/[0.025] to-transparent p-4 ring-1 ring-indigo-300/15 sm:p-5">
      <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-44 w-44 rounded-full bg-indigo-400/[0.08] blur-3xl" />

      <div className="relative z-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
            Worth remembering
          </p>

          <h3 className="mt-2 text-lg font-black tracking-tight text-white">
            Turn a day out into a Roam Snapshot
          </h3>

          <p className="mt-1.5 max-w-xl text-xs leading-5 text-zinc-500">
            Days with three or more distinct verified stops can become a shareable record of where you went.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {roams.map(
            (
              roam
            ) => {
              const city =
                roam.city ??
                roam.cityKey

              const saving =
                savingRoamSourceId ===
                roam.sourceId

              const snapshot =
                roam.snapshot

              const lifecycleBusy =
                snapshotLifecycleUpdate !==
                null

              const updatingVisibility =
                snapshotLifecycleUpdate
                  ?.sourceId ===
                  roam.sourceId &&
                snapshotLifecycleUpdate
                  .field ===
                  'visibility'

              const updatingReplayable =
                snapshotLifecycleUpdate
                  ?.sourceId ===
                  roam.sourceId &&
                snapshotLifecycleUpdate
                  .field ===
                  'replayable'

              const isPublic =
                snapshot?.visibility ===
                'public'

              const isReplayable =
                snapshot?.replayable ===
                true

              const replayEnableBlocked =
                Boolean(
                  snapshot &&
                    !isPublic &&
                    !isReplayable
                )

              return (
                <article
                  key={
                    roam.sourceId
                  }
                  className="rounded-[1.5rem] bg-black/30 p-4 ring-1 ring-white/[0.055]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-black tracking-tight text-white">
                        {city}
                        {' · '}
                        {formatRoamDayLabel(
                          roam.roamDay
                        )}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                        {
                          roam.distinctVenueCount
                        }{' '}
                        distinct stops
                      </p>

                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                        {roam.stops
                          .map(
                            (
                              stop
                            ) =>
                              stop.venue
                                .name ??
                              'Roam stop'
                          )
                          .join(
                            ' → '
                          )}
                      </p>
                    </div>

                    {roam.alreadySnapshotted &&
                    snapshot ? (
                      <div className="w-full shrink-0 space-y-3 sm:w-auto sm:min-w-[220px]">
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="rounded-full bg-emerald-400/[0.1] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300 ring-1 ring-emerald-300/15">
                            Saved
                          </span>

                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1',
                              isPublic
                                ? 'bg-cyan-300/[0.09] text-cyan-300 ring-cyan-300/15'
                                : 'bg-white/[0.035] text-zinc-500 ring-white/[0.06]',
                            ].join(
                              ' '
                            )}
                          >
                            {isPublic
                              ? 'Public'
                              : 'Private'}
                          </span>

                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1',
                              isReplayable
                                ? 'bg-indigo-400/[0.1] text-indigo-300 ring-indigo-300/15'
                                : 'bg-white/[0.035] text-zinc-600 ring-white/[0.06]',
                            ].join(
                              ' '
                            )}
                          >
                            {isReplayable
                              ? 'Replay on'
                              : 'Replay off'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={
                              lifecycleBusy ||
                              Boolean(
                                savingRoamSourceId
                              )
                            }
                            onClick={() =>
                              onUpdateVisibility(
                                roam,
                                isPublic
                                  ? 'private'
                                  : 'public'
                              )
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-full bg-cyan-300/[0.08] px-3 py-2 text-xs font-bold text-cyan-200 ring-1 ring-cyan-300/15 transition hover:bg-cyan-300/[0.13] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingVisibility
                              ? 'Updating…'
                              : isPublic
                                ? 'Make private'
                                : 'Make public'}
                          </button>

                          <button
                            type="button"
                            disabled={
                              lifecycleBusy ||
                              Boolean(
                                savingRoamSourceId
                              ) ||
                              replayEnableBlocked
                            }
                            title={
                              replayEnableBlocked
                                ? 'Make this snapshot public before allowing replay.'
                                : undefined
                            }
                            onClick={() =>
                              onUpdateReplayable(
                                roam,
                                !isReplayable
                              )
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-full bg-indigo-300/[0.08] px-3 py-2 text-xs font-bold text-indigo-200 ring-1 ring-indigo-300/15 transition hover:bg-indigo-300/[0.13] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingReplayable
                              ? 'Updating…'
                              : isReplayable
                                ? 'Disable replay'
                                : 'Allow replay'}
                          </button>
                        </div>

                        {replayEnableBlocked ? (
                          <p className="text-left text-[10px] leading-4 text-zinc-600 sm:text-right">
                            Make this Snapshot public before allowing replay.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          Boolean(
                            savingRoamSourceId
                          ) ||
                          lifecycleBusy
                        }
                        onClick={() =>
                          onSaveSnapshot(
                            roam
                          )
                        }
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-black text-black transition hover:bg-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving
                          ? 'Saving…'
                          : 'Save this memory'}
                      </button>
                    )}
                  </div>
                </article>
              )
            }
          )}
        </div>
      </div>
    </section>
  )
}

function VisitDayCard({
  city,
  day,
  stickerLoading,
  exporting,
  onCreateSticker,
  onSubmitToCompetition,
}: {
  city: string
  day: VisitDayGroup
  stickerLoading: boolean
  exporting: boolean
  onCreateSticker: () => void
  onSubmitToCompetition: () => void
}) {
  const disabled =
    stickerLoading ||
    exporting

  const verifiedCompetitionVenueIds =
    getVerifiedCompetitionVenueIds(
      day
    )

  const competitionEligible =
    verifiedCompetitionVenueIds.length >=
    3

  return (
    <section className="rounded-[1.5rem] bg-white/[0.025] p-4 ring-1 ring-white/[0.055]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">
            {day.label}
          </p>

          <p className="mt-1 text-[11px] font-medium text-zinc-600">
            {
              day.visitCount
            }{' '}
            {day.visitCount ===
            1
              ? 'place in this day'
              : 'places in this day'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto">
          {day.canCreateSticker ? (
            <button
              type="button"
              onClick={
                onCreateSticker
              }
              disabled={
                disabled
              }
              className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-cyan-300/[0.08] px-4 py-2 text-xs font-bold text-cyan-200 ring-1 ring-cyan-300/15 transition hover:bg-cyan-300/[0.13] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {stickerLoading
                ? 'Building route…'
                : 'Make route sticker'}
            </button>
          ) : (
            <p className="max-w-[180px] text-xs leading-5 text-zinc-600">
              Visit two mapped places in one day to unlock a route sticker.
            </p>
          )}

          {competitionEligible ? (
            <button
              type="button"
              onClick={
                onSubmitToCompetition
              }
              className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-indigo-300/[0.08] px-4 py-2 text-xs font-bold text-indigo-200 ring-1 ring-indigo-300/15 transition hover:bg-indigo-300/[0.13] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:w-auto"
            >
              Submit this route to a competition
            </button>
          ) : null}
        </div>
      </div>

      <ol className="relative mt-5 space-y-3">
        {day.visits.map(
          (
            visit,
            index
          ) => (
            <li
              key={
                visit.id
              }
              className="relative flex items-start gap-3 rounded-[1.25rem] bg-black/25 p-3.5 ring-1 ring-white/[0.05]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {
                        visit.venueName
                      }
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      {visit.localTime ||
                        city}
                    </p>
                  </div>

                  {visit.rating ? (
                    <p
                      className="shrink-0 text-xs tracking-[0.08em] text-amber-300"
                      aria-label={`${visit.rating} out of 5 stars`}
                    >
                      {'★'.repeat(
                        visit.rating
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {visit.geoVerified ? (
                    <span className="rounded-full bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-300/15">
                      ✓ Verified visit
                    </span>
                  ) : null}

                  {visit.checkInSource &&
                  visit.checkInSource !==
                    'unknown' ? (
                    <span className="rounded-full bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-zinc-600 ring-1 ring-white/[0.055]">
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
      className="mt-7 space-y-3"
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
            className="animate-pulse rounded-[1.75rem] bg-black/25 p-4 ring-1 ring-white/[0.055]"
          >
            <div className="h-4 w-32 rounded bg-white/[0.07]" />

            <div className="mt-2 h-3 w-20 rounded bg-white/[0.035]" />

            <div className="mt-5 space-y-3">
              <div className="h-16 rounded-[1.25rem] bg-white/[0.035]" />

              <div className="h-16 rounded-[1.25rem] bg-white/[0.035]" />
            </div>
          </div>
        )
      )}
    </div>
  )
}

function EmptyVisitHistory() {
  return (
    <div className="relative mt-7 overflow-hidden rounded-[1.75rem] bg-black/25 px-5 py-9 text-center ring-1 ring-white/[0.055]">
      <div className="pointer-events-none absolute left-1/2 top-[-5rem] h-40 w-40 -translate-x-1/2 rounded-full bg-cyan-400/[0.08] blur-3xl" />

      <div className="relative z-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-xl ring-1 ring-white/[0.07]">
          ⌖
        </div>

        <p className="mt-5 text-base font-black text-white">
          Your city history starts out there.
        </p>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Check in as you explore. Roam will quietly turn those real-world visits into a record of the neighborhoods, places, and days that became part of your story.
        </p>
      </div>
    </div>
  )
}

async function buildSnapshotRouteLine(
  stops: StickerStop[]
): Promise<RouteLinePoint[]> {
  const fallbackLine =
    stops
      .filter(
        (
          stop
        ): stop is StickerStop & {
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
      .map(
        (
          stop
        ) => ({
          lat:
            stop.lat,

          lon:
            stop.lon,
        })
      )

  if (
    fallbackLine.length <
    2
  ) {
    return fallbackLine
  }

  try {
    return await fetchRouteLine(
      stops
    )
  } catch (error) {
    console.warn(
      '[VisitHistorySection] Routed roam snapshot line unavailable; using visit coordinates:',
      error
    )

    return fallbackLine
  }
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

/**
 * Competition eligibility is based on distinct geo-verified
 * visited venues, not raw visit-row count.
 *
 * Order follows the day's visit chronology so the UI is evaluating
 * the same conceptual route the user actually completed.
 */
function getVerifiedCompetitionVenueIds(
  day: VisitDayGroup
): string[] {
  const orderedVerifiedVisits =
    [...day.visits]
      .filter(
        (
          visit
        ) =>
          visit.geoVerified &&
          Boolean(
            visit.venueId
          )
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

  const seen =
    new Set<string>()

  const venueIds:
    string[] =
    []

  for (
    const visit of
      orderedVerifiedVisits
  ) {
    if (
      seen.has(
        visit.venueId
      )
    ) {
      continue
    }

    seen.add(
      visit.venueId
    )

    venueIds.push(
      visit.venueId
    )
  }

  return venueIds
}

function formatRoamDayLabel(
  roamDay: string
): string {
  const timestamp =
    Date.parse(
      `${roamDay}T12:00:00.000Z`
    )

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return roamDay
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month:
        'short',

      day:
        'numeric',

      year:
        'numeric',
    }
  ).format(
    new Date(
      timestamp
    )
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

async function waitForDomPaint() {
  await new Promise<void>(
    (
      resolve
    ) => {
      window.requestAnimationFrame(
        () => {
          window.requestAnimationFrame(
            () => {
              resolve()
            }
          )
        }
      )
    }
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