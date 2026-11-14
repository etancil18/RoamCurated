
'use client'

import { useEffect, useState } from 'react'

type CreditMode =
  | 'creator_edit'
  | 'roam_x_creator'
  | 'roam_selects'

type PermissionStatus =
  | 'not_requested'
  | 'approved'
  | 'declined'

type CreatorOption = {
  id: string
  username: string | null
  full_name: string | null
}

type Attribution = {
  id: string
  status: string
  edition_type: string
  credit_mode: CreditMode
  creator_permission_status: PermissionStatus
  creator_permission_recorded_at: string | null
  featured_creator_id: string | null
  source_collection_id: string | null
  creator: {
    id: string
    username: string | null
    full_name: string | null
  } | null
  source_collection: {
    id: string
    title: string
    slug: string
  } | null
}

type Props = {
  editionId: string
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong.'
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const body: unknown = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      throw new Error(body.error)
    }

    throw new Error(`Request failed (${response.status}).`)
  }

  return body as T
}

function formatTimestamp(value: string | null) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const SELECT_CLASS =
  'min-h-11 w-full rounded-xl border border-slate-600 bg-[#0d1b2f] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50'

export default function RoamEditionAttributionPanel({
  editionId,
}: Props) {
  const [attribution, setAttribution] =
    useState<Attribution | null>(null)

  const [creditMode, setCreditMode] =
    useState<CreditMode>('roam_selects')

  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>('not_requested')

  // Manual featured creator selection.
  const [featuredCreatorId, setFeaturedCreatorId] =
    useState<string | null>(null)

  const [selectedCreator, setSelectedCreator] =
    useState<CreatorOption | null>(null)

  const [creatorSearch, setCreatorSearch] =
    useState('')

  const [creatorResults, setCreatorResults] =
    useState<CreatorOption[]>([])

  const [searchingCreators, setSearchingCreators] =
    useState(false)

  const [creatorSearchError, setCreatorSearchError] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [notice, setNotice] =
    useState<string | null>(null)

  const endpoint =
    `/api/venue-admin/editorial/${encodeURIComponent(
      editionId,
    )}/attribution`

  function applyAttribution(next: Attribution) {
    setAttribution(next)
    setCreditMode(next.credit_mode)
    setPermissionStatus(
      next.creator_permission_status,
    )

    // Keep manual selection synchronized with saved attribution.
    setFeaturedCreatorId(next.featured_creator_id)
    setSelectedCreator(next.creator)
    setCreatorSearch('')
    setCreatorResults([])
    setCreatorSearchError(null)
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await request<{
          attribution: Attribution
        }>(endpoint, {
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          applyAttribution(response.attribution)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(errorMessage(loadError))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [endpoint])

  // Search existing Roam users without importing a collection.
  useEffect(() => {
    const query = creatorSearch.trim()
    const controller = new AbortController()

    if (
      query.length < 2 ||
      attribution?.status !== 'draft'
    ) {
      setCreatorResults([])
      setSearchingCreators(false)
      setCreatorSearchError(null)
      return () => controller.abort()
    }

    setSearchingCreators(true)
    setCreatorResults([])
    setCreatorSearchError(null)

    const timeout = window.setTimeout(async () => {
      try {
        const response = await request<{
          creators: CreatorOption[]
        }>(
          `/api/venue-admin/editorial/creators/search?query=${encodeURIComponent(
            query,
          )}`,
          {
            signal: controller.signal,
          },
        )

        if (!controller.signal.aborted) {
          setCreatorResults(response.creators)
        }
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setCreatorSearchError(errorMessage(searchError))
          setCreatorResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchingCreators(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [creatorSearch, attribution?.status])

  async function saveAttribution() {
    if (
      !attribution ||
      attribution.status !== 'draft' ||
      saving
    ) {
      return
    }

    const creatorChanged =
      featuredCreatorId !==
      attribution.featured_creator_id

    const approving =
      permissionStatus === 'approved' &&
      (
        attribution.creator_permission_status !==
          'approved' ||
        creatorChanged
      )

    if (approving) {
      const confirmed = window.confirm(
        'Confirm that you have obtained the creator’s permission for the intended promotional use and have retained supporting documentation outside Roam. Continue?',
      )

      if (!confirmed) return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        attribution: Attribution
      }>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({
          credit_mode: creditMode,
          creator_permission_status: permissionStatus,
          permission_confirmed: approving,
          ...(creatorChanged
            ? { featured_creator_id: featuredCreatorId }
            : {}),
        }),
      })

      applyAttribution(response.attribution)
      setNotice('Attribution settings saved.')
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const linkedCreator =
    Boolean(featuredCreatorId)

  const editable =
    attribution?.status === 'draft'

  const creatorChanged =
    attribution !== null &&
    attribution.featured_creator_id !==
      featuredCreatorId

  const dirty =
    attribution !== null &&
    (
      attribution.credit_mode !== creditMode ||
      attribution.creator_permission_status !==
        permissionStatus ||
      creatorChanged
    )

  const creatorName =
    selectedCreator?.full_name ||
    selectedCreator?.username ||
    'Creator not linked'

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Editorial governance
        </p>

        <h3 className="mt-2 text-xl font-semibold text-white">
          Attribution &amp; Permissions
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Control how the original creator is credited
          and record the permission decision separately
          from collection importing.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-200"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">
          Loading attribution settings…
        </p>
      ) : !attribution ? (
        <p className="text-sm text-slate-400">
          Attribution settings are unavailable.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Featured creator
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                {creatorName}
              </p>

              {selectedCreator?.username && (
                <p className="mt-1 text-xs text-cyan-300">
                  @{selectedCreator.username}
                </p>
              )}

              {creatorChanged && (
                <p className="mt-2 text-xs text-amber-200">
                  Unsaved creator selection
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Source collection
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                {attribution.source_collection?.title ??
                  'No collection linked'}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {attribution.source_collection_id
                  ? 'Original collection reference retained'
                  : 'Import a collection to establish a source'}
              </p>
            </div>
          </div>

          {/* Manual creator selection — independent of collection importing. */}
          <div className="space-y-3 rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Manually select featured creator
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Search the existing Roam user pool and
                assign a featured creator without importing
                a collection or changing this edition's venues.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Search users
              </span>

              <input
                type="search"
                value={creatorSearch}
                onChange={(event) => {
                  setCreatorSearch(event.target.value)
                  setNotice(null)
                }}
                placeholder="Search name or @username..."
                disabled={!editable || saving}
                autoComplete="off"
                className={SELECT_CLASS}
              />
            </label>

            {editable && creatorSearch.trim().length >= 2 && (
              <div className="space-y-2">
                {searchingCreators && (
                  <p className="text-xs text-slate-400">
                    Searching Roam users…
                  </p>
                )}

                {creatorSearchError && (
                  <p
                    role="alert"
                    className="text-xs text-red-300"
                  >
                    {creatorSearchError}
                  </p>
                )}

                {!searchingCreators &&
                  !creatorSearchError &&
                  creatorResults.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No matching users found.
                    </p>
                  )}

                {!searchingCreators &&
                  creatorResults.length > 0 && (
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-700/60 p-2">
                      {creatorResults.map((creator) => {
                        const isSelected =
                          featuredCreatorId === creator.id

                        return (
                          <button
                            key={creator.id}
                            type="button"
                            onClick={() => {
                              const changingCreator =
                                featuredCreatorId !==
                                creator.id

                              setFeaturedCreatorId(creator.id)
                              setSelectedCreator(creator)

                              if (changingCreator) {
                                setPermissionStatus(
                                  'not_requested',
                                )
                              }

                              setCreatorSearch('')
                              setCreatorResults([])
                              setCreatorSearchError(null)
                              setNotice(null)
                            }}
                            disabled={saving}
                            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              isSelected
                                ? 'border-cyan-400/40 bg-cyan-400/10'
                                : 'border-transparent hover:border-slate-600 hover:bg-slate-800/70'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-white">
                                {creator.full_name ||
                                  creator.username ||
                                  'Unnamed user'}
                              </span>

                              {creator.username && (
                                <span className="mt-1 block truncate text-xs text-cyan-300">
                                  @{creator.username}
                                </span>
                              )}
                            </span>

                            {isSelected && (
                              <span className="shrink-0 text-xs font-semibold text-cyan-300">
                                Selected
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
              </div>
            )}

            {linkedCreator && (
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Selected for attribution
                </p>

                <p className="mt-2 text-sm font-semibold text-white">
                  {creatorName}
                </p>

                {selectedCreator?.username && (
                  <p className="mt-1 text-xs text-cyan-300">
                    @{selectedCreator.username}
                  </p>
                )}

                {creatorChanged && (
                  <p className="mt-2 text-xs text-amber-200">
                    Save attribution &amp; permissions to
                    apply this creator to the edition.
                  </p>
                )}
              </div>
            )}

            {creatorChanged && (
              <p className="text-xs leading-5 text-amber-200">
                Changing the featured creator resets the
                pending permission selection to Not requested.
                Permission for the new creator must be
                recorded separately.
              </p>
            )}
          </div>

          {!linkedCreator && (
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">
              No featured creator is linked to this edition.
              Import an eligible creator collection or
              manually select a Roam user to enable
              creator-specific attribution and permission
              controls.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Credit format
              </span>

              <select
                value={creditMode}
                onChange={(event) => {
                  setCreditMode(
                    event.target.value as CreditMode,
                  )
                  setNotice(null)
                }}
                disabled={
                  !editable ||
                  !linkedCreator ||
                  saving
                }
                className={SELECT_CLASS}
              >
                <option value="roam_selects">
                  Roam Selects
                </option>

                <option value="creator_edit">
                  Creator Edit
                </option>

                <option value="roam_x_creator">
                  Roam × Creator
                </option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Creator permission
              </span>

              <select
                value={permissionStatus}
                onChange={(event) => {
                  setPermissionStatus(
                    event.target.value as PermissionStatus,
                  )
                  setNotice(null)
                }}
                disabled={
                  !editable ||
                  !linkedCreator ||
                  saving
                }
                className={SELECT_CLASS}
              >
                <option value="not_requested">
                  Not requested
                </option>

                <option value="approved">
                  Approved
                </option>

                <option value="declined">
                  Declined
                </option>
              </select>
            </label>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
            <p className="text-xs font-semibold text-slate-200">
              Permission record
            </p>

            <p className="text-xs leading-5 text-slate-400">
              Saved status:{' '}
              <span className="font-semibold text-slate-200">
                {attribution.creator_permission_status.replaceAll(
                  '_',
                  ' ',
                )}
              </span>
            </p>

            <p className="text-xs leading-5 text-slate-400">
              Recorded at:{' '}
              {formatTimestamp(
                attribution.creator_permission_recorded_at,
              ) ?? 'Not recorded'}
            </p>

            <p className="text-xs leading-5 text-slate-500">
              This records an administrative permission
              decision. It does not store a signed agreement
              or other evidence of consent. Keep supporting
              documentation separately.
            </p>
          </div>

          {editable && linkedCreator && (
            <button
              type="button"
              onClick={() => void saveAttribution()}
              disabled={!dirty || saving}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? 'Saving attribution…'
                : 'Save attribution & permissions'}
            </button>
          )}

          {!editable && (
            <p className="text-xs text-amber-200">
              Attribution settings are read-only because
              this edition is no longer a draft.
            </p>
          )}
        </>
      )}
    </section>
  )
}
