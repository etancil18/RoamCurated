'use client'

import type { ReactNode } from 'react'

export type MapEmptyStateKind =
  | 'choose-city'
  | 'zoom-in'
  | 'no-results'
  | 'no-live-events'
  | 'no-venues'

type Props = {
  kind: MapEmptyStateKind

  title?: string
  description?: string

  actionLabel?: string
  onAction?: () => void

  secondaryActionLabel?: string
  onSecondaryAction?: () => void

  icon?: ReactNode

  position?: 'top' | 'center' | 'bottom'
  compact?: boolean
  className?: string
}

type Preset = {
  title: string
  description: string
  defaultActionLabel?: string
  icon: ReactNode
}

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0
    )
    .join(' ')
}

function getPreset(
  kind: MapEmptyStateKind
): Preset {
  switch (kind) {
    case 'choose-city':
      return {
        title: 'Choose a city to begin',
        description:
          'Select a city to explore curated places, events, and ready-to-follow Flows.',
        defaultActionLabel:
          'Choose city',
        icon: <CityIcon />,
      }

    case 'zoom-in':
      return {
        title: 'Zoom in to explore',
        description:
          'More curated venues appear as you move closer to the neighborhood level.',
        icon: <ZoomIcon />,
      }

    case 'no-results':
      return {
        title: 'No places match this search',
        description:
          'Try a broader term, clear a filter, or move the map to another area.',
        defaultActionLabel:
          'Reset filters',
        icon: <SearchIcon />,
      }

    case 'no-live-events':
      return {
        title: 'No live-event venues here',
        description:
          'Move the map, widen the view, or show all curated venues instead.',
        defaultActionLabel:
          'Show all venues',
        icon: <EventIcon />,
      }

    case 'no-venues':
      return {
        title: 'No curated venues in this view',
        description:
          'Move the map or zoom out to find nearby places.',
        icon: <MapPinIcon />,
      }
  }
}

export default function MapEmptyState({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon,
  position = 'top',
  compact = false,
  className,
}: Props) {
  const preset = getPreset(kind)

  const resolvedTitle =
    title ?? preset.title

  const resolvedDescription =
    description ??
    preset.description

  const resolvedActionLabel =
    actionLabel ??
    preset.defaultActionLabel

  const hasPrimaryAction =
    Boolean(
      resolvedActionLabel &&
        onAction
    )

  const hasSecondaryAction =
    Boolean(
      secondaryActionLabel &&
        onSecondaryAction
    )

  return (
    <div
      className={joinClassNames(
        `
          pointer-events-none
          absolute
          inset-x-0
          z-[1050]
          flex
          justify-center
          px-4
        `,
        position === 'top' &&
          'top-[calc(4rem+1rem)]',
        position === 'center' &&
          'top-1/2 -translate-y-1/2',
        position === 'bottom' &&
          'bottom-[calc(env(safe-area-inset-bottom)+1rem)]',
        className
      )}
    >
      <section
        role="status"
        aria-live="polite"
        className={joinClassNames(
          `
            pointer-events-auto
            w-full
            border
            border-white/10
            bg-zinc-950/84
            text-white
            shadow-[0_18px_55px_rgba(0,0,0,0.42)]
            backdrop-blur-2xl
          `,
          compact
            ? `
                max-w-sm
                rounded-2xl
                px-3
                py-2.5
              `
            : `
                max-w-md
                rounded-[22px]
                px-4
                py-4
              `
        )}
      >
        <div
          className={joinClassNames(
            'flex items-start',
            compact
              ? 'gap-2.5'
              : 'gap-3'
          )}
        >
          <div
            aria-hidden="true"
            className={joinClassNames(
              `
                grid
                shrink-0
                place-items-center
                rounded-2xl
                border
                border-cyan-300/20
                bg-cyan-300/10
                text-cyan-200
                shadow-[0_0_24px_rgba(34,211,238,0.08)]
              `,
              compact
                ? 'h-9 w-9'
                : 'h-11 w-11'
            )}
          >
            {icon ?? preset.icon}
          </div>

          <div className="min-w-0 flex-1">
            <h2
              className={joinClassNames(
                'font-black leading-tight text-white',
                compact
                  ? 'text-sm'
                  : 'text-base'
              )}
            >
              {resolvedTitle}
            </h2>

            <p
              className={joinClassNames(
                'mt-1 leading-5 text-zinc-400',
                compact
                  ? 'text-xs'
                  : 'text-sm'
              )}
            >
              {resolvedDescription}
            </p>

            {(hasPrimaryAction ||
              hasSecondaryAction) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {hasPrimaryAction && (
                  <button
                    type="button"
                    onClick={onAction}
                    className="
                      rounded-xl
                      bg-white
                      px-3
                      py-2
                      text-xs
                      font-black
                      text-zinc-950
                      transition
                      hover:bg-zinc-100
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-cyan-300
                      focus-visible:ring-offset-2
                      focus-visible:ring-offset-zinc-950
                    "
                  >
                    {resolvedActionLabel}
                  </button>
                )}

                {hasSecondaryAction && (
                  <button
                    type="button"
                    onClick={onSecondaryAction}
                    className="
                      rounded-xl
                      border
                      border-white/10
                      bg-white/[0.055]
                      px-3
                      py-2
                      text-xs
                      font-bold
                      text-zinc-200
                      transition
                      hover:border-white/20
                      hover:bg-white/10
                      hover:text-white
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-cyan-300
                    "
                  >
                    {secondaryActionLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function CityIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 21h18" />
      <path d="M5 21V8l5-3v16" />
      <path d="M10 21V3l6 3v15" />
      <path d="M16 21v-9l3 2v7" />
      <path d="M7 11h1" />
      <path d="M7 15h1" />
      <path d="M13 9h1" />
      <path d="M13 13h1" />
    </svg>
  )
}

function ZoomIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />
      <path d="m20 20-4-4" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="11"
        cy="11"
        r="7"
      />
      <path d="m20 20-4-4" />
      <path d="M8.5 11h5" />
    </svg>
  )
}

function EventIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="3"
      />
      <path d="M4 10h16" />
      <path d="m12 13 .8 1.7 1.9.2-1.4 1.3.4 1.8-1.7-.9-1.7.9.4-1.8-1.4-1.3 1.9-.2.8-1.7Z" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
      <circle
        cx="12"
        cy="10"
        r="2"
      />
    </svg>
  )
}