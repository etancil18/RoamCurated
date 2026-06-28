'use client'

import { useRouter } from 'next/navigation'

export default function BackToRouteButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back to map"
      className="
        inline-flex items-center gap-2
        rounded-xl
        border border-zinc-700
        bg-zinc-900/95
        px-4 py-2.5
        text-sm font-medium text-white
        shadow-lg backdrop-blur-md
        transition-all duration-200
        hover:border-zinc-500
        hover:bg-zinc-800
        active:scale-[0.98]
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9.707 3.293a1 1 0 010 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 01-1.414 1.414l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>

      <span>Back to Map</span>
    </button>
  )
}