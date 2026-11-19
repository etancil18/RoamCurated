
'use client'

import { useState } from 'react'

import {
  ArrowUpRight,
  Headphones,
  Play,
} from 'lucide-react'

type EditionSoundtrackCardProps = {
  title: string
  description: string | null
  spotifyPlaylistId: string
}

// ============================================================
// ROAM EDITIONS — UNDERSTATED SOUNDTRACK MODULE
//
// - No visible generic soundtrack title or description
// - Music is secondary to the editorial reader
// - Playlist pairing remains database-managed
// - Official Spotify embed loaded only when requested
// - No autoplay
// - External Spotify link always available
// - Iframe remains mounted during Edition slide navigation
// ============================================================

export default function EditionSoundtrackCard({
  title,
  spotifyPlaylistId,
}: EditionSoundtrackCardProps) {
  const [isPlayerOpen, setIsPlayerOpen] =
    useState(false)

  if (!/^[A-Za-z0-9]{22}$/.test(spotifyPlaylistId)) {
    return null
  }

  const spotifyUrl =
    `https://open.spotify.com/playlist/${spotifyPlaylistId}`

  const embedUrl =
    `https://open.spotify.com/embed/playlist/${spotifyPlaylistId}`

  return (
    <section
      aria-label="Listen to this Edition on Spotify"
      className="min-w-0"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Headphones
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[#d2ab86]"
            strokeWidth={1.7}
          />

          <span className="text-[11px] font-semibold uppercase tracking-[0.17em] text-neutral-400">
            Soundtrack
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {!isPlayerOpen && (
            <button
              type="button"
              onClick={() => setIsPlayerOpen(true)}
              aria-controls="roam-edition-spotify-player"
              aria-expanded={false}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#d2ab86] transition hover:text-[#f1d0af] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
            >
              <Play
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />

              Listen
            </button>
          )}

          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open this Edition's playlist in Spotify (opens in a new tab)"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-100 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d2ab86]"
          >
            Spotify

            <ArrowUpRight
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </a>
        </div>
      </div>

      {isPlayerOpen && (
        <div
          id="roam-edition-spotify-player"
          className="mt-4 min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-black"
        >
          <iframe
            title={`Spotify playlist: ${title}`}
            src={embedUrl}
            width="100%"
            height="152"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="block w-full border-0"
          />
        </div>
      )}
    </section>
  )
}
