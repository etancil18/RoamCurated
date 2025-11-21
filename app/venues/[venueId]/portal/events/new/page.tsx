"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function NewEventPage({
  params,
}: {
  params: { venueId: string }
}) {
  const router = useRouter()
  const { venueId } = params

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const payload = {
      title: formData.get("title") || null,
      description: formData.get("description") || null,
      startsAt: formData.get("starts_at") || null,
      endsAt: formData.get("ends_at") || null,
      tags:
        (formData.get("tags") as string)
          ?.split(",")
          .map((t) => t.trim())
          .filter(Boolean) || null,
      priceInfo: formData.get("price_info") || null,
      permalink: formData.get("permalink") || null,
      source: "portal",
      sourceType: "portal",
      timezone: "America/New_York",
      rawPayload: null,
      is_active: true,
    }

    try {
      const res = await fetch(`/api/venues/${venueId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to create event")
      }

      setSuccessMsg("Event successfully created!")

      // Wait a moment for UX then redirect
      setTimeout(() => {
        router.push(`/venues/${venueId}/portal/events`)
      }, 800)
    } catch (err: any) {
      console.error("Failed to submit event:", err)
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-3xl font-semibold mb-6">Create New Event</h1>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-300">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 rounded-md bg-green-100 text-green-700 border border-green-300">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="title">Event Title</Label>
          <Input id="title" name="title" placeholder="Live DJ Night" required />
        </div>

        {/* Description */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Describe the event..."
            rows={4}
          />
        </div>

        {/* Starts At */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="starts_at">Starts At</Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
          />
        </div>

        {/* Ends At */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="ends_at">Ends At</Label>
          <Input id="ends_at" name="ends_at" type="datetime-local" />
        </div>

        {/* Tags */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="music, dj, gallery, comedy"
          />
        </div>

        {/* Price Info */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="price_info">Price Info</Label>
          <Input
            id="price_info"
            name="price_info"
            placeholder="$10, Free, Suggested Donation"
          />
        </div>

        {/* Permalink */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="permalink">Permalink (optional)</Label>
          <Input
            id="permalink"
            name="permalink"
            placeholder="https://instagram.com/p/abc123"
          />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={loading} className="w-full mt-4">
          {loading ? "Submitting..." : "Create Event"}
        </Button>
      </form>
    </div>
  )
}
