// components/outings/OutingShareActions.tsx

"use client"

import { useMemo, useRef, useState } from "react"
import { logEvent } from "@/lib/logEvent"
import OutingShareCard from "@/components/outings/OutingShareCard"

type RouteLinePoint = {
  lat: number
  lon: number
}

type OutingShareStop = {
  id: string
  venueId?: string | null
  stopOrder: number
  role: string
  title: string | null
  displayType?: string | null
  venueType?: string | null
  plannedArrivalAt?: string | null
  plannedDepartureAt?: string | null
  lat?: number | null
  lon?: number | null
}

type OutingShareAnchorVenue = {
  id?: string | null
  name?: string | null
  title?: string | null
  lat?: number | null
  lon?: number | null
  city?: string | null
}

type Props = {
  plannedOutingId: string
  eventId: string
  city?: string | null
  mode: "before" | "after" | "full"
  summary?: string | null
  anchorTitle?: string | null
  anchorVenue?: OutingShareAnchorVenue | null
  eventStartsAt?: string | null
  stops: OutingShareStop[]
}

type ShareApiResponse = {
  success?: boolean
  plannedOutingId?: string
  sharePath?: string
  shareUrl?: string
  error?: string
}

type RoutePolylineApiResponse = {
  success?: boolean
  routeLine?: RouteLinePoint[]
  source?: "mapbox" | "fallback"
  error?: string
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn("logEvent failed:", eventName, error)
  }
}

export default function OutingShareActions({
  plannedOutingId,
  eventId,
  city = null,
  mode,
  summary = null,
  anchorTitle = null,
  anchorVenue = null,
  eventStartsAt = null,
  stops,
}: Props) {
  const exportRef = useRef<HTMLDivElement>(null)

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [routeLine, setRouteLine] = useState<RouteLinePoint[]>([])
  const [routeLineLoading, setRouteLineLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const stopCount = stops.length

  const shareTitle = useMemo(() => {
    return anchorTitle
      ? `My Roam plan for ${anchorTitle}`
      : "My Roam itinerary"
  }, [anchorTitle])

  const shareText = useMemo(() => {
    return summary || `Check out this ${humanizeMode(mode)} Roam itinerary.`
  }, [mode, summary])

  const fetchSnapshotRouteLine = async () => {
    setRouteLineLoading(true)

    try {
      const res = await fetch(`/api/outings/${plannedOutingId}/route-polyline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          travelMode: "walking",
          anchorVenue: anchorVenue
            ? {
                id: anchorVenue.id ?? "anchor-event",
                name: anchorVenue.name ?? anchorVenue.title ?? anchorTitle ?? "Event",
                lat: anchorVenue.lat ?? null,
                lon: anchorVenue.lon ?? null,
                city,
                link: "#",
              }
            : null,
          stops: stops.map((stop) => ({
            id: stop.id,
            name: stop.title ?? `Stop ${stop.stopOrder}`,
            lat: stop.lat ?? null,
            lon: stop.lon ?? null,
            city,
            link: "#",
          })),
        }),
      })

      const data = (await res.json().catch(() => null)) as
        | RoutePolylineApiResponse
        | null

      if (!res.ok || !data?.routeLine?.length) {
        throw new Error(data?.error || "Failed to build snapshot route")
      }

      setRouteLine(data.routeLine)

      safeLogEvent("outing_snapshot_route_loaded", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        source: data.source ?? null,
        routePointCount: data.routeLine.length,
      })
    } catch (err) {
      setRouteLine([])

      safeLogEvent("outing_snapshot_route_failed", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        message: err instanceof Error ? err.message : "Unknown route error",
      })
    } finally {
      setRouteLineLoading(false)
    }
  }

  const getSnapshotBlob = async (): Promise<Blob | null> => {
    if (!exportRef.current) return null

    const { toBlob } = await import("html-to-image")

    return await toBlob(exportRef.current, {
      width: 1080,
      height: 1920,
      pixelRatio: 2,
      backgroundColor: "#020617",
      cacheBust: true,
    })
  }

  const downloadSnapshot = async () => {
    setExporting(true)
    setError(null)

    try {
      if (routeLine.length === 0) {
        await fetchSnapshotRouteLine()
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150))

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error("Failed to create snapshot image")
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `roam-itinerary-${plannedOutingId}.png`
      link.click()
      URL.revokeObjectURL(url)

      safeLogEvent("outing_snapshot_downloaded", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export snapshot"

      setError(message)

      safeLogEvent("outing_snapshot_download_failed", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  const shareSnapshotImage = async () => {
    setExporting(true)
    setError(null)

    try {
      if (routeLine.length === 0) {
        await fetchSnapshotRouteLine()
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150))

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error("Failed to create snapshot image")
      }

      const file = new File([blob], `roam-itinerary-${plannedOutingId}.png`, {
        type: "image/png",
      })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })

        safeLogEvent("outing_snapshot_shared", {
          plannedOutingId,
          eventId,
          city,
          mode,
          stopCount,
        })

        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `roam-itinerary-${plannedOutingId}.png`
      link.click()
      URL.revokeObjectURL(url)

      safeLogEvent("outing_snapshot_share_download_fallback", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to share snapshot"

      setError(message)

      safeLogEvent("outing_snapshot_share_failed", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  const openSnapshotPreview = () => {
    setSnapshotOpen(true)

    safeLogEvent("outing_snapshot_previewed", {
      plannedOutingId,
      eventId,
      city,
      mode,
      stopCount,
    })

    void fetchSnapshotRouteLine()
  }

  const closeSnapshotPreview = () => {
    setSnapshotOpen(false)
  }

  const enableSharing = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl

    setLoading(true)
    setError(null)

    safeLogEvent("outing_share_enable_clicked", {
      plannedOutingId,
      eventId,
      city,
      mode,
      stopCount,
    })

    try {
      const res = await fetch(`/api/outings/${plannedOutingId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = (await res.json().catch(() => null)) as ShareApiResponse | null

      if (!res.ok || !data?.shareUrl) {
        throw new Error(data?.error || "Failed to enable sharing")
      }

      setShareUrl(data.shareUrl)

      safeLogEvent("outing_share_enabled", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        shareUrl: data.shareUrl,
      })

      return data.shareUrl
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to enable sharing"

      setError(message)

      safeLogEvent("outing_share_enable_failed", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        message,
      })

      return null
    } finally {
      setLoading(false)
    }
  }

  const copyShareLink = async () => {
    const url = await enableSharing()
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)

      safeLogEvent("outing_share_link_copied", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
      })

      window.setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to copy share link"

      setError(message)

      safeLogEvent("outing_share_link_copy_failed", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        message,
      })
    }
  }

  const nativeShare = async () => {
    const url = await enableSharing()
    if (!url) return

    if (!navigator.share) {
      await copyShareLink()
      return
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url,
      })

      safeLogEvent("outing_native_share_clicked", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Native share cancelled or failed"

      safeLogEvent("outing_native_share_failed", {
        plannedOutingId,
        eventId,
        city,
        mode,
        stopCount,
        message,
      })
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-300">
              Share this itinerary
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              Create a public Roam link or preview a story-style snapshot.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openSnapshotPreview}
              className="rounded-lg border border-cyan-800 bg-cyan-950/50 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-900/60"
            >
              Open Snapshot Preview
            </button>

            <button
              type="button"
              onClick={() => void shareSnapshotImage()}
              disabled={exporting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? "Preparing..." : "Share Snapshot"}
            </button>

            <button
              type="button"
              onClick={() => void downloadSnapshot()}
              disabled={exporting}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save Snapshot
            </button>

            <button
              type="button"
              onClick={() => void copyShareLink()}
              disabled={loading}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Preparing..." : copied ? "Copied" : "Copy Link"}
            </button>

            <button
              type="button"
              onClick={() => void nativeShare()}
              disabled={loading}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Share Plan
            </button>
          </div>
        </div>

        {shareUrl ? (
          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Public share link
            </p>
            <p className="mt-1 break-all text-sm text-neutral-300">{shareUrl}</p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        ) : null}
      </section>

      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <div ref={exportRef}>
          <OutingShareCard
            city={city}
            mode={mode}
            summary={summary}
            anchorTitle={anchorTitle}
            eventStartsAt={eventStartsAt}
            stops={stops}
            anchorVenue={anchorVenue}
            routeLine={routeLine}
            variant="export"
          />
        </div>
      </div>

      {snapshotOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeSnapshotPreview}
        >
          <div
            className="relative z-[10000] max-h-[92vh] w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Snapshot Preview
                </p>
                <p className="text-xs text-neutral-400">
                  {routeLineLoading
                    ? "Loading routed line..."
                    : "Story-style itinerary card"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSnapshotPreview}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                Close
              </button>
            </div>

            <div className="flex items-center justify-center bg-neutral-950 p-4">
              <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-neutral-800 bg-black">
                <div
                  className="relative mx-auto"
                  style={{
                    width: 320,
                    height: 568,
                  }}
                >
                  <div
                    className="absolute left-1/2 top-0"
                    style={{
                      width: 1080,
                      transform: "translateX(-50%) scale(0.2963)",
                      transformOrigin: "top center",
                    }}
                  >
                    <OutingShareCard
                      city={city}
                      mode={mode}
                      summary={summary}
                      anchorTitle={anchorTitle}
                      eventStartsAt={eventStartsAt}
                      stops={stops}
                      anchorVenue={anchorVenue}
                      routeLine={routeLine}
                      variant="preview"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function humanizeMode(mode: Props["mode"]): string {
  if (mode === "before") return "before-event"
  if (mode === "after") return "post-event"
  return "full-night"
}