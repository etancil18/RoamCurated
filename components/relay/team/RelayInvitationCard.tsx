'use client'

import {
  useFormStatus,
} from 'react-dom'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayInvitationStatus =
  | 'invited'
  | 'joined'
  | 'declined'
  | 'left'
  | 'removed'


export type RelayInvitationCardModel = {
  invitationId:
    string

  teamId:
    string

  relayId:
    string

  relayTitle:
    string

  relayCity:
    string | null

  relayTheme?:
    string | null

  captainLabel?:
    string | null

  invitedAt?:
    string | null

  status:
    RelayInvitationStatus

  slotCount?:
    number | null

  teamSizeLabel?:
    string | null

  windowLabel?:
    string | null
}


export type RelayInvitationCardProps = {
  invitation:
    RelayInvitationCardModel

  /**
   * Must be a server action supplied by the parent.
   *
   * Expected FormData:
   *
   * invitation_id
   * team_id
   * relay_id
   *
   * The server/RPC remains authoritative for:
   * - invitee identity
   * - invitation state
   * - duplicate membership
   * - team capacity
   * - Relay lifecycle
   * - membership transition
   */
  acceptAction:
    (
      formData:
        FormData
    ) => Promise<void>

  /**
   * Must be a server action supplied by the parent.
   *
   * Receives the same canonical identifiers as acceptAction.
   */
  declineAction:
    (
      formData:
        FormData
    ) => Promise<void>

  className?:
    string

  compact?:
    boolean
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayInvitationCard({
  invitation,
  acceptAction,
  declineAction,
  className,
  compact =
    false,
}: RelayInvitationCardProps) {
  const actionable =
    invitation.status ===
    'invited'


  return (
    <article
      className={[
        'relative',
        'overflow-hidden',
        'rounded-[26px]',
        'border',
        actionable
          ? 'border-amber-300/16 bg-amber-300/[0.045]'
          : 'border-white/[0.08] bg-white/[0.025]',
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
      data-relay-invitation-id={
        invitation.invitationId
      }
      data-relay-invitation-status={
        invitation.status
      }
    >
      {/* ======================================================
       * AMBIENT BACKGROUND
       * ====================================================== */}

      {actionable ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-300/[0.055] blur-3xl"
        />
      ) : null}


      <div className="relative">
        {/* ====================================================
         * HEADER
         * ==================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  'inline-flex',
                  'items-center',
                  'rounded-full',
                  'border',
                  'px-2.5',
                  'py-1',
                  'text-[9px]',
                  'font-semibold',
                  'uppercase',
                  'tracking-[0.14em]',
                  actionable
                    ? 'border-amber-300/18 bg-amber-300/[0.065] text-amber-100/72'
                    : 'border-white/[0.08] bg-black/15 text-white/38',
                ].join(
                  ' '
                )}
              >
                {getInvitationStatusLabel(
                  invitation.status
                )}
              </span>

              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-black/15 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.13em] text-white/36">
                Roam Relay
              </span>
            </div>


            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.19em] text-white/28">
              {[
                invitation.relayCity,
                invitation.relayTheme,
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
                'tracking-[-0.03em]',
                'text-white',
                compact
                  ? 'mt-1.5 text-xl'
                  : 'mt-2 text-2xl',
              ].join(
                ' '
              )}
            >
              {
                invitation.relayTitle
              }
            </h2>


            {actionable ? (
              <p
                className={[
                  'text-white/44',
                  compact
                    ? 'mt-2 text-xs leading-5'
                    : 'mt-3 text-sm leading-6',
                ].join(
                  ' '
                )}
              >
                {invitation.captainLabel
                  ? `${invitation.captainLabel} invited you to join their Relay team.`
                  : 'You have been invited to join this Relay team.'}
              </p>
            ) : (
              <p
                className={[
                  'text-white/36',
                  compact
                    ? 'mt-2 text-xs leading-5'
                    : 'mt-3 text-sm leading-6',
                ].join(
                  ' '
                )}
              >
                {getResolvedInvitationDescription(
                  invitation.status
                )}
              </p>
            )}
          </div>


          {invitation.invitedAt ? (
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
                Invited
              </p>

              <p className="mt-1 text-xs text-white/38">
                {formatInvitationDate(
                  invitation.invitedAt
                )}
              </p>
            </div>
          ) : null}
        </div>


        {/* ====================================================
         * RELAY SUMMARY
         * ==================================================== */}

        {hasSummaryData(
          invitation
        ) ? (
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
                ? 'mt-4 sm:grid-cols-3'
                : 'mt-5 sm:grid-cols-3',
            ].join(
              ' '
            )}
          >
            {invitation.teamSizeLabel ? (
              <InvitationMetric
                label="Team"
                value={
                  invitation.teamSizeLabel
                }
              />
            ) : null}

            {invitation.slotCount !==
            null &&
            invitation.slotCount !==
            undefined ? (
              <InvitationMetric
                label="Route"
                value={`${invitation.slotCount} ${
                  invitation.slotCount ===
                  1
                    ? 'leg'
                    : 'legs'
                }`}
              />
            ) : null}

            {invitation.windowLabel ? (
              <InvitationMetric
                label="Window"
                value={
                  invitation.windowLabel
                }
              />
            ) : null}
          </dl>
        ) : null}


        {/* ====================================================
         * ACTIONS
         * ==================================================== */}

        {actionable ? (
          <div
            className={[
              'grid',
              'gap-2',
              'border-t',
              'border-white/[0.07]',
              compact
                ? 'mt-4 pt-4 sm:grid-cols-2'
                : 'mt-5 pt-5 sm:grid-cols-2',
            ].join(
              ' '
            )}
          >
            <form
              action={
                acceptAction
              }
            >
              <InvitationIdentifiers
                invitation={
                  invitation
                }
              />

              <AcceptInvitationButton
                compact={
                  compact
                }
              />
            </form>


            <form
              action={
                declineAction
              }
            >
              <InvitationIdentifiers
                invitation={
                  invitation
                }
              />

              <DeclineInvitationButton
                compact={
                  compact
                }
              />
            </form>
          </div>
        ) : (
          <div
            className={[
              'border-t',
              'border-white/[0.06]',
              compact
                ? 'mt-4 pt-4'
                : 'mt-5 pt-5',
            ].join(
              ' '
            )}
          >
            <div className="rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3.5">
              <p className="text-xs font-medium text-white/42">
                {getResolvedInvitationStateLabel(
                  invitation.status
                )}
              </p>
            </div>
          </div>
        )}


        {/* ====================================================
         * INTEGRITY NOTE
         * ==================================================== */}

        {actionable ? (
          <p
            className={[
              'leading-5',
              'text-white/21',
              compact
                ? 'mt-3 text-[9px]'
                : 'mt-4 text-[10px]',
            ].join(
              ' '
            )}
          >
            Accepting or declining is revalidated transactionally
            against the current Relay team and invitation state.
          </p>
        ) : null}
      </div>
    </article>
  )
}


/* ============================================================
 * HIDDEN CANONICAL IDENTIFIERS
 * ============================================================
 */

function InvitationIdentifiers({
  invitation,
}: {
  invitation:
    RelayInvitationCardModel
}) {
  return (
    <>
      <input
        type="hidden"
        name="invitation_id"
        value={
          invitation.invitationId
        }
      />

      <input
        type="hidden"
        name="team_id"
        value={
          invitation.teamId
        }
      />

      <input
        type="hidden"
        name="relay_id"
        value={
          invitation.relayId
        }
      />
    </>
  )
}


/* ============================================================
 * ACCEPT BUTTON
 * ============================================================
 */

function AcceptInvitationButton({
  compact,
}: {
  compact:
    boolean
}) {
  const {
    pending,
  } =
    useFormStatus()


  return (
    <button
      type="submit"
      disabled={
        pending
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
        'focus-visible:ring-emerald-300/40',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070707]',
        compact
          ? 'min-h-10 px-4 text-xs'
          : 'min-h-11 px-5 text-sm',
        pending
          ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
          : 'border-emerald-300/18 bg-emerald-300/[0.07] text-emerald-50 hover:border-emerald-300/28 hover:bg-emerald-300/[0.11]',
      ].join(
        ' '
      )}
    >
      {pending
        ? 'Joining team…'
        : 'Join invitation'}
    </button>
  )
}


/* ============================================================
 * DECLINE BUTTON
 * ============================================================
 */

function DeclineInvitationButton({
  compact,
}: {
  compact:
    boolean
}) {
  const {
    pending,
  } =
    useFormStatus()


  return (
    <button
      type="submit"
      disabled={
        pending
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
        'focus-visible:ring-white/25',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070707]',
        compact
          ? 'min-h-10 px-4 text-xs'
          : 'min-h-11 px-5 text-sm',
        pending
          ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
          : 'border-white/[0.09] bg-black/15 text-white/50 hover:border-white/[0.16] hover:bg-white/[0.04] hover:text-white/72',
      ].join(
        ' '
      )}
    >
      {pending
        ? 'Declining…'
        : 'Decline'}
    </button>
  )
}


/* ============================================================
 * METRIC
 * ============================================================
 */

function InvitationMetric({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="min-w-0 bg-[#0b0b0b] px-4 py-3.5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/23">
        {label}
      </dt>

      <dd
        className="mt-1 truncate text-xs font-medium text-white/60"
        title={
          value
        }
      >
        {value}
      </dd>
    </div>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function hasSummaryData(
  invitation:
    RelayInvitationCardModel
): boolean {
  return Boolean(
    invitation.teamSizeLabel ||
    invitation.windowLabel ||
    (
      invitation.slotCount !==
        null &&
      invitation.slotCount !==
        undefined
    )
  )
}


function getInvitationStatusLabel(
  status:
    RelayInvitationStatus
): string {
  switch (
    status
  ) {
    case 'invited':
      return 'Invitation'

    case 'joined':
      return 'Joined'

    case 'declined':
      return 'Declined'

    case 'left':
      return 'Left team'

    case 'removed':
      return 'Removed'
  }
}


function getResolvedInvitationDescription(
  status:
    RelayInvitationStatus
): string {
  switch (
    status
  ) {
    case 'joined':
      return 'You accepted this Relay invitation and joined the team.'

    case 'declined':
      return 'You declined this Relay invitation.'

    case 'left':
      return 'You previously joined this team and later left it.'

    case 'removed':
      return 'Your membership on this Relay team is no longer active.'

    case 'invited':
      return 'You have been invited to join this Relay team.'
  }
}


function getResolvedInvitationStateLabel(
  status:
    RelayInvitationStatus
): string {
  switch (
    status
  ) {
    case 'joined':
      return 'Invitation accepted'

    case 'declined':
      return 'Invitation declined'

    case 'left':
      return 'Membership ended'

    case 'removed':
      return 'Membership removed'

    case 'invited':
      return 'Invitation pending'
  }
}


function formatInvitationDate(
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
    return 'Recently'
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


export default RelayInvitationCard