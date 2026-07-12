'use client'

import type { ReactNode } from 'react'

type ControlButtonProps = {
  label: string
  icon: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  badge?: string | number | null
  className?: string
  tooltipSide?: 'left' | 'right'
}

export type MapControlRailProps = {
  onToggleCitySelector?: () => void
  isCitySelectorOpen?: boolean
  cityLabel?: string | null

  onRecenterUser?: () => void
  canRecenterUser?: boolean
  isFollowingUser?: boolean

  onResetCityView?: () => void
  canResetCityView?: boolean

  onFitRoute?: () => void
  canFitRoute?: boolean

  onToggleVenues?: () => void
  areVenuesVisible?: boolean

  onToggleLiveEvents?: () => void
  showLiveEventsOnly?: boolean
  liveEventCount?: number | null

  onToggleRoute?: () => void
  isRouteVisible?: boolean
  hasRoute?: boolean

  onToggleSetStartMode?: () => void
  isSetStartMode?: boolean

  onOpenFilters?: () => void
  hasActiveFilters?: boolean

  position?: 'right' | 'left'
  compact?: boolean
  className?: string
}

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )
    .map((value) => value.trim())
    .join(' ')
}

function ControlButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  badge = null,
  className,
  tooltipSide = 'left',
}: ControlButtonProps) {
  const hasToggleState = typeof onClick === 'function'

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={hasToggleState ? active : undefined}
        className={joinClassNames(
          `
            relative
            grid
            h-11
            w-11
            place-items-center
            rounded-2xl
            border
            text-zinc-300
            shadow-sm
            transition
            duration-150
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-cyan-300
            focus-visible:ring-offset-2
            focus-visible:ring-offset-zinc-950
            disabled:cursor-not-allowed
            disabled:opacity-35
          `,
          active
            ? `
                border-cyan-300/35
                bg-cyan-300/15
                text-cyan-100
                shadow-[0_0_24px_rgba(34,211,238,0.14)]
              `
            : `
                border-white/10
                bg-white/[0.055]
                hover:border-white/20
                hover:bg-white/10
                hover:text-white
              `,
          className
        )}
      >
        <span aria-hidden="true" className="grid place-items-center">
          {icon}
        </span>

        {badge !== null && badge !== undefined && (
          <span
            aria-hidden="true"
            className="
              absolute
              -right-1
              -top-1
              grid
              h-4
              min-w-4
              place-items-center
              rounded-full
              border
              border-zinc-950
              bg-violet-500
              px-1
              text-[8px]
              font-black
              leading-none
              text-white
              shadow-lg
            "
          >
            {badge}
          </span>
        )}

        {active && (
          <span
            aria-hidden="true"
            className="
              absolute
              bottom-1
              h-1
              w-1
              rounded-full
              bg-cyan-300
              shadow-[0_0_8px_rgba(34,211,238,0.85)]
            "
          />
        )}
      </button>

      <div
        role="tooltip"
        className={joinClassNames(
          `
            pointer-events-none
            absolute
            top-1/2
            z-20
            hidden
            -translate-y-1/2
            whitespace-nowrap
            rounded-lg
            border
            border-white/10
            bg-zinc-950/95
            px-2.5
            py-1.5
            text-[11px]
            font-semibold
            text-zinc-100
            opacity-0
            shadow-xl
            backdrop-blur-xl
            transition
            group-hover:opacity-100
            group-focus-within:opacity-100
            md:block
          `,
          tooltipSide === 'left'
            ? 'right-[calc(100%+0.65rem)]'
            : 'left-[calc(100%+0.65rem)]'
        )}
      >
        {label}
      </div>
    </div>
  )
}

function Divider() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto h-px w-7 bg-white/10"
    />
  )
}

export default function MapControlRail({
  onToggleCitySelector,
  isCitySelectorOpen = false,
  cityLabel = null,

  onRecenterUser,
  canRecenterUser = false,
  isFollowingUser = false,

  onResetCityView,
  canResetCityView = false,

  onFitRoute,
  canFitRoute = false,

  onToggleVenues,
  areVenuesVisible = true,

  onToggleLiveEvents,
  showLiveEventsOnly = false,
  liveEventCount = null,

  onToggleRoute,
  isRouteVisible = true,
  hasRoute = false,

  onToggleSetStartMode,
  isSetStartMode = false,

  onOpenFilters,
  hasActiveFilters = false,

  position = 'right',
  compact = false,
  className,
}: MapControlRailProps) {
  const tooltipSide = position === 'right' ? 'left' : 'right'

  const cityButtonLabel = cityLabel
    ? `Choose city. Current city: ${cityLabel}`
    : 'Choose city'

  const hasNavigationControls = Boolean(
    onRecenterUser || onResetCityView || onFitRoute
  )

  const hasLayerControls = Boolean(
    onToggleVenues || onToggleLiveEvents || onToggleRoute
  )

  const hasUtilityControls = Boolean(
    onToggleSetStartMode || onOpenFilters
  )

  return (
    <nav
      aria-label="Map controls"
      className={joinClassNames(
        `
          pointer-events-auto
          fixed
          top-[calc(4rem+0.75rem)]
          z-[1000]
          flex
          flex-col
          items-center
          gap-1.5
          rounded-[22px]
          border
          border-white/10
          bg-zinc-950/82
          p-1.5
          shadow-[0_18px_55px_rgba(0,0,0,0.42)]
          backdrop-blur-2xl
        `,
        position === 'right'
          ? 'right-3 md:right-4'
          : 'left-3 md:left-4',
        compact && 'scale-95',
        className
      )}
    >
      {onToggleCitySelector && (
        <ControlButton
          label={cityButtonLabel}
          onClick={onToggleCitySelector}
          active={isCitySelectorOpen}
          tooltipSide={tooltipSide}
          icon={<CityIcon />}
        />
      )}

      {onToggleCitySelector && hasNavigationControls && <Divider />}

      {onRecenterUser && (
        <ControlButton
          label={
            isFollowingUser
              ? 'Stop following your location'
              : 'Recenter on your location'
          }
          onClick={onRecenterUser}
          active={isFollowingUser}
          disabled={!canRecenterUser}
          tooltipSide={tooltipSide}
          icon={<LocationIcon />}
        />
      )}

      {onResetCityView && (
        <ControlButton
          label="Reset city view"
          onClick={onResetCityView}
          disabled={!canResetCityView}
          tooltipSide={tooltipSide}
          icon={<ResetViewIcon />}
        />
      )}

      {onFitRoute && (
        <ControlButton
          label="Fit active Flow"
          onClick={onFitRoute}
          disabled={!canFitRoute}
          tooltipSide={tooltipSide}
          icon={<FitRouteIcon />}
        />
      )}

      {hasLayerControls && <Divider />}

      {onToggleVenues && (
        <ControlButton
          label={areVenuesVisible ? 'Hide venues' : 'Show venues'}
          onClick={onToggleVenues}
          active={areVenuesVisible}
          tooltipSide={tooltipSide}
          icon={<VenueLayerIcon />}
        />
      )}

      {onToggleLiveEvents && (
        <ControlButton
          label={
            showLiveEventsOnly
              ? 'Show all venues'
              : 'Show live-event venues only'
          }
          onClick={onToggleLiveEvents}
          active={showLiveEventsOnly}
          badge={
            typeof liveEventCount === 'number' && liveEventCount > 0
              ? liveEventCount
              : null
          }
          tooltipSide={tooltipSide}
          icon={<LiveEventIcon />}
        />
      )}

      {onToggleRoute && (
        <ControlButton
          label={isRouteVisible ? 'Hide route' : 'Show route'}
          onClick={onToggleRoute}
          active={hasRoute && isRouteVisible}
          disabled={!hasRoute}
          tooltipSide={tooltipSide}
          icon={<RouteLayerIcon />}
        />
      )}

      {hasUtilityControls && <Divider />}

      {onToggleSetStartMode && (
        <ControlButton
          label={
            isSetStartMode
              ? 'Stop placing start point'
              : 'Set custom start point'
          }
          onClick={onToggleSetStartMode}
          active={isSetStartMode}
          tooltipSide={tooltipSide}
          icon={<StartPointIcon />}
        />
      )}

      {onOpenFilters && (
        <ControlButton
          label="Open map filters"
          onClick={onOpenFilters}
          active={hasActiveFilters}
          tooltipSide={tooltipSide}
          icon={<FilterIcon />}
        />
      )}
    </nav>
  )
}

function CityIcon() {
  return (
    <svg
      width="19"
      height="19"
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

function LocationIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </svg>
  )
}

function ResetViewIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M5.6 15a8 8 0 0 0 12.8 2" />
      <path d="M18.4 9A8 8 0 0 0 5.6 7" />
    </svg>
  )
}

function FitRouteIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M16 21h5v-5" />
      <path d="M7 16c2-5 4 1 6-4s4 1 4-4" />
    </svg>
  )
}

function VenueLayerIcon() {
  return (
    <svg
      width="19"
      height="19"
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
      <circle cx="12" cy="10" r="2" />
    </svg>
  )
}

function LiveEventIcon() {
  return (
    <svg
      width="19"
      height="19"
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
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16" />
      <path d="m12 13 .8 1.7 1.9.2-1.4 1.3.4 1.8-1.7-.9-1.7.9.4-1.8-1.4-1.3 1.9-.2.8-1.7Z" />
    </svg>
  )
}

function RouteLayerIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18c6 0 2-12 8-12" />
    </svg>
  )
}

function StartPointIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13Z" />
      <path d="M9 9h6" />
      <path d="M12 6v6" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 6h16" />
      <circle
        cx="9"
        cy="6"
        r="2"
        fill="currentColor"
        stroke="none"
      />
      <path d="M4 12h16" />
      <circle
        cx="15"
        cy="12"
        r="2"
        fill="currentColor"
        stroke="none"
      />
      <path d="M4 18h16" />
      <circle
        cx="11"
        cy="18"
        r="2"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}