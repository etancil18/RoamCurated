
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

                {/* ==============================================
                    CONTEXT SLIDES — ADDITIVE INITIATIVE

                    Independent of existing venue editing.
                    Context slides follow their parent venue
                    when venue positions are changed.
                =============================================== */}

                <EditionContextSlidesPanel
                  editionId={editionId}
                  item={item}
                  editable={editable && !busy}
                />
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ============================================================
// CONTEXT SLIDES — ISOLATED VENUE-ATTACHED EDITOR
//
// This component does not change the existing Places panel
// state, venue-item endpoints, search, or reorder behavior.
//
// It uses:
//   GET    /context-slides?item_id=...
//   GET    /context-slides?item_id=...&include_media=true
//   POST   /context-slides
//   PATCH  /context-slides
//   DELETE /context-slides
//
// The API remains responsible for media eligibility,
// draft-only mutations, and all server authorization.
// ============================================================

type ContextImageSource =
  | 'none'
  | 'venue_cover'
  | 'creator_media'

type ContextSlide = {
  id: string
  edition_id: string
  after_item_id: string
  position: number
  heading: string | null
  body: string
  image_source: ContextImageSource
  creator_media_id: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

type ContextMediaOption = {
  id: string
  venue_id: string
  image_url: string
  caption: string | null
  alt_text: string | null
  width: number | null
  height: number | null
}

type ContextDraft = {
  slide_id: string | null
  heading: string
  body: string
  image_source: ContextImageSource
  creator_media_id: string | null
}

const EMPTY_CONTEXT_DRAFT: ContextDraft = {
  slide_id: null,
  heading: '',
  body: '',
  image_source: 'none',
  creator_media_id: null,
}

const CONTEXT_IMAGE_LABELS: Record<
  ContextImageSource,
  string
> = {
  none: 'Text only',
  venue_cover: 'Venue cover',
  creator_media: 'My tagged photo',
}

function contextDraftFromSlide(
  slide: ContextSlide,
): ContextDraft {
  return {
    slide_id: slide.id,
    heading: slide.heading ?? '',
    body: slide.body,
    image_source: slide.image_source,
    creator_media_id: slide.creator_media_id,
  }
}

function contextImageLabel(
  source: ContextImageSource,
): string {
  return CONTEXT_IMAGE_LABELS[source]
}

function EditionContextSlidesPanel({
  editionId,
  item,
  editable,
}: {
  editionId: string
  item: EditionItem
  editable: boolean
}) {
  const endpoint =
    `/api/venue-admin/editorial/${encodeURIComponent(
      editionId,
    )}/context-slides`

  const itemQuery =
    `item_id=${encodeURIComponent(item.id)}`

  const [slides, setSlides] = useState<
    ContextSlide[]
  >([])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [error, setError] = useState<
    string | null
  >(null)

  const [notice, setNotice] = useState<
    string | null
  >(null)

  const [draft, setDraft] = useState<
    ContextDraft | null
  >(null)

  const [mediaOptions, setMediaOptions] = useState<
    ContextMediaOption[]
  >([])

  const [loadingMedia, setLoadingMedia] =
    useState(false)

  const [mediaError, setMediaError] = useState<
    string | null
  >(null)

  // ----------------------------------------------------------
  // Load context slides for this specific venue item.
  // ----------------------------------------------------------

  useEffect(() => {
    const controller = new AbortController()

    async function loadContextSlides() {
      setLoading(true)
      setError(null)
      setNotice(null)
      setDraft(null)
      setSlides([])

      try {
        const response = await request<{
          slides: ContextSlide[]
        }>(
          `${endpoint}?${itemQuery}`,
          {
            signal: controller.signal,
          },
        )

        if (!controller.signal.aborted) {
          setSlides(
            (response.slides ?? [])
              .filter(
                (slide) =>
                  slide.after_item_id === item.id,
              )
              .sort(
                (a, b) =>
                  a.position - b.position,
              ),
          )
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            errorMessage(loadError),
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadContextSlides()

    return () => controller.abort()
  }, [endpoint, itemQuery, item.id])

  // ----------------------------------------------------------
  // Load eligible creator photographs only when the
  // context editor is using the creator-media option.
  //
  // The server decides which images are eligible.
  // This component never trusts arbitrary image URLs.
  // ----------------------------------------------------------

  const wantsCreatorMedia =
    draft?.image_source === 'creator_media'

  useEffect(() => {
    if (!wantsCreatorMedia) {
      setMediaOptions([])
      setLoadingMedia(false)
      setMediaError(null)
      return
    }

    const controller = new AbortController()

    async function loadEligibleMedia() {
      setLoadingMedia(true)
      setMediaError(null)
      setMediaOptions([])

      try {
        const response = await request<{
          slides: ContextSlide[]
          media: ContextMediaOption[]
        }>(
          `${endpoint}?${itemQuery}&include_media=true`,
          {
            signal: controller.signal,
          },
        )

        if (!controller.signal.aborted) {
          setMediaOptions(
            (response.media ?? []).filter(
              (media) =>
                media.venue_id === item.venue_id,
            ),
          )
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setMediaError(
            errorMessage(loadError),
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingMedia(false)
        }
      }
    }

    void loadEligibleMedia()

    return () => controller.abort()
  }, [
    endpoint,
    itemQuery,
    item.venue_id,
    wantsCreatorMedia,
  ])

  // ----------------------------------------------------------
  // Keep returned mutations scoped to the current venue.
  // The API returns the complete Edition context list.
  // ----------------------------------------------------------

  function applyContextSlides(
    nextSlides: ContextSlide[],
  ) {
    setSlides(
      nextSlides
        .filter(
          (slide) =>
            slide.after_item_id === item.id,
        )
        .sort(
          (a, b) =>
            a.position - b.position,
        ),
    )
  }

  function startNewContext() {
    if (!editable || busy || loading) return

    setDraft({
      ...EMPTY_CONTEXT_DRAFT,
    })

    setError(null)
    setNotice(null)
  }

  function editContext(
    slide: ContextSlide,
  ) {
    if (!editable || busy || loading) return

    setDraft(
      contextDraftFromSlide(slide),
    )

    setError(null)
    setNotice(null)
  }

  function closeContextEditor() {
    if (busy) return

    setDraft(null)
    setMediaError(null)
    setError(null)
  }

  function updateContextDraft<
    K extends keyof ContextDraft,
  >(
    key: K,
    value: ContextDraft[K],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    )

    setNotice(null)
  }

  function updateImageSource(
    source: ContextImageSource,
  ) {
    setDraft((current) => {
      if (!current) return current

      return {
        ...current,
        image_source: source,
        creator_media_id:
          source === 'creator_media'
            ? current.image_source ===
              'creator_media'
              ? current.creator_media_id
              : null
            : null,
      }
    })

    setError(null)
    setNotice(null)
  }

  // ----------------------------------------------------------
  // Create or update one context slide.
  // ----------------------------------------------------------

  async function saveContext(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !editable ||
      busy ||
      loading ||
      !draft
    ) {
      return
    }

    const body = draft.body.trim()
    const heading =
      draft.heading.trim() || null

    if (
      !body ||
      body.length > 1500 ||
      (heading && heading.length > 160)
    ) {
      setError(
        'Add a written perspective (1–1500 characters) and keep the optional heading within 160 characters.',
      )
      return
    }

    if (
      draft.image_source ===
        'creator_media' &&
      !draft.creator_media_id
    ) {
      setError(
        'Choose an eligible tagged photo, or select Venue cover or Text only.',
      )
      return
    }

    setBusy(true)
    setError(null)
    setNotice(null)

    const isEditing =
      draft.slide_id !== null

    const payload = isEditing
      ? {
          slide_id: draft.slide_id,
          heading,
          body,
          image_source:
            draft.image_source,
          creator_media_id:
            draft.image_source ===
            'creator_media'
              ? draft.creator_media_id
              : null,
        }
      : {
          after_item_id: item.id,
          heading,
          body,
          image_source:
            draft.image_source,
          creator_media_id:
            draft.image_source ===
            'creator_media'
              ? draft.creator_media_id
              : null,
        }

    try {
      const response = await request<{
        slides: ContextSlide[]
      }>(endpoint, {
        method:
          isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })

      applyContextSlides(
        response.slides ?? [],
      )

      setDraft(null)

      setNotice(
        isEditing
          ? 'Context slide saved.'
          : 'Context slide added after this venue.',
      )
    } catch (saveError) {
      setError(
        errorMessage(saveError),
      )
    } finally {
      setBusy(false)
    }
  }

  // ----------------------------------------------------------
  // Delete one context slide only.
  // The parent venue remains untouched.
  // ----------------------------------------------------------

  async function removeContext(
    slide: ContextSlide,
  ) {
    if (!editable || busy || loading) return

    const confirmed = window.confirm(
      'Remove this context slide? The venue slide will remain in the Edition.',
    )

    if (!confirmed) return

    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        slides: ContextSlide[]
      }>(endpoint, {
        method: 'DELETE',
        body: JSON.stringify({
          slide_id: slide.id,
        }),
      })

      applyContextSlides(
        response.slides ?? [],
      )

      if (draft?.slide_id === slide.id) {
        setDraft(null)
      }

      setNotice('Context slide removed.')
    } catch (removeError) {
      setError(
        errorMessage(removeError),
      )
    } finally {
      setBusy(false)
    }
  }

  const editorDisabled =
    !editable || busy || loading

  const selectedMedia =
    mediaOptions.find(
      (media) =>
        media.id ===
        draft?.creator_media_id,
    ) ?? null

  return (
    <div className="mt-5 space-y-3 border-t border-[#d2ab86]/20 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d2ab86]">
            Between the places
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Add written context immediately after
            this venue slide.
          </p>
        </div>

        {editable && (
          <button
            type="button"
            disabled={
              editorDisabled ||
              draft !== null ||
              slides.length >= 12
            }
            onClick={startNewContext}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d2ab86]/40 px-3 py-2 text-xs font-semibold text-[#e6c6a5] transition hover:border-[#d2ab86] hover:bg-[#d2ab86]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add Context After
          </button>
        )}
      </div>

      {loading && (
        <p
          role="status"
          className="text-xs text-slate-500"
        >
          Loading context slides…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-xs leading-5 text-red-200"
        >
          {error}
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="text-xs text-emerald-300"
        >
          {notice}
        </p>
      )}

      {!loading &&
        slides.length === 0 &&
        !draft && (
          <p className="text-xs text-slate-500">
            No additional context slides.
          </p>
        )}

      {/* ======================================================
          EXISTING CONTEXT SLIDES
      ====================================================== */}

      {!loading &&
        slides.map((slide, index) => (
          <div
            key={slide.id}
            className="rounded-xl border border-[#d2ab86]/20 bg-[#0a1628] p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d2ab86]">
                  Context {index + 1}
                </p>

                {slide.heading && (
                  <p className="mt-2 break-words text-sm font-semibold text-white">
                    {slide.heading}
                  </p>
                )}

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                  {slide.body}
                </p>

                <p className="mt-3 text-[11px] text-slate-500">
                  {contextImageLabel(
                    slide.image_source,
                  )}
                  {slide.image_source ===
                    'creator_media' &&
                    !slide.image_url
                    ? ' · Photo currently unavailable'
                    : ''}
                </p>
              </div>

              {editable && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      editorDisabled ||
                      draft !== null
                    }
                    onClick={() =>
                      editContext(slide)
                    }
                    className="rounded-lg border border-blue-400/30 px-3 py-2 text-xs text-blue-200 transition hover:border-blue-400/60 disabled:opacity-40"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={
                      editorDisabled ||
                      draft !== null
                    }
                    onClick={() =>
                      void removeContext(slide)
                    }
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 transition hover:border-red-400/60 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {slide.image_source ===
              'creator_media' &&
              slide.image_url && (
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                  <img
                    src={slide.image_url}
                    alt={
                      slide.heading ||
                      `Creator photograph for ${item.venue_name}`
                    }
                    loading="lazy"
                    className="max-h-44 w-full object-cover"
                  />
                </div>
              )}

            {slide.image_source ===
              'venue_cover' &&
              item.venue_cover_url && (
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                  <img
                    src={item.venue_cover_url}
                    alt={item.venue_name}
                    loading="lazy"
                    className="max-h-44 w-full object-cover"
                  />
                </div>
              )}
          </div>
        ))}

      {/* ======================================================
          CREATE / EDIT CONTEXT SLIDE
      ====================================================== */}

      {editable && draft && (
        <form
          onSubmit={(event) =>
            void saveContext(event)
          }
          className="space-y-4 rounded-xl border border-[#d2ab86]/30 bg-[#101b2b] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d2ab86]">
                {draft.slide_id
                  ? 'Edit context'
                  : 'New context'}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                This page will follow{' '}
                <span className="font-semibold text-white">
                  {item.venue_name}
                </span>
                .
              </p>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={closeContextEditor}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:border-slate-400 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-slate-300">
              Heading (optional)
            </span>

            <input
              maxLength={160}
              value={draft.heading}
              onChange={(event) =>
                updateContextDraft(
                  'heading',
                  event.target.value,
                )
              }
              placeholder="What makes this place memorable"
              className={INPUT_CLASS}
              disabled={editorDisabled}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-slate-300">
              Written perspective
            </span>

            <textarea
              required
              maxLength={1500}
              rows={7}
              value={draft.body}
              onChange={(event) =>
                updateContextDraft(
                  'body',
                  event.target.value,
                )
              }
              placeholder="Share the atmosphere, the details worth noticing, or the personal perspective behind including this place."
              className={INPUT_CLASS}
              disabled={editorDisabled}
            />

            <span className="block text-right text-[11px] text-slate-500">
              {draft.body.length}/1500
            </span>
          </label>

          {/* ==================================================
              CONTEXT IMAGE SOURCE
          ================================================== */}

          <fieldset
            disabled={editorDisabled}
            className="space-y-3 disabled:opacity-60"
          >
            <legend className="text-xs font-medium text-slate-300">
              Context slide image
            </legend>

            <p className="text-xs leading-5 text-slate-500">
              Use just the writing, the official venue
              cover, or an eligible photo tagged to
              this exact venue.
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  'none',
                  'venue_cover',
                  'creator_media',
                ] as const
              ).map((source) => {
                const selected =
                  draft.image_source === source

                return (
                  <label
                    key={source}
                    className={[
                      'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition',
                      selected
                        ? 'border-[#d2ab86] bg-[#d2ab86]/10 text-[#f0d2b1]'
                        : 'border-slate-600 text-slate-300 hover:border-slate-400',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name={`context-image-${item.id}`}
                      checked={selected}
                      onChange={() =>
                        updateImageSource(source)
                      }
                      disabled={
                        editorDisabled ||
                        (
                          source ===
                            'venue_cover' &&
                          !item.venue_cover_url
                        )
                      }
                      className="accent-[#d2ab86]"
                    />

                    <span>
                      {contextImageLabel(source)}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {draft.image_source ===
            'venue_cover' && (
            <div className="rounded-lg border border-slate-700/70 p-3">
              {item.venue_cover_url ? (
                <div className="flex items-center gap-3">
                  <img
                    src={item.venue_cover_url}
                    alt={item.venue_name}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />

                  <p className="text-xs leading-5 text-slate-300">
                    The existing canonical cover photo
                    for {item.venue_name} will be used.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-200">
                  This venue does not currently have a
                  canonical cover photo. Choose Text only.
                </p>
              )}
            </div>
          )}

          {/* ==================================================
              ELIGIBLE CREATOR PHOTOGRAPH PICKER
          ================================================== */}

          {draft.image_source ===
            'creator_media' && (
            <div className="space-y-3 rounded-lg border border-slate-700/70 bg-[#0a1628] p-3">
              <p className="text-xs font-medium text-white">
                Photos tagged to {item.venue_name}
              </p>

              {loadingMedia && (
                <p
                  role="status"
                  className="text-xs text-slate-400"
                >
                  Loading eligible photos…
                </p>
              )}

              {mediaError && (
                <p
                  role="alert"
                  className="text-xs leading-5 text-red-300"
                >
                  {mediaError}
                </p>
              )}

              {!loadingMedia &&
                !mediaError &&
                mediaOptions.length === 0 && (
                  <p className="text-xs leading-5 text-slate-400">
                    No eligible creator photos are available
                    for this venue and Edition. You can
                    use the venue cover or a text-only page.
                  </p>
                )}

              {!loadingMedia &&
                mediaOptions.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {mediaOptions.map((media) => {
                      const selected =
                        draft.creator_media_id ===
                        media.id

                      return (
                        <label
                          key={media.id}
                          className={[
                            'cursor-pointer overflow-hidden rounded-lg border transition',
                            selected
                              ? 'border-[#d2ab86] ring-1 ring-[#d2ab86]'
                              : 'border-slate-600 hover:border-slate-400',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name={`context-photo-${item.id}`}
                            checked={selected}
                            disabled={editorDisabled}
                            onChange={() =>
                              updateContextDraft(
                                'creator_media_id',
                                media.id,
                              )
                            }
                            className="sr-only"
                          />

                          <img
                            src={media.image_url}
                            alt={
                              media.alt_text ||
                              media.caption ||
                              `Photo of ${item.venue_name}`
                            }
                            loading="lazy"
                            className="aspect-[4/5] w-full object-cover"
                          />

                          <span className="flex items-center justify-between gap-2 px-2 py-2 text-[11px] text-slate-300">
                            <span className="truncate">
                              {media.caption ||
                                'Tagged photo'}
                            </span>

                            {selected && (
                              <span
                                className="font-semibold text-[#d2ab86]"
                                aria-label="Selected"
                              >
                                ✓
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}

              {draft.creator_media_id &&
                !selectedMedia &&
                !loadingMedia && (
                  <p className="text-xs leading-5 text-amber-200">
                    The previously selected photo is no
                    longer available in the eligible
                    choices. Select another photo or
                    change the image source.
                  </p>
                )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-700/60 pt-4">
            <button
              type="submit"
              disabled={
                editorDisabled ||
                !draft.body.trim() ||
                (
                  draft.image_source ===
                    'creator_media' &&
                  (
                    loadingMedia ||
                    !selectedMedia
                  )
                ) ||
                (
                  draft.image_source ===
                    'venue_cover' &&
                  !item.venue_cover_url
                )
              }
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#d2ab86] px-4 text-xs font-semibold text-[#102337] transition hover:bg-[#e3bd9b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? 'Saving context…'
                : draft.slide_id
                  ? 'Save context'
                  : 'Add context slide'}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={closeContextEditor}
              className="min-h-11 rounded-lg border border-slate-600 px-4 text-xs font-semibold text-slate-300 hover:border-slate-400 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!editable &&
        !loading &&
        slides.length > 0 && (
          <p className="text-[11px] leading-5 text-slate-500">
            Context slides are read-only outside
            draft status.
          </p>
        )}
    </div>
  )
}
