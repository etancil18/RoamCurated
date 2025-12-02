// app/venues/[venueId]/portal/events/page.tsx

import { createServerClient } from "@/lib/supabase/server"
import type { Database } from "@/types/supabase"
import Link from "next/link"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type VenueRecord = Database["public"]["Tables"]["venues"]["Row"]

export const revalidate = 0 // Always fetch fresh data

export default async function VenueEventsPage({
  params,
}: {
  params: { venueId: string }
}) {
  const { venueId } = params

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("id", venueId)
    .maybeSingle()

  if (error) {
    console.error("❌ Failed to fetch venue:", error)
  }

  const v = data as VenueRecord | null

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-8">
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-2xl">
            {v?.name ?? "Venue"} Portal
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {v?.city && (
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
