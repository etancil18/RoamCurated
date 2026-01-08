import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabaseRouteHandler } from "@/lib/supabase/route-handler";

/**
 * API route for saving a scheduled crawl to the database.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { plannedStartAt, route, name } = body as {
      plannedStartAt?: string;
      route?: any[];
      name?: string;
    };

    /** ------------------ Auth ------------------ **/
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.warn("❌ Missing Authorization header");
      return NextResponse.json({ error: "Missing auth header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      console.warn("❌ Empty token in Authorization header");
      return NextResponse.json({ error: "Empty auth token" }, { status: 401 });
    }

    const supabase = supabaseRouteHandler(req);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      console.warn("❌ Supabase auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    /** ------------------ Validation ------------------ **/

    // Allow fallback from query param (defensive)
    if (!plannedStartAt) {
      const url = new URL(req.url);
      plannedStartAt = url.searchParams.get("plannedStartAt") ?? undefined;
    }

    if (!plannedStartAt) {
      return NextResponse.json(
        { error: "plannedStartAt is required" },
        { status: 400 }
      );
    }

    const startTime = new Date(plannedStartAt);
    if (isNaN(startTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid plannedStartAt format" },
        { status: 400 }
      );
    }

    if (!Array.isArray(route) || route.length === 0) {
      return NextResponse.json(
        { error: "route must be a non-empty array" },
        { status: 400 }
      );
    }

    /** ------------------ Logging ------------------ **/
    console.log("💾 SAVING SCHEDULED ROUTE:", {
      userId,
      plannedStartAt: startTime.toISOString(),
      stopCount: route.length,
      name: name ?? null,
    });

    /** ------------------ Insert ------------------ **/
    const { data, error } = await supabase
      .from("scheduled_routes")
      .insert({
        id: uuidv4(),
        user_id: userId,
        planned_start_at: startTime.toISOString(),
        route_data: route,
        status: "scheduled",
        name: name ?? "Scheduled Crawl",
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Failed to save scheduled route:", error);

      /** 🔁 Log to route_failures (failsafe, non-blocking) */
      try {
        await supabase.from("route_failures").insert({
          user_id: userId,
          error: error.message,
          city: "unknown",
          source: "scheduled-routes/route.ts",
          attempted_at: new Date().toISOString(),
          filter_params: {
            plannedStartAt: startTime.toISOString(),
            stopCount: route.length,
            name,
          },
        });
      } catch (logError) {
        console.error("📉 Failed to log to route_failures:", logError);
      }

      return NextResponse.json(
        { error: "Failed to save scheduled route" },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledRoute: data });
  } catch (err: any) {
    console.error("❌ Scheduled route API error:", err);

    try {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "").trim();
      const supabase = supabaseRouteHandler(req);
      const userId = token
        ? (await supabase.auth.getUser(token)).data?.user?.id
        : null;

      if (userId) {
        await supabase.from("route_failures").insert({
          user_id: userId,
          error: err.message ?? String(err),
          city: "unknown",
          source: "scheduled-routes/route.ts",
          attempted_at: new Date().toISOString(),
          filter_params: {
            reason: "catch block failure",
          },
        });
      }
    } catch (logError) {
      console.error("📉 Logging failure in catch block:", logError);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
