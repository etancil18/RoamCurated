// components/relay/RelayCard.tsx

import Link from 'next/link'

import RelayStatusBadge from '@/components/relay/RelayStatusBadge'
import {
  formatRelaySlotCount,
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'

import type {
  RelayId,
  RelayStatus,
} from '@/lib/relay/types'


/* ============================================================
 * PUBLIC MODEL
 * ============================================================
 */

export type RelayCardModel = {
  id:
    RelayId

  competitionId:
    string

  title:
    string

  description?:
    string | null

  city:
    string | null

  theme?:
    string | null

  status:
    RelayStatus

  startsAt:
    string | null

  endsAt:
    string | null

  minTeamSize:
    number

  maxTeamSize:
    number

  slotCount:
    number

  /**
   * Presentation-only Partner decoration.
   *
   * Do not infer commercial settlement or payout semantics from
   * this flag.
   */
  hasPartner?:
    boolean

  /**
   * Optional editorial image.
   *
   * This has no execution or eligibility meaning.
   */
  imageUrl?:
    string | null
}


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayCardVariant =
  | 'default'
  | 'compact'


export type RelayCardProps = {
  relay:
    RelayCardModel

  href?:
    string

  variant?:
    RelayCardVariant

  /**
   * Show short description copy when present.
   */
  showDescription?:
    boolean

  className?:
    string
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getLocationLine(
  city:
    string | null,
  theme:
    string | null | undefined
): string {
  const parts = [
    city?.trim() ||
      null,

    theme?.trim() ||
      null,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(value)
  )

  return parts.length >
    0
    ? parts.join(
        ' · '
      )
    : 'City experience'
}


function slugify(
  value: string
): string {
  return value
    .normalize(
      'NFKD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
    .slice(
      0,
      80
    )
}


/* ============================================================
 * META ITEM
 * ============================================================
 */

function RelayCardMetaItem({
  label,
  value,
  compact,
}: {
  label:
    string

  value:
    string

  compact:
    boolean
}) {
  return (
    <div className="min-w-0">
      <dt
        className={[
          'font-medium',
          'uppercase',
          'tracking-[0.12em]',
          'text-white/26',
          compact
            ? 'text-[9px]'
            : 'text-[10px]',
        ].join(' ')}
      >
        {label}
      </dt>

      <dd
        className={[
          'mt-1',
          'truncate',
          'font-medium',
          'text-white/68',
          compact
            ? 'text-[11px]'
            : 'text-xs',
        ].join(' ')}
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

export function RelayCard({
  relay,
  href,
  variant = 'default',
  showDescription = true,
  className,
}: RelayCardProps) {
  const compact =
    variant ===
    'compact'

  const titleSlug =
    slugify(
      relay.title
    ) ||
    'competition'

  const resolvedHref =
    href ??
    `/competitions/${titleSlug}--${relay.competitionId}`

  const description =
    relay.description
      ?.trim() ||
    null

  const locationLine =
    getLocationLine(
      relay.city,
      relay.theme
    )

  return (
    <article
      className={[
        'group',
        'relative',
        'overflow-hidden',
        'rounded-3xl',
        'border',
        'border-white/[0.08]',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022))]',
        'shadow-[0_16px_46px_rgba(0,0,0,0.14)]',
        'transition',
        'hover:border-white/[0.13]',
        'hover:bg-white/[0.04]',
        compact
          ? 'p-4'
          : 'p-5 sm:p-6',
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
       * OPTIONAL IMAGE
       * ====================================================== */}

      {relay.imageUrl ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
        >
          <img
            src={
              relay.imageUrl
            }
            alt=""
            className="h-full w-full object-cover opacity-[0.14] transition duration-500 group-hover:scale-[1.015] group-hover:opacity-[0.18]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,9,0.38),rgba(9,9,9,0.9))]" />
        </div>
      ) : null}


      {/* ======================================================
       * CONTENT
       * ====================================================== */}

      <div className="relative z-10">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <RelayStatusBadge
                kind="relay"
                status={
                  relay.status
                }
                compact
              />

              {relay.hasPartner ? (
                <span
                  className={[
                    'inline-flex',
                    'items-center',
                    'rounded-full',
                    'border',
                    'border-violet-300/14',
                    'bg-violet-300/[0.055]',
                    'px-2.5',
                    'py-1.5',
                    'text-[9px]',
                    'font-medium',
                    'uppercase',
                    'tracking-[0.12em]',
                    'text-violet-100/72',
                  ].join(' ')}
                >
                  Partner Relay
                </span>
              ) : null}
            </div>

            <p
              className={[
                'mt-3',
                'font-medium',
                'uppercase',
                'tracking-[0.13em]',
                'text-white/32',
                compact
                  ? 'text-[9px]'
                  : 'text-[10px]',
              ].join(' ')}
            >
              {locationLine}
            </p>

            <h3
              className={[
                'mt-1.5',
                'font-semibold',
                'tracking-[-0.03em]',
                'text-white',
                compact
                  ? 'text-lg'
                  : 'text-xl sm:text-2xl',
              ].join(' ')}
            >
              <Link
                href={
                  resolvedHref
                }
                className={[
                  'rounded-sm',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-white/30',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0"
                />

                <span className="relative">
                  {relay.title}
                </span>
              </Link>
            </h3>

            {showDescription &&
            description ? (
              <p
                className={[
                  'mt-2.5',
                  'line-clamp-2',
                  'max-w-2xl',
                  'leading-relaxed',
                  'text-white/42',
                  compact
                    ? 'text-[11px]'
                    : 'text-sm',
                ].join(' ')}
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>


        {/* ====================================================
         * META
         * ==================================================== */}

        <dl
          className={[
            'mt-5',
            'grid',
            'gap-3',
            'border-t',
            'border-white/[0.06]',
            'pt-4',
            compact
              ? 'grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-4',
          ].join(' ')}
        >
          <RelayCardMetaItem
            label="Window"
            value={
              formatRelayTimeWindow(
                relay.startsAt,
                relay.endsAt
              )
            }
            compact={
              compact
            }
          />

          <RelayCardMetaItem
            label="Team"
            value={
              formatRelayTeamSize(
                relay.minTeamSize,
                relay.maxTeamSize
              )
            }
            compact={
              compact
            }
          />

          <RelayCardMetaItem
            label="Route"
            value={
              formatRelaySlotCount(
                relay.slotCount
              )
            }
            compact={
              compact
            }
          />

          <RelayCardMetaItem
            label="Format"
            value="Sequential"
            compact={
              compact
            }
          />
        </dl>


        {/* ====================================================
         * FOOTER
         * ==================================================== */}

        <div
          className={[
            'mt-4',
            'flex',
            'items-center',
            'justify-between',
            'gap-3',
          ].join(' ')}
        >
          <p
            className={[
              'text-white/28',
              compact
                ? 'text-[10px]'
                : 'text-[11px]',
            ].join(' ')}
          >
            One teammate per leg
          </p>

          <span
            aria-hidden="true"
            className={[
              'inline-flex',
              'items-center',
              'text-white/42',
              'transition',
              'group-hover:translate-x-0.5',
              'group-hover:text-white/70',
              compact
                ? 'text-[11px]'
                : 'text-xs',
            ].join(' ')}
          >
            View Relay →
          </span>
        </div>
      </div>
    </article>
  )
}


export default RelayCard