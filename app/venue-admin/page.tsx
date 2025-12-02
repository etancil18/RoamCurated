"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/client"
import type { Database } from "@/types/supabase"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type VenueSummary = Pick<Database["public"]["Tables"]["venues"]["Row"], "id" | "name" | "city">
type SupabaseUser = { email: string | null }

export default function VenueAdminPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [venues, setVenues] = useState<VenueSummary[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>("")
  const [form, setForm] = useState({
    title: "",
    date: "",
    start_time: "",
    end_time: "",
    tags: "",
    price_info: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // --- AUTH CHECK ---
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      // 🚧 DEV OVERRIDE: remove for production
      setUser(
        data.user
          ? { email: data.user.email ?? null }
          : { email: "evantancil@gmail.com" }
      )
    }
    loadUser()
  }, [supabase])

  // --- FETCH VENUES ---
  useEffect(() => {
    async function loadVenues() {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, city")
        .order("city")

      if (error) console.error("Error loading venues:", error)
      setVenues((data as VenueSummary[]) ?? [])
    }
    loadVenues()
  }, [supabase])

  // --- FORM SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedVenue) {
      setError("Please select a venue")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    const payload = {
      title: form.title.trim(),
      description: "",
      starts_at:
  form.date && form.start_time
    ? new Date(`${form.date}T${form.start_time}:00`).toISOString()
    : null,
ends_at:
  form.date && form.end_time
    ? new Date(`${form.date}T${form.end_time}:00`).toISOString()
    : null,
      tags: form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : null,
      price_info: form.price_info.trim() || null,
      source_type: "portal",
      source: "venue-admin",
      is_active: true, // ✅ ensure event is visible
    }

    console.log("📝 Submitting new event:", payload)

    const res = await fetch(`/api/venues/${selectedVenue}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (!res.ok) {
      console.error("❌ Event creation error:", json)
      setError(json.details || json.error || "Error submitting event")
    } else {
      console.log("✅ Event added successfully:", json)
      setSuccess(true)
      setForm({
        title: "",
        date: "",
        start_time: "",
        end_time: "",
        tags: "",
        price_info: "",
      })
    }

    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <Card className="border">
        <CardHeader>
          <CardTitle className="text-2xl">Venue Admin Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Create and manage events for venues. Access restricted to approved users.
          </p>
          <Separator className="my-4" />

          {error && <p className="text-red-600 mb-2">{error}</p>}
          {success && <p className="text-green-600 mb-2">✅ Event added successfully!</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block mb-1 font-medium">Select Venue</label>
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="">-- Choose Venue --</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.city?.toLowerCase() || "unknown"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-medium">Event Title</label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border p-2 rounded"
                placeholder="Live Music at Midtown Bar"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Start Time</label>
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 font-medium">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full border p-2 rounded"
                placeholder="dj, food, rooftop"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Price Info</label>
              <input
                type="text"
                value={form.price_info}
                onChange={(e) => setForm({ ...form, price_info: e.target.value })}
                className="w-full border p-2 rounded"
                placeholder="$15 cover or Free"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Event"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
