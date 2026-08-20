'use client'

// components/venue-admin/relay/RelaySlotEditor.tsx

import {
  useId,
  useMemo,
  useState,
} from 'react'

import {
  formatRelaySelectionModeDescription,
  formatRelaySelectionModeLabel,
  formatRelaySlotNumber,
} from '@/lib/relay/format'

import type {
  RelaySlotId,
  RelaySlotSelectionMode,
  RelayVenueSummary,
  VenueId,
} from '@/lib/relay/types'


/* ============================================================
 * AUTHORING VALUE
 * ============================================================
 *
 * This is intentionally an authoring shape rather than a raw
 * database row.
 *
 * RelaySlotBuilder can own an array of these values and later
 * submit the normalized collection through the trusted admin
 * action layer.
 * ============================================================
 */

export type RelaySlotEditorValue = {
  /**
   * Existing canonical slot ID when editing.
   *
   * null for a newly-authored slot that has not been persisted.
   */
  id: RelaySlotId | null

  /**
   * Canonical Relay slot index.
   *
   * Relay v1 uses one-based slot indexing.
   */
  slotIndex: number

  label: string

  prompt: string

  selectionMode:
    RelaySlotSelectionMode

  categoryConstraint:
    string

  exactVenueId:
    VenueId | null

  eligibleVenueIds:
    VenueId[]

  /**
   * Relay v1 requires verified physical execution.
   *
   * The editor displays this invariant but does not allow the
   * admin to disable it.
   */
  requiredGeoVerified:
    true
}


/* ============================================================
 * VALIDATION
 * ============================================================
 */

export type RelaySlotEditorErrorField =
  | 'label'
  | 'prompt'
  | 'categoryConstraint'
  | 'exactVenueId'
  | 'eligibleVenueIds'


export type RelaySlotEditorErrors =
  Partial<
    Record<
      RelaySlotEditorErrorField,
      string
    >
  >


export function validateRelaySlotEditorValue(
  value:
    RelaySlotEditorValue
): RelaySlotEditorErrors {
  const errors:
    RelaySlotEditorErrors =
    {}

  const label =
    value.label.trim()

  const prompt =
    value.prompt.trim()

  const category =
    value.categoryConstraint.trim()

  if (!label) {
    errors.label =
      'Slot label is required.'
  } else if (
    label.length >
    80
  ) {
    errors.label =
      'Slot label must be 80 characters or fewer.'
  }


  if (
    prompt.length >
    500
  ) {
    errors.prompt =
      'Prompt must be 500 characters or fewer.'
  }


  switch (
    value.selectionMode
  ) {
    case 'open':
      break


    case 'category':
      if (!category) {
        errors.categoryConstraint =
          'A category is required for category-constrained slots.'
      } else if (
        category.length >
        120
      ) {
        errors.categoryConstraint =
          'Category must be 120 characters or fewer.'
      }

      break


    case 'venue_pool':
      if (
        value
          .eligibleVenueIds
          .length ===
        0
      ) {
        errors.eligibleVenueIds =
          'Add at least one eligible venue.'
      }

      break


    case 'exact_venue':
      if (
        !value.exactVenueId
          ?.trim()
      ) {
        errors.exactVenueId =
          'Choose the required venue.'
      }

      break
  }


  return errors
}


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelaySlotEditorProps = {
  value:
    RelaySlotEditorValue

  onChange:
    (
      value:
        RelaySlotEditorValue
    ) => void

  /**
   * Optional resolved venue options.
   *
   * If provided, exact-venue and venue-pool controls use the
   * canonical IDs from these options.
   *
   * If omitted, the component falls back to explicit venue-ID
   * authoring rather than inventing a venue search system.
   */
  venueOptions?:
    RelayVenueSummary[]

  /**
   * Optional externally-owned validation errors.
   *
   * Useful when RelaySlotBuilder validates all slots at submit
   * time.
   */
  errors?:
    RelaySlotEditorErrors

  disabled?:
    boolean

  className?:
    string
}


/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const SELECTION_MODES:
  Array<{
    mode:
      RelaySlotSelectionMode

    title:
      string

    description:
      string
  }> = [
    {
      mode:
        'open',

      title:
        formatRelaySelectionModeLabel(
          'open'
        ),

      description:
        formatRelaySelectionModeDescription(
          'open'
        ),
    },

    {
      mode:
        'category',

      title:
        formatRelaySelectionModeLabel(
          'category'
        ),

      description:
        formatRelaySelectionModeDescription(
          'category'
        ),
    },

    {
      mode:
        'venue_pool',

      title:
        formatRelaySelectionModeLabel(
          'venue_pool'
        ),

      description:
        formatRelaySelectionModeDescription(
          'venue_pool'
        ),
    },

    {
      mode:
        'exact_venue',

      title:
        formatRelaySelectionModeLabel(
          'exact_venue'
        ),

      description:
        formatRelaySelectionModeDescription(
          'exact_venue'
        ),
    },
  ]


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


const VENUE_SEARCH_RESULT_LIMIT =
  20


/* ============================================================
 * INTERNAL HELPERS
 * ============================================================
 */

function normalizeVenueId(
  value: string
): VenueId | null {
  const normalized =
    value.trim()

  return normalized ||
    null
}


function normalizeVenueIdList(
  value: string
): VenueId[] {
  const ids =
    value
      .split(
        /[\n,]+/
      )
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean)

  return [
    ...new Set(
      ids
    ),
  ]
}


function serializeVenueIdList(
  venueIds:
    VenueId[]
): string {
  return venueIds.join(
    '\n'
  )
}


function getVenueName(
  venueId:
    VenueId | null,
  venueOptions:
    RelayVenueSummary[]
): string | null {
  if (!venueId) {
    return null
  }

  return (
    venueOptions.find(
      (venue) =>
        venue.id ===
        venueId
    )
      ?.name ??
    null
  )
}


function getVenuePoolNames(
  venueIds:
    VenueId[],
  venueOptions:
    RelayVenueSummary[]
): string[] {
  const venueById =
    new Map(
      venueOptions.map(
        (venue) => [
          venue.id,
          venue,
        ] as const
      )
    )

  return venueIds
    .map(
      (venueId) =>
        venueById.get(
          venueId
        )?.name
    )
    .filter(
      (
        name
      ): name is string =>
        Boolean(name)
    )
}


function normalizeVenueSearchText(
  value:
    string | null | undefined
): string {
  return (
    value ??
    ''
  )
    .trim()
    .toLocaleLowerCase(
      'en-US'
    )
}


function filterVenueOptions(
  venueOptions:
    RelayVenueSummary[],
  searchQuery:
    string
): RelayVenueSummary[] {
  const normalizedSearch =
    normalizeVenueSearchText(
      searchQuery
    )

  if (!normalizedSearch) {
    return []
  }

  return venueOptions
    .filter(
      (venue) => {
        const searchableText =
          [
            venue.name,
            venue.category,
            venue.neighborhood,
            venue.city,
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase(
              'en-US'
            )

        return searchableText.includes(
          normalizedSearch
        )
      }
    )
    .slice(
      0,
      VENUE_SEARCH_RESULT_LIMIT
    )
}


/* ============================================================
 * SHARED FIELD UI
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


/* ============================================================
 * SELECTION MODE OPTION
 * ============================================================
 */

function SelectionModeOption({
  mode,
  title,
  description,
  selected,
  disabled,
  onSelect,
}: {
  mode:
    RelaySlotSelectionMode

  title:
    string

  description:
    string

  selected:
    boolean

  disabled:
    boolean

  onSelect:
    (
      mode:
        RelaySlotSelectionMode
    ) => void
}) {
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
      data-relay-selection-mode={
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
            {title}
          </span>

          <span className="mt-1 block text-xs leading-relaxed text-white/36">
            {description}
          </span>
        </span>
      </div>
    </button>
  )
}


/* ============================================================
 * VENUE POOL — RESOLVED OPTION MODE
 * ============================================================
 */

function VenuePoolOptionList({
  value,
  venueOptions,
  searchQuery,
  disabled,
  onChange,
}: {
  value:
    VenueId[]

  venueOptions:
    RelayVenueSummary[]

  searchQuery:
    string

  disabled:
    boolean

  onChange:
    (
      venueIds:
        VenueId[]
    ) => void
}) {
  const selectedIds =
    new Set(
      value
    )

  const selectedVenues =
    venueOptions.filter(
      (venue) =>
        selectedIds.has(
          venue.id
        )
    )

  const matchingVenues =
    filterVenueOptions(
      venueOptions,
      searchQuery
    )
      .filter(
        (venue) =>
          !selectedIds.has(
            venue.id
          )
      )

  function toggleVenue(
    venueId:
      VenueId
  ) {
    if (
      selectedIds.has(
        venueId
      )
    ) {
      onChange(
        value.filter(
          (candidate) =>
            candidate !==
            venueId
        )
      )

      return
    }

    onChange([
      ...value,
      venueId,
    ])
  }

  return (
    <div className="mt-3">
      {selectedVenues.length >
      0 ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/30">
            Selected venues
          </p>

          <div className="mt-2 grid gap-2">
            {selectedVenues.map(
              (venue) => (
                <button
                  key={
                    venue.id
                  }
                  type="button"
                  disabled={
                    disabled
                  }
                  aria-pressed="true"
                  onClick={() =>
                    toggleVenue(
                      venue.id
                    )
                  }
                  className={[
                    'flex',
                    'items-center',
                    'justify-between',
                    'gap-4',
                    'rounded-2xl',
                    'border',
                    'border-violet-300/20',
                    'bg-violet-300/[0.065]',
                    'px-4',
                    'py-3',
                    'text-left',
                    'transition',
                    'disabled:cursor-not-allowed',
                    'disabled:opacity-50',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white/80">
                      {
                        venue.name
                      }
                    </span>

                    {venue.category ||
                    venue.neighborhood ? (
                      <span className="mt-1 block truncate text-[11px] text-white/32">
                        {[
                          venue.category,
                          venue.neighborhood,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ' · '
                          )}
                      </span>
                    ) : null}
                  </span>

                  <span
                    aria-hidden="true"
                    className={[
                      'grid',
                      'h-5',
                      'w-5',
                      'shrink-0',
                      'place-items-center',
                      'rounded-full',
                      'border',
                      'border-violet-300/50',
                      'bg-violet-300',
                      'text-black',
                    ].join(' ')}
                  >
                    ✓
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      ) : null}


      {normalizeVenueSearchText(
        searchQuery
      ) ? (
        <div
          className={
            selectedVenues.length >
              0
              ? 'mt-4'
              : undefined
          }
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/30">
            Search results
          </p>

          {matchingVenues.length >
          0 ? (
            <div className="mt-2 grid gap-2">
              {matchingVenues.map(
                (venue) => (
                  <button
                    key={
                      venue.id
                    }
                    type="button"
                    disabled={
                      disabled
                    }
                    aria-pressed="false"
                    onClick={() =>
                      toggleVenue(
                        venue.id
                      )
                    }
                    className={[
                      'flex',
                      'items-center',
                      'justify-between',
                      'gap-4',
                      'rounded-2xl',
                      'border',
                      'border-white/[0.08]',
                      'bg-black/10',
                      'px-4',
                      'py-3',
                      'text-left',
                      'transition',
                      'hover:border-white/[0.13]',
                      'disabled:cursor-not-allowed',
                      'disabled:opacity-50',
                    ].join(' ')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white/80">
                        {
                          venue.name
                        }
                      </span>

                      {venue.category ||
                      venue.neighborhood ? (
                        <span className="mt-1 block truncate text-[11px] text-white/32">
                          {[
                            venue.category,
                            venue.neighborhood,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              ' · '
                            )}
                        </span>
                      ) : null}
                    </span>

                    <span
                      aria-hidden="true"
                      className={[
                        'grid',
                        'h-5',
                        'w-5',
                        'shrink-0',
                        'place-items-center',
                        'rounded-full',
                        'border',
                        'border-white/18',
                      ].join(' ')}
                    />
                  </button>
                )
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-white/30">
              No venues match this search.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-white/30">
          Search by venue name, type, or address to add an eligible
          venue.
        </p>
      )}
    </div>
  )
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelaySlotEditor({
  value,
  onChange,
  venueOptions = [],
  errors = {},
  disabled = false,
  className,
}: RelaySlotEditorProps) {
  const idPrefix =
    useId()

  const [
    venuePoolSearch,
    setVenuePoolSearch,
  ] =
    useState(
      ''
    )

  const [
    exactVenueSearch,
    setExactVenueSearch,
  ] =
    useState(
      ''
    )

  const hasResolvedVenueOptions =
    venueOptions.length >
    0

  const exactVenueName =
    useMemo(
      () =>
        getVenueName(
          value.exactVenueId,
          venueOptions
        ),
      [
        value.exactVenueId,
        venueOptions,
      ]
    )

  const venuePoolNames =
    useMemo(
      () =>
        getVenuePoolNames(
          value.eligibleVenueIds,
          venueOptions
        ),
      [
        value.eligibleVenueIds,
        venueOptions,
      ]
    )

  const exactVenueSearchResults =
    useMemo(
      () =>
        filterVenueOptions(
          venueOptions,
          exactVenueSearch
        ),
      [
        exactVenueSearch,
        venueOptions,
      ]
    )


  function patchValue(
    patch:
      Partial<RelaySlotEditorValue>
  ) {
    onChange({
      ...value,
      ...patch,

      /*
       * Relay v1 invariant.
       */
      requiredGeoVerified:
        true,
    })
  }


  function changeSelectionMode(
    selectionMode:
      RelaySlotSelectionMode
  ) {
    if (
      selectionMode ===
      value.selectionMode
    ) {
      return
    }

/*
     * Clear constraints that do not belong to the new mode.
     *
     * This prevents contradictory stale payload such as:
     *
     *   selectionMode = open
     *   exactVenueId  = ...
     *
     * or:
     *
     *   selectionMode = category
     *   eligibleVenueIds = [...]
     */
    switch (
      selectionMode
    ) {
      case 'open':
        patchValue({
          selectionMode:
            'open',

          categoryConstraint:
            '',

          exactVenueId:
            null,

          eligibleVenueIds:
            [],
        })

        return


      case 'category':
        patchValue({
          selectionMode:
            'category',

          exactVenueId:
            null,

          eligibleVenueIds:
            [],
        })

        return


      case 'venue_pool':
        patchValue({
          selectionMode:
            'venue_pool',

          categoryConstraint:
            '',

          exactVenueId:
            null,
        })

        return


      case 'exact_venue':
        patchValue({
          selectionMode:
            'exact_venue',

          categoryConstraint:
            '',

          eligibleVenueIds:
            [],
        })

        return
    }
  }


  const slotLabel =
    formatRelaySlotNumber(
      value.slotIndex
    )


  return (
    <section
      className={[
        'rounded-3xl',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.025]',
        'p-5',
        'sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-relay-slot-index={
        value.slotIndex
      }
      data-relay-slot-id={
        value.id ??
        undefined
      }
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
            Relay leg
          </p>

          <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white">
            {slotLabel}
          </h3>
        </div>

        <div
          className={[
            'inline-flex',
            'items-center',
            'rounded-full',
            'border',
            'border-emerald-300/12',
            'bg-emerald-300/[0.05]',
            'px-2.5',
            'py-1.5',
            'text-[10px]',
            'font-medium',
            'uppercase',
            'tracking-[0.12em]',
            'text-emerald-100/70',
          ].join(' ')}
          title="Relay v1 requires a verified physical check-in."
        >
          Geo verified
        </div>
      </header>


      {/* ======================================================
       * LABEL + PROMPT
       * ====================================================== */}

      <div className="mt-5 grid gap-5">
        <div>
          <FieldLabel
            htmlFor={`${idPrefix}-label`}
          >
            Leg label
          </FieldLabel>

          <input
            id={`${idPrefix}-label`}
            type="text"
            autoComplete="off"
            maxLength={80}
            disabled={
              disabled
            }
            value={
              value.label
            }
            onChange={(
              event
            ) =>
              patchValue({
                label:
                  event.target
                    .value,
              })
            }
            aria-invalid={
              Boolean(
                errors.label
              )
            }
            aria-describedby={
              errors.label
                ? `${idPrefix}-label-error`
                : undefined
            }
            placeholder="Coffee"
            className={
              inputClassName
            }
          />

          <FieldError
            id={`${idPrefix}-label-error`}
            error={
              errors.label
            }
          />

          {!errors.label ? (
            <FieldHint>
              Short, human-readable role for this leg — for example
              Coffee, Lunch, Cocktails, or Dinner.
            </FieldHint>
          ) : null}
        </div>


        <div>
          <FieldLabel
            htmlFor={`${idPrefix}-prompt`}
            optional
          >
            Prompt
          </FieldLabel>

          <textarea
            id={`${idPrefix}-prompt`}
            rows={3}
            maxLength={500}
            disabled={
              disabled
            }
            value={
              value.prompt
            }
            onChange={(
              event
            ) =>
              patchValue({
                prompt:
                  event.target
                    .value,
              })
            }
            aria-invalid={
              Boolean(
                errors.prompt
              )
            }
            aria-describedby={
              errors.prompt
                ? `${idPrefix}-prompt-error`
                : undefined
            }
            placeholder="Pick the coffee spot that best starts the team's day."
            className={[
              inputClassName,
              'resize-y',
            ].join(' ')}
          />

          <div className="mt-1.5 flex items-start justify-between gap-3">
            <FieldError
              id={`${idPrefix}-prompt-error`}
              error={
                errors.prompt
              }
            />

            <p className="ml-auto shrink-0 text-[10px] tabular-nums text-white/22">
              {
                value.prompt.length
              }
              /500
            </p>
          </div>
        </div>
      </div>


      {/* ======================================================
       * SELECTION MODE
       * ====================================================== */}

      <div className="mt-7 border-t border-white/[0.06] pt-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/42">
            Venue rule
          </p>

          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/30">
            Define how the teammate may choose the venue for this
            Relay leg.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SELECTION_MODES.map(
            (option) => (
              <SelectionModeOption
                key={
                  option.mode
                }
                mode={
                  option.mode
                }
                title={
                  option.title
                }
                description={
                  option.description
                }
                selected={
                  value.selectionMode ===
                  option.mode
                }
                disabled={
                  disabled
                }
                onSelect={
                  changeSelectionMode
                }
              />
            )
          )}
        </div>
      </div>


      {/* ======================================================
       * OPEN
       * ====================================================== */}

      {value.selectionMode ===
      'open' ? (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-4">
          <p className="text-sm font-medium text-white/68">
            Open venue choice
          </p>

          <p className="mt-1.5 text-xs leading-relaxed text-white/34">
            The assigned teammate may choose any venue accepted by
            the canonical Relay execution rules.
          </p>
        </div>
      ) : null}


      {/* ======================================================
       * CATEGORY
       * ====================================================== */}

      {value.selectionMode ===
      'category' ? (
        <div className="mt-5">
          <FieldLabel
            htmlFor={`${idPrefix}-category`}
          >
            Required category
          </FieldLabel>

          <input
            id={`${idPrefix}-category`}
            type="text"
            autoComplete="off"
            maxLength={120}
            disabled={
              disabled
            }
            value={
              value.categoryConstraint
            }
            onChange={(
              event
            ) =>
              patchValue({
                categoryConstraint:
                  event.target
                    .value,
              })
            }
            aria-invalid={
              Boolean(
                errors.categoryConstraint
              )
            }
            aria-describedby={
              errors.categoryConstraint
                ? `${idPrefix}-category-error`
                : `${idPrefix}-category-hint`
            }
            placeholder="Coffee"
            className={
              inputClassName
            }
          />

          <FieldError
            id={`${idPrefix}-category-error`}
            error={
              errors.categoryConstraint
            }
          />

          {!errors.categoryConstraint ? (
            <div
              id={`${idPrefix}-category-hint`}
            >
              <FieldHint>
                This value must match the category vocabulary
                expected by the canonical Relay venue-validation
                function.
              </FieldHint>
            </div>
          ) : null}
        </div>
      ) : null}


      {/* ======================================================
       * VENUE POOL
       * ====================================================== */}

      {value.selectionMode ===
      'venue_pool' ? (
        <div className="mt-5">
          <FieldLabel
            htmlFor={`${idPrefix}-venue-pool`}
          >
            Eligible venues
          </FieldLabel>

          {hasResolvedVenueOptions ? (
            <>
              <input
                id={`${idPrefix}-venue-pool`}
                type="search"
                autoComplete="off"
                disabled={
                  disabled
                }
                value={
                  venuePoolSearch
                }
                onChange={(
                  event
                ) =>
                  setVenuePoolSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search venues by name, type, or address"
                className={
                  inputClassName
                }
              />

              <VenuePoolOptionList
                value={
                  value.eligibleVenueIds
                }
                venueOptions={
                  venueOptions
                }
                searchQuery={
                  venuePoolSearch
                }
                disabled={
                  disabled
                }
                onChange={(
                  eligibleVenueIds
                ) =>
                  patchValue({
                    eligibleVenueIds,
                  })
                }
              />
            </>
          ) : (
            <>
              <textarea
                id={`${idPrefix}-venue-pool`}
                rows={5}
                disabled={
                  disabled
                }
                value={
                  serializeVenueIdList(
                    value.eligibleVenueIds
                  )
                }
                onChange={(
                  event
                ) =>
                  patchValue({
                    eligibleVenueIds:
                      normalizeVenueIdList(
                        event.target
                          .value
                      ),
                  })
                }
                aria-invalid={
                  Boolean(
                    errors.eligibleVenueIds
                  )
                }
                aria-describedby={
                  errors.eligibleVenueIds
                    ? `${idPrefix}-venue-pool-error`
                    : `${idPrefix}-venue-pool-hint`
                }
                placeholder={'venue-id-1\nvenue-id-2\nvenue-id-3'}
                className={[
                  inputClassName,
                  'resize-y',
                  'font-mono',
                  'text-xs',
                ].join(' ')}
              />

              {!errors.eligibleVenueIds ? (
                <div
                  id={`${idPrefix}-venue-pool-hint`}
                >
                  <FieldHint>
                    Enter one canonical venue ID per line. A richer
                    venue selector can be supplied through
                    venueOptions without changing this component's
                    data contract.
                  </FieldHint>
                </div>
              ) : null}
            </>
          )}

          <FieldError
            id={`${idPrefix}-venue-pool-error`}
            error={
              errors.eligibleVenueIds
            }
          />

          {value.eligibleVenueIds
            .length > 0 ? (
            <div className="mt-3 rounded-2xl border border-violet-300/10 bg-violet-300/[0.035] px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-violet-100/48">
                Pool
              </p>

              <p className="mt-1.5 text-sm font-medium text-violet-50/72">
                {
                  value
                    .eligibleVenueIds
                    .length
                }{' '}
                {value
                  .eligibleVenueIds
                  .length ===
                1
                  ? 'venue'
                  : 'venues'}
              </p>

              {venuePoolNames.length >
              0 ? (
                <p className="mt-1.5 text-xs leading-relaxed text-violet-50/38">
                  {venuePoolNames.join(
                    ' · '
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}


      {/* ======================================================
       * EXACT VENUE
       * ====================================================== */}

      {value.selectionMode ===
      'exact_venue' ? (
        <div className="mt-5">
          <FieldLabel
            htmlFor={`${idPrefix}-exact-venue`}
          >
            Required venue
          </FieldLabel>

          {hasResolvedVenueOptions ? (
            <>
              <input
                id={`${idPrefix}-exact-venue`}
                type="search"
                autoComplete="off"
                disabled={
                  disabled
                }
                value={
                  exactVenueSearch
                }
                onChange={(
                  event
                ) =>
                  setExactVenueSearch(
                    event.target
                      .value
                  )
                }
                aria-invalid={
                  Boolean(
                    errors.exactVenueId
                  )
                }
                aria-describedby={
                  errors.exactVenueId
                    ? `${idPrefix}-exact-venue-error`
                    : undefined
                }
                placeholder="Search venues by name, type, or address"
                className={
                  inputClassName
                }
              />

              {normalizeVenueSearchText(
                exactVenueSearch
              ) ? (
                <div className="mt-3">
                  {exactVenueSearchResults.length >
                  0 ? (
                    <div className="grid gap-2">
                      {exactVenueSearchResults.map(
                        (venue) => {
                          const selected =
                            venue.id ===
                            value.exactVenueId

                          return (
                            <button
                              key={
                                venue.id
                              }
                              type="button"
                              disabled={
                                disabled
                              }
                              aria-pressed={
                                selected
                              }
                              onClick={() => {
                                patchValue({
                                  exactVenueId:
                                    venue.id,
                                })

                                setExactVenueSearch(
                                  ''
                                )
                              }}
                              className={[
                                'flex',
                                'items-center',
                                'justify-between',
                                'gap-4',
                                'rounded-2xl',
                                'border',
                                'px-4',
                                'py-3',
                                'text-left',
                                'transition',
                                selected
                                  ? [
                                      'border-amber-300/20',
                                      'bg-amber-300/[0.065]',
                                    ].join(' ')
                                  : [
                                      'border-white/[0.08]',
                                      'bg-black/10',
                                      'hover:border-white/[0.13]',
                                    ].join(' '),
                                'disabled:cursor-not-allowed',
                                'disabled:opacity-50',
                              ].join(' ')}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-white/80">
                                  {
                                    venue.name
                                  }
                                </span>

                                {venue.category ||
                                venue.neighborhood ? (
                                  <span className="mt-1 block truncate text-[11px] text-white/32">
                                    {[
                                      venue.category,
                                      venue.neighborhood,
                                    ]
                                      .filter(
                                        Boolean
                                      )
                                      .join(
                                        ' · '
                                      )}
                                  </span>
                                ) : null}
                              </span>

                              <span
                                aria-hidden="true"
                                className={[
                                  'grid',
                                  'h-5',
                                  'w-5',
                                  'shrink-0',
                                  'place-items-center',
                                  'rounded-full',
                                  'border',
                                  selected
                                    ? [
                                        'border-amber-300/50',
                                        'bg-amber-300',
                                        'text-black',
                                      ].join(' ')
                                    : 'border-white/18',
                                ].join(' ')}
                              >
                                {selected
                                  ? '✓'
                                  : ''}
                              </span>
                            </button>
                          )
                        }
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-white/30">
                      No venues match this search.
                    </p>
                  )}
                </div>
              ) : (
                <FieldHint>
                  Search by venue name, type, or address to choose the
                  required venue.
                </FieldHint>
              )}
            </>
          ) : (
            <input
              id={`${idPrefix}-exact-venue`}
              type="text"
              autoComplete="off"
              disabled={
                disabled
              }
              value={
                value.exactVenueId ??
                ''
              }
              onChange={(
                event
              ) =>
                patchValue({
                  exactVenueId:
                    normalizeVenueId(
                      event.target
                        .value
                    ),
                })
              }
              aria-invalid={
                Boolean(
                  errors.exactVenueId
                )
              }
              aria-describedby={
                errors.exactVenueId
                  ? `${idPrefix}-exact-venue-error`
                  : `${idPrefix}-exact-venue-hint`
              }
              placeholder="Canonical venue ID"
              className={[
                inputClassName,
                'font-mono',
                'text-xs',
              ].join(' ')}
            />
          )}

          <FieldError
            id={`${idPrefix}-exact-venue-error`}
            error={
              errors.exactVenueId
            }
          />

          {!errors.exactVenueId &&
          !hasResolvedVenueOptions ? (
            <div
              id={`${idPrefix}-exact-venue-hint`}
            >
              <FieldHint>
                Enter the canonical venue ID. Do not use a venue
                name as execution identity.
              </FieldHint>
            </div>
          ) : null}

          {value.exactVenueId ? (
            <div className="mt-3 rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-100/48">
                Required stop
              </p>

              <p className="mt-1.5 truncate text-sm font-medium text-amber-50/72">
                {exactVenueName ??
                  value.exactVenueId}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}


      {/* ======================================================
       * EXECUTION INVARIANT
       * ====================================================== */}

      <div className="mt-7 border-t border-white/[0.06] pt-5">
        <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] px-4 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-emerald-100/48">
            Execution integrity
          </p>

          <p className="mt-2 text-xs leading-relaxed text-emerald-50/42">
            This Relay leg requires canonical geo-verified physical
            execution through Active Flow. The authoring UI cannot
            disable that requirement in Relay v1.
          </p>
        </div>
      </div>
    </section>
  )
}


export default RelaySlotEditor