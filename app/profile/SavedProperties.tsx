"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabaseBrowser, getCurrentUserId } from "@/lib/supabase/client"

type SavedProperty = {
  property_id: string
  city: string
  slug: string
}

function formatPropertyName(slug: string) {
  return slug
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCity(city: string) {
  return city
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function SavedProperties() {
  const [supabase] = useState(() => supabaseBrowser())
  const [loading, setLoading] = useState(true)
  const [properties, setProperties] = useState<SavedProperty[]>([])

  useEffect(() => {
    async function loadSaved() {
      const userId = await getCurrentUserId()

      if (!userId) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from("saved_properties")
        .select("property_id, city, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      setProperties(data ?? [])
      setLoading(false)
    }

    loadSaved()
  }, [supabase])

  if (loading) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-400">
        Loading saved guides…
      </p>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-black/30 px-4 py-5">
        <p className="text-sm font-medium text-neutral-300">
          No saved property guides yet.
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Save guides from properties you want to revisit or share with guests.
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-neutral-900 overflow-hidden rounded-2xl border border-neutral-800/80 bg-black/25">
      {properties.map((property) => (
        <Link
          key={property.property_id}
          href={`/property/${property.city}/${property.slug}`}
          className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-100">
              {formatPropertyName(property.slug)}
            </p>

            <p className="mt-0.5 text-xs text-neutral-500">
              {formatCity(property.city)} guide
            </p>
          </div>

          <span className="shrink-0 rounded-full border border-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-500 transition group-hover:border-cyan-400/40 group-hover:text-cyan-300">
            Open →
          </span>
        </Link>
      ))}
    </div>
  )
}