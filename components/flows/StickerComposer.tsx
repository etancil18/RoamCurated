'use client'

import { useRef, useState } from 'react'

type StickerComposerProps = {
  open: boolean
  title?: string
  sticker: React.ReactNode
  exporting?: boolean
  onClose: () => void
  onExport: (target: HTMLElement) => Promise<void> | void
}

export default function StickerComposer({
  open,
  title = 'Sticker Preview',
  sticker,
  exporting = false,
  onClose,
  onExport,
}: StickerComposerProps) {
  const exportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(0.52)

  if (!open) return null

  const handleBackgroundChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBackgroundUrl(reader.result)
      }
    }

    reader.onerror = () => {
      console.error('[StickerComposer] Failed to read background image')
    }

    reader.readAsDataURL(file)
  }

  const handleExport = async () => {
    if (!exportRef.current || exporting) return
    await onExport(exportRef.current)
  }

  const resetComposer = () => {
    setScale(0.52)
  }

  const clearBackground = () => {
    setBackgroundUrl(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 text-white"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-neutral-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-neutral-400">
              Preview your centered Roam sticker, add a photo if you want, then export.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900">
              Choose Photo
            </button>
            <button type="button" onClick={clearBackground} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900">
              Clear Photo
            </button>
            <button type="button" onClick={resetComposer} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900">
              Reset Size
            </button>
            <button type="button" onClick={handleExport} disabled={exporting} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {exporting ? 'Exporting…' : 'Export Story'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900">
              Close
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleBackgroundChange} />

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex justify-center overflow-auto rounded-2xl border border-neutral-800 bg-black p-4">
            <div ref={exportRef} className="relative flex h-[640px] w-[360px] items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-neutral-950 via-slate-950 to-black">
              {backgroundUrl ? (
                <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.45),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.35),transparent_42%),linear-gradient(135deg,#020617,#020617,#000)]" />
              )}

              <div className="absolute inset-0 bg-black/10" />

              <div className="relative z-10 flex items-center justify-center" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
                {sticker}
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Sticker Size
              </label>
              <input type="range" min="0.35" max="0.9" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} className="mt-3 w-full" />
              <p className="mt-2 text-xs text-neutral-500">
                Default is medium-sized and centered for story sharing.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-400">
              Tip: export the sticker story here, or share the transparent sticker directly into Instagram, Messages, or your camera roll.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}