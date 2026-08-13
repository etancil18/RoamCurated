'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import UserResultCard, {
  type DiscoverUser,
} from './UserResultCard'

/* =========================================================
 * Contracts
 * ======================================================= */

type DiscoverUsersResponse = {
  users?: DiscoverUser[]
  currentUserId?: string | null
  error?: string
  details?: string
}

/* =========================================================
 * Constants
 * ======================================================= */

const MINIMUM_SEARCH_LENGTH =
  2

const SEARCH_DEBOUNCE_MILLISECONDS =
  300

/* =========================================================
 * Component
 * ======================================================= */

export default function UserSearch() {
  const [
    query,
    setQuery,
  ] =
    useState('')

  const [
    debouncedQuery,
    setDebouncedQuery,
  ] =
    useState('')

  const [
    users,
    setUsers,
  ] =
    useState<
      DiscoverUser[]
    >([])

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const trimmedQuery =
    useMemo(
      () =>
        debouncedQuery
          .trim(),
      [
        debouncedQuery,
      ]
    )

  const liveQuery =
    query.trim()

  const hasSearch =
    trimmedQuery.length >=
    MINIMUM_SEARCH_LENGTH

  const hasPendingQuery =
    liveQuery.length >=
      MINIMUM_SEARCH_LENGTH &&
    liveQuery !==
      trimmedQuery

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          setDebouncedQuery(
            query
          )
        },
        SEARCH_DEBOUNCE_MILLISECONDS
      )

    return () =>
      window.clearTimeout(
        timeout
      )
  }, [
    query,
  ])

  useEffect(() => {
    let cancelled =
      false

    async function searchUsers() {
      if (!hasSearch) {
        setUsers(
          []
        )

        setError(
          null
        )

        setLoading(
          false
        )

        return
      }

      setLoading(
        true
      )

      setError(
        null
      )

      try {
        const res =
          await fetch(
            `/api/discover/users?q=${encodeURIComponent(
              trimmedQuery
            )}`,
            {
              method:
                'GET',

              credentials:
                'include',

              cache:
                'no-store',
            }
          )

        const json =
          (
            await res
              .json()
              .catch(
                () =>
                  null
              )
          ) as
            | DiscoverUsersResponse
            | null

        if (!res.ok) {
          throw new Error(
            json?.details ||
              json?.error ||
              'Failed to search users'
          )
        }

        if (cancelled) {
          return
        }

        setUsers(
          json?.users ??
            []
        )

        setCurrentUserId(
          json?.currentUserId ??
            null
        )
      } catch (err) {
        if (cancelled) {
          return
        }

        setUsers(
          []
        )

        setError(
          err instanceof
            Error
            ? err.message
            : 'Failed to search users'
        )
      } finally {
        if (!cancelled) {
          setLoading(
            false
          )
        }
      }
    }

    void searchUsers()

    return () => {
      cancelled =
        true
    }
  }, [
    hasSearch,
    trimmedQuery,
  ])

  const clearSearch =
    () => {
      setQuery(
        ''
      )

      setDebouncedQuery(
        ''
      )

      setUsers(
        []
      )

      setError(
        null
      )

      setLoading(
        false
      )
    }

  const resultSummary =
    buildResultSummary({
      loading:
        loading ||
        hasPendingQuery,

      hasSearch:
        liveQuery.length >=
        MINIMUM_SEARCH_LENGTH,

      query:
        trimmedQuery,

      resultCount:
        users.length,

      error,
    })

  return (
    <section
      aria-label="Search Roamers"
      className="w-full min-w-0"
    >
      <form
        role="search"
        onSubmit={(
          event
        ) => {
          event.preventDefault()

          setDebouncedQuery(
            query
          )
        }}
        className="w-full min-w-0"
      >
        <label
          htmlFor="discover-user-search-input"
          className="sr-only"
        >
          Search Roam users by
          username or name
        </label>

        <div
          className={[
            'relative overflow-hidden rounded-[1.6rem] bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,0.18)] ring-1 transition',
            error
              ? 'ring-red-400/25 focus-within:ring-red-400/45'
              : 'ring-white/[0.065] focus-within:bg-white/[0.045] focus-within:ring-cyan-300/25',
          ].join(
            ' '
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent"
          />

          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-zinc-600"
          >
            @
          </span>

          <input
            id="discover-user-search-input"
            type="search"
            value={
              query
            }
            onChange={(
              event
            ) =>
              setQuery(
                event
                  .target
                  .value
              )
            }
            placeholder="Search a name or @username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            aria-describedby="discover-user-search-help discover-user-search-status"
            className={[
              'min-h-14 w-full bg-transparent py-4 pl-10 text-base font-semibold text-white outline-none sm:text-sm',
              query.length >
                0
                ? 'pr-14'
                : 'pr-4',
              'placeholder:font-medium placeholder:text-zinc-700',
            ].join(
              ' '
            )}
          />

          {query.length >
          0 ? (
            <button
              type="button"
              onClick={
                clearSearch
              }
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.035] text-lg text-zinc-600 ring-1 ring-white/[0.05] transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
            >
              <span
                aria-hidden="true"
              >
                ×
              </span>
            </button>
          ) : null}
        </div>

        <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
          <p
            id="discover-user-search-help"
            className="text-[10px] font-medium leading-5 text-zinc-700"
          >
            Name or username ·{' '}
            {
              MINIMUM_SEARCH_LENGTH
            }+
            characters
          </p>

          {liveQuery.length >
            0 &&
          liveQuery.length <
            MINIMUM_SEARCH_LENGTH ? (
            <p className="text-[10px] font-bold text-amber-200/60">
              Keep typing
            </p>
          ) : null}

          {users.length >
            0 &&
          hasSearch &&
          !loading &&
          !hasPendingQuery ? (
            <p className="text-[10px] font-bold text-zinc-600">
              {users.length.toLocaleString(
                'en-US'
              )}{' '}
              {users.length ===
              1
                ? 'person'
                : 'people'}
            </p>
          ) : null}
        </div>
      </form>

      <p
        id="discover-user-search-status"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {resultSummary}
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-[1.35rem] bg-red-400/[0.06] px-4 py-3.5 ring-1 ring-red-400/15"
        >
          <p className="text-sm font-black text-red-200">
            Search is unavailable
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-red-200/60">
            {error}
          </p>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {(loading ||
          hasPendingQuery) &&
        liveQuery.length >=
          MINIMUM_SEARCH_LENGTH ? (
          <SearchLoadingState />
        ) : null}

        {!loading &&
        !hasPendingQuery &&
        liveQuery.length <
          MINIMUM_SEARCH_LENGTH ? (
          <SearchPromptState />
        ) : null}

        {!loading &&
        !hasPendingQuery &&
        hasSearch &&
        users.length ===
          0 &&
        !error ? (
          <SearchEmptyState
            query={
              trimmedQuery
            }
          />
        ) : null}

        {!loading &&
        !hasPendingQuery &&
          users.map(
            (
              user
            ) => (
              <UserResultCard
                key={
                  user.id
                }
                user={
                  user
                }
                currentUserId={
                  currentUserId
                }
              />
            )
          )}
      </div>
    </section>
  )
}

/* =========================================================
 * Search states
 * ======================================================= */

function SearchPromptState() {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[1.35rem] bg-white/[0.02] px-4 py-3.5 ring-1 ring-white/[0.045]">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/[0.06] text-sm text-cyan-200/70 ring-1 ring-cyan-300/10"
      >
        ↗
      </span>

      <p className="min-w-0 text-xs leading-5 text-zinc-600">
        Search someone you know,
        a creator you&apos;ve heard
        about, or a Roamer you met
        out in the city.
      </p>
    </div>
  )
}

function SearchEmptyState({
  query,
}: {
  query:
    string
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] px-5 py-7 text-center ring-1 ring-white/[0.045]">
      <div
        aria-hidden="true"
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.035] text-base text-zinc-500 ring-1 ring-white/[0.055]"
      >
        ?
      </div>

      <p className="mt-3 text-sm font-black text-white">
        Nobody here yet
      </p>

      <p className="mx-auto mt-1.5 max-w-sm break-words text-xs leading-5 text-zinc-600">
        No match for{' '}
        <span className="font-semibold text-zinc-400">
          “{query}”
        </span>
        . Try their username,
        a shorter name, or a
        different spelling.
      </p>
    </div>
  )
}

function SearchLoadingState() {
  return (
    <div
      aria-label="Searching for Roamers"
      className="space-y-3"
    >
      {[
        0,
        1,
      ].map(
        (
          item
        ) => (
          <div
            key={
              item
            }
            className="animate-pulse rounded-[1.5rem] bg-white/[0.025] p-4 ring-1 ring-white/[0.05] sm:p-5"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="h-14 w-14 shrink-0 rounded-[1.1rem] bg-white/[0.065] sm:h-16 sm:w-16" />

              <div className="min-w-0 flex-1">
                <div className="h-4 w-36 max-w-full rounded bg-white/[0.065]" />

                <div className="mt-2 h-3 w-48 max-w-full rounded bg-white/[0.035]" />

                <div className="mt-4 h-3 w-full rounded bg-white/[0.035]" />

                <div className="mt-2 h-3 w-3/4 rounded bg-white/[0.03]" />

                <div className="mt-4 flex gap-2">
                  <div className="h-7 w-20 rounded-full bg-white/[0.035]" />

                  <div className="h-7 w-24 rounded-full bg-white/[0.035]" />
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

/* =========================================================
 * Status helpers
 * ======================================================= */

function buildResultSummary({
  loading,
  hasSearch,
  query,
  resultCount,
  error,
}: {
  loading:
    boolean

  hasSearch:
    boolean

  query:
    string

  resultCount:
    number

  error:
    string | null
}): string {
  if (error) {
    return `Search failed: ${error}`
  }

  if (!hasSearch) {
    return `Enter at least ${MINIMUM_SEARCH_LENGTH} characters to search for Roamers.`
  }

  if (loading) {
    return `Searching for ${query}.`
  }

  if (
    resultCount ===
    0
  ) {
    return `No Roamers found for ${query}.`
  }

  return `${resultCount.toLocaleString(
    'en-US'
  )} ${
    resultCount ===
    1
      ? 'Roamer'
      : 'Roamers'
  } found for ${query}.`
}