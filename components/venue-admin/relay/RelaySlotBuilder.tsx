'use client'

// components/venue-admin/relay/RelaySlotBuilder.tsx

import {
  useMemo,
} from 'react'

import RelaySlotEditor, {
  type RelaySlotEditorErrors,
  type RelaySlotEditorValue,
  validateRelaySlotEditorValue,
} from '@/components/venue-admin/relay/RelaySlotEditor'

import RelaySlotList from '@/components/relay/RelaySlotList'

import {
  formatRelaySlotCount,
} from '@/lib/relay/format'

import type {
  RelaySlotTemplate,
  RelayVenueSummary,
} from '@/lib/relay/types'


/* ============================================================
 * CONSTANTS
 * ============================================================
 */

export const RELAY_MIN_SLOT_COUNT =
  3

export const RELAY_MAX_SLOT_COUNT =
  5


/* ============================================================
 * PUBLIC TYPES
 * ============================================================
 */

export type RelaySlotBuilderValue =
  RelaySlotEditorValue[]


export type RelaySlotBuilderErrorCode =
  | 'too_few_slots'
  | 'too_many_slots'
  | 'duplicate_slot_id'
  | 'invalid_slot_index'
  | 'slot_invalid'


export type RelaySlotBuilderError = {
  code:
    RelaySlotBuilderErrorCode

  message:
    string

  slotIndex?:
    number
}


export type RelaySlotBuilderValidation = {
  isValid:
    boolean

  errors:
    RelaySlotBuilderError[]

  slotErrors:
    Record<
      number,
      RelaySlotEditorErrors
    >
}


export type RelaySlotBuilderProps = {
  value:
    RelaySlotBuilderValue

  onChange:
    (
      value:
        RelaySlotBuilderValue
    ) => void

  /**
   * Optional canonical venue options passed through to every
   * RelaySlotEditor.
   */
  venueOptions?:
    RelayVenueSummary[]

  disabled?:
    boolean

  /**
   * Production defaults are intentionally fixed to Relay v1.
   *
   * These props exist mainly for tests/future controlled
   * evolution. Do not casually override them in product code.
   */
  minSlots?:
    number

  maxSlots?:
    number

  /**
   * Show canonical template preview beneath the editors.
   */
  showPreview?:
    boolean

  /**
   * Surface aggregate validation messages.
   */
  showValidation?:
    boolean

  className?:
    string
}


/* ============================================================
 * DEFAULT SLOT FACTORY
 * ============================================================
 *
 * New slots intentionally start blank rather than inventing a
 * semantic role such as Coffee/Lunch/Dinner.
 *
 * The admin must explicitly define the route.
 * ============================================================
 */

export function createEmptyRelaySlot(
  slotIndex: number
): RelaySlotEditorValue {
  return {
    id:
      null,

    slotIndex,

    label:
      '',

    prompt:
      '',

    selectionMode:
      'open',

    categoryConstraint:
      '',

    exactVenueId:
      null,

    eligibleVenueIds:
      [],

    requiredGeoVerified:
      true,
  }
}


/* ============================================================
 * NORMALIZATION
 * ============================================================
 */

export function normalizeRelaySlotBuilderValue(
  value:
    RelaySlotBuilderValue
): RelaySlotBuilderValue {
  return value.map(
    (
      slot,
      index
    ) => ({
      ...slot,

      /*
       * The builder owns canonical contiguous ordering.
       */
      slotIndex:
        index +
        1,

      /*
       * Relay v1 physical-verification invariant.
       */
      requiredGeoVerified:
        true,
    })
  )
}


/* ============================================================
 * VALIDATION
 * ============================================================
 */

export function validateRelaySlotBuilderValue(
  value:
    RelaySlotBuilderValue,
  options: {
    minSlots?: number
    maxSlots?: number
  } = {}
): RelaySlotBuilderValidation {
  const minSlots =
    options.minSlots ??
    RELAY_MIN_SLOT_COUNT

  const maxSlots =
    options.maxSlots ??
    RELAY_MAX_SLOT_COUNT

  const errors:
    RelaySlotBuilderError[] =
    []

  const slotErrors:
    Record<
      number,
      RelaySlotEditorErrors
    > =
    {}

  if (
    value.length <
    minSlots
  ) {
    errors.push({
      code:
        'too_few_slots',

      message:
        `Relay requires at least ${minSlots} legs.`,
    })
  }


  if (
    value.length >
    maxSlots
  ) {
    errors.push({
      code:
        'too_many_slots',

      message:
        `Relay supports at most ${maxSlots} legs.`,
    })
  }


  /*
   * Persisted canonical slot IDs may not appear twice.
   */
  const persistedIds =
    value
      .map(
        (slot) =>
          slot.id
      )
      .filter(
        (
          id
        ): id is string =>
          Boolean(id)
      )

  if (
    new Set(
      persistedIds
    ).size !==
    persistedIds.length
  ) {
    errors.push({
      code:
        'duplicate_slot_id',

      message:
        'Relay template contains duplicate persisted slot IDs.',
    })
  }


  value.forEach(
    (
      slot,
      index
    ) => {
      const expectedIndex =
        index +
        1

      if (
        slot.slotIndex !==
        expectedIndex
      ) {
        errors.push({
          code:
            'invalid_slot_index',

          message:
            `Relay leg ${expectedIndex} has a non-canonical slot index.`,

          slotIndex:
            expectedIndex,
        })
      }


      const perSlotErrors =
        validateRelaySlotEditorValue(
          slot
        )

      if (
        Object.keys(
          perSlotErrors
        ).length >
        0
      ) {
        slotErrors[
          expectedIndex
        ] =
          perSlotErrors

        errors.push({
          code:
            'slot_invalid',

          message:
            `Relay leg ${expectedIndex} needs attention.`,

          slotIndex:
            expectedIndex,
        })
      }
    }
  )


  return {
    isValid:
      errors.length ===
      0,

    errors,

    slotErrors,
  }
}


/* ============================================================
 * PREVIEW MAPPER
 * ============================================================
 *
 * RelaySlotList consumes RelaySlotTemplate rather than the
 * mutable authoring shape.
 *
 * This is presentation-only conversion.
 * ============================================================
 */

function mapAuthoringSlotToPreview(
  slot:
    RelaySlotEditorValue,
  venueOptions:
    RelayVenueSummary[]
): RelaySlotTemplate {
  const exactVenue =
    slot.exactVenueId
      ? venueOptions.find(
          (venue) =>
            venue.id ===
            slot.exactVenueId
        ) ??
        null
      : null

  const eligibleVenueIdSet =
    new Set(
      slot.eligibleVenueIds
    )

  const eligibleVenues =
    venueOptions.filter(
      (venue) =>
        eligibleVenueIdSet.has(
          venue.id
        )
    )

  return {
    /*
     * RelaySlotList requires a stable string ID.
     *
     * Persisted slots use their canonical UUID.
     * Unsaved slots use a presentation-only synthetic identifier.
     */
    id:
      slot.id ??
      `new-relay-slot-${slot.slotIndex}`,

    relayId:
      'relay-authoring-preview',

    slotIndex:
      slot.slotIndex,

    label:
      slot.label,

    prompt:
      slot.prompt.trim() ||
      null,

    selectionMode:
      slot.selectionMode,

    categoryConstraint:
      slot.categoryConstraint
        .trim() ||
      null,

    exactVenueId:
      slot.exactVenueId,

    eligibleVenueIds:
      slot.eligibleVenueIds,

    requiredGeoVerified:
      true,

    exactVenue,

    eligibleVenues,

    /*
     * Preview-only values.
     *
     * These timestamps are never persisted.
     */
    createdAt:
      '',

    updatedAt:
      '',
  }
}


/* ============================================================
 * AGGREGATE VALIDATION
 * ============================================================
 */

function RelaySlotBuilderValidationSummary({
  validation,
}: {
  validation:
    RelaySlotBuilderValidation
}) {
  if (
    validation.isValid
  ) {
    return (
      <div
        className={[
          'rounded-2xl',
          'border',
          'border-emerald-300/12',
          'bg-emerald-300/[0.045]',
          'px-4',
          'py-4',
        ].join(' ')}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-emerald-100/48">
          Template status
        </p>

        <p className="mt-2 text-sm font-medium text-emerald-50/80">
          Relay template is valid
        </p>

        <p className="mt-1.5 text-xs leading-relaxed text-emerald-50/42">
          Slot count, ordering, and per-leg constraints are ready
          for trusted server-side validation.
        </p>
      </div>
    )
  }


  const uniqueMessages =
    [
      ...new Set(
        validation.errors.map(
          (error) =>
            error.message
        )
      ),
    ]

  return (
    <div
      role="alert"
      className={[
        'rounded-2xl',
        'border',
        'border-rose-300/14',
        'bg-rose-300/[0.045]',
        'px-4',
        'py-4',
      ].join(' ')}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-rose-100/52">
        Template needs attention
      </p>

      <ul className="mt-2 grid gap-1.5">
        {uniqueMessages.map(
          (message) => (
            <li
              key={
                message
              }
              className="text-xs leading-relaxed text-rose-50/65"
            >
              {message}
            </li>
          )
        )}
      </ul>
    </div>
  )
}


/* ============================================================
 * ORDER CONTROL
 * ============================================================
 */

function SlotOrderControls({
  slotIndex,
  totalSlots,
  disabled,
  onMoveUp,
  onMoveDown,
  onRemove,
  canRemove,
}: {
  slotIndex:
    number

  totalSlots:
    number

  disabled:
    boolean

  onMoveUp:
    () => void

  onMoveDown:
    () => void

  onRemove:
    () => void

  canRemove:
    boolean
}) {
  const first =
    slotIndex ===
    1

  const last =
    slotIndex ===
    totalSlots

  const buttonClassName = [
    'inline-flex',
    'min-h-9',
    'items-center',
    'justify-center',
    'rounded-full',
    'border',
    'border-white/[0.09]',
    'bg-white/[0.025]',
    'px-3',
    'text-[11px]',
    'font-medium',
    'text-white/52',
    'transition',
    'hover:border-white/14',
    'hover:bg-white/[0.05]',
    'hover:text-white/78',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-white/20',
    'disabled:cursor-not-allowed',
    'disabled:opacity-30',
  ].join(' ')


  return (
    <div
      className={[
        'flex',
        'flex-wrap',
        'items-center',
        'gap-2',
      ].join(' ')}
      aria-label={`Reorder Relay leg ${slotIndex}`}
    >
      <button
        type="button"
        disabled={
          disabled ||
          first
        }
        onClick={
          onMoveUp
        }
        className={
          buttonClassName
        }
        aria-label={`Move Relay leg ${slotIndex} up`}
      >
        Up
      </button>

      <button
        type="button"
        disabled={
          disabled ||
          last
        }
        onClick={
          onMoveDown
        }
        className={
          buttonClassName
        }
        aria-label={`Move Relay leg ${slotIndex} down`}
      >
        Down
      </button>

      <button
        type="button"
        disabled={
          disabled ||
          !canRemove
        }
        onClick={
          onRemove
        }
        className={[
          buttonClassName,
          canRemove
            ? 'hover:border-rose-300/18 hover:bg-rose-300/[0.05] hover:text-rose-100'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={`Remove Relay leg ${slotIndex}`}
      >
        Remove
      </button>
    </div>
  )
}


/* ============================================================
 * EMPTY STATE
 * ============================================================
 */

function EmptyRelaySlotBuilder({
  disabled,
  onInitialize,
  minSlots,
}: {
  disabled:
    boolean

  onInitialize:
    () => void

  minSlots:
    number
}) {
  return (
    <div
      className={[
        'rounded-3xl',
        'border',
        'border-dashed',
        'border-white/10',
        'bg-white/[0.025]',
        'px-6',
        'py-10',
        'text-center',
      ].join(' ')}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
        Route template
      </p>

      <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">
        Build the Relay
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/38">
        Relay v1 needs at least {minSlots} sequential legs, with
        exactly one teammate responsible for each leg.
      </p>

      <button
        type="button"
        disabled={
          disabled
        }
        onClick={
          onInitialize
        }
        className={[
          'mt-5',
          'inline-flex',
          'min-h-10',
          'items-center',
          'justify-center',
          'rounded-full',
          'border',
          'border-amber-300/20',
          'bg-amber-300/[0.09]',
          'px-4',
          'text-sm',
          'font-semibold',
          'text-amber-50',
          'transition',
          'hover:border-amber-300/28',
          'hover:bg-amber-300/[0.13]',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-amber-300/30',
          'disabled:cursor-not-allowed',
          'disabled:opacity-50',
        ].join(' ')}
      >
        Add {minSlots} starting legs
      </button>
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelaySlotBuilder({
  value,
  onChange,
  venueOptions = [],
  disabled = false,
  minSlots =
    RELAY_MIN_SLOT_COUNT,
  maxSlots =
    RELAY_MAX_SLOT_COUNT,
  showPreview = true,
  showValidation = true,
  className,
}: RelaySlotBuilderProps) {
  /*
   * Every render treats ordered array position as canonical
   * authoring order.
   */
  const normalizedValue =
    useMemo(
      () =>
        normalizeRelaySlotBuilderValue(
          value
        ),
      [
        value,
      ]
    )


  const validation =
    useMemo(
      () =>
        validateRelaySlotBuilderValue(
          normalizedValue,
          {
            minSlots,
            maxSlots,
          }
        ),
      [
        normalizedValue,
        minSlots,
        maxSlots,
      ]
    )


  const previewSlots =
    useMemo(
      () =>
        normalizedValue.map(
          (slot) =>
            mapAuthoringSlotToPreview(
              slot,
              venueOptions
            )
        ),
      [
        normalizedValue,
        venueOptions,
      ]
    )


  const canAdd =
    normalizedValue.length <
    maxSlots

  const canRemove =
    normalizedValue.length >
    minSlots


  function commit(
    next:
      RelaySlotBuilderValue
  ) {
    onChange(
      normalizeRelaySlotBuilderValue(
        next
      )
    )
  }


  function initializeTemplate() {
    if (disabled) {
      return
    }

    const initial =
      Array.from(
        {
          length:
            minSlots,
        },
        (
          _,
          index
        ) =>
          createEmptyRelaySlot(
            index +
              1
          )
      )

    commit(
      initial
    )
  }


  function updateSlot(
    arrayIndex:
      number,
    nextSlot:
      RelaySlotEditorValue
  ) {
    if (disabled) {
      return
    }

    const next =
      normalizedValue.map(
        (
          slot,
          index
        ) =>
          index ===
          arrayIndex
            ? nextSlot
            : slot
      )

    commit(
      next
    )
  }


  function addSlot() {
    if (
      disabled ||
      !canAdd
    ) {
      return
    }

    commit([
      ...normalizedValue,

      createEmptyRelaySlot(
        normalizedValue.length +
          1
      ),
    ])
  }


  function removeSlot(
    arrayIndex:
      number
  ) {
    if (
      disabled ||
      !canRemove
    ) {
      return
    }

    commit(
      normalizedValue.filter(
        (
          _,
          index
        ) =>
          index !==
          arrayIndex
      )
    )
  }


  function moveSlot(
    arrayIndex:
      number,
    direction:
      -1 | 1
  ) {
    if (disabled) {
      return
    }

    const destination =
      arrayIndex +
      direction

    if (
      destination <
        0 ||
      destination >=
        normalizedValue.length
    ) {
      return
    }

    const next =
      [
        ...normalizedValue,
      ]

    const current =
      next[
        arrayIndex
      ]

    const target =
      next[
        destination
      ]

    if (
      !current ||
      !target
    ) {
      return
    }

    next[
      arrayIndex
    ] =
      target

    next[
      destination
    ] =
      current

    commit(
      next
    )
  }


  if (
    normalizedValue.length ===
    0
  ) {
    return (
      <section
        className={[
          'w-full',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Relay route builder"
      >
        <EmptyRelaySlotBuilder
          disabled={
            disabled
          }
          onInitialize={
            initializeTemplate
          }
          minSlots={
            minSlots
          }
        />
      </section>
    )
  }


  return (
    <section
      className={[
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Relay route builder"
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div
        className={[
          'flex',
          'flex-col',
          'gap-4',
          'sm:flex-row',
          'sm:items-end',
          'sm:justify-between',
        ].join(' ')}
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
            Route template
          </p>

          <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white">
            Relay legs
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/38">
            Build a sequential route of {minSlots}–{maxSlots} legs.
            Array order is canonical Relay order, and every leg must
            remain geo verified.
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/28">
            Template size
          </p>

          <p className="mt-1.5 text-sm font-medium text-white/68">
            {formatRelaySlotCount(
              normalizedValue.length
            )}
          </p>
        </div>
      </div>


      {/* ======================================================
       * TOP-LEVEL VALIDATION
       * ====================================================== */}

      {showValidation ? (
        <div className="mt-5">
          <RelaySlotBuilderValidationSummary
            validation={
              validation
            }
          />
        </div>
      ) : null}


      {/* ======================================================
       * EDITORS
       * ====================================================== */}

      <div className="mt-5 grid gap-5">
        {normalizedValue.map(
          (
            slot,
            arrayIndex
          ) => {
            const slotErrors =
              validation.slotErrors[
                slot.slotIndex
              ] ??
              {}

            return (
              <div
                key={
                  slot.id ??
                  `relay-slot-${slot.slotIndex}`
                }
                className="relative"
              >
                <div
                  className={[
                    'mb-2',
                    'flex',
                    'flex-wrap',
                    'items-center',
                    'justify-between',
                    'gap-3',
                  ].join(' ')}
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/28">
                    Position{' '}
                    {slot.slotIndex}
                  </p>

                  <SlotOrderControls
                    slotIndex={
                      slot.slotIndex
                    }
                    totalSlots={
                      normalizedValue.length
                    }
                    disabled={
                      disabled
                    }
                    canRemove={
                      canRemove
                    }
                    onMoveUp={() =>
                      moveSlot(
                        arrayIndex,
                        -1
                      )
                    }
                    onMoveDown={() =>
                      moveSlot(
                        arrayIndex,
                        1
                      )
                    }
                    onRemove={() =>
                      removeSlot(
                        arrayIndex
                      )
                    }
                  />
                </div>

                <RelaySlotEditor
                  value={
                    slot
                  }
                  onChange={(
                    nextSlot
                  ) =>
                    updateSlot(
                      arrayIndex,
                      nextSlot
                    )
                  }
                  venueOptions={
                    venueOptions
                  }
                  errors={
                    slotErrors
                  }
                  disabled={
                    disabled
                  }
                />
              </div>
            )
          }
        )}
      </div>


      {/* ======================================================
       * ADD SLOT
       * ====================================================== */}

      <div className="mt-5">
        <button
          type="button"
          disabled={
            disabled ||
            !canAdd
          }
          onClick={
            addSlot
          }
          className={[
            'inline-flex',
            'min-h-10',
            'items-center',
            'justify-center',
            'rounded-full',
            'border',
            canAdd
              ? [
                  'border-white/[0.1]',
                  'bg-white/[0.035]',
                  'text-white/68',
                  'hover:border-white/16',
                  'hover:bg-white/[0.06]',
                  'hover:text-white',
                ].join(' ')
              : [
                  'border-white/[0.06]',
                  'bg-white/[0.018]',
                  'text-white/28',
                ].join(' '),
            'px-4',
            'text-xs',
            'font-medium',
            'transition',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-white/20',
            'disabled:cursor-not-allowed',
            'disabled:opacity-50',
          ].join(' ')}
        >
          {canAdd
            ? 'Add Relay leg'
            : `Maximum ${maxSlots} legs`}
        </button>
      </div>


      {/* ======================================================
       * PREVIEW
       * ====================================================== */}

      {showPreview ? (
        <div className="mt-8 border-t border-white/[0.07] pt-7">
          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
              Route preview
            </p>

            <h3 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-white">
              Canonical order
            </h3>

            <p className="mt-1.5 text-xs leading-relaxed text-white/32">
              This is the ordered route skeleton consumers will see.
              Database validation remains authoritative at save time.
            </p>
          </div>

          <RelaySlotList
            slots={
              previewSlots
            }
            variant="preview"
            showPrompts
            showConstraints
          />
        </div>
      ) : null}
    </section>
  )
}


export default RelaySlotBuilder