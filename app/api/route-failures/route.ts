import { NextRequest, NextResponse } from "next/server";
import { supabaseRouteHandler } from "@/lib/supabase/route-handler";

export async function GET(req: NextRequest) {
  const supabase = supabaseRouteHandler(req);
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const theme = searchParams.get("theme");
  const source = searchParams.get("source");
  const limit = Number(searchParams.get("limit") ?? 50);

  let query = supabase
    .from("route_failures")
    .select("*")
    .order("attempted_at", { ascending: false })
    .limit(limit);

  if (city) query = query.eq("city", city);
  if (theme) query = query.eq("theme", theme);
  if (source) query = query.eq("source", source);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch route failures" },
      { status: 500 }
    );
  }

  return NextResponse.json({ failures: data });
}
