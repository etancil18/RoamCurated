
export type VibePresetId =
  | "romantic"
  | "social"
  | "cozy"
  | "casual"
  | "upscale"
  | "high_energy"
  | "creative"
  | "chill"

export type PublicVibePresetOption = {
  id: VibePresetId
  label: string
  description: string
}

export const PUBLIC_VIBE_PRESET_OPTIONS: PublicVibePresetOption[] = [
  {
    id: "romantic",
    label: "Romantic",
    description: "Intimate, polished, date-night energy",
  },
  {
    id: "social",
    label: "Social",
    description: "Lively, group-friendly, easy to keep going",
  },
  {
    id: "cozy",
    label: "Cozy",
    description: "Warm, low-pressure, intimate without being formal",
  },
  {
    id: "casual",
    label: "Casual",
    description: "Easygoing, unfussy, flexible",
  },
  {
    id: "upscale",
    label: "Upscale",
    description: "Elevated, polished, splurge-friendly",
  },
  {
    id: "high_energy",
    label: "High Energy",
    description: "Buzzy, nightlife-forward, momentum-heavy",
  },
  {
    id: "creative",
    label: "Creative",
    description: "Artful, design-forward, culturally textured",
  },
  {
    id: "chill",
    label: "Chill",
    description: "Relaxed, low-stimulation, easy flow",
  },
]

export function getVibePresetOptions(): PublicVibePresetOption[] {
  return PUBLIC_VIBE_PRESET_OPTIONS
}
