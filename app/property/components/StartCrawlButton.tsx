'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Venue = {
  id: string
  lat: number
  lon: number
}

type Props = {
  venues: Venue[]
  city: string
  propertyId?: string
  propertySlug?: string
}

export default function StartCrawlButton({
  venues,
  city,
  propertyId,
  propertySlug,
}: Props) {

  const router = useRouter()

  const handleStartCrawl = () => {

    if (!venues || venues.length === 0) return

    const venueIds = venues.map((v) => v.id).join(',')

    const params = new URLSearchParams({
      city,
      venues: venueIds,
    })

    // ✅ Append optional context for better UX downstream
    if (propertyId) {
      params.append('property_id', propertyId)
    }

    if (propertySlug) {
      params.append('property_slug', propertySlug)
    }

    router.push(`/property/crawl?${params.toString()}`)
  }

  return (
    <Button
      onClick={handleStartCrawl}
      className="mt-2 w-full"
      variant="default"
    >
      Start Crawl
    </Button>
  )
}