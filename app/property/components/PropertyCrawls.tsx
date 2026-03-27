import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { DateTime } from 'luxon'

import StartCrawlButton from './StartCrawlButton'
import {
  generatePropertyCrawls,
  type ThemedCrawlResult
} from '@/lib/crawls/crawlGenerator'

import type { Venue } from '@/types/venue'

type Property = {
  id: string
  name: string
  lat: number
  lon: number
  city: string
  slug?: string
}

type Props = {
  property: Property
  venues: Venue[]
  city: string
}

/* ------------------------------------------------ */
/* Crawl Title Helper                               */
/* ------------------------------------------------ */

function getCrawlTitle(theme: string) {

  const titles: Record<string,string> = {
    dateNight: '💘 Date Night',
    nightOut: '🌙 Night Out',
    morningFlow: '🌅 Morning Flow',
    soloExplorer: '🧭 Solo Explorer'
  }

  return titles[theme] ?? '🚶 Local Crawl'
}

/* ------------------------------------------------ */
/* Stage Label Helper                               */
/* ------------------------------------------------ */

function formatStageLabel(
  matchedType?: string | null,
  stageTypes?: readonly string[]
) {

  const label =
    matchedType ??
    (stageTypes && stageTypes.length > 0 ? stageTypes[0] : null)

  if (!label) return null

  return label
    .replace('-', ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

/* ------------------------------------------------ */
/* Theme Order                                      */
/* ------------------------------------------------ */

const THEME_ORDER = [
  'dateNight',
  'nightOut',
  'morningFlow',
  'soloExplorer'
]

/* ------------------------------------------------ */
/* Component                                        */
/* ------------------------------------------------ */

export default function PropertyCrawls({
  property,
  venues
}: Props) {

  const now = DateTime.now()

  const crawls = generatePropertyCrawls(
    venues,
    property.lat,
    property.lon,
    now
  )

  /* ------------------------------------------------ */
  /* Guard against malformed crawl objects            */
  /* ------------------------------------------------ */

  const validCrawls: ThemedCrawlResult[] = (crawls ?? []).filter(
    (c): c is ThemedCrawlResult =>
      Boolean(c && c.crawl && Array.isArray(c.crawl.venues))
  )

  /* ------------------------------------------------ */
  /* Ensure stable theme order                        */
  /* ------------------------------------------------ */

  const orderedCrawls = validCrawls.sort(
    (a,b) =>
      THEME_ORDER.indexOf(a.theme) -
      THEME_ORDER.indexOf(b.theme)
  )

  if (orderedCrawls.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          🚶 Suggested Crawls
        </h2>

        <p className="text-sm text-muted-foreground">
          We're still mapping out the best local routes — check back soon.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">

      <h2 className="text-sm font-semibold">
        🚶 Suggested Crawls
      </h2>

      <div className="grid gap-4">

        {orderedCrawls.map(({ theme, crawl }, index) => (

          <Card key={`${theme}-${index}`}>
            <CardContent className="p-4 space-y-3">

              <div className="flex items-center justify-between">

                <p className="font-medium">
                  {getCrawlTitle(theme)}
                </p>

                <StartCrawlButton
                  venues={crawl.venues}
                  city={property.city}
                  propertyId={property.id}
                  propertySlug={property.slug}
                />

              </div>

              <div className="space-y-1 text-sm text-muted-foreground">

                {(crawl.venues ?? []).map((v: Venue, i: number) => {

                  const stageLabel = formatStageLabel(
                    crawl.stages?.[i]?.matchedType,
                    crawl.stages?.[i]?.stageTypes
                  )

                  return (
                    <div
                      key={`${v.id}-${i}`}
                      className="flex items-center gap-2"
                    >

                      <span className="text-xs font-semibold w-4">
                        {i + 1}.
                      </span>

                      {stageLabel && (
                        <span className="text-xs opacity-70 whitespace-nowrap">
                          {stageLabel} —
                        </span>
                      )}

                      <Link
                        href={`/venue-profile/${v.id}`}
                        className="hover:underline"
                      >
                        {v.name}
                      </Link>

                    </div>
                  )

                })}

              </div>

            </CardContent>
          </Card>

        ))}

      </div>

    </section>
  )
}