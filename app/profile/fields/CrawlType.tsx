// app/profile/fields/crawltype.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type CrawlTypeProps = {
  /** Current crawl type (slug) */
  value?: string
  /** Called when user selects a crawl type */
  onChange: (value: string) => void
}

/**
 * Crawl type preference options — these should map directly to
 * Supabase `profiles.crawl_type` (text).
 */
const CRAWL_TYPE_OPTIONS = [
  { label: "Social Discovery", value: "social_discovery" },
  { label: "Romantic Night", value: "romantic_night" },
  { label: "Solo Exploration", value: "solo_exploration" },
  { label: "Group Bash", value: "group_bash" },
  { label: "Art Crawl", value: "art_crawl" },
  { label: "Foodie Tour", value: "foodie_tour" },
  { label: "Chill Evening", value: "chill_evening" },
  { label: "Nightlife", value: "nightlife" },
]

export default function CrawlType({ value = "", onChange }: CrawlTypeProps) {
  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">Preferred Crawl Type</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="space-y-2"
      >
        {CRAWL_TYPE_OPTIONS.map(({ label, value: slug }) => (
          <div key={slug} className="flex items-center space-x-2">
            <RadioGroupItem id={slug} value={slug} />
            <Label htmlFor={slug}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}
