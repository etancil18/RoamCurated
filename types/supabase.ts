// -----------------------
// Base JSON type
// -----------------------
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// -----------------------
// Supabase Generated Types
// -----------------------
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }

  public: {
    Tables: {
      events: {
  Row: {
    id: string
    venue_id: string
    title: string | null
    description: string | null
    tags: string[] | null
    price_info: string | null
    permalink: string | null
    source: string | null
    source_type: string | null
    raw_payload: Json | null
    starts_at: string | null
    ends_at: string | null
    timezone: string | null
    is_active: boolean | null
    created_at: string | null
    updated_at: string | null
  }
  Insert: {
    id?: string
    venue_id: string
    title?: string | null
    description?: string | null
    tags?: string[] | null
    price_info?: string | null
    permalink?: string | null
    source?: string | null
    source_type?: string | null
    raw_payload?: Json | null
    starts_at?: string | null
    ends_at?: string | null
    timezone?: string | null
    is_active?: boolean | null
    created_at?: string | null
    updated_at?: string | null
  }
  Update: {
    id?: string
    venue_id?: string
    title?: string | null
    description?: string | null
    tags?: string[] | null
    price_info?: string | null
    permalink?: string | null
    source?: string | null
    source_type?: string | null
    raw_payload?: Json | null
    starts_at?: string | null
    ends_at?: string | null
    timezone?: string | null
    is_active?: boolean | null
    created_at?: string | null
    updated_at?: string | null
  }
  Relationships: [
    {
      foreignKeyName: "events_venue_id_fkey"
      columns: ["venue_id"]
      isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
  ]
}


      favorites: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          created_at: string | null
          data: Json | null
          city: string | null
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          created_at?: string | null
          data?: Json | null
          city?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          created_at?: string | null
          data?: Json | null
          city?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
            isOneToOne: false
          },
          {
            foreignKeyName: "favorites_venue_id_fkey"
            columns: ["venue_id"]
            referencedRelation: "venues"
            referencedColumns: ["id"]
            isOneToOne: false
          }
        ]
      }

      saved_routes: {
        Row: {
          id: string
          user_id: string | null
          name: string
          stops: Json
          city: string | null
          created_at: string
          source_url: string | null
          slug: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          stops: Json
          city?: string | null
          created_at?: string
          source_url?: string | null
          slug?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          stops?: Json
          city?: string | null
          created_at?: string
          source_url?: string | null
          slug?: string | null
        }
        Relationships: []
      }

      user_routes: {
        Row: {
          id: string
          user_id: string | null
          name: string | null
          route_data: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name?: string | null
          route_data?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string | null
          route_data?: Json | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_routes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
            isOneToOne: false
          }
        ]
      }

      users: {
        Row: {
          id: string
          email: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          created_at?: string | null
        }
        Relationships: []
      }

      venues: {
        Row: {
          id: string
          name: string | null
          lat: number | null
          lon: number | null
          instagram_handle: string | null
          access_token: string | null
          tags: string[] | null
          tier: string | null
          type: string | null
          time_category: string | null
          energy_ramp: number | null
          price: string | null
          duration: number | null
          cover: string | null
          city: string | null
          slug: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          lat?: number | null
          lon?: number | null
          instagram_handle?: string | null
          access_token?: string | null
          tags?: string[] | null
          tier?: string | null
          type?: string | null
          time_category?: string | null
          energy_ramp?: number | null
          price?: string | null
          duration?: number | null
          cover?: string | null
          city?: string | null
          slug?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          lat?: number | null
          lon?: number | null
          instagram_handle?: string | null
          access_token?: string | null
          tags?: string[] | null
          tier?: string | null
          type?: string | null
          time_category?: string | null
          energy_ramp?: number | null
          price?: string | null
          duration?: number | null
          cover?: string | null
          city?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }

    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

// -----------------------
// Convenience Types (restored)
// -----------------------
export type EventRecord = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

export type VenueRecord = Database['public']['Tables']['venues']['Row']
export type FavoriteRecord = Database['public']['Tables']['favorites']['Row']
export type FavoriteInsert = Database['public']['Tables']['favorites']['Insert']
export type FavoriteUpdate = Database['public']['Tables']['favorites']['Update']

export type SavedRouteRecord = Database['public']['Tables']['saved_routes']['Row']
export type SavedRouteInsert = Database['public']['Tables']['saved_routes']['Insert']
export type SavedRouteUpdate = Database['public']['Tables']['saved_routes']['Update']

export type UserRouteRecord = Database['public']['Tables']['user_routes']['Row']
export type UserRecord = Database['public']['Tables']['users']['Row']
