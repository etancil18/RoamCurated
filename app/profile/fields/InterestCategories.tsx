// app/profile/fields/interestcategories.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

type InterestCategoriesProps = {
  /** Array of selected category slugs */
  value: string[]
  /** Handler to update selected categories */
  onChange: (value: string[]) => void
}

/**
 * Categories mapped to slugs for storage and labels for display.
 * Slugs align with Supabase `profiles.interest_categories` (text[]).
 */
const INTEREST_CATEGORY_OPTIONS = [
  { label: "Art", value: "art" },
  { label: "Music", value: "music" },
  { label: "Foodie Spots", value: "foodie_spots" },
  { label: "Nightlife", value: "nightlife" },
  { label: "Live Events", value: "live_events" },
  { label: "Nature", value: "nature" },
  { label: "Games", value: "games" },
  { label: "Dancing", value: "dancing" },
  { label: "Hidden Gems", value: "hidden_gems" },
]

export default function InterestCategories({
  value,
  onChange,
}: InterestCategoriesProps) {
  const toggleCategory = React.useCallback(
    (slug: string) => {
      if (value.includes(slug)) {
        onChange(value.filter((c) => c !== slug))
      } else {
        onChange([...value, slug])
      }
    },
    [value, onChange]
  )

  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">What Are You Most Interested In?</Label>
      <div className="grid grid-cols-2 gap-2">
        {INTEREST_CATEGORY_OPTIONS.map(({ label, value: slug }) => (
          <label
            key={slug}
            htmlFor={slug}
            className="flex items-center space-x-2 cursor-pointer select-none"
          >
            <Checkbox
                id={slug}
                checked={value.includes(slug)}
                onChange={() => toggleCategory(slug)}
                />

            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
  )
}
