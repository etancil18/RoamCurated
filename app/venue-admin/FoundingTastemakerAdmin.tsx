'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

// ============================================================
// CONTRACT
// ============================================================

type AdminUserSearchResult = {
  id: string
  email: string | null
  fullName: string | null
}

type AdminUserSearchResponse = {
  users: AdminUserSearchResult[]
}

type FoundingTastemakerUser = {
  id: string
  fullName: string | null
  username: string | null
  isFoundingTastemaker: boolean
  designatedAt: string | null
  designatedBy: string | null
  changed?: boolean
}

type FoundingTastemakerResponse = {
  user: FoundingTastemakerUser
}

// ============================================================
// UI
// ============================================================

const INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-slate-700 bg-[#0d1b2f] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50'

// ============================================================
// COMPONENT
// ============================================================

export default function FoundingTastemakerAdmin() {
  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('')

  const [
    searchResults,
    setSearchResults,
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
    designation,
    setDesignation,
  ] =
    useState<FoundingTastemakerUser | null>(
      null
    )

  const [
    searchingUsers,
    setSearchingUsers,
  ] =
    useState(false)

  const [
    searchTouched,
    setSearchTouched,
  ] =
    useState(false)

  const [
    loadingDesignation,
    setLoadingDesignation,
  ] =
    useState(false)

  const [
    updatingDesignation,
    setUpdatingDesignation,
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

  const normalizedSearchQuery =
    searchQuery.trim()

  const canSearch =
    normalizedSearchQuery.length >=
      2 ||
    isUuid(
      normalizedSearchQuery
    )

  const selectedDisplayName =
    useMemo(
      () =>
        selectedUser
          ? displayUserName(
              selectedUser
            )
          : null,
      [
        selectedUser,
      ]
    )

  // ==========================================================
  // USER SEARCH
  // ==========================================================

  useEffect(() => {
    if (
      selectedUser
    ) {
      return
    }

    if (
      !canSearch
    ) {
      setSearchResults(
        []
      )

      setSearchTouched(
        false
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

          setError(
            null
          )

          try {
            const response =
              await fetch(
                `/api/admin/users/search?q=${encodeURIComponent(
                  normalizedSearchQuery
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
              throw new Error(
                getPayloadError(
                  payload,
                  `User search failed with status ${response.status}.`
                )
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

            setSearchResults(
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

            setSearchResults(
              []
            )

            setError(
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

              setSearchTouched(
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
    canSearch,
    normalizedSearchQuery,
    selectedUser,
  ])

  // ==========================================================
  // USER SELECTION
  // ==========================================================

  async function selectUser(
    user: AdminUserSearchResult
  ) {
    setSelectedUser(
      user
    )

    setDesignation(
      null
    )

    setSearchResults(
      []
    )

    setSearchTouched(
      false
    )

    setError(
      null
    )

    setNotice(
      null
    )

    setLoadingDesignation(
      true
    )

    try {
      const response =
        await fetch(
          `/api/admin/users/${encodeURIComponent(
            user.id
          )}/founding-tastemaker`,
          {
            method:
              'GET',

            cache:
              'no-store',
          }
        )

      const payload =
        (await response
          .json()
          .catch(
            () =>
              null
          )) as
          | FoundingTastemakerResponse
          | {
              error?: string
            }
          | null

      if (
        !response.ok
      ) {
        throw new Error(
          getPayloadError(
            payload,
            `Founding Tastemaker status lookup failed with status ${response.status}.`
          )
        )
      }

      if (
        !payload ||
        typeof payload !==
          'object' ||
        !(
          'user' in
          payload
        )
      ) {
        throw new Error(
          'Founding Tastemaker status returned an invalid response.'
        )
      }

      setDesignation(
        payload.user
      )
    } catch (
      statusError
    ) {
      setDesignation(
        null
      )

      setError(
        getErrorMessage(
          statusError
        )
      )
    } finally {
      setLoadingDesignation(
        false
      )
    }
  }

  function updateSearchQuery(
    value: string
  ) {
    setSearchQuery(
      value
    )

    setSearchTouched(
      false
    )

    setError(
      null
    )

    setNotice(
      null
    )

    if (
      selectedUser
    ) {
      setSelectedUser(
        null
      )

      setDesignation(
        null
      )
    }
  }

  function clearSelectedUser() {
    setSelectedUser(
      null
    )

    setDesignation(
      null
    )

    setSearchQuery(
      ''
    )

    setSearchResults(
      []
    )

    setSearchTouched(
      false
    )

    setError(
      null
    )

    setNotice(
      null
    )
  }

  // ==========================================================
  // DESIGNATION UPDATE
  // ==========================================================

  async function updateDesignation(
    designated: boolean
  ) {
    if (
      !selectedUser ||
      !designation
    ) {
      return
    }

    const userLabel =
      displayUserName(
        selectedUser
      )

    const confirmed =
      window.confirm(
        designated
          ? [
              `Designate ${userLabel} as a Founding Tastemaker?`,
              '',
              selectedUser.email
                ? `Email: ${selectedUser.email}`
                : null,
              `User ID: ${selectedUser.id}`,
              '',
              'Their creator hero will display “Founding Tastemaker” instead of “Roam Creator”.',
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
          : [
              `Remove the Founding Tastemaker designation from ${userLabel}?`,
              '',
              selectedUser.email
                ? `Email: ${selectedUser.email}`
                : null,
              `User ID: ${selectedUser.id}`,
              '',
              'Their creator hero will return to displaying “Roam Creator”.',
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

    setUpdatingDesignation(
      true
    )

    setError(
      null
    )

    setNotice(
      null
    )

    try {
      const response =
        await fetch(
          `/api/admin/users/${encodeURIComponent(
            selectedUser.id
          )}/founding-tastemaker`,
          {
            method:
              'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            cache:
              'no-store',

            body:
              JSON.stringify({
                designated,
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
          | FoundingTastemakerResponse
          | {
              error?: string
            }
          | null

      if (
        !response.ok
      ) {
        throw new Error(
          getPayloadError(
            payload,
            `Founding Tastemaker update failed with status ${response.status}.`
          )
        )
      }

      if (
        !payload ||
        typeof payload !==
          'object' ||
        !(
          'user' in
          payload
        )
      ) {
        throw new Error(
          'Founding Tastemaker update returned an invalid response.'
        )
      }

      setDesignation(
        payload.user
      )

      setNotice(
        designated
          ? 'Founding Tastemaker designation applied.'
          : 'Founding Tastemaker designation removed.'
      )
    } catch (
      updateError
    ) {
      setError(
        getErrorMessage(
          updateError
        )
      )
    } finally {
      setUpdatingDesignation(
        false
      )
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700/50 bg-[#0a1628] p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          Creator identity
        </p>

        <h2 className="text-xl font-semibold text-white">
          Founding Tastemaker designation
        </h2>

        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Find a creator by user ID, email, or full name, then explicitly
          designate or remove their Founding Tastemaker identity.
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

      {/* ====================================================
          USER SEARCH
      ===================================================== */}

      <div className="space-y-3">
        <AdminField label="Find user">
          <div className="relative">
            <input
              type="search"
              value={
                searchQuery
              }
              onChange={(
                event
              ) =>
                updateSearchQuery(
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
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
                …
              </div>
            )}
          </div>
        </AdminField>

        <p className="text-xs leading-5 text-slate-500">
          Search using the exact or partial email, profile full name, or
          user UUID. Select the correct person before changing their
          designation.
        </p>

        {!selectedUser &&
          canSearch &&
          searchTouched &&
          !searchingUsers &&
          !error &&
          searchResults.length ===
            0 && (
            <div className="rounded-xl border border-dashed border-slate-700 bg-[#0d1b2f] px-4 py-5 text-center">
              <p className="text-sm font-medium text-slate-300">
                No users found
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Try the exact email address, full name, or user UUID.
              </p>
            </div>
          )}

        {!selectedUser &&
          searchResults.length >
            0 && (
            <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-[#0d1b2f]">
              <div className="border-b border-slate-700/50 px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Matching users
                </p>
              </div>

              <div className="divide-y divide-slate-700/50">
                {searchResults.map(
                  (
                    user
                  ) => (
                    <button
                      key={
                        user.id
                      }
                      type="button"
                      onClick={() =>
                        void selectUser(
                          user
                        )
                      }
                      className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] active:bg-white/[0.06]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/15 bg-amber-400/10 text-sm font-semibold text-amber-200">
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
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {
                              user.email
                            }
                          </p>
                        )}

                        <p className="mt-1 break-all text-[11px] leading-4 text-slate-600">
                          {
                            user.id
                          }
                        </p>
                      </div>

                      <span className="mt-2 shrink-0 text-xs font-medium text-amber-300">
                        Select
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}
      </div>

      {/* ====================================================
          SELECTED USER
      ===================================================== */}

      {selectedUser && (
        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-sm font-semibold text-amber-200">
              {getUserInitial(
                selectedUser
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {selectedDisplayName}
                  </p>

                  {selectedUser.email && (
                    <p className="mt-1 break-all text-xs text-slate-400">
                      {
                        selectedUser.email
                      }
                    </p>
                  )}

                  <p className="mt-2 break-all text-[11px] leading-4 text-slate-600">
                    {
                      selectedUser.id
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    clearSelectedUser
                  }
                  className="shrink-0 text-xs font-medium text-slate-400 underline decoration-slate-600 underline-offset-4 transition hover:text-white"
                >
                  Choose another user
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          DESIGNATION STATUS
      ===================================================== */}

      {selectedUser &&
        loadingDesignation && (
          <div className="rounded-xl border border-slate-700/50 bg-[#0d1b2f] px-4 py-5 text-sm text-slate-400">
            Loading Founding Tastemaker status…
          </div>
        )}

      {selectedUser &&
        !loadingDesignation &&
        designation && (
          <div className="space-y-4 rounded-2xl border border-slate-700/50 bg-[#0d1b2f] p-4 sm:p-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Current designation
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={[
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold',

                    designation.isFoundingTastemaker
                      ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
                      : 'border-slate-700 bg-slate-800/70 text-slate-300',
                  ].join(
                    ' '
                  )}
                >
                  {designation.isFoundingTastemaker
                    ? 'Founding Tastemaker'
                    : 'Roam Creator'}
                </span>

                {designation.username && (
                  <span className="text-xs text-slate-500">
                    @{designation.username}
                  </span>
                )}
              </div>
            </div>

            {designation.isFoundingTastemaker &&
              designation.designatedAt && (
                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3">
                  <p className="text-xs text-slate-500">
                    Designated
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-200">
                    {formatAdminDate(
                      designation.designatedAt
                    )}
                  </p>
                </div>
              )}

            <div className="rounded-xl border border-slate-700/50 bg-[#0a1628] p-4 text-xs leading-5 text-slate-500">
              <p>
                This designation affects creator identity presentation only.
              </p>

              <p className="mt-2">
                It does not change creator eligibility, Passport XP,
                reputation, historical visits, Community Signals, City
                Market, or Scout.
              </p>
            </div>

            <button
              type="button"
              disabled={
                updatingDesignation
              }
              onClick={() =>
                void updateDesignation(
                  !designation
                    .isFoundingTastemaker
                )
              }
              className={[
                'inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',

                designation.isFoundingTastemaker
                  ? 'border border-red-900/70 bg-red-950/40 text-red-200 hover:bg-red-950/70'
                  : 'bg-amber-300 text-slate-950 hover:bg-amber-200',
              ].join(
                ' '
              )}
            >
              {updatingDesignation
                ? 'Updating designation…'
                : designation.isFoundingTastemaker
                  ? 'Remove Founding Tastemaker'
                  : 'Designate Founding Tastemaker'}
            </button>
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
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>

      {children}
    </label>
  )
}

function displayUserName(
  user: AdminUserSearchResult
): string {
  return (
    user.fullName?.trim() ||
    user.email?.trim() ||
    user.id
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

function formatAdminDate(
  value: string
): string {
  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    }
  ).format(
    date
  )
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

function getPayloadError(
  payload:
    | {
        error?: string
      }
    | object
    | null,
  fallback: string
): string {
  if (
    payload &&
    typeof payload ===
      'object' &&
    'error' in
      payload &&
    typeof payload.error ===
      'string'
  ) {
    return payload.error
  }

  return fallback
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