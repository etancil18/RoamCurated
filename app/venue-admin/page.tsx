'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import RecurringEventAdmin from './recurringeventadmin'
import EventsAdmin from './eventsadmin'
import EventJourneysAdmin from './EventJourneysAdmin'
import PropertyGuidesAdmin from './PropertyGuidesAdmin'
import SocialGroupsAdmin from './components/SocialGroupsAdmin'
import CompetitionEntrySelector from './components/CompetitionEntrySelector'
import type { Database } from '@/types/supabase'

export type VenueSummary = Pick<
  Database['public']['Tables']['venues']['Row'],
  'id' | 'name' | 'city'
>

export default function VenueAdminPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')

  const allowedEmails = [
    'evantancil@gmail.com',
    'etancil92@gmail.com',
    'evantancil@roamcurated.com',
    'fyejono@gmail.com',
    'jonathangordon@roamcurated.com',
  ]

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      const emailRaw = data.user?.email ?? null
      const email = emailRaw?.toLowerCase() ?? null

      if (!email || !allowedEmails.includes(email)) {
        router.push('/')
      } else {
        setUserEmail(email)
      }
    }

    checkUser()
  }, [supabase, router])

  if (!userEmail) return null

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-12">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Roam Relay
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Relay management
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Create, configure, and manage collaborative Relay experiences,
              route templates, team structure, and reward policy.
            </p>
          </div>

          <Link
            href="/venue-admin/relay"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            Open Relay admin
          </Link>
        </div>
      </section>

      <SocialGroupsAdmin />

      <PropertyGuidesAdmin />

      <EventsAdmin
        selectedVenue={selectedVenueId}
        onVenueChange={setSelectedVenueId}
      />

      {selectedVenueId && (
        <RecurringEventAdmin venueId={selectedVenueId} />
      )}

      <EventJourneysAdmin />

      <CompetitionsAdmin />
    </div>
  )
}

// ============================================================
// COMPETITIONS ADMIN
// ============================================================

type CompetitionStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'scoring'
  | 'completed'
  | 'cancelled'

type CompetitionResultStatus =
  | 'pending'
  | 'winner'
  | 'tie'
  | 'insufficient_evidence'
  | 'void'

type CompetitionSubmissionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'

type CompetitionSource =
  | 'active_flow'
  | 'visit_history'

type CompetitionEntryStatus =
  | 'pending'
  | 'approved'
  | 'withdrawn'
  | 'disqualified'

type TasteDuelExecutionMode =
  | 'itinerary'
  | 'venue_participation'

type AdminCompetition = {
  id: string
  competition_type: 'taste_duel'
  taste_duel_execution_mode: TasteDuelExecutionMode
  title: string
  description: string | null
  city: string | null
  category: string | null
  status: CompetitionStatus
  starts_at: string | null
  ends_at: string | null
  max_entries: number
  minimum_qualified_participants: number
  minimum_cross_completers: number
  winner_entry_id: string | null
  result_status: CompetitionResultStatus
  xp_reward: number
  anonymous_entries: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

type AdminCompetitionSubmission = {
  id: string
  competition_id: string
  user_id: string
  submission_source: CompetitionSource
  flow_session_id: string | null
  visit_date: string | null
  venue_ids: string[]
  route_title: string | null
  route_city: string | null
  route_started_at: string | null
  route_completed_at: string | null
  verified_venue_count: number
  status: CompetitionSubmissionStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  competition_entry_id: string | null
  submitted_at: string
  created_at: string
  updated_at: string
}

type AdminCompetitionEntry = {
  id: string
  competition_id: string

  /**
   * Itinerary contenders are user-owned.
   *
   * Venue-participation contenders are curated sides and therefore
   * intentionally have no canonical user/source owner.
   */
  user_id: string | null

  contender_slot: 1 | 2 | 3 | 4

  source_type: CompetitionSource | null
  source_flow_session_id: string | null
  source_visit_date: string | null

  venue_ids: string[]

  status: CompetitionEntryStatus

  submitted_at: string
  approved_at: string | null
  withdrawn_at: string | null
  disqualified_at: string | null

  created_at: string
  updated_at: string
}

type CompetitionAdminDetail = {
  competition: AdminCompetition
  submissions: AdminCompetitionSubmission[]
  entries: AdminCompetitionEntry[]
}

type CreateCompetitionForm = {
  title: string
  category: string
  city: string

  executionMode: TasteDuelExecutionMode

  maxEntries: 2 | 3 | 4

  startsAt: string
  endsAt: string

  xpReward: string

  anonymousEntries: boolean
}

const EMPTY_COMPETITION_FORM: CreateCompetitionForm = {
  title: '',
  category: '',
  city: '',

  executionMode:
    'itinerary',

  maxEntries: 2,

  startsAt: '',
  endsAt: '',

  xpReward: '0',

  anonymousEntries: true,
}

function CompetitionsAdmin() {
  const [competitions, setCompetitions] = useState<AdminCompetition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] =
    useState<string>('')

  const [detail, setDetail] =
    useState<CompetitionAdminDetail | null>(null)

  const [form, setForm] =
    useState<CreateCompetitionForm>(EMPTY_COMPETITION_FORM)

  const [loadingCompetitions, setLoadingCompetitions] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [creating, setCreating] = useState(false)
  const [actionKey, setActionKey] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedCompetition = detail?.competition ?? null

  const approvedSubmissions = useMemo(
    () =>
      (detail?.submissions ?? []).filter(
        (submission) => submission.status === 'approved',
      ),
    [detail],
  )

  const activeEntries = useMemo(
    () =>
      (detail?.entries ?? []).filter(
        (entry) =>
          entry.status === 'approved' ||
          entry.status === 'pending',
      ),
    [detail],
  )

  const availableSlots = useMemo(() => {
    if (!selectedCompetition) return []

    const occupied = new Set(
      activeEntries.map((entry) => entry.contender_slot),
    )

    return Array.from(
      { length: selectedCompetition.max_entries },
      (_, index) => (index + 1) as 1 | 2 | 3 | 4,
    ).filter((slot) => !occupied.has(slot))
  }, [activeEntries, selectedCompetition])

  useEffect(() => {
    void loadCompetitions()
  }, [])

  useEffect(() => {
    if (!selectedCompetitionId) {
      setDetail(null)
      return
    }

    void loadCompetitionDetail(selectedCompetitionId)
  }, [selectedCompetitionId])

  async function request<T>(
    url: string,
    init?: RequestInit,
  ): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    })

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string
        }
      | T
      | null

    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : `Request failed with status ${response.status}.`

      throw new Error(message)
    }

    return payload as T
  }

  async function loadCompetitions() {
    setLoadingCompetitions(true)
    setError(null)

    try {
      const data = await request<{
        competitions: AdminCompetition[]
      }>('/api/venue-admin/competitions')

      setCompetitions(data.competitions ?? [])

      setSelectedCompetitionId((current) => {
        if (
          current &&
          data.competitions.some(
            (competition) => competition.id === current,
          )
        ) {
          return current
        }

        return data.competitions[0]?.id ?? ''
      })
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoadingCompetitions(false)
    }
  }

  async function loadCompetitionDetail(
    competitionId: string,
  ) {
    setLoadingDetail(true)
    setError(null)

    try {
      const data =
        await request<CompetitionAdminDetail>(
          `/api/venue-admin/competitions/${encodeURIComponent(
            competitionId,
          )}`,
        )

      setDetail({
        competition: data.competition,
        submissions: data.submissions ?? [],
        entries: data.entries ?? [],
      })
    } catch (loadError) {
      setDetail(null)
      setError(getErrorMessage(loadError))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function createCompetition(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError(null)
    setNotice(null)

    const title = form.title.trim()
    const category = form.category.trim()
    const city = form.city.trim()

    if (!title) {
      setError('Competition title is required.')
      return
    }

    if (!category) {
      setError('Competition category is required.')
      return
    }

    if (!city) {
      setError('Competition city is required.')
      return
    }

    if (!form.startsAt || !form.endsAt) {
      setError('Start and end dates are required.')
      return
    }

    const startsAt = new Date(form.startsAt)
    const endsAt = new Date(form.endsAt)

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      setError('Competition dates are invalid.')
      return
    }

    if (endsAt <= startsAt) {
      setError('Competition end date must be after the start date.')
      return
    }

    const xpReward = Number(form.xpReward)

    if (
      !Number.isSafeInteger(xpReward) ||
      xpReward < 0
    ) {
      setError('XP reward must be a non-negative whole number.')
      return
    }

    setCreating(true)

    try {
      const data = await request<{
        competition: AdminCompetition
      }>('/api/venue-admin/competitions', {
        method: 'POST',
        body: JSON.stringify({
          competition_type:
            'taste_duel',

          taste_duel_execution_mode:
            form.executionMode,

          title,
          category,
          city,

          max_entries:
            form.maxEntries,

          starts_at:
            startsAt.toISOString(),

          ends_at:
            endsAt.toISOString(),

          xp_reward:
            xpReward,

          anonymous_entries:
            form.anonymousEntries,
        }),
      })

      setForm(EMPTY_COMPETITION_FORM)
      setNotice('Competition created.')

      await loadCompetitions()
      setSelectedCompetitionId(data.competition.id)
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setCreating(false)
    }
  }

  async function updateSubmission(
    submission: AdminCompetitionSubmission,
    status: 'approved' | 'rejected',
  ) {
    const action = `${status}:${submission.id}`

    setActionKey(action)
    setError(null)
    setNotice(null)

    try {
      await request(
        `/api/venue-admin/competitions/${encodeURIComponent(
          submission.competition_id,
        )}/submissions/${encodeURIComponent(submission.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
          }),
        },
      )

      setNotice(
        status === 'approved'
          ? 'Submission approved.'
          : 'Submission rejected.',
      )

      await loadCompetitionDetail(
        submission.competition_id,
      )
    } catch (updateError) {
      setError(getErrorMessage(updateError))
    } finally {
      setActionKey(null)
    }
  }

  async function promoteSubmissionToEntry(
    submission: AdminCompetitionSubmission,
    contenderSlot: 1 | 2 | 3 | 4,
  ) {
    /**
     * Submission promotion belongs exclusively to itinerary Taste
     * Duels.
     *
     * Venue-participation contenders are curated directly from
     * venue IDs and must never inherit user/source submission
     * ownership.
     */
    if (
      !selectedCompetition ||
      selectedCompetition.taste_duel_execution_mode !==
        'itinerary'
    ) {
      setError(
        'Submission promotion is only available for itinerary Taste Duels.',
      )
      return
    }

    if (submission.status !== 'approved') {
      setError(
        'Only approved submissions can become competition entries.',
      )
      return
    }

    const action = `promote:${submission.id}`

    setActionKey(action)
    setError(null)
    setNotice(null)

    try {
      await request(
        `/api/venue-admin/competitions/${encodeURIComponent(
          submission.competition_id,
        )}/entries`,
        {
          method: 'POST',
          body: JSON.stringify({
            submission_id: submission.id,
            contender_slot: contenderSlot,
          }),
        },
      )

      setNotice(
        `Submission added as Contender ${contenderSlotLabel(
          contenderSlot,
        )}.`,
      )

      await loadCompetitionDetail(
        submission.competition_id,
      )
    } catch (promoteError) {
      setError(getErrorMessage(promoteError))
    } finally {
      setActionKey(null)
    }
  }

  async function transitionCompetition(
    status: Extract<
      CompetitionStatus,
      'scheduled' | 'live' | 'scoring' | 'cancelled'
    >,
  ) {
    if (!selectedCompetition) return

    const action = `status:${status}`

    setActionKey(action)
    setError(null)
    setNotice(null)

    try {
      await request(
        `/api/venue-admin/competitions/${encodeURIComponent(
          selectedCompetition.id,
        )}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
          }),
        },
      )

      setNotice(
        `Competition moved to ${humanizeStatus(status)}.`,
      )

      await Promise.all([
        loadCompetitionDetail(selectedCompetition.id),
        loadCompetitions(),
      ])
    } catch (transitionError) {
      setError(getErrorMessage(transitionError))
    } finally {
      setActionKey(null)
    }
  }

  async function settleCompetition() {
    if (!selectedCompetition) return

    const confirmed = window.confirm(
      'Settle this competition using its final scoring evidence? This should only be done after scoring is complete.',
    )

    if (!confirmed) return

    const action = 'settle'

    setActionKey(action)
    setError(null)
    setNotice(null)

    try {
      await request(
        `/api/venue-admin/competitions/${encodeURIComponent(
          selectedCompetition.id,
        )}/settle`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      )

      setNotice('Competition settled.')

      await Promise.all([
        loadCompetitionDetail(selectedCompetition.id),
        loadCompetitions(),
      ])
    } catch (settleError) {
      setError(getErrorMessage(settleError))
    } finally {
      setActionKey(null)
    }
  }

  return (
    <section className="space-y-6 border-t border-neutral-800 pt-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
          Competitions
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Taste Duel management
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Create competitions, moderate candidate routes, choose the
              official contenders, and move competitions toward scoring and
              settlement.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadCompetitions()}
            disabled={loadingCompetitions}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 px-4 text-sm font-medium text-neutral-200 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingCompetitions ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={[
            'rounded-xl border px-4 py-3 text-sm',
            error
              ? 'border-red-900/70 bg-red-950/40 text-red-200'
              : 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200',
          ].join(' ')}
        >
          {error ?? notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={createCompetition}
          className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
        >
          <div>
            <h3 className="font-semibold text-white">
              Create competition
            </h3>

            <p className="mt-1 text-sm text-neutral-500">
              New competitions begin as drafts.
            </p>
          </div>

          <AdminField label="Title">
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Best date-night crawl"
              maxLength={160}
              required
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Category">
              <input
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="Nightlife"
                className={ADMIN_INPUT_CLASS}
                required
              />
            </AdminField>

            <AdminField label="City">
              <input
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                placeholder="New York"
                className={ADMIN_INPUT_CLASS}
                required
              />
            </AdminField>
          </div>

          <AdminField label="Taste Duel format">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    executionMode:
                      'itinerary',
                  }))
                }
                className={[
                  'rounded-xl border p-4 text-left transition',

                  form.executionMode ===
                  'itinerary'
                    ? 'border-white bg-white text-black'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold">
                  Itinerary
                </span>

                <span
                  className={[
                    'mt-1 block text-xs leading-5',

                    form.executionMode ===
                    'itinerary'
                      ? 'text-neutral-600'
                      : 'text-neutral-500',
                  ].join(' ')}
                >
                  User-submitted routes become official contenders.
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    executionMode:
                      'venue_participation',
                  }))
                }
                className={[
                  'rounded-xl border p-4 text-left transition',

                  form.executionMode ===
                  'venue_participation'
                    ? 'border-white bg-white text-black'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
                ].join(' ')}
              >
                <span className="block text-sm font-semibold">
                  Venue participation
                </span>

                <span
                  className={[
                    'mt-1 block text-xs leading-5',

                    form.executionMode ===
                    'venue_participation'
                      ? 'text-neutral-600'
                      : 'text-neutral-500',
                  ].join(' ')}
                >
                  Admin-curated venue sides compete on participation
                  evidence.
                </span>
              </button>
            </div>
          </AdminField>

          <AdminField label="Competitors">
            <div className="grid grid-cols-3 gap-2">
              {([2, 3, 4] as const).map((count) => {
                const selected =
                  form.maxEntries === count

                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        maxEntries: count,
                      }))
                    }
                    className={[
                      'min-h-11 rounded-lg border text-sm font-semibold transition',
                      selected
                        ? 'border-white bg-white text-black'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    {count}
                  </button>
                )
              })}
            </div>
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Starts">
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startsAt: event.target.value,
                  }))
                }
                required
                className={ADMIN_INPUT_CLASS}
              />
            </AdminField>

            <AdminField label="Ends">
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endsAt: event.target.value,
                  }))
                }
                required
                className={ADMIN_INPUT_CLASS}
              />
            </AdminField>
          </div>

          <AdminField label="Winner XP reward">
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.xpReward}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  xpReward: event.target.value,
                }))
              }
              className={ADMIN_INPUT_CLASS}
            />
          </AdminField>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <input
              type="checkbox"
              checked={form.anonymousEntries}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  anonymousEntries: event.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 accent-white"
            />

            <span>
              <span className="block text-sm font-medium text-white">
                Anonymous competitors
              </span>

              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                Hide contender identities while the duel is live and reveal
                them after settlement.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create competition'}
          </button>
        </form>

        <div className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <div>
            <h3 className="font-semibold text-white">
              Manage competition
            </h3>

            <p className="mt-1 text-sm text-neutral-500">
              Review the competition lifecycle and contender roster.
            </p>
          </div>

          <AdminField label="Competition">
            <select
              value={selectedCompetitionId}
              onChange={(event) =>
                setSelectedCompetitionId(event.target.value)
              }
              disabled={
                loadingCompetitions ||
                competitions.length === 0
              }
              className={ADMIN_INPUT_CLASS}
            >
              {competitions.length === 0 && (
                <option value="">
                  No competitions yet
                </option>
              )}

              {competitions.map((competition) => (
                <option
                  key={competition.id}
                  value={competition.id}
                >
                  {competition.title} ·{' '}
                  {humanizeStatus(competition.status)}
                </option>
              ))}
            </select>
          </AdminField>

          {loadingDetail && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 text-sm text-neutral-400">
              Loading competition…
            </div>
          )}

          {!loadingDetail && selectedCompetition && (
            <>
              <CompetitionSummaryCard
                competition={selectedCompetition}
                entryCount={activeEntries.length}
              />

              <div className="flex flex-wrap gap-2">
                {selectedCompetition.status === 'draft' && (
                  <LifecycleButton
                    label="Schedule"
                    busy={
                      actionKey === 'status:scheduled'
                    }
                    onClick={() =>
                      void transitionCompetition('scheduled')
                    }
                  />
                )}

                {(selectedCompetition.status === 'draft' ||
                  selectedCompetition.status === 'scheduled') && (
                  <LifecycleButton
                    label="Go live"
                    busy={
                      actionKey === 'status:live'
                    }
                    onClick={() =>
                      void transitionCompetition('live')
                    }
                  />
                )}

                {selectedCompetition.status === 'live' && (
                  <LifecycleButton
                    label="Close submissions / score"
                    busy={
                      actionKey === 'status:scoring'
                    }
                    onClick={() =>
                      void transitionCompetition('scoring')
                    }
                  />
                )}

                {selectedCompetition.status === 'scoring' && (
                  <LifecycleButton
                    label="Settle competition"
                    busy={actionKey === 'settle'}
                    onClick={() =>
                      void settleCompetition()
                    }
                    emphasis
                  />
                )}

                {!['completed', 'cancelled'].includes(
                  selectedCompetition.status,
                ) && (
                  <LifecycleButton
                    label="Cancel"
                    busy={
                      actionKey === 'status:cancelled'
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          'Cancel this competition?',
                        )
                      ) {
                        void transitionCompetition(
                          'cancelled',
                        )
                      }
                    }}
                    danger
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedCompetition && detail && (
        <>
          {selectedCompetition.taste_duel_execution_mode ===
          'venue_participation' ? (
            <CompetitionEntrySelector
              competitionId={
                selectedCompetition.id
              }
              onRefreshRequested={() => {
                void loadCompetitionDetail(
                  selectedCompetition.id,
                )
              }}
            />
          ) : (
            <>
              <CompetitionEntriesPanel
                competition={selectedCompetition}
                entries={detail.entries}
              />

              <CompetitionSubmissionsPanel
                competition={selectedCompetition}
                submissions={detail.submissions}
                entries={detail.entries}
                approvedSubmissions={approvedSubmissions}
                availableSlots={availableSlots}
                actionKey={actionKey}
                onApprove={(submission) =>
                  void updateSubmission(
                    submission,
                    'approved',
                  )
                }
                onReject={(submission) =>
                  void updateSubmission(
                    submission,
                    'rejected',
                  )
                }
                onPromote={(
                  submission,
                  contenderSlot,
                ) =>
                  void promoteSubmissionToEntry(
                    submission,
                    contenderSlot,
                  )
                }
              />
            </>
          )}
        </>
      )}
    </section>
  )
}

// ============================================================
// COMPETITIONS ADMIN UI
// ============================================================

const ADMIN_INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50'

function AdminField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
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

function CompetitionSummaryCard({
  competition,
  entryCount,
}: {
  competition: AdminCompetition
  entryCount: number
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200">
          {humanizeStatus(competition.status)}
        </span>

        <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
          {competition.taste_duel_execution_mode ===
          'venue_participation'
            ? 'Venue participation'
            : 'Itinerary'}
        </span>

        <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300">
          {entryCount}/{competition.max_entries} contenders
        </span>

        {competition.anonymous_entries && (
          <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300">
            Anonymous
          </span>
        )}
      </div>

      <h4 className="mt-4 text-lg font-semibold text-white">
        {competition.title}
      </h4>

      <p className="mt-1 text-sm text-neutral-400">
        {[competition.category, competition.city]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <SummaryMetric
          label="Starts"
          value={formatAdminDate(
            competition.starts_at,
          )}
        />

        <SummaryMetric
          label="Ends"
          value={formatAdminDate(
            competition.ends_at,
          )}
        />

        <SummaryMetric
          label="XP"
          value={`${competition.xp_reward}`}
        />

        <SummaryMetric
          label="Result"
          value={humanizeStatus(
            competition.result_status,
          )}
        />
      </dl>
    </div>
  )
}

function SummaryMetric({
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

function LifecycleButton({
  label,
  busy,
  onClick,
  emphasis = false,
  danger = false,
}: {
  label: string
  busy: boolean
  onClick: () => void
  emphasis?: boolean
  danger?: boolean
}) {
  let className =
    'border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800'

  if (emphasis) {
    className =
      'border-white bg-white text-black hover:bg-neutral-200'
  }

  if (danger) {
    className =
      'border-red-900 bg-red-950/40 text-red-300 hover:bg-red-950/70'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={[
        'inline-flex min-h-10 items-center justify-center rounded-lg border px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
    >
      {busy ? 'Working…' : label}
    </button>
  )
}

function CompetitionEntriesPanel({
  competition,
  entries,
}: {
  competition: AdminCompetition
  entries: AdminCompetitionEntry[]
}) {
  const slots = Array.from(
    { length: competition.max_entries },
    (_, index) => (index + 1) as 1 | 2 | 3 | 4,
  )

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div>
        <h3 className="font-semibold text-white">
          Official contenders
        </h3>

        <p className="mt-1 text-sm text-neutral-500">
          Approved submissions promoted into the competition roster.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          const entry = entries.find(
            (candidate) =>
              candidate.contender_slot === slot &&
              candidate.status !== 'withdrawn' &&
              candidate.status !== 'disqualified',
          )

          return (
            <div
              key={slot}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                Contender {contenderSlotLabel(slot)}
              </p>

              {entry ? (
                <>
                  <p className="mt-3 text-sm font-medium text-white">
                    {entry.venue_ids.length} stops
                  </p>

                  <p className="mt-1 break-all text-xs text-neutral-600">
                    Entry {entry.id}
                  </p>

                  <p className="mt-2 text-xs text-neutral-500">
                    {entry.source_type
                      ? humanizeStatus(
                          entry.source_type,
                        )
                      : 'Curated'}
                    {' · '}
                    {humanizeStatus(entry.status)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">
                  Open slot
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompetitionSubmissionsPanel({
  competition,
  submissions,
  entries,
  approvedSubmissions,
  availableSlots,
  actionKey,
  onApprove,
  onReject,
  onPromote,
}: {
  competition: AdminCompetition
  submissions: AdminCompetitionSubmission[]
  entries: AdminCompetitionEntry[]
  approvedSubmissions: AdminCompetitionSubmission[]
  availableSlots: Array<1 | 2 | 3 | 4>
  actionKey: string | null
  onApprove: (
    submission: AdminCompetitionSubmission,
  ) => void
  onReject: (
    submission: AdminCompetitionSubmission,
  ) => void
  onPromote: (
    submission: AdminCompetitionSubmission,
    contenderSlot: 1 | 2 | 3 | 4,
  ) => void
}) {
  const [slotSelections, setSlotSelections] =
    useState<Record<string, 1 | 2 | 3 | 4>>({})

  const activeEntryCount = entries.filter(
    (entry) =>
      entry.status === 'approved' ||
      entry.status === 'pending',
  ).length

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">
            Submission moderation
          </h3>

          <p className="mt-1 text-sm text-neutral-500">
            Approve or reject candidate routes, then choose which approved
            submissions become official contenders.
          </p>
        </div>

        <div className="text-xs text-neutral-500">
          {approvedSubmissions.length} approved ·{' '}
          {activeEntryCount}/{competition.max_entries} selected
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-600">
          No submissions yet.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => {
            const linkedEntry =
              submission.competition_entry_id
                ? entries.find(
                    (entry) =>
                      entry.id ===
                      submission.competition_entry_id,
                  )
                : null

            const defaultSlot =
              availableSlots[0]

            const selectedSlot =
              slotSelections[submission.id] ??
              defaultSlot

            const approving =
              actionKey ===
              `approved:${submission.id}`

            const rejecting =
              actionKey ===
              `rejected:${submission.id}`

            const promoting =
              actionKey ===
              `promote:${submission.id}`

            return (
              <article
                key={submission.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          'rounded-full px-2.5 py-1 text-xs font-medium',
                          submission.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : submission.status === 'rejected'
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-amber-500/15 text-amber-200',
                        ].join(' ')}
                      >
                        {humanizeStatus(
                          submission.status,
                        )}
                      </span>

                      <span className="text-xs text-neutral-500">
                        {humanizeStatus(
                          submission.submission_source,
                        )}
                      </span>
                    </div>

                    <h4 className="mt-3 font-medium text-white">
                      {submission.route_title?.trim() ||
                        'Untitled route'}
                    </h4>

                    <p className="mt-1 text-sm text-neutral-400">
                      {submission.route_city ||
                        competition.city ||
                        'Unknown city'}
                      {' · '}
                      {submission.venue_ids.length} route stops
                      {' · '}
                      {submission.verified_venue_count} verified
                    </p>

                    <p className="mt-2 break-all text-xs text-neutral-600">
                      Submitted by {submission.user_id}
                    </p>

                    <p className="mt-1 text-xs text-neutral-600">
                      {formatAdminDate(
                        submission.submitted_at,
                      )}
                    </p>
                  </div>

                  {linkedEntry && (
                    <div className="shrink-0 rounded-lg bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-200">
                      Contender{' '}
                      {contenderSlotLabel(
                        linkedEntry.contender_slot,
                      )}
                    </div>
                  )}
                </div>

                {!linkedEntry && (
                  <div className="mt-4 border-t border-neutral-800 pt-4">
                    {submission.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onApprove(submission)
                          }
                          disabled={
                            approving ||
                            rejecting ||
                            promoting
                          }
                          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {approving
                            ? 'Approving…'
                            : 'Approve'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Reject this competition submission?',
                              )
                            ) {
                              onReject(submission)
                            }
                          }}
                          disabled={
                            approving ||
                            rejecting ||
                            promoting
                          }
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-900 bg-red-950/40 px-3 text-xs font-medium text-red-300 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {rejecting
                            ? 'Rejecting…'
                            : 'Reject'}
                        </button>
                      </div>
                    )}

                    {submission.status === 'approved' &&
                      availableSlots.length > 0 && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            value={
                              selectedSlot ?? ''
                            }
                            onChange={(event) =>
                              setSlotSelections(
                                (current) => ({
                                  ...current,
                                  [submission.id]:
                                    Number(
                                      event.target
                                        .value,
                                    ) as
                                      | 1
                                      | 2
                                      | 3
                                      | 4,
                                }),
                              )
                            }
                            className="min-h-9 rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-xs text-white outline-none"
                          >
                            {availableSlots.map(
                              (slot) => (
                                <option
                                  key={slot}
                                  value={slot}
                                >
                                  Contender{' '}
                                  {contenderSlotLabel(
                                    slot,
                                  )}
                                </option>
                              ),
                            )}
                          </select>

                          <button
                            type="button"
                            disabled={
                              promoting ||
                              !selectedSlot
                            }
                            onClick={() => {
                              if (selectedSlot) {
                                onPromote(
                                  submission,
                                  selectedSlot,
                                )
                              }
                            }}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {promoting
                              ? 'Adding…'
                              : 'Make official entry'}
                          </button>
                        </div>
                      )}

                    {submission.status === 'approved' &&
                      availableSlots.length === 0 && (
                        <p className="text-xs text-neutral-500">
                          All contender slots are filled.
                        </p>
                      )}

                    {submission.status === 'rejected' &&
                      submission.rejection_reason && (
                        <p className="text-xs text-red-300/80">
                          {submission.rejection_reason}
                        </p>
                      )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// COMPETITIONS ADMIN HELPERS
// ============================================================

function contenderSlotLabel(
  slot: 1 | 2 | 3 | 4,
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

function humanizeStatus(
  value: string,
): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    )
}

function formatAdminDate(
  value: string | null,
): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return 'Something went wrong.'
}