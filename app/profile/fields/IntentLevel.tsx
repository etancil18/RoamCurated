// app/profile/fields/intentlevel.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type IntentLevelProps = {
  /** Selected intent level (snake_case slug) */
  value: string
  /** Callback to update intent level */
  onChange: (value: string) => void
}

/**
 * Planning preference categories for user intent.
 * Stored as slugs (snake_case) in `profiles.intent_level` in Supabase.
 */
const INTENT_LEVEL_OPTIONS = [
  { label: "Spontaneous — I go with the flow", value: "spontaneous" },
  { label: "Semi-Planned — I like a rough idea", value: "semi_planned" },
  { label: "Planned — I want a structured crawl", value: "planned" },
]

export default function IntentLevel({ value, onChange }: IntentLevelProps) {
  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">How Do You Usually Plan Your Nights Out?</Label>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="space-y-2"
      >
        {INTENT_LEVEL_OPTIONS.map(({ label, value: slug }) => (
          <div key={slug} className="flex items-center space-x-2">
            <RadioGroupItem value={slug} id={slug} />
            <Label htmlFor={slug}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}
