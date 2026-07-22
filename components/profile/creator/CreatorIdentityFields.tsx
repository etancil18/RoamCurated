'use client'

import {
  BriefcaseBusiness,
  Mail,
  MapPin,
  Plane,
  UserRound,
} from 'lucide-react'

import {
  CREATOR_FIELD_LIMITS,
} from '@/lib/creator/constants'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorIdentityFieldErrors = {
  creatorHeadline?: string | null
  creatorBio?: string | null
  primaryCity?: string | null
  publicEmail?: string | null
  availableForTravel?: string | null
  acceptingCollaborations?: string | null
}

export type CreatorIdentityFieldsProps = {
  creatorHeadline: string
  creatorBio: string
  primaryCity: string
  publicEmail: string
  availableForTravel: boolean
  acceptingCollaborations: boolean

  onCreatorHeadlineChange: (value: string) => void
  onCreatorBioChange: (value: string) => void
  onPrimaryCityChange: (value: string) => void
  onPublicEmailChange: (value: string) => void
  onAvailableForTravelChange: (value: boolean) => void
  onAcceptingCollaborationsChange: (value: boolean) => void

  disabled?: boolean
  errors?: CreatorIdentityFieldErrors
  className?: string

  /**
   * Optional callback invoked before any field mutation.
   *
   * Useful for clearing stale save or validation messages in the
   * parent form without coupling this component to that state.
   */
  onInteraction?: () => void
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorIdentityFields({
  creatorHeadline,
  creatorBio,
  primaryCity,
  publicEmail,
  availableForTravel,
  acceptingCollaborations,
  onCreatorHeadlineChange,
  onCreatorBioChange,
  onPrimaryCityChange,
  onPublicEmailChange,
  onAvailableForTravelChange,
  onAcceptingCollaborationsChange,
  disabled = false,
  errors,
  className = '',
  onInteraction,
}: CreatorIdentityFieldsProps) {
  function handleInteraction() {
    onInteraction?.()
  }

  return (
    <section
      aria-labelledby="creator-identity-fields-title"
      className={[
        'w-full min-w-0 rounded-2xl border border-neutral-800 bg-black/25 p-4 sm:p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <SectionHeading />

      <div className="mt-5 space-y-5">
        <TextField
          id="creator-headline"
          label="Creator headline"
          value={creatorHeadline}
          placeholder="Chicago food and hospitality creator"
          maxLength={CREATOR_FIELD_LIMITS.headline}
          required
          disabled={disabled}
          error={errors?.creatorHeadline ?? undefined}
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          description="Describe your niche and value in one clear line."
          onChange={(value) => {
            handleInteraction()
            onCreatorHeadlineChange(value)
          }}
        />

        <TextAreaField
          id="creator-bio"
          label="Creator bio"
          value={creatorBio}
          placeholder="I create short-form content for restaurants, hotels, and local experiences."
          maxLength={CREATOR_FIELD_LIMITS.bio}
          rows={5}
          disabled={disabled}
          error={errors?.creatorBio ?? undefined}
          icon={<UserRound className="h-4 w-4" />}
          description="Explain what you create, who you work with, and what makes your perspective useful."
          onChange={(value) => {
            handleInteraction()
            onCreatorBioChange(value)
          }}
        />

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <TextField
            id="creator-primary-city"
            label="Primary city"
            value={primaryCity}
            placeholder="Chicago"
            maxLength={CREATOR_FIELD_LIMITS.primaryCity}
            disabled={disabled}
            error={errors?.primaryCity ?? undefined}
            icon={<MapPin className="h-4 w-4" />}
            description="The city most closely associated with your work."
            onChange={(value) => {
              handleInteraction()
              onPrimaryCityChange(value)
            }}
          />

          <TextField
            id="creator-public-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            label="Public contact email"
            value={publicEmail}
            placeholder="hello@example.com"
            maxLength={CREATOR_FIELD_LIMITS.publicEmail}
            disabled={disabled}
            error={errors?.publicEmail ?? undefined}
            icon={<Mail className="h-4 w-4" />}
            description="Only add an email you are comfortable displaying publicly."
            onChange={(value) => {
              handleInteraction()
              onPublicEmailChange(value)
            }}
          />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <BooleanPreferenceCard
            id="creator-accepting-collaborations"
            checked={acceptingCollaborations}
            disabled={disabled}
            title="Accepting collaborations"
            description="Show visitors that you are open to brand, venue, and destination opportunities."
            error={errors?.acceptingCollaborations ?? undefined}
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            activeLabel="Open to opportunities"
            inactiveLabel="Not currently accepting"
            onChange={(value) => {
              handleInteraction()
              onAcceptingCollaborationsChange(value)
            }}
          />

          <BooleanPreferenceCard
            id="creator-available-for-travel"
            checked={availableForTravel}
            disabled={disabled}
            title="Available for travel"
            description="Signal that you may accept opportunities outside your primary city."
            error={errors?.availableForTravel ?? undefined}
            icon={<Plane className="h-4 w-4" />}
            activeLabel="Travel available"
            inactiveLabel="Local opportunities only"
            onChange={(value) => {
              handleInteraction()
              onAvailableForTravelChange(value)
            }}
          />
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Section heading
 * ======================================================= */

function SectionHeading() {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        Identity
      </p>

      <h3
        id="creator-identity-fields-title"
        className="mt-2 text-base font-semibold text-white"
      >
        How collaborators see you
      </h3>

      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
        Use specific language about your niche, location, and creative value.
        Avoid generic labels that could describe anyone.
      </p>
    </div>
  )
}

/* =========================================================
 * Text input
 * ======================================================= */

function TextField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  required = false,
  disabled,
  type = 'text',
  inputMode,
  autoComplete,
  description,
  error,
  icon,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  maxLength: number
  required?: boolean
  disabled: boolean
  type?: 'text' | 'email' | 'url'
  inputMode?: 'text' | 'email' | 'url'
  autoComplete?: string
  description?: string
  error?: string
  icon?: React.ReactNode
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
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-200">
          {icon ? (
            <span className="shrink-0 text-neutral-500">
              {icon}
            </span>
          ) : null}

          <span className="truncate">
            {label}
            {required ? (
              <span className="text-cyan-400">
                {' '}*
              </span>
            ) : null}
          </span>
        </span>

        <CharacterCount
          current={value.length}
          maximum={maxLength}
        />
      </label>

      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        required={required}
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
          'mt-2 w-full min-w-0 rounded-xl border bg-black px-3 py-2.5 text-sm text-white outline-none transition',
          'placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          error
            ? 'border-red-500/70 focus:border-red-400 focus-visible:ring-red-400/50'
            : 'border-neutral-800 focus:border-cyan-500 focus-visible:ring-cyan-400/40',
        ].join(' ')}
      />

      {description ? (
        <p
          id={descriptionId}
          className="mt-1.5 text-xs leading-5 text-neutral-600"
        >
          {description}
        </p>
      ) : null}

      <FieldError
        id={errorId}
        message={error}
      />
    </div>
  )
}

/* =========================================================
 * Text area
 * ======================================================= */

function TextAreaField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  rows,
  disabled,
  description,
  error,
  icon,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  maxLength: number
  rows: number
  disabled: boolean
  description?: string
  error?: string
  icon?: React.ReactNode
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
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-200">
          {icon ? (
            <span className="shrink-0 text-neutral-500">
              {icon}
            </span>
          ) : null}

          <span className="truncate">
            {label}
          </span>
        </span>

        <CharacterCount
          current={value.length}
          maximum={maxLength}
        />
      </label>

      <textarea
        id={id}
        value={value}
        rows={rows}
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
          'mt-2 w-full min-w-0 resize-y rounded-xl border bg-black px-3 py-2.5 text-sm leading-6 text-white outline-none transition',
          'placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
          error
            ? 'border-red-500/70 focus:border-red-400 focus-visible:ring-red-400/50'
            : 'border-neutral-800 focus:border-cyan-500 focus-visible:ring-cyan-400/40',
        ].join(' ')}
      />

      {description ? (
        <p
          id={descriptionId}
          className="mt-1.5 text-xs leading-5 text-neutral-600"
        >
          {description}
        </p>
      ) : null}

      <FieldError
        id={errorId}
        message={error}
      />
    </div>
  )
}

/* =========================================================
 * Boolean preference card
 * ======================================================= */

function BooleanPreferenceCard({
  id,
  checked,
  disabled,
  title,
  description,
  error,
  icon,
  activeLabel,
  inactiveLabel,
  onChange,
}: {
  id: string
  checked: boolean
  disabled: boolean
  title: string
  description: string
  error?: string
  icon?: React.ReactNode
  activeLabel: string
  inactiveLabel: string
  onChange: (value: boolean) => void
}) {
  const descriptionId = `${id}-description`
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
        className={[
          'flex h-full min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
          'focus-within:ring-2 focus-within:ring-cyan-400/40 focus-within:ring-offset-2 focus-within:ring-offset-black',
          checked
            ? 'border-cyan-500/30 bg-cyan-500/10'
            : 'border-neutral-800 bg-neutral-950/70',
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
          aria-describedby={
            describedBy || undefined
          }
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
        />

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className="shrink-0 text-neutral-500">
                {icon}
              </span>
            ) : null}

            <span className="min-w-0 text-sm font-semibold text-white">
              {title}
            </span>
          </span>

          <span
            id={descriptionId}
            className="mt-1 block text-xs leading-5 text-neutral-500"
          >
            {description}
          </span>

          <span
            className={[
              'mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
              checked
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-neutral-700 bg-neutral-900 text-neutral-500',
            ].join(' ')}
          >
            {checked
              ? activeLabel
              : inactiveLabel}
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
 * Shared helpers
 * ======================================================= */

function CharacterCount({
  current,
  maximum,
}: {
  current: number
  maximum: number
}) {
  const nearLimit =
    current >= maximum * 0.9

  const atLimit =
    current >= maximum

  return (
    <span
      aria-label={`${current} of ${maximum} characters used`}
      className={[
        'shrink-0 text-[11px]',
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
      className="mt-2 text-xs leading-5 text-red-300"
    >
      {message}
    </p>
  )
}