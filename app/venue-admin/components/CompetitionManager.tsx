'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  COMPETITION_MAX_ENTRIES,
  COMPETITION_MIN_ENTRIES,
  COMPETITION_STATUS,
  COMPETITION_TYPE,
  DEFAULT_COMPETITION_ANONYMOUS_ENTRIES,
  DEFAULT_COMPETITION_MAX_ENTRIES,
  DEFAULT_COMPETITION_XP_REWARD,
  type CompetitionStatus,
} from '@/lib/competitions/constants'

import type {
  Competition,
  CompetitionType,
  UUID,
} from '@/lib/competitions/types'


// ============================================================
// TYPES
// ============================================================

type CompetitionManagerMode =
  | 'create'
  | 'configure'

type CompetitionFormState = {
  title: string
  category: string
  city: string

  maxEntries: 2 | 3 | 4

  startsAt: string
  endsAt: string

  xpReward: string

  anonymousEntries: boolean
}

type CompetitionListResponse = {
  competitions: Competition[]
}

type CompetitionResponse = {
  competition: Competition
}

type CompetitionPatchResponse = {
  competition: Competition
}

export interface CompetitionManagerProps {
  /**
   * Optional competition selected by the parent.
   *
   * When supplied, this component will synchronize its local
   * selection with the prop.
   */
  selectedCompetitionId?: UUID | null

  /**
   * Notifies the parent whenever the selected competition changes.
   */
  onCompetitionChange?: (
    competition: Competition | null,
  ) => void

  /**
   * Notifies the parent after creation.
   */
  onCompetitionCreated?: (
    competition: Competition,
  ) => void

  /**
   * Notifies the parent after a successful configuration/lifecycle
   * update.
   */
  onCompetitionUpdated?: (
    competition: Competition,
  ) => void

  /**
   * Allows a parent admin surface to trigger downstream refreshes
   * without coupling this component to submissions/entries.
   */
  onRefreshRequested?: () => void
}


// ============================================================
// DEFAULTS
// ============================================================

const EMPTY_FORM: CompetitionFormState = {
  title: '',
  category: '',
  city: '',

  maxEntries:
    DEFAULT_COMPETITION_MAX_ENTRIES,

  startsAt: '',
  endsAt: '',

  xpReward:
    String(
      DEFAULT_COMPETITION_XP_REWARD,
    ),

  anonymousEntries:
    DEFAULT_COMPETITION_ANONYMOUS_ENTRIES,
}


// ============================================================
// COMPONENT
// ============================================================

export default function CompetitionManager({
  selectedCompetitionId: controlledCompetitionId,
  onCompetitionChange,
  onCompetitionCreated,
  onCompetitionUpdated,
  onRefreshRequested,
}: CompetitionManagerProps) {
  const [
    competitions,
    setCompetitions,
  ] = useState<Competition[]>([])

  const [
    selectedCompetitionId,
    setSelectedCompetitionId,
  ] = useState<string>(
    controlledCompetitionId ?? '',
  )

  const [
    mode,
    setMode,
  ] = useState<CompetitionManagerMode>(
    'create',
  )

  const [
    form,
    setForm,
  ] = useState<CompetitionFormState>(
    EMPTY_FORM,
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    actionKey,
    setActionKey,
  ] = useState<string | null>(
    null,
  )

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
  // DERIVED STATE
  // ==========================================================

  const selectedCompetition =
    useMemo(
      () =>
        competitions.find(
          (competition) =>
            competition.id
            === selectedCompetitionId,
        ) ?? null,
      [
        competitions,
        selectedCompetitionId,
      ],
    )


  const configurationLocked =
    selectedCompetition
      ? (
          selectedCompetition.status
          === COMPETITION_STATUS.COMPLETED
          ||
          selectedCompetition.status
          === COMPETITION_STATUS.CANCELLED
        )
      : false


  // ==========================================================
  // REQUEST HELPER
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
  // LOAD COMPETITIONS
  // ==========================================================

  const loadCompetitions =
    useCallback(
      async (
        preferredCompetitionId?: string | null,
      ) => {
        setLoading(true)
        setError(null)

        try {
          const data =
            await request<CompetitionListResponse>(
              '/api/venue-admin/competitions',
            )

          const rows =
            data.competitions ?? []

          setCompetitions(
            rows,
          )


          const preferredId =
            preferredCompetitionId
            ?? controlledCompetitionId
            ?? selectedCompetitionId


          const nextId =
            preferredId
            && rows.some(
              (competition) =>
                competition.id
                === preferredId,
            )
              ? preferredId
              : rows[0]?.id
                ?? ''


          setSelectedCompetitionId(
            nextId,
          )


          const nextCompetition =
            rows.find(
              (competition) =>
                competition.id
                === nextId,
            )
            ?? null


          onCompetitionChange?.(
            nextCompetition,
          )
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError,
            ),
          )
        } finally {
          setLoading(false)
        }
      },
      [
        controlledCompetitionId,
        onCompetitionChange,
        request,
        selectedCompetitionId,
      ],
    )


  useEffect(
    () => {
      void loadCompetitions()
      // Deliberately initial-load only.
    },
    [],
  )


  // ==========================================================
  // CONTROLLED SELECTION SYNC
  // ==========================================================

  useEffect(
    () => {
      if (
        controlledCompetitionId
        === undefined
      ) {
        return
      }

      setSelectedCompetitionId(
        controlledCompetitionId
        ?? '',
      )
    },
    [
      controlledCompetitionId,
    ],
  )


  // ==========================================================
  // HYDRATE CONFIGURATION FORM
  // ==========================================================

  useEffect(
    () => {
      if (
        mode !== 'configure'
        || !selectedCompetition
      ) {
        return
      }

      setForm(
        competitionToForm(
          selectedCompetition,
        ),
      )
    },
    [
      mode,
      selectedCompetition,
    ],
  )


  // ==========================================================
  // SELECTION
  // ==========================================================

  function handleCompetitionSelection(
    competitionId: string,
  ) {
    setSelectedCompetitionId(
      competitionId,
    )

    const competition =
      competitions.find(
        (candidate) =>
          candidate.id
          === competitionId,
      )
      ?? null

    onCompetitionChange?.(
      competition,
    )

    if (
      competition
      && mode
        === 'configure'
    ) {
      setForm(
        competitionToForm(
          competition,
        ),
      )
    }

    setError(null)
    setNotice(null)
  }


  // ==========================================================
  // CREATE
  // ==========================================================

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError(null)
    setNotice(null)

    const validated =
      validateCompetitionForm(
        form,
      )

    if (!validated.ok) {
      setError(
        validated.error,
      )

      return
    }


    setSaving(true)

    try {
      const data =
        await request<CompetitionResponse>(
          '/api/venue-admin/competitions',
          {
            method: 'POST',

            body:
              JSON.stringify({
                competition_type:
                  COMPETITION_TYPE.TASTE_DUEL,

                title:
                  validated.value.title,

                category:
                  validated.value.category,

                city:
                  validated.value.city,

                max_entries:
                  validated.value.maxEntries,

                starts_at:
                  validated.value.startsAt,

                ends_at:
                  validated.value.endsAt,

                xp_reward:
                  validated.value.xpReward,

                anonymous_entries:
                  validated.value
                    .anonymousEntries,
              }),
          },
        )


      setNotice(
        'Competition created.',
      )

      setForm(
        EMPTY_FORM,
      )

      setMode(
        'configure',
      )


      onCompetitionCreated?.(
        data.competition,
      )

      onCompetitionUpdated?.(
        data.competition,
      )

      await loadCompetitions(
        data.competition.id,
      )

      onRefreshRequested?.()
    } catch (createError) {
      setError(
        getErrorMessage(
          createError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }


  // ==========================================================
  // UPDATE CONFIG
  // ==========================================================

  async function handleSaveConfiguration(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !selectedCompetition
    ) {
      setError(
        'Select a competition first.',
      )

      return
    }


    if (
      configurationLocked
    ) {
      setError(
        'Completed or cancelled competitions cannot be reconfigured.',
      )

      return
    }


    setError(null)
    setNotice(null)


    const validated =
      validateCompetitionForm(
        form,
      )

    if (!validated.ok) {
      setError(
        validated.error,
      )

      return
    }


    setSaving(true)

    try {
      const data =
        await request<CompetitionPatchResponse>(
          `/api/venue-admin/competitions/${encodeURIComponent(
            selectedCompetition.id,
          )}`,
          {
            method: 'PATCH',

            body:
              JSON.stringify({
                title:
                  validated.value.title,

                category:
                  validated.value.category,

                city:
                  validated.value.city,

                max_entries:
                  validated.value.maxEntries,

                starts_at:
                  validated.value.startsAt,

                ends_at:
                  validated.value.endsAt,

                xp_reward:
                  validated.value.xpReward,

                anonymous_entries:
                  validated.value
                    .anonymousEntries,
              }),
          },
        )


      replaceCompetition(
        data.competition,
      )

      setNotice(
        'Competition configuration saved.',
      )

      onCompetitionUpdated?.(
        data.competition,
      )

      onCompetitionChange?.(
        data.competition,
      )

      onRefreshRequested?.()
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(false)
    }
  }


  // ==========================================================
  // STATUS TRANSITIONS
  // ==========================================================

  async function transitionStatus(
    status: Extract<
      CompetitionStatus,
      | 'scheduled'
      | 'live'
      | 'scoring'
      | 'cancelled'
    >,
  ) {
    if (
      !selectedCompetition
    ) {
      return
    }


    const action =
      `status:${status}`

    setActionKey(
      action,
    )

    setError(null)
    setNotice(null)


    try {
      const data =
        await request<CompetitionPatchResponse>(
          `/api/venue-admin/competitions/${encodeURIComponent(
            selectedCompetition.id,
          )}`,
          {
            method: 'PATCH',

            body:
              JSON.stringify({
                status,
              }),
          },
        )


      replaceCompetition(
        data.competition,
      )

      setNotice(
        `Competition moved to ${humanizeStatus(
          status,
        )}.`,
      )

      onCompetitionUpdated?.(
        data.competition,
      )

      onCompetitionChange?.(
        data.competition,
      )

      onRefreshRequested?.()
    } catch (transitionError) {
      setError(
        getErrorMessage(
          transitionError,
        ),
      )
    } finally {
      setActionKey(
        null,
      )
    }
  }


  // ==========================================================
  // LOCAL REPLACEMENT
  // ==========================================================

  function replaceCompetition(
    competition: Competition,
  ) {
    setCompetitions(
      (current) =>
        current.map(
          (candidate) =>
            candidate.id
              === competition.id
              ? competition
              : candidate,
        ),
    )
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              Competitions
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Competition manager
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Create and configure Taste Duels before submissions,
              scoring, and settlement move through their dedicated
              workflows.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadCompetitions()
            }
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
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


      <div className="flex gap-2">
        <ModeButton
          active={
            mode === 'create'
          }
          onClick={() => {
            setMode(
              'create',
            )

            setForm(
              EMPTY_FORM,
            )

            setError(null)
            setNotice(null)
          }}
        >
          Create
        </ModeButton>

        <ModeButton
          active={
            mode === 'configure'
          }
          disabled={
            competitions.length === 0
          }
          onClick={() => {
            setMode(
              'configure',
            )

            if (
              selectedCompetition
            ) {
              setForm(
                competitionToForm(
                  selectedCompetition,
                ),
              )
            }

            setError(null)
            setNotice(null)
          }}
        >
          Configure
        </ModeButton>
      </div>


      {mode === 'create' ? (
        <CompetitionForm
          mode="create"
          form={form}
          setForm={setForm}
          disabled={saving}
          submitLabel={
            saving
              ? 'Creating…'
              : 'Create competition'
          }
          onSubmit={
            handleCreate
          }
        />
      ) : (
        <div className="space-y-5">
          <CompetitionSelector
            competitions={
              competitions
            }
            selectedCompetitionId={
              selectedCompetitionId
            }
            loading={loading}
            onChange={
              handleCompetitionSelection
            }
          />


          {selectedCompetition ? (
            <>
              <CompetitionSummary
                competition={
                  selectedCompetition
                }
              />


              <CompetitionForm
                mode="configure"
                form={form}
                setForm={setForm}
                disabled={
                  saving
                  || configurationLocked
                }
                submitLabel={
                  saving
                    ? 'Saving…'
                    : 'Save configuration'
                }
                onSubmit={
                  handleSaveConfiguration
                }
              />


              <CompetitionLifecycleControls
                competition={
                  selectedCompetition
                }
                actionKey={
                  actionKey
                }
                onTransition={
                  transitionStatus
                }
              />
            </>
          ) : (
            <EmptyState>
              No competition selected.
            </EmptyState>
          )}
        </div>
      )}
    </section>
  )
}


// ============================================================
// FORM
// ============================================================

function CompetitionForm({
  mode,
  form,
  setForm,
  disabled,
  submitLabel,
  onSubmit,
}: {
  mode:
    | 'create'
    | 'configure'

  form: CompetitionFormState

  setForm:
    React.Dispatch<
      React.SetStateAction<CompetitionFormState>
    >

  disabled: boolean

  submitLabel: string

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6"
    >
      <div>
        <h3 className="font-semibold text-white">
          {mode === 'create'
            ? 'New Taste Duel'
            : 'Competition configuration'}
        </h3>

        <p className="mt-1 text-sm leading-5 text-neutral-500">
          {mode === 'create'
            ? 'New competitions are created as drafts.'
            : 'Configuration is locked once a competition is completed or cancelled.'}
        </p>
      </div>


      <AdminField
        label="Title"
        required
      >
        <input
          value={form.title}
          onChange={(event) =>
            setForm(
              (current) => ({
                ...current,
                title:
                  event.target.value,
              }),
            )
          }
          maxLength={160}
          placeholder="Best late-night crawl"
          required
          disabled={disabled}
          className={
            ADMIN_INPUT_CLASS
          }
        />
      </AdminField>


      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Category"
          required
        >
          <input
            value={form.category}
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,
                  category:
                    event.target.value,
                }),
              )
            }
            placeholder="Nightlife"
            required
            disabled={disabled}
            className={
              ADMIN_INPUT_CLASS
            }
          />
        </AdminField>


        <AdminField
          label="City"
          required
        >
          <input
            value={form.city}
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,
                  city:
                    event.target.value,
                }),
              )
            }
            placeholder="New York"
            required
            disabled={disabled}
            className={
              ADMIN_INPUT_CLASS
            }
          />
        </AdminField>
      </div>


      <AdminField
        label="Competitors"
        description="Choose the maximum official contender count."
      >
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              2,
              3,
              4,
            ] as const
          ).map(
            (count) => {
              const selected =
                form.maxEntries
                === count

              return (
                <button
                  key={count}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setForm(
                      (current) => ({
                        ...current,
                        maxEntries:
                          count,
                      }),
                    )
                  }
                  className={[
                    'min-h-11 rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',

                    selected
                      ? 'border-white bg-white text-black'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
                  ].join(' ')}
                >
                  {count}
                </button>
              )
            },
          )}
        </div>
      </AdminField>


      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Starts"
          required
        >
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,
                  startsAt:
                    event.target.value,
                }),
              )
            }
            required
            disabled={disabled}
            className={
              ADMIN_INPUT_CLASS
            }
          />
        </AdminField>


        <AdminField
          label="Ends"
          required
        >
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,
                  endsAt:
                    event.target.value,
                }),
              )
            }
            required
            disabled={disabled}
            className={
              ADMIN_INPUT_CLASS
            }
          />
        </AdminField>
      </div>


      <AdminField
        label="Winner XP reward"
        description="Passport XP awarded to the winner after successful settlement."
      >
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={form.xpReward}
          onChange={(event) =>
            setForm(
              (current) => ({
                ...current,
                xpReward:
                  event.target.value,
              }),
            )
          }
          disabled={disabled}
          className={
            ADMIN_INPUT_CLASS
          }
        />
      </AdminField>


      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <input
          type="checkbox"
          checked={
            form.anonymousEntries
          }
          disabled={disabled}
          onChange={(event) =>
            setForm(
              (current) => ({
                ...current,
                anonymousEntries:
                  event.target
                    .checked,
              }),
            )
          }
          className="mt-0.5 h-4 w-4 accent-white disabled:cursor-not-allowed"
        />

        <span>
          <span className="block text-sm font-medium text-white">
            Anonymous competitors
          </span>

          <span className="mt-1 block text-xs leading-5 text-neutral-500">
            Keep creator identity out of live public contender
            surfaces until the competition is settled.
          </span>
        </span>
      </label>


      <button
        type="submit"
        disabled={disabled}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  )
}


// ============================================================
// SELECTOR
// ============================================================

function CompetitionSelector({
  competitions,
  selectedCompetitionId,
  loading,
  onChange,
}: {
  competitions:
    Competition[]

  selectedCompetitionId:
    string

  loading:
    boolean

  onChange:
    (
      competitionId: string,
    ) => void
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <AdminField
        label="Competition"
      >
        <select
          value={
            selectedCompetitionId
          }
          disabled={
            loading
            || competitions.length === 0
          }
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={
            ADMIN_INPUT_CLASS
          }
        >
          {competitions.length
            === 0 && (
            <option value="">
              No competitions yet
            </option>
          )}

          {competitions.map(
            (competition) => (
              <option
                key={
                  competition.id
                }
                value={
                  competition.id
                }
              >
                {competition.title}
                {' · '}
                {humanizeStatus(
                  competition.status,
                )}
              </option>
            ),
          )}
        </select>
      </AdminField>
    </div>
  )
}


// ============================================================
// SUMMARY
// ============================================================

function CompetitionSummary({
  competition,
}: {
  competition: Competition
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="flex flex-wrap gap-2">
        <StatusChip>
          {humanizeStatus(
            competition.status,
          )}
        </StatusChip>

        <StatusChip>
          {
            competition.max_entries
          }{' '}
          competitors
        </StatusChip>

        {competition.anonymous_entries && (
          <StatusChip>
            Anonymous
          </StatusChip>
        )}
      </div>


      <h3 className="mt-4 text-lg font-semibold text-white">
        {competition.title}
      </h3>


      <p className="mt-1 text-sm text-neutral-400">
        {[
          competition.category,
          competition.city,
        ]
          .filter(Boolean)
          .join(' · ')
          || 'No category or city'}
      </p>


      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Starts"
          value={
            formatDate(
              competition.starts_at,
            )
          }
        />

        <Metric
          label="Ends"
          value={
            formatDate(
              competition.ends_at,
            )
          }
        />

        <Metric
          label="XP"
          value={
            String(
              competition.xp_reward,
            )
          }
        />

        <Metric
          label="Result"
          value={
            humanizeStatus(
              competition.result_status,
            )
          }
        />
      </dl>
    </div>
  )
}


// ============================================================
// LIFECYCLE CONTROLS
// ============================================================

function CompetitionLifecycleControls({
  competition,
  actionKey,
  onTransition,
}: {
  competition:
    Competition

  actionKey:
    string | null

  onTransition: (
    status: Extract<
      CompetitionStatus,
      | 'scheduled'
      | 'live'
      | 'scoring'
      | 'cancelled'
    >,
  ) => Promise<void>
}) {
  const busy =
    actionKey !== null

  const canSchedule =
    competition.status
    === COMPETITION_STATUS.DRAFT

  const canGoLive =
    competition.status
      === COMPETITION_STATUS.DRAFT
    ||
    competition.status
      === COMPETITION_STATUS.SCHEDULED

  const canBeginScoring =
    competition.status
    === COMPETITION_STATUS.LIVE

  const canCancel =
  competition.status !== COMPETITION_STATUS.COMPLETED
  &&
  competition.status !== COMPETITION_STATUS.CANCELLED


  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div>
        <h3 className="font-semibold text-white">
          Lifecycle
        </h3>

        <p className="mt-1 text-sm leading-5 text-neutral-500">
          Settlement is intentionally handled separately after
          final scoring evidence exists.
        </p>
      </div>


      <div className="flex flex-wrap gap-2">
        {canSchedule && (
          <LifecycleButton
            disabled={busy}
            busy={
              actionKey
              === 'status:scheduled'
            }
            onClick={() =>
              void onTransition(
                'scheduled',
              )
            }
          >
            Schedule
          </LifecycleButton>
        )}


        {canGoLive && (
          <LifecycleButton
            disabled={busy}
            busy={
              actionKey
              === 'status:live'
            }
            emphasis
            onClick={() =>
              void onTransition(
                'live',
              )
            }
          >
            Go live
          </LifecycleButton>
        )}


        {canBeginScoring && (
          <LifecycleButton
            disabled={busy}
            busy={
              actionKey
              === 'status:scoring'
            }
            emphasis
            onClick={() =>
              void onTransition(
                'scoring',
              )
            }
          >
            Close submissions / score
          </LifecycleButton>
        )}


        {canCancel && (
          <LifecycleButton
            disabled={busy}
            busy={
              actionKey
              === 'status:cancelled'
            }
            danger
            onClick={() => {
              const confirmed =
                window.confirm(
                  'Cancel this competition?',
                )

              if (confirmed) {
                void onTransition(
                  'cancelled',
                )
              }
            }}
          >
            Cancel
          </LifecycleButton>
        )}


        {!canSchedule
          && !canGoLive
          && !canBeginScoring
          && !canCancel && (
          <p className="text-sm text-neutral-500">
            No lifecycle actions available.
          </p>
        )}
      </div>
    </div>
  )
}


// ============================================================
// PRIMITIVES
// ============================================================

const ADMIN_INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50'


function AdminField({
  label,
  description,
  required = false,
  children,
}: {
  label: string
  description?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
        {label}

        {required && (
          <span className="text-neutral-700">
            *
          </span>
        )}
      </span>

      {description && (
        <span className="block text-xs leading-5 text-neutral-600">
          {description}
        </span>
      )}

      {children}
    </label>
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


function ModeButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'min-h-10 rounded-lg border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40',

        active
          ? 'border-white bg-white text-black'
          : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}


function LifecycleButton({
  disabled,
  busy,
  emphasis = false,
  danger = false,
  onClick,
  children,
}: {
  disabled: boolean
  busy: boolean
  emphasis?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  let color =
    'border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'

  if (emphasis) {
    color =
      'border-white bg-white text-black hover:bg-neutral-200'
  }

  if (danger) {
    color =
      'border-red-900 bg-red-950/40 text-red-300 hover:bg-red-950/70'
  }


  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',

        color,
      ].join(' ')}
    >
      {busy
        ? 'Working…'
        : children}
    </button>
  )
}


function StatusChip({
  children,
}: {
  children: ReactNode
}) {
  return (
    <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300">
      {children}
    </span>
  )
}


function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-600">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-medium text-neutral-200">
        {value}
      </dd>
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
// VALIDATION
// ============================================================

type ValidCompetitionForm = {
  title: string
  category: string
  city: string

  maxEntries: 2 | 3 | 4

  startsAt: string
  endsAt: string

  xpReward: number

  anonymousEntries: boolean
}


type CompetitionFormValidation =
  | {
      ok: true
      value: ValidCompetitionForm
    }
  | {
      ok: false
      error: string
    }


function validateCompetitionForm(
  form: CompetitionFormState,
): CompetitionFormValidation {
  const title =
    form.title.trim()

  const category =
    form.category.trim()

  const city =
    form.city.trim()


  if (!title) {
    return {
      ok: false,
      error:
        'Competition title is required.',
    }
  }


  if (!category) {
    return {
      ok: false,
      error:
        'Competition category is required.',
    }
  }


  if (!city) {
    return {
      ok: false,
      error:
        'Competition city is required.',
    }
  }


  if (
    !Number.isSafeInteger(
      form.maxEntries,
    )
    ||
    form.maxEntries
      < COMPETITION_MIN_ENTRIES
    ||
    form.maxEntries
      > COMPETITION_MAX_ENTRIES
  ) {
    return {
      ok: false,
      error:
        'Competition must allow 2, 3, or 4 competitors.',
    }
  }


  if (
    !form.startsAt
    || !form.endsAt
  ) {
    return {
      ok: false,
      error:
        'Start and end dates are required.',
    }
  }


  const startsAtDate =
    new Date(
      form.startsAt,
    )

  const endsAtDate =
    new Date(
      form.endsAt,
    )


  if (
    Number.isNaN(
      startsAtDate.getTime(),
    )
    ||
    Number.isNaN(
      endsAtDate.getTime(),
    )
  ) {
    return {
      ok: false,
      error:
        'Competition dates are invalid.',
    }
  }


  if (
    endsAtDate.getTime()
    <= startsAtDate.getTime()
  ) {
    return {
      ok: false,
      error:
        'Competition end date must be after the start date.',
    }
  }


  const xpReward =
    Number(
      form.xpReward,
    )


  if (
    !Number.isSafeInteger(
      xpReward,
    )
    ||
    xpReward < 0
  ) {
    return {
      ok: false,
      error:
        'XP reward must be a non-negative whole number.',
    }
  }


  return {
    ok: true,

    value: {
      title,
      category,
      city,

      maxEntries:
        form.maxEntries,

      startsAt:
        startsAtDate
          .toISOString(),

      endsAt:
        endsAtDate
          .toISOString(),

      xpReward,

      anonymousEntries:
        form.anonymousEntries,
    },
  }
}


// ============================================================
// MAPPING
// ============================================================

function competitionToForm(
  competition: Competition,
): CompetitionFormState {
  return {
    title:
      competition.title,

    category:
      competition.category
      ?? '',

    city:
      competition.city
      ?? '',

    maxEntries:
      normalizeMaxEntries(
        competition.max_entries,
      ),

    startsAt:
      toDateTimeLocalValue(
        competition.starts_at,
      ),

    endsAt:
      toDateTimeLocalValue(
        competition.ends_at,
      ),

    xpReward:
      String(
        competition.xp_reward,
      ),

    anonymousEntries:
      competition.anonymous_entries,
  }
}


function normalizeMaxEntries(
  value: number,
): 2 | 3 | 4 {
  if (value === 3) {
    return 3
  }

  if (value === 4) {
    return 4
  }

  return 2
}


// ============================================================
// DATE HELPERS
// ============================================================

function toDateTimeLocalValue(
  value: string | null,
): string {
  if (!value) {
    return ''
  }


  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }


  const local =
    new Date(
      date.getTime()
      - date.getTimezoneOffset()
        * 60_000,
    )


  return local
    .toISOString()
    .slice(
      0,
      16,
    )
}


function formatDate(
  value: string | null,
): string {
  if (!value) {
    return '—'
  }


  const date =
    new Date(value)

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


// ============================================================
// TEXT HELPERS
// ============================================================

function humanizeStatus(
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
// COMPILE-TIME CONTRACT ASSERTIONS
// ============================================================

/**
 * These aliases intentionally remain referenced here so accidental
 * divergence between the central competition contracts and this
 * manager is surfaced by TypeScript during development.
 */
type _CompetitionManagerCompetitionType =
  CompetitionType

type _CompetitionManagerUuid =
  UUID

void (
  null as
    | _CompetitionManagerCompetitionType
    | _CompetitionManagerUuid
    | null
)