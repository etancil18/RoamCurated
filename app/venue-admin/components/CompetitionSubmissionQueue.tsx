'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  COMPETITION_SOURCE_TYPE,
  COMPETITION_SUBMISSION_STATUS,
  type CompetitionSubmissionStatus,
  type CompetitionSourceType,
} from '@/lib/competitions/constants'

import type {
  Competition,
  CompetitionSubmission,
  UUID,
} from '@/lib/competitions/types'


// ============================================================
// TYPES
// ============================================================

export interface CompetitionSubmissionQueueProps {
  /**
   * Optional competition filter controlled by the parent.
   *
   * When omitted, the queue shows submissions across all
   * competitions.
   */
  competitionId?: UUID | null

  /**
   * Optional status filter controlled by the parent.
   *
   * Defaults to pending.
   */
  initialStatus?: CompetitionSubmissionStatus | 'all'

  /**
   * Optional source filter.
   */
  initialSource?: CompetitionSourceType | 'all'

  /**
   * Called after a submission moderation decision succeeds.
   */
  onSubmissionReviewed?: (
    submission: CompetitionSubmission,
  ) => void

  /**
   * Allows a parent admin surface to refresh adjacent panels.
   */
  onRefreshRequested?: () => void
}


type SubmissionQueueResponse = {
  submissions: CompetitionSubmission[]
  competitions?: Competition[]
  hasMore?: boolean
  limit?: number
  offset?: number
}


type SubmissionMutationResponse = {
  submission: CompetitionSubmission
}


type SubmissionQueueItem = CompetitionSubmission & {
  competition?: Competition | null
}


type QueueStatusFilter =
  | CompetitionSubmissionStatus
  | 'all'

type QueueSourceFilter =
  | CompetitionSourceType
  | 'all'


// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 50

const STATUS_FILTERS = [
  'pending',
  'approved',
  'rejected',
  'all',
] as const satisfies readonly QueueStatusFilter[]

const SOURCE_FILTERS = [
  'all',
  COMPETITION_SOURCE_TYPE.ACTIVE_FLOW,
  COMPETITION_SOURCE_TYPE.VISIT_HISTORY,
] as const satisfies readonly QueueSourceFilter[]


// ============================================================
// COMPONENT
// ============================================================

export default function CompetitionSubmissionQueue({
  competitionId,
  initialStatus = COMPETITION_SUBMISSION_STATUS.PENDING,
  initialSource = 'all',
  onSubmissionReviewed,
  onRefreshRequested,
}: CompetitionSubmissionQueueProps) {
  const [
    submissions,
    setSubmissions,
  ] = useState<SubmissionQueueItem[]>([])

  const [
    competitions,
    setCompetitions,
  ] = useState<Competition[]>([])

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<QueueStatusFilter>(
    initialStatus,
  )

  const [
    sourceFilter,
    setSourceFilter,
  ] = useState<QueueSourceFilter>(
    initialSource,
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
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
  // LOAD
  // ==========================================================

  const loadQueue =
    useCallback(
      async (
        mode:
          | 'initial'
          | 'refresh'
          = 'initial',
      ) => {
        if (mode === 'initial') {
          setLoading(true)
        } else {
          setRefreshing(true)
        }

        setError(null)

        try {
          const params =
            new URLSearchParams()

          params.set(
            'limit',
            String(PAGE_SIZE),
          )

          params.set(
            'offset',
            '0',
          )

          if (competitionId) {
            params.set(
              'competitionId',
              competitionId,
            )
          }

          if (
            statusFilter
            !== 'all'
          ) {
            params.set(
              'status',
              statusFilter,
            )
          }

          if (
            sourceFilter
            !== 'all'
          ) {
            params.set(
              'source',
              sourceFilter,
            )
          }


          const data =
            await request<SubmissionQueueResponse>(
              `/api/venue-admin/competitions/submissions?${params.toString()}`,
            )


          const competitionMap =
            new Map(
              (
                data.competitions
                ?? []
              ).map(
                (competition) => [
                  competition.id,
                  competition,
                ],
              ),
            )


          const rows =
            (
              data.submissions
              ?? []
            ).map(
              (
                submission,
              ): SubmissionQueueItem => ({
                ...submission,

                competition:
                  competitionMap.get(
                    submission.competition_id,
                  )
                  ?? null,
              }),
            )


          setSubmissions(
            rows,
          )

          if (
            data.competitions
          ) {
            setCompetitions(
              data.competitions,
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
        sourceFilter,
        statusFilter,
      ],
    )


  useEffect(
    () => {
      void loadQueue(
        'initial',
      )
    },
    [
      loadQueue,
    ],
  )


  // ==========================================================
  // COMPETITION LOOKUP
  // ==========================================================

  const competitionById =
    useMemo(
      () =>
        new Map(
          competitions.map(
            (competition) => [
              competition.id,
              competition,
            ],
          ),
        ),
      [
        competitions,
      ],
    )


  // ==========================================================
  // MODERATION
  // ==========================================================

  async function reviewSubmission(
    submission: CompetitionSubmission,
    status:
      | 'approved'
      | 'rejected',
  ) {
    const action =
      `${status}:${submission.id}`

    setActionKey(
      action,
    )

    setError(null)
    setNotice(null)


    try {
      const data =
        await request<SubmissionMutationResponse>(
          `/api/venue-admin/competitions/${encodeURIComponent(
            submission.competition_id,
          )}/submissions/${encodeURIComponent(
            submission.id,
          )}`,
          {
            method: 'PATCH',

            body:
              JSON.stringify({
                status,
              }),
          },
        )


      setSubmissions(
        (current) =>
          current
            .map(
              (candidate) =>
                candidate.id
                  === data.submission.id
                  ? {
                      ...candidate,
                      ...data.submission,
                    }
                  : candidate,
            )
            .filter(
              (candidate) =>
                statusFilter === 'all'
                || candidate.status
                  === statusFilter,
            ),
      )


      setNotice(
        status === 'approved'
          ? 'Submission approved.'
          : 'Submission rejected.',
      )


      onSubmissionReviewed?.(
        data.submission,
      )

      onRefreshRequested?.()
    } catch (reviewError) {
      setError(
        getErrorMessage(
          reviewError,
        ),
      )
    } finally {
      setActionKey(
        null,
      )
    }
  }


  // ==========================================================
  // FILTER SUMMARY
  // ==========================================================

  const queueSummary =
    useMemo(
      () => {
        const pending =
          submissions.filter(
            (submission) =>
              submission.status
              === 'pending',
          ).length

        const approved =
          submissions.filter(
            (submission) =>
              submission.status
              === 'approved',
          ).length

        const rejected =
          submissions.filter(
            (submission) =>
              submission.status
              === 'rejected',
          ).length

        return {
          pending,
          approved,
          rejected,
        }
      },
      [
        submissions,
      ],
    )


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Moderation
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              Competition submission queue
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
              Review user-submitted Active Flows and Visit History
              routes before they can be selected as official
              competition entries.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadQueue(
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


      <div className="grid gap-3 sm:grid-cols-3">
        <QueueMetric
          label="Pending"
          value={
            queueSummary.pending
          }
        />

        <QueueMetric
          label="Approved"
          value={
            queueSummary.approved
          }
        />

        <QueueMetric
          label="Rejected"
          value={
            queueSummary.rejected
          }
        />
      </div>


      <div className="grid gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:grid-cols-2">
        <FilterField
          label="Status"
        >
          <select
            value={
              statusFilter
            }
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as QueueStatusFilter,
              )
            }
            className={
              ADMIN_INPUT_CLASS
            }
          >
            {STATUS_FILTERS.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {humanize(
                    status,
                  )}
                </option>
              ),
            )}
          </select>
        </FilterField>


        <FilterField
          label="Source"
        >
          <select
            value={
              sourceFilter
            }
            onChange={(event) =>
              setSourceFilter(
                event.target
                  .value as QueueSourceFilter,
              )
            }
            className={
              ADMIN_INPUT_CLASS
            }
          >
            {SOURCE_FILTERS.map(
              (source) => (
                <option
                  key={source}
                  value={source}
                >
                  {source === 'all'
                    ? 'All sources'
                    : humanize(
                        source,
                      )}
                </option>
              ),
            )}
          </select>
        </FilterField>
      </div>


      {loading ? (
        <QueueLoadingState />
      ) : submissions.length === 0 ? (
        <EmptyState>
          No submissions match the current filters.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {submissions.map(
            (submission) => {
              const competition =
                submission.competition
                ?? competitionById.get(
                  submission.competition_id,
                )
                ?? null

              return (
                <SubmissionCard
                  key={
                    submission.id
                  }
                  submission={
                    submission
                  }
                  competition={
                    competition
                  }
                  actionKey={
                    actionKey
                  }
                  onApprove={() =>
                    void reviewSubmission(
                      submission,
                      'approved',
                    )
                  }
                  onReject={() => {
                    const confirmed =
                      window.confirm(
                        'Reject this competition submission?',
                      )

                    if (confirmed) {
                      void reviewSubmission(
                        submission,
                        'rejected',
                      )
                    }
                  }}
                />
              )
            },
          )}
        </div>
      )}
    </section>
  )
}


// ============================================================
// SUBMISSION CARD
// ============================================================

function SubmissionCard({
  submission,
  competition,
  actionKey,
  onApprove,
  onReject,
}: {
  submission:
    CompetitionSubmission

  competition:
    Competition | null

  actionKey:
    string | null

  onApprove:
    () => void

  onReject:
    () => void
}) {
  const approving =
    actionKey
    === `approved:${submission.id}`

  const rejecting =
    actionKey
    === `rejected:${submission.id}`

  const busy =
    approving
    || rejecting


  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status={
                submission.status
              }
            />

            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400">
              {humanize(
                submission.submission_source,
              )}
            </span>

            {competition && (
              <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">
                {competition.title}
              </span>
            )}
          </div>


          <h3 className="mt-4 text-base font-semibold text-white">
            {submission.route_title?.trim()
              || 'Untitled route'}
          </h3>


          <p className="mt-1 text-sm text-neutral-400">
            {submission.route_city
              || competition?.city
              || 'Unknown city'}
          </p>
        </div>


        <div className="shrink-0 text-right">
          <p className="text-xs text-neutral-600">
            Submitted
          </p>

          <p className="mt-1 text-sm text-neutral-300">
            {formatDate(
              submission.submitted_at,
            )}
          </p>
        </div>
      </div>


      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric
          label="Route stops"
          value={
            submission.venue_ids.length
          }
        />

        <Metric
          label="Verified"
          value={
            submission.verified_venue_count
          }
        />

        <Metric
          label="Source"
          value={
            humanize(
              submission.submission_source,
            )
          }
        />

        <Metric
          label="User"
          value={
            truncateId(
              submission.user_id,
            )
          }
        />
      </div>


      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
          Route evidence
        </p>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <EvidenceRow
            label="Competition"
            value={
              competition?.title
              ?? submission.competition_id
            }
          />

          <EvidenceRow
            label="Competition ID"
            value={
              submission.competition_id
            }
          />

          <EvidenceRow
            label="Submission ID"
            value={
              submission.id
            }
          />

          <EvidenceRow
            label="User ID"
            value={
              submission.user_id
            }
          />

          {submission.flow_session_id && (
            <EvidenceRow
              label="Flow session"
              value={
                submission.flow_session_id
              }
            />
          )}

          {submission.visit_date && (
            <EvidenceRow
              label="Visit date"
              value={
                submission.visit_date
              }
            />
          )}

          <EvidenceRow
            label="Route started"
            value={
              formatDate(
                submission.route_started_at,
              )
            }
          />

          <EvidenceRow
            label="Route completed"
            value={
              formatDate(
                submission.route_completed_at,
              )
            }
          />
        </dl>


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
                    10,
                  )}
                </span>
              ),
            )}
          </div>
        </div>
      </div>


      {submission.status
        === COMPETITION_SUBMISSION_STATUS.REJECTED
        && submission.rejection_reason && (
        <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
          {submission.rejection_reason}
        </div>
      )}


      {submission.competition_entry_id && (
        <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-200">
          Already linked to official entry{' '}
          <span className="font-mono">
            {truncateId(
              submission.competition_entry_id,
              12,
            )}
          </span>
          .
        </div>
      )}


      {submission.status
        === COMPETITION_SUBMISSION_STATUS.PENDING && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approving
              ? 'Approving…'
              : 'Approve'}
          </button>

          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-900 bg-red-950/40 px-4 text-sm font-medium text-red-300 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {rejecting
              ? 'Rejecting…'
              : 'Reject'}
          </button>
        </div>
      )}


      {submission.status
        === COMPETITION_SUBMISSION_STATUS.APPROVED
        && !submission.competition_entry_id && (
        <div className="mt-5 border-t border-neutral-800 pt-4">
          <p className="text-sm text-neutral-500">
            Approved. This route is now eligible to be selected as
            an official competition entry.
          </p>
        </div>
      )}
    </article>
  )
}


// ============================================================
// FILTERS
// ============================================================

function FilterField({
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


// ============================================================
// STATUS
// ============================================================

function StatusChip({
  status,
}: {
  status:
    CompetitionSubmissionStatus
}) {
  let className =
    'bg-amber-500/15 text-amber-200'

  if (
    status
    === COMPETITION_SUBMISSION_STATUS.APPROVED
  ) {
    className =
      'bg-emerald-500/15 text-emerald-300'
  }

  if (
    status
    === COMPETITION_SUBMISSION_STATUS.REJECTED
  ) {
    className =
      'bg-red-500/15 text-red-300'
  }


  return (
    <span
      className={[
        'rounded-full px-2.5 py-1 text-xs font-medium',
        className,
      ].join(' ')}
    >
      {humanize(
        status,
      )}
    </span>
  )
}


// ============================================================
// SMALL UI
// ============================================================

function QueueMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  )
}


function Metric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
      <p className="text-xs text-neutral-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-neutral-200">
        {value}
      </p>
    </div>
  )
}


function EvidenceRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-600">
        {label}
      </dt>

      <dd className="mt-1 break-all font-mono text-xs text-neutral-300">
        {value}
      </dd>
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


function QueueLoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(
        (index) => (
          <div
            key={index}
            className="h-52 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950"
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
  'min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-white outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-white/10'


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