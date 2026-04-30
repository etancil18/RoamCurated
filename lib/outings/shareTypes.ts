// lib/outings/shareTypes.ts

export type OutingShareStop = {
  id: string
  title: string | null
  role: string
  displayType: string | null
  stopOrder: number
}

export type OutingSharePayload = {
  plannedOutingId: string
  eventId: string
  city: string | null
  mode: "before" | "after" | "full"
  summary: string | null
  eventTitle: string | null
  eventStartsAt: string | null
  stopCount: number
  stops: OutingShareStop[]
}