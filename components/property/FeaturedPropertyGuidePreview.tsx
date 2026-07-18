'use client'

import Image from 'next/image'
import { logEvent } from '@/lib/logEvent'

type FeaturedPropertyGuidePreviewProps = {
  title?: string
  city?: string
  description?: string
  guideUrl?: string
  imageSrc?: string
  className?: string
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function FeaturedPropertyGuidePreview({
  title = 'Colony Square',
  city = 'Atlanta',
  description = 'A real Roam property guide with a neighborhood map, suggested routes, nearby stops, and guest-ready exploration.',
  guideUrl = '/open/property/atl/colony-square',
  imageSrc = '/images/host-guide-preview-colony-square.png',
  className = '',
}: FeaturedPropertyGuidePreviewProps) {
  return (
    <div
      className={[
        'overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="border-b border-white/10 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-300">
          Live Guest Experience
        </p>

        <h2 className="mt-3 text-2xl font-black text-white">
          See what guests will open
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {description}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 truncate text-[10px] text-slate-400">
              roam guide / {city.toLowerCase()}
            </span>
          </div>

          <div className="relative aspect-[16/10] bg-slate-900">
            <Image
              src={imageSrc}
              alt={`${title} Roam property guide preview`}
              fill
              sizes="(max-width: 768px) 100vw, 520px"
              className="object-cover object-top"
              priority={false}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
          <p className="text-lg font-black text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{city}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <PreviewPill>Neighborhood map</PreviewPill>
            <PreviewPill>Suggested routes</PreviewPill>
            <PreviewPill>Nearby stops</PreviewPill>
            <PreviewPill>QR access</PreviewPill>
          </div>

          <button
            type="button"
            onClick={() => {
              safeLogEvent('host_live_guide_preview_opened', {
                guide_url: guideUrl,
                title,
                city,
              })

              window.open(guideUrl, '_blank', 'noopener,noreferrer')
            }}
            className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-slate-200"
          >
            Open Live Example
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-center font-semibold text-slate-200">
      {children}
    </div>
  )
}