'use client'

// components/venue-admin/relay/RelayAuthoringForm.tsx

import {
  useMemo,
  useState,
  useTransition,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

import RelayRewardSummary from '@/components/relay/RelayRewardSummary'
import RelaySlotList from '@/components/relay/RelaySlotList'
import {
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'
import type {
  RelayDefinition,
  RelayRewardMode,
  RelayRewardPolicyDisplay,
} from '@/lib/relay/types'


/* ============================================================
 * PUBLIC TYPES
 * ============================================================
 */

export type RelayAuthoringMode =
  | 'create'
  | 'edit'


export type RelayAuthoringVisibility =
  'public'


export type RelayAuthoringInput = {
  title: string
  description: string | null

  city: string | null
  theme: string | null

  startsAt: string | null
  endsAt: string | null

  minTeamSize: number
  maxTeamSize: number

  visibility:
    RelayAuthoringVisibility

  rewardMode:
    RelayRewardMode

  xpReward: number
}


export type RelayAuthoringSubmitResult = {
  relayId: string
}


/**
 * Mutation adapter supplied by the trusted Venue Admin action
 * layer.
 *
 * RelayAuthoringForm deliberately does not import Supabase or
 * mutate Relay tables directly.
 */
export type RelayAuthoringSubmitter = (
  input: RelayAuthoringInput
) => Promise<RelayAuthoringSubmitResult>


export type RelayAuthoringFormProps = {
  mode:
    RelayAuthoringMode

  initialRelay?:
    RelayDefinition | null

  initialRewardPolicy?:
    RelayRewardPolicyDisplay | null

  /**
   * Trusted create mutation.
   *
   * Required when mode = create.
   */
  onCreate?:
    RelayAuthoringSubmitter

  /**
   * Trusted edit mutation.
   *
   * Required when mode = edit.
   */
  onUpdate?:
    RelayAuthoringSubmitter

  /**
   * Optional redirect override.
   *
   * Defaults:
   *
   * create:
   *   /venue-admin/relay/:relayId
   *
   * edit:
   *   stays on current Relay detail page
   */
  redirectAfterSave?:
    string | null

  className?:
    string
}


/* ============================================================
 * INTERNAL FORM STATE
 * ============================================================
 */

type RelayAuthoringFormState = {
  title: string
  description: string

  city: string
  theme: string

  startsAt: string
  endsAt: string

  minTeamSize: string
  maxTeamSize: string

  rewardMode:
    RelayRewardMode

  xpReward: string

  visibility:
    RelayAuthoringVisibility
}


type RelayAuthoringField =
  | 'title'
  | 'description'
  | 'city'
  | 'theme'
  | 'startsAt'
  | 'endsAt'
  | 'minTeamSize'
  | 'maxTeamSize'
  | 'rewardMode'
  | 'xpReward'
  | 'visibility'


type RelayAuthoringErrors =
  Partial<
    Record<
      RelayAuthoringField,
      string
    >
  >


/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const MIN_TEAM_SIZE =
  3

const MAX_TEAM_SIZE =
  5

const DEFAULT_TEAM_SIZE =
  4

const DEFAULT_XP_REWARD =
  100

const DEFAULT_REWARD_MODE:
  RelayRewardMode =
  'per_member'

const DEFAULT_VISIBILITY:
  RelayAuthoringVisibility =
  'public'


/* ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeText(
  value: string
): string {
  return value.trim()
}


function normalizeNullableText(
  value: string
): string | null {
  const normalized =
    value.trim()

  return normalized ||
    null
}


function parseInteger(
  value: string
): number | null {
  const trimmed =
    value.trim()

  if (!trimmed) {
    return null
  }

  const parsed =
    Number(trimmed)

  if (
    !Number.isInteger(parsed)
  ) {
    return null
  }

  return parsed
}


function toDateTimeLocalValue(
  isoValue:
    string | null | undefined
): string {
  if (!isoValue) {
    return ''
  }

  const date =
    new Date(isoValue)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      '0'
    )

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )

  const hours =
    String(
      date.getHours()
    ).padStart(
      2,
      '0'
    )

  const minutes =
    String(
      date.getMinutes()
    ).padStart(
      2,
      '0'
    )

  return `${year}-${month}-${day}T${hours}:${minutes}`
}


function dateTimeLocalToIso(
  value: string
): string | null {
  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  const date =
    new Date(
      normalized
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date.toISOString()
}


function getInitialState(
  relay:
    RelayDefinition | null | undefined,
  rewardPolicy:
    RelayRewardPolicyDisplay | null | undefined
): RelayAuthoringFormState {
  return {
    title:
      relay?.title ??
      '',

    description:
      relay?.description ??
      '',

    city:
      relay?.city ??
      '',

    theme:
      relay?.theme ??
      '',

    startsAt:
      toDateTimeLocalValue(
        relay?.startsAt
      ),

    endsAt:
      toDateTimeLocalValue(
        relay?.endsAt
      ),

    minTeamSize:
      String(
        relay?.minTeamSize ??
          DEFAULT_TEAM_SIZE
      ),

    maxTeamSize:
      String(
        relay?.maxTeamSize ??
          DEFAULT_TEAM_SIZE
      ),

    rewardMode:
      rewardPolicy
        ?.mode ??
      DEFAULT_REWARD_MODE,

    xpReward:
      String(
        rewardPolicy
          ?.xpReward ??
          DEFAULT_XP_REWARD
      ),

    visibility:
      DEFAULT_VISIBILITY,
  }
}


/* ============================================================
 * VALIDATION
 * ============================================================
 */

function validateRelayAuthoringState(
  state:
    RelayAuthoringFormState
): RelayAuthoringErrors {
  const errors:
    RelayAuthoringErrors =
    {}

  const title =
    normalizeText(
      state.title
    )

  if (!title) {
    errors.title =
      'Relay title is required.'
  } else if (
    title.length >
    120
  ) {
    errors.title =
      'Relay title must be 120 characters or fewer.'
  }


  if (
    state.description
      .trim()
      .length >
    1000
  ) {
    errors.description =
      'Description must be 1,000 characters or fewer.'
  }


  if (
    state.city
      .trim()
      .length >
    120
  ) {
    errors.city =
      'City must be 120 characters or fewer.'
  }


  if (
    state.theme
      .trim()
      .length >
    120
  ) {
    errors.theme =
      'Theme must be 120 characters or fewer.'
  }


  const minTeamSize =
    parseInteger(
      state.minTeamSize
    )

  const maxTeamSize =
    parseInteger(
      state.maxTeamSize
    )

  if (
    minTeamSize ===
    null
  ) {
    errors.minTeamSize =
      'Minimum team size is required.'
  } else if (
    minTeamSize <
      MIN_TEAM_SIZE ||
    minTeamSize >
      MAX_TEAM_SIZE
  ) {
    errors.minTeamSize =
      `Minimum team size must be between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}.`
  }


  if (
    maxTeamSize ===
    null
  ) {
    errors.maxTeamSize =
      'Maximum team size is required.'
  } else if (
    maxTeamSize <
      MIN_TEAM_SIZE ||
    maxTeamSize >
      MAX_TEAM_SIZE
  ) {
    errors.maxTeamSize =
      `Maximum team size must be between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}.`
  }


  if (
    minTeamSize !==
      null &&
    maxTeamSize !==
      null &&
    minTeamSize >
      maxTeamSize
  ) {
    errors.maxTeamSize =
      'Maximum team size cannot be smaller than minimum team size.'
  }


  const startsAt =
    state.startsAt
      ? new Date(
          state.startsAt
        )
      : null

  const endsAt =
    state.endsAt
      ? new Date(
          state.endsAt
        )
      : null

  if (
    startsAt &&
    Number.isNaN(
      startsAt.getTime()
    )
  ) {
    errors.startsAt =
      'Start time is invalid.'
  }


  if (
    endsAt &&
    Number.isNaN(
      endsAt.getTime()
    )
  ) {
    errors.endsAt =
      'End time is invalid.'
  }


  if (
    startsAt &&
    endsAt &&
    !Number.isNaN(
      startsAt.getTime()
    ) &&
    !Number.isNaN(
      endsAt.getTime()
    ) &&
    endsAt.getTime() <=
      startsAt.getTime()
  ) {
    errors.endsAt =
      'End time must be after start time.'
  }


  const xpReward =
    parseInteger(
      state.xpReward
    )

  if (
    xpReward ===
    null
  ) {
    errors.xpReward =
      'XP reward is required.'
  } else if (
    xpReward <
    0
  ) {
    errors.xpReward =
      'XP reward cannot be negative.'
  } else if (
    xpReward >
    100000
  ) {
    errors.xpReward =
      'XP reward is too large.'
  }


  return errors
}


/* ============================================================
 * PAYLOAD
 * ============================================================
 */

function buildRelayAuthoringInput(
  state:
    RelayAuthoringFormState
): RelayAuthoringInput {
  const minTeamSize =
    parseInteger(
      state.minTeamSize
    )

  const maxTeamSize =
    parseInteger(
      state.maxTeamSize
    )

  const xpReward =
    parseInteger(
      state.xpReward
    )

  if (
    minTeamSize ===
      null ||
    maxTeamSize ===
      null ||
    xpReward ===
      null
  ) {
    throw new Error(
      'Relay authoring values are invalid.'
    )
  }

  return {
    title:
      normalizeText(
        state.title
      ),

    description:
      normalizeNullableText(
        state.description
      ),

    city:
      normalizeNullableText(
        state.city
      ),

    theme:
      normalizeNullableText(
        state.theme
      ),

    startsAt:
      dateTimeLocalToIso(
        state.startsAt
      ),

    endsAt:
      dateTimeLocalToIso(
        state.endsAt
      ),

    minTeamSize,

    maxTeamSize,

    visibility:
      state.visibility,

    rewardMode:
      state.rewardMode,

    xpReward,
  }
}


/* ============================================================
 * GENERIC FIELD COMPONENTS
 * ============================================================
 */

function FieldLabel({
  htmlFor,
  children,
  optional = false,
}: {
  htmlFor: string
  children:
    React.ReactNode
  optional?: boolean
}) {
  return (
    <label
      htmlFor={
        htmlFor
      }
      className="block text-[11px] font-medium uppercase tracking-[0.13em] text-white/42"
    >
      {children}

      {optional ? (
        <span className="ml-1 normal-case tracking-normal text-white/25">
          optional
        </span>
      ) : null}
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
 * SECTION SHELL
 * ============================================================
 */

function AuthoringSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description:
    string
  children:
    React.ReactNode
}) {
  return (
    <section
      className={[
        'rounded-3xl',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.025]',
        'p-5',
        'sm:p-6',
      ].join(' ')}
    >
      <div className="max-w-2xl">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
          {eyebrow}
        </p>

        <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-white">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-white/38">
          {description}
        </p>
      </div>

      <div className="mt-5">
        {children}
      </div>
    </section>
  )
}


/* ============================================================
 * REWARD MODE CONTROL
 * ============================================================
 */

function RewardModeOption({
  mode,
  selectedMode,
  disabled,
  onChange,
  title,
  description,
}: {
  mode:
    RelayRewardMode

  selectedMode:
    RelayRewardMode

  disabled:
    boolean

  onChange:
    (
      mode:
        RelayRewardMode
    ) => void

  title: string
  description: string
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
        onChange(
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
            {title}
          </span>

          <span className="mt-1 block text-xs leading-relaxed text-white/38">
            {description}
          </span>
        </span>
      </div>
    </button>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayAuthoringForm({
  mode,
  initialRelay = null,
  initialRewardPolicy = null,
  onCreate,
  onUpdate,
  redirectAfterSave = null,
  className,
}: RelayAuthoringFormProps) {
  const router =
    useRouter()

  const [
    isPending,
    startTransition,
  ] =
    useTransition()

  const [
    state,
    setState,
  ] =
    useState<
      RelayAuthoringFormState
    >(() =>
      getInitialState(
        initialRelay,
        initialRewardPolicy
      )
    )

  const [
    errors,
    setErrors,
  ] =
    useState<
      RelayAuthoringErrors
    >({})

  const [
    submitError,
    setSubmitError,
  ] =
    useState<
      string | null
    >(null)

  const [
    savedMessage,
    setSavedMessage,
  ] =
    useState<
      string | null
    >(null)


  const resolvedRewardPolicy =
    useMemo(
      (): RelayRewardPolicyDisplay => {
        const xpReward =
          parseInteger(
            state.xpReward
          ) ??
          0

        if (
          state.rewardMode ===
          'team_pool'
        ) {
          return {
            mode:
              'team_pool',

            xpReward:
              Math.max(
                0,
                xpReward
              ),

            title:
              'Team XP pool',

            description:
              `${Math.max(
                0,
                xpReward
              )} XP is shared across the canonical contributors on the winning Relay.`,

            perMemberXp:
              null,

            totalPoolXp:
              Math.max(
                0,
                xpReward
              ),
          }
        }

        return {
          mode:
            'per_member',

          xpReward:
            Math.max(
              0,
              xpReward
            ),

          title:
            'XP per winning teammate',

          description:
            `Each canonical contributor on the winning Relay earns ${Math.max(
              0,
              xpReward
            )} XP.`,

          perMemberXp:
            Math.max(
              0,
              xpReward
            ),

          totalPoolXp:
            null,
        }
      },
      [
        state.rewardMode,
        state.xpReward,
      ]
    )


  const teamSizePreview =
    useMemo(
      () =>
        formatRelayTeamSize(
          parseInteger(
            state.minTeamSize
          ) ??
            0,

          parseInteger(
            state.maxTeamSize
          ) ??
            0
        ),
      [
        state.minTeamSize,
        state.maxTeamSize,
      ]
    )


  const windowPreview =
    useMemo(
      () =>
        formatRelayTimeWindow(
          dateTimeLocalToIso(
            state.startsAt
          ),
          dateTimeLocalToIso(
            state.endsAt
          )
        ),
      [
        state.startsAt,
        state.endsAt,
      ]
    )


  function updateField<
    T extends keyof RelayAuthoringFormState,
  >(
    field: T,
    value:
      RelayAuthoringFormState[T]
  ) {
    setState(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    )

    setErrors(
      (current) => {
        if (
          !current[
            field as RelayAuthoringField
          ]
        ) {
          return current
        }

        const next = {
          ...current,
        }

        delete next[
          field as RelayAuthoringField
        ]

        return next
      }
    )

    setSubmitError(
      null
    )

    setSavedMessage(
      null
    )
  }


  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (isPending) {
      return
    }

    setSubmitError(
      null
    )

    setSavedMessage(
      null
    )

    const nextErrors =
      validateRelayAuthoringState(
        state
      )

    setErrors(
      nextErrors
    )

    if (
      Object.keys(
        nextErrors
      ).length >
      0
    ) {
      return
    }

    const submitter =
      mode ===
      'create'
        ? onCreate
        : onUpdate

    if (!submitter) {
      setSubmitError(
        mode ===
        'create'
          ? 'Relay creation action is not configured.'
          : 'Relay update action is not configured.'
      )

      return
    }

    const input =
      buildRelayAuthoringInput(
        state
      )

    startTransition(
      async () => {
        try {
          const result =
            await submitter(
              input
            )

          if (
            !result?.relayId
          ) {
            throw new Error(
              'Relay save completed without a Relay ID.'
            )
          }

          if (
            mode ===
            'create'
          ) {
            router.push(
              redirectAfterSave ??
                `/venue-admin/relay/${result.relayId}`
            )

            router.refresh()

            return
          }

          setSavedMessage(
            'Relay saved.'
          )

          if (
            redirectAfterSave
          ) {
            router.push(
              redirectAfterSave
            )
          }

          router.refresh()
        } catch (
          error
        ) {
          setSubmitError(
            error instanceof
              Error
              ? error.message
              : 'Unable to save Relay.'
          )
        }
      }
    )
  }


  return (
    <form
      onSubmit={
        handleSubmit
      }
      noValidate
      className={[
        'space-y-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ======================================================
       * BASICS
       * ====================================================== */}

      <AuthoringSection
        eyebrow="01 · Basics"
        title="Relay identity"
        description="Define the public-facing Relay concept. Keep it specific enough that a team immediately understands the type of city experience they are building."
      >
        <div className="grid gap-5">
          <div>
            <FieldLabel htmlFor="relay-title">
              Title
            </FieldLabel>

            <input
              id="relay-title"
              name="title"
              type="text"
              autoComplete="off"
              maxLength={
                120
              }
              disabled={
                isPending
              }
              value={
                state.title
              }
              onChange={(
                event
              ) =>
                updateField(
                  'title',
                  event.target
                    .value
                )
              }
              aria-invalid={
                Boolean(
                  errors.title
                )
              }
              aria-describedby={
                errors.title
                  ? 'relay-title-error'
                  : undefined
              }
              placeholder="Saturday Night Relay"
              className={
                inputClassName
              }
            />

            <FieldError
              id="relay-title-error"
              error={
                errors.title
              }
            />
          </div>


          <div>
            <FieldLabel
              htmlFor="relay-description"
              optional
            >
              Description
            </FieldLabel>

            <textarea
              id="relay-description"
              name="description"
              rows={4}
              maxLength={
                1000
              }
              disabled={
                isPending
              }
              value={
                state.description
              }
              onChange={(
                event
              ) =>
                updateField(
                  'description',
                  event.target
                    .value
                )
              }
              aria-invalid={
                Boolean(
                  errors.description
                )
              }
              aria-describedby={
                errors.description
                  ? 'relay-description-error'
                  : undefined
              }
              placeholder="Build the perfect Saturday across the city, one teammate at a time."
              className={[
                inputClassName,
                'resize-y',
              ].join(' ')}
            />

            <div className="mt-1.5 flex items-center justify-between gap-3">
              <FieldError
                id="relay-description-error"
                error={
                  errors.description
                }
              />

              <p className="ml-auto text-[10px] tabular-nums text-white/22">
                {
                  state.description
                    .length
                }
                /1000
              </p>
            </div>
          </div>


          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <FieldLabel
                htmlFor="relay-city"
                optional
              >
                City
              </FieldLabel>

              <input
                id="relay-city"
                name="city"
                type="text"
                autoComplete="address-level2"
                maxLength={
                  120
                }
                disabled={
                  isPending
                }
                value={
                  state.city
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    'city',
                    event.target
                      .value
                  )
                }
                aria-invalid={
                  Boolean(
                    errors.city
                  )
                }
                aria-describedby={
                  errors.city
                    ? 'relay-city-error'
                    : undefined
                }
                placeholder="New York"
                className={
                  inputClassName
                }
              />

              <FieldError
                id="relay-city-error"
                error={
                  errors.city
                }
              />
            </div>


            <div>
              <FieldLabel
                htmlFor="relay-theme"
                optional
              >
                Theme
              </FieldLabel>

              <input
                id="relay-theme"
                name="theme"
                type="text"
                autoComplete="off"
                maxLength={
                  120
                }
                disabled={
                  isPending
                }
                value={
                  state.theme
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    'theme',
                    event.target
                      .value
                  )
                }
                aria-invalid={
                  Boolean(
                    errors.theme
                  )
                }
                aria-describedby={
                  errors.theme
                    ? 'relay-theme-error'
                    : undefined
                }
                placeholder="Perfect Saturday"
                className={
                  inputClassName
                }
              />

              <FieldError
                id="relay-theme-error"
                error={
                  errors.theme
                }
              />
            </div>
          </div>
        </div>
      </AuthoringSection>


      {/* ======================================================
       * WINDOW
       * ====================================================== */}

      <AuthoringSection
        eyebrow="02 · Timing"
        title="Execution window"
        description="Set when teams can execute this Relay. Database and RPC checks remain authoritative for whether a team may actually begin."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel
              htmlFor="relay-starts-at"
              optional
            >
              Starts
            </FieldLabel>

            <input
              id="relay-starts-at"
              name="startsAt"
              type="datetime-local"
              disabled={
                isPending
              }
              value={
                state.startsAt
              }
              onChange={(
                event
              ) =>
                updateField(
                  'startsAt',
                  event.target
                    .value
                )
              }
              aria-invalid={
                Boolean(
                  errors.startsAt
                )
              }
              aria-describedby={
                errors.startsAt
                  ? 'relay-starts-at-error'
                  : undefined
              }
              className={
                inputClassName
              }
            />

            <FieldError
              id="relay-starts-at-error"
              error={
                errors.startsAt
              }
            />
          </div>


          <div>
            <FieldLabel
              htmlFor="relay-ends-at"
              optional
            >
              Ends
            </FieldLabel>

            <input
              id="relay-ends-at"
              name="endsAt"
              type="datetime-local"
              disabled={
                isPending
              }
              value={
                state.endsAt
              }
              onChange={(
                event
              ) =>
                updateField(
                  'endsAt',
                  event.target
                    .value
                )
              }
              aria-invalid={
                Boolean(
                  errors.endsAt
                )
              }
              aria-describedby={
                errors.endsAt
                  ? 'relay-ends-at-error'
                  : undefined
              }
              className={
                inputClassName
              }
            />

            <FieldError
              id="relay-ends-at-error"
              error={
                errors.endsAt
              }
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
            Preview
          </p>

          <p className="mt-1.5 text-sm text-white/58">
            {windowPreview}
          </p>
        </div>
      </AuthoringSection>


      {/* ======================================================
       * TEAM SHAPE
       * ====================================================== */}

      <AuthoringSection
        eyebrow="03 · Team"
        title="Team shape"
        description="Relay v1 supports teams of three to five people. Each joined contributor will ultimately own exactly one required leg."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="relay-min-team-size">
              Minimum team size
            </FieldLabel>

            <input
              id="relay-min-team-size"
              name="minTeamSize"
              type="number"
              inputMode="numeric"
              min={
                MIN_TEAM_SIZE
              }
              max={
                MAX_TEAM_SIZE
              }
              step={1}
              disabled={
                isPending
              }
              value={
                state.minTeamSize
              }
              onChange={(
                event
              ) =>
                updateField(
                  'minTeamSize',
                  event.target
                    .value
                )
              }
              aria-invalid={
                Boolean(
                  errors.minTeamSize
                )
              }
              aria-describedby={
                errors.minTeamSize
                  ? 'relay-min-team-size-error'
                  : undefined
              }
              className={
                inputClassName
              }
            />

            <FieldError
              id="relay-min-team-size-error"
              error={
                errors.minTeamSize
              }
            />
          </div>


          <div>
            <FieldLabel htmlFor="relay-max-team-size">
              Maximum team size
            </FieldLabel>

            <input
              id="relay-max-team-size"
              name="maxTeamSize"
              type="number"
              inputMode="numeric"
              min={
                MIN_TEAM_SIZE
              }
              max={
                MAX_TEAM_SIZE
              }
              step={1}
              disabled={
                isPending
              }
              value={
                state.maxTeamSize
              }
              onChange={(
                event
              ) =>
                updateField(
                  'maxTeamSize',
                  event.target
                    .value
                )
              }
              aria-invalid={
                Boolean(
                  errors.maxTeamSize
                )
              }
              aria-describedby={
                errors.maxTeamSize
                  ? 'relay-max-team-size-error'
                  : undefined
              }
              className={
                inputClassName
              }
            />

            <FieldError
              id="relay-max-team-size-error"
              error={
                errors.maxTeamSize
              }
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/10 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">
            Team preview
          </p>

          <p className="mt-1.5 text-sm text-white/58">
            {teamSizePreview}
          </p>
        </div>
      </AuthoringSection>


      {/* ======================================================
       * VISIBILITY
       * ====================================================== */}

      <AuthoringSection
        eyebrow="04 · Visibility"
        title="Who can discover it"
        description="Relay visibility is explicit in the authoring experience, but the current canonical Relay schema does not yet persist a visibility column."
      >
        <div
          className={[
            'rounded-2xl',
            'border',
            'border-emerald-300/12',
            'bg-emerald-300/[0.045]',
            'p-4',
          ].join(' ')}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300"
            />

            <div>
              <p className="text-sm font-semibold text-emerald-50/90">
                Public
              </p>

              <p className="mt-1.5 text-xs leading-relaxed text-emerald-50/45">
                Relay v1 is public-facing once its lifecycle state
                makes it discoverable. Private Relay visibility
                should not be introduced until the database and RLS
                contracts explicitly support it.
              </p>
            </div>
          </div>
        </div>

        <input
          type="hidden"
          name="visibility"
          value={
            state.visibility
          }
        />
      </AuthoringSection>


      {/* ======================================================
       * REWARD POLICY
       * ====================================================== */}

      <AuthoringSection
        eyebrow="05 · Competition reward"
        title="Winning team XP"
        description="Configure competition winner XP separately from normal explorer XP, Relay contributor attribution XP, and future Partner payouts."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <RewardModeOption
            mode="per_member"
            selectedMode={
              state.rewardMode
            }
            disabled={
              isPending
            }
            onChange={(
              rewardMode
            ) =>
              updateField(
                'rewardMode',
                rewardMode
              )
            }
            title="Per teammate"
            description="Every canonical contributor on the winning Relay receives the full configured XP amount."
          />

          <RewardModeOption
            mode="team_pool"
            selectedMode={
              state.rewardMode
            }
            disabled={
              isPending
            }
            onChange={(
              rewardMode
            ) =>
              updateField(
                'rewardMode',
                rewardMode
              )
            }
            title="Team pool"
            description="The configured XP amount is the total pool split across canonical winning contributors."
          />
        </div>


        <div className="mt-5 max-w-sm">
          <FieldLabel htmlFor="relay-xp-reward">
            XP reward
          </FieldLabel>

          <input
            id="relay-xp-reward"
            name="xpReward"
            type="number"
            inputMode="numeric"
            min={0}
            max={
              100000
            }
            step={1}
            disabled={
              isPending
            }
            value={
              state.xpReward
            }
            onChange={(
              event
            ) =>
              updateField(
                'xpReward',
                event.target
                  .value
              )
            }
            aria-invalid={
              Boolean(
                errors.xpReward
              )
            }
            aria-describedby={
              errors.xpReward
                ? 'relay-xp-reward-error'
                : 'relay-xp-reward-hint'
            }
            className={
              inputClassName
            }
          />

          <FieldError
            id="relay-xp-reward-error"
            error={
              errors.xpReward
            }
          />

          {!errors.xpReward ? (
            <div id="relay-xp-reward-hint">
              <FieldHint>
                Competition winner XP only. This does not modify
                ordinary Flow XP or Relay attribution XP.
              </FieldHint>
            </div>
          ) : null}
        </div>


        <div className="mt-5">
          <RelayRewardSummary
            policy={
              resolvedRewardPolicy
            }
            variant="admin"
          />
        </div>
      </AuthoringSection>


      {/* ======================================================
       * EXISTING ROUTE TEMPLATE PREVIEW
       * ======================================================
       *
       * Slot editing intentionally does not live here yet.
       *
       * RelaySlotBuilder / RelaySlotEditor will own that state.
       * ====================================================== */}

      {mode ===
        'edit' &&
      initialRelay ? (
        <AuthoringSection
          eyebrow="06 · Route"
          title="Current route template"
          description="Route structure is shown here as canonical read-only context. Slot authoring belongs to the dedicated Relay slot builder."
        >
          <RelaySlotList
            slots={
              initialRelay.slots
            }
            variant="preview"
            showPrompts
            showConstraints
          />
        </AuthoringSection>
      ) : null}


      {/* ======================================================
       * SUBMISSION
       * ====================================================== */}

      <section
        className={[
          'sticky',
          'bottom-3',
          'z-20',
          'rounded-3xl',
          'border',
          'border-white/[0.09]',
          'bg-[#111111]/95',
          'p-4',
          'shadow-[0_20px_60px_rgba(0,0,0,0.45)]',
          'backdrop-blur-xl',
        ].join(' ')}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {submitError ? (
              <p
                role="alert"
                className="text-sm font-medium text-rose-200/85"
              >
                {submitError}
              </p>
            ) : savedMessage ? (
              <p
                role="status"
                className="text-sm font-medium text-emerald-200/80"
              >
                {savedMessage}
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-white/32">
                {mode ===
                'create'
                  ? 'Create the Relay definition first, then configure its route template.'
                  : 'Saving updates the Relay definition and reward policy through the trusted admin action layer.'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isPending
            }
            className={[
              'inline-flex',
              'min-h-11',
              'shrink-0',
              'items-center',
              'justify-center',
              'rounded-full',
              'border',
              'border-amber-300/20',
              'bg-amber-300/[0.09]',
              'px-5',
              'text-sm',
              'font-semibold',
              'text-amber-50',
              'transition',
              'hover:border-amber-300/30',
              'hover:bg-amber-300/[0.13]',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-amber-300/40',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[#111111]',
              'disabled:cursor-not-allowed',
              'disabled:opacity-50',
            ].join(' ')}
          >
            {isPending
              ? 'Saving…'
              : mode ===
                  'create'
                ? 'Create Relay'
                : 'Save changes'}
          </button>
        </div>
      </section>
    </form>
  )
}


export default RelayAuthoringForm