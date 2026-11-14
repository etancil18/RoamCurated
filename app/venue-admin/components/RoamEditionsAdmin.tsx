
'use client'

import { useEffect, useState } from 'react'
import RoamEditionPlacesPanel from './RoamEditionPlacesPanel'
import RoamEditionCreatorSourcePanel from './RoamEditionCreatorSourcePanel'
import RoamEditionAttributionPanel from './RoamEditionAttributionPanel'
import RoamEditionSlidePreview from './RoamEditionSlidePreview'
import {
  SUPPORTED_CITIES,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

type EditionType =
  | 'featured_collection'
  | 'roam_curated'

type EditionStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'archived'

// =====================================================
// COVER & CLOSING — EDITORIAL COLOR PALETTES
// =====================================================

const EDITORIAL_PALETTES = [
  {
    id: 'midnight_navy',
    label: 'Midnight Navy',
    colors: ['#102337', '#49647d', '#e7e1d5', '#c68b67'],
  },
  {
    id: 'after_hours',
    label: 'After Hours',
    colors: ['#421f2a', '#793f4c', '#f0dfd3', '#d9a077'],
  },
  {
    id: 'olive_oak',
    label: 'Olive & Oak',
    colors: ['#233d32', '#667259', '#f4ead8', '#d8b48b'],
  },
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    colors: ['#70412f', '#bb7954', '#fff0d9', '#d4a06c'],
  },
  {
    id: 'noir_champagne',
    label: 'Noir & Champagne',
    colors: ['#28272d', '#5f5859', '#f2eee7', '#d2ab86'],
  },
  {
    id: 'winter_blue',
    label: 'Winter Blue',
    colors: ['#263b50', '#7798a8', '#edf3f1', '#b6ced2'],
  },
] as const

type EditorialPalette =
  (typeof EDITORIAL_PALETTES)[number]['id']

const DEFAULT_PALETTE: EditorialPalette = 'midnight_navy'

function isEditorialPalette(
  value: unknown,
): value is EditorialPalette {
  return EDITORIAL_PALETTES.some(
    (palette) => palette.id === value,
  )
}

function getEditionPalette(
  edition: EditorialEdition,
): EditorialPalette {
  const palette = edition.design_settings?.palette

  return isEditorialPalette(palette)
    ? palette
    : DEFAULT_PALETTE
}

type EditorialEdition = {
  id: string
  edition_type: EditionType
  status: EditionStatus
  title: string
  subtitle: string | null
  description: string | null
  city: string | null
  theme_key: string | null
  design_settings?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// =====================================================
// PUBLIC LIBRARY — PUBLICATION RESPONSE
// =====================================================

type EditionPublication = {
  id: string
  status: EditionStatus
  is_public: boolean
  published_at: string | null
  approved_at: string | null
  updated_at: string
}

type EditionForm = {
  edition_type: EditionType
  title: string
  subtitle: string
  description: string
  city: string
  theme_key: string
}

const EMPTY_FORM: EditionForm = {
  edition_type: 'roam_curated',
  title: '',
  subtitle: '',
  description: '',
  city: '',
  theme_key: '',
}

// Cities currently populated in the canonical venue catalog.
// Labels come from Roam's existing city configuration.
const EDITORIAL_VENUE_CITIES = SUPPORTED_CITIES.filter(
  (city) =>
    [
      'atl',
      'nyc',
      'la',
      'london',
      'lisbon',
      'porto',
    ].includes(city.value),
)

const INPUT_CLASS =
  'min-h-11 w-full rounded-xl border border-slate-600 bg-[#0d1b2f] px-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-60'

// =====================================================
// EDITORIAL APPROVAL — ALLOWED STATUS ACTIONS
// =====================================================

const STATUS_ACTIONS: Record<
  EditionStatus,
  Array<{
    status: EditionStatus
    label: string
  }>
> = {
  draft: [
    {
      status: 'in_review',
      label: 'Submit for review',
    },
    {
      status: 'archived',
      label: 'Archive edition',
    },
  ],
  in_review: [
    {
      status: 'approved',
      label: 'Approve edition',
    },
    {
      status: 'draft',
      label: 'Return to draft',
    },
  ],
  approved: [
    {
      status: 'archived',
      label: 'Archive edition',
    },
  ],
  archived: [
    {
      status: 'draft',
      label: 'Restore to draft',
    },
  ],
}

function formFromEdition(
  edition: EditorialEdition,
): EditionForm {
  return {
    edition_type: edition.edition_type,
    title: edition.title,
    subtitle: edition.subtitle ?? '',
    description: edition.description ?? '',
    city: edition.city ?? '',
    theme_key: edition.theme_key ?? '',
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Something went wrong.'
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
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
      `Request failed with status ${response.status}.`,
    )
  }

  return payload as T
}

export default function RoamEditionsAdmin() {
  const [editions, setEditions] =
    useState<EditorialEdition[]>([])

  const [selectedId, setSelectedId] =
    useState<string | null>(null)

  const [form, setForm] =
    useState<EditionForm>({ ...EMPTY_FORM })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [notice, setNotice] =
    useState<string | null>(null)

  // =====================================================
  // EDITORIAL APPROVAL — STATUS UPDATE STATE
  // =====================================================

  const [updatingStatus, setUpdatingStatus] =
    useState(false)

  // =====================================================
  // COVER & CLOSING — PALETTE UPDATE STATE
  // =====================================================

  const [updatingPalette, setUpdatingPalette] =
    useState(false)

  // =====================================================
  // PUBLIC LIBRARY — PUBLICATION UPDATE STATE
  // =====================================================

  const [publication, setPublication] =
    useState<EditionPublication | null>(null)

  const [loadingPublication, setLoadingPublication] =
    useState(false)

  const [updatingPublication, setUpdatingPublication] =
    useState(false)

  const [publicationError, setPublicationError] =
    useState<string | null>(null)

  // =====================================================
  // CREATOR IMPORT — PLACES REFRESH
  // =====================================================

  const [placesRefreshVersion, setPlacesRefreshVersion] =
    useState(0)

  const selectedEdition =
    editions.find(
      (edition) => edition.id === selectedId,
    ) ?? null

  const canEdit =
    selectedEdition === null ||
    selectedEdition.status === 'draft'

  useEffect(() => {
    const controller = new AbortController()

    async function loadEditions() {
      setLoading(true)

      try {
        const response = await request<{
          editions: EditorialEdition[]
        }>('/api/venue-admin/editorial', {
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          setEditions(response.editions ?? [])
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadEditions()

    return () => {
      controller.abort()
    }
  }, [])

  // =====================================================
  // PUBLIC LIBRARY — LOAD SELECTED EDITION PUBLICATION
  //
  // Kept separate from the existing editorial GET API.
  // Reloads after approval status changes.
  // =====================================================

  useEffect(() => {
    const controller = new AbortController()

    setPublication(null)
    setPublicationError(null)

    if (!selectedEdition) {
      setLoadingPublication(false)
      return () => controller.abort()
    }

    const editionId = selectedEdition.id

    async function loadPublication() {
      setLoadingPublication(true)

      try {
        const response = await request<{
          publication: EditionPublication
        }>(
          `/api/venue-admin/editorial/${encodeURIComponent(
            editionId,
          )}/publication`,
          {
            signal: controller.signal,
          },
        )

        if (!controller.signal.aborted) {
          if (
            !response.publication ||
            response.publication.id !== editionId
          ) {
            throw new Error(
              'The server returned invalid publication settings.',
            )
          }

          setPublication(response.publication)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPublicationError(
            getErrorMessage(loadError),
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPublication(false)
        }
      }
    }

    void loadPublication()

    return () => {
      controller.abort()
    }
  }, [selectedEdition?.id, selectedEdition?.status])

  function updateForm<K extends keyof EditionForm>(
    key: K,
    value: EditionForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))

    setNotice(null)
  }

  function startNew() {
    if (
      saving ||
      updatingStatus ||
      updatingPalette ||
      updatingPublication
    ) return

    setSelectedId(null)
    setForm({ ...EMPTY_FORM })
    setError(null)
    setNotice(null)
  }

  async function selectEdition(edition: EditorialEdition) {
    if (
      saving ||
      updatingStatus ||
      updatingPalette ||
      updatingPublication
    ) return

    setSelectedId(edition.id)
    setForm(formFromEdition(edition))
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        edition: EditorialEdition
      }>(
        `/api/venue-admin/editorial/${encodeURIComponent(
          edition.id,
        )}`,
      )

      // Only apply the result if the user is still
      // viewing the same edition.
      setSelectedId((currentId) => {
        if (currentId !== edition.id) return currentId

        setForm(formFromEdition(response.edition))

        setEditions((current) =>
          current.map((item) =>
            item.id === response.edition.id
              ? response.edition
              : item,
          ),
        )

        return currentId
      })
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    }
  }

  async function saveEdition(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !canEdit ||
      saving ||
      updatingStatus ||
      updatingPalette ||
      updatingPublication
    ) return

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const isNew = selectedId === null

      const response = await request<{
        edition: EditorialEdition
      }>(
        isNew
          ? '/api/venue-admin/editorial'
          : `/api/venue-admin/editorial/${encodeURIComponent(
              selectedId,
            )}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify({
            edition_type: form.edition_type,
            title: form.title,
            subtitle: form.subtitle.trim() || null,
            description: form.description.trim() || null,
            city: form.city.trim() || null,
            theme_key: form.theme_key.trim() || null,
          }),
        },
      )

      const edition = response.edition

      setEditions((current) =>
        [
          edition,
          ...current.filter(
            (item) => item.id !== edition.id,
          ),
        ].sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime(),
        ),
      )

      setSelectedId(edition.id)
      setForm(formFromEdition(edition))

      setNotice(
        isNew
          ? 'Editorial draft created successfully.'
          : 'Editorial draft saved successfully.',
      )
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // EDITORIAL APPROVAL — STATUS TRANSITION
  // =====================================================

  async function updateEditionStatus(
    nextStatus: EditionStatus,
  ) {
    if (
      !selectedEdition ||
      saving ||
      updatingStatus ||
      updatingPalette ||
      updatingPublication
    ) {
      return
    }

    const isAllowed = STATUS_ACTIONS[
      selectedEdition.status
    ].some((action) => action.status === nextStatus)

    if (!isAllowed) {
      setError('This editorial status transition is not allowed.')
      return
    }

    const editionId = selectedEdition.id

    setUpdatingStatus(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        edition: EditorialEdition
      }>(
        `/api/venue-admin/editorial/${encodeURIComponent(
          editionId,
        )}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      )

      if (
        !response.edition ||
        response.edition.id !== editionId ||
        response.edition.status !== nextStatus
      ) {
        throw new Error(
          'The server returned an invalid editorial status update.',
        )
      }

      setEditions((current) =>
        current.map((edition) =>
          edition.id === response.edition.id
            ? response.edition
            : edition,
        ),
      )

      setNotice(
        `Editorial status updated to ${nextStatus.replaceAll(
          '_',
          ' ',
        )}.`,
      )
    } catch (statusError) {
      setError(getErrorMessage(statusError))
    } finally {
      setUpdatingStatus(false)
    }
  }

  // =====================================================
  // PUBLIC LIBRARY — PUBLISH / UNPUBLISH
  //
  // Uses the dedicated admin-only publication endpoint.
  // Never changes editorial approval or source content.
  // =====================================================

  async function updateEditionPublication(
    shouldPublish: boolean,
  ) {
    if (
      !selectedEdition ||
      !publication ||
      publication.id !== selectedEdition.id ||
      loadingPublication ||
      saving ||
      updatingStatus ||
      updatingPalette ||
      updatingPublication
    ) {
      return
    }

    if (publication.is_public === shouldPublish) {
      return
    }

    if (
      shouldPublish &&
      (
        selectedEdition.status !== 'approved' ||
        !publication.approved_at
      )
    ) {
      setPublicationError(
        'Only approved editions can be published.',
      )
      return
    }

    const confirmed = window.confirm(
      shouldPublish
        ? 'Publish this edition to the public Roam Library? Anyone with the edition link will be able to view its slides, venue details, and editorial credit.'
        : 'Unpublish this edition from the Roam Library? Its public reader will become unavailable until you publish it again. Publication history will be retained.',
    )

    if (!confirmed) return

    const editionId = selectedEdition.id

    setUpdatingPublication(true)
    setPublicationError(null)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        publication: EditionPublication
      }>(
        `/api/venue-admin/editorial/${encodeURIComponent(
          editionId,
        )}/publication`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            is_public: shouldPublish,
          }),
        },
      )

      if (
        !response.publication ||
        response.publication.id !== editionId ||
        response.publication.is_public !== shouldPublish
      ) {
        throw new Error(
          'The server returned an invalid publication update.',
        )
      }

      setPublication(response.publication)

      setNotice(
        shouldPublish
          ? 'Edition published to the Roam Library.'
          : 'Edition unpublished from the Roam Library.',
      )
    } catch (publicationUpdateError) {
      setPublicationError(
        getErrorMessage(publicationUpdateError),
      )
    } finally {
      setUpdatingPublication(false)
    }
  }

  // =====================================================
  // COVER & CLOSING — SAVE SELECTED PALETTE
  // =====================================================

  async function updateEditionPalette(
    nextPalette: EditorialPalette,
  ) {
    if (
      !selectedEdition ||
      selectedEdition.status !== 'draft' ||
      saving ||
      updatingStatus ||
      updatingPalette ||
      updatingPublication
    ) {
      return
    }

    if (getEditionPalette(selectedEdition) === nextPalette) {
      return
    }

    const editionId = selectedEdition.id

    setUpdatingPalette(true)
    setError(null)
    setNotice(null)

    try {
      const response = await request<{
        edition: EditorialEdition
      }>(
        `/api/venue-admin/editorial/${encodeURIComponent(
          editionId,
        )}/palette`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            palette: nextPalette,
          }),
        },
      )

      if (
        !response.edition ||
        response.edition.id !== editionId ||
        getEditionPalette(response.edition) !== nextPalette
      ) {
        throw new Error(
          'The server returned an invalid editorial palette update.',
        )
      }

      setEditions((current) =>
        current.map((edition) =>
          edition.id === response.edition.id
            ? response.edition
            : edition,
        ),
      )

      const paletteLabel =
        EDITORIAL_PALETTES.find(
          (palette) => palette.id === nextPalette,
        )?.label ?? nextPalette

      setNotice(
        `Cover and closing palette saved: ${paletteLabel}.`,
      )
    } catch (paletteError) {
      setError(getErrorMessage(paletteError))
    } finally {
      setUpdatingPalette(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Roam Editions
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Editorial Studio
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Create themed venue stories and feature the
            perspectives of Roam creators. Build the editorial
            foundation before preparing social exports.
          </p>
        </div>

        <button
          type="button"
          onClick={startNew}
          disabled={
            saving ||
            updatingStatus ||
            updatingPalette ||
            updatingPublication
          }
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + New edition
        </button>
      </div>

      {(error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          className={[
            'rounded-xl border px-4 py-3 text-sm',
            error
              ? 'border-red-500/30 bg-red-950/30 text-red-200'
              : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200',
          ].join(' ')}
        >
          {error ?? notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        {/* =====================================================
            EDITION LIBRARY
        ====================================================== */}

        <aside className="min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">
              Edition library
            </h4>

            <span className="text-xs text-slate-500">
              {editions.length}
            </span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4 text-sm text-slate-400">
              Loading editions…
            </div>
          ) : editions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm leading-6 text-slate-500">
              No editions yet. Create your first Roam
              editorial draft.
            </div>
          ) : (
            <div className="space-y-2">
              {editions.map((edition) => (
                <button
                  key={edition.id}
                  type="button"
                  disabled={
                    saving ||
                    updatingStatus ||
                    updatingPalette ||
                    updatingPublication
                  }
                  onClick={() => void selectEdition(edition)}
                  className={[
                    'w-full rounded-xl border p-3 text-left transition disabled:opacity-60',
                    selectedId === edition.id
                      ? 'border-blue-400/50 bg-blue-500/10'
                      : 'border-slate-700/70 bg-[#0d1b2f] hover:border-slate-500',
                  ].join(' ')}
                >
                  <span className="block break-words text-sm font-semibold text-white">
                    {edition.title}
                  </span>

                  <span className="mt-1 block text-xs text-slate-400">
                    {edition.city || 'City not set'}
                  </span>

                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium capitalize text-slate-300">
                      {edition.status.replaceAll('_', ' ')}
                    </span>

                    <span className="text-[10px] text-slate-500">
                      {formatDate(edition.updated_at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* =====================================================
            EDITION DRAFT EDITOR
        ====================================================== */}

        <form
          onSubmit={(event) => void saveEdition(event)}
          className="min-w-0 space-y-5 rounded-2xl border border-slate-700/60 bg-[#0d1b2f] p-4 sm:p-5"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300">
              {selectedEdition
                ? 'Existing edition'
                : 'New editorial draft'}
            </p>

            <h4 className="mt-2 text-lg font-semibold text-white">
              {selectedEdition
                ? selectedEdition.title
                : 'Start a new story'}
            </h4>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              {selectedEdition
                ? `Status: ${selectedEdition.status.replaceAll('_', ' ')}`
                : 'New editions begin as drafts.'}
            </p>
          </div>

          {!canEdit && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">
              This edition is no longer a draft and cannot
              be edited through the draft editor.
            </div>
          )}

          <fieldset
            disabled={
              !canEdit ||
              saving ||
              updatingStatus ||
              updatingPalette ||
              updatingPublication
            }
            className="space-y-5 disabled:opacity-70"
          >
            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Edition type
              </span>

              <select
                value={form.edition_type}
                onChange={(event) =>
                  updateForm(
                    'edition_type',
                    event.target.value as EditionType,
                  )
                }
                className={INPUT_CLASS}
              >
                <option value="roam_curated">
                  Roam Curated
                </option>

                <option value="featured_collection">
                  Featured Creator Collection
                </option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Title
              </span>

              <input
                required
                maxLength={160}
                value={form.title}
                onChange={(event) =>
                  updateForm('title', event.target.value)
                }
                placeholder="Cozy Fall Afternoons"
                className={INPUT_CLASS}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Subtitle
              </span>

              <textarea
                maxLength={300}
                rows={3}
                value={form.subtitle}
                onChange={(event) =>
                  updateForm('subtitle', event.target.value)
                }
                placeholder="Slow mornings, warm drinks, and places worth lingering."
                className={INPUT_CLASS}
              />
            </label>

            {/* =====================================================
                EDITORIAL DESCRIPTION
            ====================================================== */}

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">
                Editorial Description
              </span>

              <textarea
                maxLength={2000}
                rows={6}
                value={form.description}
                onChange={(event) =>
                  updateForm('description', event.target.value)
                }
                placeholder="Introduce the story behind this edition. What connects these places, and why are they worth exploring?"
                className={INPUT_CLASS}
              />

              <span className="block text-xs leading-5 text-slate-500">
                A longer introduction displayed under About
                This Edition on the public reader. Not shown
                on the magazine cover.
                {' '}
                {form.description.length}/2000
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Editorial city dropdown: existing Roam city options */}
              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-300">
                  City
                </span>

                <select
                  value={normalizeCityKey(form.city)}
                  onChange={(event) =>
                    updateForm('city', event.target.value)
                  }
                  className={INPUT_CLASS}
                >
                  <option value="">Select a city</option>

                  {EDITORIAL_VENUE_CITIES.map((city) => (
                    <option
                      key={city.value}
                      value={city.value}
                    >
                      {city.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-300">
                  Theme identifier
                </span>

                <input
                  maxLength={80}
                  value={form.theme_key}
                  onChange={(event) =>
                    updateForm('theme_key', event.target.value)
                  }
                  placeholder="cozy-fall"
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  updatingStatus ||
                  updatingPalette ||
                  updatingPublication
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : selectedEdition
                    ? 'Save changes'
                    : 'Create draft'}
              </button>
            )}
          </fieldset>

          <div className="border-t border-slate-700/60 pt-4">
            <p className="text-xs leading-5 text-slate-500">
              Coming next: import a creator collection, select
              canonical venues, assign curator credit, and
              preview slides with the oversized Roam logo
              sticker behind the text.
            </p>
          </div>
        </form>
      </div>

      {/* =====================================================
          ROAM EDITIONS — EDITORIAL APPROVAL WORKFLOW
      ====================================================== */}

      {selectedEdition && (
        <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Editorial governance
            </p>

            <h4 className="mt-2 text-lg font-semibold text-white">
              Approval workflow
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Submit an edition for review, approve it,
              return it for revisions, or archive it.
              Approval is separate from exporting social
              assets and does not publish the edition.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-400">
              Current status
            </span>

            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold capitalize text-white">
              {selectedEdition.status.replaceAll('_', ' ')}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {STATUS_ACTIONS[selectedEdition.status].map(
              (action) => (
                <button
                  key={action.status}
                  type="button"
                  disabled={
                    loading ||
                    saving ||
                    updatingStatus ||
                    updatingPalette ||
                    updatingPublication
                  }
                  onClick={() =>
                    void updateEditionStatus(action.status)
                  }
                  className={[
                    'inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                    action.status === 'approved'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : action.status === 'in_review'
                        ? 'bg-blue-500 text-white hover:bg-blue-400'
                        : 'border border-slate-600 text-slate-200 hover:border-blue-400',
                  ].join(' ')}
                >
                  {updatingStatus
                    ? 'Updating status…'
                    : action.label}
                </button>
              ),
            )}
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Status changes require administrator authorization
            and must be validated by the server. Draft content
            remains editable only while the edition is in draft
            status.
          </p>
        </div>
      )}

      {/* =====================================================
          ROAM EDITIONS — PUBLIC LIBRARY PUBLICATION
      ====================================================== */}

      {selectedEdition && (
        <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Public library
            </p>

            <h4 className="mt-2 text-lg font-semibold text-white">
              Library Publication
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Control whether this approved editorial appears
              in the public Roam Library. Publishing is separate
              from editorial approval and social exports.
              Published issues remain in the historical library
              when archived, unless explicitly unpublished.
            </p>
          </div>

          {loadingPublication && (
            <p
              role="status"
              className="text-sm text-slate-400"
            >
              Loading publication settings…
            </p>
          )}

          {publicationError && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200"
            >
              {publicationError}
            </div>
          )}

          {!loadingPublication &&
            publication?.id === selectedEdition.id && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-slate-400">
                    Public visibility
                  </span>

                  <span
                    className={[
                      'rounded-full border px-3 py-1.5 text-xs font-semibold',
                      publication.is_public
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-600 bg-white/5 text-slate-300',
                    ].join(' ')}
                  >
                    {publication.is_public
                      ? 'Published'
                      : 'Not published'}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      First published
                    </p>

                    <p className="mt-2 text-sm font-semibold text-white">
                      {publication.published_at
                        ? formatDate(publication.published_at)
                        : 'Not yet published'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700/60 bg-[#0d1b2f] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Editorial approval
                    </p>

                    <p className="mt-2 text-sm font-semibold text-white">
                      {publication.approved_at
                        ? formatDate(publication.approved_at)
                        : 'Not yet approved'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {!publication.is_public &&
                    selectedEdition.status === 'approved' &&
                    publication.approved_at && (
                      <button
                        type="button"
                        disabled={
                          loading ||
                          saving ||
                          updatingStatus ||
                          updatingPalette ||
                          updatingPublication
                        }
                        onClick={() =>
                          void updateEditionPublication(true)
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updatingPublication
                          ? 'Publishing…'
                          : 'Publish to Roam Library'}
                      </button>
                    )}

                  {publication.is_public && (
                    <button
                      type="button"
                      disabled={
                        loading ||
                        saving ||
                        updatingStatus ||
                        updatingPalette ||
                        updatingPublication
                      }
                      onClick={() =>
                        void updateEditionPublication(false)
                      }
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-400/40 px-5 text-sm font-semibold text-red-200 transition hover:border-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatingPublication
                        ? 'Unpublishing…'
                        : 'Unpublish edition'}
                    </button>
                  )}

                  {publication.is_public &&
                    publication.published_at &&
                    publication.approved_at &&
                    (
                      selectedEdition.status === 'approved' ||
                      selectedEdition.status === 'archived'
                    ) && (
                      <a
                        href={`/editions/${encodeURIComponent(
                          selectedEdition.id,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d2ab86]/50 px-5 text-sm font-semibold text-[#d2ab86] transition hover:border-[#d2ab86] hover:bg-[#d2ab86]/10"
                      >
                        View public edition ↗
                      </a>
                    )}
                </div>

                {!publication.is_public &&
                  selectedEdition.status !== 'approved' && (
                    <p className="text-xs leading-5 text-amber-200">
                      This edition must be approved before
                      it can be published to the Roam Library.
                    </p>
                  )}

                {publication.is_public &&
                  selectedEdition.status === 'archived' && (
                    <p className="text-xs leading-5 text-slate-400">
                      This issue is archived but remains
                      publicly accessible as part of the
                      historical Roam Library.
                    </p>
                  )}

                <p className="text-xs leading-5 text-slate-500">
                  Publishing requires server-side approval
                  validation and approved creator permission
                  when applicable. Unpublishing hides the
                  public reader without deleting its content
                  or original publication date.
                </p>
              </>
            )}
        </div>
      )}

      {/* =====================================================
          ROAM EDITIONS — PLACES CURATION
      ====================================================== */}

      {selectedEdition && (
        <div className="rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <RoamEditionPlacesPanel
            key={`${selectedEdition.id}:${placesRefreshVersion}`}
            editionId={selectedEdition.id}
            city={selectedEdition.city}
            editable={selectedEdition.status === 'draft'}
          />
        </div>
      )}

      {/* =====================================================
          ROAM EDITIONS — CREATOR COLLECTION SOURCING
      ====================================================== */}

      {selectedEdition && (
        <div className="rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <RoamEditionCreatorSourcePanel
            key={selectedEdition.id}
            editionId={selectedEdition.id}
            city={selectedEdition.city}
            editable={selectedEdition.status === 'draft'}
            onImported={() => {
              setPlacesRefreshVersion(
                (version) => version + 1,
              )

              setEditions((current) =>
                current.map((edition) =>
                  edition.id === selectedEdition.id
                    ? {
                        ...edition,
                        edition_type: 'featured_collection',
                      }
                    : edition,
                ),
              )

              setForm((current) => ({
                ...current,
                edition_type: 'featured_collection',
              }))
            }}
          />
        </div>
      )}

      {/* =====================================================
          ROAM EDITIONS — ATTRIBUTION & PERMISSIONS
      ====================================================== */}

      {selectedEdition && (
        <div className="rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <RoamEditionAttributionPanel
            key={`${selectedEdition.id}:${placesRefreshVersion}`}
            editionId={selectedEdition.id}
          />
        </div>
      )}

      {/* =====================================================
          ROAM EDITIONS — COVER & CLOSING COLOR PALETTE
      ====================================================== */}

      {selectedEdition && (
        <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Edition design
            </p>

            <h4 className="mt-2 text-lg font-semibold text-white">
              Cover & Closing Palette
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose the color atmosphere for this edition's
              cover and closing slides. Venue slides retain
              their original photography and styling.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EDITORIAL_PALETTES.map((palette) => {
              const isSelected =
                getEditionPalette(selectedEdition) === palette.id

              return (
                <button
                  key={palette.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={
                    selectedEdition.status !== 'draft' ||
                    loading ||
                    saving ||
                    updatingStatus ||
                    updatingPalette ||
                    updatingPublication
                  }
                  onClick={() =>
                    void updateEditionPalette(palette.id)
                  }
                  className={[
                    'rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60',
                    isSelected
                      ? 'border-blue-400 bg-blue-500/10'
                      : 'border-slate-700 bg-[#0d1b2f] hover:border-slate-500',
                  ].join(' ')}
                >
                  <div
                    className="h-16 rounded-lg border border-white/10"
                    style={{
                      backgroundColor: palette.colors[0],
                    }}
                  >
                    <div className="flex h-full items-end gap-1 p-2">
                      {palette.colors.map((color, index) => (
                        <span
                          key={`${palette.id}-${index}`}
                          className="h-4 min-w-0 flex-1 rounded-sm"
                          style={{
                            backgroundColor: color,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">
                      {palette.label}
                    </span>

                    {isSelected && (
                      <span className="text-[10px] font-semibold text-blue-300">
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {updatingPalette && (
            <p role="status" className="text-xs text-blue-300">
              Saving color palette…
            </p>
          )}

          {selectedEdition.status !== 'draft' && (
            <p className="text-xs leading-5 text-amber-200">
              Return this edition to draft to change its
              color palette.
            </p>
          )}

          <p className="text-xs leading-5 text-slate-500">
            Palette choices are saved per edition. Existing
            editions use Midnight Navy unless another palette
            has been selected.
          </p>
        </div>
      )}

      {/* =====================================================
          ROAM EDITIONS — SOCIAL SLIDE PREVIEW
      ====================================================== */}

      {selectedEdition && (
        <div className="rounded-2xl border border-slate-700/60 bg-[#0a1628] p-4 sm:p-5">
          <RoamEditionSlidePreview
            key={`${selectedEdition.id}:${placesRefreshVersion}`}
            editionId={selectedEdition.id}
          />
        </div>
      )}
    </div>
  )
}
