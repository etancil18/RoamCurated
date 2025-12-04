// types/profile.ts

export type UserPreferences = {
  // Core personalization anchors
  preferredVibes: string[]               // e.g., ["chill", "romantic"]
  interests: string[]                    // e.g., ["music", "food"]
  frequency: string                      // e.g., "Weekly"
  
  // Demographics & persona
  ageRange?: string                      // e.g., "25–34"
  personality?: string                   // e.g., "Curious Explorer"
  socialComfort?: string                 // e.g., "Introvert"
  
  // Crawl behavior intent
  crawlType?: string                     // e.g., "Solo Exploration"
  intentLevel?: string                   // e.g., "Just browsing"
  daysOut?: string[]                     // e.g., ["Friday", "Saturday"]
  
  // Geographic anchor
  homeNeighborhood?: string              // freeform user base area
}

// Supabase profile record (can be extended in future)
export type UserProfile = {
  id: string
  preferences: UserPreferences
  updated_at?: string
}
