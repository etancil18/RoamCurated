'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react'

import {
  CREATOR_FIELD_LIMITS,
  CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
  CREATOR_SOCIAL_PLATFORM_OPTIONS,
} from '@/lib/creator/constants'

import {
  validateCreatorSocialUrl,
} from '@/lib/creator/validateSocialUrl'

import type {
  CreatorSocialLinkInput,
  CreatorSocialPlatform,
} from '@/lib/creator/types'

/* =========================================================
 * Public types
 * ======================================================= */

/**
 * Editable social-link shape used by the client form.
 *
 * `clientId` provides a stable React key for links that have
 * not yet received a database-generated UUID.
 */
export type EditableCreatorSocialLink =
  CreatorSocialLinkInput & {
    clientId: string
  }

export type CreatorSocialLinkFieldErrors = {
  platform?: string | null
  url?: string | null
  handle?: string | null
  is_public?: string | null
}

export type CreatorSocialLinkErrors = Record<
  string,
  CreatorSocialLinkFieldErrors | undefined
>

export type CreatorSocialLinksEditorProps = {
  /**
   * Controlled list of editable social links.
   */
  links: EditableCreatorSocialLink[]

  /**
   * Adds a new link for the selected unused platform.
   */
  onAdd: (
    platform: CreatorSocialPlatform
  ) => void

  /**
   * Removes one link from the controlled collection.
   */
  onRemove: (clientId: string) => void

  /**
   * Moves a link one position up or down.
   */
  onMove: (
    clientId: string,
    direction: 'up' | 'down'
  ) => void

  /**
   * Changes a link's platform.
   *
   * The parent should normally clear or revalidate the existing
   * URL and handle when the platform changes.
   */
  onPlatformChange: (
    clientId: string,
    platform: CreatorSocialPlatform
  ) => void

  /**
   * Applies controlled field updates to one link.
   */
  onUpdate: (
    clientId: string,
    updates: Partial<EditableCreatorSocialLink>
  ) => void

  /**
   * Optional section-level server validation error.
   */
  error?: string | null

  /**
   * Optional field errors keyed by `clientId`.
   */
  linkErrors?: CreatorSocialLinkErrors

  /**
   * Locks all controls.
   */
  disabled?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string

  /**
   * Called before a user-driven mutation.
   *
   * Useful for clearing stale success or validation messages in
   * the parent form.
   */
  onInteraction?: () => void
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorSocialLinksEditor({
  links,
  onAdd,
  onRemove,
  onMove,
  onPlatformChange,
  onUpdate,
  error = null,
  linkErrors,
  disabled = false,
  className = '',
  onInteraction,
}: CreatorSocialLinksEditorProps) {
  const availablePlatforms = useMemo(() => {
    const usedPlatforms = new Set(
      links.map((link) => link.platform)
    )

    return CREATOR_SOCIAL_PLATFORM_OPTIONS.filter(
      (definition) =>
        !usedPlatforms.has(definition.value)
    )
  }, [links])

  const [selectedNewPlatform, setSelectedNewPlatform] =
    useState<CreatorSocialPlatform | null>(
      availablePlatforms[0]?.value ?? null
    )

  useEffect(() => {
    const remainsAvailable =
      selectedNewPlatform !== null &&
      availablePlatforms.some(
        (definition) =>
          definition.value === selectedNewPlatform
      )

    if (!remainsAvailable) {
      setSelectedNewPlatform(
        availablePlatforms[0]?.value ?? null
      )
    }
  }, [
    availablePlatforms,
    selectedNewPlatform,
  ])

  const canAdd =
    !disabled &&
    links.length <
      CREATOR_FIELD_LIMITS.socialLinksPerCreator &&
    selectedNewPlatform !== null

  function interact() {
    onInteraction?.()
  }

  function handleAdd() {
    if (!canAdd || !selectedNewPlatform) {
      return
    }

    interact()
    onAdd(selectedNewPlatform)
  }

  return (
    <section
      aria-labelledby="creator-social-links-title"
      className={[
        'w-full min-w-0 rounded-2xl border bg-black/25 p-4 sm:p-5',
        error
          ? 'border-red-500/50'
          : 'border-neutral-800',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Social presence
          </p>

          <h3
            id="creator-social-links-title"
            className="mt-2 text-base font-semibold text-white"
          >
            Public social links
          </h3>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
            Connect the platforms where brands and collaborators
            can review your work.
          </p>
        </div>

        <p className="shrink-0 text-xs text-neutral-600">
          {links.length.toLocaleString()}/
          {CREATOR_FIELD_LIMITS.socialLinksPerCreator.toLocaleString()}
        </p>
      </div>

      <SectionError message={error} />

      <AddSocialLinkControl
        selectedPlatform={selectedNewPlatform}
        availablePlatforms={availablePlatforms.map(
          (definition) => definition.value
        )}
        disabled={disabled}
        canAdd={canAdd}
        onPlatformChange={setSelectedNewPlatform}
        onAdd={handleAdd}
      />

      {links.length === 0 ? (
        <EmptySocialLinksState />
      ) : (
        <div className="mt-5 space-y-3">
          {links.map((link, index) => (
            <SocialLinkEditorCard
              key={link.clientId}
              link={link}
              index={index}
              totalLinks={links.length}
              links={links}
              disabled={disabled}
              errors={linkErrors?.[link.clientId]}
              onInteraction={interact}
              onRemove={() =>
                onRemove(link.clientId)
              }
              onMove={(direction) =>
                onMove(
                  link.clientId,
                  direction
                )
              }
              onPlatformChange={(platform) =>
                onPlatformChange(
                  link.clientId,
                  platform
                )
              }
              onUpdate={(updates) =>
                onUpdate(
                  link.clientId,
                  updates
                )
              }
            />
          ))}
        </div>
      )}

      {links.length >=
      CREATOR_FIELD_LIMITS.socialLinksPerCreator ? (
        <p className="mt-4 text-xs leading-5 text-amber-300/80">
          You have reached the maximum number of social links.
        </p>
      ) : null}
    </section>
  )
}

/* =========================================================
 * Add-link control
 * ======================================================= */

function AddSocialLinkControl({
  selectedPlatform,
  availablePlatforms,
  disabled,
  canAdd,
  onPlatformChange,
  onAdd,
}: {
  selectedPlatform: CreatorSocialPlatform | null
  availablePlatforms: CreatorSocialPlatform[]
  disabled: boolean
  canAdd: boolean
  onPlatformChange: (
    platform: CreatorSocialPlatform
  ) => void
  onAdd: () => void
}) {
  if (availablePlatforms.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
        <p className="text-xs leading-5 text-neutral-500">
          Every supported social platform has already been
          added.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-5 flex min-w-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 sm:flex-row sm:items-end">
      <label className="block min-w-0 flex-1">
        <span className="text-xs font-medium text-neutral-300">
          Add platform
        </span>

        <select
          value={selectedPlatform ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onPlatformChange(
              event.target
                .value as CreatorSocialPlatform
            )
          }
          className="mt-2 w-full min-w-0 rounded-xl border border-neutral-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {availablePlatforms.map(
            (platform) => (
              <option
                key={platform}
                value={platform}
              >
                {
                  CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
                    platform
                  ].label
                }
              </option>
            )
          )}
        </select>
      </label>

      <button
        type="button"
        disabled={!canAdd}
        onClick={onAdd}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus
          aria-hidden="true"
          className="h-4 w-4"
        />

        Add link
      </button>
    </div>
  )
}

/* =========================================================
 * Empty state
 * ======================================================= */

function EmptySocialLinksState() {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-400">
        <Link2
          aria-hidden="true"
          className="h-5 w-5"
        />
      </div>

      <p className="mt-4 text-sm font-semibold text-white">
        No social links yet
      </p>

      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-neutral-500">
        Add at least one public social profile before enabling
        Creator Mode.
      </p>
    </div>
  )
}

/* =========================================================
 * Link editor card
 * ======================================================= */

function SocialLinkEditorCard({
  link,
  index,
  totalLinks,
  links,
  disabled,
  errors,
  onInteraction,
  onRemove,
  onMove,
  onPlatformChange,
  onUpdate,
}: {
  link: EditableCreatorSocialLink
  index: number
  totalLinks: number
  links: EditableCreatorSocialLink[]
  disabled: boolean
  errors?: CreatorSocialLinkFieldErrors
  onInteraction: () => void
  onRemove: () => void
  onMove: (
    direction: 'up' | 'down'
  ) => void
  onPlatformChange: (
    platform: CreatorSocialPlatform
  ) => void
  onUpdate: (
    updates: Partial<EditableCreatorSocialLink>
  ) => void
}) {
  const definition =
    CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
      link.platform
    ]

  const platformOptions = useMemo(() => {
    const usedByOtherLinks = new Set(
      links
        .filter(
          (candidate) =>
            candidate.clientId !==
            link.clientId
        )
        .map(
          (candidate) =>
            candidate.platform
        )
    )

    return CREATOR_SOCIAL_PLATFORM_OPTIONS.filter(
      (candidate) =>
        candidate.value === link.platform ||
        !usedByOtherLinks.has(
          candidate.value
        )
    )
  }, [
    link.clientId,
    link.platform,
    links,
  ])

  const urlValidation = useMemo(() => {
    if (!link.url.trim()) {
      return null
    }

    return validateCreatorSocialUrl({
      platform: link.platform,
      value: link.url,
    })
  }, [
    link.platform,
    link.url,
  ])

  const hasError =
    Boolean(errors?.platform) ||
    Boolean(errors?.url) ||
    Boolean(errors?.handle) ||
    Boolean(errors?.is_public) ||
    urlValidation?.valid === false

  const publicPreviewUrl =
    urlValidation?.valid === true
      ? urlValidation.normalizedUrl
      : null

  function interact() {
    onInteraction()
  }

  return (
    <article
      className={[
        'w-full min-w-0 rounded-2xl border bg-neutral-950/70 p-3 transition sm:p-4',
        hasError
          ? 'border-red-500/50'
          : link.is_public
            ? 'border-neutral-800'
            : 'border-neutral-800/70 opacity-90',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-neutral-700"
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {definition.label}
            </p>

            <p className="mt-0.5 text-[11px] text-neutral-600">
              Position {index + 1}
            </p>
          </div>

          <VisibilityBadge
            isPublic={link.is_public}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={`Move ${definition.label} up`}
            disabled={disabled || index === 0}
            onClick={() => {
              interact()
              onMove('up')
            }}
          >
            <ChevronUp className="h-4 w-4" />
          </IconButton>

          <IconButton
            label={`Move ${definition.label} down`}
            disabled={
              disabled ||
              index === totalLinks - 1
            }
            onClick={() => {
              interact()
              onMove('down')
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </IconButton>

          <IconButton
            label={`Remove ${definition.label}`}
            disabled={disabled}
            destructive
            onClick={() => {
              interact()
              onRemove()
            }}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <SelectField
          id={`${link.clientId}-platform`}
          label="Platform"
          value={link.platform}
          disabled={disabled}
          error={errors?.platform ?? undefined}
          onChange={(value) => {
            interact()
            onPlatformChange(
              value as CreatorSocialPlatform
            )
          }}
          options={platformOptions.map(
            (platform) => ({
              value: platform.value,
              label: platform.label,
            })
          )}
        />

        {definition.supportsHandle ? (
          <TextField
            id={`${link.clientId}-handle`}
            label="Display handle"
            value={link.handle ?? ''}
            disabled={disabled}
            maxLength={
              CREATOR_FIELD_LIMITS.socialHandle
            }
            placeholder={
              definition.handlePlaceholder
            }
            error={errors?.handle ?? undefined}
            description="Shown beside the platform name on your profile."
            onChange={(value) => {
              interact()
              onUpdate({
                handle: value,
              })
            }}
          />
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <div className="mt-4">
        <TextField
          id={`${link.clientId}-url`}
          label="Profile URL"
          type="url"
          inputMode="url"
          value={link.url}
          disabled={disabled}
          maxLength={
            CREATOR_FIELD_LIMITS.socialUrl
          }
          placeholder={definition.placeholder}
          error={
            errors?.url ??
            (urlValidation?.valid === false
              ? urlValidation.error
              : undefined)
          }
          description={
            urlValidation?.valid === true
              ? `Valid ${definition.label} link.`
              : `Enter the full ${definition.label} profile URL.`
          }
          success={
            urlValidation?.valid === true
          }
          trailingAction={
            publicPreviewUrl ? (
              <a
                href={publicPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${definition.label} profile`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-900 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              >
                <ExternalLink
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </a>
            ) : null
          }
          onChange={(value) => {
            interact()
            onUpdate({
              url: value,
            })
          }}
        />
      </div>

      <VisibilityControl
        id={`${link.clientId}-public`}
        checked={link.is_public}
        disabled={disabled}
        error={errors?.is_public ?? undefined}
        onChange={(checked) => {
          interact()
          onUpdate({
            is_public: checked,
          })
        }}
      />
    </article>
  )
}

/* =========================================================
 * Visibility
 * ======================================================= */

function VisibilityBadge({
  isPublic,
}: {
  isPublic: boolean
}) {
  return (
    <span
      className={[
        'shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
        isPublic
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          : 'border-neutral-700 bg-neutral-900 text-neutral-500',
      ].join(' ')}
    >
      {isPublic ? 'Public' : 'Hidden'}
    </span>
  )
}

function VisibilityControl({
  id,
  checked,
  disabled,
  error,
  onChange,
}: {
  id: string
  checked: boolean
  disabled: boolean
  error?: string
  onChange: (checked: boolean) => void
}) {
  const descriptionId =
    `${id}-description`

  const errorId = error
    ? `${id}-error`
    : undefined

  return (
    <div className="mt-4">
      <label
        htmlFor={id}
        className={[
          'flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
          checked
            ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
            : 'border-neutral-800 bg-black/40',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : '',
          error
            ? 'border-red-500/50'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={[
            descriptionId,
            errorId,
          ]
            .filter(Boolean)
            .join(' ')}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
            {checked ? (
              <Eye
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-emerald-400"
              />
            ) : (
              <EyeOff
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-neutral-500"
              />
            )}

            Show publicly
          </span>

          <span
            id={descriptionId}
            className="mt-1 block text-xs leading-5 text-neutral-500"
          >
            {checked
              ? 'This link will appear on your public creator profile.'
              : 'This link remains saved but is hidden from public visitors.'}
          </span>
        </span>
      </label>

      <FieldError
        id={errorId}
        message={error}
      />
    </div>
  )
}

/* =========================================================
 * Shared fields
 * ======================================================= */

function TextField({
  id,
  label,
  value,
  disabled,
  maxLength,
  placeholder,
  description,
  error,
  success = false,
  type = 'text',
  inputMode,
  trailingAction,
  onChange,
}: {
  id: string
  label: string
  value: string
  disabled: boolean
  maxLength: number
  placeholder?: string
  description?: string
  error?: string
  success?: boolean
  type?: 'text' | 'url'
  inputMode?: 'text' | 'url'
  trailingAction?: React.ReactNode
  onChange: (value: string) => void
}) {
  const descriptionId = description
    ? `${id}-description`
    : undefined

  const errorId = error
    ? `${id}-error`
    : undefined

  const describedBy = [
    descriptionId,
    errorId,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-3"
      >
        <span className="text-xs font-medium text-neutral-300">
          {label}
        </span>

        <CharacterCount
          current={value.length}
          maximum={maxLength}
        />
      </label>

      <div className="relative mt-2">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={
            describedBy || undefined
          }
          onChange={(event) =>
            onChange(event.target.value)
          }
          className={[
            'w-full min-w-0 rounded-xl border bg-black py-2.5 pl-3 text-sm text-white outline-none transition',
            trailingAction
              ? 'pr-12'
              : 'pr-3',
            'placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            error
              ? 'border-red-500/70 focus:border-red-400 focus-visible:ring-red-400/40'
              : success
                ? 'border-emerald-500/50 focus:border-emerald-400 focus-visible:ring-emerald-400/30'
                : 'border-neutral-800 focus:border-cyan-500 focus-visible:ring-cyan-400/40',
          ].join(' ')}
        />

        {trailingAction ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailingAction}
          </div>
        ) : null}
      </div>

      {description ? (
        <p
          id={descriptionId}
          className={[
            'mt-1.5 flex items-start gap-1.5 text-xs leading-5',
            success
              ? 'text-emerald-400/80'
              : 'text-neutral-600',
          ].join(' ')}
        >
          {success ? (
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
          ) : null}

          <span>{description}</span>
        </p>
      ) : null}

      <FieldError
        id={errorId}
        message={error}
      />
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  disabled,
  error,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  disabled: boolean
  error?: string
  options: Array<{
    value: string
    label: string
  }>
  onChange: (value: string) => void
}) {
  const errorId = error
    ? `${id}-error`
    : undefined

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-xs font-medium text-neutral-300"
      >
        {label}
      </label>

      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={[
          'mt-2 w-full min-w-0 rounded-xl border bg-black px-3 py-2.5 text-sm text-white outline-none transition',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          error
            ? 'border-red-500/70 focus:border-red-400 focus-visible:ring-red-400/40'
            : 'border-neutral-800 focus:border-cyan-500 focus-visible:ring-cyan-400/40',
        ].join(' ')}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <FieldError
        id={errorId}
        message={error}
      />
    </div>
  )
}

/* =========================================================
 * Shared controls
 * ======================================================= */

function IconButton({
  label,
  disabled,
  destructive = false,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        'disabled:cursor-not-allowed disabled:opacity-30',
        destructive
          ? 'border-red-900/60 bg-red-950/20 text-red-300 hover:bg-red-950/50 focus-visible:ring-red-400/50'
          : 'border-neutral-800 bg-black/30 text-neutral-400 hover:border-neutral-600 hover:text-white focus-visible:ring-cyan-400/40',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function CharacterCount({
  current,
  maximum,
}: {
  current: number
  maximum: number
}) {
  const atLimit = current >= maximum
  const nearLimit =
    current >= maximum * 0.9

  return (
    <span
      aria-label={`${current} of ${maximum} characters used`}
      className={[
        'shrink-0 text-[10px]',
        atLimit
          ? 'text-red-300'
          : nearLimit
            ? 'text-amber-300'
            : 'text-neutral-600',
      ].join(' ')}
    >
      {current.toLocaleString()}/
      {maximum.toLocaleString()}
    </span>
  )
}

function SectionError({
  message,
}: {
  message?: string | null
}) {
  if (!message) {
    return null
  }

  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3"
    >
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
      />

      <p className="text-xs leading-5 text-red-200">
        {message}
      </p>
    </div>
  )
}

function FieldError({
  id,
  message,
}: {
  id?: string
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-red-300"
    >
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
      />

      <span>{message}</span>
    </p>
  )
}