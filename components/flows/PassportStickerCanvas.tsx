'use client'

import { ReactNode } from 'react'

type PassportStickerCanvasProps = {
  sticker: ReactNode
  backgroundUrl?: string | null
  scale?: number
  x?: number
  y?: number
  width?: number
  height?: number
  className?: string
}

export default function PassportStickerCanvas({
  sticker,
  backgroundUrl = null,
  scale = 0.7,
  x = 50,
  y = 50,
  width = 360,
  height = 640,
  className = '',
}: PassportStickerCanvasProps) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-neutral-950 via-slate-950 to-black',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width,
        height,
      }}
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
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {sticker}
      </div>
    </div>
  )
}