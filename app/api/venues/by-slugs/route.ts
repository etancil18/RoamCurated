// app/api/venues/by-slugs/route.ts
import { NextResponse } from "next/server";
import { supabaseServerApi } from "@/lib/supabase/server-api";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slugsParam = searchParams.get("slugs");

    if (!slugsParam) {
      return NextResponse.json(
        { error: "Missing slugs parameter" },
        { status: 400 }
      );
    }

    const slugs = slugsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (slugs.length === 0) {
      return NextResponse.json(
        { error: "No valid slugs provided" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerApi();

    const { data, error } = await supabase
      .from("venues")
      .select(`
        id,
        name,
        slug,
        lat,
        lon,
        city,
        tags,
        type,
        price,
        cover
      `)
      .in("slug", slugs);

    if (error) {
      console.error("[/api/venues/by-slugs] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch venues", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ venues: data ?? [] });
  } catch (err: any) {
    console.error("[/api/venues/by-slugs] Unexpected error:", err.message);
    return NextResponse.json(
      { error: "Unexpected server error", details: err.message },
      { status: 500 }
    );
  }
}
