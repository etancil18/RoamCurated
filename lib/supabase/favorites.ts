// lib/supabase/favorites.ts

import { createServerClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { z } from "zod"

// ----------------------------------------
// UUID branding
// ----------------------------------------
type UUID = string & { __uuidBrand: never }

// ----------------------------------------
// Input Types
// ----------------------------------------
export type AddFavoriteParams = {
  userId: UUID
  venueId: UUID
  venueData: {
    name: string
    lat: number
    lon: number
    instagram_handle?: string | null
    type?: string
    image_url?: string | null
    vibe_tags?: string[]
    price_tier?: number
  }
  city?: string | null
}

export type RemoveFavoriteParams = {
  userId: UUID
  venueId: UUID
}

// ----------------------------------------
// Zod Schema for favorite snapshot (favorites.data)
// ----------------------------------------
const favoriteDataSchema = z.object({
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  instagram_handle: z.string().nullable().optional(),
  type: z.string().optional(),
  image_url: z.string().nullable().optional(),
  vibe_tags: z.array(z.string()).optional(),
  price_tier: z.number().optional(),
})

// ----------------------------------------
// Authenticated Supabase client helper
// ----------------------------------------
async function getClientAndUserId(): Promise<{
  supabase: SupabaseClient<Database>
  userId: UUID
}> {
  const supabase = await createServerClient() as SupabaseClient<Database>
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw new Error(`Auth error: ${error.message}`)
  if (!user) throw new Error("User not authenticated")

  return { supabase, userId: user.id as UUID }
}

// ----------------------------------------
// Add or Update Favorite
// ----------------------------------------
export async function addVenueToFavorites({
  userId,
  venueId,
  venueData,
  city,
}: AddFavoriteParams): Promise<
  Database["public"]["Tables"]["favorites"]["Row"][]
> {
  const supabase = await createServerClient() as SupabaseClient<Database>

  const parsed = favoriteDataSchema.safeParse(venueData)
  if (!parsed.success) {
    console.error("❌ FavoriteData validation failed:", parsed.error.format())
    throw new Error("Invalid venue data format")
  }

  const payload: Database["public"]["Tables"]["favorites"]["Insert"] = {
    user_id: userId,
    venue_id: venueId,
    data: parsed.data,
    city: city ?? null,
  }

  const { data, error } = await supabase
    .from("favorites")
    .upsert([payload], { onConflict: "user_id,venue_id" })
    .select()

  if (error) {
    console.error("[addVenueToFavorites] Error:", error)
    throw new Error(`Failed to add favorite: ${error.message}`)
  }

  return data ?? []
}

// ----------------------------------------
// Remove Favorite
// ----------------------------------------
export async function removeFavorite({
  userId,
  venueId,
}: RemoveFavoriteParams): Promise<boolean> {
  const supabase = await createServerClient() as SupabaseClient<Database>

  const { error } = await supabase
    .from("favorites")
    .delete()
    .match({ user_id: userId, venue_id: venueId })

  if (error) throw new Error(`Failed to remove favorite: ${error.message}`)
  return true
}

// ----------------------------------------
// Get Favorites (snake_case preserved)
// ----------------------------------------
export async function getFavorites(): Promise<
  Database["public"]["Tables"]["favorites"]["Row"][]
> {
  const { supabase, userId } = await getClientAndUserId()

  const { data, error } = await supabase
    .from("favorites")
    .select()
    .eq("user_id", userId as string)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[getFavorites] Error:", error)
    throw new Error(`Failed to fetch favorites: ${error.message}`)
  }

  return data ?? []
}
