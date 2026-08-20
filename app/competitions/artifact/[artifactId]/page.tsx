// app/competitions/artifact/[artifactId]/page.tsx

import Link from 'next/link'

import {
  notFound,
} from 'next/navigation'

import RelayArtifactCard from '@/components/relay/RelayArtifactCard'

import {
  getRelayArtifactReplayLookup,
} from '@/lib/relay/queries'

import type {
  RelayArtifactSlot,
} from '@/lib/relay/types'


export const dynamic =
  'force-dynamic'


/* ============================================================
 * ROUTE CONTRACT
 * ============================================================
 */

type RelayArtifactPageProps = {
  params:
    Promise<{
      artifactId:
        string
    }>
}


/* ============================================================
 * PAGE
 * ============================================================
 */

export default async function RelayArtifactPage({
  params,
}: RelayArtifactPageProps) {
  const {
    artifactId,
  } =
    await params


  const {
    artifact,
    snapshot,
  } =
    await getRelayArtifactReplayLookup(
      artifactId
    )


  /*
   * This route is public.
   *
   * getRelayArtifactReplayLookup() uses the admin client internally,
   * so the public/replayable snapshot is the publication gate.
   *
   * An artifact record existing by itself is not enough to expose it
   * publicly.
   */
  if (
    !artifact ||
    !snapshot
  ) {
    notFound()
  }


  const orderedSlots =
    [...artifact.slots].sort(
      (
        left,
        right
      ) =>
        left.slotIndex -
        right.slotIndex
    )


  const contributorLabels =
    buildContributorLabels(
      orderedSlots
    )


  const previewStops =
    orderedSlots.map(
      (
        slot
      ) => ({
        id:
          slot.id,

        slotIndex:
          slot.slotIndex,

        venueLabel:
          getStopLabel(
            slot
          ),

        contributorLabel:
          getContributorLabel({
            slot,
            contributorLabels,
          }),
      })
    )


  const contributorCount =
    countDistinctContributors(
      orderedSlots
    )


  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* ====================================================
         * PUBLIC NAV
         * ==================================================== */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/competitions"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-semibold text-white/45 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
          >
            Competitions
          </Link>

          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/22">
            Public Relay artifact
          </span>
        </div>


        {/* ====================================================
         * ARTIFACT HERO
         * ==================================================== */}

        <RelayArtifactCard
          artifactId={
            artifact.id
          }
          relayId={
            artifact.relayId
          }
          teamId={
            artifact.teamId
          }
          title={
            artifact.title
          }
          city={
            artifact.city
          }
          theme={
            artifact.theme
          }
          stopCount={
            orderedSlots.length
          }
          contributorCount={
            contributorCount
          }
          completedAt={
            artifact.completedAt
          }
          stops={
            previewStops
          }
          detailHref={
            `/competitions/artifact/${artifact.id}`
          }
        />


        {/* ====================================================
         * PUBLICATION STATE
         * ==================================================== */}

        <section className="mt-8 rounded-[26px] border border-violet-300/12 bg-violet-300/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-100/38">
                Published route
              </p>

              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                A finished collaborative Roam.
              </h1>

              <p className="mt-3 text-sm leading-7 text-white/40">
                This route was materialized from completed Relay
                execution and published through its canonical public
                flow snapshot.
              </p>
            </div>


            <div className="grid shrink-0 grid-cols-2 gap-2">
              <SummaryMetric
                label="Stops"
                value={`${orderedSlots.length}`}
              />

              <SummaryMetric
                label="Contributors"
                value={`${contributorCount}`}
              />
            </div>
          </div>
        </section>


        {/* ====================================================
         * ORDERED COLLABORATIVE ROUTE
         * ==================================================== */}

        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
                Collaborative route
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                Stop by stop
              </h2>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/34">
              Stop order and contributor attribution come from the
              immutable Relay artifact slots.
            </p>
          </div>


          {orderedSlots.length >
          0 ? (
            <ol className="relative mt-5 space-y-3">
              {orderedSlots.map(
                (
                  slot,
                  index
                ) => (
                  <ArtifactRouteStop
                    key={
                      slot.id
                    }
                    slot={
                      slot
                    }
                    contributorLabel={
                      getContributorLabel({
                        slot,
                        contributorLabels,
                      })
                    }
                    isFirst={
                      index ===
                      0
                    }
                    isLast={
                      index ===
                      orderedSlots.length -
                        1
                    }
                  />
                )
              )}
            </ol>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-white/[0.08] px-5 py-12 text-center">
              <p className="text-sm font-medium text-white/38">
                No materialized artifact stops are available.
              </p>
            </div>
          )}
        </section>


        {/* ====================================================
         * SNAPSHOT / REPLAY STATE
         * ==================================================== */}

        <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/26">
                Replay snapshot
              </p>

              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
                This artifact has a canonical replay source.
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/38">
                Replayability is validated from the existing public,
                completed, replayable flow snapshot. This page does not
                reconstruct the route from Relay execution tables.
              </p>
            </div>


            <span className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/14 bg-emerald-300/[0.045] px-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-emerald-100/62">
              Replayable
            </span>
          </div>


          <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
            <SnapshotMetric
              label="Snapshot stops"
              value={`${snapshot.totalStops}`}
            />

            <SnapshotMetric
              label="Checked in"
              value={`${snapshot.checkedInCount}`}
            />

            <SnapshotMetric
              label="Visibility"
              value="Public"
            />
          </dl>


          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-4">
            <p className="text-xs leading-6 text-white/30">
              The canonical replay snapshot is present and valid.
              The replay CTA should be attached here only through the
              app&apos;s existing snapshot replay endpoint using{' '}
              <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/42">
                public_flow_snapshot_id
              </code>
              . This route intentionally does not invent a second replay
              action.
            </p>
          </div>
        </section>


        {/* ====================================================
         * PROVENANCE
         * ==================================================== */}

        <section className="mt-8 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/26">
            Artifact provenance
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
            Frozen after Relay completion.
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/38">
            This public page reads from materialized Relay artifact
            records and their immutable ordered artifact slots. It does
            not expose private team membership state or rebuild the
            finished route from mutable execution records.
          </p>


          <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3">
            <ArtifactMetadata
              label="Completed"
              value={
                formatDate(
                  artifact.completedAt
                )
              }
            />

            <ArtifactMetadata
              label="City"
              value={
                artifact.city ??
                '—'
              }
            />

            <ArtifactMetadata
              label="Format"
              value="Collaborative Relay"
            />
          </dl>
        </section>


        {/* ====================================================
         * FOOTER
         * ==================================================== */}

        <footer className="mt-8 border-t border-white/[0.07] pt-6">
          <p className="max-w-3xl text-xs leading-6 text-white/25">
            Public access is gated by the artifact&apos;s canonical
            completed, public, replayable flow snapshot. Internal user,
            venue, team-slot, and flow-session identifiers are never
            rendered into this public presentation.
          </p>
        </footer>
      </div>
    </main>
  )
}


/* ============================================================
 * ARTIFACT ROUTE STOP
 * ============================================================
 */

function ArtifactRouteStop({
  slot,
  contributorLabel,
  isFirst,
  isLast,
}: {
  slot:
    RelayArtifactSlot

  contributorLabel:
    string

  isFirst:
    boolean

  isLast:
    boolean
}) {
  return (
    <li className="relative">
      {!isFirst ? (
        <div
          aria-hidden="true"
          className="absolute -top-3 left-[1.15rem] h-3 w-px bg-violet-300/18"
        />
      ) : null}


      {!isLast ? (
        <div
          aria-hidden="true"
          className="absolute -bottom-3 left-[1.15rem] h-3 w-px bg-violet-300/18"
        />
      ) : null}


      <article className="rounded-[24px] border border-white/[0.075] bg-white/[0.025] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/16 bg-violet-300/[0.05] text-[10px] font-semibold text-violet-100/62">
            {
              slot.slotIndex
            }
          </div>


          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.03] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/52">
                    Completed
                  </span>

                  <span className="rounded-full border border-white/[0.07] bg-black/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/32">
                    Relay stop
                  </span>
                </div>

                <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white/78">
                  {getStopLabel(
                    slot
                  )}
                </h3>

                <p className="mt-1.5 text-sm leading-6 text-white/36">
                  Completed by{' '}
                  <span className="font-medium text-violet-100/56">
                    {contributorLabel}
                  </span>
                  .
                </p>
              </div>


              {slot.completedAt ? (
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/21">
                    Completed
                  </p>

                  <p className="mt-1 text-xs text-white/36">
                    {formatDateTime(
                      slot.completedAt
                    )}
                  </p>
                </div>
              ) : null}
            </div>


            <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-white/[0.065] bg-white/[0.06] sm:grid-cols-2">
              <RouteMetric
                label="Contributor"
                value={
                  contributorLabel
                }
              />

              <RouteMetric
                label="Check-in"
                value={
                  formatDateTime(
                    slot.checkedInAt
                  )
                }
              />
            </dl>
          </div>
        </div>
      </article>
    </li>
  )
}


/* ============================================================
 * SUMMARY METRIC
 * ============================================================
 */

function SummaryMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-[7rem] rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-semibold text-white/64">
        {value}
      </p>
    </div>
  )
}


/* ============================================================
 * SNAPSHOT METRIC
 * ============================================================
 */

function SnapshotMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="bg-[#0b0b0b] px-4 py-4">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-medium text-white/60">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * ROUTE METRIC
 * ============================================================
 */

function RouteMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="bg-[#090909] px-4 py-3.5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
        {label}
      </dt>

      <dd className="mt-1.5 truncate text-xs font-medium text-white/48">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * ARTIFACT METADATA
 * ============================================================
 */

function ArtifactMetadata({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="bg-[#0b0b0b] px-4 py-4">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
        {label}
      </dt>

      <dd className="mt-1.5 text-sm font-medium text-white/60">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * PUBLIC PRESENTATION HELPERS
 * ============================================================
 */

function buildContributorLabels(
  slots:
    RelayArtifactSlot[]
): Map<
  string,
  string
> {
  const labels =
    new Map<
      string,
      string
    >()


  let nextContributorNumber =
    1


  for (
    const slot
    of slots
  ) {
    if (
      !slot.contributorUserId
    ) {
      continue
    }


    if (
      labels.has(
        slot.contributorUserId
      )
    ) {
      continue
    }


    labels.set(
      slot.contributorUserId,
      `Contributor ${nextContributorNumber}`
    )


    nextContributorNumber +=
      1
  }


  return labels
}


function getContributorLabel({
  slot,
  contributorLabels,
}: {
  slot:
    RelayArtifactSlot

  contributorLabels:
    Map<
      string,
      string
    >
}): string {
  if (
    !slot.contributorUserId
  ) {
    return 'Contributor'
  }


  return (
    contributorLabels.get(
      slot.contributorUserId
    ) ??
    'Contributor'
  )
}


function getStopLabel(
  slot:
    RelayArtifactSlot
): string {
  return `Stop ${slot.slotIndex}`
}


/* ============================================================
 * CONTRIBUTORS
 * ============================================================
 */

function countDistinctContributors(
  slots:
    RelayArtifactSlot[]
): number {
  return new Set(
    slots
      .map(
        (
          slot
        ) =>
          slot.contributorUserId
      )
      .filter(
        (
          userId
        ): userId is string =>
          Boolean(
            userId
          )
      )
  ).size
}


/* ============================================================
 * DATE
 * ============================================================
 */

function formatDate(
  value:
    string | null
): string {
  if (
    !value
  ) {
    return '—'
  }


  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
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
  ).format(
    date
  )
}


function formatDateTime(
  value:
    string | null
): string {
  if (
    !value
  ) {
    return '—'
  }


  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—'
  }


  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',

      hour:
        'numeric',

      minute:
        '2-digit',
    }
  ).format(
    date
  )
}