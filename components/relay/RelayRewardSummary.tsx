// components/relay/RelayRewardSummary.tsx

import type {
  RelayRewardMode,
  RelayRewardPolicyDisplay,
} from '@/lib/relay/types'
import {
  formatRelayRewardPolicy,
} from '@/lib/relay/format'


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayRewardSummaryVariant =
  | 'default'
  | 'compact'
  | 'admin'


export type RelayPartnerRewardCopy = {
  /**
   * Presentation-only Partner label.
   *
   * Example:
   *   "Coffee on us"
   *   "Team dinner credit"
   *
   * This does not determine how a reward is issued.
   */
  title: string

  /**
   * Short supporting copy.
   */
  description?: string | null

  /**
   * Optional small eyebrow label.
   *
   * Defaults to "Partner reward".
   */
  label?: string | null
}


export type RelayRewardSummaryProps = {
  /**
   * Preferred input.
   *
   * Use the already-prepared reward display data when available.
   */
  policy?:
    RelayRewardPolicyDisplay | null

  /**
   * Fallback reward inputs.
   *
   * Useful for previews before the full reward display
   * has been built.
   *
   * If `policy` is provided, it wins.
   */
  mode?:
    RelayRewardMode | null

  xpReward?:
    number | null

  /**
   * Optional Partner reward presentation.
   *
   * Partner rewards remain separate from XP.
   */
  partnerReward?:
    RelayPartnerRewardCopy | null

  variant?:
    RelayRewardSummaryVariant

  /**
   * Show explanatory copy beneath the main reward line.
   */
  showDescription?:
    boolean

  /**
   * Show the reward-sharing label.
   */
  showModeLabel?:
    boolean

  ariaLabel?:
    string

  className?:
    string
}


/* ============================================================
 * INTERNAL HELPERS
 * ============================================================
 */

function normalizeXpReward(
  value:
    number | null | undefined
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0
  }

  return Math.floor(
    value
  )
}


function formatXp(
  value: number
): string {
  return new Intl.NumberFormat(
    'en-US'
  ).format(
    normalizeXpReward(
      value
    )
  )
}


function resolvePolicy(
  policy:
    RelayRewardPolicyDisplay | null | undefined,
  mode:
    RelayRewardMode | null | undefined,
  xpReward:
    number | null | undefined
): RelayRewardPolicyDisplay | null {
  if (policy) {
    return policy
  }

  if (!mode) {
    return null
  }

  return formatRelayRewardPolicy(
    mode,
    normalizeXpReward(
      xpReward
    )
  )
}


function getRewardHeadline(
  policy:
    RelayRewardPolicyDisplay
): string {
  switch (
    policy.mode
  ) {
    case 'per_member':
      return `${formatXp(
        policy.perMemberXp
      )} XP for each teammate`

    case 'team_pool':
      return `${formatXp(
        policy.totalPoolXp
      )} XP shared by the team`
  }
}


function getRewardModeLabel(
  mode:
    RelayRewardMode
): string {
  switch (
    mode
  ) {
    case 'per_member':
      return 'Each teammate'

    case 'team_pool':
      return 'Shared by team'
  }
}


function getRewardModeDescription(
  mode:
    RelayRewardMode
): string {
  switch (
    mode
  ) {
    case 'per_member':
      return 'Every teammate who contributed to the winning Relay receives the XP shown above.'

    case 'team_pool':
      return 'The total XP shown above is shared among the teammates who contributed to the winning Relay.'
  }
}


function getContainerClasses(
  variant:
    RelayRewardSummaryVariant
): string {
  switch (variant) {
    case 'compact':
      return [
        'rounded-2xl',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.03]',
        'px-4',
        'py-4',
      ].join(' ')

    case 'admin':
      return [
        'rounded-2xl',
        'border',
        'border-violet-300/12',
        'bg-violet-300/[0.035]',
        'px-5',
        'py-5',
      ].join(' ')

    case 'default':
      return [
        'rounded-3xl',
        'border',
        'border-white/[0.09]',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.025))]',
        'px-5',
        'py-5',
        'shadow-[0_18px_50px_rgba(0,0,0,0.16)]',
        'sm:px-6',
      ].join(' ')
  }
}


function getHeadlineClasses(
  variant:
    RelayRewardSummaryVariant
): string {
  switch (variant) {
    case 'compact':
      return 'text-base'

    case 'admin':
      return 'text-lg'

    case 'default':
      return 'text-xl sm:text-2xl'
  }
}


/* ============================================================
 * EMPTY STATE
 * ============================================================
 */

function EmptyRelayRewardSummary({
  variant,
}: {
  variant:
    RelayRewardSummaryVariant
}) {
  const compact =
    variant ===
    'compact'

  return (
    <div
      className={[
        getContainerClasses(
          variant
        ),
      ].join(' ')}
    >
      <p
        className={[
          'font-medium',
          'uppercase',
          'tracking-[0.14em]',
          'text-white/35',
          compact
            ? 'text-[10px]'
            : 'text-[11px]',
        ].join(' ')}
      >
        Relay reward
      </p>

      <p
        className={[
          'mt-2',
          'font-semibold',
          'tracking-[-0.01em]',
          'text-white/58',
          compact
            ? 'text-sm'
            : 'text-base',
        ].join(' ')}
      >
        Reward details are not available yet
      </p>
    </div>
  )
}


/* ============================================================
 * PARTNER REWARD
 * ============================================================
 */

function PartnerRewardBlock({
  partnerReward,
  compact,
}: {
  partnerReward:
    RelayPartnerRewardCopy

  compact:
    boolean
}) {
  const label =
    partnerReward.label
      ?.trim() ||
    'Partner reward'

  const title =
    partnerReward.title
      .trim()

  const description =
    partnerReward.description
      ?.trim() ||
    null

  if (!title) {
    return null
  }

  return (
    <div
      className={[
        'rounded-2xl',
        'border',
        'border-amber-300/14',
        'bg-amber-300/[0.055]',
        compact
          ? 'px-3.5 py-3'
          : 'px-4 py-4',
      ].join(' ')}
    >
      <p
        className={[
          'font-medium',
          'uppercase',
          'tracking-[0.13em]',
          'text-amber-100/60',
          compact
            ? 'text-[9px]'
            : 'text-[10px]',
        ].join(' ')}
      >
        {label}
      </p>

      <p
        className={[
          'mt-1.5',
          'font-semibold',
          'tracking-[-0.01em]',
          'text-amber-50',
          compact
            ? 'text-sm'
            : 'text-[15px]',
        ].join(' ')}
      >
        {title}
      </p>

      {description ? (
        <p
          className={[
            'mt-1.5',
            'leading-relaxed',
            'text-amber-50/52',
            compact
              ? 'text-[11px]'
              : 'text-xs',
          ].join(' ')}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayRewardSummary({
  policy,
  mode = null,
  xpReward = null,
  partnerReward = null,
  variant = 'default',
  showDescription = true,
  showModeLabel = true,
  ariaLabel =
    'Relay reward',
  className,
}: RelayRewardSummaryProps) {
  const resolvedPolicy =
    resolvePolicy(
      policy,
      mode,
      xpReward
    )

  if (!resolvedPolicy) {
    return (
      <section
        aria-label={
          ariaLabel
        }
        className={
          className
        }
      >
        <EmptyRelayRewardSummary
          variant={
            variant
          }
        />
      </section>
    )
  }

  const compact =
    variant ===
    'compact'

  const modeLabel =
    getRewardModeLabel(
      resolvedPolicy.mode
    )

  const modeDescription =
    getRewardModeDescription(
      resolvedPolicy.mode
    )

  const headline =
    getRewardHeadline(
      resolvedPolicy
    )

  return (
    <section
      aria-label={
        ariaLabel
      }
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={
          getContainerClasses(
            variant
          )
        }
      >
        {/* XP reward */}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className={[
                'font-medium',
                'uppercase',
                'tracking-[0.14em]',
                'text-white/38',
                compact
                  ? 'text-[10px]'
                  : 'text-[11px]',
              ].join(' ')}
            >
              Winning Relay XP
            </p>

            {showModeLabel ? (
              <span
                className={[
                  'inline-flex',
                  'items-center',
                  'rounded-full',
                  'border',
                  resolvedPolicy.mode ===
                    'per_member'
                    ? [
                        'border-emerald-300/13',
                        'bg-emerald-300/[0.05]',
                        'text-emerald-100/72',
                      ].join(' ')
                    : [
                        'border-violet-300/13',
                        'bg-violet-300/[0.05]',
                        'text-violet-100/72',
                      ].join(' '),
                  'font-medium',
                  'uppercase',
                  'tracking-[0.11em]',
                  compact
                    ? 'px-2 py-1 text-[9px]'
                    : 'px-2.5 py-1.5 text-[10px]',
                ].join(' ')}
              >
                {modeLabel}
              </span>
            ) : null}
          </div>

          <p
            className={[
              'mt-2',
              'font-semibold',
              'tracking-[-0.025em]',
              'text-white',
              getHeadlineClasses(
                variant
              ),
            ].join(' ')}
          >
            {headline}
          </p>

          {showDescription ? (
            <p
              className={[
                'mt-3',
                'max-w-2xl',
                'leading-relaxed',
                'text-white/38',
                compact
                  ? 'text-[11px]'
                  : 'text-xs',
              ].join(' ')}
            >
              {modeDescription}
            </p>
          ) : null}
        </div>

        {/* Partner reward stays separate from XP */}
        {partnerReward ? (
          <div
            className={
              compact
                ? 'mt-3'
                : 'mt-4'
            }
          >
            <PartnerRewardBlock
              partnerReward={
                partnerReward
              }
              compact={
                compact
              }
            />
          </div>
        ) : null}

        {variant ===
        'admin' ? (
          <div
            className="mt-4 rounded-xl border border-white/[0.06] bg-black/10 px-3.5 py-3"
          >
            <p className="text-[11px] leading-relaxed text-white/35">
              This XP is the prize for winning the competition.
              Any Partner reward shown above is separate.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}


export default RelayRewardSummary