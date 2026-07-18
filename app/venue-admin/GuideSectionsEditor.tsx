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
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react'

import { supabaseBrowser } from '@/lib/supabase/client'

import {
  createDefaultGuideSectionsAction,
  deleteGuideSectionAction,
  reorderGuideSectionsAction,
  saveGuideSectionAction,
  toggleGuideSectionVisibilityAction,
  type GuideDisplayStyle,
  type GuideSectionInput,
  type GuideSectionKey,
  type GuideSectionRecord,
} from '@/app/venue-admin/guide-actions'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type Props = {
  guideId: string
  guideTitle?: string | null
  className?: string
}

type SectionEditorState = {
  id: string | null
  guideId: string
  sectionKey: GuideSectionKey | ''
  title: string
  subtitle: string
  position: number
  isVisible: boolean
  displayStyle: GuideDisplayStyle
  limit: string
  venueTypes: string
  defaultZoom: string
  customConfig: string
}

type Notice = {
  tone: 'success' | 'error'
  message: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const SECTION_KEYS: GuideSectionKey[] = [
  'welcome',
  'favorites',
  'suggested_routes',
  'coffee',
  'dining',
  'bars',
  'wellness',
  'events',
  'partner_offers',
  'map',
  'custom',
]

const DISPLAY_STYLES: GuideDisplayStyle[] = [
  'grid',
  'list',
  'carousel',
  'compact',
  'featured',
]

const SECTION_LABELS: Record<GuideSectionKey, string> = {
  welcome: 'Welcome',
  favorites: 'Hotel Picks',
  suggested_routes: 'Suggested Flows',
  coffee: 'Coffee & Breakfast',
  dining: 'Nearby Dining',
  bars: 'Drinks Nearby',
  wellness: 'Wellness & Reset',
  events: 'What’s Happening',
  partner_offers: 'Guest Perks',
  map: 'Explore the Area',
  custom: 'Custom Section',
}

const EMPTY_EDITOR: SectionEditorState = {
  id: null,
  guideId: '',
  sectionKey: '',
  title: '',
  subtitle: '',
  position: 0,
  isVisible: true,
  displayStyle: 'grid',
  limit: '',
  venueTypes: '',
  defaultZoom: '',
  customConfig: '',
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideSectionsEditor({
  guideId,
  guideTitle,
  className,
}: Props) {
  const [supabase] = useState(() => supabaseBrowser())

  const [sections, setSections] = useState<GuideSectionRecord[]>([])
  const [editor, setEditor] =
    useState<SectionEditorState>(EMPTY_EDITOR)

  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [expandedSectionId, setExpandedSectionId] =
    useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [isSaving, startSaving] = useTransition()
  const [isMutating, startMutating] = useTransition()

  const busy = isSaving || isMutating

  /* ---------------------------------------------- */
  /* Data loading                                   */
  /* ---------------------------------------------- */

  const loadSections = useCallback(async () => {
    if (!guideId) {
      setSections([])
      setLoading(false)
      return
    }

    setLoading(true)
    setNotice(null)

    const { data, error } = await supabase
      .from('property_guide_sections')
      .select(
        `
        id,
        guide_id,
        section_key,
        title,
        subtitle,
        position,
        is_visible,
        config
      `
      )
      .eq('guide_id', guideId)
      .order('position', { ascending: true })
      .order('section_key', { ascending: true })

    if (error) {
      console.error('[GuideSectionsEditor] Load error:', error)

      setNotice({
        tone: 'error',
        message:
          error.message ||
          'Unable to load guide sections.',
      })

      setLoading(false)
      return
    }

    setSections(
      (data ?? []).map(normalizeSectionRecord)
    )

    setLoading(false)
  }, [guideId, supabase])

  useEffect(() => {
    void loadSections()
  }, [loadSections])

  /* ---------------------------------------------- */
  /* Derived values                                 */
  /* ---------------------------------------------- */

  const usedSectionKeys = useMemo(
    () => new Set(sections.map((section) => section.section_key)),
    [sections]
  )

  const availableSectionKeys = useMemo(
    () =>
      SECTION_KEYS.filter(
        (key) =>
          !usedSectionKeys.has(key) ||
          key === editor.sectionKey
      ),
    [editor.sectionKey, usedSectionKeys]
  )

  const sortedSections = useMemo(
    () =>
      [...sections].sort((a, b) => {
        if (a.position !== b.position) {
          return a.position - b.position
        }

        return a.section_key.localeCompare(b.section_key)
      }),
    [sections]
  )

  const nextPosition =
    sortedSections.length > 0
      ? Math.max(...sortedSections.map((section) => section.position)) + 10
      : 0

  /* ---------------------------------------------- */
  /* Editor lifecycle                               */
  /* ---------------------------------------------- */

  function openCreateEditor() {
    setEditor({
      ...EMPTY_EDITOR,
      guideId,
      position: nextPosition,
      sectionKey: availableSectionKeys[0] ?? 'custom',
      title:
        availableSectionKeys[0]
          ? SECTION_LABELS[availableSectionKeys[0]]
          : 'Custom Section',
    })

    setEditorOpen(true)
    setNotice(null)
  }

  function openEditEditor(section: GuideSectionRecord) {
    const config = normalizeConfig(section.config)

    setEditor({
      id: section.id,
      guideId: section.guide_id,
      sectionKey: section.section_key,
      title: section.title ?? '',
      subtitle: section.subtitle ?? '',
      position: section.position,
      isVisible: section.is_visible,
      displayStyle: getDisplayStyle(config),
      limit:
        typeof config.limit === 'number'
          ? String(config.limit)
          : '',
      venueTypes: Array.isArray(config.venueTypes)
        ? config.venueTypes
            .filter(
              (value): value is string =>
                typeof value === 'string'
            )
            .join(', ')
        : '',
      defaultZoom:
        typeof config.defaultZoom === 'number'
          ? String(config.defaultZoom)
          : '',
      customConfig: getCustomConfigText(config),
    })

    setEditorOpen(true)
    setNotice(null)
  }

  function closeEditor() {
    if (busy) return

    setEditorOpen(false)
    setEditor(EMPTY_EDITOR)
  }

  function updateEditor<K extends keyof SectionEditorState>(
    key: K,
    value: SectionEditorState[K]
  ) {
    setEditor((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleSectionKeyChange(
    sectionKey: GuideSectionKey
  ) {
    setEditor((current) => ({
      ...current,
      sectionKey,
      title:
        current.id || current.title.trim()
          ? current.title
          : SECTION_LABELS[sectionKey],
      displayStyle:
        current.id
          ? current.displayStyle
          : getDefaultDisplayStyle(sectionKey),
    }))
  }

  /* ---------------------------------------------- */
  /* Save                                           */
  /* ---------------------------------------------- */

  function handleSave() {
    setNotice(null)

    if (!editor.sectionKey) {
      setNotice({
        tone: 'error',
        message: 'Select a section type.',
      })
      return
    }

    const configResult = buildSectionConfig(editor)

    if (!configResult.success) {
      setNotice({
        tone: 'error',
        message: configResult.error,
      })
      return
    }

    const input: GuideSectionInput = {
      id: editor.id,
      guideId,
      sectionKey: editor.sectionKey,
      title: editor.title,
      subtitle: editor.subtitle,
      position: editor.position,
      isVisible: editor.isVisible,
      config: configResult.config,
    }

    startSaving(async () => {
      const result =
        await saveGuideSectionAction(input)

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setNotice({
        tone: 'success',
        message: editor.id
          ? 'Guide section updated.'
          : 'Guide section created.',
      })

      setEditorOpen(false)
      setEditor(EMPTY_EDITOR)

      await loadSections()
    })
  }

  /* ---------------------------------------------- */
  /* Default sections                               */
  /* ---------------------------------------------- */

  function handleCreateDefaults() {
    const confirmed =
      sections.length === 0 ||
      window.confirm(
        'Create or refresh the default guide sections? Existing matching sections may be updated.'
      )

    if (!confirmed) return

    setNotice(null)

    startMutating(async () => {
      const result =
        await createDefaultGuideSectionsAction(guideId)

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setNotice({
        tone: 'success',
        message: 'Default guide sections created.',
      })

      await loadSections()
    })
  }

  /* ---------------------------------------------- */
  /* Visibility                                     */
  /* ---------------------------------------------- */

  function handleToggleVisibility(
    section: GuideSectionRecord
  ) {
    setNotice(null)

    startMutating(async () => {
      const result =
        await toggleGuideSectionVisibilityAction(
          section.id,
          !section.is_visible
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setSections((current) =>
        current.map((item) =>
          item.id === section.id
            ? {
                ...item,
                is_visible: result.data.is_visible,
              }
            : item
        )
      )

      setNotice({
        tone: 'success',
        message: result.data.is_visible
          ? 'Section is now visible.'
          : 'Section is now hidden.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Reordering                                     */
  /* ---------------------------------------------- */

  function handleMove(
    sectionId: string,
    direction: 'up' | 'down'
  ) {
    const currentIndex = sortedSections.findIndex(
      (section) => section.id === sectionId
    )

    if (currentIndex < 0) return

    const targetIndex =
      direction === 'up'
        ? currentIndex - 1
        : currentIndex + 1

    if (
      targetIndex < 0 ||
      targetIndex >= sortedSections.length
    ) {
      return
    }

    const reordered = [...sortedSections]
    const [movedSection] = reordered.splice(currentIndex, 1)

    reordered.splice(targetIndex, 0, movedSection)

    setNotice(null)

    startMutating(async () => {
      const result =
        await reorderGuideSectionsAction(
          guideId,
          reordered.map((section) => section.id)
        )

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      const positionById = new Map(
        reordered.map((section, index) => [
          section.id,
          index * 10,
        ])
      )

      setSections((current) =>
        current.map((section) => ({
          ...section,
          position:
            positionById.get(section.id) ??
            section.position,
        }))
      )
    })
  }

  /* ---------------------------------------------- */
  /* Delete                                         */
  /* ---------------------------------------------- */

  function handleDelete(section: GuideSectionRecord) {
    const confirmed = window.confirm(
      `Delete the “${
        section.title ??
        SECTION_LABELS[section.section_key]
      }” section?\n\nAny featured venue assignments connected to this section will also be removed.`
    )

    if (!confirmed) return

    setNotice(null)

    startMutating(async () => {
      const result =
        await deleteGuideSectionAction(section.id)

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setSections((current) =>
        current.filter(
          (item) => item.id !== section.id
        )
      )

      setNotice({
        tone: 'success',
        message: 'Guide section deleted.',
      })
    })
  }

  /* ---------------------------------------------- */
  /* Empty and loading states                       */
  /* ---------------------------------------------- */

  if (!guideId) {
    return (
      <AdminCard className={className}>
        <EmptyState
          title="Select a guide"
          description="Choose a property guide before managing its sections."
        />
      </AdminCard>
    )
  }

  if (loading) {
    return (
      <AdminCard className={className}>
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          Loading guide sections…
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
              Guide structure
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Guide Sections
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Control section order, visibility, labels, presentation,
              and filtering
              {guideTitle ? ` for ${guideTitle}` : ''}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreateDefaults}
              disabled={busy}
              className={secondaryButtonClassName}
            >
              <RotateCcw className="h-4 w-4" />
              Create Defaults
            </button>

            <button
              type="button"
              onClick={openCreateEditor}
              disabled={
                busy ||
                availableSectionKeys.length === 0
              }
              className={primaryButtonClassName}
            >
              <Plus className="h-4 w-4" />
              Add Section
            </button>
          </div>
        </header>

        {notice ? (
          <NoticeBanner notice={notice} />
        ) : null}

        {sortedSections.length === 0 ? (
          <EmptyState
            title="No guide sections yet"
            description="Create the default section structure or add sections individually."
            action={
              <button
                type="button"
                onClick={handleCreateDefaults}
                disabled={busy}
                className={`${primaryButtonClassName} mt-4`}
              >
                <Layers3 className="h-4 w-4" />
                Create Default Sections
              </button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/30">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Section order
              </p>

              <p className="text-xs text-neutral-600">
                {sortedSections.length}{' '}
                {sortedSections.length === 1
                  ? 'section'
                  : 'sections'}
              </p>
            </div>

            <ul className="divide-y divide-neutral-800">
              {sortedSections.map(
                (section, index) => (
                  <SectionRow
                    key={section.id}
                    section={section}
                    index={index}
                    total={sortedSections.length}
                    expanded={
                      expandedSectionId === section.id
                    }
                    disabled={busy}
                    onExpand={() =>
                      setExpandedSectionId((current) =>
                        current === section.id
                          ? null
                          : section.id
                      )
                    }
                    onEdit={() =>
                      openEditEditor(section)
                    }
                    onDelete={() =>
                      handleDelete(section)
                    }
                    onToggleVisibility={() =>
                      handleToggleVisibility(section)
                    }
                    onMoveUp={() =>
                      handleMove(section.id, 'up')
                    }
                    onMoveDown={() =>
                      handleMove(section.id, 'down')
                    }
                  />
                )
              )}
            </ul>
          </div>
        )}

        {editorOpen ? (
          <SectionEditor
            editor={editor}
            availableSectionKeys={
              availableSectionKeys
            }
            isSaving={isSaving}
            onChange={updateEditor}
            onSectionKeyChange={
              handleSectionKeyChange
            }
            onSave={handleSave}
            onCancel={closeEditor}
          />
        ) : null}
      </div>
    </AdminCard>
  )
}

/* ------------------------------------------------ */
/* Section row                                      */
/* ------------------------------------------------ */

function SectionRow({
  section,
  index,
  total,
  expanded,
  disabled,
  onExpand,
  onEdit,
  onDelete,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
}: {
  section: GuideSectionRecord
  index: number
  total: number
  expanded: boolean
  disabled: boolean
  onExpand: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleVisibility: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const config = normalizeConfig(section.config)
  const displayStyle = getDisplayStyle(config)

  return (
    <li
      className={[
        'p-4 transition',
        section.is_visible
          ? ''
          : 'bg-neutral-950/40 opacity-65',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 text-xs font-bold text-cyan-300">
            {index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">
                {section.title ??
                  SECTION_LABELS[section.section_key]}
              </h3>

              <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {section.section_key}
              </span>

              <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {displayStyle}
              </span>

              {!section.is_visible ? (
                <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Hidden
                </span>
              ) : null}
            </div>

            {section.subtitle ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                {section.subtitle}
              </p>
            ) : null}

            <button
              type="button"
              onClick={onExpand}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 transition hover:text-white"
            >
              {expanded ? (
                <>
                  Hide configuration
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  View configuration
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {expanded ? (
          <SectionConfigSummary
            section={section}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <IconButton
            label="Move section up"
            disabled={disabled || index === 0}
            onClick={onMoveUp}
          >
            <ArrowUp className="h-4 w-4" />
          </IconButton>

          <IconButton
            label="Move section down"
            disabled={
              disabled || index === total - 1
            }
            onClick={onMoveDown}
          >
            <ArrowDown className="h-4 w-4" />
          </IconButton>

          <IconButton
            label={
              section.is_visible
                ? 'Hide section'
                : 'Show section'
            }
            disabled={disabled}
            onClick={onToggleVisibility}
          >
            {section.is_visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </IconButton>

          <IconButton
            label="Edit section"
            disabled={disabled}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </IconButton>

          <IconButton
            label="Delete section"
            tone="danger"
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </li>
  )
}

/* ------------------------------------------------ */
/* Config summary                                   */
/* ------------------------------------------------ */

function SectionConfigSummary({
  section,
}: {
  section: GuideSectionRecord
}) {
  const config = normalizeConfig(section.config)

  const visibleEntries = Object.entries(config).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== ''
  )

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ConfigItem
          label="Position"
          value={String(section.position)}
        />

        <ConfigItem
          label="Display style"
          value={getDisplayStyle(config)}
        />

        <ConfigItem
          label="Visibility"
          value={
            section.is_visible
              ? 'Visible'
              : 'Hidden'
          }
        />

        {typeof config.limit === 'number' ? (
          <ConfigItem
            label="Item limit"
            value={String(config.limit)}
          />
        ) : null}

        {Array.isArray(config.venueTypes) ? (
          <ConfigItem
            label="Venue types"
            value={config.venueTypes
              .filter(
                (value): value is string =>
                  typeof value === 'string'
              )
              .join(', ')}
          />
        ) : null}

        {typeof config.defaultZoom === 'number' ? (
          <ConfigItem
            label="Default zoom"
            value={String(config.defaultZoom)}
          />
        ) : null}
      </div>

      {visibleEntries.length === 0 ? (
        <p className="text-xs text-neutral-600">
          No additional section configuration.
        </p>
      ) : null}
    </div>
  )
}

function ConfigItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
        {label}
      </p>

      <p className="mt-1 text-xs leading-5 text-neutral-300">
        {value}
      </p>
    </div>
  )
}

/* ------------------------------------------------ */
/* Editor                                           */
/* ------------------------------------------------ */

function SectionEditor({
  editor,
  availableSectionKeys,
  isSaving,
  onChange,
  onSectionKeyChange,
  onSave,
  onCancel,
}: {
  editor: SectionEditorState
  availableSectionKeys: GuideSectionKey[]
  isSaving: boolean
  onChange: <K extends keyof SectionEditorState>(
    key: K,
    value: SectionEditorState[K]
  ) => void
  onSectionKeyChange: (
    sectionKey: GuideSectionKey
  ) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-neutral-950 p-4 shadow-2xl shadow-black/40 sm:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
            {editor.id
              ? 'Edit section'
              : 'Create section'}
          </p>

          <h3 className="mt-1 text-lg font-semibold text-white">
            {editor.id
              ? editor.title ||
                SECTION_LABELS[
                  editor.sectionKey as GuideSectionKey
                ]
              : 'Add Guide Section'}
          </h3>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Close section editor"
          className="rounded-full border border-neutral-800 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Section type" required>
            <select
              value={editor.sectionKey}
              disabled={isSaving || Boolean(editor.id)}
              onChange={(event) =>
                onSectionKeyChange(
                  event.target
                    .value as GuideSectionKey
                )
              }
              className={inputClassName}
            >
              <option value="">
                Select a section type
              </option>

              {availableSectionKeys.map(
                (sectionKey) => (
                  <option
                    key={sectionKey}
                    value={sectionKey}
                  >
                    {SECTION_LABELS[sectionKey]}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Position">
            <input
              type="number"
              min={0}
              step={1}
              value={editor.position}
              disabled={isSaving}
              onChange={(event) =>
                onChange(
                  'position',
                  Math.max(
                    0,
                    Number.parseInt(
                      event.target.value,
                      10
                    ) || 0
                  )
                )
              }
              className={inputClassName}
            />
          </Field>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Section title">
            <input
              value={editor.title}
              disabled={isSaving}
              maxLength={160}
              onChange={(event) =>
                onChange(
                  'title',
                  event.target.value
                )
              }
              placeholder="Hotel Picks"
              className={inputClassName}
            />
          </Field>

          <Field label="Display style">
            <select
              value={editor.displayStyle}
              disabled={isSaving}
              onChange={(event) =>
                onChange(
                  'displayStyle',
                  event.target
                    .value as GuideDisplayStyle
                )
              }
              className={inputClassName}
            >
              {DISPLAY_STYLES.map((style) => (
                <option
                  key={style}
                  value={style}
                >
                  {humanize(style)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Section subtitle">
          <textarea
            value={editor.subtitle}
            disabled={isSaving}
            maxLength={500}
            rows={3}
            onChange={(event) =>
              onChange(
                'subtitle',
                event.target.value
              )
            }
            placeholder="Places specifically selected by the hotel team."
            className={`${inputClassName} resize-y`}
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-3">
          <Field
            label="Item limit"
            hint="Optional. Between 1 and 100."
          >
            <input
              type="number"
              min={1}
              max={100}
              value={editor.limit}
              disabled={isSaving}
              onChange={(event) =>
                onChange(
                  'limit',
                  event.target.value
                )
              }
              placeholder="8"
              className={inputClassName}
            />
          </Field>

          <Field
            label="Default map zoom"
            hint="Relevant primarily for map sections."
          >
            <input
              type="number"
              min={1}
              max={22}
              step={1}
              value={editor.defaultZoom}
              disabled={isSaving}
              onChange={(event) =>
                onChange(
                  'defaultZoom',
                  event.target.value
                )
              }
              placeholder="15"
              className={inputClassName}
            />
          </Field>

          <ToggleCard
            checked={editor.isVisible}
            disabled={isSaving}
            title="Visible on guide"
            description="Hidden sections remain configured but are not shown publicly."
            onChange={(checked) =>
              onChange('isVisible', checked)
            }
          />
        </div>

        <Field
          label="Venue types"
          hint="Comma-separated venue types used for filtered dynamic sections."
        >
          <input
            value={editor.venueTypes}
            disabled={isSaving}
            onChange={(event) =>
              onChange(
                'venueTypes',
                event.target.value
              )
            }
            placeholder="coffee, cafe, bakery, breakfast"
            className={inputClassName}
          />
        </Field>

        <Field
          label="Additional configuration"
          hint='Optional JSON object. Do not repeat displayStyle, limit, venueTypes, or defaultZoom here.'
        >
          <textarea
            value={editor.customConfig}
            disabled={isSaving}
            rows={6}
            spellCheck={false}
            onChange={(event) =>
              onChange(
                'customConfig',
                event.target.value
              )
            }
            placeholder={`{
  "showDistance": true,
  "ctaLabel": "Explore nearby"
}`}
            className={`${inputClassName} resize-y font-mono text-xs`}
          />
        </Field>

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
              !editor.sectionKey
            }
            className={primaryButtonClassName}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editor.id ? (
              <Save className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}

            {editor.id
              ? 'Save Changes'
              : 'Create Section'}
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
        'flex min-h-[92px] items-start justify-between gap-4 rounded-xl border p-3 text-left transition',
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

function IconButton({
  label,
  tone = 'default',
  disabled,
  onClick,
  children,
}: {
  label: string
  tone?: 'default' | 'danger'
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
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
        tone === 'danger'
          ? 'text-red-400 hover:border-red-400/40 hover:bg-red-400/10'
          : 'text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900 hover:text-white',
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
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-500">
        <Layers3 className="h-5 w-5" />
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

/* ------------------------------------------------ */
/* Configuration helpers                            */
/* ------------------------------------------------ */

function buildSectionConfig(
  editor: SectionEditorState
):
  | {
      success: true
      config: Record<string, unknown>
    }
  | {
      success: false
      error: string
    } {
  let customConfig: Record<string, unknown> = {}

  if (editor.customConfig.trim()) {
    try {
      const parsed = JSON.parse(
        editor.customConfig
      )

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        return {
          success: false,
          error:
            'Additional configuration must be a JSON object.',
        }
      }

      customConfig = parsed as Record<
        string,
        unknown
      >
    } catch {
      return {
        success: false,
        error:
          'Additional configuration contains invalid JSON.',
      }
    }
  }

  const config: Record<string, unknown> = {
    ...customConfig,
    displayStyle: editor.displayStyle,
  }

  if (editor.limit.trim()) {
    const limit = Number.parseInt(
      editor.limit,
      10
    )

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return {
        success: false,
        error:
          'Item limit must be between 1 and 100.',
      }
    }

    config.limit = limit
  } else {
    delete config.limit
  }

  const venueTypes = editor.venueTypes
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (venueTypes.length > 0) {
    config.venueTypes = [
      ...new Set(venueTypes),
    ]
  } else {
    delete config.venueTypes
  }

  if (editor.defaultZoom.trim()) {
    const defaultZoom = Number.parseInt(
      editor.defaultZoom,
      10
    )

    if (
      !Number.isInteger(defaultZoom) ||
      defaultZoom < 1 ||
      defaultZoom > 22
    ) {
      return {
        success: false,
        error:
          'Default map zoom must be between 1 and 22.',
      }
    }

    config.defaultZoom = defaultZoom
  } else {
    delete config.defaultZoom
  }

  return {
    success: true,
    config,
  }
}

function normalizeSectionRecord(
  value: Record<string, unknown>
): GuideSectionRecord {
  return {
    id: String(value.id ?? ''),
    guide_id: String(value.guide_id ?? ''),
    section_key: String(
      value.section_key ?? 'custom'
    ) as GuideSectionKey,
    title:
      typeof value.title === 'string'
        ? value.title
        : null,
    subtitle:
      typeof value.subtitle === 'string'
        ? value.subtitle
        : null,
    position:
      typeof value.position === 'number'
        ? value.position
        : 0,
    is_visible:
      value.is_visible !== false,
    config: normalizeConfig(value.config),
  }
}

function normalizeConfig(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {}
  }

  return value as Record<string, unknown>
}

function getDisplayStyle(
  config: Record<string, unknown>
): GuideDisplayStyle {
  const value = config.displayStyle

  if (
    value === 'grid' ||
    value === 'list' ||
    value === 'carousel' ||
    value === 'compact' ||
    value === 'featured'
  ) {
    return value
  }

  return 'grid'
}

function getDefaultDisplayStyle(
  sectionKey: GuideSectionKey
): GuideDisplayStyle {
  if (
    sectionKey === 'welcome' ||
    sectionKey === 'map'
  ) {
    return 'featured'
  }

  if (
    sectionKey === 'suggested_routes'
  ) {
    return 'list'
  }

  if (
    sectionKey === 'coffee' ||
    sectionKey === 'bars' ||
    sectionKey === 'events'
  ) {
    return 'carousel'
  }

  if (sectionKey === 'partner_offers') {
    return 'compact'
  }

  return 'grid'
}

function getCustomConfigText(
  config: Record<string, unknown>
) {
  const customConfig = {
    ...config,
  }

  delete customConfig.displayStyle
  delete customConfig.limit
  delete customConfig.venueTypes
  delete customConfig.defaultZoom

  if (
    Object.keys(customConfig).length === 0
  ) {
    return ''
  }

  return JSON.stringify(
    customConfig,
    null,
    2
  )
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
}