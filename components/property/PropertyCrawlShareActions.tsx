// components/property/PropertyCrawlShareActions.tsx

"use client"

import { useMemo, useRef, useState } from "react"
import { logEvent } from "@/lib/logEvent"
import PropertyCrawlShareCard from "@/components/property/PropertyCrawlShareCard"

type RouteLinePoint = {
  lat: number
  lon: number
}

type PropertyCrawlVenue = {
  id: string
  title: string
  stopOrder: number
  venueType?: string | null
  displayType?: string | null
  lat?: number | null
  lon?: number | null
  address?: string | null
}

type Props = {
  city?: string | null
  propertyName?: string | null
  propertySlug?: string | null
  venues: PropertyCrawlVenue[]
}

type RoutePolylineApiResponse = {
  success?: boolean
  routeLine?: RouteLinePoint[]
  source?: "mapbox" | "fallback"
  error?: string
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn("logEvent failed:", eventName, error)
  }
}

export default function PropertyCrawlShareActions({
  city = null,
  propertyName = null,
  propertySlug = null,
  venues,
}: Props) {
  const exportRef = useRef<HTMLDivElement>(null)

  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [routeLine, setRouteLine] = useState<RouteLinePoint[]>([])
  const [routeLineLoading, setRouteLineLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const stopCount = venues.length

  const shareTitle = useMemo(() => {
    return propertyName
      ? `My Roam route near ${propertyName}`
      : "My Roam crawl route"
  }, [propertyName])

  const shareText = useMemo(() => {
    return city
      ? `Check out this Roam crawl route in ${city}.`
      : "Check out this Roam crawl route."
  }, [city])

  const fallbackRouteLine = useMemo<RouteLinePoint[]>(() => {
    return venues
      .map((venue) => ({
        lat: venue.lat ?? null,
        lon: venue.lon ?? null,
      }))
      .filter(
        (point): point is RouteLinePoint =>
          typeof point.lat === "number" &&
          Number.isFinite(point.lat) &&
          typeof point.lon === "number" &&
          Number.isFinite(point.lon)
      )
  }, [venues])

  const renderedRouteLine = routeLine.length >= 2 ? routeLine : fallbackRouteLine

  const snapshotStops = useMemo(() => {
    return venues.map((venue) => ({
      id: venue.id,
      title: venue.title,
      stopOrder: venue.stopOrder,
      displayType: venue.displayType ?? venue.venueType ?? "venue",
      venueType: venue.venueType ?? null,
      lat: venue.lat ?? null,
      lon: venue.lon ?? null,
      address: venue.address ?? null,
    }))
  }, [venues])

  const fetchSnapshotRouteLine = async () => {
    setRouteLineLoading(true)

    try {
      const res = await fetch("/api/property/crawl/route-polyline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          travelMode: "walking",
          stops: venues.map((venue) => ({
            id: venue.id,
            name: venue.title,
            lat: venue.lat ?? null,
            lon: venue.lon ?? null,
            city,
            link: "#",
          })),
        }),
      })

      const data = (await res.json().catch(() => null)) as
        | RoutePolylineApiResponse
        | null

      if (!res.ok || !data?.routeLine?.length) {
        throw new Error(data?.error || "Failed to build crawl route")
      }

      setRouteLine(data.routeLine)

      safeLogEvent("property_crawl_snapshot_route_loaded", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        source: data.source ?? null,
        routePointCount: data.routeLine.length,
      })
    } catch (err) {
      setRouteLine([])

      safeLogEvent("property_crawl_snapshot_route_failed", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        message: err instanceof Error ? err.message : "Unknown route error",
      })
    } finally {
      setRouteLineLoading(false)
    }
  }

  const getShareUrl = (): string => {
    if (typeof window === "undefined") return ""
    return window.location.href
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

  const ensureRouteLine = async () => {
    if (routeLine.length >= 2) return
    await fetchSnapshotRouteLine()
    await new Promise((resolve) => window.setTimeout(resolve, 150))
  }

  const downloadSnapshot = async () => {
    setExporting(true)
    setError(null)

    try {
      await ensureRouteLine()

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error("Failed to create snapshot image")
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `roam-crawl-${propertySlug ?? "route"}.png`
      link.click()
      URL.revokeObjectURL(url)

      safeLogEvent("property_crawl_snapshot_downloaded", {
        city,
        propertyName,
        propertySlug,
        stopCount,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export snapshot"

      setError(message)

      safeLogEvent("property_crawl_snapshot_download_failed", {
        city,
        propertyName,
        propertySlug,
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
      await ensureRouteLine()

      const blob = await getSnapshotBlob()

      if (!blob) {
        throw new Error("Failed to create snapshot image")
      }

      const file = new File([blob], `roam-crawl-${propertySlug ?? "route"}.png`, {
        type: "image/png",
      })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })

        safeLogEvent("property_crawl_snapshot_shared", {
          city,
          propertyName,
          propertySlug,
          stopCount,
        })

        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `roam-crawl-${propertySlug ?? "route"}.png`
      link.click()
      URL.revokeObjectURL(url)

      safeLogEvent("property_crawl_snapshot_share_download_fallback", {
        city,
        propertyName,
        propertySlug,
        stopCount,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to share snapshot"

      setError(message)

      safeLogEvent("property_crawl_snapshot_share_failed", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        message,
      })
    } finally {
      setExporting(false)
    }
  }

  const copyShareLink = async () => {
    setError(null)

    try {
      const shareUrl = getShareUrl()

      if (!shareUrl) {
        throw new Error("Share link is unavailable")
      }

      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)

      safeLogEvent("property_crawl_share_link_copied", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        shareUrl,
      })

      window.setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to copy share link"

      setError(message)

      safeLogEvent("property_crawl_share_link_copy_failed", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        message,
      })
    }
  }

  const nativeShare = async () => {
    setError(null)

    const shareUrl = getShareUrl()

    if (!shareUrl) {
      setError("Share link is unavailable")
      return
    }

    if (!navigator.share) {
      await copyShareLink()
      return
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      })

      safeLogEvent("property_crawl_native_share_clicked", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        shareUrl,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Native share cancelled or failed"

      safeLogEvent("property_crawl_native_share_failed", {
        city,
        propertyName,
        propertySlug,
        stopCount,
        message,
      })
    }
  }

  const openSnapshotPreview = () => {
    setSnapshotOpen(true)

    safeLogEvent("property_crawl_snapshot_previewed", {
      city,
      propertyName,
      propertySlug,
      stopCount,
    })

    void fetchSnapshotRouteLine()
  }

  const closeSnapshotPreview = () => {
    setSnapshotOpen(false)
  }

  return (
    <>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-300">
              Share this crawl
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              Copy the route link or export a story-style snapshot.
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
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {copied ? "Copied" : "Copy Link"}
            </button>

            <button
              type="button"
              onClick={() => void nativeShare()}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Share Route
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        ) : null}
      </section>

      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <div ref={exportRef}>
          <PropertyCrawlShareCard
            city={city}
            propertyName={propertyName}
            propertySlug={propertySlug}
            stops={snapshotStops}
            routeLine={renderedRouteLine}
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
                  {routeLineLoading ? "Loading routed line..." : "Story-style crawl card"}
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
                    <PropertyCrawlShareCard
                      city={city}
                      propertyName={propertyName}
                      propertySlug={propertySlug}
                      stops={snapshotStops}
                      routeLine={renderedRouteLine}
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