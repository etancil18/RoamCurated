'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  COMPETITION_ENTRY_STATUS,
  COMPETITION_MAX_ENTRIES,
  COMPETITION_MIN_ENTRIES,
} from '@/lib/competitions/constants'

import type {
  Competition,
  CompetitionEntry,
  CompetitionSubmission,
  UUID,
} from '@/lib/competitions/types'


// ============================================================
// TYPES
// ============================================================

export interface CompetitionEntrySelectorProps {
  competitionId: UUID

  /**
   * Optional competition supplied by parent to avoid an extra
   * lookup when the admin detail page already has it.
   */
  competition?: Competition | null

  /**
   * Optional externally supplied entries.
   *
   * If omitted, the component loads the roster itself.
   */
  entries?: CompetitionEntry[]

  /**
   * Optional externally supplied approved submissions.
   *
   * If omitted, the component loads eligible submissions itself.
   *
   * ITINERARY MODE ONLY.
   */
  approvedSubmissions?: CompetitionSubmission[]

  /**
   * Called after an itinerary submission is promoted successfully.
   *
   * Venue-participation entries have no canonical submission, so
   * that mode updates local entry state and uses
   * onRefreshRequested instead.
   */
  onEntryCreated?: (
    entry: CompetitionEntry,
    submission: CompetitionSubmission,
  ) => void

  /**
   * Allows parent admin surfaces to refresh adjacent panels.
   */
  onRefreshRequested?: () => void
}


type CompetitionDetailResponse = {
  competition: Competition
  entries: CompetitionEntry[]
}


type SubmissionQueueResponse = {
  submissions: CompetitionSubmission[]
}


type PromoteSubmissionResponse = {
  entry: CompetitionEntry
  submission?: CompetitionSubmission
}


type CreateVenueParticipationEntryResponse = {
  entry: CompetitionEntry
}


type VenueSearchResult = {
  id: string
  name: string
  city: string | null
}


type VenueSearchResponse = {
  venues: VenueSearchResult[]
}


// ============================================================
// CONSTANTS
// ============================================================

const SLOT_VALUES = [
  1,
  2,
  3,
  4,
] as const

type ContenderSlot =
  (typeof SLOT_VALUES)[number]


const VENUE_SEARCH_MINIMUM_LENGTH =
  2


const VENUE_SEARCH_LIMIT =
  20


const VENUE_SEARCH_DEBOUNCE_MS =
  250


// ============================================================
// COMPONENT
// ============================================================

export default function CompetitionEntrySelector({
  competitionId,
  competition: suppliedCompetition,
  entries: suppliedEntries,
  approvedSubmissions: suppliedApprovedSubmissions,
  onEntryCreated,
  onRefreshRequested,
}: CompetitionEntrySelectorProps) {
  const [
    competition,
    setCompetition,
  ] = useState<Competition | null>(
    suppliedCompetition ?? null,
  )

  const [
    entries,
    setEntries,
  ] = useState<CompetitionEntry[]>(
    suppliedEntries ?? [],
  )

  const [
    submissions,
    setSubmissions,
  ] = useState<CompetitionSubmission[]>(
    suppliedApprovedSubmissions ?? [],
  )

  const [
    selectedSubmissionId,
    setSelectedSubmissionId,
  ] = useState<string>('')

  const [
    selectedSlot,
    setSelectedSlot,
  ] = useState<ContenderSlot | ''>('')

  const [
    selectedVenues,
    setSelectedVenues,
  ] = useState<VenueSearchResult[]>(
    [],
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    promoting,
    setPromoting,
  ] = useState(false)

  const [
    creatingVenueEntry,
    setCreatingVenueEntry,
  ] = useState(false)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  )


  // ==========================================================
  // REQUEST
  // ==========================================================

  const request = useCallback(
    async function request<T>(
      url: string,
      init?: RequestInit,
    ): Promise<T> {
      const response =
        await fetch(
          url,
          {
            ...init,

            headers: {
              'Content-Type':
                'application/json',

              ...init?.headers,
            },

            cache: 'no-store',
          },
        )

      const payload =
        await response
          .json()
          .catch(
            () => null,
          ) as
            | T
            | {
                error?: string
                message?: string
              }
            | null


      if (!response.ok) {
        let message =
          `Request failed with status ${response.status}.`

        if (
          payload
          && typeof payload === 'object'
        ) {
          if (
            'error' in payload
            && typeof payload.error
              === 'string'
          ) {
            message =
              payload.error
          } else if (
            'message' in payload
            && typeof payload.message
              === 'string'
          ) {
            message =
              payload.message
          }
        }

        throw new Error(
          message,
        )
      }


      return payload as T
    },
    [],
  )


  // ==========================================================
  // EXTERNAL PROP SYNC
  // ==========================================================

  useEffect(
    () => {
      if (
        suppliedCompetition
        !== undefined
      ) {
        setCompetition(
          suppliedCompetition
          ?? null,
        )
      }
    },
    [
      suppliedCompetition,
    ],
  )


  useEffect(
    () => {
      if (
        suppliedEntries
        !== undefined
      ) {
        setEntries(
          suppliedEntries,
        )
      }
    },
    [
      suppliedEntries,
    ],
  )


  useEffect(
    () => {
      if (
        suppliedApprovedSubmissions
        !== undefined
      ) {
        setSubmissions(
          suppliedApprovedSubmissions,
        )
      }
    },
    [
      suppliedApprovedSubmissions,
    ],
  )


  // ==========================================================
  // LOAD
  // ==========================================================

  const loadData =
    useCallback(
      async (
        mode:
          | 'initial'
          | 'refresh'
          = 'initial',
      ) => {
        if (!competitionId) {
          return
        }


        if (mode === 'initial') {
          setLoading(true)
        } else {
          setRefreshing(true)
        }

        setError(null)


        try {
          const shouldLoadDetail =
            suppliedCompetition
              === undefined
            || suppliedEntries
              === undefined


          const detailResponse =
            shouldLoadDetail
              ? await request<CompetitionDetailResponse>(
                  `/api/venue-admin/competitions/${encodeURIComponent(
                    competitionId,
                  )}`,
                )
              : null


          const resolvedCompetition =
            suppliedCompetition
            ?? detailResponse
              ?.competition
            ?? null


          if (detailResponse) {
            setCompetition(
              detailResponse.competition,
            )

            setEntries(
              detailResponse.entries
              ?? [],
            )
          }


          /**
           * Submission infrastructure belongs exclusively to
           * itinerary Taste Duels.
           *
           * Venue-participation contenders are curated directly
           * and must not load or depend on approved submissions.
           */
          if (
            resolvedCompetition
              ?.taste_duel_execution_mode
            === 'venue_participation'
          ) {
            setSubmissions(
              [],
            )

            setSelectedSubmissionId(
              '',
            )
          }


          const shouldLoadSubmissions =
            suppliedApprovedSubmissions
              === undefined
            &&
            resolvedCompetition
              ?.taste_duel_execution_mode
              === 'itinerary'


          const submissionsResponse =
            shouldLoadSubmissions
              ? await request<SubmissionQueueResponse>(
                  `/api/venue-admin/competitions/submissions?competitionId=${encodeURIComponent(
                    competitionId,
                  )}&status=approved&limit=100&offset=0`,
                )
              : null


          if (submissionsResponse) {
            setSubmissions(
              submissionsResponse.submissions
              ?? [],
            )
          }
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError,
            ),
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [
        competitionId,
        request,
        suppliedApprovedSubmissions,
        suppliedCompetition,
        suppliedEntries,
      ],
    )


  useEffect(
    () => {
      void loadData(
        'initial',
      )
    },
    [
      loadData,
    ],
  )


  // ==========================================================
  // EXECUTION MODE
  // ==========================================================

  const isVenueParticipationMode =
    competition
      ?.competition_type
      === 'taste_duel'
    &&
    competition
      .taste_duel_execution_mode
      === 'venue_participation'


  // ==========================================================
  // DERIVED ROSTER STATE
  // ==========================================================

  const activeEntries =
    useMemo(
      () =>
        entries.filter(
          (entry) =>
            entry.status
              === COMPETITION_ENTRY_STATUS.APPROVED
            ||
            entry.status
              === COMPETITION_ENTRY_STATUS.PENDING,
        ),
      [
        entries,
      ],
    )


  const activeEntryBySlot =
    useMemo(
      () =>
        new Map<
          ContenderSlot,
          CompetitionEntry
        >(
          activeEntries.map(
            (entry) => [
              entry.contender_slot,
              entry,
            ],
          ),
        ),
      [
        activeEntries,
      ],
    )


  const reservedVenueIds =
    useMemo(
      () =>
        new Set(
          activeEntries.flatMap(
            (entry) =>
              entry.venue_ids,
          ),
        ),
      [
        activeEntries,
      ],
    )


  const maxEntries =
    normalizeMaxEntries(
      competition?.max_entries
      ?? COMPETITION_MIN_ENTRIES,
    )


  const competitionSlots =
    useMemo(
      () =>
        SLOT_VALUES.filter(
          (slot) =>
            slot
            <= maxEntries,
        ),
      [
        maxEntries,
      ],
    )


  const availableSlots =
    useMemo(
      () =>
        competitionSlots.filter(
          (slot) =>
            !activeEntryBySlot.has(
              slot,
            ),
        ),
      [
        activeEntryBySlot,
        competitionSlots,
      ],
    )


  const promotedSubmissionIds =
    useMemo(
      () =>
        new Set(
          submissions
            .filter(
              (submission) =>
                submission.competition_entry_id
                !== null,
            )
            .map(
              (submission) =>
                submission.id,
            ),
        ),
      [
        submissions,
      ],
    )


  const eligibleSubmissions =
    useMemo(
      () =>
        isVenueParticipationMode
          ? []
          : submissions.filter(
              (submission) =>
                submission.status
                  === 'approved'
              &&
              submission.competition_entry_id
                === null
              &&
              !promotedSubmissionIds.has(
                submission.id,
              ),
            ),
      [
        isVenueParticipationMode,
        promotedSubmissionIds,
        submissions,
      ],
    )


  const selectedSubmission =
    useMemo(
      () =>
        eligibleSubmissions.find(
          (submission) =>
            submission.id
            === selectedSubmissionId,
        )
        ?? null,
      [
        eligibleSubmissions,
        selectedSubmissionId,
      ],
    )


  const selectedVenueIds =
    useMemo(
      () =>
        selectedVenues.map(
          (venue) =>
            venue.id,
        ),
      [
        selectedVenues,
      ],
    )


  const rosterFull =
    activeEntries.length
    >= maxEntries


  const configurationLocked =
    competition
      ? [
          'completed',
          'cancelled',
        ].includes(
          competition.status,
        )
      : false


  // ==========================================================
  // DEFAULT SELECTION
  // ==========================================================

  useEffect(
    () => {
      if (
        isVenueParticipationMode
      ) {
        if (
          selectedSubmissionId
        ) {
          setSelectedSubmissionId(
            '',
          )
        }

        return
      }


      if (
        selectedSubmissionId
        &&
        eligibleSubmissions.some(
          (submission) =>
            submission.id
            === selectedSubmissionId,
        )
      ) {
        return
      }

      setSelectedSubmissionId(
        eligibleSubmissions[0]?.id
        ?? '',
      )
    },
    [
      eligibleSubmissions,
      isVenueParticipationMode,
      selectedSubmissionId,
    ],
  )


  useEffect(
    () => {
      if (
        selectedSlot
        &&
        availableSlots.includes(
          selectedSlot,
        )
      ) {
        return
      }

      setSelectedSlot(
        availableSlots[0]
        ?? '',
      )
    },
    [
      availableSlots,
      selectedSlot,
    ],
  )


  // ==========================================================
  // ITINERARY PROMOTION
  // ==========================================================

  async function promoteSelectedSubmission() {
    if (!competition) {
      setError(
        'Competition could not be loaded.',
      )

      return
    }


    if (
      isVenueParticipationMode
    ) {
      setError(
        'Venue-participation contenders are curated directly and cannot be created from submissions.',
      )

      return
    }


    if (
      configurationLocked
    ) {
      setError(
        'Completed or cancelled competitions cannot accept new entries.',
      )

      return
    }


    if (
      rosterFull
    ) {
      setError(
        'All contender slots are already filled.',
      )

      return
    }


    if (!selectedSubmission) {
      setError(
        'Select an approved submission first.',
      )

      return
    }


    if (!selectedSlot) {
      setError(
        'Select an available contender slot.',
      )

      return
    }


    if (
      !availableSlots.includes(
        selectedSlot,
      )
    ) {
      setError(
        'That contender slot is no longer available.',
      )

      return
    }


    setPromoting(true)
    setError(null)
    setNotice(null)


    try {
      const data =
        await request<PromoteSubmissionResponse>(
          `/api/venue-admin/competitions/${encodeURIComponent(
            competitionId,
          )}/entries`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                submission_id:
                  selectedSubmission.id,

                contender_slot:
                  selectedSlot,
              }),
          },
        )


      const updatedSubmission =
        data.submission
        ?? {
          ...selectedSubmission,
          competition_entry_id:
            data.entry.id,
        }


      setEntries(
        (current) => {
          const exists =
            current.some(
              (entry) =>
                entry.id
                === data.entry.id,
            )

          if (exists) {
            return current.map(
              (entry) =>
                entry.id
                  === data.entry.id
                  ? data.entry
                  : entry,
            )
          }

          return [
            ...current,
            data.entry,
          ]
        },
      )


      setSubmissions(
        (current) =>
          current.map(
            (submission) =>
              submission.id
                === updatedSubmission.id
                ? updatedSubmission
                : submission,
          ),
      )


      setNotice(
        `Submission promoted to Contender ${contenderSlotLabel(
          data.entry.contender_slot,
        )}.`,
      )


      onEntryCreated?.(
        data.entry,
        updatedSubmission,
      )

      onRefreshRequested?.()
    } catch (promoteError) {
      setError(
        getErrorMessage(
          promoteError,
        ),
      )
    } finally {
      setPromoting(false)
    }
  }


  // ==========================================================
  // VENUE-PARTICIPATION ENTRY CREATION
  // ==========================================================

  async function createVenueParticipationEntry() {
    if (!competition) {
      setError(
        'Competition could not be loaded.',
      )

      return
    }


    if (
      !isVenueParticipationMode
    ) {
      setError(
        'Curated venue entries are available only for venue-participation Taste Duels.',
      )

      return
    }


    if (
      configurationLocked
    ) {
      setError(
        'Completed or cancelled competitions cannot accept new entries.',
      )

      return
    }


    if (
      rosterFull
    ) {
      setError(
        'All contender slots are already filled.',
      )

      return
    }


    if (!selectedSlot) {
      setError(
        'Select an available contender slot.',
      )

      return
    }


    if (
      !availableSlots.includes(
        selectedSlot,
      )
    ) {
      setError(
        'That contender slot is no longer available.',
      )

      return
    }


    if (
      selectedVenueIds.length ===
      0
    ) {
      setError(
        'Select at least one venue.',
      )

      return
    }


    if (
      hasDuplicateValues(
        selectedVenueIds,
      )
    ) {
      setError(
        'A venue may appear only once within a contender.',
      )

      return
    }


    if (
      selectedVenueIds.some(
        (venueId) =>
          reservedVenueIds.has(
            venueId,
          ),
      )
    ) {
      setError(
        'One or more selected venues are already assigned to another active contender.',
      )

      return
    }


    setCreatingVenueEntry(true)
    setError(null)
    setNotice(null)


    try {
      const data =
        await request<CreateVenueParticipationEntryResponse>(
          `/api/venue-admin/competitions/${encodeURIComponent(
            competitionId,
          )}/entries`,
          {
            method: 'POST',

            body:
              JSON.stringify({
                contender_slot:
                  selectedSlot,

                venue_ids:
                  selectedVenueIds,
              }),
          },
        )


      setEntries(
        (current) => {
          const exists =
            current.some(
              (entry) =>
                entry.id
                === data.entry.id,
            )

          if (exists) {
            return current.map(
              (entry) =>
                entry.id
                  === data.entry.id
                  ? data.entry
                  : entry,
            )
          }

          return [
            ...current,
            data.entry,
          ]
        },
      )


      setSelectedVenues(
        [],
      )


      setNotice(
        `Curated venues assigned to Contender ${contenderSlotLabel(
          data.entry.contender_slot,
        )}.`,
      )


      onRefreshRequested?.()
    } catch (createError) {
      setError(
        getErrorMessage(
          createError,
        ),
      )
    } finally {
      setCreatingVenueEntry(false)
    }
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Entries
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Final duel entries
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              {isVenueParticipationMode
                ? 'Build each contender from curated venues. Venue-participation sides are not owned by a user and are not promoted from route submissions.'
                : 'Promote approved user submissions into the competition\u2019s official 2\u20134 contender roster.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadData(
                'refresh',
              )
            }
            disabled={
              loading
              || refreshing
            }
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing
              ? 'Refreshing…'
              : 'Refresh'}
          </button>
        </div>
      </header>


      {(error || notice) && (
        <AdminMessage
          error={error}
          notice={notice}
        />
      )}


      {loading ? (
        <LoadingState />
      ) : !competition ? (
        <EmptyState>
          Competition could not be loaded.
        </EmptyState>
      ) : (
        <>
          <CompetitionRoster
            competition={competition}
            slots={competitionSlots}
            entriesBySlot={activeEntryBySlot}
          />


          {isVenueParticipationMode ? (
            <VenueParticipationEntryCreator
              competition={competition}
              slots={competitionSlots}
              entriesBySlot={activeEntryBySlot}
              activeEntryCount={
                activeEntries.length
              }
              maxEntries={
                maxEntries
              }
              rosterFull={
                rosterFull
              }
              configurationLocked={
                configurationLocked
              }
              selectedSlot={
                selectedSlot
              }
              setSelectedSlot={
                setSelectedSlot
              }
              selectedVenues={
                selectedVenues
              }
              setSelectedVenues={
                setSelectedVenues
              }
              reservedVenueIds={
                reservedVenueIds
              }
              creating={
                creatingVenueEntry
              }
              onCreate={() =>
                void createVenueParticipationEntry()
              }
            />
          ) : (
            <ItineraryEntryPromoter
              competition={competition}
              slots={competitionSlots}
              entriesBySlot={activeEntryBySlot}
              activeEntryCount={
                activeEntries.length
              }
              maxEntries={
                maxEntries
              }
              rosterFull={
                rosterFull
              }
              configurationLocked={
                configurationLocked
              }
              eligibleSubmissions={
                eligibleSubmissions
              }
              selectedSubmissionId={
                selectedSubmissionId
              }
              setSelectedSubmissionId={
                setSelectedSubmissionId
              }
              selectedSubmission={
                selectedSubmission
              }
              selectedSlot={
                selectedSlot
              }
              setSelectedSlot={
                setSelectedSlot
              }
              promoting={
                promoting
              }
              onPromote={() =>
                void promoteSelectedSubmission()
              }
            />
          )}
        </>
      )}
    </section>
  )
}


// ============================================================
// ITINERARY ENTRY PROMOTION UI
// ============================================================

function ItineraryEntryPromoter({
  competition,
  slots,
  entriesBySlot,
  activeEntryCount,
  maxEntries,
  rosterFull,
  configurationLocked,
  eligibleSubmissions,
  selectedSubmissionId,
  setSelectedSubmissionId,
  selectedSubmission,
  selectedSlot,
  setSelectedSlot,
  promoting,
  onPromote,
}: {
  competition: Competition

  slots: readonly ContenderSlot[]

  entriesBySlot: Map<
    ContenderSlot,
    CompetitionEntry
  >

  activeEntryCount: number

  maxEntries: 2 | 3 | 4

  rosterFull: boolean

  configurationLocked: boolean

  eligibleSubmissions:
    CompetitionSubmission[]

  selectedSubmissionId: string

  setSelectedSubmissionId: (
    value: string,
  ) => void

  selectedSubmission:
    CompetitionSubmission | null

  selectedSlot:
    ContenderSlot | ''

  setSelectedSlot: (
    value: ContenderSlot,
  ) => void

  promoting: boolean

  onPromote: () => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">
            Promote approved submission
          </h3>

          <p className="mt-1 text-sm leading-5 text-neutral-500">
            Approval confirms route eligibility. Promotion assigns one
            of the final contender slots.
          </p>
        </div>

        <div className="text-xs text-neutral-500">
          {activeEntryCount}/{maxEntries} filled
        </div>
      </div>


      {configurationLocked ? (
        <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-500">
          This competition is {humanize(competition.status)} and its
          contender roster is locked.
        </div>
      ) : rosterFull ? (
        <div className="mt-5 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          All {maxEntries} contender slots are filled.
        </div>
      ) : eligibleSubmissions.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-600">
          No approved, unassigned submissions are currently available.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <AdminField
            label="Approved submission"
          >
            <select
              value={
                selectedSubmissionId
              }
              onChange={(event) =>
                setSelectedSubmissionId(
                  event.target.value,
                )
              }
              disabled={promoting}
              className={
                ADMIN_INPUT_CLASS
              }
            >
              {eligibleSubmissions.map(
                (submission) => (
                  <option
                    key={
                      submission.id
                    }
                    value={
                      submission.id
                    }
                  >
                    {submissionLabel(
                      submission,
                    )}
                  </option>
                ),
              )}
            </select>
          </AdminField>


          {selectedSubmission && (
            <SubmissionPreview
              submission={
                selectedSubmission
              }
            />
          )}


          <ContenderSlotPicker
            slots={
              slots
            }
            entriesBySlot={
              entriesBySlot
            }
            selectedSlot={
              selectedSlot
            }
            disabled={
              promoting
            }
            onSelect={
              setSelectedSlot
            }
          />


          <button
            type="button"
            onClick={
              onPromote
            }
            disabled={
              promoting
              || !selectedSubmission
              || !selectedSlot
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {promoting
              ? 'Promoting…'
              : `Make Contender ${
                  selectedSlot
                    ? contenderSlotLabel(
                        selectedSlot,
                      )
                    : ''
                }`}
          </button>
        </div>
      )}
    </div>
  )
}


// ============================================================
// VENUE-PARTICIPATION ENTRY CREATION UI
// ============================================================

function VenueParticipationEntryCreator({
  competition,
  slots,
  entriesBySlot,
  activeEntryCount,
  maxEntries,
  rosterFull,
  configurationLocked,
  selectedSlot,
  setSelectedSlot,
  selectedVenues,
  setSelectedVenues,
  reservedVenueIds,
  creating,
  onCreate,
}: {
  competition: Competition

  slots: readonly ContenderSlot[]

  entriesBySlot: Map<
    ContenderSlot,
    CompetitionEntry
  >

  activeEntryCount: number

  maxEntries: 2 | 3 | 4

  rosterFull: boolean

  configurationLocked: boolean

  selectedSlot:
    ContenderSlot | ''

  setSelectedSlot: (
    value: ContenderSlot,
  ) => void

  selectedVenues:
    VenueSearchResult[]

  setSelectedVenues:
    React.Dispatch<
      React.SetStateAction<
        VenueSearchResult[]
      >
    >

  reservedVenueIds:
    ReadonlySet<string>

  creating: boolean

  onCreate: () => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">
            Curate venue contender
          </h3>

          <p className="mt-1 max-w-2xl text-sm leading-5 text-neutral-500">
            Assign one or more venues directly to a contender side.
            This does not create a user-owned route and does not use
            competition submissions.
          </p>
        </div>

        <div className="text-xs text-neutral-500">
          {activeEntryCount}/{maxEntries} filled
        </div>
      </div>


      {configurationLocked ? (
        <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-500">
          This competition is {humanize(competition.status)} and its
          contender roster is locked.
        </div>
      ) : rosterFull ? (
        <div className="mt-5 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          All {maxEntries} contender slots are filled.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <ContenderSlotPicker
            slots={
              slots
            }
            entriesBySlot={
              entriesBySlot
            }
            selectedSlot={
              selectedSlot
            }
            disabled={
              creating
            }
            onSelect={
              setSelectedSlot
            }
          />


          <VenueSearchPicker
            selectedVenues={
              selectedVenues
            }
            setSelectedVenues={
              setSelectedVenues
            }
            reservedVenueIds={
              reservedVenueIds
            }
            disabled={
              creating
            }
          />


          {selectedVenues.length >
          0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
                  Curated venues
                </p>

                <span className="text-xs text-neutral-600">
                  {selectedVenues.length}{' '}
                  {selectedVenues.length ===
                  1
                    ? 'venue'
                    : 'venues'}
                </span>
              </div>


              <div className="mt-3 space-y-2">
                {selectedVenues.map(
                  (
                    venue,
                    index,
                  ) => (
                    <div
                      key={
                        venue.id
                      }
                      className="flex items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-200">
                          {index +
                            1}.{' '}
                          {
                            venue.name
                          }
                        </p>

                        <p className="mt-0.5 truncate text-xs text-neutral-600">
                          {
                            venue.city ??
                            'City unavailable'
                          }
                        </p>
                      </div>


                      <button
                        type="button"
                        disabled={
                          creating
                        }
                        onClick={() =>
                          setSelectedVenues(
                            (current) =>
                              current.filter(
                                (candidate) =>
                                  candidate.id
                                  !== venue.id,
                              ),
                          )
                        }
                        className="shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : null}


          <button
            type="button"
            onClick={
              onCreate
            }
            disabled={
              creating
              || !selectedSlot
              || selectedVenues.length
                === 0
            }
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? 'Creating…'
              : `Create Contender ${
                  selectedSlot
                    ? contenderSlotLabel(
                        selectedSlot,
                      )
                    : ''
                }`}
          </button>
        </div>
      )}
    </div>
  )
}


// ============================================================
// VENUE SEARCH PICKER
// ============================================================

function VenueSearchPicker({
  selectedVenues,
  setSelectedVenues,
  reservedVenueIds,
  disabled,
}: {
  selectedVenues:
    VenueSearchResult[]

  setSelectedVenues:
    React.Dispatch<
      React.SetStateAction<
        VenueSearchResult[]
      >
    >

  reservedVenueIds:
    ReadonlySet<string>

  disabled:
    boolean
}) {
  const [
    query,
    setQuery,
  ] = useState('')

  const [
    results,
    setResults,
  ] = useState<
    VenueSearchResult[]
  >([])

  const [
    searching,
    setSearching,
  ] = useState(false)

  const [
    searchError,
    setSearchError,
  ] = useState<string | null>(
    null,
  )


  const normalizedQuery =
    query.trim()


  const selectedVenueIds =
    useMemo(
      () =>
        new Set(
          selectedVenues.map(
            (venue) =>
              venue.id,
          ),
        ),
      [
        selectedVenues,
      ],
    )


  useEffect(
    () => {
      if (
        normalizedQuery.length <
        VENUE_SEARCH_MINIMUM_LENGTH
      ) {
        setResults(
          [],
        )

        setSearching(
          false,
        )

        setSearchError(
          null,
        )

        return
      }


      const controller =
        new AbortController()


      const timer =
        window.setTimeout(
          async () => {
            setSearching(
              true,
            )

            setSearchError(
              null,
            )


            try {
              const params =
                new URLSearchParams()

              params.set(
                'q',
                normalizedQuery,
              )

              params.set(
                'limit',
                String(
                  VENUE_SEARCH_LIMIT,
                ),
              )


              const response =
                await fetch(
                  `/api/venue-admin/venues/search?${params.toString()}`,
                  {
                    method:
                      'GET',

                    cache:
                      'no-store',

                    signal:
                      controller.signal,
                  },
                )


              const payload =
                await response
                  .json()
                  .catch(
                    () =>
                      null,
                  ) as
                    | VenueSearchResponse
                    | {
                        error?: string
                        message?: string
                      }
                    | null


              if (
                !response.ok
              ) {
                let message =
                  `Venue search failed with status ${response.status}.`


                if (
                  payload
                  &&
                  typeof payload ===
                    'object'
                ) {
                  if (
                    'error' in payload
                    &&
                    typeof payload.error ===
                      'string'
                  ) {
                    message =
                      payload.error
                  } else if (
                    'message' in payload
                    &&
                    typeof payload.message ===
                      'string'
                  ) {
                    message =
                      payload.message
                  }
                }


                throw new Error(
                  message,
                )
              }


              const venues =
                payload
                &&
                typeof payload ===
                  'object'
                &&
                'venues' in payload
                &&
                Array.isArray(
                  payload.venues,
                )
                  ? payload.venues
                      .map(
                        normalizeVenueSearchResult,
                      )
                      .filter(
                        (
                          venue,
                        ): venue is VenueSearchResult =>
                          venue !==
                          null,
                      )
                  : []


              setResults(
                venues,
              )
            } catch (error) {
              if (
                error instanceof
                  DOMException
                &&
                error.name ===
                  'AbortError'
              ) {
                return
              }


              setResults(
                [],
              )

              setSearchError(
                getErrorMessage(
                  error,
                ),
              )
            } finally {
              if (
                !controller
                  .signal
                  .aborted
              ) {
                setSearching(
                  false,
                )
              }
            }
          },
          VENUE_SEARCH_DEBOUNCE_MS,
        )


      return () => {
        window.clearTimeout(
          timer,
        )

        controller.abort()
      }
    },
    [
      normalizedQuery,
    ],
  )


  function selectVenue(
    venue:
      VenueSearchResult,
  ) {
    if (
      reservedVenueIds.has(
        venue.id,
      )
    ) {
      return
    }


    setSelectedVenues(
      (current) => {
        if (
          current.some(
            (candidate) =>
              candidate.id ===
              venue.id,
          )
        ) {
          return current
        }


        return [
          ...current,
          venue,
        ]
      },
    )


    setQuery(
      '',
    )

    setResults(
      [],
    )

    setSearchError(
      null,
    )
  }


  return (
    <div className="space-y-2">
      <label className="block space-y-2">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
          Search venues
        </span>


        <div className="relative">
          <input
            type="search"
            value={
              query
            }
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            disabled={
              disabled
            }
            autoComplete="off"
            placeholder="Search by venue name…"
            className={
              ADMIN_INPUT_CLASS
            }
          />


          {searching ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-600">
              Searching…
            </span>
          ) : null}
        </div>
      </label>


      <p className="text-xs leading-5 text-neutral-600">
        Search the venue catalog by name and add one or more venues
        to this contender. Venues already assigned to another active
        contender cannot be selected.
      </p>


      {searchError ? (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2.5 text-xs text-red-200">
          {searchError}
        </div>
      ) : null}


      {normalizedQuery.length >
        0 &&
      normalizedQuery.length <
        VENUE_SEARCH_MINIMUM_LENGTH ? (
        <p className="text-xs text-neutral-600">
          Type at least{' '}
          {
            VENUE_SEARCH_MINIMUM_LENGTH
          }{' '}
          characters to search.
        </p>
      ) : null}


      {normalizedQuery.length >=
        VENUE_SEARCH_MINIMUM_LENGTH &&
      !searching &&
      !searchError &&
      results.length ===
        0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 px-3 py-4 text-center text-xs text-neutral-600">
          No venues found.
        </div>
      ) : null}


      {results.length >
      0 ? (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          {results.map(
            (
              venue,
              index,
            ) => {
              const reserved =
                reservedVenueIds.has(
                  venue.id,
                )

              const selected =
                selectedVenueIds.has(
                  venue.id,
                )

              const unavailable =
                reserved ||
                selected


              return (
                <button
                  key={
                    venue.id
                  }
                  type="button"
                  disabled={
                    disabled ||
                    unavailable
                  }
                  onClick={() =>
                    selectVenue(
                      venue,
                    )
                  }
                  className={[
                    'flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition disabled:cursor-not-allowed',

                    index >
                    0
                      ? 'border-t border-neutral-800'
                      : '',

                    unavailable
                      ? 'bg-neutral-950/40 opacity-55'
                      : 'hover:bg-neutral-800/80',
                  ].join(
                    ' ',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {
                        venue.name
                      }
                    </p>

                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {
                        venue.city ??
                        'City unavailable'
                      }
                    </p>
                  </div>


                  <span
                    className={[
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',

                      reserved
                        ? 'bg-red-500/10 text-red-300'
                        : selected
                          ? 'bg-violet-500/10 text-violet-200'
                          : 'bg-neutral-800 text-neutral-300',
                    ].join(
                      ' ',
                    )}
                  >
                    {reserved
                      ? 'Already assigned'
                      : selected
                        ? 'Selected'
                        : 'Add'}
                  </span>
                </button>
              )
            },
          )}
        </div>
      ) : null}
    </div>
  )
}


// ============================================================
// CONTENDER SLOT PICKER
// ============================================================

function ContenderSlotPicker({
  slots,
  entriesBySlot,
  selectedSlot,
  disabled,
  onSelect,
}: {
  slots:
    readonly ContenderSlot[]

  entriesBySlot:
    Map<
      ContenderSlot,
      CompetitionEntry
    >

  selectedSlot:
    ContenderSlot | ''

  disabled:
    boolean

  onSelect:
    (
      slot: ContenderSlot,
    ) => void
}) {
  return (
    <AdminField
      label="Contender slot"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {slots.map(
          (slot) => {
            const occupied =
              entriesBySlot.has(
                slot,
              )

            const selected =
              selectedSlot
              === slot

            return (
              <button
                key={slot}
                type="button"
                disabled={
                  occupied
                  || disabled
                }
                onClick={() =>
                  onSelect(
                    slot,
                  )
                }
                className={[
                  'min-h-11 rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed',

                  occupied
                    ? 'border-neutral-900 bg-neutral-950 text-neutral-700'
                    : selected
                      ? 'border-white bg-white text-black'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
                ].join(' ')}
              >
                {occupied
                  ? `${contenderSlotLabel(
                      slot,
                    )} · Filled`
                  : `Contender ${contenderSlotLabel(
                      slot,
                    )}`}
              </button>
            )
          },
        )}
      </div>
    </AdminField>
  )
}


// ============================================================
// ROSTER
// ============================================================

function CompetitionRoster({
  competition,
  slots,
  entriesBySlot,
}: {
  competition: Competition
  slots: readonly ContenderSlot[]
  entriesBySlot: Map<
    ContenderSlot,
    CompetitionEntry
  >
}) {
  const venueParticipationMode =
    competition
      .competition_type
      === 'taste_duel'
    &&
    competition
      .taste_duel_execution_mode
      === 'venue_participation'


  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">
            Official roster
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            {competition.title}
          </p>
        </div>

        <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300">
          Max {competition.max_entries}
        </span>
      </div>


      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map(
          (slot) => {
            const entry =
              entriesBySlot.get(
                slot,
              )

            return (
              <div
                key={slot}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                  Contender{' '}
                  {contenderSlotLabel(
                    slot,
                  )}
                </p>


                {entry ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-white">
                      {entry.venue_ids.length}{' '}
                      {venueParticipationMode
                        ? entry.venue_ids.length ===
                          1
                          ? 'venue'
                          : 'venues'
                        : entry.venue_ids.length ===
                            1
                          ? 'stop'
                          : 'stops'}
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      {venueParticipationMode
                        ? 'Curated venue side'
                        : entry.source_type
                          ? humanize(
                              entry.source_type,
                            )
                          : 'Unknown source'}
                      {' · '}
                      {humanize(
                        entry.status,
                      )}
                    </p>


                    {venueParticipationMode ? (
                      <div className="mt-3 space-y-1.5">
                        {entry.venue_ids.map(
                          (
                            venueId,
                            index,
                          ) => (
                            <p
                              key={`${entry.id}:${venueId}:${index}`}
                              className="break-all font-mono text-[11px] text-neutral-600"
                            >
                              {index +
                                1}.{' '}
                              {venueId}
                            </p>
                          ),
                        )}
                      </div>
                    ) : null}


                    <p className="mt-3 break-all font-mono text-[11px] text-neutral-700">
                      {entry.id}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-neutral-600">
                    Open slot
                  </p>
                )}
              </div>
            )
          },
        )}
      </div>
    </div>
  )
}


// ============================================================
// SUBMISSION PREVIEW
// ============================================================

function SubmissionPreview({
  submission,
}: {
  submission: CompetitionSubmission
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
          Approved
        </span>

        <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400">
          {humanize(
            submission.submission_source,
          )}
        </span>
      </div>


      <h4 className="mt-3 font-medium text-white">
        {submission.route_title?.trim()
          || 'Untitled route'}
      </h4>

      <p className="mt-1 text-sm text-neutral-400">
        {submission.route_city
          || 'Unknown city'}
        {' · '}
        {submission.venue_ids.length}
        {' stops · '}
        {submission.verified_venue_count}
        {' verified'}
      </p>


      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PreviewMetric
          label="Submitted"
          value={
            formatDate(
              submission.submitted_at,
            )
          }
        />

        <PreviewMetric
          label="User"
          value={
            truncateId(
              submission.user_id,
            )
          }
        />

        <PreviewMetric
          label="Source"
          value={
            humanize(
              submission.submission_source,
            )
          }
        />
      </div>


      <div className="mt-4">
        <p className="text-xs text-neutral-600">
          Ordered venue IDs
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {submission.venue_ids.map(
            (
              venueId,
              index,
            ) => (
              <span
                key={`${venueId}:${index}`}
                className="rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-[11px] text-neutral-400"
              >
                {index + 1}.{' '}
                {truncateId(
                  venueId,
                  8,
                )}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  )
}


// ============================================================
// UI PRIMITIVES
// ============================================================

function AdminField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>

      {children}
    </label>
  )
}


function PreviewMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-xs text-neutral-600">
        {label}
      </p>

      <p className="mt-1 text-sm text-neutral-300">
        {value}
      </p>
    </div>
  )
}


function AdminMessage({
  error,
  notice,
}: {
  error: string | null
  notice: string | null
}) {
  const isError =
    Boolean(error)

  return (
    <div
      role={
        isError
          ? 'alert'
          : 'status'
      }
      className={[
        'rounded-xl border px-4 py-3 text-sm',

        isError
          ? 'border-red-900/70 bg-red-950/40 text-red-200'
          : 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200',
      ].join(' ')}
    >
      {error ?? notice}
    </div>
  )
}


function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1].map(
        (index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950"
          />
        ),
      )}
    </div>
  )
}


function EmptyState({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 px-5 py-10 text-center text-sm text-neutral-600">
      {children}
    </div>
  )
}


// ============================================================
// HELPERS
// ============================================================

const ADMIN_INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50'


function normalizeMaxEntries(
  value: number,
): 2 | 3 | 4 {
  if (
    value === 3
  ) {
    return 3
  }

  if (
    value === 4
  ) {
    return 4
  }

  return 2
}


function contenderSlotLabel(
  slot: ContenderSlot,
): 'A' | 'B' | 'C' | 'D' {
  switch (slot) {
    case 1:
      return 'A'

    case 2:
      return 'B'

    case 3:
      return 'C'

    case 4:
      return 'D'
  }
}


function submissionLabel(
  submission: CompetitionSubmission,
): string {
  const title =
    submission.route_title?.trim()
    || 'Untitled route'

  const city =
    submission.route_city?.trim()

  const stopLabel =
    `${submission.venue_ids.length} stops`

  return [
    title,
    city,
    stopLabel,
  ]
    .filter(Boolean)
    .join(' · ')
}


function normalizeVenueSearchResult(
  value: unknown,
): VenueSearchResult | null {
  if (
    !value
    ||
    typeof value !==
      'object'
  ) {
    return null
  }


  const row =
    value as Record<
      string,
      unknown
    >


  if (
    typeof row.id !==
      'string'
    ||
    row.id.trim().length ===
      0
  ) {
    return null
  }


  const name =
    typeof row.name ===
      'string'
      ? row.name.trim()
      : ''


  if (
    !name
  ) {
    return null
  }


  return {
    id:
      row.id,

    name,

    city:
      typeof row.city ===
        'string'
        &&
        row.city.trim()
          .length >
          0
        ? row.city.trim()
        : null,
  }
}


function hasDuplicateValues(
  values: readonly string[],
): boolean {
  return (
    new Set(
      values,
    ).size
    !== values.length
  )
}


function humanize(
  value: string,
): string {
  return value
    .replaceAll(
      '_',
      ' ',
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}


function truncateId(
  value: string,
  visible = 8,
): string {
  if (
    value.length
    <= visible * 2 + 1
  ) {
    return value
  }

  return `${value.slice(
    0,
    visible,
  )}…${value.slice(
    -visible,
  )}`
}


function formatDate(
  value: string | null,
): string {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(
    date,
  )
}


function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
    && error.message.trim()
  ) {
    return error.message
  }

  return 'Something went wrong.'
}


// ============================================================
// INVARIANT REFERENCE
// ============================================================

/**
 * Keep the hard platform ceiling referenced in this component so
 * accidental schema/UI drift is surfaced during maintenance.
 */
void COMPETITION_MAX_ENTRIES