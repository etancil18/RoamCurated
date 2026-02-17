// app/crawl/[slug]/page.tsx
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { MapCanvasSaved } from "@/components/maps/map-dynamic-wrapper"
import CrawlDetailsClientWrapper from "@/components/crawl/CrawlDetailsClientWrapper"
import type { Venue } from "@/types/venue"
import type { Database } from "@/types/supabase"

export const dynamic = "force-dynamic"

type SavedRouteResponse = {
  stops: {
    venue_id: string
    name: string
    lat: number
    lon: number
    image_url?: string
    instagram_handle?: string | null
  }[]
  city: string | null
}

function normalizeCity(
  value: string | null
): "atl" | "nyc" | "lisbon" | "porto" {
  if (!value) return "nyc"

  const v = value.toLowerCase()

  // 🇺🇸 Atlanta
  if (v === "atl" || v === "atlanta") return "atl"

  // 🇺🇸 New York
  if (["nyc", "new-york", "newyork", "ny"].includes(v)) return "nyc"

  // 🇵🇹 Lisbon
  if (["lis", "lisbon", "lx", "lisboa"].includes(v)) return "lisbon"

  // 🇵🇹 Porto
  if (["porto", "opo"].includes(v)) return "porto"

  return "nyc"
}

export default async function CrawlPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("saved_routes")
    .select("stops, city")
    .eq("slug", slug)
    .single<SavedRouteResponse>()

  if (error || !data || !Array.isArray(data.stops)) {
    console.error("[crawl/[slug]] Failed to load route:", slug, error?.message)
    notFound()
  }

  const names = data.stops.map((s) => s.name)

  const { data: venueRecords } = await supabase
    .from("venues")
    .select("id, name")
    .in("name", names)

  const city = normalizeCity(data.city)

  const route: Venue[] = data.stops.map((stop) => {
    const matched = venueRecords?.find(
      (v: { id: string; name: string | null }) => v.name === stop.name
    )

    return {
      id: matched?.id || stop.venue_id,
      name: stop.name,
      slug: stop.name.toLowerCase().replace(/\s+/g, "-"),
      lat: stop.lat,
      lon: stop.lon,
      cover: stop.image_url
        ? stop.image_url.startsWith("img/")
          ? stop.image_url
          : `img/venues/${stop.image_url}`
        : undefined,
      link: matched?.id ? `/venue-profile/${matched.id}` : "",
      city,
    }
  })

  return (
    <main className="relative h-screen w-screen">
      <div className="fixed bottom-4 left-4 z-[10000] pointer-events-auto">
        <CrawlDetailsClientWrapper
          slug={slug}
          stops={data.stops.map((stop) => ({
            name: stop.name,
            instagram: stop.instagram_handle,
          }))}
        />
      </div>

      <MapCanvasSaved venues={route} city={city} />
    </main>
  )
}
