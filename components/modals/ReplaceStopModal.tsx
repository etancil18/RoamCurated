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
    <div
      className="
        fixed bottom-16 left-3 right-3
        max-w-md mx-auto
        bg-white dark:bg-zinc-900
        text-gray-900 dark:text-gray-100
        border border-gray-300 dark:border-zinc-700
        rounded-xl
        shadow-2xl
        p-3
        z-[2100]
      "
    >
      <p className="font-semibold mb-2 text-sm">
        Modify stop: {modalData.target.name}
      </p>

      {modalData.options.length > 0 ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Replace with similar:
          </p>

          <ul className="space-y-1 mb-3">
            {modalData.options.map((opt, idx) => (
              <li key={idx}>
                <button
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  onClick={() => handleReplaceStop(opt, modalData.index!)}
                >
                  {opt.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 italic">
          No similar locations found nearby.
        </p>
      )}

      <button
        className="
          bg-red-500 hover:bg-red-600
          text-white
          w-full py-1.5 rounded-lg
          mb-2 text-sm
        "
        onClick={() => handleRemoveStop(modalData.index!)}
      >
        Remove Stop
      </button>

      <button
        className="
          w-full py-1.5 rounded-lg text-sm
          border border-gray-400 dark:border-zinc-600
          hover:bg-gray-100 dark:hover:bg-zinc-800
        "
        onClick={() => setModalData({ target: null, options: [], index: null })}
      >
        Cancel
      </button>
    </div>
  )
}