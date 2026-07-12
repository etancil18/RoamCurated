'use client'

import { useState } from 'react'

import { useUser } from '@/hooks/useUser'
import type { Venue } from '@/types/venue'

type FavoritesButtonProps = {
  venue: Venue

  /**
   * Optional styling hook for contexts that need additional layout control.
   */
  className?: string
}

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0
    )
    .join(' ')
}

export function FavoritesButton({
  venue,
  className,
}: FavoritesButtonProps) {
  const { user } = useUser()

  const [
    isFavoriting,
    setIsFavoriting,
  ] = useState(false)

  async function handleAddToFavorites() {
    if (!user) {
      alert('Please log in to add favorites.')
      return
    }

    if (!venue?.id || !venue?.slug) {
      console.warn(
        '⚠️ Venue data missing:',
        venue
      )

      alert('Venue data is incomplete.')
      return
    }

    setIsFavoriting(true)

    try {
      // Build payload expected by /api/favorites/add.
      // This must continue to match the server-side Zod schema.
      const payload = {
        slug: venue.slug,
        venue_id: venue.id,
        data: {
          name: venue.name,
          lat: Number(venue.lat),
          lon: Number(venue.lon),
          instagram_handle:
            typeof venue.instagram_handle ===
            'string'
              ? venue.instagram_handle
              : undefined,
          type: Array.isArray(venue.type)
            ? venue.type.join(', ')
            : venue.type ?? undefined,
          image_url:
            typeof venue.cover ===
            'string'
              ? venue.cover
              : undefined,
          vibe_tags:
            typeof venue.vibe ===
            'string'
              ? venue.vibe
                  .split(',')
                  .map((value) =>
                    value.trim()
                  )
                  .filter(Boolean)
              : undefined,
          price_tier:
            typeof venue.price ===
            'number'
              ? venue.price
              : typeof venue.price ===
                  'string'
                ? parseInt(
                    venue.price.replace(
                      /\$/g,
                      ''
                    ),
                    10
                  ) || undefined
                : undefined,
          city:
            venue.city ??
            undefined,
        },
      }

      console.log(
        '📦 Sending favorite payload:',
        payload
      )

      const response = await fetch(
        '/api/favorites/add',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(payload),
        }
      )

      const text =
        await response.text()

      console.log(
        '📨 Server response:',
        text
      )

      if (!response.ok) {
        throw new Error(
          text ||
            'Unknown server error'
        )
      }

      alert(
        `⭐ Added "${venue.name}" to favorites!`
      )
    } catch (error: unknown) {
      console.error(
        '❌ Failed to add favorite:',
        error
      )

      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error'

      alert(
        `❌ Could not add to favorites: ${message}`
      )
    } finally {
      setIsFavoriting(false)
    }
  }

  const isLoggedIn =
    Boolean(user)

  return (
    <button
      type="button"
      onClick={
        handleAddToFavorites
      }
      disabled={
        !isLoggedIn ||
        isFavoriting
      }
      aria-busy={
        isFavoriting
      }
      className={joinClassNames(
        `
          flex
          min-h-11
          w-full
          items-center
          justify-center
          rounded-2xl
          border
          border-white/10
          bg-white/[0.055]
          px-3
          py-2
          text-center
          text-xs
          font-bold
          text-zinc-100
          transition
          hover:bg-white/10
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-cyan-300
          disabled:cursor-not-allowed
          disabled:opacity-50
        `,
        className
      )}
    >
      {isFavoriting
        ? 'Adding…'
        : isLoggedIn
          ? 'Add to favorites'
          : 'Log in to favorite'}
    </button>
  )
}