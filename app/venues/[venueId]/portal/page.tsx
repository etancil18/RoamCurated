import { cookies } from "next/headers"
import { createServerClient } from "@/lib/supabase/server" // ✅ SSR-safe version
import type { SupabaseClient } from "@supabase/supabase-js"
import { type Database, type VenueRecord } from "@/types/supabase"
import Link from "next/link"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const revalidate = 0

export default async function VenuePortalPage({
  params,
}: {
  params: { venueId: string }
}) {
  const { venueId } = params

  // ✅ SSR-safe Supabase client (synchronous cookies access)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .single()

  if (error || !data) {
    console.error("❌ Venue fetch error:", error)
    return <div className="text-red-600 p-4">Failed to load venue data.</div>
  }

  const v: VenueRecord = data

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-8">
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-2xl">{v.name ?? "Venue"} Portal</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {v.city && (
            <p className="text-sm text-muted-foreground">
              Managing events for <strong>{v.city.toUpperCase()}</strong>
            </p>
          )}

          <Separator />

          <div className="flex flex-col gap-4">
            <Link
              href={`/venues/${venueId}/portal/events`}
              className="text-blue-600 hover:underline"
            >
              ➤ Manage Events
            </Link>

            <Link
              href={`/venues/${venueId}/portal/events/new`}
              className="text-blue-600 hover:underline"
            >
              ➤ Create New Event
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
