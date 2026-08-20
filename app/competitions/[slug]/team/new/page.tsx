import Link from 'next/link'

import {
  notFound,
  redirect,
} from 'next/navigation'

import RelayDetailHeader from '@/components/relay/RelayDetailHeader'
import RelayTeamCta from '@/components/relay/RelayTeamCta'

import {
  createRelayTeam,
} from '@/lib/relay/actions'

import {
  getCurrentUserRelayTeam,
  getRelayDefinition,
} from '@/lib/relay/queries'

import {
  createServerClient,
} from '@/lib/supabase/server'

import type {
  RelayDefinition,
} from '@/lib/relay/types'


export const dynamic =
  'force-dynamic'


/* ============================================================
 * ROUTE CONTRACT
 * ============================================================
 */

type NewRelayTeamPageProps = {
  params:
    Promise<{
      relayId:
        string
    }>
}


/* ============================================================
 * PUBLIC RELAY LIFECYCLE
 * ============================================================
 */

type TeamFormationRelayStatus =
  | 'scheduled'
  | 'live'


function canFormTeamForRelayStatus(
  status:
    RelayDefinition['status']
): status is TeamFormationRelayStatus {
  return (
    status ===
      'scheduled' ||
    status ===
      'live'
  )
}


/* ============================================================
 * WINDOW
 * ============================================================
 */

function relayWindowHasEnded(
  endsAt:
    string | null
): boolean {
  if (
    !endsAt
  ) {
    return false
  }

  const endTimestamp =
    new Date(
      endsAt
    ).getTime()

  if (
    Number.isNaN(
      endTimestamp
    )
  ) {
    return false
  }

  return endTimestamp <=
    Date.now()
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default async function NewRelayTeamPage({
  params,
}: NewRelayTeamPageProps) {
  const {
    relayId,
  } =
    await params


  const relay =
    await getRelayDefinition(
      relayId
    )


  if (
    !relay
  ) {
    notFound()
  }


  if (
    !canFormTeamForRelayStatus(
      relay.status
    )
  ) {
    redirect(
      `/competitions/${relay.id}`
    )
  }


  if (
    relayWindowHasEnded(
      relay.endsAt
    )
  ) {
    redirect(
      `/competitions/${relay.id}`
    )
  }


  const supabase =
    await createServerClient()


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  if (
    !user
  ) {
    redirect(
      `/competitions/${relay.id}`
    )
  }


  const currentUserTeamResult =
    await getCurrentUserRelayTeam(
      relay.id,
      user.id
    )


  const existingTeam =
    currentUserTeamResult
      ?.team ??
    null


  if (
    existingTeam
  ) {
    redirect(
      `/competitions/${relay.id}/team`
    )
  }


  const relayIdForAction =
    relay.id


  async function createTeamAction() {
    'use server'


    const result =
      await createRelayTeam(
        relayIdForAction
      )


    if (
      !result.team?.id
    ) {
      throw new Error(
        'Relay team creation completed without returning a team.'
      )
    }


    redirect(
      `/competitions/${relayIdForAction}/team`
    )
  }


  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        {/* ====================================================
         * DETAIL HEADER
         * ==================================================== */}

        <RelayDetailHeader
          relay={
            relay
          }
          context={{
            label:
              'Team formation',

            tone:
              'amber',
          }}
        />


        {/* ====================================================
         * FORMATION CARD
         * ==================================================== */}

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-indigo-400/[0.018] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] ring-1 ring-white/[0.07] sm:p-6">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Before you create the team
              </p>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]">
              You become the captain.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">
              Creating the team establishes the canonical Relay
              roster and makes you its captain. You can then invite
              teammates and assign one required Relay leg to each
              joined contributor before the team becomes ready.
            </p>


            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <FormationStep
                number="01"
                title="Create"
                description="A Relay team is created transactionally with you as captain."
              />

              <FormationStep
                number="02"
                title="Invite"
                description="Invite teammates into the canonical Relay roster."
              />

              <FormationStep
                number="03"
                title="Assign"
                description="Give each joined teammate exactly one Relay leg."
              />
            </div>


            <div className="mt-6 rounded-[1.2rem] bg-black/20 p-4 ring-1 ring-white/[0.055]">
              <p className="text-xs font-black text-white">
                Team structure
              </p>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <FormationMetric
                  label="Required teammates"
                  value={
                    relay.minTeamSize ===
                    relay.maxTeamSize
                      ? `${relay.minTeamSize}`
                      : `${relay.minTeamSize}–${relay.maxTeamSize}`
                  }
                />

                <FormationMetric
                  label="Required Relay legs"
                  value={`${relay.slots.length}`}
                />
              </dl>
            </div>


            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <Link
                href={
                  `/competitions/${relay.id}`
                }
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/[0.035] px-4 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070809]"
              >
                Back to Relay
              </Link>
            </div>
          </div>


          {/* ==================================================
           * CANONICAL TEAM CREATION CTA
           * ================================================== */}

          <RelayTeamCta
            state={{
              kind:
                'form_team',

              label:
                'Form this Relay team',

              description:
                'Create the team now. You will become captain and continue into the team room to invite teammates and assign Relay legs.',

              action:
                createTeamAction,
            }}
            eyebrow="Create team"
          />
        </section>


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        <footer className="mt-8 border-t border-white/[0.06] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-zinc-700">
            Team creation is executed through the canonical Relay
            mutation layer and ultimately through the transactional
            database RPC. This page does not write directly to Relay
            team, membership, or slot tables.
          </p>
        </footer>
      </div>
    </main>
  )
}


/* ============================================================
 * FORMATION STEP
 * ============================================================
 */

function FormationStep({
  number,
  title,
  description,
}: {
  number:
    string

  title:
    string

  description:
    string
}) {
  return (
    <div className="rounded-[1.1rem] bg-black/20 p-4 ring-1 ring-white/[0.055]">
      <p className="text-[10px] font-black tracking-[0.14em] text-cyan-300/70">
        {number}
      </p>

      <p className="mt-2 text-sm font-black text-white">
        {title}
      </p>

      <p className="mt-1.5 text-xs leading-5 text-zinc-600">
        {description}
      </p>
    </div>
  )
}


/* ============================================================
 * FORMATION METRIC
 * ============================================================
 */

function FormationMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div>
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-700">
        {label}
      </dt>

      <dd className="mt-1 text-sm font-black text-zinc-300">
        {value}
      </dd>
    </div>
  )
}