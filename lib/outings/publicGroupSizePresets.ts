
export type GroupSizePresetId =
  | "solo"
  | "duo"
  | "small_group"
  | "medium_group"
  | "big_group"

export type PublicGroupSizePresetOption = {
  id: GroupSizePresetId
  label: string
  description: string
  min: number
  max: number
  representativeSize: number
}

export const PUBLIC_GROUP_SIZE_PRESET_OPTIONS: PublicGroupSizePresetOption[] = [
  {
    id: "solo",
    label: "Solo",
    description: "Flexible, low-friction, easy to tuck into niche spots",
    min: 1,
    max: 1,
    representativeSize: 1,
  },
  {
    id: "duo",
    label: "2 People",
    description: "Conversation-friendly, date-friendly, intimate",
    min: 2,
    max: 2,
    representativeSize: 2,
  },
  {
    id: "small_group",
    label: "3–4",
    description: "Balanced and versatile without needing full group logistics",
    min: 3,
    max: 4,
    representativeSize: 4,
  },
  {
    id: "medium_group",
    label: "5–8",
    description: "Social and group-friendly, with easier logistics in bigger venues",
    min: 5,
    max: 8,
    representativeSize: 6,
  },
  {
    id: "big_group",
    label: "9+",
    description: "Best with easy logistics, spacious venues, and social momentum",
    min: 9,
    max: 20,
    representativeSize: 10,
  },
]

export function getGroupSizePresetOptions(): PublicGroupSizePresetOption[] {
  return PUBLIC_GROUP_SIZE_PRESET_OPTIONS
}
