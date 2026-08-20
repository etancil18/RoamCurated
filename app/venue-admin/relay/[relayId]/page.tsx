// app/venue-admin/relay/[relayId]/page.tsx

import type {
  Metadata,
} from 'next'
import Link from 'next/link'
import {
  notFound,
} from 'next/navigation'

import RelayRewardSummary from '@/components/relay/RelayRewardSummary'
import RelaySlotList from '@/components/relay/RelaySlotList'
import RelayStatusBadge from '@/components/relay/RelayStatusBadge'
import { RelayAuthoringForm } from '@/components/venue-admin/relay/RelayAuthoringForm'
import PublishRelayButton from '@/components/venue-admin/relay/PublishRelayButton'
import RelayTemplateAuthoringPanel from '@/components/venue-admin/relay/RelayTemplateAuthoringPanel'
import {
  updateRelayDefinition,
} from '@/lib/relay/actions'
import {
  formatRelaySlotCount,
  formatRelayTeamSize,
  formatRelayTimeWindow,
} from '@/lib/relay/format'
import {
  getRelayDefinition,
  getRelayRewardPolicyDisplay,
  getRelayVenueOptions,
} from '@/lib/relay/queries'
import type {
  RelayDefinition,
  RelayId,
  RelayRewardPolicyDisplay,
} from '@/lib/relay/types'


/* ============================================================
 * ROUTE CONFIG
 * ============================================================
 *
 * Relay authoring is operational state.
 *
 * Never statically cache an admin edit surface.
 * ============================================================
 */

export const dynamic =
  'force-dynamic'


/* ============================================================
 * TYPES
 * ============================================================
 */

type PageProps = {
  params:
    Promise<{
      relayId: string
    }>
}


/* ============================================================
 * INPUT NORMALIZATION
 * ============================================================
 */

function normalizeRelayId(
  value: string
): RelayId {
  const normalized =
    value.trim()

  if (!normalized) {
    notFound()
  }

  return normalized
}


/* ============================================================
 * DATA LOADER
 * ============================================================
 *
 * One canonical loader is shared by page rendering and metadata.
 *
 * Reads only.
 * ============================================================
 */

async function loadRelayAdminDetail(
  relayId: RelayId
): Promise<{
  relay: RelayDefinition
  rewardPolicy:
    RelayRewardPolicyDisplay | null
}> {
  const [
    relay,
    rewardPolicy,
  ] = await Promise.all([
    getRelayDefinition(
      relayId
    ),

    getRelayRewardPolicyDisplay(
      relayId
    ),
  ])

  if (!relay) {
    notFound()
  }

  return {
    relay,
    rewardPolicy,
  }
}


/* ============================================================
 * METADATA
 * ============================================================
 */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    relayId,
  } = await params

  const normalizedRelayId =
    normalizeRelayId(
      relayId
    )

  const relay =
    await getRelayDefinition(
      normalizedRelayId
    )

  if (!relay) {
    return {
      title:
        'Relay not found · Venue Admin',
    }
  }

  return {
    title:
      `${relay.title} · Relay · Venue Admin`,

    description:
      relay.description ??
      `Manage ${relay.title} in Venue Admin.`,
  }
}


/* ============================================================
 * SUMMARY CARD
 * ============================================================
 */

function RelayAdminSummary({
  relay,
}: {
  relay:
    RelayDefinition
}) {
  return (
    <section
      aria-labelledby="relay-admin-summary-heading"
      className={[
        'rounded-3xl',
        'border',
        'border-zinc-800',
        'bg-zinc-950',
        'p-5',
        'shadow-[0_18px_60px_rgba(0,0,0,0.30)]',
      ].join(' ')}
    >
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
        id="relay-admin-summary-heading"
        className={[
          'mt-4',
          'text-lg',
          'font-semibold',
          'tracking-[-0.025em]',
          'text-zinc-50',
        ].join(' ')}
      >
        Current Relay
      </h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5">
          <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
            Route
          </dt>

          <dd className="mt-1.5 text-sm font-semibold text-zinc-50">
            {formatRelaySlotCount(
              relay.slots.length
            )}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5">
          <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
            Team
          </dt>

          <dd className="mt-1.5 text-sm font-semibold text-zinc-50">
            {formatRelayTeamSize(
              relay.minTeamSize,
              relay.maxTeamSize
            )}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 sm:col-span-2 lg:col-span-1">
          <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
            Window
          </dt>

          <dd className="mt-1.5 text-sm font-semibold leading-5 text-zinc-50">
            {formatRelayTimeWindow(
              relay.startsAt,
              relay.endsAt
            )}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5">
          <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
            City
          </dt>

          <dd className="mt-1.5 text-sm font-semibold text-zinc-50">
            {relay.city?.trim() ||
              'Not set'}
          </dd>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5">
          <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
            Theme
          </dt>

          <dd className="mt-1.5 text-sm font-semibold text-zinc-50">
            {relay.theme?.trim() ||
              'Not set'}
          </dd>
        </div>
      </dl>
    </section>
  )
}


/* ============================================================
 * PREVIEW
 * ============================================================
 */

function RelayAdminPreview({
  relay,
  rewardPolicy,
}: {
  relay:
    RelayDefinition

  rewardPolicy:
    RelayRewardPolicyDisplay | null
}) {
  return (
    <section
      aria-labelledby="relay-admin-preview-heading"
      className={[
        'rounded-3xl',
        'border',
        'border-zinc-800',
        'bg-zinc-950',
        'p-5',
        'shadow-[0_18px_60px_rgba(0,0,0,0.28)]',
        'sm:p-6',
      ].join(' ')}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
          Consumer preview
        </p>

        <h2
          id="relay-admin-preview-heading"
          className="mt-2 text-lg font-semibold tracking-[-0.025em] text-zinc-50 sm:text-xl"
        >
          {relay.title}
        </h2>

        {relay.description ? (
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {relay.description}
          </p>
        ) : null}
      </div>

      <div className="mt-5">
        <RelaySlotList
          slots={
            relay.slots
          }
          variant="preview"
          showPrompts
          showConstraints
        />
      </div>

      {rewardPolicy ? (
        <div className="mt-5">
          <RelayRewardSummary
            policy={
              rewardPolicy
            }
            variant="admin"
          />
        </div>
      ) : null}
    </section>
  )
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default async function RelayAdminDetailPage({
  params,
}: PageProps) {
  const {
    relayId,
  } = await params

  const normalizedRelayId =
    normalizeRelayId(
      relayId
    )

  const {
    relay,
    rewardPolicy,
  } =
    await loadRelayAdminDetail(
      normalizedRelayId
    )

  const venueOptions =
    await getRelayVenueOptions(
      relay.city
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
        {/* ====================================================
         * BREADCRUMBS
         * ==================================================== */}

        <nav
          aria-label="Relay admin breadcrumb"
          className="mb-5 sm:mb-6"
        >
          <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-xs font-medium">
            <li>
              <Link
                href="/venue-admin"
                className={[
                  '!text-zinc-400',
                  'transition-colors',
                  'hover:!text-zinc-100',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-amber-300',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-[#080808]',
                ].join(' ')}
              >
                Venue Admin
              </Link>
            </li>

            <li
              aria-hidden="true"
              className="text-zinc-600"
            >
              /
            </li>

            <li>
              <Link
                href="/venue-admin/relay"
                className={[
                  '!text-zinc-400',
                  'transition-colors',
                  'hover:!text-zinc-100',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-amber-300',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-[#080808]',
                ].join(' ')}
              >
                Relays
              </Link>
            </li>

            <li
              aria-hidden="true"
              className="text-zinc-600"
            >
              /
            </li>

            <li
              aria-current="page"
              className="max-w-[16rem] truncate font-semibold text-zinc-200"
              title={
                relay.title
              }
            >
              {relay.title}
            </li>
          </ol>
        </nav>


        {/* ====================================================
         * HEADER
         * ==================================================== */}

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
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-amber-300">
                Venue Admin · Relay
              </p>

              <RelayStatusBadge
                kind="relay"
                status={
                  relay.status
                }
                compact
              />
            </div>

            <h1
              className={[
                'mt-2.5',
                'break-words',
                'text-3xl',
                'font-semibold',
                'leading-tight',
                'tracking-[-0.045em]',
                'text-zinc-50',
                'sm:text-4xl',
              ].join(' ')}
            >
              {relay.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-[15px]">
              Edit the Relay definition and route template. Execution
              state remains controlled by the Relay team and Active Flow
              RPCs.
            </p>
          </div>

          <div className="mt-5 grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-0 lg:flex lg:w-auto lg:flex-wrap">
            <PublishRelayButton
              relayId={
                relay.id
              }
              status={
                relay.status
              }
            />

            <Link
              href={
                `/relay/${relay.id}`
              }
              className={[
                'inline-flex',
                'min-h-12',
                'w-full',
                'items-center',
                'justify-center',
                'rounded-xl',
                'border',
                'border-amber-400',
                'bg-amber-400',
                'px-4',
                'text-sm',
                'font-bold',
                '!text-zinc-950',
                'shadow-[0_10px_30px_rgba(251,191,36,0.16)]',
                'transition',
                'hover:border-amber-300',
                'hover:bg-amber-300',
                'hover:!text-zinc-950',
                'active:scale-[0.99]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-amber-300',
                'focus-visible:ring-offset-2',
                'focus-visible:ring-offset-[#080808]',
                'lg:w-auto',
              ].join(' ')}
            >
              View consumer page
            </Link>

            <Link
              href="/venue-admin/relay"
              className={[
                'inline-flex',
                'min-h-12',
                'w-full',
                'items-center',
                'justify-center',
                'rounded-xl',
                'border',
                'border-zinc-600',
                'bg-zinc-900',
                'px-4',
                'text-sm',
                'font-bold',
                '!text-zinc-100',
                'transition',
                'hover:border-zinc-500',
                'hover:bg-zinc-800',
                'hover:!text-white',
                'active:scale-[0.99]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-zinc-400',
                'focus-visible:ring-offset-2',
                'focus-visible:ring-offset-[#080808]',
                'lg:w-auto',
              ].join(' ')}
            >
              Back to Relays
            </Link>
          </div>
        </header>


        {/* ====================================================
         * MAIN EDITING GRID
         * ==================================================== */}

        <div
          className={[
            'mt-7',
            'grid',
            'gap-6',
            'xl:grid-cols-[minmax(0,1fr)_22rem]',
          ].join(' ')}
        >
          {/* ==================================================
           * AUTHORING
           * ================================================== */}

          <section
            aria-labelledby="relay-editor-heading"
            className="min-w-0"
          >
            <div
              className={[
                'mb-4',
                'rounded-2xl',
                'border',
                'border-zinc-800',
                'bg-zinc-950',
                'px-4',
                'py-4',
              ].join(' ')}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                Authoring
              </p>

              <h2
                id="relay-editor-heading"
                className="mt-1.5 text-xl font-semibold tracking-[-0.025em] text-zinc-50"
              >
                Relay definition
              </h2>
            </div>

            <div
              className={[
                'rounded-3xl',
                'border',
                'border-zinc-800',
                'bg-zinc-950',
                'p-4',
                'shadow-[0_18px_60px_rgba(0,0,0,0.28)]',
                'sm:p-5',
                'lg:p-6',
              ].join(' ')}
            >
              <RelayAuthoringForm
                mode="edit"
                initialRelay={
                  relay
                }
                initialRewardPolicy={
                  rewardPolicy
                }
                onUpdate={
                  updateRelayDefinition.bind(
                    null,
                    relay.id
                  )
                }
              />
            </div>


            {/* =================================================
             * ROUTE TEMPLATE AUTHORING
             * ================================================= */}

            <div
              className={[
                'mt-6',
                'rounded-3xl',
                'border',
                'border-zinc-800',
                'bg-zinc-950',
                'p-4',
                'shadow-[0_18px_60px_rgba(0,0,0,0.28)]',
                'sm:p-5',
                'lg:p-6',
              ].join(' ')}
            >
              <RelayTemplateAuthoringPanel
                relay={
                  relay
                }
                venueOptions={
                  venueOptions
                }
              />
            </div>
          </section>


          {/* ==================================================
           * SIDEBAR
           * ================================================== */}

          <aside
            aria-label="Relay administration summary"
            className="space-y-4 xl:sticky xl:top-6 xl:self-start"
          >
            <RelayAdminSummary
              relay={
                relay
              }
            />

            {relay.slots.length ===
            0 ? (
              <div
                className={[
                  'rounded-2xl',
                  'border',
                  'border-amber-500/40',
                  'bg-amber-950',
                  'px-4',
                  'py-4',
                  'shadow-[0_10px_30px_rgba(0,0,0,0.22)]',
                ].join(' ')}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-amber-300">
                  Needs attention
                </p>

                <p className="mt-2 text-sm font-semibold text-amber-50">
                  No route template
                </p>

                <p className="mt-1.5 text-xs leading-5 text-amber-100/80">
                  Add the required Relay legs before this Relay can
                  become a usable team experience.
                </p>
              </div>
            ) : null}

            {relay.status ===
            'live' ? (
              <div
                className={[
                  'rounded-2xl',
                  'border',
                  'border-amber-500/40',
                  'bg-amber-950',
                  'px-4',
                  'py-4',
                  'shadow-[0_10px_30px_rgba(0,0,0,0.22)]',
                ].join(' ')}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-amber-300">
                  Live Relay
                </p>

                <p className="mt-2 text-xs leading-5 text-amber-100/80">
                  Treat structural edits carefully while teams may
                  already be executing this Relay. Database constraints
                  and trusted admin actions should decide which edits
                  remain legal.
                </p>
              </div>
            ) : null}
          </aside>
        </div>


        {/* ====================================================
         * CANONICAL PREVIEW
         * ==================================================== */}

        <div className="mt-8 border-t border-zinc-800 pt-8">
          <RelayAdminPreview
            relay={
              relay
            }
            rewardPolicy={
              rewardPolicy
            }
          />
        </div>
      </div>
    </main>
  )
}