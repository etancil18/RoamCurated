'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'

import { supabaseBrowser } from '@/lib/supabase/client'

import {
  deleteGuideFeaturedVenueAction,
  reorderGuideFeaturedVenuesAction,
  saveGuideFeaturedVenueAction,
  toggleGuideFeaturedVenueVisibilityAction,
  type GuideFeaturedVenueInput,
  type GuideFeaturedVenueRecord,
  type GuideSectionKey,
} from '@/app/venue-admin/guide-actions'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type Props = {
  guideId: string
  guideTitle?: string | null
  className?: string
}

type GuideSectionRow = {
  id: string
  guide_id: string
  section_key: GuideSectionKey
  title: string | null
  subtitle: string | null
  position: number
  is_visible: boolean
}

type VenueOption = {
  id: string
  name: string
  city: string | null
  address: string | null
  description: string | null
  type: string | string[] | null
  cover: string | null
  slug: string | null
}

type FeaturedVenueWithVenue = GuideFeaturedVenueRecord & {
  venue: VenueOption | null
}

type EditorFormState = {
  id: string | null
  venueId: string
  sectionKey: GuideSectionKey | ''
  label: string
  description: string
  conciergeNote: string
  position: number
  isFeatured: boolean
  isVisible: boolean
  visibleFrom: string
  visibleUntil: string
}

type Notice = {
  tone: 'success' | 'error'
  message: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const EMPTY_FORM: EditorFormState = {
  id: null,
  venueId: '',
  sectionKey: '',
  label: '',
  description: '',
  conciergeNote: '',
  position: 0,
  isFeatured: false,
  isVisible: true,
  visibleFrom: '',
  visibleUntil: '',
}

const SECTION_LABELS: Partial<Record<GuideSectionKey, string>> = {
  welcome: 'Welcome',
  favorites: 'Hotel Picks',
  suggested_routes: 'Suggested Flows',
  coffee: 'Coffee & Breakfast',
  dining: 'Nearby Dining',
  bars: 'Drinks Nearby',
  wellness: 'Wellness & Reset',
  events: 'Events',
  map: 'Map',
  partner_offers: 'Guest Perks',
  custom: 'Custom',
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideFeaturedVenuesEditor({
  guideId,
  guideTitle,
  className,
}: Props) {
  const [supabase] = useState(() => supabaseBrowser())

  const [sections, setSections] = useState<GuideSectionRow[]>([])
  const [venues, setVenues] = useState<VenueOption[]>([])
  const [featuredVenues, setFeaturedVenues] = useState<
    FeaturedVenueWithVenue[]
  >([])

  const [activeSectionKey, setActiveSectionKey] = useState<
    GuideSectionKey | ''
  >('')
  const [form, setForm] = useState<EditorFormState>(EMPTY_FORM)

  const [selectedCity, setSelectedCity] = useState('')
  const [venueSearch, setVenueSearch] = useState('')
  const [isVenuePickerOpen, setIsVenuePickerOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [isSaving, startSaving] = useTransition()
  const [isMutating, startMutating] = useTransition()

  /* ---------------------------------------------- */
  /* Data loading                                   */
  /* ---------------------------------------------- */

  const loadData = useCallback(async () => {
    if (!guideId) {
      setSections([])
      setFeaturedVenues([])
      setVenues([])
      setSelectedCity('')
      setLoading(false)
      return
    }

    setLoading(true)
    setNotice(null)

    const [
      { data: sectionData, error: sectionError },
      { data: featuredData, error: featuredError },
      { data: venueData, error: venueError },
    ] = await Promise.all([
      supabase
        .from('property_guide_sections')
        .select(
          `
          id,
          guide_id,
          section_key,
          title,
          subtitle,
          position,
          is_visible
        `
        )
        .eq('guide_id', guideId)
        .order('position', { ascending: true }),

      supabase
        .from('guide_featured_venues')
        .select(
          `
          id,
          guide_id,
          venue_id,
          section_key,
          label,
          description,
          concierge_note,
          position,
          is_featured,
          is_visible,
          visible_from,
          visible_until,
          venues (
            id,
            name,
            city,
            address,
            description,
            type,
            cover,
            slug
          )
        `
        )
        .eq('guide_id', guideId)
        .order('section_key', { ascending: true })
        .order('position', { ascending: true }),

      supabase
        .from('venues')
        .select(
          `
          id,
          name,
          city,
          address,
          description,
          type,
          cover,
          slug
        `
        )
        .order('city', { ascending: true })
        .order('name', { ascending: true }),
    ])

    if (sectionError || featuredError || venueError) {
      console.error('[GuideFeaturedVenuesEditor] Load failure:', {
        sectionError,
        featuredError,
        venueError,
      })

      setNotice({
        tone: 'error',
        message:
          sectionError?.message ??
          featuredError?.message ??
          venueError?.message ??
          'Unable to load guide curation data.',
      })

      setLoading(false)
      return
    }

    const normalizedSections = ((sectionData ?? []) as unknown[]).map(
      normalizeSectionRow
    )

    const normalizedFeatured = ((featuredData ?? []) as unknown[]).map(
      normalizeFeaturedVenueRow
    )

    const normalizedVenues = ((venueData ?? []) as unknown[])
      .map(normalizeVenueRow)
      .filter((venue): venue is VenueOption => Boolean(venue))

    setSections(normalizedSections)
    setFeaturedVenues(normalizedFeatured)
    setVenues(normalizedVenues)

    setActiveSectionKey((current) => {
      if (
        current &&
        normalizedSections.some(
          (section) => section.section_key === current
        )
      ) {
        return current
      }

      return normalizedSections[0]?.section_key ?? ''
    })

    setLoading(false)
  }, [guideId, supabase])

  useEffect(() => {
    void loadData()
  }, [loadData])

  /* ---------------------------------------------- */
  /* Derived state                                  */
  /* ---------------------------------------------- */

  const activeSection = useMemo(
    () =>
      sections.find(
        (section) => section.section_key === activeSectionKey
      ) ?? null,
    [activeSectionKey, sections]
  )

  const sectionFeaturedVenues = useMemo(
    () =>
      featuredVenues
        .filter(
          (featuredVenue) =>
            featuredVenue.section_key === activeSectionKey
        )
        .sort((a, b) => {
          if (a.position !== b.position) {
            return a.position - b.position
          }

          if (a.is_featured !== b.is_featured) {
            return a.is_featured ? -1 : 1
          }

          return (
            a.venue?.name.localeCompare(b.venue?.name ?? '') ?? 0
          )
        }),
    [activeSectionKey, featuredVenues]
  )

  const usedVenueIdsForActiveSection = useMemo(
    () =>
      new Set(
        sectionFeaturedVenues.map(
          (featuredVenue) => featuredVenue.venue_id
        )
      ),
    [sectionFeaturedVenues]
  )

  const cityOptions = useMemo(() => {
    const cityByKey = new Map<string, string>()

    for (const venue of venues) {
      const city = cleanCityLabel(venue.city)

      if (!city) continue

      const cityKey = normalizeCityValue(city)

      if (!cityByKey.has(cityKey)) {
        cityByKey.set(cityKey, city)
      }
    }

    return Array.from(cityByKey.entries())
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, {
          sensitivity: 'base',
        })
      )
  }, [venues])

  const venuesForSelectedCity = useMemo(() => {
    if (!selectedCity) {
      return []
    }

    return venues.filter(
      (venue) =>
        normalizeCityValue(venue.city) === selectedCity
    )
  }, [selectedCity, venues])

  const filteredVenueOptions = useMemo(() => {
    if (!selectedCity) {
      return []
    }

    const query = venueSearch.trim().toLowerCase()

    return venuesForSelectedCity
      .filter((venue) => {
        if (
          usedVenueIdsForActiveSection.has(venue.id) &&
          venue.id !== form.venueId
        ) {
          return false
        }

        if (!query) {
          return true
        }

        const searchText = [
          venue.name,
          venue.address,
          formatVenueType(venue.type),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return searchText.includes(query)
      })
      .slice(0, 50)
  }, [
    form.venueId,
    selectedCity,
    usedVenueIdsForActiveSection,
    venueSearch,
    venuesForSelectedCity,
  ])

  const selectedVenue = useMemo(
    () =>
      venues.find((venue) => venue.id === form.venueId) ?? null,
    [form.venueId, venues]
  )

  const activeSectionPosition =
    sectionFeaturedVenues.length > 0
      ? Math.max(
          ...sectionFeaturedVenues.map((venue) => venue.position)
        ) + 10
      : 0

  const busy = isSaving || isMutating

  /* ---------------------------------------------- */
  /* Form controls                                  */
  /* ---------------------------------------------- */

  function beginCreate() {
    if (!activeSectionKey) {
      setNotice({
        tone: 'error',
        message: 'Create or select a guide section first.',
      })
      return
    }

    setForm({
      ...EMPTY_FORM,
      sectionKey: activeSectionKey,
      position: activeSectionPosition,
    })

    setSelectedCity('')
    setVenueSearch('')
    setIsVenuePickerOpen(false)
    setIsEditorOpen(true)
    setNotice(null)
  }

  function beginEdit(item: FeaturedVenueWithVenue) {
    setForm({
      id: item.id,
      venueId: item.venue_id,
      sectionKey: item.section_key,
      label: item.label ?? '',
      description: item.description ?? '',
      conciergeNote: item.concierge_note ?? '',
      position: item.position,
      isFeatured: item.is_featured,
      isVisible: item.is_visible,
      visibleFrom: toLocalDateTimeInput(item.visible_from),
      visibleUntil: toLocalDateTimeInput(item.visible_until),
    })

    setSelectedCity(normalizeCityValue(item.venue?.city))
    setVenueSearch(item.venue?.name ?? '')
    setIsVenuePickerOpen(false)
    setIsEditorOpen(true)
    setNotice(null)
  }

  function closeEditor() {
    if (busy) return

    setForm(EMPTY_FORM)
    setSelectedCity('')
    setVenueSearch('')
    setIsVenuePickerOpen(false)
    setIsEditorOpen(false)
  }

  function handleCityChange(city: string) {
    setSelectedCity(city)
    setVenueSearch('')
    setIsVenuePickerOpen(Boolean(city))

    setForm((current) => ({
      ...current,
      venueId: '',
      description: current.id ? current.description : '',
    }))
  }

  function selectVenue(venue: VenueOption) {
    setForm((current) => ({
      ...current,
      venueId: venue.id,
      description:
        current.description.trim().length > 0
          ? current.description
          : venue.description ?? '',
    }))

    setVenueSearch(venue.name)
    setIsVenuePickerOpen(false)
  }

  function updateForm<K extends keyof EditorFormState>(
    key: K,
    value: EditorFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  /* ---------------------------------------------- */
  /* Save                                           */
  /* ---------------------------------------------- */

  function handleSave() {
    setNotice(null)

    if (!form.id && !selectedCity) {
      setNotice({
        tone: 'error',
        message: 'Select a city before choosing a venue.',
      })
      return
    }

    if (!form.venueId) {
      setNotice({
        tone: 'error',
        message: 'Select a venue before saving.',
      })
      return
    }

    if (!form.sectionKey) {
      setNotice({
        tone: 'error',
        message: 'Select a guide section before saving.',
      })
      return
    }

    const payload: GuideFeaturedVenueInput = {
      id: form.id,
      guideId,
      venueId: form.venueId,
      sectionKey: form.sectionKey,
      label: form.label,
      description: form.description,
      conciergeNote: form.conciergeNote,
      position: form.position,
      isFeatured: form.isFeatured,
      isVisible: form.isVisible,
      visibleFrom: form.visibleFrom
        ? new Date(form.visibleFrom).toISOString()
        : null,
      visibleUntil: form.visibleUntil
        ? new Date(form.visibleUntil).toISOString()
        : null,
    }

    startSaving(async () => {
      const result = await saveGuideFeaturedVenueAction(payload)

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
          ? 'Featured venue updated.'
          : 'Venue added to the guide.',
      })

      setIsEditorOpen(false)
      setIsVenuePickerOpen(false)
      setForm(EMPTY_FORM)
      setSelectedCity('')
      setVenueSearch('')

      await loadData()
    })
  }

  /* ---------------------------------------------- */
  /* Visibility                                     */
  /* ---------------------------------------------- */

  function handleToggleVisibility(
    item: FeaturedVenueWithVenue
  ) {
    setNotice(null)

    startMutating(async () => {
      const result =
        await toggleGuideFeaturedVenueVisibilityAction(
          item.id,
          !item.is_visible
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setFeaturedVenues((current) =>
        current.map((featuredVenue) =>
          featuredVenue.id === item.id
            ? {
                ...featuredVenue,
                is_visible: result.data.is_visible,
              }
            : featuredVenue
        )
      )

      setNotice({
        tone: 'success',
        message: result.data.is_visible
          ? 'Venue is now visible.'
          : 'Venue is now hidden.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Featured status                                */
  /* ---------------------------------------------- */

  function handleToggleFeatured(
    item: FeaturedVenueWithVenue
  ) {
    setNotice(null)

    startMutating(async () => {
      const result = await saveGuideFeaturedVenueAction({
        id: item.id,
        guideId: item.guide_id,
        venueId: item.venue_id,
        sectionKey: item.section_key,
        label: item.label,
        description: item.description,
        conciergeNote: item.concierge_note,
        position: item.position,
        isFeatured: !item.is_featured,
        isVisible: item.is_visible,
        visibleFrom: item.visible_from,
        visibleUntil: item.visible_until,
      })

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setFeaturedVenues((current) =>
        current.map((featuredVenue) =>
          featuredVenue.id === item.id
            ? {
                ...featuredVenue,
                is_featured: result.data.is_featured,
              }
            : featuredVenue
        )
      )

      setNotice({
        tone: 'success',
        message: result.data.is_featured
          ? 'Venue marked as featured.'
          : 'Featured status removed.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Reordering                                     */
  /* ---------------------------------------------- */

  function handleMove(
    itemId: string,
    direction: 'up' | 'down'
  ) {
    if (!activeSectionKey) return

    const currentIndex = sectionFeaturedVenues.findIndex(
      (item) => item.id === itemId
    )

    if (currentIndex < 0) return

    const targetIndex =
      direction === 'up'
        ? currentIndex - 1
        : currentIndex + 1

    if (
      targetIndex < 0 ||
      targetIndex >= sectionFeaturedVenues.length
    ) {
      return
    }

    const reordered = [...sectionFeaturedVenues]
    const [movedItem] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, movedItem)

    setNotice(null)

    startMutating(async () => {
      const result =
        await reorderGuideFeaturedVenuesAction(
          guideId,
          activeSectionKey,
          reordered.map((item) => item.id)
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      const positionById = new Map(
        reordered.map((item, index) => [
          item.id,
          index * 10,
        ])
      )

      setFeaturedVenues((current) =>
        current.map((item) => {
          const nextPosition = positionById.get(item.id)

          return typeof nextPosition === 'number'
            ? {
                ...item,
                position: nextPosition,
              }
            : item
        })
      )
    })
  }

  /* ---------------------------------------------- */
  /* Delete                                         */
  /* ---------------------------------------------- */

  function handleDelete(item: FeaturedVenueWithVenue) {
    const venueName = item.venue?.name ?? 'this venue'

    const confirmed = window.confirm(
      `Remove ${venueName} from this guide section?`
    )

    if (!confirmed) return

    setNotice(null)

    startMutating(async () => {
      const result = await deleteGuideFeaturedVenueAction(item.id)

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setFeaturedVenues((current) =>
        current.filter(
          (featuredVenue) => featuredVenue.id !== item.id
        )
      )

      setNotice({
        tone: 'success',
        message: `${venueName} was removed from the guide.`,
      })
    })
  }

  /* ---------------------------------------------- */
  /* Loading and empty guide states                 */
  /* ---------------------------------------------- */

  if (!guideId) {
    return (
      <AdminCard className={className}>
        <EmptyState
          title="Select a guide"
          description="Choose a property guide before curating its featured venues."
        />
      </AdminCard>
    )
  }

  if (loading) {
    return (
      <AdminCard className={className}>
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          Loading guide venues…
        </div>
      </AdminCard>
    )
  }

  return (
    <AdminCard className={className}>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-neutral-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
              Guide curation
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Featured Venues
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Add deliberate hotel recommendations, custom labels, concierge
              notes, visibility windows, and section-specific ordering
              {guideTitle ? ` for ${guideTitle}` : ''}.
            </p>
          </div>

          <button
            type="button"
            onClick={beginCreate}
            disabled={!activeSectionKey || busy}
            className={[
              'inline-flex min-h-11 items-center justify-center gap-2',
              'rounded-full bg-cyan-300 px-4 py-2',
              'text-sm font-bold text-neutral-950',
              'transition hover:bg-cyan-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            <Plus className="h-4 w-4" />
            Add Venue
          </button>
        </header>

        {notice ? <NoticeBanner notice={notice} /> : null}

        {sections.length === 0 ? (
          <EmptyState
            title="No guide sections exist"
            description="Create the guide’s section structure before assigning featured venues."
          />
        ) : (
          <>
            <SectionTabs
              sections={sections}
              activeSectionKey={activeSectionKey}
              featuredVenues={featuredVenues}
              disabled={busy}
              onChange={(sectionKey) => {
                setActiveSectionKey(sectionKey)
                setIsEditorOpen(false)
                setForm(EMPTY_FORM)
                setSelectedCity('')
                setVenueSearch('')
                setIsVenuePickerOpen(false)
              }}
            />

            <div className="rounded-2xl border border-neutral-800 bg-black/30">
              <div className="flex flex-col gap-2 border-b border-neutral-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">
                    {activeSection?.title ??
                      getSectionLabel(activeSectionKey)}
                  </h3>

                  {activeSection?.subtitle ? (
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      {activeSection.subtitle}
                    </p>
                  ) : null}
                </div>

                <p className="text-xs text-neutral-500">
                  {sectionFeaturedVenues.length}{' '}
                  {sectionFeaturedVenues.length === 1
                    ? 'venue'
                    : 'venues'}
                </p>
              </div>

              {sectionFeaturedVenues.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No curated venues yet"
                    description="Add only deliberate hotel recommendations here. Automated nearby results should remain outside this list."
                    action={
                      <button
                        type="button"
                        onClick={beginCreate}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                      >
                        <Plus className="h-4 w-4" />
                        Add the first venue
                      </button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-neutral-800">
                  {sectionFeaturedVenues.map((item, index) => (
                    <FeaturedVenueRow
                      key={item.id}
                      item={item}
                      index={index}
                      total={sectionFeaturedVenues.length}
                      disabled={busy}
                      onEdit={() => beginEdit(item)}
                      onDelete={() => handleDelete(item)}
                      onToggleVisibility={() =>
                        handleToggleVisibility(item)
                      }
                      onToggleFeatured={() =>
                        handleToggleFeatured(item)
                      }
                      onMoveUp={() => handleMove(item.id, 'up')}
                      onMoveDown={() =>
                        handleMove(item.id, 'down')
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {isEditorOpen ? (
          <FeaturedVenueForm
            form={form}
            sections={sections}
            cityOptions={cityOptions}
            selectedCity={selectedCity}
            selectedVenue={selectedVenue}
            venueSearch={venueSearch}
            filteredVenueOptions={filteredVenueOptions}
            cityVenueCount={venuesForSelectedCity.length}
            isVenuePickerOpen={isVenuePickerOpen}
            isSaving={isSaving}
            onChange={updateForm}
            onCityChange={handleCityChange}
            onVenueSearchChange={(value) => {
              setVenueSearch(value)

              if (selectedCity) {
                setIsVenuePickerOpen(true)
              }

              if (
                selectedVenue &&
                value.trim() !== selectedVenue.name
              ) {
                updateForm('venueId', '')
              }
            }}
            onVenuePickerToggle={() => {
              if (!selectedCity) return

              setIsVenuePickerOpen((current) => !current)
            }}
            onVenueSelect={selectVenue}
            onSave={handleSave}
            onCancel={closeEditor}
          />
        ) : null}
      </div>
    </AdminCard>
  )
}

/* ------------------------------------------------ */
/* Section Tabs                                     */
/* ------------------------------------------------ */

function SectionTabs({
  sections,
  activeSectionKey,
  featuredVenues,
  disabled,
  onChange,
}: {
  sections: GuideSectionRow[]
  activeSectionKey: GuideSectionKey | ''
  featuredVenues: FeaturedVenueWithVenue[]
  disabled: boolean
  onChange: (sectionKey: GuideSectionKey) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Guide sections"
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {sections.map((section) => {
        const isActive =
          section.section_key === activeSectionKey

        const count = featuredVenues.filter(
          (item) => item.section_key === section.section_key
        ).length

        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(section.section_key)}
            className={[
              'inline-flex shrink-0 items-center gap-2 rounded-full',
              'border px-3 py-2 text-xs font-semibold transition',
              isActive
                ? 'border-cyan-300 bg-cyan-300 text-neutral-950'
                : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span>
              {section.title ??
                getSectionLabel(section.section_key)}
            </span>

            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-[10px]',
                isActive
                  ? 'bg-black/15 text-neutral-950'
                  : 'bg-neutral-800 text-neutral-400',
              ].join(' ')}
            >
              {count}
            </span>

            {!section.is_visible ? (
              <EyeOff
                aria-label="Section hidden"
                className="h-3.5 w-3.5"
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------ */
/* Featured Venue Row                               */
/* ------------------------------------------------ */

function FeaturedVenueRow({
  item,
  index,
  total,
  disabled,
  onEdit,
  onDelete,
  onToggleVisibility,
  onToggleFeatured,
  onMoveUp,
  onMoveDown,
}: {
  item: FeaturedVenueWithVenue
  index: number
  total: number
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleVisibility: () => void
  onToggleFeatured: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const venue = item.venue

  return (
    <li
      className={[
        'group flex flex-col gap-4 p-4',
        !item.is_visible ? 'opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex gap-3">
        <VenueThumbnail venue={venue} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-semibold text-white">
              {venue?.name ?? 'Unknown venue'}
            </h4>

            {item.is_featured ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                <Star className="h-3 w-3 fill-current" />
                Featured
              </span>
            ) : null}

            {!item.is_visible ? (
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                Hidden
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            {[formatVenueType(venue?.type), venue?.city]
              .filter(Boolean)
              .join(' · ') || 'Venue details unavailable'}
          </p>

          {item.label ? (
            <p className="mt-2 text-xs font-semibold text-cyan-300">
              {item.label}
            </p>
          ) : null}

          {item.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-400">
              {item.description}
            </p>
          ) : null}

          {item.concierge_note ? (
            <p className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs leading-5 text-neutral-400">
              <span className="font-semibold text-neutral-300">
                Concierge note:
              </span>{' '}
              {item.concierge_note}
            </p>
          ) : null}

          {item.visible_from || item.visible_until ? (
            <p className="mt-2 text-[11px] text-neutral-600">
              Visibility:{' '}
              {formatVisibilityWindow(
                item.visible_from,
                item.visible_until
              )}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <IconButton
          label="Move up"
          disabled={disabled || index === 0}
          onClick={onMoveUp}
        >
          <ArrowUp className="h-4 w-4" />
        </IconButton>

        <IconButton
          label="Move down"
          disabled={disabled || index === total - 1}
          onClick={onMoveDown}
        >
          <ArrowDown className="h-4 w-4" />
        </IconButton>

        <IconButton
          label={
            item.is_featured
              ? 'Remove featured status'
              : 'Mark as featured'
          }
          disabled={disabled}
          active={item.is_featured}
          onClick={onToggleFeatured}
        >
          <Star
            className={[
              'h-4 w-4',
              item.is_featured ? 'fill-current' : '',
            ].join(' ')}
          />
        </IconButton>

        <IconButton
          label={item.is_visible ? 'Hide venue' : 'Show venue'}
          disabled={disabled}
          onClick={onToggleVisibility}
        >
          {item.is_visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </IconButton>

        <IconButton
          label="Edit venue"
          disabled={disabled}
          onClick={onEdit}
        >
          <Edit3 className="h-4 w-4" />
        </IconButton>

        <IconButton
          label="Remove venue"
          tone="danger"
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </li>
  )
}

/* ------------------------------------------------ */
/* Form                                             */
/* ------------------------------------------------ */

function FeaturedVenueForm({
  form,
  sections,
  cityOptions,
  selectedCity,
  selectedVenue,
  venueSearch,
  filteredVenueOptions,
  cityVenueCount,
  isVenuePickerOpen,
  isSaving,
  onChange,
  onCityChange,
  onVenueSearchChange,
  onVenuePickerToggle,
  onVenueSelect,
  onSave,
  onCancel,
}: {
  form: EditorFormState
  sections: GuideSectionRow[]
  cityOptions: Array<{
    value: string
    label: string
  }>
  selectedCity: string
  selectedVenue: VenueOption | null
  venueSearch: string
  filteredVenueOptions: VenueOption[]
  cityVenueCount: number
  isVenuePickerOpen: boolean
  isSaving: boolean
  onChange: <K extends keyof EditorFormState>(
    key: K,
    value: EditorFormState[K]
  ) => void
  onCityChange: (city: string) => void
  onVenueSearchChange: (value: string) => void
  onVenuePickerToggle: () => void
  onVenueSelect: (venue: VenueOption) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-neutral-950 p-4 shadow-2xl shadow-black/40 sm:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
            {form.id ? 'Edit curation' : 'Add recommendation'}
          </p>

          <h3 className="mt-1 text-lg font-semibold text-white">
            {form.id
              ? selectedVenue?.name ?? 'Featured Venue'
              : 'Add a Featured Venue'}
          </h3>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Close editor"
          className="rounded-full border border-neutral-800 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <Field label="Guide section" required>
            <select
              value={form.sectionKey}
              disabled={isSaving || Boolean(form.id)}
              onChange={(event) =>
                onChange(
                  'sectionKey',
                  event.target.value as GuideSectionKey
                )
              }
              className={inputClassName}
            >
              <option value="">Select a section</option>

              {sections.map((section) => (
                <option
                  key={section.id}
                  value={section.section_key}
                >
                  {section.title ??
                    getSectionLabel(section.section_key)}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="City"
            required
            hint="Choose a city before browsing venues."
          >
            <select
              value={selectedCity}
              disabled={isSaving || Boolean(form.id)}
              onChange={(event) =>
                onCityChange(event.target.value)
              }
              className={inputClassName}
            >
              <option value="">Select a city</option>

              {cityOptions.map((city) => (
                <option
                  key={city.value}
                  value={city.value}
                >
                  {city.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Venue"
            required
            hint={
              selectedCity
                ? `${cityVenueCount} ${
                    cityVenueCount === 1 ? 'venue' : 'venues'
                  } available in this city.`
                : 'Select a city to enable venue search.'
            }
          >
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />

                <input
                  value={venueSearch}
                  disabled={
                    isSaving ||
                    Boolean(form.id) ||
                    !selectedCity
                  }
                  onFocus={() => {
                    if (
                      !form.id &&
                      selectedCity &&
                      !isVenuePickerOpen
                    ) {
                      onVenuePickerToggle()
                    }
                  }}
                  onChange={(event) =>
                    onVenueSearchChange(event.target.value)
                  }
                  placeholder={
                    selectedCity
                      ? 'Search venues in this city'
                      : 'Select a city first'
                  }
                  className={`${inputClassName} pl-9 pr-10`}
                />

                {!form.id ? (
                  <button
                    type="button"
                    onClick={onVenuePickerToggle}
                    disabled={!selectedCity}
                    aria-label="Toggle venue options"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isVenuePickerOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>

              {isVenuePickerOpen &&
              !form.id &&
              selectedCity ? (
                <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-950 p-2 shadow-2xl shadow-black/60">
                  {filteredVenueOptions.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-neutral-500">
                      {cityVenueCount === 0
                        ? 'No venues are available in this city.'
                        : 'No available venues match this search.'}
                    </p>
                  ) : (
                    filteredVenueOptions.map((venue) => (
                      <button
                        key={venue.id}
                        type="button"
                        onClick={() => onVenueSelect(venue)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-900"
                      >
                        <VenueThumbnail venue={venue} compact />

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {venue.name}
                          </span>

                          <span className="mt-0.5 block truncate text-xs text-neutral-500">
                            {[
                              formatVenueType(venue.type),
                              venue.address,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>

                        {form.venueId === venue.id ? (
                          <Check className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Display label"
            hint="Examples: Staff Favorite, Morning Pick, Local Essential."
          >
            <input
              value={form.label}
              disabled={isSaving}
              maxLength={120}
              onChange={(event) =>
                onChange('label', event.target.value)
              }
              placeholder="Staff Favorite"
              className={inputClassName}
            />
          </Field>

          <Field label="Display position">
            <input
              type="number"
              min={0}
              max={10000}
              step={1}
              value={form.position}
              disabled={isSaving}
              onChange={(event) =>
                onChange(
                  'position',
                  Math.max(
                    0,
                    Number.parseInt(event.target.value, 10) || 0
                  )
                )
              }
              className={inputClassName}
            />
          </Field>
        </div>

        <Field
          label="Guide description"
          hint="Hotel-specific copy shown instead of, or before, the venue’s standard description."
        >
          <textarea
            value={form.description}
            disabled={isSaving}
            maxLength={5000}
            rows={4}
            onChange={(event) =>
              onChange('description', event.target.value)
            }
            placeholder="Why this venue belongs in the hotel’s guide…"
            className={`${inputClassName} resize-y`}
          />
        </Field>

        <Field
          label="Concierge note"
          hint="Operational or guest-facing advice, such as reservation timing or what to request."
        >
          <textarea
            value={form.conciergeNote}
            disabled={isSaving}
            maxLength={2000}
            rows={3}
            onChange={(event) =>
              onChange('conciergeNote', event.target.value)
            }
            placeholder="Reservations are recommended after 7 PM."
            className={`${inputClassName} resize-y`}
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Visible from"
            hint="Optional scheduled start."
          >
            <input
              type="datetime-local"
              value={form.visibleFrom}
              disabled={isSaving}
              onChange={(event) =>
                onChange('visibleFrom', event.target.value)
              }
              className={inputClassName}
            />
          </Field>

          <Field
            label="Visible until"
            hint="Optional scheduled end."
          >
            <input
              type="datetime-local"
              value={form.visibleUntil}
              disabled={isSaving}
              onChange={(event) =>
                onChange('visibleUntil', event.target.value)
              }
              className={inputClassName}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            checked={form.isFeatured}
            disabled={isSaving}
            title="Featured treatment"
            description="Give this venue stronger visual prominence in the section."
            onChange={(checked) =>
              onChange('isFeatured', checked)
            }
          />

          <ToggleCard
            checked={form.isVisible}
            disabled={isSaving}
            title="Visible on guide"
            description="Hidden venues remain saved but do not appear publicly."
            onChange={(checked) =>
              onChange('isVisible', checked)
            }
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={
              isSaving ||
              !form.venueId ||
              !form.sectionKey ||
              (!form.id && !selectedCity)
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-neutral-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}

            {form.id ? 'Save Changes' : 'Add Venue'}
          </button>
        </div>
      </div>
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

      <span className="mt-2 block">{children}</span>
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
        'flex items-start justify-between gap-4 rounded-xl border p-3 text-left transition',
        checked
          ? 'border-cyan-400/40 bg-cyan-400/10'
          : 'border-neutral-800 bg-black/30 hover:border-neutral-700',
        disabled ? 'cursor-not-allowed opacity-60' : '',
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
          checked ? 'bg-cyan-300' : 'bg-neutral-800',
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

function IconButton({
  label,
  active = false,
  tone = 'default',
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  tone?: 'default' | 'danger'
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const colorClass =
    tone === 'danger'
      ? 'text-red-400 hover:border-red-400/40 hover:bg-red-400/10'
      : active
        ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
        : 'text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900 hover:text-white'

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-9 w-9 items-center justify-center rounded-full',
        'border border-neutral-800 bg-neutral-950',
        'transition',
        colorClass,
        disabled
          ? 'cursor-not-allowed opacity-40'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}

function NoticeBanner({
  notice,
}: {
  notice: Notice
}) {
  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
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
    <div className="flex min-h-40 flex-col items-center justify-center text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-500">
        <Star className="h-5 w-5" />
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

function VenueThumbnail({
  venue,
  compact = false,
}: {
  venue: VenueOption | null
  compact?: boolean
}) {
  const sizeClass = compact
    ? 'h-10 w-10 rounded-lg'
    : 'h-14 w-14 rounded-xl'

  if (venue?.cover) {
    return (
      <img
        src={normalizeCoverUrl(venue.cover)}
        alt=""
        className={`${sizeClass} shrink-0 object-cover`}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={[
        sizeClass,
        'flex shrink-0 items-center justify-center',
        'border border-neutral-800 bg-neutral-900',
        'text-xs font-black text-cyan-300',
      ].join(' ')}
    >
      {getInitials(venue?.name ?? 'Venue')}
    </div>
  )
}

/* ------------------------------------------------ */
/* Data Normalization                               */
/* ------------------------------------------------ */

function normalizeSectionRow(
  value: unknown
): GuideSectionRow {
  const row = value as Record<string, unknown>

  return {
    id: String(row.id ?? ''),
    guide_id: String(row.guide_id ?? ''),
    section_key: String(
      row.section_key ?? 'custom'
    ) as GuideSectionKey,
    title:
      typeof row.title === 'string' ? row.title : null,
    subtitle:
      typeof row.subtitle === 'string'
        ? row.subtitle
        : null,
    position:
      typeof row.position === 'number'
        ? row.position
        : 0,
    is_visible: row.is_visible !== false,
  }
}

function normalizeFeaturedVenueRow(
  value: unknown
): FeaturedVenueWithVenue {
  const row = value as Record<string, unknown>

  const rawVenue = Array.isArray(row.venues)
    ? row.venues[0]
    : row.venues

  return {
    id: String(row.id ?? ''),
    guide_id: String(row.guide_id ?? ''),
    venue_id: String(row.venue_id ?? ''),
    section_key: String(
      row.section_key ?? 'custom'
    ) as GuideSectionKey,
    label:
      typeof row.label === 'string' ? row.label : null,
    description:
      typeof row.description === 'string'
        ? row.description
        : null,
    concierge_note:
      typeof row.concierge_note === 'string'
        ? row.concierge_note
        : null,
    position:
      typeof row.position === 'number'
        ? row.position
        : 0,
    is_featured: row.is_featured === true,
    is_visible: row.is_visible !== false,
    visible_from:
      typeof row.visible_from === 'string'
        ? row.visible_from
        : null,
    visible_until:
      typeof row.visible_until === 'string'
        ? row.visible_until
        : null,
    venue: normalizeVenueRow(rawVenue),
  }
}

function normalizeVenueRow(
  value: unknown
): VenueOption | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Record<string, unknown>

  const id =
    typeof row.id === 'string' ? row.id : ''

  const name =
    typeof row.name === 'string' ? row.name : ''

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    city:
      typeof row.city === 'string' ? row.city : null,
    address:
      typeof row.address === 'string'
        ? row.address
        : null,
    description:
      typeof row.description === 'string'
        ? row.description
        : null,
    type:
      typeof row.type === 'string' ||
      Array.isArray(row.type)
        ? (row.type as string | string[])
        : null,
    cover:
      typeof row.cover === 'string'
        ? row.cover
        : null,
    slug:
      typeof row.slug === 'string' ? row.slug : null,
  }
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function getSectionLabel(
  sectionKey: GuideSectionKey | ''
) {
  if (!sectionKey) {
    return 'Guide Section'
  }

  return (
    SECTION_LABELS[sectionKey] ??
    sectionKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      )
  )
}

function cleanCityLabel(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const cleaned = value.trim()

  return cleaned || null
}

function normalizeCityValue(
  value: string | null | undefined
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function formatVenueType(
  value: VenueOption['type'] | undefined
) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ')
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ')
  }

  return null
}

function toLocalDateTimeInput(
  value: string | null
) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16)
}

function formatVisibilityWindow(
  visibleFrom: string | null,
  visibleUntil: string | null
) {
  const from = visibleFrom
    ? formatDateTime(visibleFrom)
    : 'Immediately'

  const until = visibleUntil
    ? formatDateTime(visibleUntil)
    : 'No end date'

  return `${from} → ${until}`
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

function normalizeCoverUrl(value: string) {
  if (
    value.startsWith('/') ||
    value.startsWith('https://') ||
    value.startsWith('http://')
  ) {
    return value
  }

  return `/${value}`
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'V'

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}