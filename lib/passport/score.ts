export type PassportStats = {
  hostedCrawls: number
  joinedCrawls: number
  pastCrawls: number
  savedProperties: number
  completedFlows: number
  completedFlowStops: number
  hostedFlowStops: number
  completedHostedFlows: number
  venueVisits: number
  eventXp: number
  eventCheckins?: number
}

export function calculatePassportXp(stats: PassportStats): number {
  return (
    stats.eventXp +
    stats.hostedCrawls * 75 +
    stats.joinedCrawls * 25 +
    stats.pastCrawls * 100 +
    stats.savedProperties * 10 +
    stats.completedFlows * 100 +
    stats.completedFlowStops * 25 +
    stats.hostedFlowStops * 25 +
    stats.completedHostedFlows * 100 +
    stats.venueVisits * 10
  )
}

export function calculatePassportLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / 250) + 1)
}

export function calculateProgressToNextLevel(xp: number): number {
  return xp % 250
}

export function calculateProgressPercent(xp: number): number {
  return (calculateProgressToNextLevel(xp) / 250) * 100
}

export function getPassportSnapshot(stats: PassportStats) {
  const xp = calculatePassportXp(stats)
  const level = calculatePassportLevel(xp)
  const progressToNextLevel = calculateProgressToNextLevel(xp)
  const progressPercent = calculateProgressPercent(xp)

  return {
    xp,
    level,
    progressToNextLevel,
    progressPercent,
  }
}