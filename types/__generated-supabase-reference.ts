export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      crawl_events: {
        Row: {
          city: string | null
          created_at: string | null
          creator_id: string
          datetime: string | null
          description: string | null
          id: string
          is_public: boolean
          is_sponsored: boolean | null
          max_capacity: number | null
          rsvp_enabled: boolean | null
          slug: string | null
          sponsor_name: string | null
          title: string
          updated_at: string | null
          venue_ids: string[]
          vibe_tags: string[] | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          creator_id: string
          datetime?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          is_sponsored?: boolean | null
          max_capacity?: number | null
          rsvp_enabled?: boolean | null
          slug?: string | null
          sponsor_name?: string | null
          title: string
          updated_at?: string | null
          venue_ids: string[]
          vibe_tags?: string[] | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          creator_id?: string
          datetime?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          is_sponsored?: boolean | null
          max_capacity?: number | null
          rsvp_enabled?: boolean | null
          slug?: string | null
          sponsor_name?: string | null
          title?: string
          updated_at?: string | null
          venue_ids?: string[]
          vibe_tags?: string[] | null
        }
        Relationships: []
      }
      crawl_messages: {
        Row: {
          crawl_id: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          crawl_id: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          crawl_id?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_messages_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_progress: {
        Row: {
          completed_at: string | null
          crawl_id: string | null
          id: string
          stop_index: number
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          crawl_id?: string | null
          id?: string
          stop_index: number
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          crawl_id?: string | null
          id?: string
          stop_index?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_progress_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_rsvps: {
        Row: {
          checked_in_at: string | null
          crawl_id: string
          id: string
          instagram_handle: string | null
          joined_at: string | null
          note: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          crawl_id: string
          id?: string
          instagram_handle?: string | null
          joined_at?: string | null
          note?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          crawl_id?: string
          id?: string
          instagram_handle?: string | null
          joined_at?: string | null
          note?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_rsvps_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_interests: {
        Row: {
          city: string | null
          event_id: string | null
          id: string
          interested_at: string | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          city?: string | null
          event_id?: string | null
          id?: string
          interested_at?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          city?: string | null
          event_id?: string | null
          id?: string
          interested_at?: string | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_interests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "event_interests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_journey_stops: {
        Row: {
          created_at: string | null
          event_journey_id: string
          id: string
          is_locked: boolean
          role: string
          stop_order: number
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          event_journey_id: string
          id?: string
          is_locked?: boolean
          role: string
          stop_order: number
          venue_id: string
        }
        Update: {
          created_at?: string | null
          event_journey_id?: string
          id?: string
          is_locked?: boolean
          role?: string
          stop_order?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_journey_stops_event_journey_id_fkey"
            columns: ["event_journey_id"]
            isOneToOne: false
            referencedRelation: "event_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_journey_stops_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "event_journey_stops_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_journeys: {
        Row: {
          city: string
          created_at: string | null
          destination_lat: number
          destination_lon: number
          destination_name: string
          destination_venue_id: string | null
          event_id: string | null
          event_name: string
          event_start_at: string
          id: string
          ideal_stop_duration_minutes: number
          max_dynamic_stops: number
          notes: string | null
          property_id: string | null
          range_expansion_pct: number
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
          vibes: string[] | null
        }
        Insert: {
          city: string
          created_at?: string | null
          destination_lat: number
          destination_lon: number
          destination_name: string
          destination_venue_id?: string | null
          event_id?: string | null
          event_name: string
          event_start_at: string
          id?: string
          ideal_stop_duration_minutes?: number
          max_dynamic_stops?: number
          notes?: string | null
          property_id?: string | null
          range_expansion_pct?: number
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          vibes?: string[] | null
        }
        Update: {
          city?: string
          created_at?: string | null
          destination_lat?: number
          destination_lon?: number
          destination_name?: string
          destination_venue_id?: string | null
          event_id?: string | null
          event_name?: string
          event_start_at?: string
          id?: string
          ideal_stop_duration_minutes?: number
          max_dynamic_stops?: number
          notes?: string | null
          property_id?: string | null
          range_expansion_pct?: number
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vibes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "event_journeys_destination_venue_id_fkey"
            columns: ["destination_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "event_journeys_destination_venue_id_fkey"
            columns: ["destination_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_journeys_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_journeys_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          permalink: string | null
          price_info: string | null
          raw_payload: Json | null
          source: string | null
          source_type: string | null
          starts_at: string | null
          tags: string[] | null
          ticket_link: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          permalink?: string | null
          price_info?: string | null
          raw_payload?: Json | null
          source?: string | null
          source_type?: string | null
          starts_at?: string | null
          tags?: string[] | null
          ticket_link?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          permalink?: string | null
          price_info?: string | null
          raw_payload?: Json | null
          source?: string | null
          source_type?: string | null
          starts_at?: string | null
          tags?: string[] | null
          ticket_link?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          city: string | null
          created_at: string | null
          data: Json | null
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_range: string | null
          crawl_type: string | null
          created_at: string | null
          days_out: string[] | null
          deleted_at: string | null
          frequency: string | null
          full_name: string | null
          home_neighborhood: string | null
          id: string
          instagram_handle: string | null
          intent_level: string | null
          interest_categories: string[] | null
          personality_style: string | null
          preferred_vibes: string[] | null
          social_comfort: string | null
          updated_at: string | null
        }
        Insert: {
          age_range?: string | null
          crawl_type?: string | null
          created_at?: string | null
          days_out?: string[] | null
          deleted_at?: string | null
          frequency?: string | null
          full_name?: string | null
          home_neighborhood?: string | null
          id: string
          instagram_handle?: string | null
          intent_level?: string | null
          interest_categories?: string[] | null
          personality_style?: string | null
          preferred_vibes?: string[] | null
          social_comfort?: string | null
          updated_at?: string | null
        }
        Update: {
          age_range?: string | null
          crawl_type?: string | null
          created_at?: string | null
          days_out?: string[] | null
          deleted_at?: string | null
          frequency?: string | null
          full_name?: string | null
          home_neighborhood?: string | null
          id?: string
          instagram_handle?: string | null
          intent_level?: string | null
          interest_categories?: string[] | null
          personality_style?: string | null
          preferred_vibes?: string[] | null
          social_comfort?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          approved: boolean | null
          city: string
          created_at: string | null
          featured: boolean | null
          host_name: string | null
          host_type: string | null
          id: string
          lat: number
          lon: number
          name: string
          slug: string
          website: string | null
          welcome_description: string | null
        }
        Insert: {
          address?: string | null
          approved?: boolean | null
          city: string
          created_at?: string | null
          featured?: boolean | null
          host_name?: string | null
          host_type?: string | null
          id?: string
          lat: number
          lon: number
          name: string
          slug: string
          website?: string | null
          welcome_description?: string | null
        }
        Update: {
          address?: string | null
          approved?: boolean | null
          city?: string
          created_at?: string | null
          featured?: boolean | null
          host_name?: string | null
          host_type?: string | null
          id?: string
          lat?: number
          lon?: number
          name?: string
          slug?: string
          website?: string | null
          welcome_description?: string | null
        }
        Relationships: []
      }
      property_favorites: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          label: string | null
          priority: number | null
          property_id: string
          venue_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string | null
          priority?: number | null
          property_id: string
          venue_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string | null
          priority?: number | null
          property_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "property_favorites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_events: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string | null
          ends_on: string | null
          id: string
          price_info: string | null
          recurrence_rule: string
          start_time: string
          starts_on: string
          tags: string[] | null
          title: string
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          ends_on?: string | null
          id?: string
          price_info?: string | null
          recurrence_rule: string
          start_time: string
          starts_on: string
          tags?: string[] | null
          title: string
          venue_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          ends_on?: string | null
          id?: string
          price_info?: string | null
          recurrence_rule?: string
          start_time?: string
          starts_on?: string
          tags?: string[] | null
          title?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "recurring_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      route_failures: {
        Row: {
          attempted_at: string | null
          city: string
          created_at: string | null
          error: string | null
          filter_params: Json | null
          id: string
          source: string | null
          theme: string | null
          user_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          city: string
          created_at?: string | null
          error?: string | null
          filter_params?: Json | null
          id?: string
          source?: string | null
          theme?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          city?: string
          created_at?: string | null
          error?: string | null
          filter_params?: Json | null
          id?: string
          source?: string | null
          theme?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      route_requests: {
        Row: {
          crawl_theme: string | null
          created_at: string | null
          destination: unknown
          id: string
          origin: unknown
          route_distance_meters: number | null
          route_duration_seconds: number | null
          route_geometry: unknown
          route_metadata: Json | null
          user_id: string | null
          waypoints: Json | null
        }
        Insert: {
          crawl_theme?: string | null
          created_at?: string | null
          destination?: unknown
          id?: string
          origin?: unknown
          route_distance_meters?: number | null
          route_duration_seconds?: number | null
          route_geometry?: unknown
          route_metadata?: Json | null
          user_id?: string | null
          waypoints?: Json | null
        }
        Update: {
          crawl_theme?: string | null
          created_at?: string | null
          destination?: unknown
          id?: string
          origin?: unknown
          route_distance_meters?: number | null
          route_duration_seconds?: number | null
          route_geometry?: unknown
          route_metadata?: Json | null
          user_id?: string | null
          waypoints?: Json | null
        }
        Relationships: []
      }
      saved_properties: {
        Row: {
          city: string
          created_at: string | null
          id: string
          property_id: string
          slug: string
          user_id: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: string
          property_id: string
          slug: string
          user_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          property_id?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      saved_routes: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          slug: string | null
          source_url: string | null
          stops: Json
          user_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          source_url?: string | null
          stops: Json
          user_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          source_url?: string | null
          stops?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      scheduled_routes: {
        Row: {
          crawl_id: string | null
          created_at: string
          id: string
          name: string | null
          planned_start_at: string
          route_data: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          crawl_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          planned_start_at: string
          route_data?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          crawl_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          planned_start_at?: string
          route_data?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_routes_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      user_impressions: {
        Row: {
          crawl_id: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          impression_type: string
          metadata: Json | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          crawl_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          impression_type: string
          metadata?: Json | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          crawl_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          impression_type?: string
          metadata?: Json | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_impressions_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_impressions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "user_impressions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_routes: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          route_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          route_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          route_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_routes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          email: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          subscription_tier: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          email?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          email?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string
        }
        Relationships: []
      }
      venue_claim_requests: {
        Row: {
          created_at: string | null
          email: string
          event_submission: string
          id: string
          instagram_handle: string | null
          status: string | null
          venue_name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          event_submission: string
          id?: string
          instagram_handle?: string | null
          status?: string | null
          venue_name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          event_submission?: string
          id?: string
          instagram_handle?: string | null
          status?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      venue_followers: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_followers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_followers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_impressions: {
        Row: {
          crawl_id: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          impression_type: string
          metadata: Json | null
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          crawl_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          impression_type: string
          metadata?: Json | null
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          crawl_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          impression_type?: string
          metadata?: Json | null
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_impressions_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_impressions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_impressions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_live_status: {
        Row: {
          id: string
          is_open_for_dropins: boolean | null
          message: string | null
          status_tags: string[] | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          id?: string
          is_open_for_dropins?: boolean | null
          message?: string | null
          status_tags?: string[] | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          id?: string
          is_open_for_dropins?: boolean | null
          message?: string | null
          status_tags?: string[] | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_live_status_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_live_status_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_messages: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          message: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          message: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          message?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_messages_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_messages_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          role: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          role?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          role?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_users_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_users_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          access_token: string | null
          address: string | null
          city: string | null
          contact: string[] | null
          cover: string | null
          description: string | null
          duration: number | null
          energy_ramp: number | null
          hours: Json | null
          id: string
          instagram_handle: string | null
          lat: number | null
          lon: number | null
          name: string | null
          price: string | null
          slug: string | null
          tags: string[] | null
          tier: string | null
          time_category: string | null
          type: string | null
        }
        Insert: {
          access_token?: string | null
          address?: string | null
          city?: string | null
          contact?: string[] | null
          cover?: string | null
          description?: string | null
          duration?: number | null
          energy_ramp?: number | null
          hours?: Json | null
          id?: string
          instagram_handle?: string | null
          lat?: number | null
          lon?: number | null
          name?: string | null
          price?: string | null
          slug?: string | null
          tags?: string[] | null
          tier?: string | null
          time_category?: string | null
          type?: string | null
        }
        Update: {
          access_token?: string | null
          address?: string | null
          city?: string | null
          contact?: string[] | null
          cover?: string | null
          description?: string | null
          duration?: number | null
          energy_ramp?: number | null
          hours?: Json | null
          id?: string
          instagram_handle?: string | null
          lat?: number | null
          lon?: number | null
          name?: string | null
          price?: string | null
          slug?: string | null
          tags?: string[] | null
          tier?: string | null
          time_category?: string | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      venue_rsvps_view: {
        Row: {
          checked_in_at: string | null
          crawl_id: string | null
          crawl_name: string | null
          crawl_rsvp_id: string | null
          datetime: string | null
          instagram_handle: string | null
          joined_at: string | null
          note: string | null
          profile_name: string | null
          status: string | null
          user_id: string | null
          venue_id: string | null
          vibe_tags: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_rsvps_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "crawl_events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      anonymize_profile: { Args: { target_user: string }; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      earth: { Args: never; Returns: number }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_crawl_with_attendees: {
        Args: { input_crawl_id: string }
        Returns: {
          city: string
          crawl_id: string
          datetime: string
          description: string
          full_name: string
          instagram_handle: string
          is_sponsored: boolean
          joined_at: string
          max_capacity: number
          note: string
          personality_style: string
          rsvp_user_id: string
          sponsor_name: string
          title: string
          venue_ids: string[]
          vibe_tags: string[]
        }[]
      }
      get_nearby_crawls: {
        Args: {
          property_lat: number
          property_lon: number
          radius_meters?: number
        }
        Returns: {
          city: string
          datetime: string
          id: string
          slug: string
          title: string
        }[]
      }
      get_nearby_events: {
        Args: {
          property_lat: number
          property_lon: number
          radius_meters?: number
        }
        Returns: {
          description: string
          ends_at: string
          id: string
          starts_at: string
          title: string
          venue_id: string
          venue_lat: number
          venue_lon: number
          venue_name: string
          venue_slug: string
        }[]
      }
      get_nearby_venues: {
        Args: {
          property_lat: number
          property_lon: number
          radius_meters?: number
        }
        Returns: {
          access_token: string | null
          address: string | null
          city: string | null
          contact: string[] | null
          cover: string | null
          description: string | null
          duration: number | null
          energy_ramp: number | null
          hours: Json | null
          id: string
          instagram_handle: string | null
          lat: number | null
          lon: number | null
          name: string | null
          price: string | null
          slug: string | null
          tags: string[] | null
          tier: string | null
          time_category: string | null
          type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "venues"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      gettransactionid: { Args: never; Returns: unknown }
      join_crawl: { Args: { input_crawl_id: string }; Returns: undefined }
      leave_crawl: { Args: { crawl_id: string }; Returns: undefined }
      list_public_crawls: {
        Args: { city: string; end_date: string; start_date: string }
        Returns: {
          crawl_id: string
          creator_id: string
          datetime: string
          is_sponsored: boolean
          rsvp_count: number
          slug: string
          title: string
          vibe_tags: string[]
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
