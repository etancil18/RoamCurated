// app/profile/fields/daysout.tsx
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

type DaysOutProps = {
  /** Selected days (slug list) */
  value: string[]
  /** Handler for toggling days */
  onChange: (value: string[]) => void
}

/**
 * Weekday options using lowercase slugs for DB storage.
 */
const DAY_OPTIONS = [
  { label: "Sunday", value: "sunday" },
  { label: "Monday", value: "monday" },
  { label: "Tuesday", value: "tuesday" },
  { label: "Wednesday", value: "wednesday" },
  { label: "Thursday", value: "thursday" },
  { label: "Friday", value: "friday" },
  { label: "Saturday", value: "saturday" },
]

export default function DaysOut({ value, onChange }: DaysOutProps) {
  const toggleDay = React.useCallback(
    (day: string) => {
      if (value.includes(day)) {
        onChange(value.filter((d) => d !== day))
      } else {
        onChange([...value, day])
      }
    },
    [value, onChange]
  )

  return (
    <section className="space-y-2">
      <Label className="text-base font-medium">Days You Typically Go Out</Label>
      <div className="grid grid-cols-2 gap-2">
        {DAY_OPTIONS.map(({ label, value: slug }) => (
          <label
            key={slug}
            htmlFor={slug}
            className="flex items-center space-x-2 cursor-pointer select-none"
          >
            <Checkbox
                id={slug}
                checked={value.includes(slug)}
                onChange={() => toggleDay(slug)}
                />

            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
  )
}
