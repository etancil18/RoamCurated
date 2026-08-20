'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'

import {
  useRouter,
} from 'next/navigation'


export type RelayActiveLegSelectionMode =
  | 'open'
  | 'category'
  | 'venue_pool'
  | 'exact_venue'


export type RelayActiveLegVenueOption = {
  id:
    string

  name:
    string

  city?:
    string | null

  address?:
    string | null

  category?:
    string | null
}


export type RelayActiveLegStartResult = {
  sessionId:
    string
}


type RelayActiveLegLauncherProps = {
  teamSlotId:
    string

  slotIndex:
    number

  slotLabel:
    string

  selectionMode:
    RelayActiveLegSelectionMode

  categoryConstraint?:
    string | null

  exactVenueId?:
    string | null

  eligibleVenueIds?:
    string[]

  selectedVenueId?:
    string | null

  venues?:
    RelayActiveLegVenueOption[]

  viewerOwnsActiveSlot:
    boolean

  existingFlowSessionId?:
    string | null

  onStart:
    (
      teamSlotId:
        string,
      venueId:
        string
    ) =>
      Promise<
        RelayActiveLegStartResult
      >

  disabled?:
    boolean

  className?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function RelayActiveLegLauncher({
  teamSlotId,
  slotIndex,
  slotLabel,
  selectionMode,
  categoryConstraint =
    null,
  exactVenueId =
    null,
  eligibleVenueIds =
    [],
  selectedVenueId =
    null,
  venues =
    [],
  viewerOwnsActiveSlot,
  existingFlowSessionId =
    null,
  onStart,
  disabled =
    false,
  className =
    '',
}: RelayActiveLegLauncherProps) {
  const router =
    useRouter()


  const [
    isPending,
    startTransition,
  ] =
    useTransition()


  const [
    selectedVenue,
    setSelectedVenue,
  ] =
    useState<string>(
      selectedVenueId ??
      ''
    )


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    )


  const [
    success,
    setSuccess,
  ] =
    useState(
      false
    )


  /* ==========================================================
   * NORMALIZED VENUE STATE
   * ========================================================== */

  const normalizedVenues =
    useMemo(
      () =>
        normalizeVenueOptions(
          venues
        ),
      [
        venues,
      ]
    )


  const venueById =
    useMemo(
      () =>
        new Map(
          normalizedVenues.map(
            (
              venue
            ) => [
              venue.id,
              venue,
            ]
          )
        ),
      [
        normalizedVenues,
      ]
    )


  const normalizedEligibleVenueIds =
    useMemo(
      () =>
        uniqueStrings(
          eligibleVenueIds
        ),
      [
        eligibleVenueIds,
      ]
    )


  const selectableVenues =
    useMemo(
      () => {
        if (
          selectionMode ===
          'exact_venue'
        ) {
          if (
            !exactVenueId
          ) {
            return []
          }


          const exactVenue =
            venueById.get(
              exactVenueId
            )


          return exactVenue
            ? [
                exactVenue,
              ]
            : []
        }


        if (
          selectionMode ===
          'venue_pool'
        ) {
          const allowedVenueIds =
            new Set(
              normalizedEligibleVenueIds
            )


          return normalizedVenues.filter(
            (
              venue
            ) =>
              allowedVenueIds.has(
                venue.id
              )
          )
        }


        /*
         * For category and open selection modes, the parent is
         * responsible for supplying only venues that are valid
         * for the canonical Relay slot.
         */
        return normalizedVenues
      },
      [
        exactVenueId,
        normalizedEligibleVenueIds,
        normalizedVenues,
        selectionMode,
        venueById,
      ]
    )


  const selectedVenueOption =
    selectedVenue
      ? venueById.get(
          selectedVenue
        ) ??
        null
      : null


  const resolvedExactVenueId =
    selectionMode ===
      'exact_venue'
      ? exactVenueId
      : null


  const effectiveVenueId =
    resolvedExactVenueId ??
    selectedVenue


  const canChooseVenue =
    selectionMode !==
    'exact_venue'


  const hasSelectableVenue =
    selectableVenues.length >
    0


  const canStart =
    viewerOwnsActiveSlot &&
    !disabled &&
    !isPending &&
    !existingFlowSessionId &&
    Boolean(
      effectiveVenueId
    )


  /* ==========================================================
   * PROP SYNCHRONIZATION
   * ========================================================== */

  useEffect(
    () => {
      setSelectedVenue(
        selectedVenueId ??
        ''
      )

      setError(
        null
      )

      setSuccess(
        false
      )
    },
    [
      selectedVenueId,
      teamSlotId,
    ]
  )


  useEffect(
    () => {
      if (
        selectionMode !==
        'exact_venue'
      ) {
        return
      }


      if (
        exactVenueId
      ) {
        setSelectedVenue(
          exactVenueId
        )
      }
    },
    [
      exactVenueId,
      selectionMode,
    ]
  )


  /* ==========================================================
   * EXECUTION
   * ========================================================== */

  const startActiveLeg =
    useCallback(
      async () => {
        if (
          disabled ||
          isPending
        ) {
          return
        }


        if (
          !viewerOwnsActiveSlot
        ) {
          setError(
            'Only the teammate holding the active Relay baton may start this leg.'
          )

          return
        }


        if (
          existingFlowSessionId
        ) {
          router.push(
            `/flow/${existingFlowSessionId}`
          )

          return
        }


        const venueId =
          effectiveVenueId
            .trim()


        if (
          !venueId
        ) {
          setError(
            'Choose a venue before starting this Relay leg.'
          )

          return
        }


        if (
          selectionMode ===
            'exact_venue' &&
          exactVenueId &&
          venueId !==
            exactVenueId
        ) {
          setError(
            'This Relay leg must use its configured venue.'
          )

          return
        }


        if (
          selectionMode ===
          'venue_pool'
        ) {
          const allowedVenueIds =
            new Set(
              normalizedEligibleVenueIds
            )


          if (
            !allowedVenueIds.has(
              venueId
            )
          ) {
            setError(
              'That venue is not eligible for this Relay leg.'
            )

            return
          }
        }


        setError(
          null
        )

        setSuccess(
          false
        )


        try {
          const result =
            await onStart(
              teamSlotId,
              venueId
            )


          if (
            !result ||
            typeof result.sessionId !==
              'string' ||
            result.sessionId
              .trim()
              .length ===
              0
          ) {
            throw new Error(
              'Relay leg start did not return an Active Flow session.'
            )
          }


          const sessionId =
            result.sessionId.trim()


          setSuccess(
            true
          )


          router.push(
            `/flow/${sessionId}`
          )
        } catch (
          caughtError
        ) {
          console.error(
            '[RelayActiveLegLauncher] Failed to start active Relay leg:',
            caughtError
          )


          setError(
            getErrorMessage(
              caughtError
            )
          )
        }
      },
      [
        disabled,
        effectiveVenueId,
        exactVenueId,
        existingFlowSessionId,
        isPending,
        normalizedEligibleVenueIds,
        onStart,
        router,
        selectionMode,
        teamSlotId,
        viewerOwnsActiveSlot,
      ]
    )


  const handleStart =
    useCallback(
      () => {
        startTransition(
          () => {
            void startActiveLeg()
          }
        )
      },
      [
        startActiveLeg,
      ]
    )


  const handleContinue =
    useCallback(
      () => {
        if (
          !existingFlowSessionId
        ) {
          return
        }


        router.push(
          `/flow/${existingFlowSessionId}`
        )
      },
      [
        existingFlowSessionId,
        router,
      ]
    )


  /* ==========================================================
   * NON-OWNER STATE
   * ========================================================== */

  if (
    !viewerOwnsActiveSlot
  ) {
    return (
      <section
        className={[
          'rounded-[24px]',
          'border',
          'border-white/[0.07]',
          'bg-black/15',
          'p-5',
          className,
        ].join(
          ' '
        )}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.2)]"
          />

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
              Current baton
            </p>

            <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white/82">
              Leg {slotIndex}:{' '}
              {slotLabel}
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/40">
              Another teammate currently owns this Relay leg. Your
              execution controls will unlock when the baton advances to
              you.
            </p>
          </div>
        </div>
      </section>
    )
  }


  /* ==========================================================
   * OWNER STATE
   * ========================================================== */

  return (
    <section
      className={[
        'rounded-[24px]',
        'border',
        'border-emerald-300/14',
        'bg-emerald-300/[0.035]',
        'p-5',
        'sm:p-6',
        className,
      ].join(
        ' '
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/14 bg-emerald-300/[0.055] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-300"
              />

              Your baton
            </span>

            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/26">
              Leg {slotIndex}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-white">
            {slotLabel}
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">
            {getSelectionDescription({
              selectionMode,
              categoryConstraint,
            })}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-300/14 bg-emerald-300/[0.045] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100/60">
          Active
        </span>
      </div>


      {existingFlowSessionId ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/12 bg-black/20 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100/50">
            Active Flow
          </p>

          <p className="mt-2 text-sm leading-6 text-white/48">
            Your execution session already exists for this Relay leg.
          </p>

          <button
            type="button"
            onClick={
              handleContinue
            }
            disabled={
              disabled ||
              isPending
            }
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-300/18 bg-emerald-300/[0.08] px-5 text-xs font-semibold text-emerald-50 transition hover:border-emerald-200/30 hover:bg-emerald-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Continue active leg
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6">
            {selectionMode ===
            'exact_venue' ? (
              <ExactVenueState
                exactVenueId={
                  exactVenueId
                }
                venue={
                  exactVenueId
                    ? venueById.get(
                        exactVenueId
                      ) ??
                      null
                    : null
                }
              />
            ) : (
              <VenueSelector
                selectionMode={
                  selectionMode
                }
                selectedVenueId={
                  selectedVenue
                }
                venues={
                  selectableVenues
                }
                disabled={
                  disabled ||
                  isPending
                }
                onChange={
                  (
                    venueId
                  ) => {
                    setSelectedVenue(
                      venueId
                    )

                    setError(
                      null
                    )

                    setSuccess(
                      false
                    )
                  }
                }
              />
            )}
          </div>


          {canChooseVenue &&
          !hasSelectableVenue ? (
            <div className="mt-4 rounded-2xl border border-amber-300/12 bg-amber-300/[0.035] px-4 py-3">
              <p className="text-xs leading-5 text-amber-100/60">
                No eligible venue options are currently available for
                this Relay leg.
              </p>
            </div>
          ) : null}


          {selectedVenueOption &&
          canChooseVenue ? (
            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/24">
                Selected venue
              </p>

              <p className="mt-1.5 text-sm font-semibold text-white/68">
                {selectedVenueOption.name}
              </p>

              {getVenueSecondaryLabel(
                selectedVenueOption
              ) ? (
                <p className="mt-1 text-xs leading-5 text-white/32">
                  {getVenueSecondaryLabel(
                    selectedVenueOption
                  )}
                </p>
              ) : null}
            </div>
          ) : null}


          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-red-300/14 bg-red-300/[0.04] px-4 py-3"
            >
              <p className="text-xs leading-5 text-red-100/70">
                {error}
              </p>
            </div>
          ) : null}


          {success ? (
            <div
              role="status"
              className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.04] px-4 py-3"
            >
              <p className="text-xs leading-5 text-emerald-100/65">
                Relay leg started. Opening your Active Flow…
              </p>
            </div>
          ) : null}


          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={
                handleStart
              }
              disabled={
                !canStart
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.09] px-5 text-xs font-semibold text-emerald-50 transition hover:border-emerald-200/32 hover:bg-emerald-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d] disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.025] disabled:text-white/22"
            >
              {isPending
                ? 'Starting leg…'
                : 'Start my leg'}
            </button>

            <p className="text-xs leading-5 text-white/28">
              Starting creates your canonical Active Flow for this
              Relay leg.
            </p>
          </div>
        </>
      )}
    </section>
  )
}


/* ============================================================
 * VENUE SELECTOR
 * ============================================================
 */

function VenueSelector({
  selectionMode,
  selectedVenueId,
  venues,
  disabled,
  onChange,
}: {
  selectionMode:
    RelayActiveLegSelectionMode

  selectedVenueId:
    string

  venues:
    RelayActiveLegVenueOption[]

  disabled:
    boolean

  onChange:
    (
      venueId:
        string
    ) =>
      void
}) {
  return (
    <div>
      <label
        htmlFor="relay-active-leg-venue"
        className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28"
      >
        {getVenueSelectorLabel(
          selectionMode
        )}
      </label>

      <div className="relative mt-2">
        <select
          id="relay-active-leg-venue"
          value={
            selectedVenueId
          }
          onChange={
            (
              event
            ) => {
              onChange(
                event.target.value
              )
            }
          }
          disabled={
            disabled ||
            venues.length ===
              0
          }
          className="min-h-12 w-full appearance-none rounded-2xl border border-white/[0.08] bg-[#0b0b0c] px-4 py-3 pr-10 text-sm text-white/75 outline-none transition hover:border-white/[0.13] focus:border-emerald-300/25 focus:ring-2 focus:ring-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <option
            value=""
            disabled
          >
            {venues.length >
            0
              ? 'Choose venue'
              : 'No eligible venues'}
          </option>

          {venues.map(
            (
              venue
            ) => (
              <option
                key={
                  venue.id
                }
                value={
                  venue.id
                }
              >
                {getVenueOptionLabel(
                  venue
                )}
              </option>
            )
          )}
        </select>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/28"
        >
          ▾
        </span>
      </div>
    </div>
  )
}


/* ============================================================
 * EXACT VENUE
 * ============================================================
 */

function ExactVenueState({
  exactVenueId,
  venue,
}: {
  exactVenueId:
    string | null

  venue:
    RelayActiveLegVenueOption | null
}) {
  if (
    !exactVenueId
  ) {
    return (
      <div className="rounded-2xl border border-red-300/14 bg-red-300/[0.04] px-4 py-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-red-100/45">
          Venue configuration
        </p>

        <p className="mt-2 text-xs leading-5 text-red-100/70">
          This Relay leg requires an exact venue, but no canonical venue
          ID is configured.
        </p>
      </div>
    )
  }


  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/24">
        Required venue
      </p>

      <p className="mt-1.5 text-sm font-semibold text-white/70">
        {venue
          ?.name ??
          'Configured Relay venue'}
      </p>

      {venue &&
      getVenueSecondaryLabel(
        venue
      ) ? (
        <p className="mt-1 text-xs leading-5 text-white/32">
          {getVenueSecondaryLabel(
            venue
          )}
        </p>
      ) : null}
    </div>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeVenueOptions(
  venues:
    RelayActiveLegVenueOption[]
): RelayActiveLegVenueOption[] {
  const seen =
    new Set<string>()

  const normalized:
    RelayActiveLegVenueOption[] =
      []


  for (
    const venue of venues
  ) {
    const id =
      typeof venue.id ===
      'string'
        ? venue.id.trim()
        : ''


    const name =
      typeof venue.name ===
      'string'
        ? venue.name.trim()
        : ''


    if (
      !id ||
      !name ||
      seen.has(
        id
      )
    ) {
      continue
    }


    seen.add(
      id
    )


    normalized.push({
      ...venue,

      id,

      name,

      city:
        normalizeOptionalString(
          venue.city
        ),

      address:
        normalizeOptionalString(
          venue.address
        ),

      category:
        normalizeOptionalString(
          venue.category
        ),
    })
  }


  return normalized
}


function uniqueStrings(
  values:
    string[]
): string[] {
  const seen =
    new Set<string>()

  const normalized:
    string[] =
      []


  for (
    const value of values
  ) {
    if (
      typeof value !==
      'string'
    ) {
      continue
    }


    const trimmed =
      value.trim()


    if (
      !trimmed ||
      seen.has(
        trimmed
      )
    ) {
      continue
    }


    seen.add(
      trimmed
    )

    normalized.push(
      trimmed
    )
  }


  return normalized
}


function normalizeOptionalString(
  value:
    string | null | undefined
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }


  const trimmed =
    value.trim()


  return trimmed
    ? trimmed
    : null
}


function getVenueSelectorLabel(
  selectionMode:
    RelayActiveLegSelectionMode
): string {
  switch (
    selectionMode
  ) {
    case 'open':
      return 'Choose venue'

    case 'category':
      return 'Choose matching venue'

    case 'venue_pool':
      return 'Choose eligible venue'

    case 'exact_venue':
      return 'Required venue'
  }
}


function getSelectionDescription({
  selectionMode,
  categoryConstraint,
}: {
  selectionMode:
    RelayActiveLegSelectionMode

  categoryConstraint:
    string | null
}): string {
  switch (
    selectionMode
  ) {
    case 'open':
      return 'Choose a valid venue for this leg, then start your Active Flow.'

    case 'category':
      return categoryConstraint
        ? `Choose an eligible ${categoryConstraint} venue, then start your Active Flow.`
        : 'Choose an eligible venue for this category-based leg, then start your Active Flow.'

    case 'venue_pool':
      return 'Choose one of the Relay-approved venues, then start your Active Flow.'

    case 'exact_venue':
      return 'This leg has a fixed Relay venue. Start your Active Flow when you are ready to execute.'
  }
}


function getVenueOptionLabel(
  venue:
    RelayActiveLegVenueOption
): string {
  const location =
    venue.address ??
    venue.city ??
    null


  return location
    ? `${venue.name} — ${location}`
    : venue.name
}


function getVenueSecondaryLabel(
  venue:
    RelayActiveLegVenueOption
): string | null {
  const parts =
    [
      venue.address,
      venue.city,
    ].filter(
      (
        value
      ): value is string =>
        typeof value ===
          'string' &&
        value.trim().length >
          0
    )


  if (
    parts.length ===
    0
  ) {
    return null
  }


  return Array.from(
    new Set(
      parts
    )
  ).join(
    ' · '
  )
}


function getErrorMessage(
  error:
    unknown
): string {
  if (
    error instanceof
    Error &&
    error.message
      .trim()
      .length >
      0
  ) {
    return error.message
  }


  return 'Unable to start this Relay leg right now.'
}