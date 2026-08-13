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
      aria-label="Suggested Roamers"
      className="w-full min-w-0"
    >
      {!loading &&
      !error &&
      users.length >
        0 ? (
        <div className="mb-3 flex min-w-0 items-center justify-end">
          <p className="inline-flex shrink-0 items-center gap-2 text-[10px] font-bold text-zinc-600">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-indigo-300/70 shadow-[0_0_8px_rgba(165,180,252,0.35)]"
            />

            {users.length.toLocaleString(
              'en-US'
            )}{' '}
            {users.length ===
            1
              ? 'person'
              : 'people'}
          </p>
        </div>
      ) : null}

      {error ? (
        <SuggestedRoamersError
          message={
            error
          }
        />
      ) : null}

      <div className="space-y-3">
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
    </section>
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
      className="rounded-[1.4rem] bg-red-400/[0.055] px-4 py-3.5 ring-1 ring-red-400/15"
    >
      <p className="text-sm font-black tracking-tight text-red-200">
        Suggestions are unavailable
      </p>

      <p className="mt-1 break-words text-xs leading-5 text-red-200/55">
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
    <div className="relative overflow-hidden rounded-[1.5rem] bg-white/[0.02] px-5 py-8 text-center ring-1 ring-white/[0.045] sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-0 h-28 w-48 -translate-x-1/2 rounded-full bg-indigo-300/[0.035] blur-[70px]" />
      </div>

      <div className="relative z-10">
        <div
          aria-hidden="true"
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-300/[0.06] text-sm text-indigo-200/70 ring-1 ring-indigo-300/10"
        >
          ✦
        </div>

        <p className="mt-3 text-sm font-black tracking-tight text-white">
          Your orbit is still forming
        </p>

        <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-zinc-600">
          New people will show up here
          as more Roamers explore,
          connect, and build their city
          footprint.
        </p>
      </div>
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
            className="animate-pulse rounded-[1.5rem] bg-white/[0.025] p-4 ring-1 ring-white/[0.05] sm:p-5"
          >
            <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
              <div className="h-14 w-14 shrink-0 rounded-[1.1rem] bg-white/[0.065] sm:h-16 sm:w-16" />

              <div className="min-w-0 flex-1">
                <div className="h-4 w-36 max-w-full rounded bg-white/[0.065]" />

                <div className="mt-2 h-3 w-24 max-w-full rounded bg-white/[0.035]" />

                <div className="mt-3 flex flex-wrap gap-2">
                  <div className="h-7 w-20 rounded-full bg-white/[0.035]" />

                  <div className="h-7 w-24 rounded-full bg-white/[0.035]" />
                </div>
              </div>

              <div className="hidden h-10 w-24 shrink-0 rounded-full bg-white/[0.055] sm:block" />
            </div>

            <div className="mt-3 h-10 w-full rounded-full bg-white/[0.055] sm:hidden" />
          </div>
        )
      )}
    </div>
  )
}