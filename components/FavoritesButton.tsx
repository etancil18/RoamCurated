'use client'

import {
  useEffect,
  useState,
} from 'react'

import {
  removeFavoriteAction,
} from '@/app/favorites/actions'
import {
  useUser,
} from '@/hooks/useUser'
import type {
  Venue,
} from '@/types/venue'

type FavoritesButtonProps = {
  venue: Venue

  /**
   * Optional styling hook for contexts that need additional layout control.
   */
  className?: string
}

type FavoriteListRow = {
  venue_id?: string | null
}

type FavoritesListResponse = {
  success?: boolean
  data?: FavoriteListRow[]
  message?: string
}

function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        value.trim().length >
          0
    )
    .join(' ')
}

export function FavoritesButton({
  venue,
  className,
}: FavoritesButtonProps) {
  const {
    user,
  } = useUser()

  const [
    isFavorite,
    setIsFavorite,
  ] = useState(false)

  const [
    isLoadingFavorite,
    setIsLoadingFavorite,
  ] = useState(false)

  const [
    isUpdatingFavorite,
    setIsUpdatingFavorite,
  ] = useState(false)

  const [
    favoriteError,
    setFavoriteError,
  ] = useState<
    string | null
  >(null)

  const isLoggedIn =
    Boolean(user)

  useEffect(
    () => {
      let cancelled =
        false

      async function loadFavoriteState() {
        if (
          !user ||
          !venue?.id
        ) {
          setIsFavorite(
            false
          )

          setIsLoadingFavorite(
            false
          )

          setFavoriteError(
            null
          )

          return
        }

        setIsLoadingFavorite(
          true
        )

        setFavoriteError(
          null
        )

        try {
          const response =
            await fetch(
              '/api/favorites/list',
              {
                method:
                  'GET',
                cache:
                  'no-store',
              }
            )

          const result =
            (await response.json()) as FavoritesListResponse

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.message ||
                'Failed to load favorites'
            )
          }

          if (
            cancelled
          ) {
            return
          }

          const favorites =
            Array.isArray(
              result.data
            )
              ? result.data
              : []

          setIsFavorite(
            favorites.some(
              (favorite) =>
                favorite.venue_id ===
                venue.id
            )
          )
        } catch (
          error: unknown
        ) {
          if (
            cancelled
          ) {
            return
          }

          console.error(
            '❌ Failed to load favorite state:',
            error
          )

          setIsFavorite(
            false
          )

          setFavoriteError(
            error instanceof
              Error
              ? error.message
              : 'Could not load favorite status.'
          )
        } finally {
          if (
            !cancelled
          ) {
            setIsLoadingFavorite(
              false
            )
          }
        }
      }

      void loadFavoriteState()

      return () => {
        cancelled = true
      }
    },
    [
      user,
      venue.id,
    ]
  )

  async function handleAddToFavorites() {
    if (
      !user
    ) {
      setFavoriteError(
        'Please log in to add favorites.'
      )

      return
    }

    if (
      !venue?.id ||
      !venue?.slug
    ) {
      console.warn(
        '⚠️ Venue data missing:',
        venue
      )

      setFavoriteError(
        'Venue data is incomplete.'
      )

      return
    }

    const previousFavoriteState =
      isFavorite

    setIsUpdatingFavorite(
      true
    )

    setFavoriteError(
      null
    )

    setIsFavorite(
      true
    )

    try {
      /**
       * Build the exact payload expected by
       * /api/favorites/add.
       */
      const payload = {
        slug:
          venue.slug,

        venue_id:
          venue.id,

        data: {
          name:
            venue.name,

          lat:
            Number(
              venue.lat
            ),

          lon:
            Number(
              venue.lon
            ),

          instagram_handle:
            typeof venue.instagram_handle ===
            'string'
              ? venue.instagram_handle
              : undefined,

          type:
            Array.isArray(
              venue.type
            )
              ? venue.type.join(
                  ', '
                )
              : venue.type ??
                undefined,

          image_url:
            typeof venue.cover ===
            'string'
              ? venue.cover
              : undefined,

          vibe_tags:
            typeof venue.vibe ===
            'string'
              ? venue.vibe
                  .split(
                    ','
                  )
                  .map(
                    (
                      value
                    ) =>
                      value.trim()
                  )
                  .filter(
                    Boolean
                  )
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
                  ) ||
                  undefined
                : undefined,

          city:
            venue.city ??
            undefined,
        },
      }

      const response =
        await fetch(
          '/api/favorites/add',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        )

      const result =
        await response
          .json()
          .catch(
            () =>
              null
          )

      if (
        !response.ok
      ) {
        const message =
          result &&
          typeof result.message ===
            'string'
            ? result.message
            : 'Could not add this venue to favorites.'

        throw new Error(
          message
        )
      }
    } catch (
      error: unknown
    ) {
      console.error(
        '❌ Failed to add favorite:',
        error
      )

      setIsFavorite(
        previousFavoriteState
      )

      setFavoriteError(
        error instanceof
          Error
          ? error.message
          : 'Could not add this venue to favorites.'
      )
    } finally {
      setIsUpdatingFavorite(
        false
      )
    }
  }

  async function handleRemoveFromFavorites() {
    if (
      !user
    ) {
      setFavoriteError(
        'Please log in to manage favorites.'
      )

      return
    }

    if (
      !venue?.id
    ) {
      setFavoriteError(
        'Venue data is incomplete.'
      )

      return
    }

    const previousFavoriteState =
      isFavorite

    setIsUpdatingFavorite(
      true
    )

    setFavoriteError(
      null
    )

    setIsFavorite(
      false
    )

    try {
      await removeFavoriteAction(
        venue.id
      )
    } catch (
      error: unknown
    ) {
      console.error(
        '❌ Failed to remove favorite:',
        error
      )

      setIsFavorite(
        previousFavoriteState
      )

      setFavoriteError(
        error instanceof
          Error
          ? error.message
          : 'Could not remove this venue from favorites.'
      )
    } finally {
      setIsUpdatingFavorite(
        false
      )
    }
  }

  const isBusy =
    isLoadingFavorite ||
    isUpdatingFavorite

  const buttonLabel =
    isLoadingFavorite
      ? 'Checking…'
      : isUpdatingFavorite
        ? isFavorite
          ? 'Saving…'
          : 'Removing…'
        : isFavorite
          ? 'Saved ✓'
          : isLoggedIn
            ? 'Add to favorites'
            : 'Log in to favorite'

  return (
    <div
      className={joinClassNames(
        'w-full',
        className
      )}
    >
      <button
        type="button"
        onClick={
          isFavorite
            ? () => {
                void handleRemoveFromFavorites()
              }
            : () => {
                void handleAddToFavorites()
              }
        }
        disabled={
          !isLoggedIn ||
          isBusy
        }
        aria-busy={
          isBusy
        }
        aria-pressed={
          isFavorite
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
            px-3
            py-2
            text-center
            text-xs
            font-bold
            transition
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-cyan-300
            disabled:cursor-not-allowed
            disabled:opacity-50
          `,
          isFavorite
            ? `
                border-cyan-300/30
                bg-cyan-300/10
                text-cyan-100
                hover:border-cyan-300/40
                hover:bg-cyan-300/15
              `
            : `
                border-white/10
                bg-white/[0.055]
                text-zinc-100
                hover:bg-white/10
              `
        )}
      >
        {
          buttonLabel
        }
      </button>

      {favoriteError && (
        <p
          role="alert"
          aria-live="polite"
          className="
            mt-1.5
            text-center
            text-[11px]
            font-medium
            leading-4
            text-rose-300
          "
        >
          {
            favoriteError
          }
        </p>
      )}
    </div>
  )
}