'use client'

import React from 'react'
import type { Venue } from '@/types/venue'

export type ReplaceStopModalProps = {
  modalData: {
    target: Venue | null
    options: Venue[]
    index: number | null
  }
  handleReplaceStop: (venue: Venue, index: number) => void
  handleRemoveStop: (index: number) => void
  setModalData: (data: { target: null; options: Venue[]; index: null }) => void
}

export default function ReplaceStopModal({
  modalData,
  handleReplaceStop,
  handleRemoveStop,
  setModalData,
}: ReplaceStopModalProps) {
  if (!modalData.target) return null

  return (
    <div className="absolute bottom-24 left-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3 w-72 z-[2100]">
      <p className="font-semibold mb-2 text-gray-800">
        Modify stop: {modalData.target.name}
      </p>
      {modalData.options.length > 0 ? (
        <>
          <p className="text-sm text-gray-600 mb-1">Replace with similar:</p>
          <ul className="space-y-1 mb-2">
            {modalData.options.map((opt, idx) => (
              <li key={idx}>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => handleReplaceStop(opt, modalData.index!)}
                >
                  {opt.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-500 mb-2 italic">
          No similar locations found nearby.
        </p>
      )}
      <button
        className="bg-red-500 text-white w-full py-1 rounded hover:bg-red-600 mb-2"
        onClick={() => handleRemoveStop(modalData.index!)}
      >
        Remove Stop
      </button>
      <button
        className="w-full py-1 rounded border border-gray-400 hover:bg-gray-50"
        onClick={() => setModalData({ target: null, options: [], index: null })}
      >
        Cancel
      </button>
    </div>
  )
}
