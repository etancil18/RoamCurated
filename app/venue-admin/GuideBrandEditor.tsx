'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Eye,
  Image as ImageIcon,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { supabaseBrowser } from '@/lib/supabase/client'

import {
  deleteGuideBrandAction,
  saveGuideBrandAction,
  type GuideBrandInput,
  type GuideBrandingMode,
} from '@/app/venue-admin/guide-actions'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

type Props = {
  selectedBrandId?: string | null
  onBrandChange?: (brandId: string) => void
  className?: string
}

type GuideBrandRow = {
  id: string
  name: string
  slug: string

  logo_url: string | null
  favicon_url: string | null

  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null

  background_color: string | null
  surface_color: string | null
  text_color: string | null
  muted_text_color: string | null
  button_text_color: string | null

  font_family: string | null

  branding_mode: GuideBrandingMode
  powered_by_roam: boolean

  custom_css: string | null

  created_at: string
  updated_at: string
}

type BrandFormState = {
  id: string | null

  name: string
  slug: string

  logoUrl: string
  faviconUrl: string

  primaryColor: string
  secondaryColor: string
  accentColor: string

  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  buttonTextColor: string

  fontFamily: string

  brandingMode: GuideBrandingMode
  poweredByRoam: boolean

  customCss: string
}

type Notice = {
  tone: 'success' | 'error'
  message: string
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const BRANDING_MODES: Array<{
  value: GuideBrandingMode
  label: string
  description: string
}> = [
  {
    value: 'roam',
    label: 'Roam',
    description:
      'Roam is the primary visible brand across the guide experience.',
  },
  {
    value: 'co_branded',
    label: 'Co-branded',
    description:
      'The property brand leads while Roam attribution remains visible.',
  },
  {
    value: 'white_label',
    label: 'White label',
    description:
      'The property brand leads with minimal or no visible Roam identity.',
  },
]

const DEFAULT_COLORS = {
  primaryColor: '#22D3EE',
  secondaryColor: '#6366F1',
  accentColor: '#22D3EE',
  backgroundColor: '#0A0A0A',
  surfaceColor: '#171717',
  textColor: '#FAFAFA',
  mutedTextColor: '#A3A3A3',
  buttonTextColor: '#0A0A0A',
}

const EMPTY_FORM: BrandFormState = {
  id: null,

  name: '',
  slug: '',

  logoUrl: '',
  faviconUrl: '',

  ...DEFAULT_COLORS,

  fontFamily: 'Inter, sans-serif',

  brandingMode: 'co_branded',
  poweredByRoam: true,

  customCss: '',
}

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function GuideBrandEditor({
  selectedBrandId,
  onBrandChange,
  className,
}: Props) {
  const [supabase] = useState(() => supabaseBrowser())

  const [brands, setBrands] = useState<GuideBrandRow[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>('')

  const [form, setForm] = useState<BrandFormState>(EMPTY_FORM)

  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [notice, setNotice] = useState<Notice | null>(null)

  const [isSaving, startSaving] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  const busy = isSaving || isDeleting

  /* ---------------------------------------------- */
  /* Data loading                                   */
  /* ---------------------------------------------- */

  const loadBrands = useCallback(async () => {
    setLoading(true)
    setNotice(null)

    const { data, error } = await supabase
      .from('guide_brands')
      .select(
        `
        id,
        name,
        slug,
        logo_url,
        favicon_url,
        primary_color,
        secondary_color,
        accent_color,
        background_color,
        surface_color,
        text_color,
        muted_text_color,
        button_text_color,
        font_family,
        branding_mode,
        powered_by_roam,
        custom_css,
        created_at,
        updated_at
      `
      )
      .order('name', { ascending: true })

    if (error) {
      console.error('[GuideBrandEditor] Load error:', error)

      setNotice({
        tone: 'error',
        message:
          error.message ||
          'Unable to load guide brands.',
      })

      setLoading(false)
      return
    }

    const normalizedBrands = (data ?? []).map(
      normalizeGuideBrandRow
    )

    setBrands(normalizedBrands)

    setActiveBrandId((current) => {
      if (
        selectedBrandId &&
        normalizedBrands.some(
          (brand) => brand.id === selectedBrandId
        )
      ) {
        return selectedBrandId
      }

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
  }, [selectedBrandId, supabase])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  /* ---------------------------------------------- */
  /* Derived state                                  */
  /* ---------------------------------------------- */

  const activeBrand = useMemo(
    () =>
      brands.find(
        (brand) => brand.id === activeBrandId
      ) ?? null,
    [activeBrandId, brands]
  )

  const formPreview = useMemo(
    () => normalizePreviewBrand(form),
    [form]
  )

  /* ---------------------------------------------- */
  /* Selection                                      */
  /* ---------------------------------------------- */

  function handleSelectBrand(brandId: string) {
    setActiveBrandId(brandId)
    setNotice(null)

    const brand = brands.find(
      (item) => item.id === brandId
    )

    if (brand) {
      setForm(mapBrandToForm(brand))
    }

    onBrandChange?.(brandId)
  }

  useEffect(() => {
    if (!activeBrand || editorOpen) return

    setForm(mapBrandToForm(activeBrand))
  }, [activeBrand, editorOpen])

  /* ---------------------------------------------- */
  /* Editor lifecycle                               */
  /* ---------------------------------------------- */

  function openCreateEditor() {
    setForm(EMPTY_FORM)
    setEditorOpen(true)
    setAdvancedOpen(false)
    setNotice(null)
  }

  function openEditEditor() {
    if (!activeBrand) return

    setForm(mapBrandToForm(activeBrand))
    setEditorOpen(true)
    setNotice(null)
  }

  function closeEditor() {
    if (busy) return

    if (activeBrand) {
      setForm(mapBrandToForm(activeBrand))
    } else {
      setForm(EMPTY_FORM)
    }

    setEditorOpen(false)
    setAdvancedOpen(false)
  }

  function updateForm<K extends keyof BrandFormState>(
    key: K,
    value: BrandFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleNameChange(value: string) {
    setForm((current) => {
      const shouldGenerateSlug =
        !current.id &&
        (
          !current.slug ||
          current.slug === slugify(current.name)
        )

      return {
        ...current,
        name: value,
        slug: shouldGenerateSlug
          ? slugify(value)
          : current.slug,
      }
    })
  }

  function resetColors() {
    setForm((current) => ({
      ...current,
      ...DEFAULT_COLORS,
    }))
  }

  /* ---------------------------------------------- */
  /* Save                                           */
  /* ---------------------------------------------- */

  function handleSave() {
    setNotice(null)

    const validation = validateBrandForm(form)

    if (!validation.success) {
      setNotice({
        tone: 'error',
        message: validation.error,
      })
      return
    }

    const payload: GuideBrandInput = {
      id: form.id,

      name: form.name,
      slug: form.slug,

      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,

      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentColor: form.accentColor,

      backgroundColor: form.backgroundColor,
      surfaceColor: form.surfaceColor,
      textColor: form.textColor,
      mutedTextColor: form.mutedTextColor,
      buttonTextColor: form.buttonTextColor,

      fontFamily: form.fontFamily,

      brandingMode: form.brandingMode,
      poweredByRoam: form.poweredByRoam,

      customCss: form.customCss,
    }

    startSaving(async () => {
      const result =
        await saveGuideBrandAction(payload)

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
          ? 'Guide brand updated.'
          : 'Guide brand created.',
      })

      setEditorOpen(false)

      await loadBrands()

      setActiveBrandId(result.data.id)
      onBrandChange?.(result.data.id)
    })
  }

  /* ---------------------------------------------- */
  /* Duplicate                                      */
  /* ---------------------------------------------- */

  function handleDuplicate() {
    if (!activeBrand) return

    const duplicatedName =
      `${activeBrand.name} Copy`

    setForm({
      ...mapBrandToForm(activeBrand),
      id: null,
      name: duplicatedName,
      slug: slugify(duplicatedName),
    })

    setEditorOpen(true)
    setNotice(null)
  }

  /* ---------------------------------------------- */
  /* Delete                                         */
  /* ---------------------------------------------- */

  function handleDelete() {
    if (!activeBrand) return

    const confirmed = window.confirm(
      `Delete the “${activeBrand.name}” brand?\n\nThis action will fail if the brand is still assigned to any property guides.`
    )

    if (!confirmed) return

    setNotice(null)

    startDeleting(async () => {
      const result =
        await deleteGuideBrandAction(activeBrand.id)

      if (!result.success) {
        setNotice({
          tone: 'error',
          message: result.error,
        })
        return
      }

      setNotice({
        tone: 'success',
        message: 'Guide brand deleted.',
      })

      const remainingBrands = brands.filter(
        (brand) => brand.id !== activeBrand.id
      )

      setBrands(remainingBrands)

      const nextBrandId =
        remainingBrands[0]?.id ?? ''

      setActiveBrandId(nextBrandId)

      if (nextBrandId) {
        onBrandChange?.(nextBrandId)
      }

      setEditorOpen(false)
    })
  }

  /* ---------------------------------------------- */
  /* Loading                                        */
  /* ---------------------------------------------- */

  if (loading) {
    return (
      <AdminCard className={className}>
        <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          Loading guide brands…
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
              White-label system
            </p>

            <h2 className="mt-1 text-xl font-semibold text-white">
              Guide Brands
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Configure property identity, color tokens, logos,
              attribution, typography, and optional custom CSS.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateEditor}
            disabled={busy}
            className={primaryButtonClassName}
          >
            <Plus className="h-4 w-4" />
            New Brand
          </button>
        </header>

        {notice ? (
          <NoticeBanner notice={notice} />
        ) : null}

        {brands.length === 0 ? (
          <EmptyState
            title="No guide brands yet"
            description="Create the first brand before building property guides."
            action={
              <button
                type="button"
                onClick={openCreateEditor}
                className={`${primaryButtonClassName} mt-4`}
              >
                <Plus className="h-4 w-4" />
                Create Brand
              </button>
            }
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-300">
                    Active brand
                  </span>

                  <select
                    value={activeBrandId}
                    disabled={busy}
                    onChange={(event) =>
                      handleSelectBrand(event.target.value)
                    }
                    className={`${inputClassName} mt-2`}
                  >
                    {brands.map((brand) => (
                      <option
                        key={brand.id}
                        value={brand.id}
                      >
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>

                {activeBrand ? (
                  <BrandSummary brand={activeBrand} />
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={openEditEditor}
                    disabled={!activeBrand || busy}
                    className={secondaryButtonClassName}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={!activeBrand || busy}
                    className={secondaryButtonClassName}
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!activeBrand || busy}
                  className={dangerButtonClassName}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}

                  Delete Brand
                </button>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-black/30">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewOpen((current) => !current)
                  }
                  className="flex w-full items-center justify-between gap-4 border-b border-neutral-800 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-cyan-300" />

                    <span className="text-sm font-semibold text-white">
                      Brand Preview
                    </span>
                  </span>

                  {previewOpen ? (
                    <ChevronUp className="h-4 w-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-neutral-500" />
                  )}
                </button>

                {previewOpen && activeBrand ? (
                  <div className="p-4">
                    <BrandPreview
                      brand={mapBrandToForm(activeBrand)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {editorOpen ? (
          <BrandEditorForm
            form={form}
            isSaving={isSaving}
            advancedOpen={advancedOpen}
            onAdvancedToggle={() =>
              setAdvancedOpen((current) => !current)
            }
            onChange={updateForm}
            onNameChange={handleNameChange}
            onResetColors={resetColors}
            onSave={handleSave}
            onCancel={closeEditor}
          />
        ) : null}
      </div>
    </AdminCard>
  )
}

/* ------------------------------------------------ */
/* Brand Summary                                    */
/* ------------------------------------------------ */

function BrandSummary({
  brand,
}: {
  brand: GuideBrandRow
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/30 p-4">
      <div className="flex items-start gap-3">
        <BrandLogo
          logoUrl={brand.logo_url}
          name={brand.name}
          backgroundColor={
            brand.surface_color ?? '#171717'
          }
          textColor={
            brand.accent_color ?? '#22D3EE'
          }
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white">
            {brand.name}
          </h3>

          <p className="mt-1 truncate text-xs text-neutral-500">
            /guide/{brand.slug}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>
              {humanize(brand.branding_mode)}
            </Pill>

            <Pill
              tone={
                brand.powered_by_roam
                  ? 'accent'
                  : 'default'
              }
            >
              {brand.powered_by_roam
                ? 'Powered by Roam'
                : 'No Roam attribution'}
            </Pill>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <ColorSwatch
          label="Primary"
          color={
            brand.primary_color ?? '#22D3EE'
          }
        />

        <ColorSwatch
          label="Secondary"
          color={
            brand.secondary_color ?? '#6366F1'
          }
        />

        <ColorSwatch
          label="Background"
          color={
            brand.background_color ?? '#0A0A0A'
          }
        />

        <ColorSwatch
          label="Surface"
          color={
            brand.surface_color ?? '#171717'
          }
        />
      </div>

      <p className="mt-4 text-[11px] text-neutral-600">
        Updated {formatDateTime(brand.updated_at)}
      </p>
    </div>
  )
}

/* ------------------------------------------------ */
/* Editor Form                                      */
/* ------------------------------------------------ */

function BrandEditorForm({
  form,
  isSaving,
  advancedOpen,
  onAdvancedToggle,
  onChange,
  onNameChange,
  onResetColors,
  onSave,
  onCancel,
}: {
  form: BrandFormState
  isSaving: boolean
  advancedOpen: boolean
  onAdvancedToggle: () => void
  onChange: <K extends keyof BrandFormState>(
    key: K,
    value: BrandFormState[K]
  ) => void
  onNameChange: (value: string) => void
  onResetColors: () => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-neutral-950 p-4 shadow-2xl shadow-black/40 sm:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
            {form.id ? 'Edit brand' : 'Create brand'}
          </p>

          <h3 className="mt-1 text-lg font-semibold text-white">
            {form.id
              ? form.name || 'Guide Brand'
              : 'New Guide Brand'}
          </h3>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Close brand editor"
          className="rounded-full border border-neutral-800 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-6">
        <section className="space-y-4">
          <SectionHeading
            icon={<Sparkles className="h-4 w-4" />}
            title="Identity"
            description="The property-facing name and URL identity."
          />

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Brand name" required>
              <input
                value={form.name}
                disabled={isSaving}
                maxLength={160}
                onChange={(event) =>
                  onNameChange(event.target.value)
                }
                placeholder="Hotel Indigo Atlanta"
                className={inputClassName}
              />
            </Field>

            <Field
              label="Brand slug"
              required
              hint="Lowercase letters, numbers, and hyphens only."
            >
              <input
                value={form.slug}
                disabled={isSaving}
                onChange={(event) =>
                  onChange(
                    'slug',
                    slugify(event.target.value)
                  )
                }
                placeholder="hotel-indigo-atlanta"
                className={inputClassName}
              />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Logo URL">
              <input
                value={form.logoUrl}
                disabled={isSaving}
                onChange={(event) =>
                  onChange(
                    'logoUrl',
                    event.target.value
                  )
                }
                placeholder="/images/guides/hotel-logo.png"
                className={inputClassName}
              />
            </Field>

            <Field label="Favicon URL">
              <input
                value={form.faviconUrl}
                disabled={isSaving}
                onChange={(event) =>
                  onChange(
                    'faviconUrl',
                    event.target.value
                  )
                }
                placeholder="/images/guides/favicon.png"
                className={inputClassName}
              />
            </Field>
          </div>

          <Field label="Font family">
            <input
              value={form.fontFamily}
              disabled={isSaving}
              onChange={(event) =>
                onChange(
                  'fontFamily',
                  event.target.value
                )
              }
              placeholder="Inter, sans-serif"
              className={inputClassName}
            />
          </Field>
        </section>

        <section className="space-y-4 border-t border-neutral-800 pt-6">
          <SectionHeading
            icon={<Palette className="h-4 w-4" />}
            title="Color System"
            description="These tokens control the public guide shell and components."
            action={
              <button
                type="button"
                onClick={onResetColors}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 transition hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset colors
              </button>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ColorField
              label="Primary"
              value={form.primaryColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('primaryColor', value)
              }
            />

            <ColorField
              label="Secondary"
              value={form.secondaryColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('secondaryColor', value)
              }
            />

            <ColorField
              label="Accent"
              value={form.accentColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('accentColor', value)
              }
            />

            <ColorField
              label="Background"
              value={form.backgroundColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('backgroundColor', value)
              }
            />

            <ColorField
              label="Surface"
              value={form.surfaceColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('surfaceColor', value)
              }
            />

            <ColorField
              label="Text"
              value={form.textColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('textColor', value)
              }
            />

            <ColorField
              label="Muted text"
              value={form.mutedTextColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('mutedTextColor', value)
              }
            />

            <ColorField
              label="Button text"
              value={form.buttonTextColor}
              disabled={isSaving}
              onChange={(value) =>
                onChange('buttonTextColor', value)
              }
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-neutral-800 pt-6">
          <SectionHeading
            icon={<ImageIcon className="h-4 w-4" />}
            title="Branding Mode"
            description="Control how prominently Roam appears alongside the property brand."
          />

          <div className="grid gap-3 lg:grid-cols-3">
            {BRANDING_MODES.map((mode) => (
              <BrandingModeCard
                key={mode.value}
                mode={mode}
                checked={
                  form.brandingMode === mode.value
                }
                disabled={isSaving}
                onSelect={() =>
                  onChange(
                    'brandingMode',
                    mode.value
                  )
                }
              />
            ))}
          </div>

          <ToggleCard
            checked={form.poweredByRoam}
            disabled={isSaving}
            title="Show Powered by Roam"
            description="Display Roam attribution in the public guide footer."
            onChange={(checked) =>
              onChange('poweredByRoam', checked)
            }
          />
        </section>

        <section className="border-t border-neutral-800 pt-6">
          <button
            type="button"
            onClick={onAdvancedToggle}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <span className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-cyan-300" />

              <span>
                <span className="block text-sm font-semibold text-white">
                  Advanced CSS
                </span>

                <span className="mt-0.5 block text-xs text-neutral-500">
                  Optional trusted administrator-authored styling.
                </span>
              </span>
            </span>

            {advancedOpen ? (
              <ChevronUp className="h-4 w-4 text-neutral-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-neutral-500" />
            )}
          </button>

          {advancedOpen ? (
            <div className="mt-4">
              <Field
                label="Custom CSS"
                hint="Maximum 20,000 characters. Only trusted administrators should edit this."
              >
                <textarea
                  value={form.customCss}
                  disabled={isSaving}
                  maxLength={20000}
                  rows={10}
                  spellCheck={false}
                  onChange={(event) =>
                    onChange(
                      'customCss',
                      event.target.value
                    )
                  }
                  placeholder={`[data-guide-shell] {
  --guide-radius: 20px;
}`}
                  className={`${inputClassName} resize-y font-mono text-xs`}
                />
              </Field>

              <p className="mt-2 text-right text-[11px] text-neutral-600">
                {form.customCss.length.toLocaleString()}
                {' / '}
                20,000
              </p>
            </div>
          ) : null}
        </section>

        <section className="border-t border-neutral-800 pt-6">
          <SectionHeading
            icon={<Eye className="h-4 w-4" />}
            title="Live Preview"
            description="Preview the current unsaved brand values."
          />

          <div className="mt-4">
            <BrandPreview brand={form} />
          </div>
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
              !form.name.trim() ||
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
              : 'Create Brand'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------ */
/* Preview                                          */
/* ------------------------------------------------ */

function BrandPreview({
  brand,
}: {
  brand: BrandFormState
}) {
  const style = {
    '--preview-primary':
      validColorOrFallback(
        brand.primaryColor,
        '#22D3EE'
      ),
    '--preview-secondary':
      validColorOrFallback(
        brand.secondaryColor,
        '#6366F1'
      ),
    '--preview-accent':
      validColorOrFallback(
        brand.accentColor,
        '#22D3EE'
      ),
    '--preview-background':
      validColorOrFallback(
        brand.backgroundColor,
        '#0A0A0A'
      ),
    '--preview-surface':
      validColorOrFallback(
        brand.surfaceColor,
        '#171717'
      ),
    '--preview-text':
      validColorOrFallback(
        brand.textColor,
        '#FAFAFA'
      ),
    '--preview-muted':
      validColorOrFallback(
        brand.mutedTextColor,
        '#A3A3A3'
      ),
    '--preview-button-text':
      validColorOrFallback(
        brand.buttonTextColor,
        '#0A0A0A'
      ),
    fontFamily:
      brand.fontFamily.trim() ||
      'Inter, sans-serif',
  } as React.CSSProperties

  return (
    <div
      style={style}
      className="overflow-hidden rounded-[1.5rem] border border-neutral-800"
    >
      <div className="relative bg-[var(--preview-background)] p-5 text-[var(--preview-text)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--preview-primary)] opacity-15 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo
                logoUrl={brand.logoUrl}
                name={brand.name || 'Guide Brand'}
                backgroundColor="var(--preview-surface)"
                textColor="var(--preview-accent)"
              />

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--preview-accent)]">
                  Local Guide
                </p>

                <h3 className="mt-1 text-lg font-semibold">
                  {brand.name || 'Your Hotel'}
                </h3>
              </div>
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--preview-muted)]">
              {humanize(brand.brandingMode)}
            </span>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--preview-surface)] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--preview-accent)]">
              Welcome
            </p>

            <h4 className="mt-2 text-xl font-semibold">
              Your neighborhood, curated
            </h4>

            <p className="mt-2 text-sm leading-6 text-[var(--preview-muted)]">
              Discover nearby places, hotel picks, and easy
              flows built around your stay.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[var(--preview-primary)] px-4 py-2 text-sm font-bold text-[var(--preview-button-text)]"
              >
                Explore Guide
              </button>

              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--preview-text)]"
              >
                View Map
              </button>
            </div>
          </div>

          {brand.poweredByRoam ? (
            <p className="mt-4 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--preview-muted)]">
              Powered by Roam
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3">
        <div className="h-1.5 bg-[var(--preview-primary)]" />
        <div className="h-1.5 bg-[var(--preview-secondary)]" />
        <div className="h-1.5 bg-[var(--preview-accent)]" />
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

const dangerButtonClassName = [
  'inline-flex min-h-11 w-full items-center justify-center gap-2',
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

function SectionHeading({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
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

      {action}
    </div>
  )
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-neutral-300">
        {label}
      </span>

      <span className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={
            isHexColor(value)
              ? value
              : '#000000'
          }
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.value.toUpperCase()
            )
          }
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-neutral-800 bg-black p-1 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <input
          value={value}
          disabled={disabled}
          maxLength={7}
          onChange={(event) =>
            onChange(
              event.target.value.toUpperCase()
            )
          }
          placeholder="#22D3EE"
          className={inputClassName}
        />
      </span>
    </label>
  )
}

function BrandingModeCard({
  mode,
  checked,
  disabled,
  onSelect,
}: {
  mode: {
    value: GuideBrandingMode
    label: string
    description: string
  }
  checked: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={[
        'rounded-xl border p-4 text-left transition',
        checked
          ? 'border-cyan-400/50 bg-cyan-400/10'
          : 'border-neutral-800 bg-black/30 hover:border-neutral-700',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">
          {mode.label}
        </span>

        <span
          className={[
            'flex h-5 w-5 items-center justify-center rounded-full border',
            checked
              ? 'border-cyan-300 bg-cyan-300 text-neutral-950'
              : 'border-neutral-700',
          ].join(' ')}
        >
          {checked ? (
            <Check className="h-3 w-3" />
          ) : null}
        </span>
      </span>

      <span className="mt-2 block text-xs leading-5 text-neutral-500">
        {mode.description}
      </span>
    </button>
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

function BrandLogo({
  logoUrl,
  name,
  backgroundColor,
  textColor,
}: {
  logoUrl?: string | null
  name: string
  backgroundColor: string
  textColor: string
}) {
  const resolvedUrl = normalizeAssetUrl(logoUrl)

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-xl border border-white/10 object-contain p-1"
        style={{ backgroundColor }}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-sm font-black"
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      {getInitials(name)}
    </div>
  )
}

function ColorSwatch({
  label,
  color,
}: {
  label: string
  color: string
}) {
  return (
    <div>
      <div
        className="h-8 rounded-lg border border-white/10"
        style={{
          backgroundColor:
            validColorOrFallback(
              color,
              '#000000'
            ),
        }}
      />

      <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wide text-neutral-600">
        {label}
      </p>
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
        'inline-flex rounded-full border px-2 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wide',
        tone === 'accent'
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
          : 'border-neutral-800 bg-neutral-950 text-neutral-500',
      ].join(' ')}
    >
      {children}
    </span>
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
        <Palette className="h-5 w-5" />
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
/* Data Mapping                                     */
/* ------------------------------------------------ */

function normalizeGuideBrandRow(
  value: Record<string, unknown>
): GuideBrandRow {
  return {
    id: String(value.id ?? ''),
    name:
      typeof value.name === 'string'
        ? value.name
        : 'Unnamed Brand',
    slug:
      typeof value.slug === 'string'
        ? value.slug
        : '',

    logo_url:
      typeof value.logo_url === 'string'
        ? value.logo_url
        : null,
    favicon_url:
      typeof value.favicon_url === 'string'
        ? value.favicon_url
        : null,

    primary_color:
      typeof value.primary_color === 'string'
        ? value.primary_color
        : null,
    secondary_color:
      typeof value.secondary_color === 'string'
        ? value.secondary_color
        : null,
    accent_color:
      typeof value.accent_color === 'string'
        ? value.accent_color
        : null,

    background_color:
      typeof value.background_color === 'string'
        ? value.background_color
        : null,
    surface_color:
      typeof value.surface_color === 'string'
        ? value.surface_color
        : null,
    text_color:
      typeof value.text_color === 'string'
        ? value.text_color
        : null,
    muted_text_color:
      typeof value.muted_text_color === 'string'
        ? value.muted_text_color
        : null,
    button_text_color:
      typeof value.button_text_color === 'string'
        ? value.button_text_color
        : null,

    font_family:
      typeof value.font_family === 'string'
        ? value.font_family
        : null,

    branding_mode:
      isBrandingMode(value.branding_mode)
        ? value.branding_mode
        : 'co_branded',

    powered_by_roam:
      value.powered_by_roam !== false,

    custom_css:
      typeof value.custom_css === 'string'
        ? value.custom_css
        : null,

    created_at:
      typeof value.created_at === 'string'
        ? value.created_at
        : '',
    updated_at:
      typeof value.updated_at === 'string'
        ? value.updated_at
        : '',
  }
}

function mapBrandToForm(
  brand: GuideBrandRow
): BrandFormState {
  return {
    id: brand.id,

    name: brand.name,
    slug: brand.slug,

    logoUrl: brand.logo_url ?? '',
    faviconUrl: brand.favicon_url ?? '',

    primaryColor:
      brand.primary_color ??
      DEFAULT_COLORS.primaryColor,
    secondaryColor:
      brand.secondary_color ??
      DEFAULT_COLORS.secondaryColor,
    accentColor:
      brand.accent_color ??
      DEFAULT_COLORS.accentColor,

    backgroundColor:
      brand.background_color ??
      DEFAULT_COLORS.backgroundColor,
    surfaceColor:
      brand.surface_color ??
      DEFAULT_COLORS.surfaceColor,
    textColor:
      brand.text_color ??
      DEFAULT_COLORS.textColor,
    mutedTextColor:
      brand.muted_text_color ??
      DEFAULT_COLORS.mutedTextColor,
    buttonTextColor:
      brand.button_text_color ??
      DEFAULT_COLORS.buttonTextColor,

    fontFamily:
      brand.font_family ??
      'Inter, sans-serif',

    brandingMode: brand.branding_mode,
    poweredByRoam: brand.powered_by_roam,

    customCss: brand.custom_css ?? '',
  }
}

function normalizePreviewBrand(
  form: BrandFormState
): BrandFormState {
  return {
    ...form,
    name:
      form.name.trim() ||
      'Guide Brand',
    slug:
      form.slug.trim() ||
      'guide-brand',
  }
}

/* ------------------------------------------------ */
/* Validation                                       */
/* ------------------------------------------------ */

function validateBrandForm(
  form: BrandFormState
):
  | { success: true }
  | { success: false; error: string } {
  if (!form.name.trim()) {
    return {
      success: false,
      error: 'Brand name is required.',
    }
  }

  if (!form.slug.trim()) {
    return {
      success: false,
      error: 'Brand slug is required.',
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
        'Brand slug must use lowercase letters, numbers, and hyphens only.',
    }
  }

  const colors = [
    ['Primary color', form.primaryColor],
    ['Secondary color', form.secondaryColor],
    ['Accent color', form.accentColor],
    ['Background color', form.backgroundColor],
    ['Surface color', form.surfaceColor],
    ['Text color', form.textColor],
    ['Muted text color', form.mutedTextColor],
    ['Button text color', form.buttonTextColor],
  ] as const

  for (const [label, value] of colors) {
    if (!isHexColor(value)) {
      return {
        success: false,
        error:
          `${label} must be a six-character hex value such as #22D3EE.`,
      }
    }
  }

  if (form.customCss.length > 20000) {
    return {
      success: false,
      error:
        'Custom CSS cannot exceed 20,000 characters.',
    }
  }

  return {
    success: true,
  }
}

/* ------------------------------------------------ */
/* Helpers                                          */
/* ------------------------------------------------ */

function isBrandingMode(
  value: unknown
): value is GuideBrandingMode {
  return (
    value === 'roam' ||
    value === 'co_branded' ||
    value === 'white_label'
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

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(
    value.trim()
  )
}

function validColorOrFallback(
  value: string,
  fallback: string
) {
  return isHexColor(value)
    ? value
    : fallback
}

function normalizeAssetUrl(
  value: string | null | undefined
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return null
  }

  const cleaned = value.trim()

  if (
    cleaned.startsWith('/') ||
    cleaned.startsWith('https://') ||
    cleaned.startsWith('http://')
  ) {
    return cleaned
  }

  return `/${cleaned}`
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'GB'
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return `${words[0][0] ?? ''}${
    words[1][0] ?? ''
  }`.toUpperCase()
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value || 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}