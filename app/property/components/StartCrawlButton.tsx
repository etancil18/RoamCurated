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
}

export default function StartCrawlButton({ venues, city }: Props) {
  const router = useRouter()

  const handleStartCrawl = () => {
    if (!venues || venues.length === 0) return

    // encode venue ids for query string
    const venueIds = venues.map((v) => v.id).join(',')

    router.push(
      `/property/crawl?city=${encodeURIComponent(city)}&venues=${encodeURIComponent(
        venueIds
      )}`
    )
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