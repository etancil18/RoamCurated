// app/profile/fields/preferredvibes.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

type PreferredVibesProps = {
  /** Array of currently selected vibe slugs */
  value: string[]
  /** Called with updated list whenever selection changes */
  onChange: (value: string[]) => void
}

/** 
 * Keep label for UI and lowercase slug for DB.
 * Slugs align with Supabase `profiles.preferred_vibes` (text[]).
 */
const VIBE_OPTIONS = [
  { label: "Chill", value: "chill" },
  { label: "Upbeat", value: "upbeat" },
  { label: "Romantic", value: "romantic" },
  { label: "Trendy", value: "trendy" },
  { label: "Underground", value: "underground" },
  { label: "Social", value: "social" },
  { label: "Cozy", value: "cozy" },
  { label: "High Energy", value: "high_energy" },
]

export default function PreferredVibes({ value, onChange }: PreferredVibesProps) {
  const toggleVibe = React.useCallback(
    (slug: string) => {
      if (value.includes(slug)) {
        onChange(value.filter((v) => v !== slug))
      } else {
        onChange([...value, slug])
      }
    },
    [value, onChange]
  )

  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">Preferred Vibes</Label>
      <div className="grid grid-cols-2 gap-2">
        {VIBE_OPTIONS.map(({ label, value: slug }) => {
          const checked = value.includes(slug)
          return (
            <label
              key={slug}
              htmlFor={slug}
              className="flex items-center space-x-2 cursor-pointer select-none"
            >
              <Checkbox
                id={slug}
                checked={value.includes(slug)}
                onChange={() => toggleVibe(slug)}
                />

              <span>{label}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
