// app/venues/[venueId]/portal/events/[eventId]/edit/page.tsx

import { createServerClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import EventForm from "@/components/events/EventForm"
import Link from "next/link"

type EventRecord = Database["public"]["Tables"]["events"]["Row"]

export const revalidate = 0

export default async function EditEventPage({
  params,
}: {
  params: { venueId: string; eventId: string }
}) {
  const { venueId, eventId } = params

  // ✅ Use SSR Supabase client
  const supabase = await createServerClient() as SupabaseClient<Database>

  // ✅ Load the event
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId as string)
    .maybeSingle()

  if (error) {
    console.error("❌ Failed to load event:", error)
  }

  const event = data as EventRecord | null

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {event?.title ? `Edit Event – ${event.title}` : "Edit Event"}
        </h1>

        <Link
          href={`/venues/${venueId}/portal/events`}
          className="text-blue-600 hover:underline"
        >
          ← Back to Events
        </Link>
      </div>

      {/* ✅ EventForm now receives `mode` and `event` */}
      <EventForm
        venueId={venueId}
        mode="edit"
        event={event ?? undefined}
      />
    </div>
  )
}
