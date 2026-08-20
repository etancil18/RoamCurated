export type CompetitionLiveSignalState =
  | 'leading'
  | 'close'
  | 'not_enough_evidence'
  | 'settled'
  | 'unavailable'

export type CompetitionLiveSignalTone =
  | 'neutral'
  | 'positive'
  | 'caution'

export type CompetitionLiveSignalProps = {
  state: CompetitionLiveSignalState

  /**
   * Optional supporting copy supplied by the parent.
   *
   * Keep this qualitative.
   * Do not pass exact score values here during live competition.
   */
  detail?: string | null

  /**
   * Optional compact variant for dense cards.
   */
  compact?: boolean

  className?: string
}

export default function CompetitionLiveSignal({
  state,
  detail = null,
  compact = false,
  className = '',
}: CompetitionLiveSignalProps) {
  const presentation =
    getLiveSignalPresentation(
      state
    )

  return (
    <div
      className={[
        compact
          ? 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5'
          : 'rounded-2xl border px-4 py-3.5',
        presentation.wrapperClassName,
        className,
      ].join(' ')}
      aria-live="polite"
    >
      {compact ? (
        <>
          <span
            aria-hidden="true"
            className={[
              'h-2 w-2 shrink-0 rounded-full',
              presentation.dotClassName,
            ].join(' ')}
          />

          <span
            className={[
              'text-xs font-semibold',
              presentation.textClassName,
            ].join(' ')}
          >
            {
              presentation.label
            }
          </span>
        </>
      ) : (
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={[
              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
              presentation.dotClassName,
            ].join(' ')}
          />

          <div className="min-w-0">
            <p
              className={[
                'text-sm font-semibold',
                presentation.textClassName,
              ].join(' ')}
            >
              {
                presentation.label
              }
            </p>

            <p className="mt-1 text-xs leading-5 text-white/40">
              {detail?.trim()
                ? detail
                : presentation.description}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function getLiveSignalPresentation(
  state: CompetitionLiveSignalState
): {
  label: string
  description: string
  wrapperClassName: string
  textClassName: string
  dotClassName: string
  tone: CompetitionLiveSignalTone
} {
  switch (state) {
    case 'leading':
      return {
        label:
          'Leading',

        description:
          'This contender currently has the stronger verified signal, but the result is not settled.',

        wrapperClassName:
          'border-emerald-300/20 bg-emerald-300/[0.05]',

        textClassName:
          'text-emerald-100',

        dotClassName:
          'bg-emerald-300',

        tone:
          'positive',
      }

    case 'close':
      return {
        label:
          'Close',

        description:
          'The current evidence does not clearly separate the contenders yet.',

        wrapperClassName:
          'border-amber-300/20 bg-amber-300/[0.05]',

        textClassName:
          'text-amber-100',

        dotClassName:
          'bg-amber-300',

        tone:
          'caution',
      }

    case 'not_enough_evidence':
      return {
        label:
          'Not enough evidence yet',

        description:
          'More qualified participation is needed before the live signal is meaningful.',

        wrapperClassName:
          'border-white/10 bg-white/[0.03]',

        textClassName:
          'text-white/60',

        dotClassName:
          'bg-white/25',

        tone:
          'neutral',
      }

    case 'settled':
      return {
        label:
          'Settled',

        description:
          'The live phase is over and the competition result has been finalized.',

        wrapperClassName:
          'border-violet-300/20 bg-violet-300/[0.045]',

        textClassName:
          'text-violet-100',

        dotClassName:
          'bg-violet-300',

        tone:
          'neutral',
      }

    case 'unavailable':
    default:
      return {
        label:
          'Signal unavailable',

        description:
          'A reliable live signal is not available right now.',

        wrapperClassName:
          'border-white/10 bg-white/[0.025]',

        textClassName:
          'text-white/45',

        dotClassName:
          'bg-white/20',

        tone:
          'neutral',
      }
  }
}