// components/venue-admin/relay/RelayPreview.tsx

import RelayRewardSummary, {
  type RelayPartnerRewardCopy,
} from '@/components/relay/RelayRewardSummary'
import RelaySlotList from '@/components/relay/RelaySlotList'
import RelayStatusBadge from '@/components/relay/RelayStatusBadge'

import {
  formatRelaySlotCount,
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'

import type {
  RelayDefinition,
  RelayRewardPolicyDisplay,
} from '@/lib/relay/types'


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayPreviewVariant =
  | 'default'
  | 'compact'


export type RelayPreviewProps = {
  relay:
    RelayDefinition

  rewardPolicy?:
    RelayRewardPolicyDisplay | null

  /**
   * Optional future Partner presentation.
   *
   * Commercial Partner reward copy remains separate from XP.
   */
  partnerReward?:
    RelayPartnerRewardCopy | null

  /**
   * Optional editorial image.
   *
   * This is presentation only and is not part of execution
   * integrity.
   */
  imageUrl?:
    string | null

  variant?:
    RelayPreviewVariant

  /**
   * Show admin-only framing that makes clear this is a preview.
   */
  showPreviewChrome?:
    boolean

  className?:
    string
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getRelayLocationLine(
  city:
    string | null,
  theme:
    string | null
): string {
  const parts = [
    city?.trim() ||
      null,

    theme?.trim() ||
      null,
  ].filter(
    (
      part
    ): part is string =>
      Boolean(part)
  )

  return parts.length >
    0
    ? parts.join(
        ' · '
      )
    : 'City experience'
}


function getRelayMetaItems(
  relay:
    RelayDefinition
): Array<{
  label: string
  value: string
}> {
  return [
    {
      label:
        'Route',

      value:
        formatRelaySlotCount(
          relay.slots.length
        ),
    },

    {
      label:
        'Team',

      value:
        formatRelayTeamSize(
          relay.minTeamSize,
          relay.maxTeamSize
        ),
    },

    {
      label:
        'Window',

      value:
        formatRelayTimeWindow(
          relay.startsAt,
          relay.endsAt
        ),
    },
  ]
}


/* ============================================================
 * PREVIEW CHROME
 * ============================================================
 */

function RelayPreviewChrome({
  compact,
}: {
  compact:
    boolean
}) {
  return (
    <div
      className={[
        'flex',
        'items-center',
        'justify-between',
        'gap-3',
        'rounded-t-3xl',
        'border',
        'border-b-0',
        'border-white/[0.08]',
        'bg-black/35',
        compact
          ? 'px-4 py-3'
          : 'px-5 py-3.5',
      ].join(' ')}
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
          Consumer preview
        </p>

        <p
          className={[
            'mt-1',
            'text-white/42',
            compact
              ? 'text-[11px]'
              : 'text-xs',
          ].join(' ')}
        >
          Read-only representation of the public Relay surface.
        </p>
      </div>

      <span
        className={[
          'inline-flex',
          'shrink-0',
          'items-center',
          'rounded-full',
          'border',
          'border-white/[0.08]',
          'bg-white/[0.03]',
          'px-2.5',
          'py-1.5',
          'text-[9px]',
          'font-medium',
          'uppercase',
          'tracking-[0.12em]',
          'text-white/42',
        ].join(' ')}
      >
        Preview
      </span>
    </div>
  )
}


/* ============================================================
 * HERO
 * ============================================================
 */

function RelayPreviewHero({
  relay,
  imageUrl,
  compact,
}: {
  relay:
    RelayDefinition

  imageUrl:
    string | null

  compact:
    boolean
}) {
  const description =
    relay.description
      ?.trim() ||
    null

  const locationLine =
    getRelayLocationLine(
      relay.city,
      relay.theme
    )

  return (
    <header
      className={[
        'relative',
        'overflow-hidden',
        'rounded-3xl',
        'border',
        'border-white/[0.08]',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022))]',
        compact
          ? 'p-4'
          : 'p-5 sm:p-6',
      ].join(' ')}
    >
      {imageUrl ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
        >
          <img
            src={
              imageUrl
            }
            alt=""
            className="h-full w-full object-cover opacity-20"
          />

          <div
            className={[
              'absolute',
              'inset-0',
              'bg-[linear-gradient(180deg,rgba(9,9,9,0.35),rgba(9,9,9,0.88))]',
            ].join(' ')}
          />
        </div>
      ) : null}

      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <RelayStatusBadge
            kind="relay"
            status={
              relay.status
            }
            compact
          />

          {relay.partnerCampaignId ? (
            <span
              className={[
                'inline-flex',
                'min-h-6',
                'items-center',
                'rounded-full',
                'border',
                'border-violet-300/14',
                'bg-violet-300/[0.055]',
                'px-2',
                'py-1',
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
            'mt-4',
            'font-medium',
            'uppercase',
            'tracking-[0.14em]',
            'text-white/34',
            compact
              ? 'text-[9px]'
              : 'text-[10px]',
          ].join(' ')}
        >
          {locationLine}
        </p>

        <h2
          className={[
            'mt-2',
            'max-w-3xl',
            'font-semibold',
            'tracking-[-0.04em]',
            'text-white',
            compact
              ? 'text-2xl'
              : 'text-3xl sm:text-4xl',
          ].join(' ')}
        >
          {relay.title}
        </h2>

        {description ? (
          <p
            className={[
              'mt-3',
              'max-w-2xl',
              'leading-relaxed',
              'text-white/48',
              compact
                ? 'text-xs'
                : 'text-sm sm:text-[15px]',
            ].join(' ')}
          >
            {description}
          </p>
        ) : null}
      </div>
    </header>
  )
}


/* ============================================================
 * META STRIP
 * ============================================================
 */

function RelayPreviewMeta({
  relay,
  compact,
}: {
  relay:
    RelayDefinition

  compact:
    boolean
}) {
  const metaItems =
    getRelayMetaItems(
      relay
    )

  return (
    <dl
      className={[
        'grid',
        'gap-3',
        compact
          ? 'grid-cols-1'
          : 'sm:grid-cols-3',
      ].join(' ')}
    >
      {metaItems.map(
        (item) => (
          <div
            key={
              item.label
            }
            className={[
              'rounded-2xl',
              'border',
              'border-white/[0.07]',
              'bg-white/[0.025]',
              compact
                ? 'px-3.5 py-3'
                : 'px-4 py-4',
            ].join(' ')}
          >
            <dt className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/28">
              {item.label}
            </dt>

            <dd
              className={[
                'mt-1.5',
                'font-medium',
                'leading-relaxed',
                'text-white/68',
                compact
                  ? 'text-xs'
                  : 'text-sm',
              ].join(' ')}
            >
              {item.value}
            </dd>
          </div>
        )
      )}
    </dl>
  )
}


/* ============================================================
 * CTA PREVIEW
 * ============================================================
 *
 * Presentation only.
 *
 * This does not determine eligibility, team state, or whether a
 * user can actually form/join/start a team.
 * ============================================================
 */

function RelayPreviewCta({
  compact,
}: {
  compact:
    boolean
}) {
  return (
    <div
      className={[
        'rounded-3xl',
        'border',
        'border-amber-300/14',
        'bg-amber-300/[0.045]',
        compact
          ? 'p-4'
          : 'p-5',
      ].join(' ')}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-amber-100/48">
        Consumer CTA preview
      </p>

      <div
        className={[
          'mt-3',
          'flex',
          'flex-col',
          'gap-3',
          compact
            ? ''
            : 'sm:flex-row sm:items-center sm:justify-between',
        ].join(' ')}
      >
        <div>
          <p
            className={[
              'font-semibold',
              'tracking-[-0.015em]',
              'text-amber-50',
              compact
                ? 'text-sm'
                : 'text-base',
            ].join(' ')}
          >
            Build this Relay with your team
          </p>

          <p
            className={[
              'mt-1.5',
              'leading-relaxed',
              'text-amber-50/42',
              compact
                ? 'text-[11px]'
                : 'text-xs',
            ].join(' ')}
          >
            Actual CTA state will depend on authentication, team
            membership, Relay lifecycle, and trusted RPC state.
          </p>
        </div>

        <span
          aria-disabled="true"
          className={[
            'inline-flex',
            'min-h-10',
            'shrink-0',
            'items-center',
            'justify-center',
            'rounded-full',
            'border',
            'border-amber-300/20',
            'bg-amber-300/[0.08]',
            'px-4',
            'text-xs',
            'font-semibold',
            'text-amber-50/75',
          ].join(' ')}
        >
          Form a team
        </span>
      </div>
    </div>
  )
}


/* ============================================================
 * EMPTY ROUTE WARNING
 * ============================================================
 */

function EmptyRouteWarning({
  compact,
}: {
  compact:
    boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl',
        'border',
        'border-amber-300/14',
        'bg-amber-300/[0.045]',
        compact
          ? 'px-4 py-4'
          : 'px-5 py-5',
      ].join(' ')}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-amber-100/50">
        Preview warning
      </p>

      <p
        className={[
          'mt-2',
          'font-medium',
          'text-amber-50/80',
          compact
            ? 'text-sm'
            : 'text-[15px]',
        ].join(' ')}
      >
        Route template is empty
      </p>

      <p
        className={[
          'mt-1.5',
          'leading-relaxed',
          'text-amber-50/42',
          compact
            ? 'text-[11px]'
            : 'text-xs',
        ].join(' ')}
      >
        Add the required Relay legs before this experience is ready
        for consumer publication.
      </p>
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayPreview({
  relay,
  rewardPolicy = null,
  partnerReward = null,
  imageUrl = null,
  variant = 'default',
  showPreviewChrome = true,
  className,
}: RelayPreviewProps) {
  const compact =
    variant ===
    'compact'

  const hasRoute =
    relay.slots.length >
    0

  return (
    <section
      aria-label="Relay consumer preview"
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showPreviewChrome ? (
        <RelayPreviewChrome
          compact={
            compact
          }
        />
      ) : null}

      <div
        className={[
          'border',
          'border-white/[0.08]',
          'bg-[#0b0b0b]',
          showPreviewChrome
            ? 'rounded-b-3xl'
            : 'rounded-3xl',
          compact
            ? 'p-4'
            : 'p-4 sm:p-5',
        ].join(' ')}
      >
        <RelayPreviewHero
          relay={
            relay
          }
          imageUrl={
            imageUrl
          }
          compact={
            compact
          }
        />

        <div
          className={
            compact
              ? 'mt-4'
              : 'mt-5'
          }
        >
          <RelayPreviewMeta
            relay={
              relay
            }
            compact={
              compact
            }
          />
        </div>

        <div
          className={[
            compact
              ? 'mt-5'
              : 'mt-6',
            'border-t',
            'border-white/[0.06]',
            compact
              ? 'pt-5'
              : 'pt-6',
          ].join(' ')}
        >
          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
              The Relay
            </p>

            <h3
              className={[
                'mt-1.5',
                'font-semibold',
                'tracking-[-0.02em]',
                'text-white',
                compact
                  ? 'text-base'
                  : 'text-lg',
              ].join(' ')}
            >
              One team. One route. One leg at a time.
            </h3>

            <p
              className={[
                'mt-2',
                'max-w-2xl',
                'leading-relaxed',
                'text-white/38',
                compact
                  ? 'text-[11px]'
                  : 'text-sm',
              ].join(' ')}
            >
              Each teammate owns one required stop. The baton moves
              forward only after the current leg is canonically
              completed.
            </p>
          </div>

          {hasRoute ? (
            <RelaySlotList
              slots={
                relay.slots
              }
              variant={
                compact
                  ? 'compact'
                  : 'default'
              }
              showPrompts
              showConstraints
            />
          ) : (
            <EmptyRouteWarning
              compact={
                compact
              }
            />
          )}
        </div>

        {rewardPolicy ||
        partnerReward ? (
          <div
            className={[
              compact
                ? 'mt-5'
                : 'mt-6',
              'border-t',
              'border-white/[0.06]',
              compact
                ? 'pt-5'
                : 'pt-6',
            ].join(' ')}
          >
            <RelayRewardSummary
              policy={
                rewardPolicy
              }
              partnerReward={
                partnerReward
              }
              variant={
                compact
                  ? 'compact'
                  : 'default'
              }
            />
          </div>
        ) : null}

        <div
          className={[
            compact
              ? 'mt-5'
              : 'mt-6',
            'border-t',
            'border-white/[0.06]',
            compact
              ? 'pt-5'
              : 'pt-6',
          ].join(' ')}
        >
          <RelayPreviewCta
            compact={
              compact
            }
          />
        </div>

        <footer
          className={[
            'mt-5',
            'border-t',
            'border-white/[0.05]',
            'pt-4',
          ].join(' ')}
        >
          <p
            className={[
              'leading-relaxed',
              'text-white/24',
              compact
                ? 'text-[10px]'
                : 'text-[11px]',
            ].join(' ')}
          >
            Preview only. Publication, discoverability, team
            eligibility, execution, and reward settlement remain
            controlled by canonical lifecycle state, RLS, and trusted
            database RPCs.
          </p>
        </footer>
      </div>
    </section>
  )
}


export default RelayPreview