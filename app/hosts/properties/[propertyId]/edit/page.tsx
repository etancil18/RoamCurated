
"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import Link from "next/link"
import {
  useParams,
  useRouter,
} from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/* =========================================================
 * Configuration
 * ======================================================= */

const MAX_HOST_FAVORITES = 10
const MAX_FAVORITE_DESCRIPTION_LENGTH = 500
const MAX_FAVORITE_LABEL_LENGTH = 120

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_PAGE_SIZE = 24

const CITY_LABELS: Record<string, string> = {
  atl: "Atlanta",
  nyc: "New York City",
  la: "Los Angeles",
  london: "London",
  porto: "Porto",
  lisbon: "Lisbon",
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* =========================================================
 * Data contracts
 * ======================================================= */

type EditableProperty = {
  id: string
  name: string
  city: string
  slug: string
  address: string | null
  website: string | null
  welcome_description: string | null
  lat: number | null
  lon: number | null
}

type VenueOption = {
  id: string
  name: string
  city: string
  canonicalCity: string | null
  address: string | null
  type: string[]
}

type EditableFavorite = {
  venueId: string
  venue: VenueOption
  label: string
  description: string
}

type PropertyDraft = {
  name: string
  address: string
  website: string
  welcomeDescription: string
  favorites: EditableFavorite[]
}

type EditorGetResponse = {
  property?: EditableProperty
  favorites?: Array<{
    venueId: string
    label: string | null
    description: string | null
    priority: number
    venue: VenueOption
  }>
  canEdit?: boolean
  error?: string
}

type EditorSaveResponse = {
  success?: boolean
  property?: EditableProperty
  favorites?: EditorGetResponse["favorites"]
  error?: string
}

type ExploreResponse = {
  venues?: VenueOption[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
  error?: string
}

type PageStatus =
  | "loading"
  | "ready"
  | "unauthorized"
  | "not-found"
  | "error"

/* =========================================================
 * Helpers
 * ======================================================= */

function getCityLabel(city: string): string {
  const key = city.trim().toLowerCase()

  return (
    CITY_LABELS[key] ??
    city
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  )
}

function normalizeCityKey(city: string): string {
  const key = city.trim().toLowerCase()

  if (
    key === "los angeles" ||
    key === "los-angeles"
  ) {
    return "la"
  }

  if (
    key === "atlanta"
  ) {
    return "atl"
  }

  if (
    key === "new york city" ||
    key === "new york" ||
    key === "brooklyn" ||
    key === "manhattan"
  ) {
    return "nyc"
  }

  return key
}

function createDraft(
  property: EditableProperty,
  favorites: NonNullable<EditorGetResponse["favorites"]>
): PropertyDraft {
  return {
    name: property.name ?? "",
    address: property.address ?? "",
    website: property.website ?? "",
    welcomeDescription:
      property.welcome_description ?? "",
    favorites: [...favorites]
      .sort(
        (first, second) =>
          first.priority - second.priority
      )
      .map((favorite) => ({
        venueId: favorite.venueId,
        venue: favorite.venue,
        label: favorite.label ?? "",
        description: favorite.description ?? "",
      })),
  }
}

function serializeDraft(
  draft: PropertyDraft
): string {
  return JSON.stringify({
    name: draft.name,
    address: draft.address,
    website: draft.website,
    welcomeDescription: draft.welcomeDescription,
    favorites: draft.favorites.map(
      (favorite) => ({
        venueId: favorite.venueId,
        label: favorite.label,
        description: favorite.description,
      })
    ),
  })
}

function validateDraft(
  draft: PropertyDraft
): string | null {
  if (!draft.name.trim()) {
    return "Property name is required."
  }

  if (!draft.address.trim()) {
    return "Property address is required."
  }

  if (
    draft.favorites.length >
    MAX_HOST_FAVORITES
  ) {
    return `Select no more than ${MAX_HOST_FAVORITES} favorites.`
  }

  const seenVenueIds = new Set<string>()

  for (const favorite of draft.favorites) {
    if (!UUID_PATTERN.test(favorite.venueId)) {
      return "A selected favorite has an invalid venue ID."
    }

    if (seenVenueIds.has(favorite.venueId)) {
      return "A venue cannot appear twice in Host Picks."
    }

    seenVenueIds.add(favorite.venueId)

    if (
      favorite.label.trim().length >
      MAX_FAVORITE_LABEL_LENGTH
    ) {
      return `Favorite labels must be ${MAX_FAVORITE_LABEL_LENGTH} characters or fewer.`
    }

    if (
      favorite.description.trim().length >
      MAX_FAVORITE_DESCRIPTION_LENGTH
    ) {
      return `Favorite recommendations must be ${MAX_FAVORITE_DESCRIPTION_LENGTH} characters or fewer.`
    }
  }

  return null
}

/* =========================================================
 * Page
 * ======================================================= */

export default function EditPropertyPage() {
  const params = useParams()
  const router = useRouter()

  const rawPropertyId = params?.propertyId

  const propertyId =
    typeof rawPropertyId === "string"
      ? rawPropertyId
      : Array.isArray(rawPropertyId)
        ? rawPropertyId[0] ?? ""
        : ""

  const [status, setStatus] =
    useState<PageStatus>("loading")

  const [property, setProperty] =
    useState<EditableProperty | null>(null)

  const [draft, setDraft] =
    useState<PropertyDraft | null>(null)

  const [savedSnapshot, setSavedSnapshot] =
    useState<string>("")

  const [loadError, setLoadError] =
    useState<string | null>(null)

  const [saveError, setSaveError] =
    useState<string | null>(null)

  const [saveSuccess, setSaveSuccess] =
    useState<string | null>(null)

  const [saving, setSaving] =
    useState(false)

  const savingRef = useRef(false)

  /* -----------------------------------------------------
   * Venue search state
   * --------------------------------------------------- */

  const [search, setSearch] =
    useState("")

  const [searchPage, setSearchPage] =
    useState(1)

  const [searchResults, setSearchResults] =
    useState<VenueOption[]>([])

  const [searchLoading, setSearchLoading] =
    useState(false)

  const [searchError, setSearchError] =
    useState<string | null>(null)

  const [searchTotal, setSearchTotal] =
    useState(0)

  const [searchTotalPages, setSearchTotalPages] =
    useState(0)

  /* -----------------------------------------------------
   * Derived state
   * --------------------------------------------------- */

  const cityKey = property
    ? normalizeCityKey(property.city)
    : ""

  const cityLabel = property
    ? getCityLabel(cityKey)
    : ""

  const guideHref = property
    ? `/property/${encodeURIComponent(
        cityKey
      )}/${encodeURIComponent(property.slug)}`
    : "/profile#saved"

  const dirty = useMemo(() => {
    if (!draft) return false

    return (
      serializeDraft(draft) !==
      savedSnapshot
    )
  }, [draft, savedSnapshot])

  const selectedVenueIds = useMemo(
    () =>
      new Set(
        draft?.favorites.map(
          (favorite) => favorite.venueId
        ) ?? []
      ),
    [draft]
  )

  /* -----------------------------------------------------
   * Load property and current Host Picks
   *
   * This endpoint must authenticate the current user
   * and authorize owners/admins on the SERVER.
   * --------------------------------------------------- */

  const loadEditor = useCallback(
    async (signal?: AbortSignal) => {
      if (!UUID_PATTERN.test(propertyId)) {
        setLoadError("Invalid property ID.")
        setStatus("not-found")
        return
      }

      setStatus("loading")
      setLoadError(null)

      try {
        const response = await fetch(
          `/api/hosts/properties/${encodeURIComponent(
            propertyId
          )}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal,
          }
        )

        if (signal?.aborted) return

        if (response.status === 401) {
          setStatus("unauthorized")
          return
        }

        if (response.status === 403) {
          setStatus("unauthorized")
          return
        }

        if (response.status === 404) {
          setStatus("not-found")
          return
        }

        const data =
          (await response.json()) as EditorGetResponse

        if (signal?.aborted) return

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to load this property."
          )
        }

        if (!data.property || data.canEdit !== true) {
          setStatus("unauthorized")
          return
        }

        if (data.property.id !== propertyId) {
          throw new Error(
            "The server returned the wrong property."
          )
        }

        if (!Array.isArray(data.favorites)) {
          throw new Error(
            "The server did not return the property's Host Picks."
          )
        }

        const nextDraft = createDraft(
          data.property,
          data.favorites
        )

        setProperty(data.property)
        setDraft(nextDraft)
        setSavedSnapshot(
          serializeDraft(nextDraft)
        )

        setSaveError(null)
        setSaveSuccess(null)
        setStatus("ready")
      } catch (error) {
        if (signal?.aborted) return

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this property."
        )

        setStatus("error")
      }
    },
    [propertyId]
  )

  useEffect(() => {
    const controller = new AbortController()

    void loadEditor(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadEditor])

  /* -----------------------------------------------------
   * Warn about unsaved changes on browser navigation
   * --------------------------------------------------- */

  useEffect(() => {
    if (!dirty || saving) return

    function handleBeforeUnload(
      event: BeforeUnloadEvent
    ) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    )

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      )
    }
  }, [dirty, saving])

  function navigateTo(href: string) {
    if (
      dirty &&
      !window.confirm(
        "You have unsaved changes. Leave without saving?"
      )
    ) {
      return
    }

    router.push(href)
  }

  /* -----------------------------------------------------
   * Search eligible venues from the existing Explore API
   * --------------------------------------------------- */

  useEffect(() => {
    if (
      status !== "ready" ||
      !cityKey
    ) {
      setSearchResults([])
      setSearchTotal(0)
      setSearchTotalPages(0)
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()

    setSearchResults([])
    setSearchError(null)
    setSearchLoading(true)

    const timer = window.setTimeout(
      async () => {
        try {
          const query = new URLSearchParams({
            city: cityKey,
            q: search.trim(),
            page: String(searchPage),
            limit: String(SEARCH_PAGE_SIZE),
            sort: search.trim()
              ? "relevance"
              : "name",
          })

          const response = await fetch(
            `/api/explore/venues?${query.toString()}`,
            {
              method: "GET",
              cache: "no-store",
              signal: controller.signal,
            }
          )

          const result =
            (await response.json()) as ExploreResponse

          if (!response.ok) {
            throw new Error(
              result.error ??
                "Unable to search venues."
            )
          }

          if (controller.signal.aborted) {
            return
          }

          setSearchResults(
            Array.isArray(result.venues)
              ? result.venues
              : []
          )

          setSearchTotal(
            result.pagination?.total ?? 0
          )

          setSearchTotalPages(
            result.pagination?.totalPages ?? 0
          )
        } catch (error) {
          if (controller.signal.aborted) {
            return
          }

          setSearchResults([])
          setSearchTotal(0)
          setSearchTotalPages(0)

          setSearchError(
            error instanceof Error
              ? error.message
              : "Unable to search venues."
          )
        } finally {
          if (!controller.signal.aborted) {
            setSearchLoading(false)
          }
        }
      },
      SEARCH_DEBOUNCE_MS
    )

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [status, cityKey, search, searchPage])

  /* -----------------------------------------------------
   * Draft updates
   * --------------------------------------------------- */

  function updateField(
    field:
      | "name"
      | "address"
      | "website"
      | "welcomeDescription",
    value: string
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current
    )

    setSaveSuccess(null)
  }

  function addFavorite(venue: VenueOption) {
    setDraft((current) => {
      if (!current) return current

      if (
        current.favorites.some(
          (favorite) =>
            favorite.venueId === venue.id
        )
      ) {
        return current
      }

      if (
        current.favorites.length >=
        MAX_HOST_FAVORITES
      ) {
        return current
      }

      return {
        ...current,
        favorites: [
          ...current.favorites,
          {
            venueId: venue.id,
            venue,
            label: "",
            description: "",
          },
        ],
      }
    })

    setSaveSuccess(null)
  }

  function removeFavorite(venueId: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            favorites: current.favorites.filter(
              (favorite) =>
                favorite.venueId !== venueId
            ),
          }
        : current
    )

    setSaveSuccess(null)
  }

  function moveFavorite(
    index: number,
    direction: -1 | 1
  ) {
    setDraft((current) => {
      if (!current) return current

      const nextIndex = index + direction

      if (
        nextIndex < 0 ||
        nextIndex >= current.favorites.length
      ) {
        return current
      }

      const favorites = [
        ...current.favorites,
      ]

      const moved = favorites[index]

      favorites[index] =
        favorites[nextIndex]

      favorites[nextIndex] = moved

      return {
        ...current,
        favorites,
      }
    })

    setSaveSuccess(null)
  }

  function updateFavorite(
    venueId: string,
    field: "label" | "description",
    value: string
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            favorites: current.favorites.map(
              (favorite) =>
                favorite.venueId === venueId
                  ? {
                      ...favorite,
                      [field]: value,
                    }
                  : favorite
            ),
          }
        : current
    )

    setSaveSuccess(null)
  }

  /* -----------------------------------------------------
   * Save through the ownership-checked server endpoint
   * --------------------------------------------------- */

  async function saveChanges(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !draft ||
      !property ||
      savingRef.current
    ) {
      return
    }

    const validationError =
      validateDraft(draft)

    if (validationError) {
      setSaveError(validationError)
      setSaveSuccess(null)
      return
    }

    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const response = await fetch(
        `/api/hosts/properties/${encodeURIComponent(
          propertyId
        )}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: draft.name.trim(),
            address: draft.address.trim(),
            website:
              draft.website.trim() || null,
            welcomeDescription:
              draft.welcomeDescription.trim() ||
              null,
            favorites: draft.favorites.map(
              (favorite) => ({
                venueId: favorite.venueId,
                label:
                  favorite.label.trim() ||
                  null,
                description:
                  favorite.description.trim() ||
                  null,
              })
            ),
          }),
        }
      )

      const result =
        (await response.json()) as EditorSaveResponse

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error ??
            "Unable to save property changes."
        )
      }

      if (
        !result.property ||
        !Array.isArray(result.favorites)
      ) {
        throw new Error(
          "The server did not confirm the saved property and Host Picks."
        )
      }

      const nextDraft = createDraft(
        result.property,
        result.favorites
      )

      setProperty(result.property)
      setDraft(nextDraft)
      setSavedSnapshot(
        serializeDraft(nextDraft)
      )

      setSaveSuccess(
        "Your property and Host Picks have been saved."
      )
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save property changes."
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  /* =====================================================
   * Loading and access states
   * =================================================== */

  if (status === "loading") {
    return (
      <EditorFrame>
        <div
          role="status"
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300"
        >
          Loading your property editor…
        </div>
      </EditorFrame>
    )
  }

  if (status === "unauthorized") {
    return (
      <EditorFrame>
        <StatusPanel
          title="Property editing unavailable"
          description="You must be signed in as the property's owner or an authorized administrator to edit this guide."
        />
      </EditorFrame>
    )
  }

  if (status === "not-found") {
    return (
      <EditorFrame>
        <StatusPanel
          title="Property not found"
          description="This property could not be found, or its identifier is invalid."
        />
      </EditorFrame>
    )
  }

  if (
    status === "error" ||
    !property ||
    !draft
  ) {
    return (
      <EditorFrame>
        <StatusPanel
          title="Unable to load editor"
          description={
            loadError ??
            "An unexpected error prevented this property from loading."
          }
        />

        <Button
          type="button"
          onClick={() => void loadEditor()}
          className="mt-4 bg-cyan-400 font-bold text-black hover:bg-cyan-300"
        >
          Try again
        </Button>
      </EditorFrame>
    )
  }

  /* =====================================================
   * Editor
   * =================================================== */

  return (
    <EditorFrame>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
            Property management
          </p>

          <h1 className="mt-3 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
            Edit your property
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Update your guest welcome and the places you personally recommend.
          </p>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-bold",
            dirty
              ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
              : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
          ].join(" ")}
        >
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </div>

      <form
        onSubmit={saveChanges}
        className="space-y-6"
      >
        {/* --------------------------------------------- */}
        {/* Property details                              */}
        {/* --------------------------------------------- */}

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl sm:p-7">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
              The essentials
            </p>

            <h2 className="mt-2 text-xl font-black text-white">
              Property details
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="property-edit-name"
                className="text-sm font-semibold text-slate-200"
              >
                Property name
              </label>

              <Input
                id="property-edit-name"
                value={draft.name}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value
                  )
                }
                required
                disabled={saving}
                className="h-12 border-white/10 bg-black/40 text-white"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="property-edit-city"
                className="text-sm font-semibold text-slate-200"
              >
                City
              </label>

              <Input
                id="property-edit-city"
                value={cityLabel}
                readOnly
                className="h-12 cursor-not-allowed border-white/10 bg-black/20 text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="property-edit-slug"
                className="text-sm font-semibold text-slate-200"
              >
                Guide URL identifier
              </label>

              <Input
                id="property-edit-slug"
                value={property.slug}
                readOnly
                className="h-12 cursor-not-allowed border-white/10 bg-black/20 text-slate-400"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="property-edit-address"
                className="text-sm font-semibold text-slate-200"
              >
                Property address
              </label>

              <Input
                id="property-edit-address"
                value={draft.address}
                onChange={(event) =>
                  updateField(
                    "address",
                    event.target.value
                  )
                }
                required
                disabled={saving}
                className="h-12 border-white/10 bg-black/40 text-white"
              />

              <p className="text-xs leading-5 text-slate-500">
                Address changes must be geocoded and validated by the
                server before updating the property's map coordinates.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="property-edit-website"
                className="text-sm font-semibold text-slate-200"
              >
                Website (optional)
              </label>

              <Input
                id="property-edit-website"
                type="url"
                value={draft.website}
                onChange={(event) =>
                  updateField(
                    "website",
                    event.target.value
                  )
                }
                placeholder="https://..."
                disabled={saving}
                className="h-12 border-white/10 bg-black/40 text-white"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label
                htmlFor="property-edit-welcome"
                className="text-sm font-semibold text-slate-200"
              >
                Welcome description
              </label>

              <textarea
                id="property-edit-welcome"
                rows={6}
                value={draft.welcomeDescription}
                onChange={(event) =>
                  updateField(
                    "welcomeDescription",
                    event.target.value
                  )
                }
                disabled={saving}
                placeholder="Welcome to our place..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 disabled:opacity-60"
              />

              <p className="text-xs leading-5 text-slate-500">
                This message appears in your guest guide.
                City and URL identifier remain unchanged.
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------- */}
        {/* Host Picks                                    */}
        {/* --------------------------------------------- */}

        <section className="rounded-[1.75rem] border border-cyan-400/15 bg-cyan-400/[0.035] p-5 shadow-xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                Personal curation
              </p>

              <h2 className="mt-2 text-xl font-black text-white">
                Host Picks
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Choose the places guests should know about.
                Your order and personal recommendations will appear
                on the property guide.
              </p>
            </div>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-100">
              {draft.favorites.length}/{MAX_HOST_FAVORITES} selected
            </span>
          </div>

          {/* Selected favorites */}

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-200">
              Your selected places
            </h3>

            {draft.favorites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5">
                <p className="text-sm font-semibold text-slate-200">
                  No Host Picks selected.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Search the catalog below to add your first recommendation.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {draft.favorites.map(
                  (favorite, index) => (
                    <div
                      key={favorite.venueId}
                      className="rounded-xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-200">
                            {index + 1}
                          </span>

                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-white">
                              {favorite.venue.name}
                            </p>

                            {favorite.venue.address ? (
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {favorite.venue.address}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={
                              saving ||
                              index === 0
                            }
                            onClick={() =>
                              moveFavorite(index, -1)
                            }
                            aria-label={`Move ${favorite.venue.name} up`}
                            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            disabled={
                              saving ||
                              index === draft.favorites.length - 1
                            }
                            onClick={() =>
                              moveFavorite(index, 1)
                            }
                            aria-label={`Move ${favorite.venue.name} down`}
                            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              removeFavorite(
                                favorite.venueId
                              )
                            }
                            aria-label={`Remove ${favorite.venue.name}`}
                            className="rounded-lg border border-rose-400/20 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="space-y-1.5">
                          <label
                            htmlFor={`favorite-label-${favorite.venueId}`}
                            className="text-xs font-semibold text-slate-300"
                          >
                            Custom label (optional)
                          </label>

                          <Input
                            id={`favorite-label-${favorite.venueId}`}
                            value={favorite.label}
                            onChange={(event) =>
                              updateFavorite(
                                favorite.venueId,
                                "label",
                                event.target.value
                              )
                            }
                            maxLength={MAX_FAVORITE_LABEL_LENGTH}
                            disabled={saving}
                            placeholder="e.g. Our go-to morning coffee"
                            className="border-white/10 bg-black/35 text-white placeholder:text-slate-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor={`favorite-description-${favorite.venueId}`}
                            className="text-xs font-semibold text-slate-300"
                          >
                            Personal recommendation (optional)
                          </label>

                          <textarea
                            id={`favorite-description-${favorite.venueId}`}
                            value={favorite.description}
                            onChange={(event) =>
                              updateFavorite(
                                favorite.venueId,
                                "description",
                                event.target.value
                              )
                            }
                            rows={2}
                            maxLength={MAX_FAVORITE_DESCRIPTION_LENGTH}
                            disabled={saving}
                            placeholder="What makes this place worth visiting?"
                            className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Search venues */}

          <div className="mt-7 border-t border-white/10 pt-6">
            <div className="space-y-2">
              <label
                htmlFor="property-edit-venue-search"
                className="text-sm font-bold text-slate-200"
              >
                Add places in {cityLabel}
              </label>

              <Input
                id="property-edit-venue-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSearchPage(1)
                }}
                disabled={saving}
                placeholder="Search restaurants, coffee, bars, shops..."
                className="h-12 border-white/10 bg-black/40 text-white placeholder:text-slate-500"
              />

              <p className="text-xs leading-5 text-slate-500">
                Search results come from Roam's existing public city venue catalog.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                Available places
              </h3>

              {!searchLoading && !searchError ? (
                <span className="text-xs text-slate-500">
                  {searchTotal} matching
                </span>
              ) : null}
            </div>

            {searchError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
              >
                {searchError}
              </p>
            ) : null}

            {searchLoading ? (
              <p
                role="status"
                className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400"
              >
                Searching {cityLabel} venues…
              </p>
            ) : !searchError && searchResults.length === 0 ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No venues matched this search.
              </p>
            ) : (
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {searchResults.map((venue) => {
                  const alreadySelected =
                    selectedVenueIds.has(venue.id)

                  const atLimit =
                    draft.favorites.length >=
                    MAX_HOST_FAVORITES

                  return (
                    <div
                      key={venue.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">
                          {venue.name}
                        </p>

                        {venue.type?.length ? (
                          <p className="mt-1 text-xs text-cyan-200">
                            {venue.type
                              .slice(0, 3)
                              .join(" · ")}
                          </p>
                        ) : null}

                        {venue.address ? (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {venue.address}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          saving ||
                          alreadySelected ||
                          atLimit
                        }
                        onClick={() =>
                          addFavorite(venue)
                        }
                        className="shrink-0 border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
                      >
                        {alreadySelected
                          ? "Selected ✓"
                          : "+ Add"}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {!searchLoading &&
            !searchError &&
            searchTotalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    saving ||
                    searchPage <= 1
                  }
                  onClick={() =>
                    setSearchPage((page) =>
                      Math.max(1, page - 1)
                    )
                  }
                  className="border-white/15 bg-white/5 text-white"
                >
                  Previous
                </Button>

                <span className="text-xs text-slate-400">
                  Page {searchPage} of {searchTotalPages}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    saving ||
                    searchPage >= searchTotalPages
                  }
                  onClick={() =>
                    setSearchPage((page) =>
                      page + 1
                    )
                  }
                  className="border-white/15 bg-white/5 text-white"
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {/* --------------------------------------------- */}
        {/* Save controls                                 */}
        {/* --------------------------------------------- */}

        <div className="rounded-[1.5rem] border border-white/10 bg-[#111618] p-4 sm:p-5">
          {saveError ? (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            >
              {saveError}
            </p>
          ) : null}

          {saveSuccess ? (
            <p
              role="status"
              className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
            >
              {saveSuccess}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {dirty
                  ? "You have changes to save."
                  : "Your property is up to date."}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Saving updates the existing guest guide;
                it does not create a new property.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  navigateTo(guideHref)
                }
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                View guide
              </Button>

              <Button
                type="submit"
                disabled={
                  saving ||
                  !dirty
                }
                className="bg-gradient-to-r from-indigo-500 to-cyan-400 font-black text-white hover:from-indigo-400 hover:to-cyan-300 disabled:opacity-50"
              >
                {saving
                  ? "Saving changes..."
                  : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <button
        type="button"
        onClick={() =>
          navigateTo("/profile#saved")
        }
        className="mt-6 inline-flex min-h-10 items-center text-sm font-semibold text-slate-400 transition hover:text-white"
      >
        ← Back to your properties
      </button>
    </EditorFrame>
  )
}

/* =========================================================
 * Shared page presentation
 * ======================================================= */

function EditorFrame({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-15%] top-[-10%] h-80 w-80 rounded-full bg-cyan-500/[0.08] blur-3xl" />
        <div className="absolute right-[-15%] top-[20%] h-96 w-96 rounded-full bg-indigo-500/[0.07] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-4xl">
        {children}
      </div>
    </main>
  )
}

function StatusPanel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
      <h1 className="text-2xl font-black text-white">
        {title}
      </h1>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <Link
        href="/profile#saved"
        className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        Back to your properties
      </Link>
    </section>
  )
}
