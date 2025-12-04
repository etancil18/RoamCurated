"use client"

import * as React from "react"

interface RadioGroupProps<T extends string | number> {
  value: T | null
  onValueChange: (value: T) => void
  name?: string
  className?: string
  children: React.ReactNode
}

interface RadioGroupItemProps<T extends string | number> {
  value: T
  id?: string
  className?: string
  disabled?: boolean
  label?: React.ReactNode
}

/** Shared context for radio items */
const RadioGroupContext = React.createContext<{
  name: string
  selectedValue: string | number | null
  onChange: (val: string | number) => void
} | null>(null)

function RadioGroup<T extends string | number>({
  value,
  onValueChange,
  name,
  className = "",
  children,
}: RadioGroupProps<T>) {
  const generatedName = React.useId()
  const groupName = name ?? `radio-${generatedName}`

  return (
    <RadioGroupContext.Provider
      value={{
        name: groupName,
        selectedValue: value,
        onChange: (val) => onValueChange(val as T),
      }}
    >
      <div className={className} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  RadioGroupItemProps<string | number>
>(({ value, id, className = "", disabled = false, label }, ref) => {
  const ctx = React.useContext(RadioGroupContext)
  if (!ctx) {
    throw new Error("RadioGroupItem must be used within a RadioGroup")
  }

  const { name, selectedValue, onChange } = ctx
  const itemId = id ?? `${name}-${value}`
  const checked = selectedValue === value

  return (
    <div
      className={`inline-flex items-center space-x-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <input
        ref={ref}
        id={itemId}
        type="radio"
        role="radio"
        name={name}
        value={String(value)}
        checked={checked}
        aria-checked={checked}
        aria-disabled={disabled}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="form-radio h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
      />
      {label && (
        <label htmlFor={itemId} className="select-none">
          {label}
        </label>
      )}
    </div>
  )
})

RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
