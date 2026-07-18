'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import {
  Archive,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Hotel,
  Layers3,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { supabaseBrowser } from '@/lib/supabase/client'

import GuideBrandEditor from '@/app/venue-admin/GuideBrandEditor'
import GuideSectionsEditor from '@/app/venue-admin/GuideSectionsEditor'
import GuideFeaturedVenuesEditor from './GuideFeaturedVenuesEditor'

import {
  archivePropertyGuideAction,
  deletePropertyGuideAction,
  publishPropertyGuideAction,
  savePropertyGuideAction,
  unpublishPropertyGuideAction,
  type GuideMode,
  type GuideStatus,
  type GuideTravelMode,
  type PropertyGuideInput,
  type PropertyGuideRecord,
} from '@/app/venue-admin/guide-actions'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type Props = {
  className?: string
}

type PropertyOption = {
  id: string
  name: string
  slug: string
  city: string | null
  address: string | null
}

type GuideBrandOption = {
  id: string
  name: string
  slug: string
  branding_mode: string
}

type PropertyGuideRow = PropertyGuideRecord & {
  welcome_heading: string | null
  welcome_description: string | null
  hero_image_url: string | null

  show_property_favorites: boolean
  show_suggested_routes: boolean
  show_nearby_events: boolean
  show_partner_offers: boolean

  default_travel_mode: GuideTravelMode
  powered_by_roam: boolean

  created_at: string
  updated_at: string

  property: PropertyOption | null
  brand: GuideBrandOption | null
}

type GuideFormState = {
  id: string | null

  propertyId: string
  brandId: string

  title: string
  subtitle: string
  slug: string

  status: GuideStatus
  guideMode: GuideMode

  welcomeHeading: string
  welcomeDescription: string
  heroImageUrl: string

  showPropertyFavorites: boolean
  showSuggestedRoutes: boolean
  showNearbyEvents: boolean
  showPartnerOffers: boolean

  defaultTravelMode: GuideTravelMode
  poweredByRoam: boolean

  publishedAt: string
}

type Notice = {
  tone: 'success' | 'error'
  message: string
}

type AdminView =
  | 'overview'
  | 'guide'
  | 'brand'
  | 'sections'
  | 'venues'

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const GUIDE_STATUSES: Array<{
  value: GuideStatus
  label: string
  description: string
}> = [
  {
    value: 'draft',
    label: 'Draft',
    description:
      'Visible only to authorized guide administrators.',
  },
  {
    value: 'active',
    label: 'Active',
    description:
      'Published and available on the public guide URL.',
  },
  {
    value: 'archived',
    label: 'Archived',
    description:
      'Retained for reference but removed from public access.',
  },
]

const GUIDE_MODES: Array<{
  value: GuideMode
  label: string
  description: string
}> = [
  {
    value: 'hotel',
    label: 'Hotel',
    description:
      'A guest-facing neighborhood and hospitality guide.',
  },
  {
    value: 'concierge',
    label: 'Concierge',
    description:
      'A more explicitly staff-curated recommendation experience.',
  },
  {
    value: 'partner',
    label: 'Partner',
    description:
      'A guide led by a non-hotel venue or commercial partner.',
  },
  {
    value: 'roam',
    label: 'Roam',
    description:
      'A Roam-led guide using the standard platform identity.',
  },
]

const TRAVEL_MODES: Array<{
  value: GuideTravelMode
  label: string
}> = [
  {
    value: 'walking',
    label: 'Walking',
  },
  {
    value: 'driving',
    label: 'Driving',
  },
  {
    value: 'transit',
    label: 'Transit',
  },
  {
    value: 'rideshare',
    label: 'Rideshare',
  },
]

const EMPTY_FORM: GuideFormState = {
  id: null,

  propertyId: '',
  brandId: '',

  title: '',
  subtitle: '',
  slug: '',

  status: 'draft',
  guideMode: 'hotel',

  welcomeHeading: '',
  welcomeDescription: '',
  heroImageUrl: '',

  showPropertyFavorites: true,
  showSuggestedRoutes: true,
  showNearbyEvents: true,
  showPartnerOffers: false,

  defaultTravelMode: 'walking',
  poweredByRoam: true,

  publishedAt: '',
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function PropertyGuidesAdmin({
  className,
}: Props) {
  const [supabase] = useState(() => supabaseBrowser())

  const [guides, setGuides] = useState<PropertyGuideRow[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [brands, setBrands] = useState<GuideBrandOption[]>([])

  const [selectedGuideId, setSelectedGuideId] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')

  const [activeView, setActiveView] =
    useState<AdminView>('overview')

  const [form, setForm] =
    useState<GuideFormState>(EMPTY_FORM)

  const [editorOpen, setEditorOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [guideSearch, setGuideSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [isSaving, startSaving] = useTransition()
  const [isMutating, startMutating] = useTransition()

  const busy = isSaving || isMutating

  /* ---------------------------------------------- */
  /* Data loading                                   */
  /* ---------------------------------------------- */

  const loadData = useCallback(async () => {
    setLoading(true)
    setNotice(null)

    const [
      { data: guideData, error: guideError },
      { data: propertyData, error: propertyError },
      { data: brandData, error: brandError },
    ] = await Promise.all([
      supabase
        .from('property_guides')
        .select(
          `
          id,
          property_id,
          brand_id,
          title,
          subtitle,
          slug,
          status,
          guide_mode,
          welcome_heading,
          welcome_description,
          hero_image_url,
          show_property_favorites,
          show_suggested_routes,
          show_nearby_events,
          show_partner_offers,
          default_travel_mode,
          powered_by_roam,
          published_at,
          created_at,
          updated_at,
          properties (
            id,
            name,
            slug,
            city,
            address
          ),
          guide_brands (
            id,
            name,
            slug,
            branding_mode
          )
        `
        )
        .order('updated_at', { ascending: false }),

      supabase
        .from('properties')
        .select('id, name, slug, city, address')
        .order('name', { ascending: true }),

      supabase
        .from('guide_brands')
        .select('id, name, slug, branding_mode')
        .order('name', { ascending: true }),
    ])

    if (guideError || propertyError || brandError) {
      console.error('[PropertyGuidesAdmin] Load failure:', {
        guideError,
        propertyError,
        brandError,
      })

      setNotice({
        tone: 'error',
        message:
          guideError?.message ??
          propertyError?.message ??
          brandError?.message ??
          'Unable to load guide administration data.',
      })

      setLoading(false)
      return
    }

    const normalizedGuides = ((guideData ?? []) as unknown[]).map(
      normalizeGuideRow
    )

    const normalizedProperties = ((propertyData ?? []) as unknown[])
      .map(normalizePropertyOption)
      .filter(
        (property): property is PropertyOption =>
          Boolean(property)
      )

    const normalizedBrands = ((brandData ?? []) as unknown[])
      .map(normalizeBrandOption)
      .filter(
        (brand): brand is GuideBrandOption =>
          Boolean(brand)
      )

    setGuides(normalizedGuides)
    setProperties(normalizedProperties)
    setBrands(normalizedBrands)

    setSelectedGuideId((current) => {
      if (
        current &&
        normalizedGuides.some(
          (guide) => guide.id === current
        )
      ) {
        return current
      }

      return normalizedGuides[0]?.id ?? ''
    })

    setSelectedBrandId((current) => {
      if (
        current &&
        normalizedBrands.some(
          (brand) => brand.id === current
        )
      ) {
        return current
      }

      return normalizedBrands[0]?.id ?? ''
    })

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  /* ---------------------------------------------- */
  /* Derived state                                  */
  /* ---------------------------------------------- */

  const selectedGuide = useMemo(
    () =>
      guides.find(
        (guide) => guide.id === selectedGuideId
      ) ?? null,
    [guides, selectedGuideId]
  )

  const selectedProperty = useMemo(
    () =>
      properties.find(
        (property) =>
          property.id === form.propertyId
      ) ?? null,
    [form.propertyId, properties]
  )

  const filteredGuides = useMemo(() => {
    const query = guideSearch.trim().toLowerCase()

    if (!query) {
      return guides
    }

    return guides.filter((guide) => {
      const searchText = [
        guide.title,
        guide.slug,
        guide.property?.name,
        guide.property?.city,
        guide.brand?.name,
        guide.status,
        guide.guide_mode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchText.includes(query)
    })
  }, [guideSearch, guides])

  const guideCounts = useMemo(
    () => ({
      all: guides.length,
      active: guides.filter(
        (guide) => guide.status === 'active'
      ).length,
      draft: guides.filter(
        (guide) => guide.status === 'draft'
      ).length,
      archived: guides.filter(
        (guide) => guide.status === 'archived'
      ).length,
    }),
    [guides]
  )

  useEffect(() => {
    if (!selectedGuide || editorOpen) return

    setForm(mapGuideToForm(selectedGuide))
    setSelectedBrandId(
      selectedGuide.brand_id ??
        selectedGuide.brand?.id ??
        ''
    )
  }, [editorOpen, selectedGuide])

  /* ---------------------------------------------- */
  /* Selection                                      */
  /* ---------------------------------------------- */

  function handleSelectGuide(guideId: string) {
    setSelectedGuideId(guideId)
    setNotice(null)
    setEditorOpen(false)

    const guide = guides.find(
      (item) => item.id === guideId
    )

    if (guide) {
      setForm(mapGuideToForm(guide))
      setSelectedBrandId(
        guide.brand_id ?? guide.brand?.id ?? ''
      )
    }
  }

  /* ---------------------------------------------- */
  /* Editor lifecycle                               */
  /* ---------------------------------------------- */

  function openCreateEditor() {
    const defaultProperty = properties[0] ?? null
    const defaultBrand = brands[0] ?? null

    setForm({
      ...EMPTY_FORM,
      propertyId: defaultProperty?.id ?? '',
      brandId: defaultBrand?.id ?? '',
      title: defaultProperty
        ? `${defaultProperty.name} Guide`
        : '',
      slug: defaultProperty?.slug
        ? slugify(defaultProperty.slug)
        : '',
      welcomeHeading: defaultProperty
        ? `Welcome to ${defaultProperty.name}`
        : '',
    })

    setEditorOpen(true)
    setAdvancedOpen(false)
    setNotice(null)
  }

  function openEditEditor() {
    if (!selectedGuide) return

    setForm(mapGuideToForm(selectedGuide))
    setEditorOpen(true)
    setNotice(null)
  }

  function closeEditor() {
    if (busy) return

    if (selectedGuide) {
      setForm(mapGuideToForm(selectedGuide))
    } else {
      setForm(EMPTY_FORM)
    }

    setEditorOpen(false)
    setAdvancedOpen(false)
  }

  function updateForm<K extends keyof GuideFormState>(
    key: K,
    value: GuideFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handlePropertyChange(propertyId: string) {
    const property = properties.find(
      (item) => item.id === propertyId
    )

    setForm((current) => {
      if (!property) {
        return {
          ...current,
          propertyId,
        }
      }

      const previousProperty = properties.find(
        (item) =>
          item.id === current.propertyId
      )

      const shouldUpdateTitle =
        !current.id &&
        (
          !current.title.trim() ||
          current.title ===
            `${previousProperty?.name ?? ''} Guide`
        )

      const shouldUpdateSlug =
        !current.id &&
        (
          !current.slug.trim() ||
          current.slug ===
            slugify(previousProperty?.slug ?? '')
        )

      const shouldUpdateWelcome =
        !current.id &&
        (
          !current.welcomeHeading.trim() ||
          current.welcomeHeading ===
            `Welcome to ${
              previousProperty?.name ?? ''
            }`
        )

      return {
        ...current,
        propertyId,
        title: shouldUpdateTitle
          ? `${property.name} Guide`
          : current.title,
        slug: shouldUpdateSlug
          ? slugify(property.slug)
          : current.slug,
        welcomeHeading: shouldUpdateWelcome
          ? `Welcome to ${property.name}`
          : current.welcomeHeading,
      }
    })
  }

  /* ---------------------------------------------- */
  /* Save                                           */
  /* ---------------------------------------------- */

  function handleSave() {
    setNotice(null)

    const validation = validateGuideForm(form)

    if (!validation.success) {
      setNotice({
        tone: 'error',
        message: validation.error,
      })
      return
    }

    const payload: PropertyGuideInput = {
      id: form.id,

      propertyId: form.propertyId,
      brandId: form.brandId || null,

      title: form.title,
      subtitle: form.subtitle,
      slug: form.slug,

      status: form.status,
      guideMode: form.guideMode,

      welcomeHeading: form.welcomeHeading,
      welcomeDescription:
        form.welcomeDescription,
      heroImageUrl: form.heroImageUrl,

      showPropertyFavorites:
        form.showPropertyFavorites,
      showSuggestedRoutes:
        form.showSuggestedRoutes,
      showNearbyEvents:
        form.showNearbyEvents,
      showPartnerOffers:
        form.showPartnerOffers,

      defaultTravelMode:
        form.defaultTravelMode,
      poweredByRoam:
        form.poweredByRoam,

      publishedAt:
        form.publishedAt || null,
    }

    startSaving(async () => {
      const result =
        await savePropertyGuideAction(payload)

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setNotice({
        tone: 'success',
        message: form.id
          ? 'Property guide updated.'
          : 'Property guide created with default sections.',
      })

      setEditorOpen(false)

      await loadData()

      setSelectedGuideId(result.data.id)
      setActiveView('guide')
    })
  }

  /* ---------------------------------------------- */
  /* Duplicate                                      */
  /* ---------------------------------------------- */

  function handleDuplicate() {
    if (!selectedGuide) return

    const duplicatedTitle =
      `${selectedGuide.title} Copy`

    setForm({
      ...mapGuideToForm(selectedGuide),
      id: null,
      title: duplicatedTitle,
      slug: createDuplicateSlug(
        selectedGuide.slug,
        guides.map((guide) => guide.slug)
      ),
      status: 'draft',
      publishedAt: '',
    })

    setEditorOpen(true)
    setAdvancedOpen(false)
    setNotice(null)
  }

  /* ---------------------------------------------- */
  /* Publish                                        */
  /* ---------------------------------------------- */

  function handlePublish() {
    if (!selectedGuide) return

    setNotice(null)

    startMutating(async () => {
      const result =
        await publishPropertyGuideAction(
          selectedGuide.id
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setGuides((current) =>
        current.map((guide) =>
          guide.id === result.data.id
            ? {
                ...guide,
                status: result.data.status,
                published_at:
                  result.data.published_at,
              }
            : guide
        )
      )

      setNotice({
        tone: 'success',
        message: 'Property guide published.',
      })
    })
  }

  function handleUnpublish() {
    if (!selectedGuide) return

    const confirmed = window.confirm(
      `Unpublish “${selectedGuide.title}”? The public guide URL will no longer be available.`
    )

    if (!confirmed) return

    setNotice(null)

    startMutating(async () => {
      const result =
        await unpublishPropertyGuideAction(
          selectedGuide.id
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setGuides((current) =>
        current.map((guide) =>
          guide.id === result.data.id
            ? {
                ...guide,
                status: result.data.status,
              }
            : guide
        )
      )

      setNotice({
        tone: 'success',
        message: 'Property guide returned to draft.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Archive                                        */
  /* ---------------------------------------------- */

  function handleArchive() {
    if (!selectedGuide) return

    const confirmed = window.confirm(
      `Archive “${selectedGuide.title}”? It will be removed from public access but retained in the database.`
    )

    if (!confirmed) return

    setNotice(null)

    startMutating(async () => {
      const result =
        await archivePropertyGuideAction(
          selectedGuide.id
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setGuides((current) =>
        current.map((guide) =>
          guide.id === result.data.id
            ? {
                ...guide,
                status: result.data.status,
              }
            : guide
        )
      )

      setNotice({
        tone: 'success',
        message: 'Property guide archived.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Delete                                         */
  /* ---------------------------------------------- */

  function handleDelete() {
    if (!selectedGuide) return

    const confirmed = window.confirm(
      `Permanently delete “${selectedGuide.title}”?\n\nIts sections and featured venue assignments will also be deleted. This cannot be undone.`
    )

    if (!confirmed) return

    setNotice(null)

    startMutating(async () => {
      const result =
        await deletePropertyGuideAction(
          selectedGuide.id
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      const remainingGuides = guides.filter(
        (guide) => guide.id !== selectedGuide.id
      )

      setGuides(remainingGuides)
      setSelectedGuideId(
        remainingGuides[0]?.id ?? ''
      )
      setActiveView('overview')

      setNotice({
        tone: 'success',
        message: 'Property guide deleted.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Brand callback                                 */
  /* ---------------------------------------------- */

  function handleBrandChange(brandId: string) {
    setSelectedBrandId(brandId)

    setForm((current) => ({
      ...current,
      brandId,
    }))

    void loadBrandsOnly()
  }

  async function loadBrandsOnly() {
    const { data, error } = await supabase
      .from('guide_brands')
      .select('id, name, slug, branding_mode')
      .order('name', { ascending: true })

    if (error) {
      console.error(
        '[PropertyGuidesAdmin] Brand refresh failed:',
        error
      )
      return
    }

    setBrands(
      ((data ?? []) as unknown[])
        .map(normalizeBrandOption)
        .filter(
          (
            brand
          ): brand is GuideBrandOption =>
            Boolean(brand)
        )
    )
  }

  /* ---------------------------------------------- */
  /* Loading                                        */
  /* ---------------------------------------------- */

  if (loading) {
    return (
      <AdminCard className={className}>
        <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          Loading property guides…
        </div>
      </AdminCard>
    )
  }

  return (
    <div
      className={[
        'space-y-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AdminCard>
        <div className="space-y-6">
          <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
                White-label guide operations
              </p>

              <h2 className="mt-1 text-2xl font-semibold text-white">
                Property Guides
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
                Create, brand, publish, structure, and curate
                hotel and partner guides from one administrative
                workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateEditor}
              disabled={
                busy ||
                properties.length === 0
              }
              className={primaryButtonClassName}
            >
              <Plus className="h-4 w-4" />
              New Guide
            </button>
          </header>

          {notice ? (
            <NoticeBanner notice={notice} />
          ) : null}

          <GuideMetrics counts={guideCounts} />

          <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />

                <input
                  value={guideSearch}
                  onChange={(event) =>
                    setGuideSearch(event.target.value)
                  }
                  placeholder="Search guides"
                  className={`${inputClassName} pl-9`}
                />
              </div>

              <GuideList
                guides={filteredGuides}
                selectedGuideId={selectedGuideId}
                disabled={busy}
                onSelect={handleSelectGuide}
              />
            </aside>

            <main className="min-w-0">
              {selectedGuide ? (
                <GuideWorkspace
                  guide={selectedGuide}
                  activeView={activeView}
                  busy={busy}
                  onViewChange={setActiveView}
                  onEdit={openEditEditor}
                  onDuplicate={handleDuplicate}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                />
              ) : (
                <EmptyState
                  title="No property guide selected"
                  description={
                    guides.length === 0
                      ? 'Create the first property guide to begin building a hotel demo.'
                      : 'Select a guide from the list to manage it.'
                  }
                  action={
                    guides.length === 0 ? (
                      <button
                        type="button"
                        onClick={openCreateEditor}
                        disabled={
                          properties.length === 0
                        }
                        className={`${primaryButtonClassName} mt-4`}
                      >
                        <Plus className="h-4 w-4" />
                        Create First Guide
                      </button>
                    ) : undefined
                  }
                />
              )}
            </main>
          </div>
        </div>
      </AdminCard>

      {selectedGuide &&
      activeView === 'brand' ? (
        <GuideBrandEditor
          selectedBrandId={
            selectedGuide.brand_id ??
            selectedBrandId
          }
          onBrandChange={handleBrandChange}
        />
      ) : null}

      {selectedGuide &&
      activeView === 'sections' ? (
        <GuideSectionsEditor
          guideId={selectedGuide.id}
          guideTitle={selectedGuide.title}
        />
      ) : null}

      {selectedGuide &&
      activeView === 'venues' ? (
        <GuideFeaturedVenuesEditor
          guideId={selectedGuide.id}
          guideTitle={selectedGuide.title}
        />
      ) : null}

      {editorOpen ? (
        <PropertyGuideEditor
          form={form}
          properties={properties}
          brands={brands}
          selectedProperty={selectedProperty}
          isSaving={isSaving}
          advancedOpen={advancedOpen}
          onAdvancedToggle={() =>
            setAdvancedOpen((current) => !current)
          }
          onChange={updateForm}
          onPropertyChange={handlePropertyChange}
          onSave={handleSave}
          onCancel={closeEditor}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------ */
/* Workspace                                        */
/* ------------------------------------------------ */

function GuideWorkspace({
  guide,
  activeView,
  busy,
  onViewChange,
  onEdit,
  onDuplicate,
  onPublish,
  onUnpublish,
  onArchive,
  onDelete,
}: {
  guide: PropertyGuideRow
  activeView: AdminView
  busy: boolean
  onViewChange: (view: AdminView) => void
  onEdit: () => void
  onDuplicate: () => void
  onPublish: () => void
  onUnpublish: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/30">
      <div className="border-b border-neutral-800 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={guide.status} />

              <Pill>{humanize(guide.guide_mode)}</Pill>

              {guide.brand ? (
                <Pill tone="accent">
                  {guide.brand.name}
                </Pill>
              ) : (
                <Pill>No brand assigned</Pill>
              )}
            </div>

            <h3 className="mt-3 text-xl font-semibold text-white">
              {guide.title}
            </h3>

            {guide.subtitle ? (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
                {guide.subtitle}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <Hotel className="h-3.5 w-3.5" />
                {guide.property?.name ??
                  'Unknown property'}
              </span>

              {guide.property?.city ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {guide.property.city}
                </span>
              ) : null}

              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5" />
                /guide/{guide.slug}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
                type="button"
                onClick={onEdit}
                disabled={busy}
                className={secondaryButtonClassName}
            >
                <Pencil className="h-4 w-4" />
                Edit
            </button>

            <button
                type="button"
                onClick={onDuplicate}
                disabled={busy}
                className={secondaryButtonClassName}
            >
                <Copy className="h-4 w-4" />
                Duplicate
            </button>

            <Link
                href={`/venue-admin/guides/${encodeURIComponent(
                guide.id
                )}/preview`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Preview ${guide.title}`}
                className={secondaryButtonClassName}
            >
                <Eye className="h-4 w-4" />
                Preview Guide
            </Link>

            {guide.status === 'active' ? (
                <Link
                href={`/guide/${encodeURIComponent(
                    guide.slug
                )}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open published guide for ${guide.title}`}
                className={primaryButtonClassName}
                >
                <ExternalLink className="h-4 w-4" />
                Open Guide
                </Link>
            ) : null}
            </div>
        </div>
      </div>

      <WorkspaceTabs
        activeView={activeView}
        onChange={onViewChange}
      />

      <div className="p-4 sm:p-5">
        {activeView === 'overview' ? (
          <GuideOverview guide={guide} />
        ) : null}

        {activeView === 'guide' ? (
          <GuideActionsPanel
            guide={guide}
            busy={busy}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ) : null}

        {activeView === 'brand' ? (
          <EmbeddedEditorNotice
            icon={<Sparkles className="h-5 w-5" />}
            title="Brand editor opened below"
            description="Edit or create visual identities, then assign the desired brand to this guide through Edit Guide."
          />
        ) : null}

        {activeView === 'sections' ? (
          <EmbeddedEditorNotice
            icon={<Layers3 className="h-5 w-5" />}
            title="Section editor opened below"
            description="Configure section order, labels, visibility, presentation, and filtering."
          />
        ) : null}

        {activeView === 'venues' ? (
          <EmbeddedEditorNotice
            icon={<MapPin className="h-5 w-5" />}
            title="Featured venue editor opened below"
            description="Assign deliberate hotel recommendations, custom descriptions, concierge notes, and ordering."
          />
        ) : null}
      </div>
    </div>
  )
}

function WorkspaceTabs({
  activeView,
  onChange,
}: {
  activeView: AdminView
  onChange: (view: AdminView) => void
}) {
  const tabs: Array<{
    value: AdminView
    label: string
    icon: React.ReactNode
  }> = [
    {
      value: 'overview',
      label: 'Overview',
      icon: <Eye className="h-4 w-4" />,
    },
    {
      value: 'guide',
      label: 'Publishing',
      icon: <Globe2 className="h-4 w-4" />,
    },
    {
      value: 'brand',
      label: 'Brand',
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      value: 'sections',
      label: 'Sections',
      icon: <Layers3 className="h-4 w-4" />,
    },
    {
      value: 'venues',
      label: 'Venues',
      icon: <MapPin className="h-4 w-4" />,
    },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-neutral-800 px-4 py-3 sm:px-5">
      {tabs.map((tab) => {
        const active = activeView === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={[
              'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
              active
                ? 'border-cyan-300 bg-cyan-300 text-neutral-950'
                : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------ */
/* Overview                                         */
/* ------------------------------------------------ */

function GuideOverview({
  guide,
}: {
  guide: PropertyGuideRow
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard
        eyebrow="Property"
        title={
          guide.property?.name ??
          'Unknown property'
        }
        items={[
          {
            label: 'City',
            value:
              guide.property?.city ?? 'Not set',
          },
          {
            label: 'Property slug',
            value:
              guide.property?.slug ?? 'Not set',
          },
          {
            label: 'Address',
            value:
              guide.property?.address ?? 'Not set',
          },
        ]}
      />

      <InfoCard
        eyebrow="Guide identity"
        title={guide.title}
        items={[
          {
            label: 'Guide slug',
            value: guide.slug,
          },
          {
            label: 'Brand',
            value:
              guide.brand?.name ?? 'Unassigned',
          },
          {
            label: 'Mode',
            value: humanize(guide.guide_mode),
          },
        ]}
      />

      <InfoCard
        eyebrow="Guest experience"
        title={
          guide.welcome_heading ??
          'No welcome heading'
        }
        items={[
          {
            label: 'Travel mode',
            value: humanize(
              guide.default_travel_mode
            ),
          },
          {
            label: 'Powered by Roam',
            value: guide.powered_by_roam
              ? 'Visible'
              : 'Hidden',
          },
          {
            label: 'Hero image',
            value: guide.hero_image_url
              ? 'Configured'
              : 'Not configured',
          },
        ]}
      />

      <InfoCard
        eyebrow="Features"
        title="Enabled modules"
        items={[
          {
            label: 'Hotel picks',
            value:
              guide.show_property_favorites
                ? 'Enabled'
                : 'Disabled',
          },
          {
            label: 'Suggested flows',
            value:
              guide.show_suggested_routes
                ? 'Enabled'
                : 'Disabled',
          },
          {
            label: 'Nearby events',
            value:
              guide.show_nearby_events
                ? 'Enabled'
                : 'Disabled',
          },
          {
            label: 'Partner offers',
            value:
              guide.show_partner_offers
                ? 'Enabled'
                : 'Disabled',
          },
        ]}
      />
    </div>
  )
}

/* ------------------------------------------------ */
/* Guide actions                                    */
/* ------------------------------------------------ */

function GuideActionsPanel({
  guide,
  busy,
  onPublish,
  onUnpublish,
  onArchive,
  onDelete,
}: {
  guide: PropertyGuideRow
  busy: boolean
  onPublish: () => void
  onUnpublish: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Publication status
            </p>

            <div className="mt-2">
              <StatusPill status={guide.status} />
            </div>

            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
              {getStatusDescription(guide.status)}
            </p>

            {guide.published_at ? (
              <p className="mt-2 text-xs text-neutral-600">
                Published{' '}
                {formatDateTime(
                  guide.published_at
                )}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
                href={`/venue-admin/guides/${encodeURIComponent(
                guide.id
                )}/preview`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Preview ${guide.title}`}
                className={secondaryButtonClassName}
            >
                <Eye className="h-4 w-4" />
                Preview Guide
            </Link>

            {guide.status === 'active' ? (
                <Link
                href={`/guide/${encodeURIComponent(
                    guide.slug
                )}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open published guide for ${guide.title}`}
                className={secondaryButtonClassName}
                >
                <ExternalLink className="h-4 w-4" />
                Open Published Guide
                </Link>
            ) : null}

            {guide.status !== 'active' ? (
                <button
                type="button"
                onClick={onPublish}
                disabled={busy}
                className={primaryButtonClassName}
                >
                {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Globe2 className="h-4 w-4" />
                )}

                Publish
                </button>
            ) : (
                <button
                type="button"
                onClick={onUnpublish}
                disabled={busy}
                className={secondaryButtonClassName}
                >
                <EyeOff className="h-4 w-4" />
                Unpublish
                </button>
            )}

            {guide.status !== 'archived' ? (
                <button
                type="button"
                onClick={onArchive}
                disabled={busy}
                className={secondaryButtonClassName}
                >
                <Archive className="h-4 w-4" />
                Archive
                </button>
            ) : null}
            </div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4">
        <p className="text-sm font-semibold text-red-200">
          Danger zone
        </p>

        <p className="mt-1 max-w-xl text-xs leading-5 text-red-200/60">
          Deleting a guide also deletes its sections and
          featured venue assignments through cascading
          foreign keys.
        </p>

        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={`${dangerButtonClassName} mt-4`}
        >
          <Trash2 className="h-4 w-4" />
          Delete Guide Permanently
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Guide list                                       */
/* ------------------------------------------------ */

function GuideList({
  guides,
  selectedGuideId,
  disabled,
  onSelect,
}: {
  guides: PropertyGuideRow[]
  selectedGuideId: string
  disabled: boolean
  onSelect: (guideId: string) => void
}) {
  if (guides.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-black/30 p-5 text-center">
        <FileText className="mx-auto h-5 w-5 text-neutral-600" />

        <p className="mt-2 text-sm font-semibold text-white">
          No matching guides
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          Adjust the search or create a new guide.
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
      {guides.map((guide) => {
        const selected =
          guide.id === selectedGuideId

        return (
          <button
            key={guide.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(guide.id)}
            className={[
              'w-full rounded-2xl border p-3 text-left transition',
              selected
                ? 'border-cyan-400/50 bg-cyan-400/10'
                : 'border-neutral-800 bg-black/30 hover:border-neutral-700 hover:bg-neutral-950',
              disabled
                ? 'cursor-not-allowed opacity-60'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                  selected
                    ? 'border-cyan-300/40 bg-cyan-300 text-neutral-950'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-500',
                ].join(' ')}
              >
                <Hotel className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {guide.title}
                  </p>

                  <StatusDot
                    status={guide.status}
                  />
                </div>

                <p className="mt-1 truncate text-xs text-neutral-500">
                  {guide.property?.name ??
                    'Unknown property'}
                </p>

                <p className="mt-1 truncate text-[11px] text-neutral-600">
                  /guide/{guide.slug}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------ */
/* Editor                                           */
/* ------------------------------------------------ */

function PropertyGuideEditor({
  form,
  properties,
  brands,
  selectedProperty,
  isSaving,
  advancedOpen,
  onAdvancedToggle,
  onChange,
  onPropertyChange,
  onSave,
  onCancel,
}: {
  form: GuideFormState
  properties: PropertyOption[]
  brands: GuideBrandOption[]
  selectedProperty: PropertyOption | null
  isSaving: boolean
  advancedOpen: boolean
  onAdvancedToggle: () => void
  onChange: <K extends keyof GuideFormState>(
    key: K,
    value: GuideFormState[K]
  ) => void
  onPropertyChange: (propertyId: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <AdminCard>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
              {form.id
                ? 'Edit property guide'
                : 'Create property guide'}
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              {form.id
                ? form.title ||
                  'Property Guide'
                : 'New Property Guide'}
            </h2>

            <p className="mt-1 text-sm leading-6 text-neutral-400">
              Configure guide-wide identity, publication,
              welcome content, and enabled modules.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Close guide editor"
            className="rounded-full border border-neutral-800 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-6">
          <section className="space-y-4">
            <SectionHeading
              icon={<Building2 className="h-4 w-4" />}
              title="Guide identity"
              description="Connect the guide to a property, brand, and public URL."
            />

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Property" required>
                <select
                  value={form.propertyId}
                  disabled={
                    isSaving ||
                    Boolean(form.id)
                  }
                  onChange={(event) =>
                    onPropertyChange(
                      event.target.value
                    )
                  }
                  className={inputClassName}
                >
                  <option value="">
                    Select a property
                  </option>

                  {properties.map((property) => (
                    <option
                      key={property.id}
                      value={property.id}
                    >
                      {property.name}
                      {property.city
                        ? ` — ${property.city}`
                        : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Guide brand">
                <select
                  value={form.brandId}
                  disabled={isSaving}
                  onChange={(event) =>
                    onChange(
                      'brandId',
                      event.target.value
                    )
                  }
                  className={inputClassName}
                >
                  <option value="">
                    No custom brand
                  </option>

                  {brands.map((brand) => (
                    <option
                      key={brand.id}
                      value={brand.id}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Guide title" required>
                <input
                  value={form.title}
                  disabled={isSaving}
                  maxLength={160}
                  onChange={(event) =>
                    onChange(
                      'title',
                      event.target.value
                    )
                  }
                  placeholder="Your Atlanta Guide"
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Public guide slug"
                required
                hint="The final URL will be /guide/your-slug."
              >
                <input
                  value={form.slug}
                  disabled={isSaving}
                  onChange={(event) =>
                    onChange(
                      'slug',
                      slugify(
                        event.target.value
                      )
                    )
                  }
                  placeholder="hotel-indigo-atlanta"
                  className={inputClassName}
                />
              </Field>
            </div>

            <Field label="Guide subtitle">
              <textarea
                value={form.subtitle}
                disabled={isSaving}
                maxLength={500}
                rows={3}
                onChange={(event) =>
                  onChange(
                    'subtitle',
                    event.target.value
                  )
                }
                placeholder="A locally curated stay built around nearby places and easy experiences."
                className={`${inputClassName} resize-y`}
              />
            </Field>

            {selectedProperty ? (
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-3 text-xs text-neutral-500">
                <span className="font-semibold text-neutral-300">
                  Selected property:
                </span>{' '}
                {selectedProperty.name}
                {selectedProperty.city
                  ? ` · ${selectedProperty.city}`
                  : ''}
                {selectedProperty.address
                  ? ` · ${selectedProperty.address}`
                  : ''}
              </div>
            ) : null}
          </section>

          <section className="space-y-4 border-t border-neutral-800 pt-6">
            <SectionHeading
              icon={<FileText className="h-4 w-4" />}
              title="Welcome content"
              description="Set the lead copy and optional hero image shown at the top of the public guide."
            />

            <Field label="Welcome heading">
              <input
                value={form.welcomeHeading}
                disabled={isSaving}
                maxLength={200}
                onChange={(event) =>
                  onChange(
                    'welcomeHeading',
                    event.target.value
                  )
                }
                placeholder="Welcome to Atlanta"
                className={inputClassName}
              />
            </Field>

            <Field label="Welcome description">
              <textarea
                value={
                  form.welcomeDescription
                }
                disabled={isSaving}
                maxLength={5000}
                rows={5}
                onChange={(event) =>
                  onChange(
                    'welcomeDescription',
                    event.target.value
                  )
                }
                placeholder="Explore a thoughtfully curated collection of nearby restaurants, coffee shops, experiences, and easy neighborhood flows."
                className={`${inputClassName} resize-y`}
              />
            </Field>

            <Field
              label="Hero image URL"
              hint="Use a public URL or a path from the project’s public directory."
            >
              <input
                value={form.heroImageUrl}
                disabled={isSaving}
                onChange={(event) =>
                  onChange(
                    'heroImageUrl',
                    event.target.value
                  )
                }
                placeholder="/images/guides/hotel-indigo-atlanta-hero.jpg"
                className={inputClassName}
              />
            </Field>
          </section>

          <section className="space-y-4 border-t border-neutral-800 pt-6">
            <SectionHeading
              icon={<Layers3 className="h-4 w-4" />}
              title="Guide modules"
              description="Control which major platform features are available to the guest."
            />

            <div className="grid gap-3 md:grid-cols-2">
              <ToggleCard
                checked={
                  form.showPropertyFavorites
                }
                disabled={isSaving}
                title="Hotel picks"
                description="Show curated property favorites and featured recommendations."
                onChange={(checked) =>
                  onChange(
                    'showPropertyFavorites',
                    checked
                  )
                }
              />

              <ToggleCard
                checked={
                  form.showSuggestedRoutes
                }
                disabled={isSaving}
                title="Suggested flows"
                description="Show contextual Roam-generated nearby flows."
                onChange={(checked) =>
                  onChange(
                    'showSuggestedRoutes',
                    checked
                  )
                }
              />

              <ToggleCard
                checked={
                  form.showNearbyEvents
                }
                disabled={isSaving}
                title="Nearby events"
                description="Show relevant upcoming events and event-led journeys."
                onChange={(checked) =>
                  onChange(
                    'showNearbyEvents',
                    checked
                  )
                }
              />

              <ToggleCard
                checked={
                  form.showPartnerOffers
                }
                disabled={isSaving}
                title="Partner offers"
                description="Reserve space for partner perks and future guide-specific offers."
                onChange={(checked) =>
                  onChange(
                    'showPartnerOffers',
                    checked
                  )
                }
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-neutral-800 pt-6">
            <SectionHeading
              icon={<Globe2 className="h-4 w-4" />}
              title="Publication"
              description="Set the operating mode, travel assumptions, and draft or published state."
            />

            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Guide status">
                <select
                  value={form.status}
                  disabled={isSaving}
                  onChange={(event) =>
                    onChange(
                      'status',
                      event.target
                        .value as GuideStatus
                    )
                  }
                  className={inputClassName}
                >
                  {GUIDE_STATUSES.map(
                    (status) => (
                      <option
                        key={status.value}
                        value={status.value}
                      >
                        {status.label}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Guide mode">
                <select
                  value={form.guideMode}
                  disabled={isSaving}
                  onChange={(event) =>
                    onChange(
                      'guideMode',
                      event.target
                        .value as GuideMode
                    )
                  }
                  className={inputClassName}
                >
                  {GUIDE_MODES.map((mode) => (
                    <option
                      key={mode.value}
                      value={mode.value}
                    >
                      {mode.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Default travel mode">
                <select
                  value={
                    form.defaultTravelMode
                  }
                  disabled={isSaving}
                  onChange={(event) =>
                    onChange(
                      'defaultTravelMode',
                      event.target
                        .value as GuideTravelMode
                    )
                  }
                  className={inputClassName}
                >
                  {TRAVEL_MODES.map((mode) => (
                    <option
                      key={mode.value}
                      value={mode.value}
                    >
                      {mode.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <ToggleCard
              checked={form.poweredByRoam}
              disabled={isSaving}
              title="Powered by Roam"
              description="Show Roam attribution unless the selected brand and agreement require full white labeling."
              onChange={(checked) =>
                onChange(
                  'poweredByRoam',
                  checked
                )
              }
            />

            <button
              type="button"
              onClick={onAdvancedToggle}
              className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-black/30 p-4 text-left transition hover:border-neutral-700"
            >
              <span>
                <span className="block text-sm font-semibold text-white">
                  Advanced publication timing
                </span>

                <span className="mt-1 block text-xs text-neutral-500">
                  Set or inspect a specific publication timestamp.
                </span>
              </span>

              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 text-neutral-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-neutral-500" />
              )}
            </button>

            {advancedOpen ? (
              <Field
                label="Published at"
                hint="Active guides receive the current time automatically if this is empty."
              >
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  disabled={isSaving}
                  onChange={(event) =>
                    onChange(
                      'publishedAt',
                      event.target.value
                    )
                  }
                  className={inputClassName}
                />
              </Field>
            ) : null}
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className={secondaryButtonClassName}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={
                isSaving ||
                !form.propertyId ||
                !form.title.trim() ||
                !form.slug.trim()
              }
              className={primaryButtonClassName}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : form.id ? (
                <Save className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}

              {form.id
                ? 'Save Changes'
                : 'Create Guide'}
            </button>
          </div>
        </div>
      </div>
    </AdminCard>
  )
}

/* ------------------------------------------------ */
/* Metrics                                          */
/* ------------------------------------------------ */

function GuideMetrics({
  counts,
}: {
  counts: {
    all: number
    active: number
    draft: number
    archived: number
  }
}) {
  const metrics = [
    {
      label: 'Total guides',
      value: counts.all,
      color: 'text-white',
    },
    {
      label: 'Active',
      value: counts.active,
      color: 'text-emerald-300',
    },
    {
      label: 'Draft',
      value: counts.draft,
      color: 'text-amber-300',
    },
    {
      label: 'Archived',
      value: counts.archived,
      color: 'text-neutral-400',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-2xl border border-neutral-800 bg-black/30 p-4"
        >
          <p
            className={[
              'text-2xl font-semibold',
              metric.color,
            ].join(' ')}
          >
            {metric.value}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {metric.label}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------ */
/* Shared UI                                        */
/* ------------------------------------------------ */

const inputClassName = [
  'w-full rounded-xl border border-neutral-800',
  'bg-black px-3 py-2.5',
  'text-sm text-white outline-none',
  'placeholder:text-neutral-600',
  'transition',
  'focus:border-cyan-400/70',
  'focus:ring-2 focus:ring-cyan-400/10',
  'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ')

const primaryButtonClassName = [
  'inline-flex min-h-11 items-center justify-center gap-2',
  'rounded-full bg-cyan-300 px-4 py-2',
  'text-sm font-bold text-neutral-950',
  'transition hover:bg-cyan-200',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

const secondaryButtonClassName = [
  'inline-flex min-h-11 items-center justify-center gap-2',
  'rounded-full border border-neutral-700',
  'bg-neutral-950 px-4 py-2',
  'text-sm font-semibold text-neutral-300',
  'transition hover:border-neutral-600 hover:text-white',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

const dangerButtonClassName = [
  'inline-flex min-h-11 items-center justify-center gap-2',
  'rounded-full border border-red-400/30',
  'bg-red-400/10 px-4 py-2',
  'text-sm font-semibold text-red-300',
  'transition hover:border-red-400/50 hover:bg-red-400/15',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

function AdminCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-[1.75rem] border border-neutral-800',
        'bg-neutral-950/80 p-4',
        'shadow-2xl shadow-black/30',
        'backdrop-blur-xl sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  )
}

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-semibold text-neutral-300">
        {label}

        {required ? (
          <span className="text-cyan-300">*</span>
        ) : null}
      </span>

      {hint ? (
        <span className="mt-1 block text-[11px] leading-4 text-neutral-600">
          {hint}
        </span>
      ) : null}

      <span className="mt-2 block">
        {children}
      </span>
    </label>
  )
}

function ToggleCard({
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  title: string
  description: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'flex items-start justify-between gap-4 rounded-xl border p-4 text-left transition',
        checked
          ? 'border-cyan-400/40 bg-cyan-400/10'
          : 'border-neutral-800 bg-black/30 hover:border-neutral-700',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>
        <span className="block text-sm font-semibold text-white">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-neutral-500">
          {description}
        </span>
      </span>

      <span
        className={[
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition',
          checked
            ? 'bg-cyan-300'
            : 'bg-neutral-800',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition',
            checked ? 'left-6' : 'left-1',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-cyan-300">
        {icon}
      </span>

      <span>
        <span className="block text-sm font-semibold text-white">
          {title}
        </span>

        <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
          {description}
        </span>
      </span>
    </div>
  )
}

function NoticeBanner({
  notice,
}: {
  notice: Notice
}) {
  return (
    <div
      role={
        notice.tone === 'error'
          ? 'alert'
          : 'status'
      }
      className={[
        'rounded-xl border px-4 py-3 text-sm',
        notice.tone === 'success'
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
          : 'border-red-400/30 bg-red-400/10 text-red-200',
      ].join(' ')}
    >
      {notice.message}
    </div>
  )
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-500">
        <Hotel className="h-5 w-5" />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-neutral-500">
        {description}
      </p>

      {action}
    </div>
  )
}

function Pill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'accent'
}) {
  return (
    <span
      className={[
        'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
        tone === 'accent'
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
          : 'border-neutral-800 bg-neutral-950 text-neutral-500',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function StatusPill({
  status,
}: {
  status: GuideStatus
}) {
  const className =
    status === 'active'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : status === 'draft'
        ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
        : 'border-neutral-700 bg-neutral-900 text-neutral-400'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
        className,
      ].join(' ')}
    >
      <StatusDot status={status} />
      {status}
    </span>
  )
}

function StatusDot({
  status,
}: {
  status: GuideStatus
}) {
  const className =
    status === 'active'
      ? 'bg-emerald-400'
      : status === 'draft'
        ? 'bg-amber-400'
        : 'bg-neutral-500'

  return (
    <span
      className={[
        'h-2 w-2 rounded-full',
        className,
      ].join(' ')}
    />
  )
}

function InfoCard({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string
  title: string
  items: Array<{
    label: string
    value: string
  }>
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
        {eyebrow}
      </p>

      <h4 className="mt-1 font-semibold text-white">
        {title}
      </h4>

      <dl className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex items-start justify-between gap-4"
          >
            <dt className="text-xs text-neutral-600">
              {item.label}
            </dt>

            <dd className="max-w-[65%] text-right text-xs text-neutral-300">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function EmbeddedEditorNotice({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-white">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          {description}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Data normalization                               */
/* ------------------------------------------------ */

function normalizeGuideRow(
  value: unknown
): PropertyGuideRow {
  const row = value as Record<string, unknown>

  const rawProperty = Array.isArray(row.properties)
    ? row.properties[0]
    : row.properties

  const rawBrand = Array.isArray(row.guide_brands)
    ? row.guide_brands[0]
    : row.guide_brands

  return {
    id: String(row.id ?? ''),
    property_id: String(
      row.property_id ?? ''
    ),
    brand_id:
      typeof row.brand_id === 'string'
        ? row.brand_id
        : null,

    title:
      typeof row.title === 'string'
        ? row.title
        : 'Untitled Guide',
    subtitle:
      typeof row.subtitle === 'string'
        ? row.subtitle
        : null,
    slug:
      typeof row.slug === 'string'
        ? row.slug
        : '',

    status: isGuideStatus(row.status)
      ? row.status
      : 'draft',

    guide_mode: isGuideMode(
      row.guide_mode
    )
      ? row.guide_mode
      : 'hotel',

    published_at:
      typeof row.published_at === 'string'
        ? row.published_at
        : null,

    welcome_heading:
      typeof row.welcome_heading === 'string'
        ? row.welcome_heading
        : null,

    welcome_description:
      typeof row.welcome_description === 'string'
        ? row.welcome_description
        : null,

    hero_image_url:
      typeof row.hero_image_url === 'string'
        ? row.hero_image_url
        : null,

    show_property_favorites:
      row.show_property_favorites !== false,

    show_suggested_routes:
      row.show_suggested_routes !== false,

    show_nearby_events:
      row.show_nearby_events !== false,

    show_partner_offers:
      row.show_partner_offers === true,

    default_travel_mode:
      isTravelMode(
        row.default_travel_mode
      )
        ? row.default_travel_mode
        : 'walking',

    powered_by_roam:
      row.powered_by_roam !== false,

    created_at:
      typeof row.created_at === 'string'
        ? row.created_at
        : '',

    updated_at:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : '',

    property:
      normalizePropertyOption(rawProperty),

    brand:
      normalizeBrandOption(rawBrand),
  }
}

function normalizePropertyOption(
  value: unknown
): PropertyOption | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Record<string, unknown>

  const id =
    typeof row.id === 'string' ? row.id : ''

  const name =
    typeof row.name === 'string'
      ? row.name
      : ''

  const slug =
    typeof row.slug === 'string'
      ? row.slug
      : ''

  if (!id || !name || !slug) {
    return null
  }

  return {
    id,
    name,
    slug,
    city:
      typeof row.city === 'string'
        ? row.city
        : null,
    address:
      typeof row.address === 'string'
        ? row.address
        : null,
  }
}

function normalizeBrandOption(
  value: unknown
): GuideBrandOption | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Record<string, unknown>

  const id =
    typeof row.id === 'string' ? row.id : ''

  const name =
    typeof row.name === 'string'
      ? row.name
      : ''

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    slug:
      typeof row.slug === 'string'
        ? row.slug
        : '',
    branding_mode:
      typeof row.branding_mode === 'string'
        ? row.branding_mode
        : 'co_branded',
  }
}

function mapGuideToForm(
  guide: PropertyGuideRow
): GuideFormState {
  return {
    id: guide.id,

    propertyId: guide.property_id,
    brandId: guide.brand_id ?? '',

    title: guide.title,
    subtitle: guide.subtitle ?? '',
    slug: guide.slug,

    status: guide.status,
    guideMode: guide.guide_mode,

    welcomeHeading:
      guide.welcome_heading ?? '',

    welcomeDescription:
      guide.welcome_description ?? '',

    heroImageUrl:
      guide.hero_image_url ?? '',

    showPropertyFavorites:
      guide.show_property_favorites,

    showSuggestedRoutes:
      guide.show_suggested_routes,

    showNearbyEvents:
      guide.show_nearby_events,

    showPartnerOffers:
      guide.show_partner_offers,

    defaultTravelMode:
      guide.default_travel_mode,

    poweredByRoam:
      guide.powered_by_roam,

    publishedAt:
      toLocalDateTimeInput(
        guide.published_at
      ),
  }
}

/* ------------------------------------------------ */
/* Validation and helpers                           */
/* ------------------------------------------------ */

function validateGuideForm(
  form: GuideFormState
):
  | { success: true }
  | { success: false; error: string } {
  if (!form.propertyId) {
    return {
      success: false,
      error: 'Select a property.',
    }
  }

  if (!form.title.trim()) {
    return {
      success: false,
      error: 'Guide title is required.',
    }
  }

  if (!form.slug.trim()) {
    return {
      success: false,
      error: 'Guide slug is required.',
    }
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      form.slug
    )
  ) {
    return {
      success: false,
      error:
        'Guide slug must use lowercase letters, numbers, and hyphens only.',
    }
  }

  if (
    form.status === 'active' &&
    !form.brandId
  ) {
    return {
      success: false,
      error:
        'Assign a guide brand before publishing the guide.',
    }
  }

  return {
    success: true,
  }
}

function isGuideStatus(
  value: unknown
): value is GuideStatus {
  return (
    value === 'draft' ||
    value === 'active' ||
    value === 'archived'
  )
}

function isGuideMode(
  value: unknown
): value is GuideMode {
  return (
    value === 'roam' ||
    value === 'hotel' ||
    value === 'partner' ||
    value === 'concierge'
  )
}

function isTravelMode(
  value: unknown
): value is GuideTravelMode {
  return (
    value === 'walking' ||
    value === 'driving' ||
    value === 'transit' ||
    value === 'rideshare'
  )
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createDuplicateSlug(
  originalSlug: string,
  existingSlugs: string[]
) {
  const existing = new Set(existingSlugs)

  const base = `${originalSlug}-copy`

  if (!existing.has(base)) {
    return base
  }

  let index = 2

  while (
    existing.has(`${base}-${index}`)
  ) {
    index += 1
  }

  return `${base}-${index}`
}

function toLocalDateTimeInput(
  value: string | null
) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offset =
    date.getTimezoneOffset() * 60_000

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16)
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
}

function getStatusDescription(
  status: GuideStatus
) {
  if (status === 'active') {
    return 'This guide is publicly accessible and can be shared with hotel guests.'
  }

  if (status === 'archived') {
    return 'This guide is retained for reference but is not publicly accessible.'
  }

  return 'This guide remains private to authorized administrators until it is published.'
}