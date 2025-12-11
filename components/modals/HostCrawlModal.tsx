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
    // Build slug list
    const slugList = route.map((v) => v.slug).join(',')
    // Navigate to sponsor‑crawl page, passing slugs via query param
    router.push(`/sponsor-crawl?slugs=${encodeURIComponent(slugList)}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2200]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Host this Crawl?</h2>
        <p className="mb-6">
          You’re about to host a crawl with {route.length} stops.  
          The venue list will be pre‑filled on the host page.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleHost}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Host Crawl
          </button>
        </div>
      </div>
    </div>
  )
}

export default HostCrawlModal
