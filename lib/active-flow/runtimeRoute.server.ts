import 'server-only'

import type {
  SupabaseClient,
} from '@supabase/supabase-js'

import {
  projectActiveFlowRuntimeRoute,
  type ActiveFlowDetourRow,
  type ActiveFlowRuntimeProgressRow,
  type ActiveFlowRuntimeStopRow,
  type CanonicalActiveFlowRuntimeStop,
} from '@/lib/active-flow/runtimeRoute'

export async function loadActiveFlowRuntimeRoute({
  sessionId,
  userId,
  supabase,
}: {
  sessionId: string
  userId: string
  supabase: SupabaseClient
}): Promise<
  CanonicalActiveFlowRuntimeStop[]
> {
  const normalizedSessionId =
    sessionId.trim()

  const normalizedUserId =
    userId.trim()

  if (!normalizedSessionId) {
    throw new Error(
      '[active-flow/runtime-route] sessionId is required.'
    )
  }

  if (!normalizedUserId) {
    throw new Error(
      '[active-flow/runtime-route] userId is required.'
    )
  }

  const [
    stopsResult,
    detoursResult,
    progressResult,
  ] = await Promise.all([
    supabase
      .from('active_flow_stops')
      .select(
        `
          id,
          session_id,
          venue_id,
          position,
          status,
          origin,
          original_stop_id
        `
      )
      .eq(
        'session_id',
        normalizedSessionId
      )
      .in(
        'status',
        [
          'planned',
          'completed',
        ]
      )
      .returns<
        ActiveFlowRuntimeStopRow[]
      >(),

    supabase
      .from('active_flow_detours')
      .select(
        `
          id,
          session_id,
          flow_stop_id,
          before_flow_stop_id,
          status
        `
      )
      .eq(
        'session_id',
        normalizedSessionId
      )
      .eq(
        'status',
        'active'
      )
      .returns<
        ActiveFlowDetourRow[]
      >(),

    supabase
      .from('active_flow_progress')
      .select(
        `
          stop_index,
          flow_stop_id
        `
      )
      .eq(
        'session_id',
        normalizedSessionId
      )
      .eq(
        'user_id',
        normalizedUserId
      )
      .returns<
        ActiveFlowRuntimeProgressRow[]
      >(),
  ])

  if (stopsResult.error) {
    throw new Error(
      `[active-flow/runtime-route] Runtime stop fetch failed: ${stopsResult.error.message}`
    )
  }

  if (detoursResult.error) {
    throw new Error(
      `[active-flow/runtime-route] Detour fetch failed: ${detoursResult.error.message}`
    )
  }

  if (progressResult.error) {
    throw new Error(
      `[active-flow/runtime-route] Progress fetch failed: ${progressResult.error.message}`
    )
  }

  return projectActiveFlowRuntimeRoute({
    sessionId:
      normalizedSessionId,

    stops:
      stopsResult.data ?? [],

    detours:
      detoursResult.data ?? [],

    progress:
      progressResult.data ?? [],
  })
}