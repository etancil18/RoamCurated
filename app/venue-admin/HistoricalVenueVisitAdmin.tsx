'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

// ============================================================
// CONTRACT
// ============================================================

type HistoricalVenueVisitAdminProps = {
  venueId: string
}

type HistoricalVisitResponse = {
  historicalVisit: {
    assertionId: string
    venueVisitId: string
    userId: string
    venueId: string
    visitedAt: string
    visitDate: string
    geoVerified: boolean
    checkInSource: string
    created: boolean
  }

  passportRebuilt: boolean
}

type HistoricalVisitForm = {
  userId: string
  localDateTime: string
  venueTimezone: string
  reason: string
}

type AdminUserSearchResult = {
  id: string
  email: string | null
  fullName: string | null
}

type AdminUserSearchResponse = {
  users: AdminUserSearchResult[]
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_TIMEZONE =
  Intl.DateTimeFormat()
    .resolvedOptions()
    .timeZone ||
  'America/New_York'

const EMPTY_FORM: HistoricalVisitForm = {
  userId: '',
  localDateTime: '',
  venueTimezone:
    DEFAULT_TIMEZONE,
  reason:
    'Founding tastemaker onboarding',
}

const INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50'

// ============================================================
// COMPONENT
// ============================================================

export default function HistoricalVenueVisitAdmin({
  venueId,
}: HistoricalVenueVisitAdminProps) {
  const [
    form,
    setForm,
  ] =
    useState<HistoricalVisitForm>(
      EMPTY_FORM
    )

  const [
    userSearchQuery,
    setUserSearchQuery,
  ] =
    useState('')

  const [
    userSearchResults,
    setUserSearchResults,
  ] =
    useState<AdminUserSearchResult[]>(
      []
    )

  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<AdminUserSearchResult | null>(
      null
    )

  const [
    searchingUsers,
    setSearchingUsers,
  ] =
    useState(false)

  const [
    userSearchError,
    setUserSearchError,
  ] =
    useState<string | null>(
      null
    )

  const [
    userSearchTouched,
    setUserSearchTouched,
  ] =
    useState(false)

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    )

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null
    )

  const [
    lastResult,
    setLastResult,
  ] =
    useState<HistoricalVisitResponse | null>(
      null
    )

  const normalizedUserSearchQuery =
    userSearchQuery.trim()

  const canSearchUsers =
    normalizedUserSearchQuery.length >=
      2 ||
    isUuid(
      normalizedUserSearchQuery
    )

  const canSubmit =
    useMemo(
      () =>
        Boolean(
          venueId &&
            form.userId.trim() &&
            selectedUser &&
            selectedUser.id ===
              form.userId.trim() &&
            form.localDateTime &&
            form.venueTimezone.trim() &&
            form.reason.trim()
        ),
      [
        venueId,
        form,
        selectedUser,
      ]
    )

  // ==========================================================
  // USER SEARCH
  // ==========================================================

  useEffect(() => {
    if (
      selectedUser &&
      normalizedUserSearchQuery ===
        selectedUser.id
    ) {
      return
    }

    if (
      !canSearchUsers
    ) {
      setUserSearchResults(
        []
      )

      setUserSearchError(
        null
      )

      setSearchingUsers(
        false
      )

      return
    }

    const controller =
      new AbortController()

    const timeout =
      window.setTimeout(
        async () => {
          setSearchingUsers(
            true
          )

          setUserSearchError(
            null
          )

          try {
            const response =
              await fetch(
                `/api/admin/users/search?q=${encodeURIComponent(
                  normalizedUserSearchQuery
                )}`,
                {
                  method:
                    'GET',

                  cache:
                    'no-store',

                  signal:
                    controller.signal,
                }
              )

            const payload =
              (await response
                .json()
                .catch(
                  () =>
                    null
                )) as
                | AdminUserSearchResponse
                | {
                    error?: string
                  }
                | null

            if (
              !response.ok
            ) {
              const message =
                payload &&
                typeof payload ===
                  'object' &&
                'error' in
                  payload &&
                typeof payload.error ===
                  'string'
                  ? payload.error
                  : `User search failed with status ${response.status}.`

              throw new Error(
                message
              )
            }

            if (
              !payload ||
              typeof payload !==
                'object' ||
              !(
                'users' in
                payload
              ) ||
              !Array.isArray(
                payload.users
              )
            ) {
              throw new Error(
                'User search returned an invalid response.'
              )
            }

            setUserSearchResults(
              payload.users
            )
          } catch (
            searchError
          ) {
            if (
              searchError instanceof
                DOMException &&
              searchError.name ===
                'AbortError'
            ) {
              return
            }

            setUserSearchResults(
              []
            )

            setUserSearchError(
              getErrorMessage(
                searchError
              )
            )
          } finally {
            if (
              !controller
                .signal
                .aborted
            ) {
              setSearchingUsers(
                false
              )

              setUserSearchTouched(
                true
              )
            }
          }
        },
        300
      )

    return () => {
      window.clearTimeout(
        timeout
      )

      controller.abort()
    }
  }, [
    canSearchUsers,
    normalizedUserSearchQuery,
    selectedUser,
  ])

  function updateUserSearch(
    value: string
  ) {
    setUserSearchQuery(
      value
    )

    setUserSearchTouched(
      false
    )

    setUserSearchError(
      null
    )

    if (
      selectedUser
    ) {
      setSelectedUser(
        null
      )

      setForm(
        (
          current
        ) => ({
          ...current,

          userId:
            '',
        })
      )
    }
  }

  function selectUser(
    user: AdminUserSearchResult
  ) {
    setSelectedUser(
      user
    )

    setForm(
      (
        current
      ) => ({
        ...current,

        userId:
          user.id,
      })
    )

    setUserSearchQuery(
      user.id
    )

    setUserSearchResults(
      []
    )

    setUserSearchError(
      null
    )

    setUserSearchTouched(
      false
    )
  }

  function clearSelectedUser() {
    setSelectedUser(
      null
    )

    setForm(
      (
        current
      ) => ({
        ...current,

        userId:
          '',
      })
    )

    setUserSearchQuery(
      ''
    )

    setUserSearchResults(
      []
    )

    setUserSearchError(
      null
    )

    setUserSearchTouched(
      false
    )
  }

  // ==========================================================
  // HISTORICAL VISIT SUBMIT
  // ==========================================================

  async function submitHistoricalVisit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError(
      null
    )

    setNotice(
      null
    )

    setLastResult(
      null
    )

    const userId =
      form.userId.trim()

    const venueTimezone =
      form.venueTimezone.trim()

    const reason =
      form.reason.trim()

    if (
      !selectedUser ||
      selectedUser.id !==
        userId ||
      !isUuid(
        userId
      )
    ) {
      setError(
        'Select a valid target user from the search results.'
      )

      return
    }

    if (
      !form.localDateTime
    ) {
      setError(
        'Historical date and time are required.'
      )

      return
    }

    if (
      !venueTimezone
    ) {
      setError(
        'Venue timezone is required.'
      )

      return
    }

    if (
      !isValidIanaTimezone(
        venueTimezone
      )
    ) {
      setError(
        'Venue timezone must be a valid IANA timezone, such as America/New_York.'
      )

      return
    }

    if (
      !reason
    ) {
      setError(
        'Reason is required.'
      )

      return
    }

    if (
      reason.length >
      500
    ) {
      setError(
        'Reason must be 500 characters or fewer.'
      )

      return
    }

    const visitedAt =
      localDateTimeInTimeZoneToIso({
        localDateTime:
          form.localDateTime,

        timeZone:
          venueTimezone,
      })

    if (
      !visitedAt
    ) {
      setError(
        'The selected historical date/time could not be interpreted in that venue timezone.'
      )

      return
    }

    if (
      new Date(
        visitedAt
      ).getTime() >=
      Date.now()
    ) {
      setError(
        'Historical visit must be in the past.'
      )

      return
    }

    const userLabel =
      selectedUser.fullName?.trim() ||
      selectedUser.email?.trim() ||
      userId

    const confirmed =
      window.confirm(
        [
          'Add this historical venue visit?',
          '',
          `User: ${userLabel}`,
          `User ID: ${userId}`,
          selectedUser.email
            ? `Email: ${selectedUser.email}`
            : null,
          `Venue: ${venueId}`,
          `Local time: ${form.localDateTime}`,
          `Timezone: ${venueTimezone}`,
          '',
          'This creates a canonical geo-verified venue visit and refreshes the user’s Passport.',
        ]
          .filter(
            (
              line
            ): line is string =>
              typeof line ===
              'string'
          )
          .join(
            '\n'
          )
      )

    if (
      !confirmed
    ) {
      return
    }

    setSubmitting(
      true
    )

    try {
      const response =
        await fetch(
          `/api/admin/venues/${encodeURIComponent(
            venueId
          )}/historical-visits`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            cache:
              'no-store',

            body:
              JSON.stringify({
                user_id:
                  userId,

                visited_at:
                  visitedAt,

                venue_timezone:
                  venueTimezone,

                reason,
              }),
          }
        )

      const payload =
        (await response
          .json()
          .catch(
            () =>
              null
          )) as
          | HistoricalVisitResponse
          | {
              error?: string
            }
          | null

      if (
        !response.ok
      ) {
        const message =
          payload &&
          typeof payload ===
            'object' &&
          'error' in payload &&
          typeof payload.error ===
            'string'
            ? payload.error
            : `Request failed with status ${response.status}.`

        throw new Error(
          message
        )
      }

      if (
        !payload ||
        typeof payload !==
          'object' ||
        !(
          'historicalVisit' in
          payload
        )
      ) {
        throw new Error(
          'Historical visit was created, but the response was invalid.'
        )
      }

      const result =
        payload as
          HistoricalVisitResponse

      setLastResult(
        result
      )

      setNotice(
        result
          .historicalVisit
          .created
          ? 'Historical visit added and Passport refreshed.'
          : 'Historical visit already existed. Passport refreshed.'
      )

      setForm(
        (
          current
        ) => ({
          ...current,

          userId:
            '',

          localDateTime:
            '',
        })
      )

      setSelectedUser(
        null
      )

      setUserSearchQuery(
        ''
      )

      setUserSearchResults(
        []
      )

      setUserSearchError(
        null
      )

      setUserSearchTouched(
        false
      )
    } catch (
      submitError
    ) {
      setError(
        getErrorMessage(
          submitError
        )
      )
    } finally {
      setSubmitting(
        false
      )
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Founding tastemakers
        </p>

        <h2 className="text-xl font-semibold text-white">
          Add historical venue visit
        </h2>

        <p className="max-w-2xl text-sm leading-6 text-neutral-400">
          Seed a verified historical visit for an approved founding
          tastemaker. The visit becomes part of canonical Visit History
          and Passport progression, while remaining marked as an admin
          historical assertion.
        </p>
      </div>

      {(error ||
        notice) && (
        <div
          className={[
            'rounded-xl border px-4 py-3 text-sm',

            error
              ? 'border-red-900/70 bg-red-950/40 text-red-200'
              : 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200',
          ].join(
            ' '
          )}
        >
          {error ??
            notice}
        </div>
      )}

      <form
        onSubmit={
          submitHistoricalVisit
        }
        className="space-y-5"
      >
        {/* ====================================================
            USER SEARCH
        ===================================================== */}

        <div className="space-y-3">
          <AdminField label="Find tastemaker">
            <div className="relative">
              <input
                type="search"
                value={
                  userSearchQuery
                }
                onChange={(
                  event
                ) =>
                  updateUserSearch(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Search by user ID, email, or full name"
                autoComplete="off"
                spellCheck={
                  false
                }
                className={`${INPUT_CLASS} pr-12`}
              />

              {searchingUsers && (
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
                  …
                </div>
              )}
            </div>
          </AdminField>

          <p className="text-xs leading-5 text-neutral-600">
            Search using the user UUID, account email, or profile full
            name. Select the correct person before creating the visit.
          </p>

          {userSearchError && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {userSearchError}
            </div>
          )}

          {!selectedUser &&
            canSearchUsers &&
            userSearchTouched &&
            !searchingUsers &&
            !userSearchError &&
            userSearchResults.length ===
              0 && (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-5 text-center">
                <p className="text-sm font-medium text-neutral-300">
                  No users found
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-600">
                  Try the exact email address, full name, or user UUID.
                </p>
              </div>
            )}

          {!selectedUser &&
            userSearchResults.length >
              0 && (
              <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
                <div className="border-b border-neutral-800 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Matching users
                  </p>
                </div>

                <div className="divide-y divide-neutral-800">
                  {userSearchResults.map(
                    (
                      user
                    ) => (
                      <button
                        key={
                          user.id
                        }
                        type="button"
                        onClick={() =>
                          selectUser(
                            user
                          )
                        }
                        className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-neutral-800/70 active:bg-neutral-800"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/15 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
                          {getUserInitial(
                            user
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {user.fullName?.trim() ||
                              'Unnamed user'}
                          </p>

                          {user.email && (
                            <p className="mt-0.5 truncate text-xs text-neutral-400">
                              {
                                user.email
                              }
                            </p>
                          )}

                          <p className="mt-1 break-all text-[11px] leading-4 text-neutral-600">
                            {
                              user.id
                            }
                          </p>
                        </div>

                        <span className="mt-2 shrink-0 text-xs font-medium text-emerald-300">
                          Select
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

          {selectedUser && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-sm font-semibold text-emerald-200">
                  {getUserInitial(
                    selectedUser
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-100">
                        {selectedUser.fullName?.trim() ||
                          'Unnamed user'}
                      </p>

                      {selectedUser.email && (
                        <p className="mt-1 break-all text-xs text-emerald-100/70">
                          {
                            selectedUser.email
                          }
                        </p>
                      )}
                    </div>

                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                      Selected
                    </span>
                  </div>

                  <p className="mt-2 break-all text-[11px] leading-4 text-emerald-100/45">
                    {
                      selectedUser.id
                    }
                  </p>

                  <button
                    type="button"
                    onClick={
                      clearSelectedUser
                    }
                    className="mt-3 text-xs font-medium text-emerald-300 underline decoration-emerald-400/30 underline-offset-4 transition hover:text-emerald-200"
                  >
                    Choose another user
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Historical local date & time">
            <input
              type="datetime-local"
              value={
                form.localDateTime
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    current
                  ) => ({
                    ...current,

                    localDateTime:
                      event
                        .target
                        .value,
                  })
                )
              }
              className={
                INPUT_CLASS
              }
            />
          </AdminField>

          <AdminField label="Venue timezone">
            <input
              type="text"
              value={
                form.venueTimezone
              }
              onChange={(
                event
              ) =>
                setForm(
                  (
                    current
                  ) => ({
                    ...current,

                    venueTimezone:
                      event
                        .target
                        .value,
                  })
                )
              }
              placeholder="America/New_York"
              autoComplete="off"
              spellCheck={
                false
              }
              className={
                INPUT_CLASS
              }
            />
          </AdminField>
        </div>

        <p className="-mt-2 text-xs leading-5 text-neutral-600">
          Enter the time as it occurred at the venue. Roam converts it to
          the canonical UTC timestamp before creating the visit.
        </p>

        <AdminField label="Audit reason">
          <textarea
            value={
              form.reason
            }
            onChange={(
              event
            ) =>
              setForm(
                (
                  current
                ) => ({
                  ...current,

                  reason:
                    event
                      .target
                      .value,
                })
              )
            }
            maxLength={
              500
            }
            rows={
              3
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </AdminField>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-xs leading-5 text-neutral-500">
          <p>
            <span className="font-medium text-neutral-300">
              Selected venue:
            </span>{' '}
            <span className="break-all">
              {venueId}
            </span>
          </p>

          <p className="mt-2">
            Historical admin visits are geo-verified for Passport and
            Visit History, but are excluded from City Market settlement
            and Community Signal verified-participation analytics.
          </p>
        </div>

        <button
          type="submit"
          disabled={
            submitting ||
            !canSubmit
          }
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Adding historical visit…'
            : 'Add historical visit'}
        </button>
      </form>

      {lastResult && (
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-200">
            {lastResult
              .historicalVisit
              .created
              ? 'Historical visit created'
              : 'Existing historical visit reused'}
          </p>

          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <ResultField
              label="Visit ID"
              value={
                lastResult
                  .historicalVisit
                  .venueVisitId
              }
            />

            <ResultField
              label="Assertion ID"
              value={
                lastResult
                  .historicalVisit
                  .assertionId
              }
            />

            <ResultField
              label="Visit date"
              value={
                lastResult
                  .historicalVisit
                  .visitDate
              }
            />

            <ResultField
              label="Passport"
              value={
                lastResult
                  .passportRebuilt
                  ? 'Rebuilt'
                  : 'Not rebuilt'
              }
            />
          </dl>
        </div>
      )}
    </section>
  )
}

// ============================================================
// UI HELPERS
// ============================================================

function AdminField({
  label,
  children,
}: {
  label: string
  children:
    React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>

      {children}
    </label>
  )
}

function ResultField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <dt className="text-neutral-600">
        {label}
      </dt>

      <dd className="mt-1 break-all font-medium text-neutral-300">
        {value}
      </dd>
    </div>
  )
}

function getUserInitial(
  user: AdminUserSearchResult
): string {
  const source =
    user.fullName?.trim() ||
    user.email?.trim() ||
    user.id

  return source
    .slice(
      0,
      1
    )
    .toUpperCase()
}

// ============================================================
// TIMEZONE CONVERSION
// ============================================================

function localDateTimeInTimeZoneToIso({
  localDateTime,
  timeZone,
}: {
  localDateTime: string
  timeZone: string
}): string | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      localDateTime
    )

  if (
    !match
  ) {
    return null
  }

  const [
    ,
    yearRaw,
    monthRaw,
    dayRaw,
    hourRaw,
    minuteRaw,
    secondRaw = '00',
  ] =
    match

  const year =
    Number(
      yearRaw
    )

  const month =
    Number(
      monthRaw
    )

  const day =
    Number(
      dayRaw
    )

  const hour =
    Number(
      hourRaw
    )

  const minute =
    Number(
      minuteRaw
    )

  const second =
    Number(
      secondRaw
    )

  const desiredUtcLike =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    )

  let candidate =
    desiredUtcLike

  for (
    let index = 0;
    index < 4;
    index += 1
  ) {
    const parts =
      getTimeZoneParts(
        new Date(
          candidate
        ),
        timeZone
      )

    if (
      !parts
    ) {
      return null
    }

    const representedUtcLike =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      )

    const difference =
      desiredUtcLike -
      representedUtcLike

    if (
      difference ===
      0
    ) {
      break
    }

    candidate +=
      difference
  }

  const finalDate =
    new Date(
      candidate
    )

  const finalParts =
    getTimeZoneParts(
      finalDate,
      timeZone
    )

  if (
    !finalParts
  ) {
    return null
  }

  if (
    finalParts.year !==
      year ||
    finalParts.month !==
      month ||
    finalParts.day !==
      day ||
    finalParts.hour !==
      hour ||
    finalParts.minute !==
      minute ||
    finalParts.second !==
      second
  ) {
    return null
  }

  return finalDate.toISOString()
}

function getTimeZoneParts(
  date: Date,
  timeZone: string
): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} | null {
  try {
    const parts =
      new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone,
          year:
            'numeric',
          month:
            '2-digit',
          day:
            '2-digit',
          hour:
            '2-digit',
          minute:
            '2-digit',
          second:
            '2-digit',
          hourCycle:
            'h23',
        }
      ).formatToParts(
        date
      )

    const values =
      new Map(
        parts.map(
          (
            part
          ) => [
            part.type,
            part.value,
          ]
        )
      )

    const year =
      Number(
        values.get(
          'year'
        )
      )

    const month =
      Number(
        values.get(
          'month'
        )
      )

    const day =
      Number(
        values.get(
          'day'
        )
      )

    const hour =
      Number(
        values.get(
          'hour'
        )
      )

    const minute =
      Number(
        values.get(
          'minute'
        )
      )

    const second =
      Number(
        values.get(
          'second'
        )
      )

    if (
      !Number.isInteger(
        year
      ) ||
      !Number.isInteger(
        month
      ) ||
      !Number.isInteger(
        day
      ) ||
      !Number.isInteger(
        hour
      ) ||
      !Number.isInteger(
        minute
      ) ||
      !Number.isInteger(
        second
      )
    ) {
      return null
    }

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
    }
  } catch {
    return null
  }
}

function isValidIanaTimezone(
  value: string
): boolean {
  try {
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          value,
      }
    ).format()

    return true
  } catch {
    return false
  }
}

// ============================================================
// IDENTIFIERS / ERRORS
// ============================================================

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof
      Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return 'Something went wrong.'
}