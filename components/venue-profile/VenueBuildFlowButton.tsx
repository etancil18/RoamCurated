
'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'

import RoamAuthSheet from '@/components/auth/RoamAuthSheet'
import { useUser } from '@/hooks/useUser'
import { getAppDownloadLink } from '@/lib/constants/appLinks'
import { logEvent } from '@/lib/logEvent'

type VenueBuildFlowButtonProps = {
  venueId: string
  venueName: string
  city: string | null
}

function getMapFlowHref({
  venueId,
  city,
}: {
  venueId: string
  city: string
}): string {
  const normalizedCity = city.trim().toLowerCase()

  const mapCity =
    normalizedCity === 'los angeles'
      ? 'la'
      : normalizedCity

  const params = new URLSearchParams({
    city: mapCity,
    venue: venueId,
    buildFlow: '1',
  })

  return `/?${params.toString()}`
}

function FlowArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function logVenueFlowClick({
  venueId,
  city,
  authenticated,
}: {
  venueId: string
  city: string
  authenticated: boolean
}) {
  try {
    void Promise.resolve(
      logEvent('venue_profile_build_flow_clicked', {
        venue_id: venueId,
        metadata: {
          page: 'venue_profile',
          source: 'venue_profile_action',
          city,
          authenticated,
        },
      }),
    ).catch((error) => {
      console.warn(
        '[VenueBuildFlowButton] Analytics logging failed:',
        error,
      )
    })
  } catch (error) {
    console.warn(
      '[VenueBuildFlowButton] Analytics logging failed:',
      error,
    )
  }
}

export default function VenueBuildFlowButton({
  venueId,
  venueName,
  city,
}: VenueBuildFlowButtonProps) {
  const {
    user,
    loading: authLoading,
  } = useUser()

  const [authSheetOpen, setAuthSheetOpen] =
    useState(false)

  const normalizedCity =
    typeof city === 'string'
      ? city.trim()
      : ''

  const normalizedVenueId = venueId.trim()

  const canBuildFlow =
    normalizedVenueId.length > 0 &&
    normalizedCity.length > 0

  const flowHref = canBuildFlow
    ? getMapFlowHref({
        venueId: normalizedVenueId,
        city: normalizedCity,
      })
    : null

  const handleGuestBuildFlow = useCallback(() => {
    if (!flowHref) return

    logVenueFlowClick({
      venueId: normalizedVenueId,
      city: normalizedCity,
      authenticated: false,
    })

    setAuthSheetOpen(true)
  }, [flowHref, normalizedVenueId, normalizedCity])

  const handleFlowAuthenticated = useCallback(
    async () => {
      if (!flowHref) return

      window.location.assign(flowHref)
    },
    [flowHref],
  )

  const buttonClassName = [
    'flex min-h-11 w-full items-center justify-center gap-2',
    'rounded-xl bg-gradient-to-r',
    'from-indigo-500 via-violet-500 to-cyan-500',
    'px-4 py-3 text-center text-sm font-black text-white',
    'shadow-[0_12px_30px_rgba(34,211,238,0.12)]',
    'transition hover:brightness-110',
    'focus-visible:outline focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-cyan-300',
    'disabled:cursor-wait disabled:opacity-60',
  ].join(' ')

  if (!flowHref) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className={`${buttonClassName} cursor-not-allowed opacity-50`}
        >
          Build a Flow
          <FlowArrowIcon />
        </button>

        <p className="text-xs leading-5 text-slate-400">
          Flow building is unavailable until this place
          has a supported city.
        </p>
      </div>
    )
  }

  return (
    <>
      {user ? (
        <Link
          href={flowHref}
          onClick={() => {
            logVenueFlowClick({
              venueId: normalizedVenueId,
              city: normalizedCity,
              authenticated: true,
            })
          }}
          className={buttonClassName}
        >
          Build a Flow
          <FlowArrowIcon />
        </Link>
      ) : (
        <button
          type="button"
          disabled={authLoading}
          onClick={handleGuestBuildFlow}
          className={buttonClassName}
        >
          Build a Flow
          <FlowArrowIcon />
        </button>
      )}

      <RoamAuthSheet
        open={authSheetOpen}
        onClose={() => {
          setAuthSheetOpen(false)
        }}
        onAuthenticated={handleFlowAuthenticated}
        title="Your next Flow starts here"
        description={`Sign in or create your Roam account to build a personalized Flow starting at ${venueName}.`}
        submitLabel="Continue to your Flow"
        postAuthPath={flowHref}
      >
        <div className="mt-4 border-t border-white/10 pt-4 text-center">
          <p className="mb-3 text-xs leading-5 text-neutral-400">
            Prefer to explore on your phone?
          </p>

          <button
            type="button"
            onClick={() => {
              window.open(
                getAppDownloadLink(),
                '_blank',
                'noopener,noreferrer',
              )
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.09] px-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            Get the RoamCurated App
          </button>
        </div>
      </RoamAuthSheet>
    </>
  )
}
