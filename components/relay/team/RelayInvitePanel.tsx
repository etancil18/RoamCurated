'use client'

import {
  useState,
} from 'react'

import {
  useFormStatus,
} from 'react-dom'


/* ============================================================
 * TYPES
 * ============================================================
 */

export type RelayInviteCandidate = {
  userId:
    string

  label:
    string

  secondaryLabel?:
    string | null

  avatarUrl?:
    string | null
}


export type RelayPendingInvitation = {
  id:
    string

  label:
    string

  secondaryLabel?:
    string | null

  invitedAt?:
    string | null
}


export type RelayInvitePanelProps = {
  teamId:
    string

  candidates?:
    RelayInviteCandidate[]

  pendingInvitations?:
    RelayPendingInvitation[]

  currentJoinedCount:
    number

  maximumTeamSize:
    number

  /**
   * Must be a server action supplied by the parent.
   *
   * Expected FormData:
   *
   * team_id
   * invitee_user_id
   *
   * The action/RPC remains authoritative for:
   * - captain authorization
   * - duplicate membership
   * - Relay/team lifecycle
   * - capacity
   * - invitation eligibility
   */
  inviteAction:
    (
      formData:
        FormData
    ) => Promise<void>

  canInvite?:
    boolean

  lockedReason?:
    string | null

  title?:
    string

  description?:
    string

  className?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export function RelayInvitePanel({
  teamId,
  candidates = [],
  pendingInvitations = [],
  currentJoinedCount,
  maximumTeamSize,
  inviteAction,
  canInvite = true,
  lockedReason = null,
  title =
    'Invite teammates',
  description =
    'Add people to the Relay roster before assigning one leg to each joined teammate.',
  className,
}: RelayInvitePanelProps) {
  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState(
      ''
    )


  const remainingCapacity =
    Math.max(
      maximumTeamSize -
        currentJoinedCount -
        pendingInvitations.length,
      0
    )


  const capacityReached =
    remainingCapacity ===
    0


  const inviteLocked =
    !canInvite ||
    capacityReached


  const effectiveLockedReason =
    lockedReason ??
    (
      capacityReached
        ? 'This team has no remaining invitation capacity.'
        : !canInvite
          ? 'Invitations are currently unavailable for this team.'
          : null
    )


  const availableCandidates =
    candidates.filter(
      (
        candidate
      ) =>
        !pendingInvitations.some(
          (
            invitation
          ) =>
            invitation.id ===
            candidate.userId
        )
    )


  return (
    <section
      className={[
        'rounded-[26px]',
        'border',
        'border-white/[0.08]',
        'bg-white/[0.025]',
        'p-5',
        'sm:p-6',
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        )}
      data-relay-invite-panel
      data-team-id={
        teamId
      }
    >
      {/* ======================================================
       * HEADER
       * ====================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/28">
            Captain controls
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/42">
            {description}
          </p>
        </div>


        <div className="shrink-0 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/24">
            Roster
          </p>

          <p className="mt-1 text-sm font-semibold text-white/68">
            {currentJoinedCount}
            {' / '}
            {maximumTeamSize}
            {' joined'}
          </p>

          {pendingInvitations.length >
          0 ? (
            <p className="mt-0.5 text-[10px] text-amber-100/45">
              {pendingInvitations.length}{' '}
              pending
            </p>
          ) : null}
        </div>
      </div>


      {/* ======================================================
       * LOCKED STATE
       * ====================================================== */}

      {inviteLocked ? (
        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/24">
            Invitations locked
          </p>

          <p className="mt-2 text-sm leading-6 text-white/40">
            {
              effectiveLockedReason
            }
          </p>
        </div>
      ) : (
        /* ====================================================
         * INVITE FORM
         * ==================================================== */

        <form
          action={
            inviteAction
          }
          className="mt-5"
          onSubmit={() => {
            if (
              !selectedUserId
            ) {
              return
            }
          }}
        >
          <input
            type="hidden"
            name="team_id"
            value={
              teamId
            }
          />

          <input
            type="hidden"
            name="invitee_user_id"
            value={
              selectedUserId
            }
          />


          <fieldset>
            <legend className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
              Choose a teammate
            </legend>


            {availableCandidates.length >
            0 ? (
              <div className="mt-3 grid gap-2">
                {availableCandidates.map(
                  (
                    candidate
                  ) => {
                    const selected =
                      selectedUserId ===
                      candidate.userId


                    return (
                      <button
                        key={
                          candidate.userId
                        }
                        type="button"
                        aria-pressed={
                          selected
                        }
                        onClick={() => {
                          setSelectedUserId(
                            candidate.userId
                          )
                        }}
                        className={[
                          'flex',
                          'w-full',
                          'items-center',
                          'gap-3',
                          'rounded-2xl',
                          'border',
                          'p-3',
                          'text-left',
                          'transition',
                          'focus-visible:outline-none',
                          'focus-visible:ring-2',
                          'focus-visible:ring-amber-300/35',
                          'focus-visible:ring-offset-2',
                          'focus-visible:ring-offset-[#070707]',
                          selected
                            ? 'border-amber-300/22 bg-amber-300/[0.07]'
                            : 'border-white/[0.07] bg-black/15 hover:border-white/[0.12] hover:bg-white/[0.03]',
                        ].join(
                          ' '
                        )}
                      >
                        <CandidateAvatar
                          label={
                            candidate.label
                          }
                          avatarUrl={
                            candidate.avatarUrl
                          }
                        />


                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white/72">
                            {
                              candidate.label
                            }
                          </p>

                          {candidate.secondaryLabel ? (
                            <p className="mt-0.5 truncate text-xs text-white/30">
                              {
                                candidate.secondaryLabel
                              }
                            </p>
                          ) : null}
                        </div>


                        <span
                          aria-hidden="true"
                          className={[
                            'flex',
                            'h-5',
                            'w-5',
                            'shrink-0',
                            'items-center',
                            'justify-center',
                            'rounded-full',
                            'border',
                            selected
                              ? 'border-amber-300/40 bg-amber-300/15'
                              : 'border-white/12',
                          ].join(
                            ' '
                          )}
                        >
                          {selected ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
                          ) : null}
                        </span>
                      </button>
                    )
                  }
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-white/[0.08] px-4 py-7 text-center">
                <p className="text-sm font-medium text-white/40">
                  No teammates available to invite.
                </p>

                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-white/25">
                  Candidate discovery should be supplied by the
                  canonical people/search layer rather than performed
                  inside the Relay invitation component.
                </p>
              </div>
            )}
          </fieldset>


          {availableCandidates.length >
          0 ? (
            <div className="mt-5">
              <InviteSubmitButton
                disabled={
                  !selectedUserId
                }
              />
            </div>
          ) : null}
        </form>
      )}


      {/* ======================================================
       * PENDING INVITATIONS
       * ====================================================== */}

      {pendingInvitations.length >
      0 ? (
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
                Pending invitations
              </p>

              <p className="mt-1 text-xs leading-5 text-white/30">
                These teammates have not joined the Relay roster yet.
              </p>
            </div>

            <span className="rounded-full border border-amber-300/12 bg-amber-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/55">
              {
                pendingInvitations.length
              }{' '}
              pending
            </span>
          </div>


          <div className="mt-3 space-y-2">
            {pendingInvitations.map(
              (
                invitation
              ) => (
                <PendingInvitationRow
                  key={
                    invitation.id
                  }
                  invitation={
                    invitation
                  }
                />
              )
            )}
          </div>
        </div>
      ) : null}


      {/* ======================================================
       * INTEGRITY NOTE
       * ====================================================== */}

      <p className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-white/22">
        Invitation authorization, duplicate membership, roster
        capacity, and Relay lifecycle are revalidated transactionally
        by the server action and canonical Relay RPC.
      </p>
    </section>
  )
}


/* ============================================================
 * SUBMIT BUTTON
 * ============================================================
 */

function InviteSubmitButton({
  disabled,
}: {
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
        'w-full',
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
        'focus-visible:ring-amber-300/40',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#070707]',
        unavailable
          ? 'cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-white/25'
          : 'border-amber-300/20 bg-amber-300/[0.09] text-amber-50 hover:border-amber-300/30 hover:bg-amber-300/[0.14]',
      ].join(
        ' '
      )}
    >
      {pending
        ? 'Sending invitation…'
        : 'Invite teammate'}
    </button>
  )
}


/* ============================================================
 * CANDIDATE AVATAR
 * ============================================================
 */

function CandidateAvatar({
  label,
  avatarUrl,
}: {
  label:
    string

  avatarUrl?:
    string | null
}) {
  const fallback =
    label
      .trim()
      .charAt(
        0
      )
      .toUpperCase() ||
    '?'


  if (
    avatarUrl
  ) {
    return (
      <div
        className="h-10 w-10 shrink-0 rounded-full border border-white/[0.08] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            `url("${avatarUrl}")`,
        }}
        aria-hidden="true"
      />
    )
  }


  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-white/48"
    >
      {fallback}
    </div>
  )
}


/* ============================================================
 * PENDING INVITATION
 * ============================================================
 */

function PendingInvitationRow({
  invitation,
}: {
  invitation:
    RelayPendingInvitation
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white/62">
          {
            invitation.label
          }
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/27">
          {invitation.secondaryLabel ? (
            <span>
              {
                invitation.secondaryLabel
              }
            </span>
          ) : null}

          {invitation.invitedAt ? (
            <span>
              Invited{' '}
              {
                formatInviteDate(
                  invitation.invitedAt
                )
              }
            </span>
          ) : null}
        </div>
      </div>


      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-amber-100/48">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />

        Pending
      </span>
    </article>
  )
}


/* ============================================================
 * DATE
 * ============================================================
 */

function formatInviteDate(
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
    return 'recently'
  }


  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',
    }
  ).format(
    date
  )
}


export default RelayInvitePanel