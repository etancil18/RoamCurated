// components/relay/RelayDetailHeader.tsx

import RelayStatusBadge from '@/components/relay/RelayStatusBadge'

import {
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'

import type {
  RelayDefinition,
} from '@/lib/relay/types'


/* ============================================================
 * MODEL
 * ============================================================
 */

export type RelayDetailHeaderRelay =
  Pick<
    RelayDefinition,
    | 'id'
    | 'title'
    | 'description'
    | 'city'
    | 'theme'
    | 'status'
    | 'executionMode'
    | 'minTeamSize'
    | 'maxTeamSize'
    | 'startsAt'
    | 'endsAt'
    | 'partnerCampaignId'
    | 'slots'
  >


/* ============================================================
 * OPTIONAL CONTEXT BADGE
 * ============================================================
 */

export type RelayDetailHeaderContextTone =
  | 'neutral'
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'red'


export type RelayDetailHeaderContext = {
  label:
    string

  tone?:
    RelayDetailHeaderContextTone
}


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayDetailHeaderProps = {
  relay:
    RelayDetailHeaderRelay

  /**
   * Optional context for the surface currently rendering the Relay.
   *
   * Examples:
   * - "Public Relay"
   * - "Your team"
   * - "Baton active"
   * - "Completed route"
   *
   * This is intentionally presentation-only.
   */
  context?:
    RelayDetailHeaderContext | null

  /**
   * Optional replacement for the standard Relay description.
   */
  description?:
    string | null

  /**
   * Override slot count when a caller has a canonical count from
   * another read model.
   */
  slotCount?:
    number

  /**
   * Optional right-side or footer controls.
   *
   * Examples:
   * - team CTA
   * - manage button
   * - replay button
   *
   * The header never owns mutation behavior.
   */
  actions?:
    React.ReactNode

  /**
   * Optional content below the primary metrics.
   */
  children?:
    React.ReactNode

  className?:
    string
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getContextToneClassName(
  tone:
    RelayDetailHeaderContextTone
): string {
  switch (
    tone
  ) {
    case 'amber':
      return [
        'border-amber-300/18',
        'bg-amber-300/[0.07]',
        'text-amber-100/78',
      ].join(' ')

    case 'emerald':
      return [
        'border-emerald-300/18',
        'bg-emerald-300/[0.06]',
        'text-emerald-100/78',
      ].join(' ')

    case 'violet':
      return [
        'border-violet-300/18',
        'bg-violet-300/[0.06]',
        'text-violet-100/78',
      ].join(' ')

    case 'red':
      return [
        'border-red-300/18',
        'bg-red-300/[0.06]',
        'text-red-100/78',
      ].join(' ')

    case 'neutral':
    default:
      return [
        'border-white/[0.09]',
        'bg-white/[0.035]',
        'text-white/48',
      ].join(' ')
  }
}


function formatExecutionMode(
  executionMode:
    RelayDefinition['executionMode']
): string {
  if (
    executionMode ===
    'sequential'
  ) {
    return 'Sequential'
  }

  return String(
    executionMode
  )
    .replace(
      /_/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    )
}


function formatSlotCount(
  slotCount:
    number
): string {
  return `${slotCount} ${
    slotCount === 1
      ? 'leg'
      : 'legs'
  }`
}


function getLocationLine(
  city:
    string | null,
  theme:
    string | null
): string {
  return [
    city?.trim() ||
      null,

    theme?.trim() ||
      null,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(value)
    )
    .join(
      ' · '
    )
}


/* ============================================================
 * METRIC
 * ============================================================
 */

function RelayDetailHeaderMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-0 bg-[#0b0b0b] px-4 py-4 sm:px-5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">
        {label}
      </dt>

      <dd
        className="mt-1.5 truncate text-sm font-medium leading-6 text-white/68"
        title={
          value
        }
      >
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayDetailHeader({
  relay,
  context,
  description,
  slotCount,
  actions,
  children,
  className,
}: RelayDetailHeaderProps) {
  const resolvedDescription =
    description === undefined
      ? relay.description
      : description

  const resolvedSlotCount =
    slotCount ??
    relay.slots.length

  const locationLine =
    getLocationLine(
      relay.city,
      relay.theme
    )

  return (
    <header
      className={[
        'relative',
        'overflow-hidden',
        'rounded-[30px]',
        'border',
        'border-white/[0.09]',
        'bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))]',
        'p-5',
        'sm:p-7',
        'lg:p-9',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-relay-id={
        relay.id
      }
      data-relay-status={
        relay.status
      }
    >
      {/* ======================================================
       * AMBIENT BACKGROUND
       * ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-300/[0.06] blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-violet-300/[0.035] blur-3xl"
      />


      {/* ======================================================
       * CONTENT
       * ====================================================== */}

      <div className="relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            {/* ==================================================
             * BADGES
             * ================================================== */}

            <div className="flex flex-wrap items-center gap-2">
              <RelayStatusBadge
                kind="relay"
                status={
                  relay.status
                }
              />

              {relay.partnerCampaignId ? (
                <span className="inline-flex items-center rounded-full border border-violet-300/15 bg-violet-300/[0.055] px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.13em] text-violet-100/75">
                  Partner Relay
                </span>
              ) : null}

              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.13em] text-white/38">
                {formatExecutionMode(
                  relay.executionMode
                )}
              </span>

              {context ? (
                <span
                  className={[
                    'inline-flex',
                    'items-center',
                    'rounded-full',
                    'border',
                    'px-2.5',
                    'py-1.5',
                    'text-[9px]',
                    'font-medium',
                    'uppercase',
                    'tracking-[0.13em]',
                    getContextToneClassName(
                      context.tone ??
                        'neutral'
                    ),
                  ].join(' ')}
                >
                  {context.label}
                </span>
              ) : null}
            </div>


            {/* ==================================================
             * LOCATION
             * ================================================== */}

            {locationLine ? (
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/45">
                {locationLine}
              </p>
            ) : null}


            {/* ==================================================
             * TITLE
             * ================================================== */}

            <h1 className="mt-2 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              {relay.title}
            </h1>


            {/* ==================================================
             * DESCRIPTION
             * ================================================== */}

            {resolvedDescription ? (
              <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/50 sm:text-base">
                {
                  resolvedDescription
                }
              </p>
            ) : (
              <p className="mt-5 max-w-2xl text-pretty text-sm leading-7 text-white/42 sm:text-base">
                Build one route together. Each teammate owns one
                leg, completes it in the city, and passes the baton
                to the next person.
              </p>
            )}
          </div>


          {/* ==================================================
           * ACTIONS
           * ================================================== */}

          {actions ? (
            <div className="relative z-10 shrink-0 lg:max-w-xs">
              {actions}
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * METRICS
         * ==================================================== */}

        <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          <RelayDetailHeaderMetric
            label="Team"
            value={
              formatRelayTeamSize(
                relay.minTeamSize,
                relay.maxTeamSize
              )
            }
          />

          <RelayDetailHeaderMetric
            label="Route"
            value={
              formatSlotCount(
                resolvedSlotCount
              )
            }
          />

          <RelayDetailHeaderMetric
            label="Window"
            value={
              formatRelayTimeWindow(
                relay.startsAt,
                relay.endsAt
              )
            }
          />

          <RelayDetailHeaderMetric
            label="Format"
            value={
              formatExecutionMode(
                relay.executionMode
              )
            }
          />
        </dl>


        {/* ====================================================
         * EXTENSION SLOT
         * ==================================================== */}

        {children ? (
          <div className="mt-6 border-t border-white/[0.07] pt-5">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  )
}


export default RelayDetailHeader