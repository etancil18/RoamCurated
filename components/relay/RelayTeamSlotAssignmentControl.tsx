"use client"

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react"


/* ============================================================
 * CONTRACTS
 * ============================================================
 */

export type RelayAssignableMember = {
  userId:
    string

  username?:
    string | null

  fullName?:
    string | null

  isCaptain?:
    boolean
}


type RelayTeamSlotAssignmentControlProps = {
  teamSlotId:
    string

  slotIndex:
    number

  slotLabel:
    string

  assignedUserId:
    string | null

  members:
    RelayAssignableMember[]

  onAssign:
    (
      teamSlotId:
        string,
      userId:
        string | null
    ) =>
      Promise<
        void
      >

  disabled?:
    boolean

  allowUnassign?:
    boolean

  className?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function RelayTeamSlotAssignmentControl({
  teamSlotId,
  slotIndex,
  slotLabel,
  assignedUserId,
  members,
  onAssign,
  disabled = false,
  allowUnassign = true,
  className,
}: RelayTeamSlotAssignmentControlProps) {
  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState(
      assignedUserId ??
        ""
    )


  const [
    savedUserId,
    setSavedUserId,
  ] =
    useState(
      assignedUserId ??
        ""
    )


  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null
    )


  const [
    success,
    setSuccess,
  ] =
    useState(
      false
    )


  const [
    isPending,
    startTransition,
  ] =
    useTransition()


  useEffect(() => {
    const nextValue =
      assignedUserId ??
      ""


    setSelectedUserId(
      nextValue
    )

    setSavedUserId(
      nextValue
    )

    setError(
      null
    )

    setSuccess(
      false
    )
  }, [
    assignedUserId,
  ])


  const availableMembers =
    useMemo(
      () =>
        members
          .filter(
            (
              member
            ) =>
              Boolean(
                member.userId
              )
          )
          .sort(
            (
              first,
              second
            ) =>
              getMemberDisplayName(
                first
              ).localeCompare(
                getMemberDisplayName(
                  second
                ),
                "en-US",
                {
                  sensitivity:
                    "base",
                }
              )
          ),
      [
        members,
      ]
    )


  const hasChanges =
    selectedUserId !==
    savedUserId


  const selectedMember =
    availableMembers.find(
      (
        member
      ) =>
        member.userId ===
        selectedUserId
    ) ??
    null


  function handleSave() {
    if (
      disabled ||
      isPending ||
      !hasChanges
    ) {
      return
    }


    setError(
      null
    )

    setSuccess(
      false
    )


    const nextUserId =
      selectedUserId.length >
      0
        ? selectedUserId
        : null


    startTransition(
      () => {
        void (
          async () => {
            try {
              await onAssign(
                teamSlotId,
                nextUserId
              )


              setSavedUserId(
                selectedUserId
              )

              setSuccess(
                true
              )


              window.setTimeout(
                () => {
                  setSuccess(
                    false
                  )
                },
                2200
              )
            } catch (
              caughtError
            ) {
              console.error(
                "[RelayTeamSlotAssignmentControl] Failed to assign Relay leg:",
                caughtError
              )


              setError(
                getMutationErrorMessage(
                  caughtError
                )
              )
            }
          }
        )()
      }
    )
  }


  function handleReset() {
    if (
      disabled ||
      isPending
    ) {
      return
    }


    setSelectedUserId(
      savedUserId
    )

    setError(
      null
    )

    setSuccess(
      false
    )
  }


  return (
    <div
      className={[
        "w-full min-w-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="rounded-[1.35rem] border border-white/[0.07] bg-black/20 p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/24">
              Assign leg
            </p>

            <p className="mt-1.5 break-words text-sm font-semibold text-white/72">
              Leg{" "}
              {slotIndex}
              {" · "}
              {slotLabel}
            </p>
          </div>


          {savedUserId ? (
            <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-emerald-300/12 bg-emerald-300/[0.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/55">
              Assigned
            </span>
          ) : (
            <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-amber-300/12 bg-amber-300/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/55">
              Unassigned
            </span>
          )}
        </div>


        <div className="mt-4">
          <label
            htmlFor={
              `relay-slot-assignment-${teamSlotId}`
            }
            className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/26"
          >
            Teammate
          </label>


          <div className="mt-2">
            <select
              id={
                `relay-slot-assignment-${teamSlotId}`
              }
              value={
                selectedUserId
              }
              onChange={
                (
                  event
                ) => {
                  setSelectedUserId(
                    event.target.value
                  )

                  setError(
                    null
                  )

                  setSuccess(
                    false
                  )
                }
              }
              disabled={
                disabled ||
                isPending
              }
              className="min-h-12 w-full appearance-none rounded-2xl border border-white/[0.08] bg-[#0b0b0c] px-4 py-3 text-sm text-white/75 outline-none transition hover:border-white/[0.13] focus:border-violet-300/30 focus:ring-2 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allowUnassign ? (
  <option
    value=""
  >
    Unassigned
  </option>
) : (
  <option
    value=""
    disabled
  >
    Select teammate
  </option>
)}


              {availableMembers.map(
                (
                  member
                ) => (
                  <option
                    key={
                      member.userId
                    }
                    value={
                      member.userId
                    }
                  >
                    {getMemberOptionLabel(
                      member
                    )}
                  </option>
                )
              )}
            </select>
          </div>


          {selectedMember ? (
            <div className="mt-3 flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
              <MemberAvatar
                member={
                  selectedMember
                }
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white/72">
                  {getMemberDisplayName(
                    selectedMember
                  )}
                </p>

                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  {selectedMember.username ? (
                    <span className="truncate text-[11px] text-white/32">
                      @
                      {
                        selectedMember.username
                      }
                    </span>
                  ) : null}

                  {selectedMember.isCaptain ? (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/45">
                      Captain
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-white/28">
              Choose one joined teammate
              to own this Relay leg.
            </p>
          )}


          {availableMembers.length ===
          0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-white/[0.07] px-3 py-3 text-xs leading-5 text-white/30">
              No joined teammates are
              available for assignment yet.
            </p>
          ) : null}


          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-300/12 bg-red-300/[0.035] px-3 py-2.5 text-xs leading-5 text-red-200/75"
            >
              {error}
            </p>
          ) : null}


          {success ? (
            <p
              role="status"
              className="mt-3 rounded-xl border border-emerald-300/12 bg-emerald-300/[0.035] px-3 py-2.5 text-xs leading-5 text-emerald-100/70"
            >
              Relay leg assignment saved.
            </p>
          ) : null}


          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                disabled ||
                isPending ||
                !hasChanges ||
                (
                  !allowUnassign &&
                  selectedUserId.length ===
                    0
                )
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {isPending
                ? "Saving…"
                : savedUserId
                  ? "Update assignment"
                  : "Assign leg"}
            </button>


            {hasChanges ? (
              <button
                type="button"
                onClick={
                  handleReset
                }
                disabled={
                  disabled ||
                  isPending
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-sm font-medium text-white/45 transition hover:bg-white/[0.055] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}


/* ============================================================
 * MEMBER AVATAR
 * ============================================================
 */

function MemberAvatar({
  member,
}: {
  member:
    RelayAssignableMember
}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-300/20 to-cyan-300/10 text-[10px] font-bold text-white/65 ring-1 ring-white/[0.08]"
    >
      {getMemberInitials(
        member
      )}
    </div>
  )
}


/* ============================================================
 * HELPERS
 * ============================================================
 */

function getMemberDisplayName(
  member:
    RelayAssignableMember
): string {
  const fullName =
    normalizeNullableText(
      member.fullName
    )


  if (
    fullName
  ) {
    return fullName
  }


  const username =
    normalizeNullableText(
      member.username
    )


  if (
    username
  ) {
    return `@${username}`
  }


  return "Roam teammate"
}


function getMemberOptionLabel(
  member:
    RelayAssignableMember
): string {
  const fullName =
    normalizeNullableText(
      member.fullName
    )


  const username =
    normalizeNullableText(
      member.username
    )


  let label =
    fullName ??
    (
      username
        ? `@${username}`
        : "Roam teammate"
    )


  if (
    fullName &&
    username
  ) {
    label +=
      ` (@${username})`
  }


  if (
    member.isCaptain
  ) {
    label +=
      " · Captain"
  }


  return label
}


function getMemberInitials(
  member:
    RelayAssignableMember
): string {
  const source =
    normalizeNullableText(
      member.fullName
    ) ??
    normalizeNullableText(
      member.username
    ) ??
    "R"


  const parts =
    source
      .split(
        /\s+/
      )
      .filter(Boolean)


  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase()
  }


  return `${parts[0]?.[0] ?? ""}${parts[
    parts.length -
      1
  ]?.[0] ?? ""}`
    .toUpperCase()
}


function normalizeNullableText(
  value:
    string | null | undefined
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null
  }


  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        " "
      )


  return normalized.length >
    0
    ? normalized
    : null
}


function getMutationErrorMessage(
  error:
    unknown
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


  return "We could not save this Relay leg assignment. Please try again."
}