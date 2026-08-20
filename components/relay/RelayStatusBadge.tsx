// components/relay/RelayStatusBadge.tsx

import type {
  RelayStatus,
  RelayTeamSlotStatus,
  RelayTeamStatus,
} from '@/lib/relay/types'


type RelayStatusBadgeKind =
  | 'relay'
  | 'team'
  | 'slot'


type RelayStatusBadgeProps =
  | {
      kind: 'relay'
      status: RelayStatus
      className?: string
      compact?: boolean
    }
  | {
      kind: 'team'
      status: RelayTeamStatus
      className?: string
      compact?: boolean
    }
  | {
      kind: 'slot'
      status: RelayTeamSlotStatus
      className?: string
      compact?: boolean
    }


type StatusTone =
  | 'neutral'
  | 'scheduled'
  | 'live'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted'


type StatusConfig = {
  tone: StatusTone
  label: string
  dot: boolean
}


/* ============================================================
 * STYLE MAP
 * ============================================================
 *
 * Intentionally local and dependency-free.
 *
 * This component should remain usable even if the wider design
 * system changes later.
 *
 * The palette is tuned for high legibility on dark surfaces,
 * including mobile displays with reduced brightness.
 * ============================================================
 */

const toneClassNames: Record<
  StatusTone,
  string
> = {
  neutral:
    [
      'border-white/[0.18]',
      'bg-white/[0.09]',
      'text-white/90',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    ].join(' '),

  scheduled:
    [
      'border-sky-300/[0.30]',
      'bg-sky-300/[0.13]',
      'text-sky-50',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    ].join(' '),

  live:
    [
      'border-amber-300/[0.36]',
      'bg-amber-300/[0.16]',
      'text-amber-50',
      'shadow-[0_0_20px_rgba(251,191,36,0.10),inset_0_1px_0_rgba(255,255,255,0.05)]',
    ].join(' '),

  success:
    [
      'border-emerald-300/[0.30]',
      'bg-emerald-300/[0.13]',
      'text-emerald-50',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    ].join(' '),

  warning:
    [
      'border-orange-300/[0.30]',
      'bg-orange-300/[0.13]',
      'text-orange-50',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    ].join(' '),

  danger:
    [
      'border-rose-300/[0.30]',
      'bg-rose-300/[0.13]',
      'text-rose-50',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    ].join(' '),

  muted:
    [
      'border-white/[0.14]',
      'bg-white/[0.055]',
      'text-white/68',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    ].join(' '),
}


const dotClassNames: Record<
  StatusTone,
  string
> = {
  neutral:
    'bg-white/70 shadow-[0_0_0_2px_rgba(255,255,255,0.06)]',

  scheduled:
    'bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.45)]',

  live:
    'bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.85)]',

  success:
    'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.42)]',

  warning:
    'bg-orange-300 shadow-[0_0_10px_rgba(253,186,116,0.42)]',

  danger:
    'bg-rose-300 shadow-[0_0_10px_rgba(253,164,175,0.42)]',

  muted:
    'bg-white/45 shadow-[0_0_0_2px_rgba(255,255,255,0.04)]',
}


/* ============================================================
 * STATUS CONFIG
 * ============================================================
 */

function getRelayStatusConfig(
  status: RelayStatus
): StatusConfig {
  switch (status) {
    case 'draft':
      return {
        tone:
          'muted',
        label:
          'Not published',
        dot:
          false,
      }

    case 'scheduled':
      return {
        tone:
          'scheduled',
        label:
          'Upcoming',
        dot:
          true,
      }

    case 'live':
      return {
        tone:
          'live',
        label:
          'Live now',
        dot:
          true,
      }

    case 'completed':
      return {
        tone:
          'success',
        label:
          'Completed',
        dot:
          true,
      }

    case 'cancelled':
      return {
        tone:
          'danger',
        label:
          'Cancelled',
        dot:
          false,
      }
  }
}


function getRelayTeamStatusConfig(
  status: RelayTeamStatus
): StatusConfig {
  switch (status) {
    case 'forming':
      return {
        tone:
          'neutral',
        label:
          'Building team',
        dot:
          false,
      }

    case 'ready':
      return {
        tone:
          'scheduled',
        label:
          'Ready to start',
        dot:
          true,
      }

    case 'active':
      return {
        tone:
          'live',
        label:
          'In progress',
        dot:
          true,
      }

    case 'completed':
      return {
        tone:
          'success',
        label:
          'Completed',
        dot:
          true,
      }

    case 'abandoned':
      return {
        tone:
          'muted',
        label:
          'Ended early',
        dot:
          false,
      }

    case 'disqualified':
      return {
        tone:
          'danger',
        label:
          'Can’t continue',
        dot:
          false,
      }
  }
}


function getRelayTeamSlotStatusConfig(
  status: RelayTeamSlotStatus
): StatusConfig {
  switch (status) {
    case 'locked':
      return {
        tone:
          'muted',
        label:
          'Waiting',
        dot:
          false,
      }

    case 'active':
      return {
        tone:
          'live',
        label:
          'Up now',
        dot:
          true,
      }

    case 'completed':
      return {
        tone:
          'success',
        label:
          'Finished',
        dot:
          true,
      }

    case 'skipped':
      return {
        tone:
          'warning',
        label:
          'Skipped',
        dot:
          false,
      }
  }
}


function getStatusConfig(
  kind: RelayStatusBadgeKind,
  status:
    | RelayStatus
    | RelayTeamStatus
    | RelayTeamSlotStatus
): StatusConfig {
  switch (kind) {
    case 'relay':
      return getRelayStatusConfig(
        status as RelayStatus
      )

    case 'team':
      return getRelayTeamStatusConfig(
        status as RelayTeamStatus
      )

    case 'slot':
      return getRelayTeamSlotStatusConfig(
        status as RelayTeamSlotStatus
      )
  }
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayStatusBadge(
  props: RelayStatusBadgeProps
) {
  const {
    kind,
    status,
    className,
    compact = false,
  } = props

  const config =
    getStatusConfig(
      kind,
      status
    )

  const sizeClassName =
    compact
      ? [
          'min-h-7',
          'gap-1.5',
          'px-2.5',
          'py-1.5',
          'text-[10px]',
          'sm:text-[11px]',
        ].join(' ')
      : [
          'min-h-8',
          'gap-2',
          'px-3',
          'py-1.5',
          'text-[11px]',
          'sm:text-xs',
        ].join(' ')

  return (
    <span
      className={[
        'inline-flex',
        'w-fit',
        'max-w-full',
        'shrink-0',
        'items-center',
        'rounded-full',
        'border',
        'font-semibold',
        'uppercase',
        'tracking-[0.12em]',
        'leading-none',
        'antialiased',
        'backdrop-blur-md',
        'transition-colors',
        sizeClassName,
        toneClassNames[
          config.tone
        ],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-relay-status-kind={
        kind
      }
      data-relay-status={
        status
      }
    >
      {config.dot ? (
        <span
          aria-hidden="true"
          className={[
            'block',
            'h-2',
            'w-2',
            'shrink-0',
            'rounded-full',
            dotClassNames[
              config.tone
            ],
          ].join(' ')}
        />
      ) : null}

      <span className="truncate">
        {config.label}
      </span>
    </span>
  )
}


export default RelayStatusBadge