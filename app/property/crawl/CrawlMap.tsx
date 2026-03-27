'use client'

import { useMemo, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import { DateTime } from 'luxon'
import type { Venue } from '@/types/venue'

import RouteControl from '@/components/RouteControl'
import { Button } from '@/components/ui/button'

import 'leaflet/dist/leaflet.css'

type Property = {
  name: string
  lat: number
  lon: number
  city: string
}

type Props = {
  venues: Venue[]
  property: Property
  city: string
  nowISO: string
  markerRefs: any
  propertySlug?: string
}

/* ------------------------------------------------ */
/* Routing Layer                                    */
/* ------------------------------------------------ */

function RoutingLayer({
  venues,
  property,
  travelMode,
}: {
  venues: Venue[]
  property: Property
  travelMode: 'walking' | 'driving'
}) {

  const map = useMap()

  if (!map || venues.length < 1) return null

  const propertyWaypoint: Venue = {
    id: 'property',
    name: property.name,
    lat: property.lat,
    lon: property.lon,
    city: property.city,
    link: '#',
  }

  const route = [propertyWaypoint, ...venues].filter(
    (v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)
  )

  if (route.length < 2) return null

  return (
    <RouteControl
      map={map}
      route={route}
      travelMode={travelMode}
    />
  )
}

/* ------------------------------------------------ */
/* Crawl Map                                        */
/* ------------------------------------------------ */

export default function CrawlMap({
  venues,
  property,
  city,
  nowISO,
  propertySlug,
}: Props) {

  const router = useRouter()

  const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('walking')
  const [orderedVenues, setOrderedVenues] = useState<Venue[]>(venues)
  const [shareFeedback, setShareFeedback] = useState('Share Route')

  useEffect(() => {
    setOrderedVenues(venues)
  }, [venues])

  const nowForCity = useMemo(
    () => DateTime.fromISO(nowISO),
    [nowISO]
  )

  const center: [number, number] = [
    property.lat,
    property.lon
  ]

  /* ------------------------------------------------ */
  /* Leaflet icon patch (fix marker 404s)             */
  /* ------------------------------------------------ */

  useEffect(() => {

    if (typeof window === 'undefined') return

    const L = require('leaflet')

    delete (L.Icon.Default.prototype as any)._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png'
    })

  }, [])

  /* ------------------------------------------------ */
  /* Numbered marker factory                          */
  /* ------------------------------------------------ */

  function numberedIcon(index: number) {

    const L = require('leaflet')

    return L.divIcon({
      className: 'crawl-marker',
      html: `
        <div style="
          background:#22c55e;
          color:white;
          border-radius:50%;
          width:28px;
          height:28px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:600;
          font-size:13px;
          border:2px solid white;
          box-shadow:0 0 4px rgba(0,0,0,0.4);
        ">
          ${index}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    })
  }

  /* ------------------------------------------------ */
  /* Reordering helpers                               */
  /* ------------------------------------------------ */

  function moveStopUp(index: number) {
    if (index === 0) return

    setOrderedVenues((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  function moveStopDown(index: number) {
    if (index === orderedVenues.length - 1) return

    setOrderedVenues((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  /* ------------------------------------------------ */
  /* External maps                                    */
  /* ------------------------------------------------ */

  function openGoogleMaps() {
    if (orderedVenues.length === 0) return

    const destination = orderedVenues[orderedVenues.length - 1]
    const waypoints = orderedVenues
      .slice(0, -1)
      .map((v) => `${v.lat},${v.lon}`)
      .join('|')

    const url = new URL('https://www.google.com/maps/dir/')
    url.searchParams.set('api', '1')
    url.searchParams.set('origin', `${property.lat},${property.lon}`)
    url.searchParams.set('destination', `${destination.lat},${destination.lon}`)
    url.searchParams.set('travelmode', travelMode)

    if (waypoints) {
      url.searchParams.set('waypoints', waypoints)
    }

    window.open(url.toString(), '_blank')
  }

  function openAppleMaps() {
    if (orderedVenues.length === 0) return

    const destination = orderedVenues[orderedVenues.length - 1]

    const dirFlag = travelMode === 'driving' ? 'd' : 'w'
    const url =
      `https://maps.apple.com/?saddr=${property.lat},${property.lon}` +
      `&daddr=${destination.lat},${destination.lon}` +
      `&dirflg=${dirFlag}`

    window.open(url, '_blank')
  }

  async function shareRoute() {
    if (typeof window === 'undefined') return

    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${property.name} Crawl Route`,
          text: `Check out this Roam crawl route in ${city}.`,
          url,
        })
        return
      }

      await navigator.clipboard.writeText(url)
      setShareFeedback('Link Copied')
      window.setTimeout(() => {
        setShareFeedback('Share Route')
      }, 1800)
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setShareFeedback('Link Copied')
        window.setTimeout(() => {
          setShareFeedback('Share Route')
        }, 1800)
      } catch {
        setShareFeedback('Unable to Share')
        window.setTimeout(() => {
          setShareFeedback('Share Route')
        }, 1800)
      }
    }
  }

  function goBackToProperty() {
    if (propertySlug) {
      router.push(`/property/${encodeURIComponent(city)}/${encodeURIComponent(propertySlug)}`)
      return
    }

    router.back()
  }

  return (
    <div className="space-y-4">

      <div className="h-[420px] sm:h-[500px] rounded-xl overflow-hidden border border-border bg-card">

        <MapContainer
          center={center}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CartoDB"
          />

          {/* Property Marker */}

          <Marker position={center}>
            <Tooltip>{property.name}</Tooltip>
          </Marker>

          {/* Venue Markers (Numbered Stops) */}

          {orderedVenues.map((v, i) => (
            <Marker
              key={v.id}
              position={[v.lat, v.lon]}
              icon={numberedIcon(i + 1)}
            >
              <Tooltip>
                {i + 1}. {v.name}
              </Tooltip>
            </Marker>
          ))}

          {/* Routing */}

          <RoutingLayer
            venues={orderedVenues}
            property={property}
            travelMode={travelMode}
          />

        </MapContainer>

      </div>

      {/* Route controls */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant={travelMode === 'walking' ? 'default' : 'outline'}
          onClick={() => setTravelMode('walking')}
          className="w-full"
        >
          Walking Route
        </Button>

        <Button
          variant={travelMode === 'driving' ? 'default' : 'outline'}
          onClick={() => setTravelMode('driving')}
          className="w-full"
        >
          Driving Route
        </Button>
      </div>

      {/* Stop order editor */}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            Route Stops
          </p>
          <p className="text-sm text-muted-foreground">
            Adjust the order of your preset stops before you head out.
          </p>
        </div>

        <div className="space-y-2">
          {orderedVenues.map((v, i) => (
            <div
              key={`${v.id}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {i + 1}. {v.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.city}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moveStopUp(i)}
                  disabled={i === 0}
                >
                  ↑
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moveStopDown(i)}
                  disabled={i === orderedVenues.length - 1}
                >
                  ↓
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* External maps + navigation */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:grid-cols-4">
        <Button
          variant="outline"
          onClick={openGoogleMaps}
          disabled={orderedVenues.length === 0}
          className="w-full"
        >
          Open in Google Maps
        </Button>

        <Button
          variant="outline"
          onClick={openAppleMaps}
          disabled={orderedVenues.length === 0}
          className="w-full"
        >
          Open in Apple Maps
        </Button>

        <Button
          variant="outline"
          onClick={shareRoute}
          className="w-full"
        >
          {shareFeedback}
        </Button>

        <Button
          variant="secondary"
          onClick={goBackToProperty}
          className="w-full"
        >
          Back to Property Guide
        </Button>
      </div>

    </div>
  )
}