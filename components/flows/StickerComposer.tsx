'use client'

import { useEffect, useRef, useState } from 'react'

type StickerComposerProps = {
  open: boolean
  title?: string
  sticker: React.ReactNode
  exporting?: boolean
  exportLabel?: string
  onClose: () => void
  onExport: (target: HTMLElement) => Promise<void> | void
}

export default function StickerComposer({
  open,
  title = 'Sticker Preview',
  sticker,
  exporting = false,
  exportLabel = 'Export Story',
  onClose,
  onExport,
}: StickerComposerProps) {
  const exportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(0.52)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const previousOverscrollBehavior =
      document.body.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior =
        previousOverscrollBehavior
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !exporting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, exporting, onClose])

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
      console.error(
        '[StickerComposer] Failed to read background image'
      )
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
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-black/85 text-white sm:flex sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sticker-composer-title"
      onClick={() => {
        if (!exporting) {
          onClose()
        }
      }}
    >
      <div
        className="mx-auto flex min-h-[100dvh] w-full flex-col overflow-hidden bg-neutral-950 shadow-2xl sm:min-h-0 sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-3xl sm:border sm:border-neutral-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-30 shrink-0 border-b border-neutral-800 bg-neutral-950/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:relative sm:pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                id="sticker-composer-title"
                className="truncate text-sm font-semibold text-white"
              >
                {title}
              </p>

              <p className="mt-1 max-w-xl text-xs leading-5 text-neutral-400">
                Preview your centered Roam sticker, add a photo if
                you want, then export.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              aria-label="Close sticker preview"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-black/40 text-xl leading-none text-neutral-300 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
            >
              ×
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={exporting}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Choose Photo
            </button>

            <button
              type="button"
              onClick={clearBackground}
              disabled={exporting || !backgroundUrl}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Photo
            </button>

            <button
              type="button"
              onClick={resetComposer}
              disabled={exporting}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset Size
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? 'Exporting…' : exportLabel}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="hidden rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
            >
              Close
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handleBackgroundChange}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-4 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex min-w-0 justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-black p-2 sm:p-4">
              <div className="w-full max-w-[360px]">
                <div
                  ref={exportRef}
                  className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-neutral-950 via-slate-950 to-black sm:rounded-[2rem]"
                >
                  {backgroundUrl ? (
                    <img
                      src={backgroundUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.45),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.35),transparent_42%),linear-gradient(135deg,#020617,#020617,#000)]" />
                  )}

                  <div className="absolute inset-0 bg-black/10" />

                  <div
                    className="relative z-10 flex items-center justify-center"
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    {sticker}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-2xl border border-neutral-800 bg-black/40 p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="sticker-size"
                    className="text-xs font-semibold uppercase tracking-wide text-neutral-400"
                  >
                    Sticker Size
                  </label>

                  <span className="text-xs font-medium text-neutral-500">
                    {Math.round(scale * 100)}%
                  </span>
                </div>

                <input
                  id="sticker-size"
                  type="range"
                  min="0.35"
                  max="0.9"
                  step="0.05"
                  value={scale}
                  onChange={(event) =>
                    setScale(Number(event.target.value))
                  }
                  className="mt-3 w-full"
                />

                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  Default is medium-sized and centered for story
                  sharing.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-400">
                Tip: export the sticker story here, or share the
                transparent sticker directly into Instagram,
                Messages, or your camera roll.
              </div>

              <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/15 p-3 text-xs leading-5 text-cyan-200/80 sm:hidden">
                The action buttons stay pinned at the top while you
                scroll through the preview.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}