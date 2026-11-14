
'use client'

import { useEffect, useState } from 'react'

type Creator = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

type CreatorCollection = {
  id: string
  user_id: string
  title: string
  slug: string
  description: string | null
  city: string | null
  cover_image_url: string | null
  creator: Creator
}

type PreviewItem = {
  source_collection_item_id: string
  venue_id: string
  venue_name: string
  venue_city: string | null
  display_title: string
  creator_note: string | null
  image_url: string | null
  sort_order: number
}

type PreviewResponse = {
  collection: CreatorCollection
  items: PreviewItem[]
  total_source_items: number
  eligible_venue_count: number
  omitted_item_count: number
}

type Props = {
  editionId: string
  city: string | null
  editable: boolean
  onImported: () => void
}

async function getJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
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

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong.'
}

export default function RoamEditionCreatorSourcePanel({
  editionId,
  city,
  editable,
  onImported,
}: Props) {
  const [query, setQuery] = useState('')
  const [collections, setCollections] = useState<
    CreatorCollection[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [previewId, setPreviewId] =
    useState<string | null>(null)
  const [preview, setPreview] =
    useState<PreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] =
    useState(false)
  const [previewError, setPreviewError] =
    useState<string | null>(null)

  // =====================================================
  // CREATOR COLLECTION IMPORT
  // =====================================================

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] =
    useState<string | null>(null)
  const [importNotice, setImportNotice] =
    useState<string | null>(null)

  const endpoint =
    `/api/venue-admin/editorial/${encodeURIComponent(
      editionId,
    )}/creator-collections`

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          q: query.trim(),
        })

        const response = await getJson<{
          collections: CreatorCollection[]
        }>(
          `${endpoint}?${params.toString()}`,
          controller.signal,
        )

        if (!controller.signal.aborted) {
          setCollections(response.collections ?? [])
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(message(loadError))
          setCollections([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [endpoint, query])

  useEffect(() => {
    if (!previewId) {
      setPreview(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadPreview() {
      setPreviewLoading(true)
      setPreviewError(null)
      setPreview(null)

      try {
        const params = new URLSearchParams({
          collection_id: previewId!,
        })

        const response = await getJson<PreviewResponse>(
          `${endpoint}?${params.toString()}`,
          controller.signal,
        )

        if (!controller.signal.aborted) {
          setPreview(response)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPreviewError(message(loadError))
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false)
        }
      }
    }

    void loadPreview()

    return () => controller.abort()
  }, [endpoint, previewId])

  // =====================================================
  // IMPORT ELIGIBLE VENUES INTO EDITORIAL LINEUP
  // =====================================================

  async function importCollection() {
    if (
      !editable ||
      !preview ||
      preview.items.length === 0 ||
      importing
    ) {
      return
    }

    const confirmed = window.confirm(
      `Import eligible venues from "${preview.collection.title}" into this edition? Existing places will be kept.`,
    )

    if (!confirmed) return

    setImporting(true)
    setImportError(null)
    setImportNotice(null)

    try {
      const response = await fetch(
        `${endpoint}/import`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collection_id: preview.collection.id,
          }),
        },
      )

      const payload: {
        error?: string
        added_count?: number
        skipped_existing_count?: number
      } = await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error || 'Unable to import collection.',
        )
      }

      setImportNotice(
        `${payload.added_count ?? 0} venues imported. ` +
        `${payload.skipped_existing_count ?? 0} already present.`,
      )

      onImported()
    } catch (error) {
      setImportError(message(error))
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Creator sourcing
        </p>

        <h3 className="mt-2 text-xl font-semibold text-white">
          Featured collections
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Discover public collections created by Roam
          tastemakers. Preview their recommendations before
          deciding which collection to feature.
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Edition city: {city ?? 'Not selected'}
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-slate-300">
          Find a creator collection
        </span>

        <input
          value={query}
          maxLength={80}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Search collection titles…"
          className="min-h-11 w-full rounded-xl border border-slate-600 bg-[#0d1b2f] px-3 text-sm text-white outline-none focus:border-blue-400"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">
          Finding public collections…
        </p>
      ) : collections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
          No eligible public collections matched this search.
        </p>
      ) : (
        <div className="space-y-2">
          {collections.map((collection) => {
            const creatorName =
              collection.creator.full_name ||
              collection.creator.username ||
              'Roam creator'

            return (
              <button
                key={collection.id}
                type="button"
                onClick={() =>
                  setPreviewId(collection.id)
                }
                className={[
                  'w-full rounded-xl border p-4 text-left transition',
                  previewId === collection.id
                    ? 'border-blue-400/60 bg-blue-500/10'
                    : 'border-slate-700 bg-[#0d1b2f] hover:border-slate-500',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold text-white">
                  {collection.title}
                </span>

                <span className="mt-1 block text-xs text-cyan-200">
                  Curated by {creatorName}
                  {collection.creator.username
                    ? ` · @${collection.creator.username}`
                    : ''}
                </span>

                {collection.description && (
                  <span className="mt-2 block text-xs leading-5 text-slate-400">
                    {collection.description}
                  </span>
                )}

                <span className="mt-2 block text-xs font-medium text-blue-300">
                  Preview collection
                </span>
              </button>
            )
          })}
        </div>
      )}

      {previewLoading && (
        <p className="text-sm text-slate-400">
          Loading collection recommendations…
        </p>
      )}

      {previewError && (
        <p role="alert" className="text-sm text-red-300">
          {previewError}
        </p>
      )}

      {preview && (
        <div className="space-y-4 rounded-2xl border border-blue-400/30 bg-[#0a1628] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
              Collection preview
            </p>

            <h4 className="mt-2 text-lg font-semibold text-white">
              {preview.collection.title}
            </h4>

            <p className="mt-1 text-xs text-slate-400">
              {preview.eligible_venue_count} eligible
              canonical venues
            </p>
          </div>

          {preview.omitted_item_count > 0 && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">
              {preview.omitted_item_count} source items
              cannot be imported as canonical venues
              for this edition. They may be suggestions,
              other content types, or venues outside
              the edition city.
            </div>
          )}

          {preview.items.length === 0 ? (
            <p className="text-sm text-slate-400">
              No eligible canonical venues are available
              to feature from this collection.
            </p>
          ) : (
            <div className="space-y-2">
              {preview.items.map((item, index) => (
                <div
                  key={item.source_collection_item_id}
                  className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-[#0d1b2f] p-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-xs font-bold text-blue-200">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {item.display_title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {item.venue_name}
                    </p>

                    {item.creator_note && (
                      <p className="mt-2 text-sm leading-5 text-slate-300">
                        {item.creator_note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* =====================================================
              CREATOR COLLECTION IMPORT ACTION
          ====================================================== */}

          {importError && (
            <p role="alert" className="text-sm text-red-300">
              {importError}
            </p>
          )}

          {importNotice && (
            <p role="status" className="text-sm text-emerald-300">
              {importNotice}
            </p>
          )}

          {editable && (
            <button
              type="button"
              disabled={
                importing ||
                preview.items.length === 0
              }
              onClick={() => void importCollection()}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing
                ? 'Importing collection…'
                : `Import ${preview.items.length} eligible venues`}
            </button>
          )}

          <p className="border-t border-slate-700/60 pt-3 text-xs leading-5 text-slate-400">
            Imported venues retain their original creator
            collection references. Importing does not record
            promotional reuse permission or approve this
            edition for publishing.
          </p>
        </div>
      )}
    </section>
  )
}
