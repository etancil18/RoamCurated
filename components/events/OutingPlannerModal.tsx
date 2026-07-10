"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import UberRideButton from "@/components/rideshare/UberRideButton"
import VenueBookingButtons from "@/components/venue-profile/VenueBookingButtons"
import { logEvent } from "@/lib/logEvent"
import {
  getGroupSizePresetOptions,
  type GroupSizePresetId,
} from "@/lib/outings/groupSizePresets"
import {
  expandVibeTags,
  getVibePresetOptions,
  type VibePresetId,
} from "@/lib/outings/vibePresets"

type PlanMode = "before" | "after" | "full"
type Budget = "$" | "$$" | "$$$" | "$$$$"
type Mobility = "walk" | "short_ride" | "any"
type LeaveEarlyByHours = 1 | 2 | 3 | 4

type StopRole =
  | "coffee"
  | "food"
  | "drink"
  | "activity"
  | "dessert"

type SelectionPass =
  | "strict"
  | "balanced"
  | "relaxed"
  | "emergency"

type PlannerEvent = {
  id: string
  title?: string | null
  description?: string | null
  starts_at?: string | null
  venue?: {
    id?: string | null
    name?: string | null
    city?: string | null
    address?: string | null
  } | null
}

type VenueBookingOption = {
  provider: string
  url: string
}

type PlannedStop = {
  id: string
  venueId: string
  stopOrder: number

  role: StopRole
  phase?: "before" | "after" | null

  venueType?: string | null
  displayType?: string | null

  title: string
  rationale?: string | null

  plannedArrivalAt?: string | null
  plannedDepartureAt?: string | null

  dwellMinutes?: number | null
  travelMode?: string | null
  travelMinutesFromPrev?: number | null
  distanceMetersFromPrev?: number | null

  lat?: number | null
  lon?: number | null
  address?: string | null

  bookingOptions?: VenueBookingOption[] | null
  reservationRecommended?: boolean
  recommendedReservationAt?: string | null

  eventArchetype?: string | null
  semanticRole?: string | null
  slotPhase?: "before" | "after" | null
  slotIndex?: number | null
}

type SlotRejectionCounts = {
  used: number
  role: number
  geometry: number
  temporal: number
  type_time: number
  hours: number
  missing_data: number

  vibe_required?: number
  vibe_discouraged?: number

  semantic_mismatch?: number
  tag_mismatch?: number
  venue_vibe_mismatch?: number
  energy_mismatch?: number
  time_category_mismatch?: number
}

type SlotSelectionDebug = {
  slotIndex: number
  role: StopRole
  phase?: "before" | "after"

  selectedVenueId: string | null
  selectedPass?: SelectionPass | null

  candidatesTotal: number
  matchedRole: number
  passedHardConstraints: number

  rejectionCounts: SlotRejectionCounts

  selectedScore?: number | null
  selectedSemanticScore?: number | null
  selectedVibeScore?: number | null

  selectedMatchedTags?: string[]
  selectedMatchedVibes?: string[]
  selectedMatchedTypes?: string[]
}

type VibeDiagnostics = {
  requestedVibes: string[]

  preferredTypes: string[]
  requiredAnyTypes: string[]
  discouragedTypes: string[]
  stronglyDiscouragedTypes: string[]

  preferredDayparts: string[]
  discouragedDayparts: string[]

  matchedCandidateCount?: number
  rejectedCandidateCount?: number

  routeVibeConfidence?: number | null
}

type SemanticDiagnostics = {
  eventTokens: string[]

  matchedCandidateCount?: number
  weakMatchCandidateCount?: number
  rejectedCandidateCount?: number

  averageSemanticScore?: number | null
  routeSemanticConfidence?: number | null

  selectedVenueMatches?: Array<{
    venueId: string
    matchedTags: string[]
    matchedVibes: string[]
    matchedTypes: string[]
    matchedTimeCategories: string[]
    semanticScore: number
  }>
}

type PlanDebug = {
  candidatePoolSize: number
  preparedCandidateCount: number
  selectedStopCount: number
  completionRate: number

  slotDiagnostics: SlotSelectionDebug[]

  vibeDiagnostics?: VibeDiagnostics | null
  semanticDiagnostics?: SemanticDiagnostics | null
}

type ScoreBreakdown = {
  mode: PlanMode
  city: string | null

  eventTags: string[]
  eventArchetype: string

  candidatePoolSize: number
  selectedStops: number
  preparedCandidateCount: number

  intendedStopCount: number
  effectiveIntendedStopCount: number
  completionRate: number

  failedToGenerateStops: boolean
  reducedBeforeSingleStopFallbackApplied: boolean

  leaveEarlyByHours: LeaveEarlyByHours | null
  plannedExitAt: string | null
  effectiveExitAt: string | null

  vibeTags?: string[]
  vibePreferredTypes?: string[]
  vibeRequiredAnyTypes?: string[]
  vibeDiscouragedTypes?: string[]
  vibeStronglyDiscouragedTypes?: string[]

  routeVibeConfidence?: number | null
  routeSemanticConfidence?: number | null

  averageSelectedSemanticScore?: number | null
  averageSelectedVibeScore?: number | null
  averageSelectedTagScore?: number | null
}

type PlanOutingResponse = {
  success: true

  plannedOutingId: string
  status: string
  mode: PlanMode

  summary: string
  confidenceScore: number

  anchor?: {
    eventId?: string
    title?: string | null
    startsAt?: string | null
    endsAt?: string | null

    leaveEarlyByHours?: LeaveEarlyByHours | null
    plannedExitAt?: string | null
    effectiveExitAt?: string | null

    venue?: {
      id?: string | null
      name?: string | null
      city?: string | null
      address?: string | null
    } | null
  }

  stops: PlannedStop[]

  debug?: PlanDebug | null
  scoreBreakdown?: ScoreBreakdown
}

type PlannerFailureCode =
  | "late_night_low_coverage"
  | "insufficient_venue_coverage"

type PlanOutingErrorResponse = {
  success?: false
  error?: string
  message?: string

  code?: PlannerFailureCode | "insufficient_coverage" | null
  suggestedModes?: PlanMode[]

  debug?: PlanDebug | null
  scoreBreakdown?: ScoreBreakdown | null
}

type OutingPlannerModalProps = {
  open: boolean
  onClose: () => void
  event: PlannerEvent | null
}

const MODE_LABELS: Record<PlanMode, string> = {
  before: "Before Event",
  after: "After Event",
  full: "Full Night",
}

const LEAVE_EARLY_OPTIONS: Array<{
  value: LeaveEarlyByHours
  label: string
}> = [
  { value: 1, label: "1 hour early" },
  { value: 2, label: "2 hours early" },
  { value: 3, label: "3 hours early" },
  { value: 4, label: "4 hours early" },
]

const GROUP_SIZE_OPTIONS = getGroupSizePresetOptions()
const VIBE_OPTIONS = getVibePresetOptions()

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
): void {
  try {
    void Promise.resolve(logEvent(eventName, metadata))
  } catch (error) {
    console.warn("logEvent failed:", eventName, error)
  }
}

export default function OutingPlannerModal({
  open,
  onClose,
  event,
}: OutingPlannerModalProps) {
  const router = useRouter()

  const [mode, setMode] = useState<PlanMode>("full")
  const modeRef = useRef<PlanMode>("full")

  const [groupSize, setGroupSize] = useState(2)
  const [groupSizePresetId, setGroupSizePresetId] =
    useState<GroupSizePresetId | null>("duo")
  const [budget, setBudget] = useState<Budget | "">("")
  const [mobility, setMobility] = useState<Mobility>("short_ride")
  const [vibePresetId, setVibePresetId] =
    useState<VibePresetId | null>(null)
  const [vibeTags, setVibeTags] = useState<string[]>([])

  const [plannedExitEnabled, setPlannedExitEnabled] = useState(false)
  const [leaveEarlyByHours, setLeaveEarlyByHours] =
    useState<LeaveEarlyByHours>(2)

  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [plannerFailureCode, setPlannerFailureCode] =
    useState<PlannerFailureCode | null>(null)
  const [suggestedModes, setSuggestedModes] = useState<PlanMode[]>([])

  const [plan, setPlan] = useState<PlanOutingResponse | null>(null)
  const [plannerDebug, setPlannerDebug] = useState<PlanDebug | null>(null)
  const [scoreBreakdown, setScoreBreakdown] =
    useState<ScoreBreakdown | null>(null)

  const [planDirty, setPlanDirty] = useState(false)
  const [hasUserSelectedMode, setHasUserSelectedMode] = useState(false)

  const initialPlanKeyRef = useRef<string | null>(null)
  const openedLoggedRef = useRef(false)
  const stopImpressionIdsRef = useRef<Set<string>>(new Set())

  /*
   * Preference changes can trigger a newer request before an older request
   * resolves. Aborting and sequencing requests prevents stale plans from
   * replacing the latest result.
   */
  const activeRequestControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)

  const derivedDefaultMode = useMemo<PlanMode>(() => {
    if (!event?.starts_at) return "full"

    const startsAt = new Date(event.starts_at)

    if (Number.isNaN(startsAt.getTime())) {
      return "full"
    }

    const diffMinutes = Math.round(
      (startsAt.getTime() - Date.now()) / 60_000
    )

    if (diffMinutes > 240) return "before"
    if (diffMinutes > 45) return "full"

    return "after"
  }, [event?.starts_at])

  const plannerInput = useMemo(
    () => ({
      eventId: event?.id ?? null,
      mode,
      groupSize,
      groupSizePresetId,
      budget: budget || null,
      mobility,
      vibePresetId,
      vibeTags,
      plannedExitEnabled,
      leaveEarlyByHours,
    }),
    [
      event?.id,
      mode,
      groupSize,
      groupSizePresetId,
      budget,
      mobility,
      vibePresetId,
      vibeTags,
      plannedExitEnabled,
      leaveEarlyByHours,
    ]
  )

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    if (!open || !event?.id || openedLoggedRef.current) return

    openedLoggedRef.current = true

    safeLogEvent("outing_planner_opened", {
      event_id: event.id,
      event_title: event.title ?? null,
      venue_id: event.venue?.id ?? null,
      city: event.venue?.city ?? null,
      derived_default_mode: derivedDefaultMode,
    })
  }, [
    open,
    event?.id,
    event?.title,
    event?.venue?.id,
    event?.venue?.city,
    derivedDefaultMode,
  ])

  useEffect(() => {
    if (!open || hasUserSelectedMode) return

    setMode(derivedDefaultMode)
    modeRef.current = derivedDefaultMode
  }, [open, derivedDefaultMode, hasUserSelectedMode])

  useEffect(() => {
    if (open) return

    activeRequestControllerRef.current?.abort()
    activeRequestControllerRef.current = null
    requestSequenceRef.current += 1

    setError(null)
    setPlannerFailureCode(null)
    setSuggestedModes([])

    setPlan(null)
    setPlannerDebug(null)
    setScoreBreakdown(null)

    setLoading(false)
    setRegenerating(false)
    setPlanDirty(false)

    setGroupSize(2)
    setGroupSizePresetId("duo")
    setBudget("")
    setMobility("short_ride")
    setVibePresetId(null)
    setVibeTags([])

    setPlannedExitEnabled(false)
    setLeaveEarlyByHours(2)
    setHasUserSelectedMode(false)

    initialPlanKeyRef.current = null
    openedLoggedRef.current = false
    stopImpressionIdsRef.current = new Set()
  }, [open])

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort()
    }
  }, [])

  const selectGroupSizePreset = (presetId: GroupSizePresetId) => {
    const preset = GROUP_SIZE_OPTIONS.find(
      (option) => option.id === presetId
    )

    if (!preset) return

    setGroupSizePresetId(presetId)
    setGroupSize(preset.representativeSize)
    setPlanDirty(true)

    safeLogEvent("outing_group_size_selected", {
      event_id: event?.id ?? null,
      group_size_preset_id: presetId,
      group_size: preset.representativeSize,
    })
  }

  const toggleVibePreset = (presetId: VibePresetId) => {
    setVibePresetId((previousPresetId) => {
      const nextPresetId =
        previousPresetId === presetId ? null : presetId

      const nextTags = nextPresetId
        ? expandVibeTags(nextPresetId)
        : []

      setVibeTags(nextTags)
      setPlanDirty(true)

      safeLogEvent("outing_vibe_selected", {
        event_id: event?.id ?? null,
        vibe_preset_id: nextPresetId,
        vibe_tags: nextTags,
      })

      return nextPresetId
    })
  }

  const handleBudgetChange = (nextBudget: Budget | "") => {
    setBudget(nextBudget)
    setPlanDirty(true)

    safeLogEvent("outing_budget_selected", {
      event_id: event?.id ?? null,
      budget: nextBudget || null,
    })
  }

  const handleMobilityChange = (nextMobility: Mobility) => {
    setMobility(nextMobility)
    setPlanDirty(true)

    safeLogEvent("outing_mobility_selected", {
      event_id: event?.id ?? null,
      mobility: nextMobility,
    })
  }

  const handleLeaveEarlyToggle = (enabled: boolean) => {
    setPlannedExitEnabled(enabled)
    setPlanDirty(true)

    safeLogEvent("outing_leave_early_toggled", {
      event_id: event?.id ?? null,
      enabled,
      leave_early_by_hours: enabled ? leaveEarlyByHours : null,
    })
  }

  const handleLeaveEarlyHoursChange = (
    hours: LeaveEarlyByHours
  ) => {
    setLeaveEarlyByHours(hours)
    setPlanDirty(true)

    safeLogEvent("outing_leave_early_hours_selected", {
      event_id: event?.id ?? null,
      leave_early_by_hours: hours,
    })
  }

  const generatePlan = useCallback(
    async ({
      nextMode,
      isRegenerate = false,
    }: {
      nextMode?: PlanMode
      isRegenerate?: boolean
    } = {}) => {
      if (!event?.id) return

      const activeMode = nextMode ?? modeRef.current
      const requestId = requestSequenceRef.current + 1

      requestSequenceRef.current = requestId

      activeRequestControllerRef.current?.abort()

      const controller = new AbortController()
      activeRequestControllerRef.current = controller

      setError(null)
      setPlannerFailureCode(null)
      setSuggestedModes([])

      if (isRegenerate) {
        setRegenerating(true)
      } else {
        setLoading(true)
      }

      try {
        const shouldSendLeaveEarlyByHours =
          activeMode !== "before" && plannedExitEnabled

        safeLogEvent(
          isRegenerate
            ? "outing_plan_regenerate_started"
            : "outing_plan_generate_started",
          {
            event_id: event.id,
            mode: activeMode,
            group_size: groupSize,
            group_size_preset_id: groupSizePresetId ?? null,
            budget: budget || null,
            mobility,
            vibe_preset_id: vibePresetId ?? null,
            vibe_tags: vibeTags,
            leave_early_enabled: plannedExitEnabled,
            leave_early_by_hours: shouldSendLeaveEarlyByHours
              ? leaveEarlyByHours
              : null,
          }
        )

        const response = await fetch(
          `/api/events/${event.id}/plan-outing`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: activeMode,
              groupSize,
              groupSizePresetId: groupSizePresetId ?? undefined,
              budget: budget || undefined,
              mobility,
              vibePresetId: vibePresetId ?? undefined,
              vibeTags,
              leaveEarlyByHours: shouldSendLeaveEarlyByHours
                ? leaveEarlyByHours
                : undefined,
            }),
            signal: controller.signal,
          }
        )

        const data = await readJsonResponse(response)

        if (
          controller.signal.aborted ||
          requestId !== requestSequenceRef.current
        ) {
          return
        }

        if (!response.ok) {
          const errorData = isPlanOutingErrorResponse(data)
            ? data
            : null

          console.error("plan-outing error response:", errorData)

          const debugData = errorData?.debug ?? null
          const scoreData = errorData?.scoreBreakdown ?? null

          const failureCode = normalizePlannerFailureCode(
            errorData?.code
          )

          const nextSuggestedModes = normalizeSuggestedModes(
            errorData?.suggestedModes
          )

          setPlannerDebug(debugData)
          setScoreBreakdown(scoreData)
          setPlannerFailureCode(failureCode)
          setSuggestedModes(nextSuggestedModes)

          const message =
            errorData?.message ||
            errorData?.error ||
            "Failed to generate outing plan"

          safeLogEvent("outing_plan_failed", {
            event_id: event.id,
            mode: activeMode,
            reason: message,
            failure_code: failureCode,
            suggested_modes: nextSuggestedModes,
            status: response.status,
            score_breakdown: scoreData,
            debug: debugData,
          })

          throw new Error(message)
        }

        if (!isPlanOutingResponse(data)) {
          throw new Error(
            "The planner returned an invalid success response"
          )
        }

        console.log("plan-outing success/debug payload:", data)

        safeLogEvent("outing_plan_generated", {
          event_id: event.id,
          planned_outing_id: data.plannedOutingId,
          mode: data.mode,
          stop_count: data.stops.length,
          confidence_score: data.confidenceScore,
          completion_rate:
            data.scoreBreakdown?.completionRate ?? null,
          selected_stops:
            data.scoreBreakdown?.selectedStops ?? null,
          candidate_pool_size:
            data.scoreBreakdown?.candidatePoolSize ?? null,
          route_vibe_confidence:
            data.scoreBreakdown?.routeVibeConfidence ?? null,
          route_semantic_confidence:
            data.scoreBreakdown?.routeSemanticConfidence ?? null,
        })

        setPlan(data)
        setPlannerFailureCode(null)
        setSuggestedModes([])
        setPlannerDebug(data.debug ?? null)
        setScoreBreakdown(data.scoreBreakdown ?? null)

        setMode(activeMode)
        modeRef.current = activeMode
        setPlanDirty(false)
      } catch (caughtError) {
        if (
          isAbortError(caughtError) ||
          controller.signal.aborted ||
          requestId !== requestSequenceRef.current
        ) {
          return
        }

        console.error("Error generating outing plan:", caughtError)

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to generate outing plan"

        safeLogEvent("outing_plan_error", {
          event_id: event.id,
          mode: activeMode,
          message,
        })

        setPlan(null)
        setError(message)
      } finally {
        if (requestId === requestSequenceRef.current) {
          setLoading(false)
          setRegenerating(false)

          if (activeRequestControllerRef.current === controller) {
            activeRequestControllerRef.current = null
          }
        }
      }
    },
    [
      budget,
      event?.id,
      groupSize,
      groupSizePresetId,
      mobility,
      leaveEarlyByHours,
      plannedExitEnabled,
      vibePresetId,
      vibeTags,
    ]
  )

  useEffect(() => {
    if (!open || !event?.id) return

    const initialPlanKey = `${event.id}:${derivedDefaultMode}`

    if (initialPlanKeyRef.current === initialPlanKey) return

    initialPlanKeyRef.current = initialPlanKey

    void generatePlan({
      nextMode: derivedDefaultMode,
      isRegenerate: false,
    })
  }, [open, event?.id, derivedDefaultMode, generatePlan])

  useEffect(() => {
    if (!open || !event?.id || !planDirty) return
    if (loading || regenerating) return

    const timeout = window.setTimeout(() => {
      void generatePlan({
        isRegenerate: true,
      })
    }, 650)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    open,
    event?.id,
    planDirty,
    loading,
    regenerating,
    plannerInput,
    generatePlan,
  ])

  useEffect(() => {
    if (
      !open ||
      !plan?.plannedOutingId ||
      plan.stops.length === 0
    ) {
      return
    }

    for (const stop of plan.stops) {
      const key =
        `${plan.plannedOutingId}:${stop.venueId}:${stop.stopOrder}`

      if (stopImpressionIdsRef.current.has(key)) continue

      stopImpressionIdsRef.current.add(key)

      safeLogEvent("outing_stop_impression", {
        event_id: event?.id ?? null,
        planned_outing_id: plan.plannedOutingId,
        venue_id: stop.venueId,
        stop_order: stop.stopOrder,
        role: stop.role,
        phase: stop.phase ?? null,
        venue_type: stop.venueType ?? null,
        display_type: stop.displayType ?? null,
        event_archetype: stop.eventArchetype ?? null,
        semantic_role: stop.semanticRole ?? null,
        has_booking_options: Boolean(stop.bookingOptions?.length),
        reservation_recommended:
          stop.reservationRecommended ?? false,
      })
    }
  }, [open, plan, event?.id])

  const handleModeChange = async (nextMode: PlanMode) => {
    if (
      nextMode === modeRef.current &&
      plan &&
      !planDirty
    ) {
      return
    }

    safeLogEvent("outing_mode_selected", {
      event_id: event?.id ?? null,
      previous_mode: modeRef.current,
      mode: nextMode,
    })

    setHasUserSelectedMode(true)
    setMode(nextMode)

    modeRef.current = nextMode

    setPlanDirty(false)

    await generatePlan({
      nextMode,
      isRegenerate: true,
    })
  }

  const handleViewPlan = () => {
    if (!event?.id || !plan?.plannedOutingId) return

    safeLogEvent("outing_view_plan_clicked", {
      event_id: event.id,
      planned_outing_id: plan.plannedOutingId,
      mode: plan.mode,
    })

    router.push(
      `/events/${event.id}/outing/${plan.plannedOutingId}`
    )
  }

  if (!open || !event) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      aria-modal="true"
      aria-labelledby="outing-planner-title"
      role="dialog"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white shadow-2xl"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-cyan-400">
              Plan Outing
            </p>

            <h2
              id="outing-planner-title"
              className="mt-1 text-2xl font-semibold"
            >
              {event.title || "Untitled Event"}
            </h2>

            <div className="mt-2 space-y-1 text-sm text-neutral-400">
              {event.starts_at ? (
                <p>{formatDateTime(event.starts_at)}</p>
              ) : null}

              {event.venue?.name ? (
                <p>📍 {event.venue.name}</p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-5">
              <section>
                <p className="mb-2 text-sm font-medium text-neutral-300">
                  Timing
                </p>

                <div className="flex flex-wrap gap-2">
                  {(["before", "after", "full"] as PlanMode[]).map(
                    (option) => {
                      const selected = mode === option

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            void handleModeChange(option)
                          }
                          disabled={loading || regenerating}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? "border-cyan-500 bg-cyan-500 text-white"
                              : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                          }`}
                        >
                          {MODE_LABELS[option]}
                        </button>
                      )
                    }
                  )}
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Group Size
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {GROUP_SIZE_OPTIONS.map((option) => {
                      const selected =
                        groupSizePresetId === option.id

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            selectGroupSizePreset(option.id)
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? "border-cyan-500 bg-cyan-500 text-white"
                              : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                          }`}
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>

                  {groupSizePresetId ? (
                    <p className="mt-2 text-xs text-neutral-400">
                      {
                        GROUP_SIZE_OPTIONS.find(
                          (option) =>
                            option.id === groupSizePresetId
                        )?.description
                      }
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Budget
                  </label>

                  <select
                    value={budget}
                    onChange={(changeEvent) =>
                      handleBudgetChange(
                        changeEvent.target.value as Budget | ""
                      )
                    }
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Any</option>
                    <option value="$">$</option>
                    <option value="$$">$$</option>
                    <option value="$$$">$$$</option>
                    <option value="$$$$">$$$$</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Mobility
                  </label>

                  <select
                    value={mobility}
                    onChange={(changeEvent) =>
                      handleMobilityChange(
                        changeEvent.target.value as Mobility
                      )
                    }
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="walk">Walk only</option>
                    <option value="short_ride">Short ride</option>
                    <option value="any">Any</option>
                  </select>
                </div>

                {mode !== "before" ? (
                  <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        id="planned-exit-toggle"
                        type="checkbox"
                        checked={plannedExitEnabled}
                        onChange={(changeEvent) =>
                          handleLeaveEarlyToggle(
                            changeEvent.target.checked
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-900 text-cyan-500 focus:ring-cyan-500"
                      />

                      <div className="min-w-0">
                        <label
                          htmlFor="planned-exit-toggle"
                          className="block text-sm font-medium text-neutral-300"
                        >
                          Leaving before the event ends?
                        </label>

                        <p className="mt-1 text-xs text-neutral-400">
                          Roam will subtract 1 to 4 hours from the
                          event end time and look for viable
                          post-event options from there.
                        </p>
                      </div>
                    </div>

                    {plannedExitEnabled ? (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-300">
                          Leave Early By
                        </label>

                        <div className="flex flex-wrap gap-2">
                          {LEAVE_EARLY_OPTIONS.map((option) => {
                            const selected =
                              leaveEarlyByHours === option.value

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  handleLeaveEarlyHoursChange(
                                    option.value
                                  )
                                }
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                  selected
                                    ? "border-cyan-500 bg-cyan-500 text-white"
                                    : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                                }`}
                              >
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Vibe
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {VIBE_OPTIONS.map((option) => {
                      const selected = vibePresetId === option.id

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            toggleVibePreset(option.id)
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? "border-cyan-500 bg-cyan-500 text-white"
                              : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                          }`}
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>

                  {vibePresetId ? (
                    <p className="mt-2 text-xs text-neutral-400">
                      {
                        VIBE_OPTIONS.find(
                          (option) => option.id === vibePresetId
                        )?.description
                      }
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void generatePlan({
                      isRegenerate: true,
                    })
                  }
                  disabled={loading || regenerating}
                  className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {regenerating
                    ? "Recalibrating..."
                    : planDirty
                      ? "Apply Preferences"
                      : "Regenerate Plan"}
                </button>

                <button
                  type="button"
                  onClick={handleViewPlan}
                  disabled={
                    loading ||
                    regenerating ||
                    !plan?.plannedOutingId
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  View Plan
                </button>
              </section>
            </div>

            <div className="min-w-0">
              {loading ? (
                <PlannerLoadingState />
              ) : error ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-red-900 bg-red-950/40 p-5">
                    <p className="text-sm font-medium text-red-300">
                      Could not build outing plan
                    </p>

                    <p className="mt-2 text-sm text-red-200">
                      {error}
                    </p>
                  </div>

                  {plannerFailureCode ===
                  "late_night_low_coverage" ? (
                    <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-5">
                      <p className="text-sm font-medium text-indigo-300">
                        Late-night options are limited
                      </p>

                      <p className="mt-2 text-sm leading-6 text-indigo-100">
                        This event ends very late, and most venues
                        in the area are likely closed or winding
                        down around that time. Roam could not
                        confidently build a quality post-event
                        itinerary.
                      </p>

                      {suggestedModes.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {suggestedModes.map((suggestedMode) => (
                            <button
                              key={suggestedMode}
                              type="button"
                              onClick={() =>
                                void handleModeChange(suggestedMode)
                              }
                              disabled={loading || regenerating}
                              className="rounded-full border border-indigo-700 bg-indigo-900/40 px-3 py-1.5 text-xs font-medium text-indigo-100 hover:bg-indigo-900/60"
                            >
                              Try {MODE_LABELS[suggestedMode]}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <p className="mt-4 text-xs text-indigo-200/80">
                        You may have better results planning before
                        the event or leaving a few hours early.
                      </p>
                    </div>
                  ) : scoreBreakdown || plannerDebug ? (
                    <div className="space-y-4 rounded-xl border border-amber-900 bg-amber-950/30 p-5">
                      <div>
                        <p className="text-sm font-medium text-amber-300">
                          Planner diagnostics
                        </p>

                        <p className="mt-1 text-xs text-amber-200/80">
                          These values show why the API returned 422.
                        </p>
                      </div>

                      {scoreBreakdown ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <DiagnosticCard
                            label="Mode"
                            value={scoreBreakdown.mode}
                          />

                          <DiagnosticCard
                            label="City"
                            value={scoreBreakdown.city ?? "—"}
                          />

                          <DiagnosticCard
                            label="Candidate pool"
                            value={String(
                              scoreBreakdown.candidatePoolSize
                            )}
                          />

                          <DiagnosticCard
                            label="Selected stops"
                            value={String(
                              scoreBreakdown.selectedStops
                            )}
                          />

                          <DiagnosticCard
                            label="Prepared candidates"
                            value={String(
                              scoreBreakdown.preparedCandidateCount
                            )}
                          />

                          <DiagnosticCard
                            label="Completion rate"
                            value={`${Math.round(
                              scoreBreakdown.completionRate * 100
                            )}%`}
                          />

                          <DiagnosticCard
                            label="Intended stops"
                            value={String(
                              scoreBreakdown.intendedStopCount
                            )}
                          />

                          <DiagnosticCard
                            label="Effective target"
                            value={String(
                              scoreBreakdown.effectiveIntendedStopCount
                            )}
                          />

                          {scoreBreakdown.routeSemanticConfidence !=
                          null ? (
                            <DiagnosticCard
                              label="Semantic confidence"
                              value={`${Math.round(
                                scoreBreakdown
                                  .routeSemanticConfidence * 100
                              )}%`}
                            />
                          ) : null}

                          {scoreBreakdown.routeVibeConfidence !=
                          null ? (
                            <DiagnosticCard
                              label="Vibe confidence"
                              value={`${Math.round(
                                scoreBreakdown.routeVibeConfidence *
                                  100
                              )}%`}
                            />
                          ) : null}
                        </div>
                      ) : null}

                      {plannerDebug?.slotDiagnostics?.length ? (
                        <div className="space-y-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-amber-300">
                            Slot diagnostics
                          </p>

                          {plannerDebug.slotDiagnostics.map((slot) => (
                            <div
                              key={`${slot.slotIndex}-${slot.role}`}
                              className="rounded-lg border border-amber-900/70 bg-black/20 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-white">
                                  Slot {slot.slotIndex + 1}
                                </span>

                                <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-200">
                                  {slot.role}
                                </span>

                                {slot.phase ? (
                                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-300">
                                    {slot.phase}
                                  </span>
                                ) : null}

                                {slot.selectedPass ? (
                                  <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[11px] uppercase tracking-wide text-cyan-200">
                                    {slot.selectedPass}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <DiagnosticCard
                                  label="Candidates"
                                  value={String(slot.candidatesTotal)}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Role matches"
                                  value={String(slot.matchedRole)}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Passed hard constraints"
                                  value={String(
                                    slot.passedHardConstraints
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: used"
                                  value={String(
                                    slot.rejectionCounts.used
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: role"
                                  value={String(
                                    slot.rejectionCounts.role
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: geometry"
                                  value={String(
                                    slot.rejectionCounts.geometry
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: temporal"
                                  value={String(
                                    slot.rejectionCounts.temporal
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: type/time"
                                  value={String(
                                    slot.rejectionCounts.type_time
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: hours"
                                  value={String(
                                    slot.rejectionCounts.hours
                                  )}
                                  compact
                                />

                                <DiagnosticCard
                                  label="Rejected: missing data"
                                  value={String(
                                    slot.rejectionCounts.missing_data
                                  )}
                                  compact
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : plan ? (
                <div className="space-y-4">
                  {planDirty ? (
                    <p className="rounded-lg border border-cyan-900 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-200">
                      Preferences changed. Recalibrating venue
                      sequence…
                    </p>
                  ) : null}

                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-cyan-400">
                          {MODE_LABELS[plan.mode]}
                        </p>

                        <h3 className="mt-1 text-lg font-semibold">
                          Your Contextual Outing Plan
                        </h3>
                      </div>

                      <div className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                        Confidence{" "}
                        {Math.round(
                          (plan.confidenceScore || 0) * 100
                        )}
                        %
                      </div>
                    </div>

                    {plan.summary ? (
                      <p className="mt-3 text-sm leading-6 text-neutral-300">
                        {plan.summary}
                      </p>
                    ) : null}

                    {plan.anchor?.plannedExitAt ||
                    plan.anchor?.effectiveExitAt ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-400">
                        {plan.anchor?.plannedExitAt ? (
                          <span className="rounded-full bg-neutral-950 px-2.5 py-1">
                            Planned exit{" "}
                            {formatTime(plan.anchor.plannedExitAt)}
                          </span>
                        ) : null}

                        {plan.anchor?.effectiveExitAt ? (
                          <span className="rounded-full bg-neutral-950 px-2.5 py-1">
                            Exit-aware anchor{" "}
                            {formatTime(plan.anchor.effectiveExitAt)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {plan.stops.map((stop, index) => {
                      const previousStop =
                        index > 0 ? plan.stops[index - 1] : null

                      return (
                        <div
                          key={stop.id}
                          className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-semibold text-white">
                              {index + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-semibold text-white">
                                  {stop.title}
                                </h4>

                                <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-300">
                                  {humanizeStopType(
                                    stop.displayType ??
                                      stop.venueType ??
                                      stop.role
                                  )}
                                </span>
                              </div>

                              {stop.rationale ? (
                                <p className="mt-2 text-sm leading-6 text-neutral-300">
                                  {stop.rationale}
                                </p>
                              ) : null}

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-400">
                                {stop.plannedArrivalAt ? (
                                  <span className="rounded-full bg-neutral-950 px-2.5 py-1">
                                    Arrive{" "}
                                    {formatTime(
                                      stop.plannedArrivalAt
                                    )}
                                  </span>
                                ) : null}

                                {stop.travelMode ? (
                                  <span className="rounded-full bg-neutral-950 px-2.5 py-1">
                                    {humanizeStopType(
                                      stop.travelMode
                                    )}

                                    {stop.travelMinutesFromPrev !=
                                    null
                                      ? ` · ${stop.travelMinutesFromPrev} min`
                                      : ""}
                                  </span>
                                ) : null}
                              </div>

                              {stop.address ? (
                                <p className="mt-3 text-xs text-neutral-500">
                                  {stop.address}
                                </p>
                              ) : null}

                              {(stop.bookingOptions?.length ?? 0) >
                                0 ||
                              stop.reservationRecommended ? (
                                <div
                                  className="mt-4"
                                  onClickCapture={() => {
                                    safeLogEvent(
                                      "outing_booking_click",
                                      {
                                        event_id: event.id,
                                        planned_outing_id:
                                          plan.plannedOutingId,
                                        venue_id: stop.venueId,
                                        stop_order: stop.stopOrder,
                                        role: stop.role,
                                        provider:
                                          stop.bookingOptions?.[0]
                                            ?.provider ?? null,
                                      }
                                    )
                                  }}
                                >
                                  <VenueBookingButtons
                                    bookingOptions={
                                      stop.bookingOptions
                                    }
                                    reservationRecommended={
                                      stop.reservationRecommended
                                    }
                                    recommendedReservationAt={
                                      stop.recommendedReservationAt
                                    }
                                    compact
                                  />
                                </div>
                              ) : null}

                              {previousStop ? (
                                <div className="mt-3">
                                  <UberRideButton
                                    pickup={{
                                      name: previousStop.title,
                                      address: previousStop.address,
                                      lat: previousStop.lat,
                                      lon: previousStop.lon,
                                    }}
                                    dropoff={{
                                      name: stop.title,
                                      address: stop.address,
                                      lat: stop.lat,
                                      lon: stop.lon,
                                    }}
                                    travelMinutes={
                                      stop.travelMinutesFromPrev
                                    }
                                    plannedOutingId={
                                      plan.plannedOutingId
                                    }
                                    eventId={event.id}
                                    fromVenueId={
                                      previousStop.venueId
                                    }
                                    toVenueId={stop.venueId}
                                    compact
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                  <p className="text-sm text-neutral-300">
                    No outing plan available yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DiagnosticCard({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-800 bg-neutral-900/60 ${
        compact ? "px-3 py-2" : "p-3"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-white">
        {value}
      </p>
    </div>
  )
}

async function readJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function isPlanOutingResponse(
  value: unknown
): value is PlanOutingResponse {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    record.success === true &&
    typeof record.plannedOutingId === "string" &&
    typeof record.status === "string" &&
    isPlanMode(record.mode) &&
    typeof record.summary === "string" &&
    typeof record.confidenceScore === "number" &&
    Number.isFinite(record.confidenceScore) &&
    Array.isArray(record.stops)
  )
}

function isPlanOutingErrorResponse(
  value: unknown
): value is PlanOutingErrorResponse {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.error === "string" ||
    typeof record.message === "string" ||
    typeof record.code === "string"
  )
}

function normalizePlannerFailureCode(
  value: unknown
): PlannerFailureCode | null {
  if (
    value === "late_night_low_coverage" ||
    value === "insufficient_venue_coverage"
  ) {
    return value
  }

  /*
   * Backward compatibility with older route payloads.
   */
  if (value === "insufficient_coverage") {
    return "insufficient_venue_coverage"
  }

  return null
}

function normalizeSuggestedModes(
  value: unknown
): PlanMode[] {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(value.filter(isPlanMode)))
}

function isPlanMode(
  value: unknown
): value is PlanMode {
  return (
    value === "before" ||
    value === "after" ||
    value === "full"
  )
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  )
}

function humanizeStopType(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ")
}

function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function PlannerLoadingState() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="h-4 w-28 rounded bg-neutral-800" />
        <div className="mt-3 h-6 w-56 rounded bg-neutral-800" />
        <div className="mt-4 h-4 w-full rounded bg-neutral-800" />
        <div className="mt-2 h-4 w-4/5 rounded bg-neutral-800" />
      </div>

      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-neutral-800 bg-neutral-900 p-4"
        >
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 rounded-full bg-neutral-800" />

            <div className="flex-1">
              <div className="h-5 w-40 rounded bg-neutral-800" />
              <div className="mt-3 h-4 w-56 rounded bg-neutral-800" />
              <div className="mt-2 h-4 w-full rounded bg-neutral-800" />
              <div className="mt-2 h-4 w-3/4 rounded bg-neutral-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}