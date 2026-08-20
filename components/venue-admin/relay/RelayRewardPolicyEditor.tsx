'use client'

// components/venue-admin/relay/RelayRewardPolicyEditor.tsx

import {
  useMemo,
} from 'react'

import RelayRewardSummary, {
  type RelayPartnerRewardCopy,
} from '@/components/relay/RelayRewardSummary'

import {
  formatRelayRewardModeDescription,
  formatRelayRewardModeLabel,
  formatRelayRewardPolicy,
} from '@/lib/relay/format'

import type {
  RelayRewardMode,
  RelayRewardPolicyDisplay,
} from '@/lib/relay/types'


/* ============================================================
 * AUTHORING VALUE
 * ============================================================
 */

export type RelayRewardPolicyEditorValue = {
  rewardMode:
    RelayRewardMode

  xpReward:
    number
}


/* ============================================================
 * VALIDATION
 * ============================================================
 */

export type RelayRewardPolicyEditorErrorField =
  | 'rewardMode'
  | 'xpReward'


export type RelayRewardPolicyEditorErrors =
  Partial<
    Record<
      RelayRewardPolicyEditorErrorField,
      string
    >
  >


export function validateRelayRewardPolicyEditorValue(
  value:
    RelayRewardPolicyEditorValue
): RelayRewardPolicyEditorErrors {
  const errors:
    RelayRewardPolicyEditorErrors =
    {}

  if (
    value.rewardMode !==
      'per_member' &&
    value.rewardMode !==
      'team_pool'
  ) {
    errors.rewardMode =
      'Choose a valid Relay reward mode.'
  }

  if (
    !Number.isInteger(
      value.xpReward
    )
  ) {
    errors.xpReward =
      'XP reward must be a whole number.'
  } else if (
    value.xpReward <
    0
  ) {
    errors.xpReward =
      'XP reward cannot be negative.'
  } else if (
    value.xpReward >
    100000
  ) {
    errors.xpReward =
      'XP reward is too large.'
  }

  return errors
}


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayRewardPolicyEditorVariant =
  | 'default'
  | 'compact'


export type RelayRewardPolicyEditorProps = {
  value:
    RelayRewardPolicyEditorValue

  onChange:
    (
      value:
        RelayRewardPolicyEditorValue
    ) => void

  /**
   * Optional externally-owned validation errors.
   *
   * Useful when the parent authoring form validates the whole
   * Relay document before submit.
   */
  errors?:
    RelayRewardPolicyEditorErrors

  disabled?:
    boolean

  /**
   * Future-facing presentation only.
   *
   * Partner rewards remain outside XP settlement.
   */
  partnerReward?:
    RelayPartnerRewardCopy | null

  /**
   * Show the reward preview panel.
   */
  showPreview?:
    boolean

  variant?:
    RelayRewardPolicyEditorVariant

  className?:
    string
}


/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const MIN_XP_REWARD =
  0

const MAX_XP_REWARD =
  100000


const inputClassName = [
  'mt-2',
  'block',
  'w-full',
  'rounded-2xl',
  'border',
  'border-white/[0.09]',
  'bg-black/20',
  'px-4',
  'py-3',
  'text-sm',
  'text-white',
  'outline-none',
  'transition',
  'placeholder:text-white/22',
  'hover:border-white/[0.13]',
  'focus:border-amber-300/28',
  'focus:ring-2',
  'focus:ring-amber-300/10',
  'disabled:cursor-not-allowed',
  'disabled:opacity-50',
].join(' ')


/* ============================================================
 * INTERNAL HELPERS
 * ============================================================
 */

function normalizeXpReward(
  value: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(
    MIN_XP_REWARD,
    Math.min(
      MAX_XP_REWARD,
      Math.floor(
        value
      )
    )
  )
}


function buildDisplayPolicy(
  value:
    RelayRewardPolicyEditorValue
): RelayRewardPolicyDisplay {
  return formatRelayRewardPolicy(
    value.rewardMode,
    normalizeXpReward(
      value.xpReward
    )
  )
}


/* ============================================================
 * SHARED FIELD UI
 * ============================================================
 */

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children:
    React.ReactNode
}) {
  return (
    <label
      htmlFor={
        htmlFor
      }
      className="block text-[11px] font-medium uppercase tracking-[0.13em] text-white/42"
    >
      {children}
    </label>
  )
}


function FieldError({
  id,
  error,
}: {
  id: string

  error:
    string | undefined
}) {
  if (!error) {
    return null
  }

  return (
    <p
      id={
        id
      }
      role="alert"
      className="mt-1.5 text-xs leading-relaxed text-rose-200/80"
    >
      {error}
    </p>
  )
}


function FieldHint({
  children,
}: {
  children:
    React.ReactNode
}) {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-white/30">
      {children}
    </p>
  )
}


/* ============================================================
 * REWARD MODE OPTION
 * ============================================================
 */

function RewardModeOption({
  mode,
  selectedMode,
  disabled,
  onSelect,
}: {
  mode:
    RelayRewardMode

  selectedMode:
    RelayRewardMode

  disabled:
    boolean

  onSelect:
    (
      mode:
        RelayRewardMode
    ) => void
}) {
  const selected =
    selectedMode ===
    mode

  return (
    <button
      type="button"
      disabled={
        disabled
      }
      aria-pressed={
        selected
      }
      onClick={() =>
        onSelect(
          mode
        )
      }
      className={[
        'w-full',
        'rounded-2xl',
        'border',
        'p-4',
        'text-left',
        'transition',
        selected
          ? [
              'border-amber-300/22',
              'bg-amber-300/[0.07]',
              'shadow-[0_12px_36px_rgba(251,191,36,0.035)]',
            ].join(' ')
          : [
              'border-white/[0.08]',
              'bg-black/10',
              'hover:border-white/[0.13]',
              'hover:bg-white/[0.025]',
            ].join(' '),
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-amber-300/25',
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
      ].join(' ')}
      data-relay-reward-mode={
        mode
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={[
            'mt-0.5',
            'h-4',
            'w-4',
            'shrink-0',
            'rounded-full',
            'border',
            selected
              ? [
                  'border-amber-300/70',
                  'bg-amber-300',
                  'shadow-[inset_0_0_0_3px_rgba(17,17,17,0.9)]',
                ].join(' ')
              : 'border-white/20',
          ].join(' ')}
        />

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">
            {
              formatRelayRewardModeLabel(
                mode
              )
            }
          </span>

          <span className="mt-1 block text-xs leading-relaxed text-white/36">
            {
              formatRelayRewardModeDescription(
                mode
              )
            }
          </span>
        </span>
      </div>
    </button>
  )
}


/* ============================================================
 * MODE-SPECIFIC EXPLANATION
 * ============================================================
 */

function RewardModeExplanation({
  mode,
  xpReward,
}: {
  mode:
    RelayRewardMode

  xpReward:
    number
}) {
  const normalizedXpReward =
    normalizeXpReward(
      xpReward
    )

  if (
    mode ===
    'team_pool'
  ) {
    return (
      <div
        className={[
          'rounded-2xl',
          'border',
          'border-violet-300/12',
          'bg-violet-300/[0.04]',
          'px-4',
          'py-4',
        ].join(' ')}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-violet-100/48">
          Team pool semantics
        </p>

        <p className="mt-2 text-sm font-medium text-violet-50/76">
          {
            normalizedXpReward
          }{' '}
          XP total
        </p>

        <p className="mt-1.5 text-xs leading-relaxed text-violet-50/40">
          Settlement divides the configured pool across canonical
          contributors on the winning Relay. Integer remainder XP
          is assigned deterministically by canonical artifact slot
          order.
        </p>
      </div>
    )
  }

  return (
    <div
      className={[
        'rounded-2xl',
        'border',
        'border-emerald-300/12',
        'bg-emerald-300/[0.04]',
        'px-4',
        'py-4',
      ].join(' ')}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-emerald-100/48">
        Per teammate semantics
      </p>

      <p className="mt-2 text-sm font-medium text-emerald-50/76">
        {
          normalizedXpReward
        }{' '}
        XP per canonical contributor
      </p>

      <p className="mt-1.5 text-xs leading-relaxed text-emerald-50/40">
        Every canonical contributor on the winning Relay receives
        the full configured XP amount.
      </p>
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayRewardPolicyEditor({
  value,
  onChange,
  errors = {},
  disabled = false,
  partnerReward = null,
  showPreview = true,
  variant = 'default',
  className,
}: RelayRewardPolicyEditorProps) {
  const compact =
    variant ===
    'compact'

  const displayPolicy =
    useMemo(
      () =>
        buildDisplayPolicy(
          value
        ),
      [
        value,
      ]
    )


  function patchValue(
    patch:
      Partial<RelayRewardPolicyEditorValue>
  ) {
    onChange({
      ...value,
      ...patch,
    })
  }


  return (
    <section
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Relay reward policy editor"
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
          Competition reward
        </p>

        <h3
          className={[
            'mt-1.5',
            'font-semibold',
            'tracking-[-0.025em]',
            'text-white',
            compact
              ? 'text-base'
              : 'text-lg',
          ].join(' ')}
        >
          Winning team XP
        </h3>

        <p
          className={[
            'mt-2',
            'max-w-2xl',
            'leading-relaxed',
            'text-white/38',
            compact
              ? 'text-xs'
              : 'text-sm',
          ].join(' ')}
        >
          Configure only competition winner XP. Normal explorer XP,
          Relay contributor attribution XP, and Partner payouts
          remain separate systems.
        </p>
      </div>


      {/* ======================================================
       * REWARD MODE
       * ====================================================== */}

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/42">
          Reward mode
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RewardModeOption
            mode="per_member"
            selectedMode={
              value.rewardMode
            }
            disabled={
              disabled
            }
            onSelect={(
              rewardMode
            ) =>
              patchValue({
                rewardMode,
              })
            }
          />

          <RewardModeOption
            mode="team_pool"
            selectedMode={
              value.rewardMode
            }
            disabled={
              disabled
            }
            onSelect={(
              rewardMode
            ) =>
              patchValue({
                rewardMode,
              })
            }
          />
        </div>

        <FieldError
          id="relay-reward-mode-error"
          error={
            errors.rewardMode
          }
        />
      </div>


      {/* ======================================================
       * XP AMOUNT
       * ====================================================== */}

      <div
        className={[
          'mt-5',
          'grid',
          'gap-4',
          compact
            ? ''
            : 'lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div>
          <FieldLabel htmlFor="relay-reward-xp">
            XP reward
          </FieldLabel>

          <input
            id="relay-reward-xp"
            type="number"
            inputMode="numeric"
            min={
              MIN_XP_REWARD
            }
            max={
              MAX_XP_REWARD
            }
            step={1}
            disabled={
              disabled
            }
            value={
              value.xpReward
            }
            onChange={(
              event
            ) => {
              const rawValue =
                event.target
                  .value

              if (
                rawValue ===
                ''
              ) {
                patchValue({
                  xpReward:
                    0,
                })

                return
              }

              const parsed =
                Number(
                  rawValue
                )

              patchValue({
                xpReward:
                  Number.isFinite(
                    parsed
                  )
                    ? Math.floor(
                        parsed
                      )
                    : 0,
              })
            }}
            aria-invalid={
              Boolean(
                errors.xpReward
              )
            }
            aria-describedby={
              errors.xpReward
                ? 'relay-reward-xp-error'
                : 'relay-reward-xp-hint'
            }
            className={
              inputClassName
            }
          />

          <FieldError
            id="relay-reward-xp-error"
            error={
              errors.xpReward
            }
          />

          {!errors.xpReward ? (
            <div id="relay-reward-xp-hint">
              <FieldHint>
                Stored as the competition&apos;s canonical
                <code className="mx-1 rounded bg-white/[0.05] px-1 py-0.5 text-[10px] text-white/50">
                  xp_reward
                </code>
                value.
              </FieldHint>
            </div>
          ) : null}
        </div>

        <RewardModeExplanation
          mode={
            value.rewardMode
          }
          xpReward={
            value.xpReward
          }
        />
      </div>


      {/* ======================================================
       * SETTLEMENT BOUNDARY
       * ====================================================== */}

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/28">
          Settlement authority
        </p>

        <p className="mt-2 text-xs leading-relaxed text-white/36">
          This editor only configures reward policy. The database
          settlement layer decides the winning Relay entry, derives
          canonical contributors from the immutable winning artifact,
          and issues exactly-once XP awards.
        </p>
      </div>


      {/* ======================================================
       * PARTNER EXTENSION POINT
       * ====================================================== */}

      {partnerReward ? (
        <div className="mt-5">
          <div className="mb-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-100/42">
              Partner
            </p>

            <p className="mt-1.5 text-xs leading-relaxed text-white/34">
              Partner reward presentation is shown separately from
              competition XP.
            </p>
          </div>

          <RelayRewardSummary
            policy={
              displayPolicy
            }
            partnerReward={
              partnerReward
            }
            variant={
              compact
                ? 'compact'
                : 'admin'
            }
          />
        </div>
      ) : null}


      {/* ======================================================
       * STANDARD PREVIEW
       * ====================================================== */}

      {showPreview &&
      !partnerReward ? (
        <div className="mt-5">
          <RelayRewardSummary
            policy={
              displayPolicy
            }
            variant={
              compact
                ? 'compact'
                : 'admin'
            }
          />
        </div>
      ) : null}
    </section>
  )
}


export default RelayRewardPolicyEditor