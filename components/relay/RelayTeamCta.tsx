// components/relay/RelayTeamCta.tsx

import Link from 'next/link'

/* ============================================================
 * CTA STATE
 * ============================================================
 */

export type RelayTeamCtaState =
  | {
      kind:
        'form_team'

      label?:
        string

      description?:
        string | null

      action:
        () => Promise<void>
    }
  | {
      kind:
        'view_team'

      href:
        string

      label?:
        string

      description?:
        string | null
    }
  | {
      kind:
        'join_invitation'

      label?:
        string

      description?:
        string | null

      action:
        () => Promise<void>
    }
  | {
      kind:
        'locked'

      label:
        string

      description?:
        string | null
    }


/* ============================================================
 * PROPS
 * ============================================================
 */

export type RelayTeamCtaProps = {
  state:
    RelayTeamCtaState

  className?:
    string

  /**
   * Optional supporting eyebrow above the CTA.
   */
  eyebrow?:
    string

  /**
   * Optional compact treatment for tighter surfaces.
   */
  compact?:
    boolean
}


/* ============================================================
 * PRESENTATION
 * ============================================================
 */

type RelayTeamCtaPresentation = {
  title:
    string

  description:
    string | null

  buttonLabel:
    string | null

  tone:
    'amber'
    | 'violet'
    | 'neutral'
}


function getPresentation(
  state:
    RelayTeamCtaState
): RelayTeamCtaPresentation {
  switch (
    state.kind
  ) {
    case 'form_team':
      return {
        title:
          state.label ??
          'Form a Relay team',

        description:
          state.description ??
          'Create the team, fill every required contributor role, and assign one leg to each teammate.',

        buttonLabel:
          state.label ??
          'Form a Relay team',

        tone:
          'amber',
      }

    case 'view_team':
      return {
        title:
          state.label ??
          'Your Relay team',

        description:
          state.description ??
          'Return to your team room to manage assignments, readiness, and Relay progress.',

        buttonLabel:
          state.label ??
          'View my team',

        tone:
          'violet',
      }

    case 'join_invitation':
      return {
        title:
          state.label ??
          'You have a Relay invitation',

        description:
          state.description ??
          'Join the team before the roster locks so your Relay leg can be assigned.',

        buttonLabel:
          state.label ??
          'Join invitation',

        tone:
          'amber',
      }

    case 'locked':
      return {
        title:
          state.label,

        description:
          state.description ??
          null,

        buttonLabel:
          null,

        tone:
          'neutral',
      }
  }
}


function getToneClassName(
  tone:
    RelayTeamCtaPresentation['tone']
): string {
  switch (
    tone
  ) {
    case 'amber':
      return [
        'border-amber-300/16',
        'bg-amber-300/[0.045]',
      ].join(' ')

    case 'violet':
      return [
        'border-violet-300/14',
        'bg-violet-300/[0.04]',
      ].join(' ')

    case 'neutral':
    default:
      return [
        'border-white/[0.07]',
        'bg-white/[0.02]',
      ].join(' ')
  }
}


function getButtonClassName(
  tone:
    RelayTeamCtaPresentation['tone']
): string {
  switch (
    tone
  ) {
    case 'amber':
      return [
        'border-amber-300/20',
        'bg-amber-300/[0.09]',
        'text-amber-50',
        'hover:border-amber-300/30',
        'hover:bg-amber-300/[0.14]',
        'focus-visible:ring-amber-300/40',
      ].join(' ')

    case 'violet':
      return [
        'border-violet-300/18',
        'bg-violet-300/[0.07]',
        'text-violet-50',
        'hover:border-violet-300/28',
        'hover:bg-violet-300/[0.11]',
        'focus-visible:ring-violet-300/40',
      ].join(' ')

    case 'neutral':
    default:
      return [
        'border-white/[0.09]',
        'bg-white/[0.035]',
        'text-white/55',
        'focus-visible:ring-white/25',
      ].join(' ')
  }
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayTeamCta({
  state,
  className,
  eyebrow =
    'Relay team',
  compact =
    false,
}: RelayTeamCtaProps) {
  const presentation =
    getPresentation(
      state
    )

  const toneClassName =
    getToneClassName(
      presentation.tone
    )

  const buttonClassName =
    getButtonClassName(
      presentation.tone
    )

  return (
    <aside
      className={[
        'rounded-[26px]',
        'border',
        toneClassName,
        compact
          ? 'p-4'
          : 'p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-relay-team-cta={
        state.kind
      }
    >
      <p
        className={[
          'font-semibold',
          'uppercase',
          'tracking-[0.2em]',
          'text-white/30',
          compact
            ? 'text-[9px]'
            : 'text-[10px]',
        ].join(' ')}
      >
        {eyebrow}
      </p>


      <h2
        className={[
          'font-semibold',
          'tracking-[-0.025em]',
          'text-white',
          compact
            ? 'mt-1.5 text-lg'
            : 'mt-2 text-xl',
        ].join(' ')}
      >
        {
          presentation.title
        }
      </h2>


      {presentation.description ? (
        <p
          className={[
            'text-white/42',
            compact
              ? 'mt-1.5 text-xs leading-5'
              : 'mt-2 text-sm leading-6',
          ].join(' ')}
        >
          {
            presentation.description
          }
        </p>
      ) : null}


      {state.kind ===
      'form_team' ? (
        <form
          action={
            state.action
          }
          className={
            compact
              ? 'mt-4'
              : 'mt-5'
          }
        >
          <button
            type="submit"
            className={[
              'inline-flex',
              'w-full',
              'items-center',
              'justify-center',
              'rounded-full',
              'border',
              'font-semibold',
              'transition',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[#070707]',
              compact
                ? 'min-h-10 px-4 text-xs'
                : 'min-h-11 px-5 text-sm',
              buttonClassName,
            ].join(' ')}
          >
            {
              presentation.buttonLabel
            }
          </button>
        </form>
      ) : null}


      {state.kind ===
      'join_invitation' ? (
        <form
          action={
            state.action
          }
          className={
            compact
              ? 'mt-4'
              : 'mt-5'
          }
        >
          <button
            type="submit"
            className={[
              'inline-flex',
              'w-full',
              'items-center',
              'justify-center',
              'rounded-full',
              'border',
              'font-semibold',
              'transition',
              'focus-visible:outline-none',
              'focus-visible:ring-2',
              'focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[#070707]',
              compact
                ? 'min-h-10 px-4 text-xs'
                : 'min-h-11 px-5 text-sm',
              buttonClassName,
            ].join(' ')}
          >
            {
              presentation.buttonLabel
            }
          </button>
        </form>
      ) : null}


      {state.kind ===
      'view_team' ? (
        <Link
          href={
            state.href
          }
          className={[
            'inline-flex',
            'w-full',
            'items-center',
            'justify-center',
            'rounded-full',
            'border',
            'font-semibold',
            'transition',
            'focus-visible:outline-none',
            'focus-visible:ring-2',
            'focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[#070707]',
            compact
              ? 'mt-4 min-h-10 px-4 text-xs'
              : 'mt-5 min-h-11 px-5 text-sm',
            buttonClassName,
          ].join(' ')}
        >
          {
            presentation.buttonLabel
          }
        </Link>
      ) : null}


      {state.kind ===
      'locked' ? (
        <div
          className={[
            'rounded-2xl',
            'border',
            'border-white/[0.07]',
            'bg-black/15',
            'text-center',
            'font-medium',
            'text-white/35',
            compact
              ? 'mt-4 px-3 py-3 text-[11px]'
              : 'mt-5 px-4 py-3.5 text-xs',
          ].join(' ')}
        >
          Team action unavailable
        </div>
      ) : null}


      <p
        className={[
          'leading-5',
          'text-white/22',
          compact
            ? 'mt-3 text-[9px]'
            : 'mt-4 text-[10px]',
        ].join(' ')}
      >
        Final authorization is revalidated transactionally when the
        team action runs.
      </p>
    </aside>
  )
}


export default RelayTeamCta