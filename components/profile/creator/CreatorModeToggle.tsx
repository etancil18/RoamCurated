'use client'

import {
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from 'lucide-react'

import {
  CREATOR_MODE_COPY,
} from '@/lib/creator/constants'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorModeToggleProps = {
  /**
   * Current controlled Creator Mode value.
   */
  enabled: boolean

  /**
   * Called when the user requests a new enabled state.
   *
   * The parent remains responsible for:
   *
   * - confirmation dialogs
   * - local form state
   * - validation
   * - saving
   */
  onChange: (enabled: boolean) => void

  /**
   * Prevents interaction.
   */
  disabled?: boolean

  /**
   * Shows an in-progress state while settings are saving.
   */
  pending?: boolean

  /**
   * Optional field-level validation error.
   */
  error?: string | null

  /**
   * Optional custom heading.
   */
  title?: string

  /**
   * Optional custom explanatory copy.
   */
  description?: string

  /**
   * Optional element ID used by labels and accessibility tools.
   */
  id?: string

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Component
 * ======================================================= */

export default function CreatorModeToggle({
  enabled,
  onChange,
  disabled = false,
  pending = false,
  error = null,
  title = 'Enable Creator Mode',
  description =
    'Turn your public Roam profile into a creator portfolio with social links, collaboration availability, local authority, and featured collections.',
  id = 'creator-mode-enabled',
  className = '',
}: CreatorModeToggleProps) {
  const interactionDisabled =
    disabled || pending

  const statusId = `${id}-status`
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`

  const describedBy = [
    description ? descriptionId : null,
    statusId,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(' ')

  function handleToggle() {
    if (interactionDisabled) {
      return
    }

    onChange(!enabled)
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={[
        'w-full min-w-0 rounded-2xl border bg-black/25 p-4 transition sm:p-5',
        error
          ? 'border-red-500/50'
          : enabled
            ? 'border-cyan-500/30'
            : 'border-neutral-800',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <p className="min-w-0 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              {CREATOR_MODE_COPY.eyebrow}
            </p>
          </div>

          <h3
            id={`${id}-title`}
            className="mt-3 text-base font-semibold text-white"
          >
            {title}
          </h3>

          {description ? (
            <p
              id={descriptionId}
              className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400"
            >
              {description}
            </p>
          ) : null}
        </div>

        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-describedby={
            describedBy || undefined
          }
          aria-label={
            enabled
              ? 'Disable Creator Mode'
              : 'Enable Creator Mode'
          }
          disabled={interactionDisabled}
          onClick={handleToggle}
          className={[
            'relative mt-1 h-8 w-14 shrink-0 rounded-full border outline-none transition',
            'focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            'disabled:cursor-not-allowed disabled:opacity-60',
            enabled
              ? 'border-cyan-300 bg-cyan-400'
              : 'border-neutral-700 bg-neutral-900',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'absolute top-1 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-transform duration-200',
              enabled
                ? 'translate-x-7 bg-black text-cyan-300'
                : 'translate-x-1 bg-neutral-600 text-neutral-300',
            ].join(' ')}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : enabled ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </span>
        </button>
      </div>

      <div
        id={statusId}
        role="status"
        aria-live="polite"
        className={[
          'mt-4 flex min-w-0 items-start gap-3 rounded-xl border px-3 py-3',
          enabled
            ? 'border-emerald-500/25 bg-emerald-500/10'
            : 'border-neutral-800 bg-neutral-950/80',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            pending
              ? 'animate-pulse bg-amber-300'
              : enabled
                ? 'bg-emerald-400'
                : 'bg-neutral-600',
          ].join(' ')}
        />

        <div className="min-w-0">
          <p
            className={[
              'text-xs font-semibold',
              pending
                ? 'text-amber-200'
                : enabled
                  ? 'text-emerald-200'
                  : 'text-neutral-400',
            ].join(' ')}
          >
            {pending
              ? 'Saving Creator Mode…'
              : enabled
                ? CREATOR_MODE_COPY.activeTitle
                : 'Creator Mode is hidden'}
          </p>

          <p
            className={[
              'mt-1 text-xs leading-5',
              enabled
                ? 'text-emerald-300/70'
                : 'text-neutral-600',
            ].join(' ')}
          >
            {pending
              ? 'Keep this page open until the update completes.'
              : enabled
                ? 'Your creator sections will appear publicly after the settings form is saved.'
                : 'Your creator details remain saved, but they will not appear on your public profile.'}
          </p>
        </div>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-3 text-xs leading-5 text-red-300"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}