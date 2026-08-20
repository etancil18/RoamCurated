"use client"

import {
  useEffect,
  useState,
  useTransition,
} from "react"

import {
  useRouter,
} from "next/navigation"


/* ============================================================
 * DATA CONTRACT
 * ============================================================
 */

export type RelayInvitation = {
  membershipId:
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

  teamStatus:
    string

  minimumTeamSize:
    number

  maximumTeamSize:
    number

  joinedMemberCount:
    number

  invitedAt:
    string | null
}


/* ============================================================
 * MUTATION CONTRACT
 * ============================================================
 */

type RelayInvitationMutationResult =
  | void
  | {
      teamId?:
        string

      relayId?:
        string
    }


type RelayInvitationsPanelProps = {
  invitations:
    RelayInvitation[]

  onAccept:
    (
      teamId:
        string
    ) =>
      Promise<
        RelayInvitationMutationResult
      >

  onDecline:
    (
      teamId:
        string
    ) =>
      Promise<
        RelayInvitationMutationResult
      >

  className?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function RelayInvitationsPanel({
  invitations,
  onAccept,
  onDecline,
  className,
}: RelayInvitationsPanelProps) {
  const router =
    useRouter()


  const [
    visibleInvitations,
    setVisibleInvitations,
  ] =
    useState<
      RelayInvitation[]
    >(
      invitations
    )


  const [
    pendingTeamId,
    setPendingTeamId,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    pendingAction,
    setPendingAction,
  ] =
    useState<
      "accept" |
      "decline" |
      null
    >(
      null
    )


  const [
    mutationError,
    setMutationError,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    isPending,
    startTransition,
  ] =
    useTransition()


  useEffect(() => {
    setVisibleInvitations(
      invitations
    )
  }, [
    invitations,
  ])


  if (
    visibleInvitations.length ===
    0
  ) {
    return null
  }


  function handleAccept(
    invitation:
      RelayInvitation
  ) {
    if (
      isPending ||
      pendingTeamId
    ) {
      return
    }


    setMutationError(
      null
    )

    setPendingTeamId(
      invitation.teamId
    )

    setPendingAction(
      "accept"
    )


    startTransition(
      () => {
        void (
          async () => {
            try {
              const result =
                await onAccept(
                  invitation.teamId
                )


              const resolvedTeamId =
                result &&
                typeof result ===
                  "object" &&
                typeof result.teamId ===
                  "string" &&
                result.teamId.trim()
                  .length >
                  0
                  ? result.teamId
                  : invitation.teamId


              router.push(
                `/competitions/team/${encodeURIComponent(
                  resolvedTeamId
                )}`
              )
            } catch (
              error
            ) {
              console.error(
                "[RelayInvitationsPanel] Failed to accept Relay invitation:",
                error
              )

              setMutationError(
                getMutationErrorMessage(
                  error,
                  "We could not accept this Relay invitation. Please try again."
                )
              )

              setPendingTeamId(
                null
              )

              setPendingAction(
                null
              )
            }
          }
        )()
      }
    )
  }


  function handleDecline(
    invitation:
      RelayInvitation
  ) {
    if (
      isPending ||
      pendingTeamId
    ) {
      return
    }


    setMutationError(
      null
    )

    setPendingTeamId(
      invitation.teamId
    )

    setPendingAction(
      "decline"
    )


    startTransition(
      () => {
        void (
          async () => {
            try {
              await onDecline(
                invitation.teamId
              )


              setVisibleInvitations(
                (
                  currentInvitations
                ) =>
                  currentInvitations.filter(
                    (
                      candidate
                    ) =>
                      candidate.teamId !==
                      invitation.teamId
                  )
              )


              setPendingTeamId(
                null
              )

              setPendingAction(
                null
              )


              router.refresh()
            } catch (
              error
            ) {
              console.error(
                "[RelayInvitationsPanel] Failed to decline Relay invitation:",
                error
              )

              setMutationError(
                getMutationErrorMessage(
                  error,
                  "We could not decline this Relay invitation. Please try again."
                )
              )

              setPendingTeamId(
                null
              )

              setPendingAction(
                null
              )
            }
          }
        )()
      }
    )
  }


  return (
    <section
      aria-labelledby="relay-invitations-title"
      className={[
        "relative w-full min-w-0 overflow-hidden rounded-[2rem]",
        "bg-gradient-to-br from-violet-400/[0.09] via-indigo-400/[0.055] to-cyan-400/[0.035]",
        "p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)]",
        "ring-1 ring-violet-300/15",
        "sm:p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-48 w-48 rounded-full bg-violet-400/[0.12] blur-3xl" />

      <div className="pointer-events-none absolute bottom-[-6rem] left-[18%] h-44 w-44 rounded-full bg-cyan-400/[0.07] blur-3xl" />


      <div className="relative z-10">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-300/[0.08] px-3 py-1.5 ring-1 ring-violet-300/15">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.75)]"
              />

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">
                Relay invitation
              </p>
            </div>


            <h2
              id="relay-invitations-title"
              className="mt-3 text-xl font-black tracking-[-0.025em] text-white sm:text-2xl"
            >
              {visibleInvitations.length ===
              1
                ? "You have a team waiting."
                : `${visibleInvitations.length.toLocaleString(
                    "en-US"
                  )} Relay teams want you.`}
            </h2>


            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Accept to join the roster and
              continue into the Relay team
              hub.
            </p>
          </div>


          <span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] px-3 text-xs font-black text-violet-100 ring-1 ring-white/[0.08]">
            {
              visibleInvitations.length
            }
          </span>
        </div>


        {mutationError ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl bg-red-950/30 px-4 py-3 text-xs leading-5 text-red-200 ring-1 ring-red-400/20"
          >
            {mutationError}
          </div>
        ) : null}


        <div className="mt-5 space-y-3">
          {visibleInvitations.map(
            (
              invitation
            ) => {
              const isCurrent =
                pendingTeamId ===
                invitation.teamId


              const accepting =
                isCurrent &&
                pendingAction ===
                  "accept"


              const declining =
                isCurrent &&
                pendingAction ===
                  "decline"


              const teamSizeLabel =
                buildTeamSizeLabel(
                  invitation
                )


              return (
                <article
                  key={
                    invitation.membershipId
                  }
                  className="min-w-0 rounded-[1.5rem] bg-black/30 p-4 ring-1 ring-white/[0.075] sm:p-5"
                >
                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-violet-300/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-violet-200 ring-1 ring-violet-300/15">
                          Invited
                        </span>

                        {invitation.relayCity ? (
                          <span className="text-[11px] font-semibold text-zinc-500">
                            {
                              invitation.relayCity
                            }
                          </span>
                        ) : null}

                        {invitation.relayTheme ? (
                          <span className="text-[11px] text-zinc-600">
                            ·
                          </span>
                        ) : null}

                        {invitation.relayTheme ? (
                          <span className="text-[11px] font-semibold text-zinc-500">
                            {
                              invitation.relayTheme
                            }
                          </span>
                        ) : null}
                      </div>


                      <h3 className="mt-3 break-words text-lg font-black tracking-[-0.02em] text-white">
                        {
                          invitation.relayTitle
                        }
                      </h3>


                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                        <span>
                          {
                            teamSizeLabel
                          }
                        </span>

                        <span>
                          {invitation.joinedMemberCount.toLocaleString(
                            "en-US"
                          )}{" "}
                          joined
                        </span>

                        {invitation.invitedAt ? (
                          <span>
                            Invited{" "}
                            {formatInvitationDate(
                              invitation.invitedAt
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>


                    <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto">
                      <button
                        type="button"
                        onClick={() =>
                          handleAccept(
                            invitation
                          )
                        }
                        disabled={
                          Boolean(
                            pendingTeamId
                          )
                        }
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-black text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {accepting
                          ? "Joining…"
                          : "Accept invite"}
                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          handleDecline(
                            invitation
                          )
                        }
                        disabled={
                          Boolean(
                            pendingTeamId
                          )
                        }
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white/[0.045] px-5 py-2.5 text-sm font-bold text-zinc-400 ring-1 ring-white/[0.08] transition hover:bg-white/[0.075] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {declining
                          ? "Declining…"
                          : "Decline"}
                      </button>
                    </div>
                  </div>
                </article>
              )
            }
          )}
        </div>
      </div>
    </section>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function buildTeamSizeLabel(
  invitation:
    RelayInvitation
): string {
  const minimum =
    normalizePositiveInteger(
      invitation.minimumTeamSize
    )


  const maximum =
    normalizePositiveInteger(
      invitation.maximumTeamSize
    )


  if (
    minimum !==
      null &&
    maximum !==
      null
  ) {
    if (
      minimum ===
      maximum
    ) {
      return `${minimum.toLocaleString(
        "en-US"
      )} teammates`
    }


    return `${minimum.toLocaleString(
      "en-US"
    )}–${maximum.toLocaleString(
      "en-US"
    )} teammates`
  }


  if (
    maximum !==
    null
  ) {
    return `Up to ${maximum.toLocaleString(
      "en-US"
    )} teammates`
  }


  return "Relay team"
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
    return "recently"
  }


  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",
    }
  ).format(
    date
  )
}


function normalizePositiveInteger(
  value:
    unknown
): number | null {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    ) ||
    value <=
      0
  ) {
    return null
  }


  return Math.trunc(
    value
  )
}


function getMutationErrorMessage(
  error:
    unknown,
  fallback:
    string
): string {
  if (
    error instanceof
      Error
  ) {
    const message =
      error.message
        .trim()


    if (
      message.length >
      0
    ) {
      return message
    }
  }


  return fallback
}