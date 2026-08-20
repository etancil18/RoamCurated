'use client'

// components/venue-admin/relay/RelayTemplateAuthoringPanel.tsx

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import RelaySlotBuilder, {
  normalizeRelaySlotBuilderValue,
  validateRelaySlotBuilderValue,
  type RelaySlotBuilderValue,
} from '@/components/venue-admin/relay/RelaySlotBuilder'

import {
  saveRelayTemplate,
} from '@/lib/relay/actions'

import type {
  RelayDefinition,
  RelaySlotTemplate,
  RelayVenueSummary,
} from '@/lib/relay/types'


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayTemplateAuthoringPanelProps = {
  relay:
    RelayDefinition

  /**
   * Optional canonical venues used by RelaySlotEditor for
   * exact-venue and venue-pool selection.
   *
   * If omitted, RelaySlotEditor preserves its existing fallback
   * behavior and accepts canonical venue IDs directly.
   */
  venueOptions?:
    RelayVenueSummary[]

  className?:
    string
}


/* ============================================================
 * CANONICAL -> AUTHORING MAPPER
 * ============================================================
 */

function mapCanonicalSlotToAuthoringValue(
  slot:
    RelaySlotTemplate
): RelaySlotBuilderValue[number] {
  return {
    id:
      slot.id,

    slotIndex:
      slot.slotIndex,

    label:
      slot.label,

    prompt:
      slot.prompt ??
      '',

    selectionMode:
      slot.selectionMode,

    categoryConstraint:
      slot.categoryConstraint ??
      '',

    exactVenueId:
      slot.exactVenueId,

    eligibleVenueIds:
      slot.eligibleVenueIds ??
      [],

    /*
     * Relay v1 invariant.
     *
     * The database independently enforces this as true.
     */
    requiredGeoVerified:
      true,
  }
}


/* ============================================================
 * INITIAL VALUE
 * ============================================================
 */

function createInitialBuilderValue(
  relay:
    RelayDefinition
): RelaySlotBuilderValue {
  return normalizeRelaySlotBuilderValue(
    relay.slots.map(
      mapCanonicalSlotToAuthoringValue
    )
  )
}


/* ============================================================
 * STABLE COMPARISON
 * ============================================================
 *
 * Persisted slot IDs are intentionally excluded.
 *
 * save_roam_relay_template() atomically replaces the canonical
 * slot collection and PostgreSQL may issue new canonical UUIDs.
 *
 * Dirty-state comparison therefore focuses only on the authored
 * template semantics.
 * ============================================================
 */

function serializeBuilderValue(
  value:
    RelaySlotBuilderValue
): string {
  const normalized =
    normalizeRelaySlotBuilderValue(
      value
    )

  return JSON.stringify(
    normalized.map(
      (
        slot
      ) => ({
        slotIndex:
          slot.slotIndex,

        label:
          slot.label,

        prompt:
          slot.prompt,

        selectionMode:
          slot.selectionMode,

        categoryConstraint:
          slot.categoryConstraint,

        exactVenueId:
          slot.exactVenueId,

        eligibleVenueIds:
          slot.eligibleVenueIds,

        requiredGeoVerified:
          true,
      })
    )
  )
}


/* ============================================================
 * ERROR NORMALIZATION
 * ============================================================
 */

function getErrorMessage(
  error:
    unknown
): string {
  if (
    error instanceof
    Error
  ) {
    return error.message
  }

  if (
    typeof error ===
    'string'
  ) {
    return error
  }

  return 'Relay template could not be saved.'
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayTemplateAuthoringPanel({
  relay,
  venueOptions = [],
  className,
}: RelayTemplateAuthoringPanelProps) {
  const router =
    useRouter()


  const canonicalInitialValue =
    useMemo(
      () =>
        createInitialBuilderValue(
          relay
        ),
      [
        relay,
      ]
    )


  const [
    slots,
    setSlots,
  ] =
    useState<
      RelaySlotBuilderValue
    >(
      canonicalInitialValue
    )


  const [
    isSaving,
    setIsSaving,
  ] =
    useState(
      false
    )


  const [
    saveError,
    setSaveError,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    saveSuccess,
    setSaveSuccess,
  ] =
    useState<
      string | null
    >(
      null
    )


  /*
   * router.refresh() may return a newly persisted canonical slot
   * collection with new UUIDs.
   *
   * Keep local authoring state synchronized with refreshed server
   * props so subsequent edits operate from canonical truth.
   */
  useEffect(
  () => {
    setSlots(
      canonicalInitialValue
    )

    setSaveError(
      null
    )
  },
  [
    canonicalInitialValue,
  ]
)


  const normalizedSlots =
    useMemo(
      () =>
        normalizeRelaySlotBuilderValue(
          slots
        ),
      [
        slots,
      ]
    )


  const validation =
    useMemo(
      () =>
        validateRelaySlotBuilderValue(
          normalizedSlots
        ),
      [
        normalizedSlots,
      ]
    )


  const initialSignature =
    useMemo(
      () =>
        serializeBuilderValue(
          canonicalInitialValue
        ),
      [
        canonicalInitialValue,
      ]
    )


  const currentSignature =
    useMemo(
      () =>
        serializeBuilderValue(
          normalizedSlots
        ),
      [
        normalizedSlots,
      ]
    )


  const isDirty =
    initialSignature !==
    currentSignature


  const isDraft =
    relay.status ===
    'draft'


  const canSave =
    (
      isDraft &&
      validation.isValid &&
      isDirty &&
      !isSaving
    )


  function handleSlotsChange(
    next:
      RelaySlotBuilderValue
  ) {
    setSlots(
      next
    )

    setSaveError(
      null
    )

    setSaveSuccess(
      null
    )
  }


  function resetTemplate() {
    if (
      isSaving
    ) {
      return
    }

    setSlots(
      canonicalInitialValue
    )

    setSaveError(
      null
    )

    setSaveSuccess(
      null
    )
  }


  async function saveTemplate() {
    if (
      !isDraft
    ) {
      setSaveError(
        'Relay route templates may only be edited while the Relay is draft.'
      )

      return
    }


    const currentValidation =
      validateRelaySlotBuilderValue(
        normalizedSlots
      )


    if (
      !currentValidation.isValid
    ) {
      setSaveError(
        'Resolve the Relay template validation issues before saving.'
      )

      return
    }


    if (
      !isDirty
    ) {
      return
    }


    setIsSaving(
      true
    )

    setSaveError(
      null
    )

    setSaveSuccess(
      null
    )


    try {
      const result =
        await saveRelayTemplate(
          relay.id,
          normalizedSlots
        )


      if (
        result.relayId !==
        relay.id
      ) {
        throw new Error(
          'Relay template save returned an unexpected Relay ID.'
        )
      }


      setSaveSuccess(
        'Relay route template saved.'
      )


      /*
       * Reload the canonical Relay definition.
       *
       * The database RPC replaces the entire draft template
       * atomically, so persisted slot UUIDs may have changed.
       */
      router.refresh()
    } catch (
      error
    ) {
      setSaveError(
        getErrorMessage(
          error
        )
      )
    } finally {
      setIsSaving(
        false
      )
    }
  }


  return (
    <section
      className={[
        'w-full',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      aria-labelledby="relay-template-authoring-heading"
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
        ].join(
          ' '
        )}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Route authoring
          </p>

          <h2
            id="relay-template-authoring-heading"
            className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-zinc-50"
          >
            Relay route template
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Define the 3–5 sequential Relay legs that teammates will
            execute through canonical geo-verified Active Flow
            sessions.
          </p>
        </div>


        <div className="shrink-0">
          <span
            className={[
              'inline-flex',
              'items-center',
              'rounded-full',
              'border',
              'px-3',
              'py-1.5',
              'text-[10px]',
              'font-bold',
              'uppercase',
              'tracking-[0.12em]',
              isDraft
                ? [
                    'border-amber-400/25',
                    'bg-amber-400/[0.07]',
                    'text-amber-200',
                  ].join(
                    ' '
                  )
                : [
                    'border-zinc-700',
                    'bg-zinc-900',
                    'text-zinc-400',
                  ].join(
                    ' '
                  ),
            ].join(
              ' '
            )}
          >
            {isDraft
              ? 'Draft editing'
              : 'Template locked'}
          </span>
        </div>
      </div>


      {/* ======================================================
       * NON-DRAFT LOCK NOTICE
       * ====================================================== */}

      {!isDraft ? (
        <div
          className={[
            'mt-5',
            'rounded-2xl',
            'border',
            'border-zinc-700',
            'bg-zinc-900',
            'px-4',
            'py-4',
          ].join(
            ' '
          )}
        >
          <p className="text-sm font-semibold text-zinc-200">
            Route structure is locked
          </p>

          <p className="mt-1.5 text-xs leading-5 text-zinc-400">
            Structural Relay edits are limited to draft state so
            published team assignments, baton order, Active Flow
            provenance, and completion evidence remain stable.
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * BUILDER
       * ====================================================== */}

      <div className="mt-6">
        <RelaySlotBuilder
          value={
            normalizedSlots
          }
          onChange={
            handleSlotsChange
          }
          venueOptions={
            venueOptions
          }
          disabled={
            !isDraft ||
            isSaving
          }
          showPreview
          showValidation
        />
      </div>


      {/* ======================================================
       * SAVE ERROR
       * ====================================================== */}

      {saveError ? (
        <div
          role="alert"
          className={[
            'mt-5',
            'rounded-2xl',
            'border',
            'border-rose-400/20',
            'bg-rose-400/[0.055]',
            'px-4',
            'py-3.5',
          ].join(
            ' '
          )}
        >
          <p className="text-sm font-semibold text-rose-100">
            Route template was not saved
          </p>

          <p className="mt-1.5 break-words text-xs leading-5 text-rose-100/70">
            {
              saveError
            }
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * SAVE SUCCESS
       * ====================================================== */}

      {saveSuccess ? (
        <div
          role="status"
          className={[
            'mt-5',
            'rounded-2xl',
            'border',
            'border-emerald-400/18',
            'bg-emerald-400/[0.05]',
            'px-4',
            'py-3.5',
          ].join(
            ' '
          )}
        >
          <p className="text-sm font-semibold text-emerald-100">
            {
              saveSuccess
            }
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * ACTION BAR
       * ====================================================== */}

      <div
        className={[
          'mt-6',
          'flex',
          'flex-col-reverse',
          'gap-3',
          'border-t',
          'border-zinc-800',
          'pt-5',
          'sm:flex-row',
          'sm:items-center',
          'sm:justify-between',
        ].join(
          ' '
        )}
      >
        <div className="min-w-0">
          <p
            className={[
              'text-xs',
              isDirty
                ? 'text-amber-200/70'
                : 'text-zinc-500',
            ].join(
              ' '
            )}
          >
            {isDirty
              ? 'Unsaved route-template changes'
              : 'Route template matches canonical saved state'}
          </p>
        </div>


        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            disabled={
              !isDraft ||
              !isDirty ||
              isSaving
            }
            onClick={
              resetTemplate
            }
            className={[
              'inline-flex',
              'min-h-11',
              'w-full',
              'items-center',
              'justify-center',
              'rounded-xl',
              'border',
              'border-zinc-700',
              'bg-zinc-900',
              'px-4',
              'text-sm',
              'font-bold',
              'text-zinc-300',
              'transition',
              'hover:border-zinc-600',
              'hover:bg-zinc-800',
              'hover:text-white',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-zinc-500',
              'disabled:cursor-not-allowed',
              'disabled:opacity-40',
              'sm:w-auto',
            ].join(
              ' '
            )}
          >
            Reset
          </button>


          <button
            type="button"
            disabled={
              !canSave
            }
            onClick={() => {
              void saveTemplate()
            }}
            className={[
              'inline-flex',
              'min-h-11',
              'w-full',
              'items-center',
              'justify-center',
              'rounded-xl',
              'border',
              canSave
                ? [
                    'border-amber-400',
                    'bg-amber-400',
                    'text-zinc-950',
                    'hover:border-amber-300',
                    'hover:bg-amber-300',
                  ].join(
                    ' '
                  )
                : [
                    'border-zinc-800',
                    'bg-zinc-900',
                    'text-zinc-600',
                  ].join(
                    ' '
                  ),
              'px-5',
              'text-sm',
              'font-bold',
              'transition',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-amber-300',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-zinc-950',
              'disabled:cursor-not-allowed',
              'disabled:opacity-60',
              'sm:w-auto',
            ].join(
              ' '
            )}
          >
            {isSaving
              ? 'Saving route...'
              : 'Save route template'}
          </button>
        </div>
      </div>
    </section>
  )
}


export default RelayTemplateAuthoringPanel