'use client'

import {
  useEffect,
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
 * Component
 * ======================================================= */

export default function SuggestedRoamers() {
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
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  useEffect(
    () => {
      let cancelled =
        false

      async function loadSuggestedRoamers() {
        setLoading(
          true
        )

        setError(
          null
        )

        try {
          const response =
            await fetch(
              '/api/discover/users?suggested=true',
              {
                method:
                  'GET',

                credentials:
                  'include',

                cache:
                  'no-store',

                headers: {
                  Accept:
                    'application/json',
                },
              }
            )

          const payload =
            (
              await response
                .json()
                .catch(
                  () =>
                    null
                )
            ) as
              | DiscoverUsersResponse
              | null

          if (
            !response.ok
          ) {
            throw new Error(
              payload
                ?.details ??
              payload
                ?.error ??
              'Failed to load suggested Roamers'
            )
          }

          if (cancelled) {
            return
          }

          setUsers(
            Array.isArray(
              payload
                ?.users
            )
              ? payload
                  ?.users ??
                  []
              : []
          )

          setCurrentUserId(
            payload
              ?.currentUserId ??
              null
          )
        } catch (
          error
        ) {
          if (cancelled) {
            return
          }

          setUsers(
            []
          )

          setError(
            error instanceof
              Error
              ? error.message
              : 'Failed to load suggested Roamers'
          )
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            )
          }
        }
      }

      void loadSuggestedRoamers()

      return () => {
        cancelled =
          true
      }
    },
    []
  )

  return (
    <section
      aria-labelledby="suggested-roamers-title"
      className="relative w-full min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent"
      />

      <div className="relative z-10">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-400 sm:text-xs">
              Suggested Roamers
            </p>

            <h2
              id="suggested-roamers-title"
              className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              People worth discovering
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Meet Roamers with shared
              interests, nearby city
              energy, and activity that
              may inspire your next
              outing.
            </p>
          </div>

          {!loading &&
          !error &&
          users.length >
            0 ? (
            <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.07] px-3 py-1.5 text-xs font-medium text-indigo-200">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-indigo-400"
              />

              {users.length.toLocaleString(
                'en-US'
              )}{' '}
              {users.length ===
              1
                ? 'suggestion'
                : 'suggestions'}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <SuggestionSignal
            icon="📍"
            label="Nearby activity"
          />

          <SuggestionSignal
            icon="✨"
            label="Shared interests"
          />

          <SuggestionSignal
            icon="🧭"
            label="New city perspectives"
          />
        </div>

        {error ? (
          <SuggestedRoamersError
            message={
              error
            }
          />
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            <SuggestedRoamersSkeleton />
          ) : null}

          {!loading &&
          users.length ===
            0 &&
          !error ? (
            <EmptySuggestedRoamers />
          ) : null}

          {!loading &&
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

        {!loading &&
        users.length >
          0 &&
        !error ? (
          <p className="mt-4 text-[11px] leading-5 text-neutral-600">
            Suggestions are designed to
            help you discover people,
            not declare who is best.
            Reputation rankings appear
            separately in the
            leaderboard.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/* =========================================================
 * Suggestion signals
 * ======================================================= */

function SuggestionSignal({
  icon,
  label,
}: {
  icon:
    string

  label:
    string
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-neutral-800 bg-black/30 px-3 py-1.5 text-[11px] font-medium text-neutral-500">
      <span
        aria-hidden="true"
        className="text-xs"
      >
        {icon}
      </span>

      {label}
    </span>
  )
}

/* =========================================================
 * Error state
 * ======================================================= */

function SuggestedRoamersError({
  message,
}: {
  message:
    string
}) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3"
    >
      <p className="text-sm font-semibold text-red-200">
        Suggested Roamers are
        temporarily unavailable
      </p>

      <p className="mt-1 break-words text-xs leading-5 text-red-300/80">
        {message}
      </p>
    </div>
  )
}

/* =========================================================
 * Empty state
 * ======================================================= */

function EmptySuggestedRoamers() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/30 px-4 py-8 text-center sm:px-6">
      <div
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] text-xl"
      >
        🧭
      </div>

      <p className="mt-3 text-sm font-semibold text-neutral-300">
        No new suggestions yet
      </p>

      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-neutral-500">
        As more people join, explore,
        and share their city interests,
        new Roamers will appear here.
      </p>
    </div>
  )
}

/* =========================================================
 * Loading state
 * ======================================================= */

function SuggestedRoamersSkeleton() {
  return (
    <div
      aria-label="Loading suggested Roamers"
      className="space-y-3"
    >
      {[
        0,
        1,
        2,
      ].map(
        (
          item
        ) => (
          <div
            key={
              item
            }
            className="animate-pulse rounded-2xl border border-neutral-800 bg-black/50 p-4"
          >
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-neutral-800" />

              <div className="min-w-0 flex-1">
                <div className="h-4 w-36 max-w-full rounded bg-neutral-800" />

                <div className="mt-2 h-3 w-24 max-w-full rounded bg-neutral-900" />

                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="h-7 w-20 rounded-full bg-neutral-900" />

                  <div className="h-7 w-24 rounded-full bg-neutral-900" />
                </div>
              </div>

              <div className="hidden h-10 w-24 shrink-0 rounded-full bg-neutral-800 sm:block" />
            </div>

            <div className="mt-3 h-10 w-full rounded-full bg-neutral-800 sm:hidden" />
          </div>
        )
      )}
    </div>
  )
}