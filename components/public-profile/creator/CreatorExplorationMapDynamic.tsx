'use client'

import dynamic from 'next/dynamic'

import type {
  CreatorExplorationMapProps,
} from './CreatorExplorationMap'

/* =========================================================
 * Client-only Creator Exploration Map
 * ======================================================= */

/**
 * Leaflet depends on browser globals such as `window` and
 * `document`, so the Creator Exploration Map must not render
 * during server-side execution.
 *
 * This wrapper preserves the complete public component contract
 * while loading the Leaflet-dependent implementation only in
 * the browser.
 *
 * Map data loading, privacy gating, venue adaptation, viewport
 * behavior, and interaction state do not belong in this file.
 */
const DynamicCreatorExplorationMap =
  dynamic<
    CreatorExplorationMapProps
  >(
    () =>
      import(
        './CreatorExplorationMap'
      ),
    {
      ssr: false,

      loading:
        () => (
          <CreatorExplorationMapLoadingState />
        ),
    }
  )

export default function CreatorExplorationMapDynamic(
  props:
    CreatorExplorationMapProps
) {
  return (
    <DynamicCreatorExplorationMap
      {...props}
    />
  )
}

/* =========================================================
 * Loading state
 * ======================================================= */

function CreatorExplorationMapLoadingState() {
  return (
    <section
      aria-label="Loading creator exploration map"
      aria-busy="true"
      data-roam-map-context="creator-exploration-map"
      className="relative min-h-[440px] w-full min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_42%),#09090b]" />

      <div className="absolute left-4 top-4 z-10 rounded-2xl border border-white/10 bg-black/65 px-4 py-3 shadow-xl backdrop-blur-xl">
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-cyan-300/20" />

        <div className="mt-2 h-4 w-32 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="relative flex min-h-[440px] items-center justify-center px-6 text-center">
        <div>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-2xl">
            🗺️
          </span>

          <p className="mt-4 text-sm font-semibold text-white">
            Loading exploration map
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Preparing the creator&apos;s public places.
          </p>
        </div>
      </div>
    </section>
  )
}