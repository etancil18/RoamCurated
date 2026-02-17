// components/modals/HostCrawlModal.tsx
'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import type { Venue } from '@/types/venue'

export type HostCrawlModalProps = {
  show: boolean
  route: Venue[]
  onClose: () => void
}

const HostCrawlModal: React.FC<HostCrawlModalProps> = ({ show, route, onClose }) => {
  const router = useRouter()

  if (!show) {
    return null
  }

  const handleHost = () => {
    const slugList = route.map((v) => v.slug).join(',')
    router.push(`/sponsor-crawl?slugs=${encodeURIComponent(slugList)}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2200] px-4">
      <div
        className="
          w-full max-w-md
          bg-white dark:bg-zinc-900
          text-gray-900 dark:text-gray-100
          rounded-xl
          p-5
          shadow-2xl
          border border-gray-200 dark:border-zinc-700
        "
      >
        <h2 className="text-lg font-semibold mb-3">
          Host this Crawl?
        </h2>

        <p className="mb-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          You’re about to host a crawl with <span className="font-medium">{route.length}</span> stops.
          The venue list will be pre-filled on the host page.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="
              px-4 py-2 rounded-lg text-sm
              border border-gray-300 dark:border-zinc-600
              hover:bg-gray-100 dark:hover:bg-zinc-800
            "
          >
            Cancel
          </button>

          <button
            onClick={handleHost}
            className="
              px-4 py-2 rounded-lg text-sm
              bg-indigo-600 hover:bg-indigo-700
              text-white
            "
          >
            Host Crawl
          </button>
        </div>
      </div>
    </div>
  )
}

export default HostCrawlModal