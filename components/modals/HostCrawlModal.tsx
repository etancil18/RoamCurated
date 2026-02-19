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
    <div
      className="
        fixed bottom-16 left-3 right-3
        max-w-md mx-auto
        bg-white dark:bg-zinc-900
        text-gray-900 dark:text-gray-100
        border border-gray-300 dark:border-zinc-700
        rounded-xl shadow-2xl
        p-4
        z-[2200]
      "
    >
      <h2 className="text-base font-semibold mb-3">
        Host this Crawl?
      </h2>

      <p className="mb-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        You’re about to host a crawl with{' '}
        <span className="font-medium">{route.length}</span> stops.
        The venue list will be pre-filled on the host page.
      </p>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="
            px-3 py-1.5 rounded-lg text-sm
            border border-gray-300 dark:border-zinc-600
            hover:bg-gray-100 dark:hover:bg-zinc-800
          "
        >
          Cancel
        </button>

        <button
          onClick={handleHost}
          className="
            px-3 py-1.5 rounded-lg text-sm
            bg-indigo-600 hover:bg-indigo-700
            text-white
          "
        >
          Host Crawl
        </button>
      </div>
    </div>
  )
}

export default HostCrawlModal