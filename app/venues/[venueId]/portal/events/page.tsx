"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { createBrowserClient } from "@/lib/supabase/client"

import type { Database } from "@/types/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type EventRecord = Database["public"]["Tables"]["events"]["Row"]

export default function VenueEventsPage() {
  const { venueId } = useParams() as { venueId: string }
  const supabase = createBrowserClient()

  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("events")
        .select<EventRecord>("*")
        .eq("venue_id", venueId)
        .order("starts_at", { ascending: true })

      if (error) {
        console.error("Failed to load events:", error)
      } else {
        setEvents(Array.isArray(data) ? data : [])
      }

      setLoading(false)
    }

    load()
  }, [supabase, venueId])

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading events...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Events</h1>

        <Link
          href={`/venues/${venueId}/portal/events/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Create Event
        </Link>
      </div>

      <Separator className="my-4" />

      {events.length === 0 ? (
        <p className="text-gray-600 mt-4">
          No events for this venue yet. Create one using the button above.
        </p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const startText = event.starts_at
              ? format(new Date(event.starts_at), "EEE, MMM d • h:mm a")
              : "No start time"

            const endText = event.ends_at
              ? format(new Date(event.ends_at), "EEE, MMM d • h:mm a")
              : null

            return (
              <Card key={event.id} className="border">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{event.title || "Untitled Event"}</span>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/venues/${venueId}/portal/events/${event.id}/edit`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Edit
                      </Link>

                      <form
                        action={`/api/venues/${venueId}/events/${event.id}`}
                        method="post"
                      >
                        <input type="hidden" name="_method" value="DELETE" />
                        <button
                          type="submit"
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong>Starts:</strong> {startText}
                  </p>

                  {endText && (
                    <p className="text-sm text-gray-700">
                      <strong>Ends:</strong> {endText}
                    </p>
                  )}

                  {event.tags && event.tags.length > 0 && (
                    <p className="text-sm">
                      <strong>Tags:</strong> {event.tags.join(", ")}
                    </p>
                  )}

                  {event.description && (
                    <p className="text-sm text-gray-700">{event.description}</p>
                  )}

                  {event.permalink && (
                    <p className="text-sm">
                      <a
                        href={event.permalink}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        View Source →
                      </a>
                    </p>
                  )}

                  <p className="text-sm">
                    <strong>Status:</strong>{" "}
                    {event.is_active ? (
                      <span className="text-green-700">Active</span>
                    ) : (
                      <span className="text-gray-500">Inactive</span>
                    )}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
