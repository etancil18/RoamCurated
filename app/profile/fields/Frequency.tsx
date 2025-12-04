// app/profile/fields/frequency.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type FrequencyProps = {
  /** Current frequency value (slug) */
  value: string
  /** Callback to update selected frequency */
  onChange: (value: string) => void
}

/**
 * Frequency of going out — maps to `profiles.frequency` in Supabase.
 */
const FREQUENCY_OPTIONS = [
  { label: "Rarely (1–2x/month)", value: "rarely" },
  { label: "Occasionally (1x/week)", value: "occasionally" },
  { label: "Frequently (2–3x/week)", value: "frequently" },
  { label: "Very Frequently (4+ nights/week)", value: "very_frequently" },
]

export default function Frequency({ value, onChange }: FrequencyProps) {
  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">How Often Do You Go Out?</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="space-y-2"
      >
        {FREQUENCY_OPTIONS.map(({ label, value: slug }) => (
          <div key={slug} className="flex items-center space-x-2">
            <RadioGroupItem id={slug} value={slug} />
            <Label htmlFor={slug}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}
