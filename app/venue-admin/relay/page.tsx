// app/venue-admin/relay/page.tsx

import Link from 'next/link'

import RelayStatusBadge from '@/components/relay/RelayStatusBadge'
import {
  formatRelaySlotCount,
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type {
  PartnerCampaignId,
  RelayExecutionMode,
  RelayId,
  RelayStatus,
  UserId,
} from '@/lib/relay/types'


/* ============================================================
 * ROUTE CONFIG
 * ============================================================
 *
 * This is an operational admin surface.
 *
 * Do not statically cache live Relay state.
 * ============================================================
 */

export const dynamic =
  'force-dynamic'


/* ============================================================
 * TYPES
 * ============================================================
 */

type RelayAdminFilter =
  | 'all'
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'completed'


type RelayAdminListRow = {
  id: RelayId

  title: string
  description: string | null

  city: string | null
  theme: string | null

  status: RelayStatus

  execution_mode:
    RelayExecutionMode

  min_team_size: number
  max_team_size: number

  starts_at: string | null
  ends_at: string | null

  partner_campaign_id:
    PartnerCampaignId | null

  created_by:
    UserId

  created_at: string
  updated_at: string
}


type RelayAdminListItem = {
  id: RelayId

  title: string
  description: string | null

  city: string | null
  theme: string | null

  status: RelayStatus

  minTeamSize: number
  maxTeamSize: number

  startsAt: string | null
  endsAt: string | null

  partnerCampaignId:
    PartnerCampaignId | null

  slotCount: number

  updatedAt: string
}


type PageProps = {
  searchParams?:
    Promise<{
      status?:
        string | string[]
    }>
}


/* ============================================================
 * CONSTANTS
 * ============================================================
 */

const ADMIN_RELAY_FILTERS: Array<{
  value: RelayAdminFilter
  label: string
}> = [
  {
    value:
      'all',
    label:
      'All',
  },
  {
    value:
      'draft',
    label:
      'Drafts',
  },
  {
    value:
      'scheduled',
    label:
      'Scheduled',
  },
  {
    value:
      'live',
    label:
      'Live',
  },
  {
    value:
      'completed',
    label:
      'Completed',
  },
]


const ADMIN_VISIBLE_STATUSES:
  RelayStatus[] = [
    'draft',
    'scheduled',
    'live',
    'completed',
  ]


/* ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizeCount(
  value: unknown
): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      Math.floor(value)
    )
  }

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    const parsed =
      Number(value)

    if (
      Number.isFinite(parsed)
    ) {
      return Math.max(
        0,
        Math.floor(parsed)
      )
    }
  }

  return 0
}


function normalizeRelayFilter(
  value:
    string | string[] | undefined
): RelayAdminFilter {
  const candidate =
    Array.isArray(value)
      ? value[0]
      : value

  switch (candidate) {
    case 'draft':
    case 'scheduled':
    case 'live':
    case 'completed':
      return candidate

    default:
      return 'all'
  }
}


function formatUpdatedAt(
  value: string
): string {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Recently updated'
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',
      day:
        'numeric',
      year:
        'numeric',
    }
  ).format(date)
}


/* ============================================================
 * READ-ONLY ADMIN QUERY
 * ============================================================
 *
 * This page is intentionally read-only.
 *
 * It does not mutate Relay state and does not call execution
 * RPCs.
 *
 * This query exists locally because the admin index needs an
 * operational cross-Relay list rather than a single Relay
 * domain model.
 * ============================================================
 */

async function getAdminRelayList(): Promise<
  RelayAdminListItem[]
> {
  const supabase =
    getSupabaseAdmin()

  const relayResult =
    await supabase
      .from(
        'roam_relays'
      )
      .select(`
        id,
        title,
        description,
        city,
        theme,
        status,
        execution_mode,
        min_team_size,
        max_team_size,
        starts_at,
        ends_at,
        partner_campaign_id,
        created_by,
        created_at,
        updated_at
      `)
      .in(
        'status',
        ADMIN_VISIBLE_STATUSES
      )
      .order(
        'updated_at',
        {
          ascending:
            false,
        }
      )

  if (
    relayResult.error
  ) {
    throw new Error(
      [
        '[venue-admin/relay] Failed to load Relays.',
        relayResult.error.message,
        relayResult.error.code
          ? `code=${relayResult.error.code}`
          : null,
        relayResult.error.details
          ? `details=${relayResult.error.details}`
          : null,
      ]
        .filter(Boolean)
        .join(' | ')
    )
  }

  const relayRows =
    (
      relayResult.data ??
      []
    ) as RelayAdminListRow[]

  if (
    relayRows.length ===
    0
  ) {
    return []
  }

  const relayIds =
    relayRows.map(
      (relay) =>
        relay.id
    )

  const slotsResult =
    await supabase
      .from(
        'roam_relay_slots'
      )
      .select(`
        relay_id
      `)
      .in(
        'relay_id',
        relayIds
      )

  if (
    slotsResult.error
  ) {
    throw new Error(
      [
        '[venue-admin/relay] Failed to load Relay slot counts.',
        slotsResult.error.message,
        slotsResult.error.code
          ? `code=${slotsResult.error.code}`
          : null,
        slotsResult.error.details
          ? `details=${slotsResult.error.details}`
          : null,
      ]
        .filter(Boolean)
        .join(' | ')
    )
  }

  const slotCountByRelayId =
    new Map<
      RelayId,
      number
    >()

  for (
    const slot
    of slotsResult.data ??
    []
  ) {
    const relayId =
      slot.relay_id

    slotCountByRelayId.set(
      relayId,
      (
        slotCountByRelayId.get(
          relayId
        ) ??
        0
      ) +
        1
    )
  }

  return relayRows.map(
    (
      row
    ): RelayAdminListItem => ({
      id:
        row.id,

      title:
        row.title,

      description:
        row.description,

      city:
        row.city,

      theme:
        row.theme,

      status:
        row.status,

      minTeamSize:
        normalizeCount(
          row.min_team_size
        ),

      maxTeamSize:
        normalizeCount(
          row.max_team_size
        ),

      startsAt:
        row.starts_at,

      endsAt:
        row.ends_at,

      partnerCampaignId:
        row.partner_campaign_id,

      slotCount:
        slotCountByRelayId.get(
          row.id
        ) ??
        0,

      updatedAt:
        row.updated_at,
    })
  )
}


/* ============================================================
 * SUMMARY
 * ============================================================
 */

function getStatusCounts(
  relays:
    RelayAdminListItem[]
): Record<
  Exclude<
    RelayAdminFilter,
    'all'
  >,
  number
> {
  return {
    draft:
      relays.filter(
        (relay) =>
          relay.status ===
          'draft'
      ).length,

    scheduled:
      relays.filter(
        (relay) =>
          relay.status ===
          'scheduled'
      ).length,

    live:
      relays.filter(
        (relay) =>
          relay.status ===
          'live'
      ).length,

    completed:
      relays.filter(
        (relay) =>
          relay.status ===
          'completed'
      ).length,
  }
}


/* ============================================================
 * EMPTY STATE
 * ============================================================
 */

function RelayAdminEmptyState({
  filter,
}: {
  filter:
    RelayAdminFilter
}) {
  const isAll =
    filter ===
    'all'

  return (
    <div
      className={[
        'rounded-3xl',
        'border',
        'border-dashed',
        'border-zinc-700',
        'bg-zinc-950',
        'px-5',
        'py-12',
        'text-center',
        'shadow-[0_24px_70px_rgba(0,0,0,0.34)]',
        'sm:px-8',
        'sm:py-16',
      ].join(' ')}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-amber-300">
        Roam Relay
      </p>

      <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-zinc-50 sm:text-2xl">
        {isAll
          ? 'No Relays yet'
          : `No ${filter} Relays`}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-300 sm:text-[15px]">
        {isAll
          ? 'Create the first Relay and define the collaborative route template your teams will execute.'
          : 'Nothing currently matches this Relay status.'}
      </p>

      {isAll ? (
        <div className="mt-7">
          <Link
            href="/venue-admin/relay/new"
            className={[
              'inline-flex',
              'min-h-12',
              'items-center',
              'justify-center',
              'rounded-xl',
              'border',
              'border-amber-400',
              'bg-amber-400',
              'px-5',
              'text-sm',
              'font-bold',
              '!text-zinc-950',
              'shadow-[0_10px_32px_rgba(251,191,36,0.20)]',
              'transition',
              'hover:border-amber-300',
              'hover:bg-amber-300',
              'hover:!text-zinc-950',
              'active:scale-[0.99]',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-amber-300',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-zinc-950',
            ].join(' ')}
          >
            Create Relay
          </Link>
        </div>
      ) : null}
    </div>
  )
}


/* ============================================================
 * RELAY CARD
 * ============================================================
 */

function RelayAdminCard({
  relay,
}: {
  relay:
    RelayAdminListItem
}) {
  const city =
    relay.city
      ?.trim() ||
    'City not set'

  const theme =
    relay.theme
      ?.trim() ||
    null

  const description =
    relay.description
      ?.trim() ||
    null

  return (
    <article
      className={[
        'group',
        'overflow-hidden',
        'rounded-3xl',
        'border',
        'border-zinc-800',
        'bg-zinc-950',
        'p-5',
        'shadow-[0_18px_60px_rgba(0,0,0,0.30)]',
        'transition',
        'duration-200',
        'hover:border-zinc-700',
        'hover:bg-[#111111]',
        'sm:p-6',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RelayStatusBadge
              kind="relay"
              status={
                relay.status
              }
              compact
            />

            {relay.partnerCampaignId ? (
              <span
                className={[
                  'inline-flex',
                  'min-h-7',
                  'items-center',
                  'rounded-full',
                  'border',
                  'border-violet-400/40',
                  'bg-violet-950',
                  'px-2.5',
                  'py-1',
                  'text-[10px]',
                  'font-bold',
                  'uppercase',
                  'tracking-[0.12em]',
                  'text-violet-200',
                ].join(' ')}
              >
                Partner
              </span>
            ) : null}
          </div>

          <h2
            className={[
              'mt-3',
              'break-words',
              'text-xl',
              'font-semibold',
              'leading-tight',
              'tracking-[-0.03em]',
              'text-zinc-50',
              'sm:text-2xl',
            ].join(' ')}
          >
            {relay.title}
          </h2>

          <p className="mt-2 text-sm font-medium leading-5 text-zinc-300">
            {city}
            {theme
              ? ` · ${theme}`
              : ''}
          </p>
        </div>

        <Link
          href={
            `/venue-admin/relay/${relay.id}`
          }
          className={[
            'inline-flex',
            'min-h-11',
            'w-full',
            'shrink-0',
            'items-center',
            'justify-center',
            'rounded-xl',
            'border',
            'border-zinc-600',
            'bg-zinc-800',
            'px-4',
            'text-sm',
            'font-bold',
            '!text-zinc-50',
            'transition',
            'hover:border-zinc-500',
            'hover:bg-zinc-700',
            'hover:!text-white',
            'active:scale-[0.99]',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-zinc-400',
            'focus-visible:ring-offset-2',
            'focus-visible:ring-offset-zinc-950',
            'sm:w-auto',
          ].join(' ')}
        >
          Manage
        </Link>
      </div>

      {description ? (
        <p className="mt-4 line-clamp-3 max-w-3xl text-sm leading-6 text-zinc-300">
          {description}
        </p>
      ) : null}

      <dl
        className={[
          'mt-5',
          'grid',
          'grid-cols-1',
          'gap-3',
          'border-t',
          'border-zinc-800',
          'pt-5',
          'sm:grid-cols-2',
          'lg:grid-cols-4',
        ].join(' ')}
      >
        <div
          className={[
            'rounded-2xl',
            'border',
            'border-zinc-800',
            'bg-zinc-900',
            'px-4',
            'py-3.5',
          ].join(' ')}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Route
          </dt>

          <dd className="mt-1.5 text-sm font-semibold text-zinc-50">
            {formatRelaySlotCount(
              relay.slotCount
            )}
          </dd>
        </div>

        <div
          className={[
            'rounded-2xl',
            'border',
            'border-zinc-800',
            'bg-zinc-900',
            'px-4',
            'py-3.5',
          ].join(' ')}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Team
          </dt>

          <dd className="mt-1.5 text-sm font-semibold text-zinc-50">
            {formatRelayTeamSize(
              relay.minTeamSize,
              relay.maxTeamSize
            )}
          </dd>
        </div>

        <div
          className={[
            'rounded-2xl',
            'border',
            'border-zinc-800',
            'bg-zinc-900',
            'px-4',
            'py-3.5',
            'sm:col-span-2',
          ].join(' ')}
        >
          <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Window
          </dt>

          <dd className="mt-1.5 break-words text-sm font-semibold leading-5 text-zinc-50">
            {formatRelayTimeWindow(
              relay.startsAt,
              relay.endsAt
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-zinc-400">
          Updated{' '}
          {formatUpdatedAt(
            relay.updatedAt
          )}
        </p>

        {relay.slotCount ===
        0 ? (
          <span
            className={[
              'inline-flex',
              'w-fit',
              'items-center',
              'rounded-full',
              'border',
              'border-amber-500/40',
              'bg-amber-950',
              'px-2.5',
              'py-1',
              'text-[11px]',
              'font-semibold',
              'text-amber-200',
            ].join(' ')}
          >
            Needs route template
          </span>
        ) : null}
      </div>
    </article>
  )
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default async function RelayAdminIndexPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams =
    searchParams
      ? await searchParams
      : undefined

  const activeFilter =
    normalizeRelayFilter(
      resolvedSearchParams
        ?.status
    )

  const relays =
    await getAdminRelayList()

  const counts =
    getStatusCounts(
      relays
    )

  const filteredRelays =
    activeFilter ===
    'all'
      ? relays
      : relays.filter(
          (relay) =>
            relay.status ===
            activeFilter
        )

  return (
    <main
      className={[
        'min-h-screen',
        'w-full',
        'bg-[#080808]',
        'text-zinc-50',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto',
          'w-full',
          'max-w-7xl',
          'px-4',
          'pb-20',
          'pt-5',
          'sm:px-6',
          'sm:pt-8',
          'lg:px-8',
        ].join(' ')}
      >
        {/* Header */}
        <header
          className={[
            'rounded-3xl',
            'border',
            'border-zinc-800',
            'bg-[linear-gradient(135deg,#17140d_0%,#111111_46%,#0d0d0d_100%)]',
            'px-5',
            'py-6',
            'shadow-[0_20px_70px_rgba(0,0,0,0.36)]',
            'sm:px-6',
            'sm:py-7',
            'lg:flex',
            'lg:items-end',
            'lg:justify-between',
            'lg:gap-8',
          ].join(' ')}
        >
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-amber-300">
              Venue Admin · Relay
            </p>

            <h1 className="mt-2.5 text-3xl font-semibold leading-tight tracking-[-0.045em] text-zinc-50 sm:text-4xl">
              Roam Relays
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-[15px]">
              Author collaborative city routes, review their
              lifecycle, and manage the Relay templates teams will
              execute.
            </p>
          </div>

          <Link
            href="/venue-admin/relay/new"
            className={[
              'mt-5',
              'inline-flex',
              'min-h-12',
              'w-full',
              'shrink-0',
              'items-center',
              'justify-center',
              'rounded-xl',
              'border',
              'border-amber-400',
              'bg-amber-400',
              'px-5',
              'text-sm',
              'font-bold',
              '!text-zinc-950',
              'shadow-[0_10px_32px_rgba(251,191,36,0.18)]',
              'transition',
              'hover:border-amber-300',
              'hover:bg-amber-300',
              'hover:!text-zinc-950',
              'active:scale-[0.99]',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-amber-300',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-zinc-950',
              'sm:w-auto',
              'lg:mt-0',
            ].join(' ')}
          >
            New Relay
          </Link>
        </header>

        {/* Status summary */}
        <section
          aria-label="Relay status summary"
          className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-4"
        >
          {(
            [
              [
                'Drafts',
                counts.draft,
              ],
              [
                'Scheduled',
                counts.scheduled,
              ],
              [
                'Live',
                counts.live,
              ],
              [
                'Completed',
                counts.completed,
              ],
            ] as const
          ).map(
            ([
              label,
              count,
            ]) => (
              <div
                key={
                  label
                }
                className={[
                  'rounded-2xl',
                  'border',
                  'border-zinc-800',
                  'bg-zinc-950',
                  'px-4',
                  'py-4',
                  'shadow-[0_10px_30px_rgba(0,0,0,0.24)]',
                  'sm:px-5',
                ].join(' ')}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  {label}
                </p>

                <p className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-zinc-50 sm:text-3xl">
                  {count}
                </p>
              </div>
            )
          )}
        </section>

        {/* Filters */}
        <nav
          aria-label="Filter Relays by status"
          className="mt-6 overflow-x-auto pb-2 sm:mt-7"
        >
          <div className="flex min-w-max gap-2">
            {ADMIN_RELAY_FILTERS.map(
              (filter) => {
                const active =
                  activeFilter ===
                  filter.value

                const href =
                  filter.value ===
                    'all'
                    ? '/venue-admin/relay'
                    : `/venue-admin/relay?status=${filter.value}`

                return (
                  <Link
                    key={
                      filter.value
                    }
                    href={
                      href
                    }
                    aria-current={
                      active
                        ? 'page'
                        : undefined
                    }
                    className={[
                      'inline-flex',
                      'min-h-11',
                      'items-center',
                      'justify-center',
                      'rounded-xl',
                      'border',
                      'px-4',
                      'text-sm',
                      'font-bold',
                      'transition',
                      'focus-visible:outline-none',
                      'focus-visible:ring-2',
                      'focus-visible:ring-amber-300',
                      'focus-visible:ring-offset-2',
                      'focus-visible:ring-offset-[#080808]',
                      active
                        ? [
                            'border-amber-400',
                            'bg-amber-400',
                            '!text-zinc-950',
                            'shadow-[0_8px_24px_rgba(251,191,36,0.16)]',
                            'hover:bg-amber-300',
                            'hover:!text-zinc-950',
                          ].join(
                            ' '
                          )
                        : [
                            'border-zinc-700',
                            'bg-zinc-900',
                            '!text-zinc-100',
                            'hover:border-zinc-500',
                            'hover:bg-zinc-800',
                            'hover:!text-white',
                          ].join(
                            ' '
                          ),
                    ].join(' ')}
                  >
                    {filter.label}
                  </Link>
                )
              }
            )}
          </div>
        </nav>

        {/* List heading */}
        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-50">
              {activeFilter ===
              'all'
                ? 'All Relays'
                : ADMIN_RELAY_FILTERS.find(
                    (filter) =>
                      filter.value ===
                      activeFilter
                  )?.label ??
                  'Relays'}
            </h2>

            <p className="mt-1 text-sm font-medium text-zinc-400">
              {filteredRelays.length}{' '}
              {filteredRelays.length ===
              1
                ? 'Relay'
                : 'Relays'}
            </p>
          </div>
        </div>

        {/* Relay list */}
        <section
          aria-label="Relay list"
          className="mt-4"
        >
          {filteredRelays.length ===
          0 ? (
            <RelayAdminEmptyState
              filter={
                activeFilter
              }
            />
          ) : (
            <div className="grid gap-4 sm:gap-5">
              {filteredRelays.map(
                (relay) => (
                  <RelayAdminCard
                    key={
                      relay.id
                    }
                    relay={
                      relay
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}