'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { inBrowser, getOrigin } from '@/lib/browser'

type CrawlDetailsModalProps = {
  stops: {
    name: string
    instagram?: string | null
  }[]
  slug: string
}

export default function CrawlDetailsModal({ stops, slug }: CrawlDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  // ✅ Safe URL construction
  useEffect(() => {
    if (!inBrowser()) return
    setShareUrl(`${getOrigin()}/crawl/${slug}`)
  }, [slug])

  const handleCopy = async () => {
    if (typeof window === 'undefined') return

    try {
      if (window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(shareUrl)
        alert('Link copied!')
      }
    } catch {
      alert('Failed to copy link')
    }
  }

  return (
    <div className="z-[10000]">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md text-sm"
      >
        View Crawl Details
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-xl p-5 w-full max-w-sm shadow-xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Crawl Details</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Share Link */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Share this crawl:</p>
              <div className="flex gap-2 mt-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Venue List */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Venues in this crawl:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {stops.map((stop, i) => (
                  <li key={i}>
                    {stop.instagram ? (
                      <a
                        href={`https://instagram.com/${stop.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {stop.name}
                      </a>
                    ) : (
                      <span>{stop.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="mt-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-sm rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
