
'use client'

import {
  useEffect,
  useState,
} from 'react'
import Link from 'next/link'

type PropertyRow = {
  id: string
  name: string
  city: string
  slug: string
  address: string | null
  owner_user_id: string | null
  approved: boolean | null
  featured: boolean | null
  created_at: string
}

type InventoryResponse = {
  properties: PropertyRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  error?: string
}

type OwnershipFilter =
  | 'all'
  | 'assigned'
  | 'unassigned'

const PAGE_SIZE = 20

const CITY_LABELS: Record<string, string> = {
  atl: 'Atlanta',
  atlanta: 'Atlanta',
  nyc: 'New York City',
  'new york': 'New York City',
  'new york city': 'New York City',
  brooklyn: 'New York City',
  la: 'Los Angeles',
  'los angeles': 'Los Angeles',
  london: 'London',
  porto: 'Porto',
  lisbon: 'Lisbon',
}

function formatCity(value: string) {
  const city = value.trim().toLowerCase()

  return (
    CITY_LABELS[city] ??
    value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  )
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function HotelShorttermRental() {
  const [searchInput, setSearchInput] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [ownership, setOwnership] =
    useState<OwnershipFilter>('all')

  const [page, setPage] =
    useState(1)

  const [properties, setProperties] =
    useState<PropertyRow[]>([])

  const [total, setTotal] =
    useState(0)

  const [totalPages, setTotalPages] =
    useState(0)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [refreshKey, setRefreshKey] =
    useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchInput])

  useEffect(() => {
    const controller =
      new AbortController()

    async function loadProperties() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          ownership,
        })

        if (search) {
          params.set('search', search)
        }

        const response = await fetch(
          `/api/venue-admin/hotel-shortterm-rentals?${params.toString()}`,
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          }
        )

        const payload =
          (await response.json()) as InventoryResponse

        if (controller.signal.aborted) {
          return
        }

        if (!response.ok) {
          throw new Error(
            payload.error ??
              'Unable to load property inventory.'
          )
        }

        setProperties(
          Array.isArray(payload.properties)
            ? payload.properties
            : []
        )

        setTotal(payload.total ?? 0)
        setTotalPages(
          payload.totalPages ?? 0
        )
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setProperties([])
        setTotal(0)
        setTotalPages(0)

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load property inventory.'
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadProperties()

    return () => {
      controller.abort()
    }
  }, [search, ownership, page, refreshKey])

  const firstResult =
    total === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1

  const lastResult =
    Math.min(
      page * PAGE_SIZE,
      total
    )

  return (
    <div className="space-y-6">
      {/* ============================================= */}
      {/* Header                                        */}
      {/* ============================================= */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
            Property operations
          </p>

          <h3 className="mt-2 text-xl font-semibold text-white">
            Hotels & Short-Term Rentals
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Find and manage property guest guides,
            including historical properties without
            an assigned owner.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            setRefreshKey((value) => value + 1)
          }
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-[#0d1b2f] px-4 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 hover:bg-[#102039] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ============================================= */}
      {/* Search and ownership filter                   */}
      {/* ============================================= */}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-semibold text-slate-400">
            Search property name or city
          </span>

          <input
            type="search"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
            placeholder="FORTH Hotel, Atlanta, Porto..."
            className="min-h-12 w-full rounded-xl border border-slate-600 bg-[#0d1b2f] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-slate-400">
            Property ownership
          </span>

          <select
            value={ownership}
            onChange={(event) => {
              setOwnership(
                event.target.value as OwnershipFilter
              )
              setPage(1)
            }}
            className="min-h-12 w-full rounded-xl border border-slate-600 bg-[#0d1b2f] px-3 text-base text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
          >
            <option value="all">
              All properties
            </option>

            <option value="assigned">
              Owner assigned
            </option>

            <option value="unassigned">
              Unassigned
            </option>
          </select>
        </label>
      </div>

      {/* ============================================= */}
      {/* Inventory status                              */}
      {/* ============================================= */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          className="text-xs text-slate-500"
        >
          {loading
            ? 'Loading properties…'
            : `${firstResult}–${lastResult} of ${total} properties`}
        </p>

        <p className="text-xs text-slate-600">
          Editing opens the existing property editor.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-950/25 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      {/* ============================================= */}
      {/* Property inventory                           */}
      {/* ============================================= */}

      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-700/50 bg-[#0d1b2f] p-6 text-sm text-slate-400"
        >
          Loading hotel and short-term rental guides…
        </div>
      ) : !error && properties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0d1b2f] px-5 py-8">
          <p className="text-sm font-semibold text-white">
            No properties found
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Try a different name, city, or ownership filter.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/40 overflow-hidden rounded-2xl border border-slate-700/50 bg-[#0d1b2f]">
          {properties.map((property) => {
            const hasOwner =
              Boolean(property.owner_user_id)

            const guideHref =
              `/property/${encodeURIComponent(
                property.city
              )}/${encodeURIComponent(
                property.slug
              )}`

            const editHref =
              `/hosts/properties/${encodeURIComponent(
                property.id
              )}/edit`

            return (
              <article
                key={property.id}
                className="space-y-4 p-4 transition hover:bg-white/[0.025] sm:p-5"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="break-words text-base font-semibold text-white">
                      {property.name}
                    </h4>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {formatCity(property.city)}
                      {property.address
                        ? ` · ${property.address}`
                        : ''}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-600">
                      Created {formatDate(property.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={[
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        hasOwner
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                          : 'border-amber-400/20 bg-amber-400/10 text-amber-200',
                      ].join(' ')}
                    >
                      {hasOwner
                        ? 'Owner assigned'
                        : 'Unassigned'}
                    </span>

                    <span
                      className={[
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        property.approved
                          ? 'border-blue-400/20 bg-blue-400/10 text-blue-200'
                          : 'border-slate-600 bg-slate-800/50 text-slate-400',
                      ].join(' ')}
                    >
                      {property.approved
                        ? 'Approved'
                        : 'Not approved'}
                    </span>

                    {property.featured ? (
                      <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                        Featured
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={guideHref}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-600 bg-[#0a1628] px-4 text-xs font-semibold text-slate-200 transition hover:border-blue-400/40 hover:text-white"
                  >
                    Open guide →
                  </Link>

                  <Link
                    href={editHref}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-500 px-4 text-xs font-semibold text-white transition hover:bg-blue-400"
                  >
                    Edit property
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ============================================= */}
      {/* Pagination                                   */}
      {/* ============================================= */}

      {!loading &&
      !error &&
      totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() =>
              setPage((current) =>
                Math.max(1, current - 1)
              )
            }
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-600 bg-[#0d1b2f] px-4 text-sm font-semibold text-white transition hover:bg-[#102039] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((current) =>
                current + 1
              )
            }
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-600 bg-[#0d1b2f] px-4 text-sm font-semibold text-white transition hover:bg-[#102039] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-600">
        Property ownership and approval indicators
        are informational. This workspace does not
        change owners, approval decisions, or public
        guide URLs.
      </p>
    </div>
  )
}
