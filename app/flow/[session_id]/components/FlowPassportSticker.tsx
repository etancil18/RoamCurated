'use client'

import { useEffect } from 'react'
import { logEvent } from '@/lib/logEvent'

type FlowPassportStickerVariant = 'stamp' | 'route'

type FlowPassportStickerStop = {
  id: string
  venueId: string
  stopOrder: number
  title: string | null
  city?: string | null
  checkedInAt?: string | null
  lat?: number | null
  lon?: number | null
}

type Props = {
  title?: string | null
  city?: string | null
  completedAt?: string | null
  checkedInCount: number
  totalStops: number
  stops: FlowPassportStickerStop[]
  passportLevel?: number | string | null
  xpEarned?: number | null
  variant?: FlowPassportStickerVariant
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Completed'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Completed'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function normalizeCity(city?: string | null) {
  if (!city) return 'ROAM'

  return city.toUpperCase()
}

function getShortTitle(title?: string | null, stops: FlowPassportStickerStop[] = []) {
  if (title && title.trim().length > 0) return title.trim()

  const firstStop = stops[0]?.title
  const lastStop = stops[stops.length - 1]?.title

  if (firstStop && lastStop && firstStop !== lastStop) {
    return `${firstStop} → ${lastStop}`
  }

  return 'Roam Flow'
}

function getRouteLabel(stops: FlowPassportStickerStop[]) {
  const firstStop = stops[0]?.title
  const lastStop = stops[stops.length - 1]?.title

  if (firstStop && lastStop && firstStop !== lastStop) {
    return `${firstStop} + ${lastStop}`
  }

  return firstStop ?? 'Curated Flow'
}

export default function FlowPassportSticker({
  title = null,
  city = null,
  completedAt = null,
  checkedInCount,
  totalStops,
  stops,
  passportLevel = null,
  xpEarned = null,
  variant = 'stamp',
}: Props) {
  const safeCheckedInCount = Math.max(0, checkedInCount)
  const safeTotalStops = Math.max(totalStops, safeCheckedInCount, 0)
  const completionDate = formatDate(completedAt)
  const cityLabel = normalizeCity(city)
  const displayTitle = getShortTitle(title, stops)
  const routeLabel = getRouteLabel(stops)
  const levelLabel =
    passportLevel !== null && passportLevel !== undefined
      ? `Level ${passportLevel}`
      : 'Explorer'
  const xpLabel =
    typeof xpEarned === 'number' && Number.isFinite(xpEarned)
      ? `XP +${xpEarned}`
      : `XP +${safeCheckedInCount * 25}`

  useEffect(() => {
    safeLogEvent('flow_passport_sticker_rendered', {
      city,
      variant,
      checked_in_count: safeCheckedInCount,
      total_stops: safeTotalStops,
      stop_count: stops.length,
      has_completed_at: Boolean(completedAt),
      has_passport_level: passportLevel !== null && passportLevel !== undefined,
      xp_earned:
        typeof xpEarned === 'number' && Number.isFinite(xpEarned)
          ? xpEarned
          : safeCheckedInCount * 25,
    })
  }, [])

  if (variant === 'route') {
    return (
      <div
        className="relative inline-flex min-h-[520px] w-[520px] flex-col items-center justify-center overflow-hidden rounded-[44px] border border-white/25 bg-white/10 p-10 text-white shadow-2xl backdrop-blur-xl"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(99,102,241,0.34), transparent 38%), radial-gradient(circle at bottom right, rgba(16,185,129,0.26), transparent 40%), rgba(2,6,23,0.34)',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.16), 0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <div className="absolute inset-4 rounded-[36px] border border-white/10" />

        <div className="relative flex w-full flex-col items-center">
          <div className="mb-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.34em] text-cyan-200">
              {cityLabel}
            </p>

            <h2 className="mt-3 max-w-[420px] text-4xl font-black leading-tight tracking-tight">
              {routeLabel}
            </h2>
          </div>

          <div className="relative my-8 flex w-full max-w-[360px] items-center justify-between">
            <div className="absolute left-8 right-8 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-emerald-300 shadow-[0_0_24px_rgba(45,212,191,0.85)]" />

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-indigo-500 text-2xl font-black shadow-xl">
              1
            </div>

            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-2xl font-black shadow-xl">
              {safeCheckedInCount || safeTotalStops || 2}
            </div>
          </div>

          <div className="mt-8 w-full rounded-[32px] border border-white/15 bg-black/35 px-8 py-7 text-center backdrop-blur-md">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-white/55">
              Roam Passport
            </p>

            <p className="mt-3 text-2xl font-black">
              {safeCheckedInCount}/{safeTotalStops} Stops Completed
            </p>

            <div className="mt-5 flex items-center justify-center gap-3 text-sm font-bold text-white/80">
              <span>{completionDate}</span>
              <span className="text-white/30">•</span>
              <span>{levelLabel}</span>
              <span className="text-white/30">•</span>
              <span>{xpLabel}</span>
            </div>
          </div>

          <p className="mt-8 text-xs font-black uppercase tracking-[0.4em] text-white/45">
            ROAM
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative inline-flex min-h-[520px] w-[520px] flex-col justify-between overflow-hidden rounded-[44px] border border-amber-200/40 bg-white/10 p-10 text-white shadow-2xl backdrop-blur-xl"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(251,191,36,0.24), transparent 36%), radial-gradient(circle at bottom right, rgba(99,102,241,0.28), transparent 42%), rgba(2,6,23,0.40)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.14), 0 24px 80px rgba(0,0,0,0.45)',
      }}
    >
      <div className="absolute inset-5 rounded-[34px] border border-dashed border-amber-200/35" />

      <div className="relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-200">
              Passport Stamp
            </p>

            <h2 className="mt-4 max-w-[350px] text-4xl font-black leading-tight tracking-tight">
              {displayTitle}
            </h2>
          </div>

          <div className="rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm font-black backdrop-blur-md">
            {completionDate}
          </div>
        </div>

        <div className="mt-8 flex gap-1.5 text-3xl text-amber-300 drop-shadow">
          <span>★</span>
          <span>★</span>
          <span>★</span>
          <span>★</span>
          <span>★</span>
        </div>
      </div>

      <div className="relative space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-3xl border border-white/15 bg-black/35 p-5 backdrop-blur-md">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/45">
              Stops
            </p>
            <p className="mt-2 text-3xl font-black">
              {safeCheckedInCount}/{safeTotalStops}
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-black/35 p-5 backdrop-blur-md">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/45">
              Earned
            </p>
            <p className="mt-2 text-3xl font-black">
              {xpLabel}
            </p>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/15 bg-black/35 p-6 backdrop-blur-md">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
            {cityLabel}
          </p>

          <p className="mt-3 text-2xl font-black">
            {levelLabel}
          </p>

          <p className="mt-2 text-sm leading-6 text-white/65">
            Completed a curated Roam Flow and added this adventure to their Passport.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-black uppercase tracking-[0.4em] text-white/45">
            ROAM
          </p>

          <div className="rounded-full border border-amber-200/30 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-amber-100">
            Flow Finisher
          </div>
        </div>
      </div>
    </div>
  )
}