export type ActiveFlowRuntimeStopStatus =
  | 'planned'
  | 'completed'

export type ActiveFlowRuntimeStopKind =
  | 'base'
  | 'detour'

export type ActiveFlowRuntimeStopRow = {
  id: string
  session_id: string
  venue_id: string
  position: number | null
  status: string
  origin: string
  original_stop_id: string | null
}

export type ActiveFlowRuntimeProgressRow = {
  stop_index: number | null
  flow_stop_id: string | null
}

export type ActiveFlowDetourRow = {
  id: string
  session_id: string
  flow_stop_id: string
  before_flow_stop_id: string
  status: string
}

export type CanonicalActiveFlowRuntimeStop = {
  id: string
  sessionId: string
  venueId: string

  /**
   * Immutable base-route slot identity.
   *
   * NULL means this is an inserted runtime stop and therefore
   * does not participate in the legacy stop_index namespace.
   */
  position: number | null

  status: ActiveFlowRuntimeStopStatus
  origin: string
  originalStopId: string | null

  /**
   * Ephemeral order in the currently executable route.
   *
   * This value is derived only. It must never be persisted into
   * active_flow_progress.stop_index.
   */
  executionIndex: number

  kind: ActiveFlowRuntimeStopKind

  /**
   * Present only for an active Detour.
   */
  beforeFlowStopId: string | null

  completed: boolean
}

function isExecutableStatus(
  status: string
): status is ActiveFlowRuntimeStopStatus {
  return (
    status === 'planned' ||
    status === 'completed'
  )
}

function resolveCompletedStopIds({
  executableStops,
  progress,
}: {
  executableStops: ActiveFlowRuntimeStopRow[]
  progress: ActiveFlowRuntimeProgressRow[]
}): Set<string> {
  const executableStopIds =
    new Set(
      executableStops.map(
        (stop) => stop.id
      )
    )

  /**
   * Legacy fallback is intentionally restricted to positioned
   * base-route stops.
   *
   * A NULL-position Detour can therefore never be completed by
   * historical stop_index fallback.
   */
  const baseStopByPosition =
    new Map<
      number,
      ActiveFlowRuntimeStopRow
    >()

  for (const stop of executableStops) {
    if (stop.position == null) {
      continue
    }

    if (
      baseStopByPosition.has(
        stop.position
      )
    ) {
      throw new Error(
        `[active-flow/runtime-route] Multiple executable stops occupy base position ${stop.position}.`
      )
    }

    baseStopByPosition.set(
      stop.position,
      stop
    )
  }

  const completedStopIds =
    new Set<string>()

  for (const row of progress) {
    /**
     * 004/005 preferred identity.
     */
    if (
      row.flow_stop_id &&
      executableStopIds.has(
        row.flow_stop_id
      )
    ) {
      completedStopIds.add(
        row.flow_stop_id
      )

      continue
    }

    /**
     * Historical compatibility only.
     *
     * stop_index maps to immutable base-route position.
     * It never maps to executionIndex.
     *
     * NULL stop_index means this row does not participate in
     * legacy positional fallback.
     */
    if (row.stop_index == null) {
      continue
    }

    const fallbackStop =
      baseStopByPosition.get(
        row.stop_index
      )

    if (fallbackStop) {
      completedStopIds.add(
        fallbackStop.id
      )
    }
  }

  return completedStopIds
}

export function projectActiveFlowRuntimeRoute({
  sessionId,
  stops,
  detours,
  progress,
}: {
  sessionId: string
  stops: ActiveFlowRuntimeStopRow[]
  detours: ActiveFlowDetourRow[]
  progress: ActiveFlowRuntimeProgressRow[]
}): CanonicalActiveFlowRuntimeStop[] {
  const normalizedSessionId =
    sessionId.trim()

  if (!normalizedSessionId) {
    throw new Error(
      '[active-flow/runtime-route] sessionId is required.'
    )
  }

  /**
   * Replaced/removed generations remain historical ledger rows.
   */
  const executableStops =
    stops.filter(
      (stop) =>
        stop.session_id ===
          normalizedSessionId &&
        isExecutableStatus(
          stop.status
        )
    )

  const executableById =
    new Map(
      executableStops.map(
        (stop) => [
          stop.id,
          stop,
        ]
      )
    )

  const baseStops =
    executableStops
      .filter(
        (stop) =>
          stop.position != null
      )
      .slice()
      .sort(
        (a, b) =>
          (a.position as number) -
          (b.position as number)
      )

  /**
   * Position is an immutable base-slot identity.
   * Exactly one executable generation may occupy a base slot.
   */
  const seenPositions =
    new Set<number>()

  for (const stop of baseStops) {
    const position =
      stop.position as number

    if (
      seenPositions.has(position)
    ) {
      throw new Error(
        `[active-flow/runtime-route] Multiple executable stops occupy base position ${position}.`
      )
    }

    seenPositions.add(position)
  }

  const activeDetourByAnchor =
    new Map<
      string,
      {
        relation: ActiveFlowDetourRow
        stop: ActiveFlowRuntimeStopRow
      }
    >()

  const activeDetourStopIds =
    new Set<string>()

  for (const detour of detours) {
    if (
      detour.session_id !==
        normalizedSessionId ||
      detour.status !== 'active'
    ) {
      continue
    }

    const detourStop =
      executableById.get(
        detour.flow_stop_id
      )

    const anchorStop =
      executableById.get(
        detour.before_flow_stop_id
      )

    if (!detourStop) {
      throw new Error(
        `[active-flow/runtime-route] Active Detour ${detour.id} references a non-executable inserted stop.`
      )
    }

    if (!anchorStop) {
      throw new Error(
        `[active-flow/runtime-route] Active Detour ${detour.id} references a non-executable anchor.`
      )
    }

    if (
      detourStop.session_id !==
        normalizedSessionId ||
      anchorStop.session_id !==
        normalizedSessionId
    ) {
      throw new Error(
        `[active-flow/runtime-route] Active Detour ${detour.id} crosses Active Flow sessions.`
      )
    }

    if (detourStop.position != null) {
      throw new Error(
        `[active-flow/runtime-route] Active Detour ${detour.id} inserted stop must have position NULL.`
      )
    }

    if (anchorStop.position == null) {
      throw new Error(
        `[active-flow/runtime-route] Active Detour ${detour.id} anchor must be a base-route stop.`
      )
    }

    if (
      activeDetourByAnchor.has(
        anchorStop.id
      )
    ) {
      throw new Error(
        `[active-flow/runtime-route] Multiple active Detours target anchor ${anchorStop.id}.`
      )
    }

    if (
      activeDetourStopIds.has(
        detourStop.id
      )
    ) {
      throw new Error(
        `[active-flow/runtime-route] Runtime stop ${detourStop.id} belongs to multiple active Detours.`
      )
    }

    activeDetourStopIds.add(
      detourStop.id
    )

    activeDetourByAnchor.set(
      anchorStop.id,
      {
        relation: detour,
        stop: detourStop,
      }
    )
  }

  /**
   * Every executable NULL-position stop must be explained by an
   * active Detour relation.
   *
   * Fail closed rather than silently losing or appending it.
   */
  for (const stop of executableStops) {
    if (
      stop.position == null &&
      !activeDetourStopIds.has(
        stop.id
      )
    ) {
      throw new Error(
        `[active-flow/runtime-route] Executable inserted stop ${stop.id} has no active Detour relation.`
      )
    }
  }

  const completedStopIds =
    resolveCompletedStopIds({
      executableStops,
      progress,
    })

  const ordered: Array<{
    stop: ActiveFlowRuntimeStopRow
    kind: ActiveFlowRuntimeStopKind
    beforeFlowStopId: string | null
  }> = []

  for (const baseStop of baseStops) {
    const detour =
      activeDetourByAnchor.get(
        baseStop.id
      )

    if (detour) {
      ordered.push({
        stop: detour.stop,
        kind: 'detour',
        beforeFlowStopId:
          baseStop.id,
      })
    }

    ordered.push({
      stop: baseStop,
      kind: 'base',
      beforeFlowStopId: null,
    })
  }

  return ordered.map(
    (
      entry,
      executionIndex
    ): CanonicalActiveFlowRuntimeStop => ({
      id: entry.stop.id,

      sessionId:
        entry.stop.session_id,

      venueId:
        entry.stop.venue_id,

      position:
        entry.stop.position,

      status:
        entry.stop
          .status as ActiveFlowRuntimeStopStatus,

      origin:
        entry.stop.origin,

      originalStopId:
        entry.stop.original_stop_id,

      executionIndex,

      kind:
        entry.kind,

      beforeFlowStopId:
        entry.beforeFlowStopId,

      completed:
        completedStopIds.has(
          entry.stop.id
        ),
    })
  )
}