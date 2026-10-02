import { NextResponse } from 'next/server'

import {
  loadActiveFlowRuntimeRoute,
} from '@/lib/active-flow/runtimeRoute.server'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin-runtime'

import {
  createServerClient,
} from '@/lib/supabase/server'


type CancelDetourRequestBody = {
  session_id?: unknown
  venue_id?: unknown
}


type CancelDetourRpcRow = {
  session_id: string
  detour_flow_stop_id: string
  before_flow_stop_id: string
  detour_venue_id: string
}


function normalizeRequiredString(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}


export async function POST(
  req: Request
) {
  try {
    // ========================================================
    // 1. Authenticate.
    //
    // The browser never supplies user_id.
    // ========================================================

    const supabase =
      await createServerClient()

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'Authentication required.',
        },
        {
          status: 401,
        }
      )
    }


    // ========================================================
    // 2. Parse the minimal cancellation request.
    //
    // Browser authority:
    //
    //   session_id
    //   venue_id
    //
    // venue_id identifies the Detour the user is asking to
    // remove from the visible canonical route.
    //
    // Browser does NOT choose:
    //
    //   user_id
    //   flow_stop_id
    //   Detour relation ID
    //   anchor stop
    //   position
    //   execution index
    //   lifecycle status
    // ========================================================

    let body:
      CancelDetourRequestBody

    try {
      body =
        await req.json() as
          CancelDetourRequestBody
    } catch {
      return NextResponse.json(
        {
          error:
            'Invalid JSON body.',
        },
        {
          status: 400,
        }
      )
    }

    const sessionId =
      normalizeRequiredString(
        body.session_id
      )

    const venueId =
      normalizeRequiredString(
        body.venue_id
      )

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'session_id is required.',
        },
        {
          status: 400,
        }
      )
    }

    if (!venueId) {
      return NextResponse.json(
        {
          error:
            'venue_id is required.',
        },
        {
          status: 400,
        }
      )
    }


    // ========================================================
    // 3. Establish session ownership and active-session state.
    //
    // Unlike opportunity acceptance, cancellation does not
    // depend on Community Signal scoring/discovery.
    //
    // We therefore do NOT route through 013 candidate assembly.
    //
    // The RPC independently re-checks ownership, active state,
    // and frozen execution-policy constraints at mutation time.
    // ========================================================

    const {
      data: session,
      error: sessionError,
    } =
      await supabase
        .from('active_flow_sessions')
        .select(
          `
            id,
            user_id,
            status
          `
        )
        .eq(
          'id',
          sessionId
        )
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle()

    if (sessionError) {
      throw new Error(
        `[active-flow/detours/cancel] Session fetch failed: ${sessionError.message}`
      )
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            'Active Flow session not found.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      session.status !==
      'active'
    ) {
      return NextResponse.json(
        {
          error:
            'Active Flow session is not active.',
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 4. Load the canonical executable runtime route.
    //
    // Frozen runtime authority:
    //
    //   active_flow_stops
    //       +
    //   active active_flow_detours
    //       +
    //   active_flow_progress
    //       ↓
    //   loadActiveFlowRuntimeRoute()
    //
    // The browser cannot nominate an arbitrary runtime stop.
    // ========================================================

    const runtimeStops =
      await loadActiveFlowRuntimeRoute({
        sessionId,

        userId:
          user.id,

        supabase,
      })


    // ========================================================
    // 5. Resolve the exact cancellable Detour server-side.
    //
    // Requirements:
    //
    //   - canonical executable runtime stop
    //   - kind = detour
    //   - venue matches the visible Detour selected by user
    //   - not completed
    //
    // Executable venue uniqueness should make this unique, but
    // we still fail closed if canonical state is ambiguous.
    // ========================================================

    const matchingDetours =
      runtimeStops.filter(
        (stop) =>
          stop.kind ===
            'detour' &&
          stop.venueId ===
            venueId
      )

    if (
      matchingDetours.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            'Active Flow Detour is no longer available.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      matchingDetours.length !==
      1
    ) {
      throw new Error(
        '[active-flow/detours/cancel] Canonical runtime route contains ambiguous Detour venue identity.'
      )
    }

    const detourStop =
      matchingDetours[0]

    if (
      detourStop.completed
    ) {
      return NextResponse.json(
        {
          error:
            'Completed Active Flow Detour cannot be canceled.',
        },
        {
          status: 409,
        }
      )
    }


    // ========================================================
    // 6. Defensive canonical Detour assertions.
    //
    // The projector already guarantees these properties.
    // Keeping the assertions here makes the mutation boundary
    // explicit and fails closed if its contract ever changes.
    // ========================================================

    if (
      detourStop.position !==
      null
    ) {
      throw new Error(
        '[active-flow/detours/cancel] Canonical Detour unexpectedly occupies a base position.'
      )
    }

    if (
      !detourStop.beforeFlowStopId
    ) {
      throw new Error(
        '[active-flow/detours/cancel] Canonical Detour has no base anchor.'
      )
    }


    // ========================================================
    // 7. Enter the trusted mutation boundary.
    //
    // Browser-supplied venue_id is NOT forwarded as mutation
    // authority.
    //
    // The server forwards only the exact immutable flow_stop_id
    // derived from the fresh canonical runtime route.
    //
    // 016H.3 independently re-checks:
    //
    //   - exact owned session
    //   - active session
    //   - frozen execution policy
    //   - exact active Detour relation
    //   - exact inserted position=NULL stop
    //   - incomplete progress state
    //   - exact valid base anchor
    //
    // It atomically transitions:
    //
    //   stop.status:
    //     planned -> removed
    //
    //   relation.status:
    //     active -> canceled
    //
    // It never rewrites progress.
    // ========================================================

    const admin =
      getSupabaseAdmin()

    const {
      data: cancelData,
      error: cancelError,
    } =
      await admin.rpc(
        'cancel_active_flow_detour',
        {
          p_session_id:
            sessionId,

          p_user_id:
            user.id,

          p_detour_flow_stop_id:
            detourStop.id,
        }
      )

    if (cancelError) {
      console.error(
        '[active-flow/detours/cancel] Cancellation RPC rejected:',
        cancelError
      )

      return NextResponse.json(
        {
          error:
            'Active Flow Detour could not be canceled.',
        },
        {
          status: 409,
        }
      )
    }

    const cancelRows =
      (cancelData ??
        []) as CancelDetourRpcRow[]

    const cancellation =
      cancelRows[0] ??
      null

    if (!cancellation) {
      throw new Error(
        'Active Flow Detour cancellation returned no mutation result.'
      )
    }


    // ========================================================
    // 8. Defensive result-identity verification.
    //
    // The RPC result must describe the exact runtime identity
    // derived server-side above.
    // ========================================================

    if (
      cancellation.session_id !==
        sessionId ||
      cancellation.detour_flow_stop_id !==
        detourStop.id ||
      cancellation.detour_venue_id !==
        detourStop.venueId ||
      cancellation.before_flow_stop_id !==
        detourStop.beforeFlowStopId
    ) {
      throw new Error(
        '[active-flow/detours/cancel] Cancellation RPC returned unexpected runtime identity.'
      )
    }


    // ========================================================
    // 9. Return only useful mutation identities.
    //
    // No progress, venue visit, event participation,
    // event check-in, interest, or report is created here.
    // ========================================================

    return NextResponse.json(
      {
        ok: true,

        sessionId:
          cancellation.session_id,

        canceledDetour: {
          venueId:
            cancellation.detour_venue_id,
        },
      },
      {
        status: 200,
      }
    )
  } catch (error) {
    console.error(
      '[active-flow/detours/cancel] Request failed:',
      error
    )

    const message =
      error instanceof Error
        ? error.message
        : 'Could not cancel Active Flow Detour.'

    if (
      message ===
        'Active Flow session not found.' ||
      message ===
        'Active Flow session is not active.'
    ) {
      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status: 409,
        }
      )
    }

    return NextResponse.json(
      {
        error:
          'Could not cancel Active Flow Detour.',
      },
      {
        status: 500,
      }
    )
  }
}