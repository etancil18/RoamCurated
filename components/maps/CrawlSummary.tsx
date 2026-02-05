'use client'

import { useEffect, useState } from 'react'
import type { Venue } from '@/types/venue'
import { inBrowser, getHref } from '@/lib/browser'

type CrawlSummaryProps = {
  route: Venue[]
  onClose: () => void
}

export default function CrawlSummary({ route, onClose }: CrawlSummaryProps) {
  const [copied, setCopied] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [copied])

  function handleSaveToLocal() {
    if (!hasMounted || route.length < 2 || !inBrowser()) return

    const existing = localStorage.getItem('savedRoutes')
    const saved = existing ? JSON.parse(existing) : []
    saved.push([...route])
    localStorage.setItem('savedRoutes', JSON.stringify(saved))
    alert('Saved to local favorites.')
  }

  function handleExportToMaps() {
    if (!hasMounted || !inBrowser()) return

    const base = 'https://www.google.com/maps/dir/'
    const waypoints = route.map((v) => `${v.lat},${v.lon}`).join('/')
    window.open(`${base}${waypoints}`, '_blank')
  }

  function handleCopyLink() {
    if (!hasMounted || !inBrowser()) return

    const ids = route.map((v) => v.id ?? v.name).join(',')
    const href = getHref()
    const url = new URL(href)
    url.searchParams.set('route', ids)

    navigator.clipboard.writeText(url.toString()).then(() => setCopied(true))
  }

  const baseTime = new Date()
  const estimateArrival = (index: number) => {
    const t = new Date(baseTime.getTime() + index * 75 * 60 * 1000)
    return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <aside className="absolute right-4 top-16 z-[2000] bg-white shadow-lg rounded-lg w-80 p-4 space-y-3 border border-gray-300">
      <h2 className="text-lg font-bold text-gray-900">Your Crawl</h2>

      <p className="text-sm text-gray-600">
        {route.length} stops — starting near{' '}
        <strong>{route[0].neighborhood || 'unknown'}</strong> at{' '}
        <strong>{estimateArrival(0)}</strong>
      </p>

      <ol className="list-decimal pl-5 space-y-2 text-sm max-h-48 overflow-y-auto">
        {route.map((stop, i) => (
          <li key={i} className="leading-tight">
            <div className="font-semibold">{stop.name}</div>
            <div className="text-xs text-gray-500">
              {estimateArrival(i)} • {stop.vibe || stop.tags} •{' '}
              {stop.neighborhood || 'Unknown'}
            </div>
            {stop.link && (
              <a
                href={stop.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                More Info
              </a>
            )}
          </li>
        ))}
      </ol>

      <div className="pt-2 border-t border-gray-200 space-y-1 text-sm">
        <button
          onClick={handleSaveToLocal}
          className="w-full bg-blue-500 text-white py-1 rounded hover:bg-blue-600 transition"
          disabled={!hasMounted}
        >
          💾 Save
        </button>
        <button
          onClick={handleExportToMaps}
          className="w-full bg-green-500 text-white py-1 rounded hover:bg-green-600 transition"
          disabled={!hasMounted}
        >
          🌍 Open in Google Maps
        </button>
        <button
          onClick={handleCopyLink}
          className="w-full bg-gray-700 text-white py-1 rounded hover:bg-gray-800 transition"
          disabled={!hasMounted}
        >
          🔗 {copied ? 'Link Copied!' : 'Copy Share Link'}
        </button>
        <button
          onClick={onClose}
          className="w-full bg-red-500 text-white py-1 rounded hover:bg-red-600 transition"
        >
          ✖ Close Summary
        </button>
      </div>
    </aside>
  )
}
