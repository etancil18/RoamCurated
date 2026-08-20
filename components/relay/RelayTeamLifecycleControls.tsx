"use client"

import {
  useEffect,
  useState,
  useTransition,
} from "react"


/* ============================================================
 * CONTRACTS
 * ============================================================
 */

export type RelayTeamLifecycleStatus =
  | "forming"
  | "ready"
  | "active"
  | "completed"
  | "abandoned"
  | "disqualified"


type RelayTeamLifecycleControlsProps = {
  teamId:
    string

  status:
    RelayTeamLifecycleStatus

  viewerIsCaptain:
    boolean

  teamReadyRequirementsMet:
    boolean

  joinedMemberCount:
    number

  requiredMemberCount:
    number

  assignedSlotCount:
    number

  totalSlotCount:
    number

  activeSlotIndex?:
    number | null

  viewerOwnsActiveSlot?:
    boolean

  viewerHasAssignedSlot?:
    boolean

  onReadyTeam:
    (
      teamId:
        string
    ) =>
      Promise<
        void
      >

  onStartTeam:
    (
      teamId:
        string
    ) =>
      Promise<
        void
      >

  onStartActiveLeg?:
    (
      teamId:
        string
    ) =>
      Promise<
        void
      >

  disabled?:
    boolean

  className?:
    string
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function RelayTeamLifecycleControls({
  teamId,
  status,
  viewerIsCaptain,
  teamReadyRequirementsMet,
  joinedMemberCount,
  requiredMemberCount,
  assignedSlotCount,
  totalSlotCount,
  activeSlotIndex = null,
  viewerOwnsActiveSlot = false,
  viewerHasAssignedSlot = false,
  onReadyTeam,
  onStartTeam,
  onStartActiveLeg,
  disabled = false,
  className,
}: RelayTeamLifecycleControlsProps) {
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
    successMessage,
    setSuccessMessage,
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
      | "ready"
      | "start"
      | "start-leg"
      | null
    >(
      null
    )


  const [
    isPending,
    startTransition,
  ] =
    useTransition()


  useEffect(() => {
    setMutationError(
      null
    )

    setSuccessMessage(
      null
    )

    setPendingAction(
      null
    )
  }, [
    status,
  ])


  const forming =
    status ===
    "forming"


  const ready =
    status ===
    "ready"


  const active =
    status ===
    "active"


  const completed =
    status ===
    "completed"


  const terminal =
    status ===
      "completed" ||
    status ===
      "abandoned" ||
    status ===
      "disqualified"


  const readyBlocked =
    !teamReadyRequirementsMet


  const startLegAvailable =
    active &&
    viewerOwnsActiveSlot &&
    typeof onStartActiveLeg ===
      "function"


  function runMutation({
    action,
    success,
    mutation,
  }: {
    action:
      "ready" |
      "start" |
      "start-leg"

    success:
      string

    mutation:
      () =>
        Promise<
          void
        >
  }) {
    if (
      disabled ||
      isPending ||
      pendingAction
    ) {
      return
    }


    setMutationError(
      null
    )

    setSuccessMessage(
      null
    )

    setPendingAction(
      action
    )


    startTransition(
      () => {
        void (
          async () => {
            try {
              await mutation()


              setSuccessMessage(
                success
              )
            } catch (
              error
            ) {
              console.error(
                `[RelayTeamLifecycleControls] ${action} failed:`,
                error
              )


              setMutationError(
                getMutationErrorMessage(
                  error,
                  action
                )
              )
            } finally {
              setPendingAction(
                null
              )
            }
          }
        )()
      }
    )
  }


  function handleReadyTeam() {
    if (
      !viewerIsCaptain ||
      !forming ||
      readyBlocked
    ) {
      return
    }


    runMutation({
      action:
        "ready",

      success:
        "Team marked ready.",

      mutation:
        () =>
          onReadyTeam(
            teamId
          ),
    })
  }


  function handleStartTeam() {
    if (
      !viewerIsCaptain ||
      !ready
    ) {
      return
    }


    runMutation({
      action:
        "start",

      success:
        "Relay started.",

      mutation:
        () =>
          onStartTeam(
            teamId
          ),
    })
  }


  function handleStartActiveLeg() {
    if (
      !startLegAvailable ||
      !onStartActiveLeg
    ) {
      return
    }


    runMutation({
      action:
        "start-leg",

      success:
        "Your Relay leg is starting.",

      mutation:
        () =>
          onStartActiveLeg(
            teamId
          ),
    })
  }


  return (
    <section
      aria-labelledby="relay-team-lifecycle-title"
      className={[
        "relative w-full min-w-0 overflow-hidden rounded-[1.6rem]",
        "border border-white/[0.08]",
        "bg-gradient-to-br from-white/[0.045] via-white/[0.02] to-transparent",
        "p-4 sm:p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-40 w-40 rounded-full bg-violet-400/[0.07] blur-3xl" />


      <div className="relative z-10">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28">
              Relay controls
            </p>

            <h2
              id="relay-team-lifecycle-title"
              className="mt-1.5 text-lg font-semibold tracking-[-0.025em] text-white/82"
            >
              {getLifecycleTitle(
                status,
                viewerIsCaptain,
                viewerOwnsActiveSlot
              )}
            </h2>

            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/38">
              {getLifecycleDescription(
                status,
                viewerIsCaptain,
                viewerOwnsActiveSlot,
                viewerHasAssignedSlot
              )}
            </p>
          </div>


          <LifecycleStatusBadge
            status={
              status
            }
          />
        </div>


        {/* ==================================================
         * READINESS
         * ================================================== */}

        {!terminal ? (
          <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2">
            <LifecycleMetric
              label="Joined"
              value={`${joinedMemberCount}/${requiredMemberCount}`}
              complete={
                joinedMemberCount >=
                requiredMemberCount
              }
            />

            <LifecycleMetric
              label="Assigned"
              value={`${assignedSlotCount}/${totalSlotCount}`}
              complete={
                totalSlotCount >
                  0 &&
                assignedSlotCount >=
                  totalSlotCount
              }
            />
          </div>
        ) : null}


        {forming &&
        !teamReadyRequirementsMet ? (
          <div className="mt-4 rounded-2xl border border-amber-300/10 bg-amber-300/[0.035] px-4 py-3">
            <p className="text-xs font-medium text-amber-100/65">
              Team is not ready yet.
            </p>

            <p className="mt-1 text-xs leading-5 text-white/34">
              Every required Relay leg must
              have one joined teammate
              assigned before the captain can
              lock the roster as ready.
            </p>
          </div>
        ) : null}


        {active &&
        activeSlotIndex !==
          null ? (
          <div className="mt-4 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.035] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100/42">
              Active baton
            </p>

            <p className="mt-1 text-sm font-semibold text-white/72">
              Leg{" "}
              {activeSlotIndex}
            </p>

            <p className="mt-1 text-xs leading-5 text-white/34">
              {viewerOwnsActiveSlot
                ? "You currently own the active Relay leg."
                : "The baton belongs to another assigned teammate."}
            </p>
          </div>
        ) : null}


        {/* ==================================================
         * MUTATION STATE
         * ================================================== */}

        {mutationError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-300/12 bg-red-300/[0.035] px-3 py-2.5 text-xs leading-5 text-red-200/75"
          >
            {mutationError}
          </p>
        ) : null}


        {successMessage ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-emerald-300/12 bg-emerald-300/[0.035] px-3 py-2.5 text-xs leading-5 text-emerald-100/70"
          >
            {successMessage}
          </p>
        ) : null}


        {/* ==================================================
         * CAPTAIN FORMING CONTROL
         * ================================================== */}

        {forming &&
        viewerIsCaptain ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={
                handleReadyTeam
              }
              disabled={
                disabled ||
                isPending ||
                readyBlocked
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {pendingAction ===
              "ready"
                ? "Marking ready…"
                : "Ready team"}
            </button>
          </div>
        ) : null}


        {/* ==================================================
         * CAPTAIN READY CONTROL
         * ================================================== */}

        {ready &&
        viewerIsCaptain ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={
                handleStartTeam
              }
              disabled={
                disabled ||
                isPending
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {pendingAction ===
              "start"
                ? "Starting Relay…"
                : "Start Relay"}
            </button>
          </div>
        ) : null}


        {/* ==================================================
         * ACTIVE LEG CONTROL
         * ================================================== */}

        {startLegAvailable ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={
                handleStartActiveLeg
              }
              disabled={
                disabled ||
                isPending
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {pendingAction ===
              "start-leg"
                ? "Starting leg…"
                : "Start my leg"}
            </button>
          </div>
        ) : null}


        {/* ==================================================
         * NON-CAPTAIN FORMING / READY MESSAGE
         * ================================================== */}

        {forming &&
        !viewerIsCaptain ? (
          <p className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3 text-xs leading-5 text-white/34">
            The captain is still building
            the roster and assigning Relay
            legs.
          </p>
        ) : null}


        {ready &&
        !viewerIsCaptain ? (
          <p className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3 text-xs leading-5 text-white/34">
            The team is ready. Waiting for
            the captain to start the Relay.
          </p>
        ) : null}


        {active &&
        !viewerOwnsActiveSlot ? (
          <p className="mt-5 rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3 text-xs leading-5 text-white/34">
            Wait for the baton to reach your
            assigned Relay leg.
          </p>
        ) : null}


        {completed ? (
          <p className="mt-5 rounded-2xl border border-violet-300/12 bg-violet-300/[0.035] px-4 py-3 text-xs leading-5 text-violet-100/60">
            This Relay team has completed
            every required leg.
          </p>
        ) : null}


        {status ===
        "abandoned" ? (
          <p className="mt-5 rounded-2xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-xs leading-5 text-red-100/55">
            This Relay team has been
            abandoned and cannot continue.
          </p>
        ) : null}


        {status ===
        "disqualified" ? (
          <p className="mt-5 rounded-2xl border border-red-300/10 bg-red-300/[0.03] px-4 py-3 text-xs leading-5 text-red-100/55">
            This Relay team has been
            disqualified and execution is
            locked.
          </p>
        ) : null}
      </div>
    </section>
  )
}


/* ============================================================
 * STATUS
 * ============================================================
 */

function LifecycleStatusBadge({
  status,
}: {
  status:
    RelayTeamLifecycleStatus
}) {
  const className =
    status ===
    "active"
      ? "border-emerald-300/14 bg-emerald-300/[0.045] text-emerald-100/65"
      : status ===
          "ready"
        ? "border-amber-300/14 bg-amber-300/[0.045] text-amber-100/65"
        : status ===
            "completed"
          ? "border-violet-300/14 bg-violet-300/[0.045] text-violet-100/65"
          : status ===
                "abandoned" ||
              status ===
                "disqualified"
            ? "border-red-300/12 bg-red-300/[0.035] text-red-100/55"
            : "border-white/[0.08] bg-white/[0.03] text-white/42"


  return (
    <span
      className={[
        "inline-flex",
        "min-h-8",
        "w-fit",
        "shrink-0",
        "items-center",
        "justify-center",
        "rounded-full",
        "border",
        "px-3",
        "text-[9px]",
        "font-semibold",
        "uppercase",
        "tracking-[0.14em]",
        className,
      ].join(
        " "
      )}
    >
      {formatStatus(
        status
      )}
    </span>
  )
}


/* ============================================================
 * METRIC
 * ============================================================
 */

function LifecycleMetric({
  label,
  value,
  complete,
}: {
  label:
    string

  value:
    string

  complete:
    boolean
}) {
  return (
    <div className="bg-[#0b0b0b] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/23">
            {label}
          </p>

          <p className="mt-1 text-sm font-medium text-white/68">
            {value}
          </p>
        </div>


        <span
          aria-hidden="true"
          className={[
            "h-2",
            "w-2",
            "rounded-full",

            complete
              ? "bg-emerald-300"
              : "bg-white/15",
          ].join(
            " "
          )}
        />
      </div>
    </div>
  )
}


/* ============================================================
 * COPY
 * ============================================================
 */

function getLifecycleTitle(
  status:
    RelayTeamLifecycleStatus,
  viewerIsCaptain:
    boolean,
  viewerOwnsActiveSlot:
    boolean
): string {
  switch (
    status
  ) {
    case "forming":
      return viewerIsCaptain
        ? "Finish the roster and lock in the team."
        : "Your team is still forming."

    case "ready":
      return viewerIsCaptain
        ? "Your team is ready to launch."
        : "Your team is ready."

    case "active":
      return viewerOwnsActiveSlot
        ? "The baton is yours."
        : "The Relay is underway."

    case "completed":
      return "Relay complete."

    case "abandoned":
      return "Team abandoned."

    case "disqualified":
      return "Team disqualified."
  }
}


function getLifecycleDescription(
  status:
    RelayTeamLifecycleStatus,
  viewerIsCaptain:
    boolean,
  viewerOwnsActiveSlot:
    boolean,
  viewerHasAssignedSlot:
    boolean
): string {
  switch (
    status
  ) {
    case "forming":
      return viewerIsCaptain
        ? "Assign every required leg to one joined teammate, then mark the team ready."
        : "The captain is still assigning teammates and Relay legs."

    case "ready":
      return viewerIsCaptain
        ? "The roster and assignments are complete. Start the Relay when your team is ready to begin."
        : "The roster is locked and the captain can start execution."

    case "active":
      if (
        viewerOwnsActiveSlot
      ) {
        return "Start your active leg through the canonical Relay execution flow."
      }

      if (
        viewerHasAssignedSlot
      ) {
        return "Your leg is assigned. Wait for the baton to reach you."
      }

      return "The Relay is active. Follow the live baton and team progress."

    case "completed":
      return "Every required Relay leg has been resolved."

    case "abandoned":
      return "This team can no longer continue Relay execution."

    case "disqualified":
      return "This team is locked from further Relay execution."
  }
}


/* ============================================================
 * ERROR HANDLING
 * ============================================================
 */

function getMutationErrorMessage(
  error:
    unknown,
  action:
    "ready" |
    "start" |
    "start-leg"
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


  switch (
    action
  ) {
    case "ready":
      return "We could not mark this Relay team ready. Please try again."

    case "start":
      return "We could not start this Relay. Please try again."

    case "start-leg":
      return "We could not start your Relay leg. Please try again."
  }
}


/* ============================================================
 * FORMATTING
 * ============================================================
 */

function formatStatus(
  value:
    string
): string {
  return value
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    )
}