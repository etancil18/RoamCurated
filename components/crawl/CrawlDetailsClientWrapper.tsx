'use client'

import dynamic from 'next/dynamic'
import type { FC } from 'react'

const CrawlDetailsModal = dynamic(() => import('./CrawlDetailsModal'), { ssr: false })

export default function CrawlDetailsClientWrapper({
  slug,
  stops,
}: {
  slug: string
  stops: { name: string; instagram?: string | null }[]
}) {
  return <CrawlDetailsModal slug={slug} stops={stops} />
}
