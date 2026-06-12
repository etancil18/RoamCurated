export type SocialGroupRole = 'owner' | 'admin' | 'member'

export type SocialGroup = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export type SocialGroupMember = {
  id: string
  group_id: string
  user_id: string
  role: SocialGroupRole
  created_at: string
}

export type EventCheckin = {
  id: string
  event_id: string
  user_id: string
  social_group_id: string | null
  checked_in_at: string
  source: string
}

export type EventXpLedgerEntry = {
  id: string
  user_id: string
  event_id: string
  social_group_id: string | null
  xp_amount: number
  reason: string
  created_at: string
}

export type SocialGroupMetrics = {
  groupId: string
  totalEvents: number
  totalCheckins: number
  uniqueAttendees: number
  repeatAttendees: number
  totalXpAwarded: number
}

export type SocialGroupEventMetric = {
  eventId: string
  title: string | null
  startsAt: string | null
  checkins: number
  uniqueAttendees: number
  xpAwarded: number
}

export type SocialGroupAttendeeInsight = {
  userId: string
  checkins: number
  xpEarned: number
  firstCheckinAt: string | null
  lastCheckinAt: string | null
}