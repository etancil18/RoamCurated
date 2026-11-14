
'use client'

import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  normalizeCityKey,
  getCityLabel,
} from '@/lib/cities/normalizeCity'

type VenueSearchResult = {
  id: string
  name: string
  city: string | null
  matched_on?: string | null
}

type EditionItem = {
  id: string
  edition_id: string
  venue_id: string
  source_collection_item_id: string | null
  origin: 'creator_collection' | 'admin_added'
  position: number
  display_title: string | null
  editorial_blurb: string | null
  badge: string | null
  image_override_url: string | null
  venue_name: string
  venue_city: string | null
  venue_cover_url: string | null
  image_url: string | null
}

type ItemCopy = {
  display_title: string
  editorial_blurb: string
  badge: string
}

type Props = {
  editionId: string
  editable: boolean
  city: string | null
}

const INPUT_CLASS =
  'min-h-11 w-full rounded-xl border border-slate-600 bg-[#0d1b2f] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-60'

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
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

  const payload: unknown = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      throw new Error(payload.error)
    }

    throw new Error(
      `Request failed (${response.status}).`,
    )
  }

  return payload as T
}

function copyFromItem(item: EditionItem): ItemCopy {
  return {
    display_title: item.display_title ?? '',
    editorial_blurb: item.editorial_blurb ?? '',
    badge: item.badge ?? '',
  }
}

export default function RoamEditionPlacesPanel({
  editionId,
  editable,
  city,
}: Props) {
  const endpoint =
    `/api/venue-admin/editorial/${encodeURIComponent(
      editionId,
    )}/items`

  const cityKey = normalizeCityKey(city)
  const cityLabel = getCityLabel(city) ?? 'this city'

  const [items, setItems] = useState<EditionItem[]>([])
  const [copies, setCopies] = useState<
    Record<string, ItemCopy>
  >({})

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    VenueSearchResult[]
  >([])

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [searchError, setSearchError] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)
  const [notice, setNotice] =
    useState<string | null>(null)

  const [activeCopyId, setActiveCopyId] =
    useState<string | null>(null)

  function applyItems(nextItems: EditionItem[]) {
    setItems(nextItems)
    setCopies(
      Object.fromEntries(
        nextItems.map((item) => [
          item.id,
          copyFromItem(item),
        ]),
      ),
    )
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await request<{
          items: EditionItem[]
        }>(endpoint, {
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          applyItems(response.items ?? [])
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

  useEffect(() => {
    const normalized = query.trim()

    if (!cityKey || normalized.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError(null)

      try {
        // Reuse the same city-scoped Explore search as Hosts.
        const params = new URLSearchParams({
          city: cityKey,
          q: normalized,
          sort: 'relevance',
          page: '1',
          limit: '20',
        })

        const response = await request<{
          venues: VenueSearchResult[]
        }>(
          `/api/explore/venues?${params.toString()}`,
          { signal: controller.signal },
        )

        if (!controller.signal.aborted) {
          setResults(response.venues ?? [])
        }
      } catch (searchFailure) {
        if (!controller.signal.aborted) {
          setResults([])
          setSearchError(errorMessage(searchFailure))
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, cityKey])

  async function addVenue(venueId: string) {
    if (!editable || busy) return

    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        items: EditionItem[]
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ venue_id: venueId }),
      })

      applyItems(response.items)
      setQuery('')
      setResults([])
      setNotice('Venue added to this edition.')
    } catch (addError) {
      setError(errorMessage(addError))
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(item: EditionItem) {
    if (!editable || busy) return

    const confirmed = window.confirm(
      `Remove "${item.venue_name}" from this edition?`,
    )

    if (!confirmed) return

    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        items: EditionItem[]
      }>(endpoint, {
        method: 'DELETE',
        body: JSON.stringify({ item_id: item.id }),
      })

      applyItems(response.items)
      setNotice('Venue removed from the edition.')
    } catch (removeError) {
      setError(errorMessage(removeError))
    } finally {
      setBusy(false)
    }
  }

  async function moveItem(
    index: number,
    direction: -1 | 1,
  ) {
    if (!editable || busy) return

    const destination = index + direction

    if (destination < 0 || destination >= items.length) {
      return
    }

    const reordered = [...items]

    const [moved] = reordered.splice(index, 1)
    reordered.splice(destination, 0, moved)

    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      await request<{ success: boolean }>(
        `${endpoint}/reorder`,
        {
          method: 'POST',
          body: JSON.stringify({
            item_ids: reordered.map((item) => item.id),
          }),
        },
      )

      setItems(
        reordered.map((item, position) => ({
          ...item,
          position,
        })),
      )

      setNotice('Venue order updated.')
    } catch (moveError) {
      setError(errorMessage(moveError))
    } finally {
      setBusy(false)
    }
  }

  function updateCopy(
    itemId: string,
    key: keyof ItemCopy,
    value: string,
  ) {
    setCopies((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        [key]: value,
      },
    }))
    setNotice(null)
  }

  async function saveCopy(
    event: FormEvent<HTMLFormElement>,
    itemId: string,
  ) {
    event.preventDefault()

    if (!editable || busy) return

    const copy = copies[itemId]
    if (!copy) return

    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        items: EditionItem[]
      }>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({
          item_id: itemId,
          display_title:
            copy.display_title.trim() || null,
          editorial_blurb:
            copy.editorial_blurb.trim() || null,
          badge:
            copy.badge.trim() || null,
        }),
      })

      applyItems(response.items)
      setActiveCopyId(null)
      setNotice('Venue editorial copy saved.')
    } catch (saveError) {
      setError(errorMessage(saveError))
    } finally {
      setBusy(false)
    }
  }

  const selectedVenueIds = new Set(
    items.map((item) => item.venue_id),
  )

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Editorial lineup
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-white">
            Places
          </h3>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
            {items.length} selected
          </span>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose the canonical Roam venues for this story,
          arrange their sequence, and write the short
          editorial copy that will appear on each slide.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200"
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

      {editable && (
        <div className="space-y-3 rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-slate-300">
              Search official venues
              {cityKey ? ` in ${cityLabel}` : ''}
            </span>

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder={
                cityKey
                  ? 'Try cozy, coffee, gallery, rooftop…'
                  : 'Select and save an edition city first'
              }
              className={INPUT_CLASS}
              disabled={busy || !cityKey}
            />
          </label>

          {!cityKey && (
            <p className="text-xs text-amber-300">
              Select a city in the Story editor and save the
              edition to enable venue search.
            </p>
          )}

          {searching && (
            <p className="text-xs text-slate-400">
              Searching venues…
            </p>
          )}

          {searchError && (
            <p className="text-xs text-red-300">
              {searchError}
            </p>
          )}

          {cityKey &&
            query.trim().length >= 2 &&
            !searching &&
            results.length === 0 &&
            !searchError && (
              <p className="text-xs text-slate-500">
                No matching venues.
              </p>
            )}

          {results.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {results.map((venue) => {
                const selected =
                  selectedVenueIds.has(venue.id)

                return (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/60 bg-[#0a1628] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {venue.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {venue.city ?? 'City unspecified'}
                      </p>

                      {venue.matched_on && (
                        <p className="mt-1 text-[11px] text-cyan-300/80">
                          Matched by {venue.matched_on}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={busy || selected}
                      onClick={() =>
                        void addVenue(venue.id)
                      }
                      className="shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {selected ? 'Added' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">
          Loading edition places…
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
          <p className="text-sm font-semibold text-white">
            No places selected yet
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Search for a venue above to begin building
            your social lineup.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const copy =
              copies[item.id] ?? copyFromItem(item)

            const editing =
              activeCopyId === item.id

            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-sm font-bold text-blue-200">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {item.display_title ||
                        item.venue_name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {item.venue_name}
                      {item.venue_city
                        ? ` · ${item.venue_city}`
                        : ''}
                    </p>

                    {item.editorial_blurb && !editing && (
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {item.editorial_blurb}
                      </p>
                    )}

                    {item.badge && !editing && (
                      <span className="mt-2 inline-block rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-200">
                        {item.badge}
                      </span>
                    )}

                    <p className="mt-2 text-[11px] text-slate-500">
                      {item.image_url
                        ? 'Venue image available'
                        : 'Image needed before export'}
                    </p>
                  </div>
                </div>

                {editable && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-700/50 pt-3">
                    <button
                      type="button"
                      disabled={busy || index === 0}
                      onClick={() =>
                        void moveItem(index, -1)
                      }
                      className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 disabled:opacity-35"
                    >
                      Move up
                    </button>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        index === items.length - 1
                      }
                      onClick={() =>
                        void moveItem(index, 1)
                      }
                      className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 disabled:opacity-35"
                    >
                      Move down
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setActiveCopyId(
                          editing ? null : item.id,
                        )
                      }
                      className="rounded-lg border border-blue-400/30 px-3 py-2 text-xs text-blue-200 disabled:opacity-40"
                    >
                      {editing ? 'Close editor' : 'Edit copy'}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void removeItem(item)
                      }
                      className="ml-auto rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {editable && editing && (
                  <form
                    onSubmit={(event) =>
                      void saveCopy(event, item.id)
                    }
                    className="mt-4 space-y-4 rounded-xl border border-slate-700 bg-[#0a1628] p-4"
                  >
                    <label className="block space-y-2">
                      <span className="text-xs text-slate-300">
                        Display title
                      </span>

                      <input
                        maxLength={160}
                        value={copy.display_title}
                        onChange={(event) =>
                          updateCopy(
                            item.id,
                            'display_title',
                            event.target.value,
                          )
                        }
                        placeholder={item.venue_name}
                        className={INPUT_CLASS}
                        disabled={busy}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs text-slate-300">
                        Why it belongs in this edition
                      </span>

                      <textarea
                        maxLength={600}
                        rows={3}
                        value={copy.editorial_blurb}
                        onChange={(event) =>
                          updateCopy(
                            item.id,
                            'editorial_blurb',
                            event.target.value,
                          )
                        }
                        placeholder="A warm corner worth lingering in."
                        className={INPUT_CLASS}
                        disabled={busy}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs text-slate-300">
                        Optional badge
                      </span>

                      <input
                        maxLength={80}
                        value={copy.badge}
                        onChange={(event) =>
                          updateCopy(
                            item.id,
                            'badge',
                            event.target.value,
                          )
                        }
                        placeholder="Cozy favorite"
                        className={INPUT_CLASS}
                        disabled={busy}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-10 rounded-lg bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {busy ? 'Saving…' : 'Save venue copy'}
                    </button>
                  </form>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
