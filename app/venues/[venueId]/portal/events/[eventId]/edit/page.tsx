// app/venues/[venueId]/portal/events/[eventId]/edit/page.tsx

import { supabaseServerComponent } from "@/lib/supabase/client"
import type { EventRecord } from "@/types/supabase"
import EventForm from "@/components/events/EventForm"

export const revalidate = 0

export async function generateMetadata({
  params,
}: {
  params: { venueId: string; eventId: string }
}) {
  const supabase = supabaseServerComponent()

  const { data, error } = await supabase
    .from("events")
    .select("title")
    .eq("id", params.eventId)
    .single()

  const event = data as EventRecord | null

  return {
    title: event?.title ? `Edit Event – ${event.title}` : "Edit Event",
  }
}

export default async function EditEventPage({
  params,
}: {
  params: { venueId: string; eventId: string }
}) {
  const { venueId, eventId } = params
  const supabase = supabaseServerComponent()

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single()

  const event = data as EventRecord | null

  if (!event) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <p className="text-red-600 font-medium">Event not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-semibold mb-6">
        Edit Event – {event.title ?? "Untitled"}
      </h1>

      <EventForm
        mode="edit"
        venueId={venueId}
        event={event}
      />
    </div>
  )
}
