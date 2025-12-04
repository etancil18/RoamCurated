// app/profile/fields/personalitystyle.tsx
"use client"

import * as React from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

type PersonalityStyleProps = {
  /** The selected personality style slug */
  value: string
  /** Callback to update the selected value */
  onChange: (value: string) => void
}

/**
 * These options are personality archetypes.
 * - `label`: Displayed in UI
 * - `value`: Stored in Supabase (snake_case)
 */
const PERSONALITY_OPTIONS = [
  { label: "The Planner", value: "planner" },
  { label: "The Explorer", value: "explorer" },
  { label: "The Vibes Person", value: "vibes" },
  { label: "The Connector", value: "connector" },
  { label: "Low-Key", value: "low_key" },
]

export default function PersonalityStyle({
  value,
  onChange,
}: PersonalityStyleProps) {
  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">What’s Your Social Personality?</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="space-y-2"
      >
        {PERSONALITY_OPTIONS.map(({ label, value: slug }) => (
          <div key={slug} className="flex items-center space-x-2">
            <RadioGroupItem id={slug} value={slug} />
            <Label htmlFor={slug}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}
