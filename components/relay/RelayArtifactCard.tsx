// components/relay/RelayArtifactCard.tsx

import Link from 'next/link'

import type {
  ReactNode,
} from 'react'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayArtifactStopPreview = {
  id:
    string

  slotIndex:
    number

  venueLabel:
    string

  contributorLabel:
    string
}


export type RelayArtifactCardProps = {
  artifactId:
    string

  relayId:
    string

  teamId:
    string

  title:
    string

  description?:
    string | null

  city?:
    string | null

  theme?:
    string | null

  stopCount:
    number

  contributorCount:
    number

  completedAt?:
    string | null

  /**
   * Small ordered preview only.
   *
   * The full artifact route should live on the canonical
   * artifact/replay detail surface.
   */
  stops?:
    RelayArtifactStopPreview[]

  replayHref?:
    string | null

  shareHref?:
    string | null

  detailHref?:
    string | null

  /**
   * Optional parent-owned action surface.
   *
   * Examples:
   * - native share button wrapper
   * - save/bookmark action
   *
   * This component owns no mutations.
   */
  secondaryAction?:
    ReactNode

  className?:
    string

  compact?:
    boolean
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayArtifactCard({
  artifactId,
  relayId,
  teamId,
  title,
  description =
    null,
  city =
    null,
  theme =
    null,
  stopCount,
  contributorCount,
  completedAt =
    null,
  stops = [],
  replayHref =
    null,
  shareHref =
    null,
  detailHref =
    null,
  secondaryAction =
    null,
  className,
  compact =
    false,
}: RelayArtifactCardProps) {
  const orderedStops =
    [...stops]
      .sort(
        (
          left,
          right
        ) =>
          left.slotIndex -
          right.slotIndex
      )
      .slice(
        0,
        compact
          ? 3
          : 5
      )


  const hasPrimaryAction =
    Boolean(
      replayHref ||
      detailHref
    )


  const primaryHref =
    replayHref ??
    detailHref


  const primaryLabel =
    replayHref
      ? 'Replay this Roam'
      : 'View artifact'


  return (
    <article
      className={[
        'relative',
        'overflow-hidden',
        'rounded-[30px]',
        'border',
        'border-violet-300/14',
        'bg-violet-300/[0.035]',
        compact
          ? 'p-4'
          : 'p-5 sm:p-6',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      data-relay-artifact-card
      data-artifact-id={
        artifactId
      }
      data-relay-id={
        relayId
      }
      data-team-id={
        teamId
      }
    >
      {/* ======================================================
       * AMBIENT ACCENT
       * ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-300/[0.07] blur-3xl"
      />


      <div className="relative">
        {/* ====================================================
         * HEADER
         * ==================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/16 bg-violet-300/[0.055] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-violet-100/68">
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/[0.08] text-[9px] font-bold"
                >
                  ✓
                </span>

                Relay artifact
              </span>

              <span className="rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/36">
                Replayable Roam
              </span>
            </div>


            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/26">
              {[
                city,
                theme,
              ]
                .filter(
                  Boolean
                )
                .join(
                  ' · '
                )}
            </p>


            <h2
              className={[
                'font-semibold',
                'tracking-[-0.04em]',
                'text-white',
                compact
                  ? 'mt-1.5 text-2xl'
                  : 'mt-2 text-3xl',
              ].join(
                ' '
              )}
            >
              {title}
            </h2>


            {description ? (
              <p
                className={[
                  'max-w-xl',
                  'text-white/40',
                  compact
                    ? 'mt-2 text-xs leading-5'
                    : 'mt-3 text-sm leading-7',
                ].join(
                  ' '
                )}
              >
                {description}
              </p>
            ) : null}
          </div>


          {completedAt ? (
            <div className="shrink-0 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/22">
                Completed
              </p>

              <p className="mt-1 text-xs font-medium text-violet-100/56">
                {formatArtifactDate(
                  completedAt
                )}
              </p>
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * METRICS
         * ==================================================== */}

        <dl
          className={[
            'grid',
            'gap-px',
            'overflow-hidden',
            'rounded-2xl',
            'border',
            'border-white/[0.07]',
            'bg-white/[0.07]',
            compact
              ? 'mt-4 grid-cols-2'
              : 'mt-5 sm:grid-cols-3',
          ].join(
            ' '
          )}
        >
          <ArtifactMetric
            label="Stops"
            value={`${stopCount}`}
          />

          <ArtifactMetric
            label="Contributors"
            value={`${contributorCount}`}
          />

          {!compact ? (
            <ArtifactMetric
              label="Format"
              value="Collaborative"
            />
          ) : null}
        </dl>


        {/* ====================================================
         * ROUTE PREVIEW
         * ==================================================== */}

        {orderedStops.length >
        0 ? (
          <div
            className={[
              'rounded-[22px]',
              'border',
              'border-white/[0.07]',
              'bg-black/15',
              compact
                ? 'mt-4 p-3'
                : 'mt-5 p-4',
            ].join(
              ' '
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/22">
                  Route preview
                </p>

                <p className="mt-1 text-xs text-white/30">
                  Ordered collaborative stops
                </p>
              </div>

              <span className="text-[10px] font-medium text-white/24">
                {stopCount}{' '}
                {stopCount ===
                1
                  ? 'stop'
                  : 'stops'}
              </span>
            </div>


            <ol className="mt-3 space-y-2">
              {orderedStops.map(
                (
                  stop
                ) => (
                  <ArtifactStopPreviewRow
                    key={
                      stop.id
                    }
                    stop={
                      stop
                    }
                  />
                )
              )}
            </ol>


            {stopCount >
            orderedStops.length ? (
              <p className="mt-3 text-[10px] text-white/22">
                +{
                  stopCount -
                  orderedStops.length
                } more stop
                {stopCount -
                  orderedStops.length ===
                1
                  ? ''
                  : 's'}
              </p>
            ) : null}
          </div>
        ) : null}


        {/* ====================================================
         * ACTIONS
         * ==================================================== */}

        {(hasPrimaryAction ||
          shareHref ||
          secondaryAction) ? (
          <div
            className={[
              'flex',
              'flex-col',
              'gap-2',
              'border-t',
              'border-white/[0.07]',
              compact
                ? 'mt-4 pt-4'
                : 'mt-5 pt-5',
              'sm:flex-row',
              'sm:items-center',
            ].join(
              ' '
            )}
          >
            {hasPrimaryAction &&
            primaryHref ? (
              <Link
                href={
                  primaryHref
                }
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-violet-300/18 bg-violet-300/[0.07] px-5 text-sm font-semibold text-violet-50 transition hover:border-violet-300/28 hover:bg-violet-300/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
              >
                {primaryLabel}
              </Link>
            ) : null}


            {shareHref ? (
              <Link
                href={
                  shareHref
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/[0.09] bg-black/15 px-5 text-sm font-semibold text-white/52 transition hover:border-white/[0.15] hover:bg-white/[0.04] hover:text-white/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]"
              >
                Share
              </Link>
            ) : null}


            {secondaryAction ? (
              <div className="shrink-0">
                {secondaryAction}
              </div>
            ) : null}
          </div>
        ) : null}


        {/* ====================================================
         * ARTIFACT NOTE
         * ==================================================== */}

        <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/21">
          This card represents a materialized Relay artifact. Replay
          and share surfaces should resolve from this artifact&apos;s
          canonical identity rather than reconstructing the finished
          route from live team state.
        </p>
      </div>
    </article>
  )
}


/* ============================================================
 * STOP PREVIEW
 * ============================================================
 */

function ArtifactStopPreviewRow({
  stop,
}: {
  stop:
    RelayArtifactStopPreview
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#090909] px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-300/12 bg-violet-300/[0.04] text-[9px] font-semibold text-violet-100/58">
        {
          stop.slotIndex
        }
      </div>


      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white/58">
          {
            stop.venueLabel
          }
        </p>

        <p className="mt-0.5 truncate text-[10px] text-white/24">
          by{' '}
          {
            stop.contributorLabel
          }
        </p>
      </div>
    </li>
  )
}


/* ============================================================
 * METRIC
 * ============================================================
 */

function ArtifactMetric({
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

      <dd className="mt-1.5 truncate text-sm font-medium text-white/62">
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * DATE
 * ============================================================
 */

function formatArtifactDate(
  value:
    string
): string {
  const date =
    new Date(
      value
    )


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Completed'
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


export default RelayArtifactCard