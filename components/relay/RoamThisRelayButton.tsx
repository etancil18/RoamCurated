// components/relay/RoamThisRelayButton.tsx

import {
  useFormStatus,
} from 'react-dom'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RoamThisRelayButtonProps = {
  publicFlowSnapshotId:
    string

  /**
   * Canonical snapshot replay endpoint.
   *
   * This component must not construct or invent a Relay-specific
   * replay route. It submits public_flow_snapshot_id directly to
   * the existing snapshot replay endpoint.
   */
  action:
    (
      formData:
        FormData
    ) => Promise<void>

  label?:
    string

  pendingLabel?:
    string

  className?:
    string

  disabled?:
    boolean
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RoamThisRelayButton({
  publicFlowSnapshotId,
  action,
  label =
    'Roam this Relay',
  pendingLabel =
    'Opening Roam…',
  className,
  disabled =
    false,
}: RoamThisRelayButtonProps) {
  return (
    <form
      action={
        action
      }
      className={
        className
      }
      data-roam-this-relay
      data-public-flow-snapshot-id={
        publicFlowSnapshotId
      }
    >
      <input
        type="hidden"
        name="public_flow_snapshot_id"
        value={
          publicFlowSnapshotId
        }
      />

      <RoamThisRelaySubmitButton
        label={
          label
        }
        pendingLabel={
          pendingLabel
        }
        disabled={
          disabled ||
          !publicFlowSnapshotId
        }
      />
    </form>
  )
}


/* ============================================================
 * SUBMIT BUTTON
 * ============================================================
 */

function RoamThisRelaySubmitButton({
  label,
  pendingLabel,
  disabled,
}: {
  label:
    string

  pendingLabel:
    string

  disabled:
    boolean
}) {
  const {
    pending,
  } =
    useFormStatus()


  const unavailable =
    disabled ||
    pending


  return (
    <button
      type="submit"
      disabled={
        unavailable
      }
      className={[
        'inline-flex',
        'min-h-11',
        'items-center',
        'justify-center',
        'rounded-full',
        'border',
        'px-5',
        'text-sm',
        'font-semibold',
        'transition',
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-violet-300/35',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070707]',
        unavailable
          ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
          : 'border-violet-300/18 bg-violet-300/[0.07] text-violet-50 hover:border-violet-300/28 hover:bg-violet-300/[0.11]',
      ].join(
        ' '
      )}
    >
      {pending
        ? pendingLabel
        : label}
    </button>
  )
}


export default RoamThisRelayButton