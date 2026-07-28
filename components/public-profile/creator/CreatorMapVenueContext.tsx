'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type {
  Venue,
} from '@/types/venue'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CreatorMapVenueSelectionSource =
  | 'marker'
  | 'list'
  | 'cluster'
  | 'preview'
  | 'programmatic'

export type CreatorMapVenueSelection = {
  venueId: string
  source:
    CreatorMapVenueSelectionSource
}

export type CreatorMapVenueContextValue = {
  /**
   * Currently selected public-map venue.
   */
  selectedVenue:
    Venue | null

  /**
   * Stable identifier for the selected venue.
   */
  selectedVenueId:
    string | null

  /**
   * Source of the current selection.
   */
  selectionSource:
    CreatorMapVenueSelectionSource | null

  /**
   * Selects a venue by object.
   *
   * Invalid venues are ignored rather than introducing an
   * unusable selection into shared state.
   */
  selectVenue: (
    venue: Venue,
    source?:
      CreatorMapVenueSelectionSource
  ) => void

  /**
   * Selects a venue by ID from the provider's current venue set.
   *
   * Unknown IDs fail closed by clearing the selection.
   */
  selectVenueById: (
    venueId: string,
    source?:
      CreatorMapVenueSelectionSource
  ) => void

  /**
   * Clears the current venue selection and closes any preview
   * surface driven by this context.
   */
  clearSelection: () => void

  /**
   * Convenience helper for marker and list rendering.
   */
  isVenueSelected: (
    venueOrId:
      | Venue
      | string
      | null
      | undefined
  ) => boolean
}

export type CreatorMapVenueProviderProps = {
  children: ReactNode

  /**
   * Public-safe venues available on the Creator Exploration Map.
   */
  venues:
    readonly Venue[]

  /**
   * Optional initial venue selection.
   *
   * The identifier is accepted only when it exists in `venues`.
   */
  initialSelectedVenueId?:
    string | null

  /**
   * Optional synchronization callback for analytics, URL state,
   * or parent-owned presentation.
   *
   * This context deliberately does not perform analytics itself.
   */
  onSelectionChange?: (
    selection:
      CreatorMapVenueSelection | null,
    venue:
      Venue | null
  ) => void

  /**
   * Allows Escape to close the active venue preview.
   *
   * Defaults to true.
   */
  closeOnEscape?:
    boolean
}

/* =========================================================
 * Context
 * ======================================================= */

const CreatorMapVenueContext =
  createContext<
    CreatorMapVenueContextValue | null
  >(
    null
  )

/* =========================================================
 * Provider
 * ======================================================= */

export function CreatorMapVenueProvider({
  children,
  venues,
  initialSelectedVenueId =
    null,
  onSelectionChange,
  closeOnEscape =
    true,
}: CreatorMapVenueProviderProps) {
  const venueById =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Venue
          >()

        for (
          const venue of
          venues
        ) {
          const venueId =
            getVenueId(
              venue
            )

          if (
            !venueId ||
            map.has(
              venueId
            )
          ) {
            continue
          }

          map.set(
            venueId,
            venue
          )
        }

        return map
      },
      [
        venues,
      ]
    )

  const normalizedInitialVenueId =
    useMemo(
      () =>
        normalizeIdentifier(
          initialSelectedVenueId
        ),
      [
        initialSelectedVenueId,
      ]
    )

  const [
    selectedVenueId,
    setSelectedVenueId,
  ] =
    useState<
      string | null
    >(
      () =>
        normalizedInitialVenueId &&
        venueById.has(
          normalizedInitialVenueId
        )
          ? normalizedInitialVenueId
          : null
    )

  const [
    selectionSource,
    setSelectionSource,
  ] =
    useState<
      CreatorMapVenueSelectionSource | null
    >(
      normalizedInitialVenueId &&
      venueById.has(
        normalizedInitialVenueId
      )
        ? 'programmatic'
        : null
    )

  const selectedVenue =
    useMemo(
      () =>
        selectedVenueId
          ? venueById.get(
              selectedVenueId
            ) ??
            null
          : null,
      [
        selectedVenueId,
        venueById,
      ]
    )

  const notifySelectionChange =
    useCallback(
      ({
        venueId,
        source,
      }: {
        venueId:
          string | null
        source:
          CreatorMapVenueSelectionSource | null
      }) => {
        if (
          !onSelectionChange
        ) {
          return
        }

        if (
          !venueId ||
          !source
        ) {
          onSelectionChange(
            null,
            null
          )

          return
        }

        const venue =
          venueById.get(
            venueId
          ) ??
          null

        if (
          !venue
        ) {
          onSelectionChange(
            null,
            null
          )

          return
        }

        onSelectionChange(
          {
            venueId,
            source,
          },
          venue
        )
      },
      [
        onSelectionChange,
        venueById,
      ]
    )

  const clearSelection =
    useCallback(
      () => {
        setSelectedVenueId(
          null
        )

        setSelectionSource(
          null
        )

        notifySelectionChange({
          venueId:
            null,

          source:
            null,
        })
      },
      [
        notifySelectionChange,
      ]
    )

  const selectVenueById =
    useCallback(
      (
        venueId:
          string,
        source:
          CreatorMapVenueSelectionSource =
          'programmatic'
      ) => {
        const normalizedVenueId =
          normalizeIdentifier(
            venueId
          )

        if (
          !normalizedVenueId ||
          !venueById.has(
            normalizedVenueId
          )
        ) {
          clearSelection()
          return
        }

        setSelectedVenueId(
          normalizedVenueId
        )

        setSelectionSource(
          source
        )

        notifySelectionChange({
          venueId:
            normalizedVenueId,

          source,
        })
      },
      [
        clearSelection,
        notifySelectionChange,
        venueById,
      ]
    )

  const selectVenue =
    useCallback(
      (
        venue:
          Venue,
        source:
          CreatorMapVenueSelectionSource =
          'programmatic'
      ) => {
        const venueId =
          getVenueId(
            venue
          )

        if (
          !venueId
        ) {
          return
        }

        selectVenueById(
          venueId,
          source
        )
      },
      [
        selectVenueById,
      ]
    )

  const isVenueSelected =
    useCallback(
      (
        venueOrId:
          | Venue
          | string
          | null
          | undefined
      ): boolean => {
        if (
          !selectedVenueId ||
          !venueOrId
        ) {
          return false
        }

        const candidateVenueId =
          typeof venueOrId ===
          'string'
            ? normalizeIdentifier(
                venueOrId
              )
            : getVenueId(
                venueOrId
              )

        return (
          candidateVenueId ===
          selectedVenueId
        )
      },
      [
        selectedVenueId,
      ]
    )

  /**
   * Fail closed when the selected venue disappears from the
   * provider's current public venue dataset.
   *
   * This matters when the map is refreshed after publication,
   * eligibility, or moderation state changes.
   */
  useEffect(
    () => {
      if (
        !selectedVenueId
      ) {
        return
      }

      if (
        venueById.has(
          selectedVenueId
        )
      ) {
        return
      }

      setSelectedVenueId(
        null
      )

      setSelectionSource(
        null
      )

      onSelectionChange?.(
        null,
        null
      )
    },
    [
      onSelectionChange,
      selectedVenueId,
      venueById,
    ]
  )

  /**
   * Keep the initial-selection contract synchronized when the
   * provider receives a new initial identifier.
   */
  useEffect(
    () => {
      if (
        !normalizedInitialVenueId
      ) {
        return
      }

      if (
        !venueById.has(
          normalizedInitialVenueId
        )
      ) {
        return
      }

      setSelectedVenueId(
        (
          current
        ) =>
          current ??
          normalizedInitialVenueId
      )

      setSelectionSource(
        (
          current
        ) =>
          current ??
          'programmatic'
      )
    },
    [
      normalizedInitialVenueId,
      venueById,
    ]
  )

  useEffect(
    () => {
      if (
        !closeOnEscape ||
        !selectedVenueId ||
        typeof window ===
          'undefined'
      ) {
        return
      }

      const handleKeyDown =
        (
          event:
            KeyboardEvent
        ) => {
          if (
            event.key !==
            'Escape'
          ) {
            return
          }

          event.preventDefault()

          clearSelection()
        }

      window.addEventListener(
        'keydown',
        handleKeyDown
      )

      return () => {
        window.removeEventListener(
          'keydown',
          handleKeyDown
        )
      }
    },
    [
      clearSelection,
      closeOnEscape,
      selectedVenueId,
    ]
  )

  const value =
    useMemo<
      CreatorMapVenueContextValue
    >(
      () => ({
        selectedVenue,
        selectedVenueId,
        selectionSource,
        selectVenue,
        selectVenueById,
        clearSelection,
        isVenueSelected,
      }),
      [
        clearSelection,
        isVenueSelected,
        selectedVenue,
        selectedVenueId,
        selectionSource,
        selectVenue,
        selectVenueById,
      ]
    )

  return (
    <CreatorMapVenueContext.Provider
      value={
        value
      }
    >
      {children}
    </CreatorMapVenueContext.Provider>
  )
}

/* =========================================================
 * Public hooks
 * ======================================================= */

/**
 * Returns the active Creator Exploration Map venue context.
 *
 * Throws when called outside CreatorMapVenueProvider because
 * silently returning empty selection state would conceal an
 * integration mistake.
 */
export function useCreatorMapVenue():
  CreatorMapVenueContextValue {
  const context =
    useContext(
      CreatorMapVenueContext
    )

  if (
    !context
  ) {
    throw new Error(
      'useCreatorMapVenue must be used within CreatorMapVenueProvider.'
    )
  }

  return context
}

/**
 * Optional context accessor for shared components that may render
 * both inside and outside the Creator Exploration Map.
 */
export function useOptionalCreatorMapVenue():
  CreatorMapVenueContextValue | null {
  return useContext(
    CreatorMapVenueContext
  )
}

/* =========================================================
 * Internal helpers
 * ======================================================= */

function getVenueId(
  venue:
    Venue
): string | null {
  return normalizeIdentifier(
    venue.id
  )
}

function normalizeIdentifier(
  value:
    unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.length >
      200 ||
    /[\r\n]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
}