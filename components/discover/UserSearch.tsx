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
      aria-labelledby="discover-user-search-title"
      className="relative w-full min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
      />

      <div className="relative z-10">
        <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400 sm:text-xs">
              People search
            </p>

            <h2
              id="discover-user-search-title"
              className="mt-2 text-2xl font-bold tracking-tight text-white"
            >
              Find Roamers
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
              Search by name or username
              to discover people, explore
              their city activity, and
              follow their next Roam.
            </p>
          </div>

          {users.length >
            0 &&
          hasSearch &&
          !loading ? (
            <p className="shrink-0 text-xs font-medium text-neutral-500">
              {users.length.toLocaleString(
                'en-US'
              )}{' '}
              {users.length ===
              1
                ? 'Roamer'
                : 'Roamers'}
            </p>
          ) : null}
        </div>

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

          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-500"
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
                'min-h-12 w-full rounded-2xl border bg-black py-3 pl-9 text-sm text-white outline-none transition',
                query.length >
                  0
                  ? 'pr-12'
                  : 'pr-4',
                error
                  ? 'border-red-500/50 focus:border-red-400 focus:ring-4 focus:ring-red-400/10'
                  : 'border-neutral-800 focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10',
                'placeholder:text-neutral-600',
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
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-lg text-neutral-500 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span
                  aria-hidden="true"
                >
                  ×
                </span>
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
            <p
              id="discover-user-search-help"
              className="text-[11px] leading-5 text-neutral-600"
            >
              Enter at least{' '}
              {
                MINIMUM_SEARCH_LENGTH
              }{' '}
              characters.
            </p>

            {liveQuery.length >
              0 &&
            liveQuery.length <
              MINIMUM_SEARCH_LENGTH ? (
              <p className="text-[11px] font-medium text-amber-300/70">
                Type one more character
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
            className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3"
          >
            <p className="text-sm font-semibold text-red-200">
              Search unavailable
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-red-300/80">
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
      </div>
    </section>
  )
}

/* =========================================================
 * Search states
 * ======================================================= */

function SearchPromptState() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/25 p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.07] text-lg"
        >
          🧭
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-200">
            Discover someone new
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Try a name, username, or
            someone you met on a recent
            Roam.
          </p>
        </div>
      </div>
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
    <div className="rounded-2xl border border-neutral-800 bg-black/25 p-5 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 text-xl"
      >
        🔎
      </div>

      <p className="mt-3 text-sm font-semibold text-white">
        No Roamers found
      </p>

      <p className="mx-auto mt-1 max-w-sm break-words text-xs leading-5 text-neutral-500">
        We could not find anyone
        matching{' '}
        <span className="font-medium text-neutral-300">
          “{query}”
        </span>
        . Check the spelling or try a
        shorter name.
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
            className="animate-pulse rounded-2xl border border-neutral-800 bg-black/30 p-4 sm:p-5"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-neutral-800 sm:h-16 sm:w-16" />

              <div className="min-w-0 flex-1">
                <div className="h-4 w-36 max-w-full rounded bg-neutral-800" />

                <div className="mt-2 h-3 w-48 max-w-full rounded bg-neutral-900" />

                <div className="mt-4 h-3 w-full rounded bg-neutral-900" />

                <div className="mt-2 h-3 w-3/4 rounded bg-neutral-900" />

                <div className="mt-4 flex gap-2">
                  <div className="h-7 w-20 rounded-full bg-neutral-900" />

                  <div className="h-7 w-24 rounded-full bg-neutral-900" />
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