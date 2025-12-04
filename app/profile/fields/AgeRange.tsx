// app/profile/fields/agerange.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type AgeRangeProps = {
  /** Selected age range (slug) */
  value?: string
  /** Callback to update selection */
  onChange: (value: string) => void
}

/**
 * Age ranges mapped to Supabase-friendly slugs.
 * Aligns with `profiles.age_range` (text).
 */
const AGE_OPTIONS = [
  { label: "18–24", value: "18_24" },
  { label: "25–34", value: "25_34" },
  { label: "35–44", value: "35_44" },
  { label: "45–54", value: "45_54" },
  { label: "55+", value: "55_plus" },
]

export default function AgeRange({ value = "", onChange }: AgeRangeProps) {
  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">Age Range</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="space-y-2"
      >
        {AGE_OPTIONS.map(({ label, value: slug }) => (
          <div key={slug} className="flex items-center space-x-2">
            <RadioGroupItem id={slug} value={slug} />
            <Label htmlFor={slug}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}
