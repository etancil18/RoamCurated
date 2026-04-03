'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import StartCrawlButton from './StartCrawlButton'

import type { PropertyCrawlCard } from '@/lib/property/getPropertyGuideData'
import { logEvent } from '@/lib/logEvent'

type Props = {
  property: {
    id: string
    name: string
    city: string
    slug?: string
  }
  crawls: PropertyCrawlCard[]
}

export default function PropertyCrawls({ property, crawls }: Props) {
  if (!crawls || crawls.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Suggested Routes</h2>

        <p className="text-sm text-muted-foreground">
          We&apos;re still mapping the best nearby plans. In the meantime, use
          the map and nearby venues to explore what&apos;s close.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">Suggested Routes</h2>

      <div className="grid gap-4">
        {crawls.map(({ crawl, vm }, index) => (
          <PropertyCrawlCardView
            key={vm.id}
            property={property}
            crawl={crawl}
            vm={vm}
            position={index}
            totalCrawls={crawls.length}
          />
        ))}
      </div>
    </section>
  )
}

function PropertyCrawlCardView({
  property,
  crawl,
  vm,
  position,
  totalCrawls,
}: {
  property: Props['property']
  crawl: PropertyCrawlCard['crawl']
  vm: PropertyCrawlCard['vm']
  position: number
  totalCrawls: number
}) {
  const impressionLoggedRef = useRef(false)

  useEffect(() => {
    if (impressionLoggedRef.current) return
    impressionLoggedRef.current = true

    void logEvent('property_crawl_impression', {
      metadata: {
        property_id: property.id,
        property_name: property.name,
        property_slug: property.slug ?? null,
        city: property.city,
        crawl_vm_id: vm.id,
        crawl_title: vm.title,
        crawl_subtitle: vm.subtitle,
        position,
        total_crawls: totalCrawls,
        stop_count: vm.stops.length,
        venue_ids: crawl.venues.map((venue) => venue.id),
      },
    })
  }, [
    crawl.venues,
    position,
    property.city,
    property.id,
    property.name,
    property.slug,
    totalCrawls,
    vm.id,
    vm.stops.length,
    vm.subtitle,
    vm.title,
  ])

  const handleStartCrawlClick = () => {
    void logEvent('property_crawl_clicked', {
      metadata: {
        property_id: property.id,
        property_name: property.name,
        property_slug: property.slug ?? null,
        city: property.city,
        crawl_vm_id: vm.id,
        crawl_title: vm.title,
        crawl_subtitle: vm.subtitle,
        position,
        total_crawls: totalCrawls,
        stop_count: vm.stops.length,
        venue_ids: crawl.venues.map((venue) => venue.id),
      },
    })
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {vm.chips.map((chip) => (
                <Chip key={chip}>{chip}</Chip>
              ))}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{vm.title}</h3>
              <p className="text-sm text-muted-foreground">{vm.subtitle}</p>
            </div>
          </div>

          <div onClickCapture={handleStartCrawlClick}>
            <StartCrawlButton
              venues={crawl.venues}
              city={property.city}
              propertyId={property.id}
              propertySlug={property.slug}
            />
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          {vm.stops.map((stop) => (
            <div
              key={stop.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {stop.order}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stop.stageLabel}
                  </span>

                  {stop.walkTimeFromPreviousLabel && (
                    <Chip>{stop.walkTimeFromPreviousLabel}</Chip>
                  )}
                </div>

                <Link
                  href={stop.venueHref}
                  onClick={() => {
                    void logEvent('property_crawl_stop_clicked', {
                      venue_id: stop.id,
                      metadata: {
                        property_id: property.id,
                        property_name: property.name,
                        property_slug: property.slug ?? null,
                        city: property.city,
                        crawl_vm_id: vm.id,
                        crawl_title: vm.title,
                        stop_id: stop.id,
                        stop_order: stop.order,
                        stop_name: stop.venueName,
                        stop_stage_label: stop.stageLabel,
                        venue_href: stop.venueHref,
                      },
                    })
                  }}
                  className="font-medium hover:underline"
                >
                  {stop.venueName}
                </Link>

                {stop.description && (
                  <p className="text-sm text-muted-foreground">
                    {stop.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}