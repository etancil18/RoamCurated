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
      active_flow_progress: {
        Row: {
          check_in_source: string
          checked_in_at: string
          created_at: string
          device_timestamp: string | null
          distance_meters: number | null
          geo_verified: boolean
          id: string
          location_accuracy_meters: number | null
          session_id: string
          stop_index: number
          user_id: string
          user_lat: number | null
          user_lon: number | null
          venue_id: string
        }
        Insert: {
          check_in_source?: string
          checked_in_at?: string
          created_at?: string
          device_timestamp?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          session_id: string
          stop_index: number
          user_id: string
          user_lat?: number | null
          user_lon?: number | null
          venue_id: string
        }
        Update: {
          check_in_source?: string
          checked_in_at?: string
          created_at?: string
          device_timestamp?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          session_id?: string
          stop_index?: number
          user_id?: string
          user_lat?: number | null
          user_lon?: number | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_flow_progress_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      active_flow_sessions: {
        Row: {
          city: string | null
          completed_at: string | null
          completed_stops: number
          created_at: string
          id: string
          metadata: Json
          source: string
          source_id: string | null
          started_at: string
          status: string
          theme_id: string | null
          title: string | null
          travel_mode: string | null
          updated_at: string
          user_id: string
          venue_ids: string[]
        }
        Insert: {
          city?: string | null
          completed_at?: string | null
          completed_stops?: number
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          source_id?: string | null
          started_at?: string
          status?: string
          theme_id?: string | null
          title?: string | null
          travel_mode?: string | null
          updated_at?: string
          user_id: string
          venue_ids?: string[]
        }
        Update: {
          city?: string | null
          completed_at?: string | null
          completed_stops?: number
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          source_id?: string | null
          started_at?: string
          status?: string
          theme_id?: string | null
          title?: string | null
          travel_mode?: string | null
          updated_at?: string
          user_id?: string
          venue_ids?: string[]
        }
        Relationships: []
      }
      collaboration_tags: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: number
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: number
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: number
          label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      crawl_events: {
        Row: {
          city: string | null
          completion_count: number | null
          created_at: string | null
          creator_id: string
          datetime: string | null
          description: string | null
          flow_score: number | null
          flow_type: string | null
          id: string
          is_public: boolean
          is_sponsored: boolean | null
          max_capacity: number | null
          public_id: string
          published_at: string | null
          repeat_count: number | null
          rsvp_enabled: boolean | null
          save_count: number | null
          share_count: number | null
          slug: string | null
          sponsor_name: string | null
          title: string
          updated_at: string | null
          venue_ids: string[]
          vibe_tags: string[] | null
        }
        Insert: {
          city?: string | null
          completion_count?: number | null
          created_at?: string | null
          creator_id: string
          datetime?: string | null
          description?: string | null
          flow_score?: number | null
          flow_type?: string | null
          id?: string
          is_public?: boolean
          is_sponsored?: boolean | null
          max_capacity?: number | null
          public_id: string
          published_at?: string | null
          repeat_count?: number | null
          rsvp_enabled?: boolean | null
          save_count?: number | null
          share_count?: number | null
          slug?: string | null
          sponsor_name?: string | null
          title: string
          updated_at?: string | null
          venue_ids: string[]
          vibe_tags?: string[] | null
        }
        Update: {
          city?: string | null
          completion_count?: number | null
          created_at?: string | null
          creator_id?: string
          datetime?: string | null
          description?: string | null
          flow_score?: number | null
          flow_type?: string | null
          id?: string
          is_public?: boolean
          is_sponsored?: boolean | null
          max_capacity?: number | null
          public_id?: string
          published_at?: string | null
          repeat_count?: number | null
          rsvp_enabled?: boolean | null
          save_count?: number | null
          share_count?: number | null
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
          check_in_source: string
          completed_at: string | null
          crawl_id: string | null
          device_timestamp: string | null
          distance_meters: number | null
          geo_verified: boolean
          id: string
          location_accuracy_meters: number | null
          stop_index: number
          user_id: string | null
          user_lat: number | null
          user_lon: number | null
        }
        Insert: {
          check_in_source?: string
          completed_at?: string | null
          crawl_id?: string | null
          device_timestamp?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          stop_index: number
          user_id?: string | null
          user_lat?: number | null
          user_lon?: number | null
        }
        Update: {
          check_in_source?: string
          completed_at?: string | null
          crawl_id?: string | null
          device_timestamp?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          stop_index?: number
          user_id?: string | null
          user_lat?: number | null
          user_lon?: number | null
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
      creator_collaboration_tags: {
        Row: {
          created_at: string
          tag_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          tag_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          tag_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_collaboration_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "collaboration_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_collaboration_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_collection_items: {
        Row: {
          collection_id: string
          created_at: string
          creator_note: string | null
          custom_title: string | null
          id: string
          image_url: string | null
          sort_order: number
          source_id: string
          source_type: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          creator_note?: string | null
          custom_title?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          source_id: string
          source_type: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          creator_note?: string | null
          custom_title?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "creator_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_collection_venues: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          sort_order: number
          venue_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          sort_order?: number
          venue_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_collection_venues_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "creator_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_collection_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "creator_collection_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_collections: {
        Row: {
          category: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          category?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          category?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_onboarding_answers: {
        Row: {
          answer_confirmed: boolean
          answer_confirmed_at: string | null
          answer_metadata: Json
          answer_text: string
          created_at: string
          creator_user_id: string
          extracted_at: string | null
          extracted_data: Json | null
          extraction_error: string | null
          extraction_model: string | null
          extraction_reviewed_at: string | null
          extraction_status: string
          extraction_version: number | null
          id: string
          is_public: boolean
          prompt_key: string
          prompt_text: string
          prompt_version: number
          updated_at: string
        }
        Insert: {
          answer_confirmed?: boolean
          answer_confirmed_at?: string | null
          answer_metadata?: Json
          answer_text: string
          created_at?: string
          creator_user_id: string
          extracted_at?: string | null
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_model?: string | null
          extraction_reviewed_at?: string | null
          extraction_status?: string
          extraction_version?: number | null
          id?: string
          is_public?: boolean
          prompt_key: string
          prompt_text: string
          prompt_version?: number
          updated_at?: string
        }
        Update: {
          answer_confirmed?: boolean
          answer_confirmed_at?: string | null
          answer_metadata?: Json
          answer_text?: string
          created_at?: string
          creator_user_id?: string
          extracted_at?: string | null
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_model?: string | null
          extraction_reviewed_at?: string | null
          extraction_status?: string
          extraction_version?: number | null
          id?: string
          is_public?: boolean
          prompt_key?: string
          prompt_text?: string
          prompt_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_onboarding_answers_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          accepting_collaborations: boolean
          available_for_travel: boolean
          created_at: string
          creator_bio: string | null
          primary_city: string | null
          public_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepting_collaborations?: boolean
          available_for_travel?: boolean
          created_at?: string
          creator_bio?: string | null
          primary_city?: string | null
          public_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepting_collaborations?: boolean
          available_for_travel?: boolean
          created_at?: string
          creator_bio?: string | null
          primary_city?: string | null
          public_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_reputation_category_stats: {
        Row: {
          average_eligible_score: number | null
          average_verified_venue_count: number | null
          calculated_at: string
          can_publish_percentile: boolean
          can_publish_rank: boolean
          can_publish_top_1_percent: boolean
          can_publish_top_10_percent: boolean
          can_publish_top_5_percent: boolean
          category_id: string
          city_key: string | null
          created_at: string
          earned_user_count: number
          eligible_user_count: number
          elite_user_count: number
          emerging_user_count: number
          established_user_count: number
          expert_user_count: number
          id: string
          maximum_eligible_score: number | null
          maximum_verified_venue_count: number | null
          median_eligible_score: number | null
          median_verified_venue_count: number | null
          minimum_eligible_score: number | null
          policy_version: number
          scope: string
          scope_city_key: string | null
          top_1_percent_score: number | null
          top_10_percent_score: number | null
          top_25_percent_score: number | null
          top_5_percent_score: number | null
          total_user_count: number
          unranked_user_count: number
          updated_at: string
        }
        Insert: {
          average_eligible_score?: number | null
          average_verified_venue_count?: number | null
          calculated_at?: string
          can_publish_percentile?: boolean
          can_publish_rank?: boolean
          can_publish_top_1_percent?: boolean
          can_publish_top_10_percent?: boolean
          can_publish_top_5_percent?: boolean
          category_id: string
          city_key?: string | null
          created_at?: string
          earned_user_count?: number
          eligible_user_count?: number
          elite_user_count?: number
          emerging_user_count?: number
          established_user_count?: number
          expert_user_count?: number
          id?: string
          maximum_eligible_score?: number | null
          maximum_verified_venue_count?: number | null
          median_eligible_score?: number | null
          median_verified_venue_count?: number | null
          minimum_eligible_score?: number | null
          policy_version?: number
          scope: string
          scope_city_key?: string | null
          top_1_percent_score?: number | null
          top_10_percent_score?: number | null
          top_25_percent_score?: number | null
          top_5_percent_score?: number | null
          total_user_count?: number
          unranked_user_count?: number
          updated_at?: string
        }
        Update: {
          average_eligible_score?: number | null
          average_verified_venue_count?: number | null
          calculated_at?: string
          can_publish_percentile?: boolean
          can_publish_rank?: boolean
          can_publish_top_1_percent?: boolean
          can_publish_top_10_percent?: boolean
          can_publish_top_5_percent?: boolean
          category_id?: string
          city_key?: string | null
          created_at?: string
          earned_user_count?: number
          eligible_user_count?: number
          elite_user_count?: number
          emerging_user_count?: number
          established_user_count?: number
          expert_user_count?: number
          id?: string
          maximum_eligible_score?: number | null
          maximum_verified_venue_count?: number | null
          median_eligible_score?: number | null
          median_verified_venue_count?: number | null
          minimum_eligible_score?: number | null
          policy_version?: number
          scope?: string
          scope_city_key?: string | null
          top_1_percent_score?: number | null
          top_10_percent_score?: number | null
          top_25_percent_score?: number | null
          top_5_percent_score?: number | null
          total_user_count?: number
          unranked_user_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_reputation_category_stats_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "reputation_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_reputation_stats: {
        Row: {
          calculated_at: string
          category_id: string
          city_count: number
          city_key: string | null
          completed_flow_count: number
          created_at: string
          curated_venue_count: number
          id: string
          latest_evidence_at: string | null
          policy_version: number
          public_collection_count: number
          public_snapshot_count: number
          quality_score: number
          recency_score: number
          reputation_level: string
          reputation_score: number
          scope: string
          scope_city_key: string | null
          updated_at: string
          user_id: string
          verified_venue_count: number
          weighted_venue_count: number
        }
        Insert: {
          calculated_at?: string
          category_id: string
          city_count?: number
          city_key?: string | null
          completed_flow_count?: number
          created_at?: string
          curated_venue_count?: number
          id?: string
          latest_evidence_at?: string | null
          policy_version?: number
          public_collection_count?: number
          public_snapshot_count?: number
          quality_score?: number
          recency_score?: number
          reputation_level?: string
          reputation_score?: number
          scope: string
          scope_city_key?: string | null
          updated_at?: string
          user_id: string
          verified_venue_count?: number
          weighted_venue_count?: number
        }
        Update: {
          calculated_at?: string
          category_id?: string
          city_count?: number
          city_key?: string | null
          completed_flow_count?: number
          created_at?: string
          curated_venue_count?: number
          id?: string
          latest_evidence_at?: string | null
          policy_version?: number
          public_collection_count?: number
          public_snapshot_count?: number
          quality_score?: number
          recency_score?: number
          reputation_level?: string
          reputation_score?: number
          scope?: string
          scope_city_key?: string | null
          updated_at?: string
          user_id?: string
          verified_venue_count?: number
          weighted_venue_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_reputation_stats_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "reputation_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_social_links: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          is_public: boolean
          platform: string
          sort_order: number
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          is_public?: boolean
          platform: string
          sort_order?: number
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          is_public?: boolean
          platform?: string
          sort_order?: number
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_social_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          check_in_source: string
          checked_in_at: string
          device_timestamp: string | null
          distance_meters: number | null
          event_id: string
          geo_verified: boolean
          id: string
          location_accuracy_meters: number | null
          social_group_id: string | null
          source: string
          user_id: string
          user_lat: number | null
          user_lon: number | null
        }
        Insert: {
          check_in_source?: string
          checked_in_at?: string
          device_timestamp?: string | null
          distance_meters?: number | null
          event_id: string
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          social_group_id?: string | null
          source?: string
          user_id: string
          user_lat?: number | null
          user_lon?: number | null
        }
        Update: {
          check_in_source?: string
          checked_in_at?: string
          device_timestamp?: string | null
          distance_meters?: number | null
          event_id?: string
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          social_group_id?: string | null
          source?: string
          user_id?: string
          user_lat?: number | null
          user_lon?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_social_group_id_fkey"
            columns: ["social_group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      event_discovery_runs: {
        Row: {
          ai_detection_json: Json | null
          checked_at: string | null
          content_hash: string | null
          created_at: string | null
          error_message: string | null
          event_signal_score: number | null
          id: string
          possible_event_count: number | null
          raw_html: string | null
          raw_text: string | null
          source_id: string
          source_url: string | null
          status: string | null
          venue_id: string
        }
        Insert: {
          ai_detection_json?: Json | null
          checked_at?: string | null
          content_hash?: string | null
          created_at?: string | null
          error_message?: string | null
          event_signal_score?: number | null
          id?: string
          possible_event_count?: number | null
          raw_html?: string | null
          raw_text?: string | null
          source_id: string
          source_url?: string | null
          status?: string | null
          venue_id: string
        }
        Update: {
          ai_detection_json?: Json | null
          checked_at?: string | null
          content_hash?: string | null
          created_at?: string | null
          error_message?: string | null
          event_signal_score?: number | null
          id?: string
          possible_event_count?: number | null
          raw_html?: string | null
          raw_text?: string | null
          source_id?: string
          source_url?: string | null
          status?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_discovery_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "venue_event_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_discovery_runs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "event_discovery_runs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_drafts: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          description: string | null
          discovery_run_id: string | null
          duplicate_score: number | null
          ends_at: string | null
          event_signal_score: number | null
          extracted_json: Json | null
          id: string
          missing_fields: string[] | null
          price_info: string | null
          raw_item_id: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          source_type: string | null
          source_url: string | null
          starts_at: string | null
          status: string | null
          tags: string[] | null
          ticket_link: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          discovery_run_id?: string | null
          duplicate_score?: number | null
          ends_at?: string | null
          event_signal_score?: number | null
          extracted_json?: Json | null
          id?: string
          missing_fields?: string[] | null
          price_info?: string | null
          raw_item_id?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          source_type?: string | null
          source_url?: string | null
          starts_at?: string | null
          status?: string | null
          tags?: string[] | null
          ticket_link?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          discovery_run_id?: string | null
          duplicate_score?: number | null
          ends_at?: string | null
          event_signal_score?: number | null
          extracted_json?: Json | null
          id?: string
          missing_fields?: string[] | null
          price_info?: string | null
          raw_item_id?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          source_type?: string | null
          source_url?: string | null
          starts_at?: string | null
          status?: string | null
          tags?: string[] | null
          ticket_link?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_drafts_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "event_discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_drafts_raw_item_id_fkey"
            columns: ["raw_item_id"]
            isOneToOne: false
            referencedRelation: "raw_ingestion_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_drafts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "event_drafts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
      event_journey_properties: {
        Row: {
          created_at: string | null
          event_journey_id: string
          id: string
          property_id: string
        }
        Insert: {
          created_at?: string | null
          event_journey_id: string
          id?: string
          property_id: string
        }
        Update: {
          created_at?: string | null
          event_journey_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_journey_properties_event_journey_id_fkey"
            columns: ["event_journey_id"]
            isOneToOne: false
            referencedRelation: "event_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_journey_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          arrival_policy:
            | Database["public"]["Enums"]["event_arrival_policy"]
            | null
          arrival_preference:
            | Database["public"]["Enums"]["event_arrival_preference"]
            | null
          city: string
          created_at: string | null
          destination_coordinates_source:
            | Database["public"]["Enums"]["event_destination_coordinates_source"]
            | null
          destination_kind:
            | Database["public"]["Enums"]["event_destination_kind"]
            | null
          destination_lat: number
          destination_lon: number
          destination_name: string
          destination_venue_id: string | null
          event_end_at: string | null
          event_id: string | null
          event_name: string
          event_start_at: string
          event_type: string | null
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
          arrival_policy?:
            | Database["public"]["Enums"]["event_arrival_policy"]
            | null
          arrival_preference?:
            | Database["public"]["Enums"]["event_arrival_preference"]
            | null
          city: string
          created_at?: string | null
          destination_coordinates_source?:
            | Database["public"]["Enums"]["event_destination_coordinates_source"]
            | null
          destination_kind?:
            | Database["public"]["Enums"]["event_destination_kind"]
            | null
          destination_lat: number
          destination_lon: number
          destination_name: string
          destination_venue_id?: string | null
          event_end_at?: string | null
          event_id?: string | null
          event_name: string
          event_start_at: string
          event_type?: string | null
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
          arrival_policy?:
            | Database["public"]["Enums"]["event_arrival_policy"]
            | null
          arrival_preference?:
            | Database["public"]["Enums"]["event_arrival_preference"]
            | null
          city?: string
          created_at?: string | null
          destination_coordinates_source?:
            | Database["public"]["Enums"]["event_destination_coordinates_source"]
            | null
          destination_kind?:
            | Database["public"]["Enums"]["event_destination_kind"]
            | null
          destination_lat?: number
          destination_lon?: number
          destination_name?: string
          destination_venue_id?: string | null
          event_end_at?: string | null
          event_id?: string | null
          event_name?: string
          event_start_at?: string
          event_type?: string | null
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
      event_xp_ledger: {
        Row: {
          created_at: string
          event_id: string
          id: string
          reason: string
          social_group_id: string | null
          user_id: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          reason?: string
          social_group_id?: string | null
          user_id: string
          xp_amount?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          reason?: string
          social_group_id?: string | null
          user_id?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_xp_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_xp_ledger_social_group_id_fkey"
            columns: ["social_group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archetype: string | null
          checkin_enabled: boolean
          created_at: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          permalink: string | null
          price_info: string | null
          raw_payload: Json | null
          social_group_id: string | null
          source: string | null
          source_type: string | null
          starts_at: string | null
          tags: string[] | null
          ticket_link: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          venue_id: string | null
          xp_reward: number
        }
        Insert: {
          archetype?: string | null
          checkin_enabled?: boolean
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          permalink?: string | null
          price_info?: string | null
          raw_payload?: Json | null
          social_group_id?: string | null
          source?: string | null
          source_type?: string | null
          starts_at?: string | null
          tags?: string[] | null
          ticket_link?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: string | null
          xp_reward?: number
        }
        Update: {
          archetype?: string | null
          checkin_enabled?: boolean
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          permalink?: string | null
          price_info?: string | null
          raw_payload?: Json | null
          social_group_id?: string | null
          source?: string | null
          source_type?: string | null
          starts_at?: string | null
          tags?: string[] | null
          ticket_link?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: string | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_social_group_id_fkey"
            columns: ["social_group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
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
      flow_snapshots: {
        Row: {
          checked_in_count: number
          city: string | null
          cover_image_url: string
          created_at: string
          id: string
          route_summary: string | null
          source_id: string
          source_type: string
          status: string | null
          title: string | null
          total_stops: number
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          checked_in_count?: number
          city?: string | null
          cover_image_url: string
          created_at?: string
          id?: string
          route_summary?: string | null
          source_id: string
          source_type: string
          status?: string | null
          title?: string | null
          total_stops?: number
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          checked_in_count?: number
          city?: string | null
          cover_image_url?: string
          created_at?: string
          id?: string
          route_summary?: string | null
          source_id?: string
          source_type?: string
          status?: string | null
          title?: string | null
          total_stops?: number
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      guide_brands: {
        Row: {
          accent_color: string | null
          background_color: string | null
          branding_mode: string
          button_text_color: string | null
          created_at: string
          custom_css: string | null
          favicon_url: string | null
          font_family: string | null
          id: string
          logo_url: string | null
          muted_text_color: string | null
          name: string
          powered_by_roam: boolean
          primary_color: string | null
          secondary_color: string | null
          slug: string
          surface_color: string | null
          text_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          branding_mode?: string
          button_text_color?: string | null
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          muted_text_color?: string | null
          name: string
          powered_by_roam?: boolean
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          surface_color?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          branding_mode?: string
          button_text_color?: string | null
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          logo_url?: string | null
          muted_text_color?: string | null
          name?: string
          powered_by_roam?: boolean
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          surface_color?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guide_featured_venues: {
        Row: {
          concierge_note: string | null
          created_at: string
          description: string | null
          guide_id: string
          id: string
          is_featured: boolean
          is_visible: boolean
          label: string | null
          position: number
          section_key: string
          updated_at: string
          venue_id: string
          visible_from: string | null
          visible_until: string | null
        }
        Insert: {
          concierge_note?: string | null
          created_at?: string
          description?: string | null
          guide_id: string
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          label?: string | null
          position?: number
          section_key: string
          updated_at?: string
          venue_id: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Update: {
          concierge_note?: string | null
          created_at?: string
          description?: string | null
          guide_id?: string
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          label?: string | null
          position?: number
          section_key?: string
          updated_at?: string
          venue_id?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_featured_venues_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "property_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_featured_venues_guide_section_fkey"
            columns: ["guide_id", "section_key"]
            isOneToOne: false
            referencedRelation: "property_guide_sections"
            referencedColumns: ["guide_id", "section_key"]
          },
          {
            foreignKeyName: "guide_featured_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "guide_featured_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_outing_events: {
        Row: {
          created_at: string
          event_type: string
          event_value: string | null
          id: string
          metadata: Json
          planned_outing_id: string
          planned_outing_stop_id: string | null
          stop_order: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          event_value?: string | null
          id?: string
          metadata?: Json
          planned_outing_id: string
          planned_outing_stop_id?: string | null
          stop_order?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          event_value?: string | null
          id?: string
          metadata?: Json
          planned_outing_id?: string
          planned_outing_stop_id?: string | null
          stop_order?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_outing_events_planned_outing_id_fkey"
            columns: ["planned_outing_id"]
            isOneToOne: false
            referencedRelation: "planned_outings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_outing_events_planned_outing_stop_id_fkey"
            columns: ["planned_outing_stop_id"]
            isOneToOne: false
            referencedRelation: "planned_outing_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_outing_feedback: {
        Row: {
          created_at: string
          id: string
          low_regret: boolean | null
          notes: string | null
          planned_outing_id: string
          rating: number | null
          user_id: string | null
          would_use_again: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          low_regret?: boolean | null
          notes?: string | null
          planned_outing_id: string
          rating?: number | null
          user_id?: string | null
          would_use_again?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          low_regret?: boolean | null
          notes?: string | null
          planned_outing_id?: string
          rating?: number | null
          user_id?: string | null
          would_use_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_outing_feedback_planned_outing_id_fkey"
            columns: ["planned_outing_id"]
            isOneToOne: false
            referencedRelation: "planned_outings"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_outing_stop_events: {
        Row: {
          created_at: string | null
          dwell_time_seconds: number | null
          event_type: string
          id: string
          metadata: Json | null
          planned_outing_id: string
          planned_outing_stop_id: string
          position: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dwell_time_seconds?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          planned_outing_id: string
          planned_outing_stop_id: string
          position?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dwell_time_seconds?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          planned_outing_id?: string
          planned_outing_stop_id?: string
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_outing_stop_events_planned_outing_id_fkey"
            columns: ["planned_outing_id"]
            isOneToOne: false
            referencedRelation: "planned_outings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_outing_stop_events_planned_outing_stop_id_fkey"
            columns: ["planned_outing_stop_id"]
            isOneToOne: false
            referencedRelation: "planned_outing_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_outing_stops: {
        Row: {
          created_at: string
          distance_meters_from_prev: number | null
          dwell_minutes: number | null
          id: string
          is_locked: boolean
          metadata: Json
          planned_arrival_at: string | null
          planned_departure_at: string | null
          planned_outing_id: string
          rationale: string | null
          role: string
          stop_order: number
          title: string | null
          travel_minutes_from_prev: number | null
          travel_mode: string | null
          venue_id: string
          was_swapped: boolean
        }
        Insert: {
          created_at?: string
          distance_meters_from_prev?: number | null
          dwell_minutes?: number | null
          id?: string
          is_locked?: boolean
          metadata?: Json
          planned_arrival_at?: string | null
          planned_departure_at?: string | null
          planned_outing_id: string
          rationale?: string | null
          role: string
          stop_order: number
          title?: string | null
          travel_minutes_from_prev?: number | null
          travel_mode?: string | null
          venue_id: string
          was_swapped?: boolean
        }
        Update: {
          created_at?: string
          distance_meters_from_prev?: number | null
          dwell_minutes?: number | null
          id?: string
          is_locked?: boolean
          metadata?: Json
          planned_arrival_at?: string | null
          planned_departure_at?: string | null
          planned_outing_id?: string
          rationale?: string | null
          role?: string
          stop_order?: number
          title?: string | null
          travel_minutes_from_prev?: number | null
          travel_mode?: string | null
          venue_id?: string
          was_swapped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "planned_outing_stops_planned_outing_id_fkey"
            columns: ["planned_outing_id"]
            isOneToOne: false
            referencedRelation: "planned_outings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_outing_stops_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "planned_outing_stops_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_outings: {
        Row: {
          anchor_ends_at: string | null
          anchor_starts_at: string | null
          anchor_title: string | null
          budget: string | null
          city: string
          confidence_score: number | null
          created_at: string
          event_id: string | null
          generation_version: string | null
          group_size: number | null
          id: string
          metadata: Json
          mobility: string | null
          mode: string
          plan_summary: string | null
          planned_end_at: string | null
          planned_start_at: string | null
          score_breakdown: Json
          share_enabled: boolean | null
          source: string
          status: string
          updated_at: string
          user_id: string | null
          venue_id: string | null
          vibe_tags: string[]
        }
        Insert: {
          anchor_ends_at?: string | null
          anchor_starts_at?: string | null
          anchor_title?: string | null
          budget?: string | null
          city: string
          confidence_score?: number | null
          created_at?: string
          event_id?: string | null
          generation_version?: string | null
          group_size?: number | null
          id?: string
          metadata?: Json
          mobility?: string | null
          mode: string
          plan_summary?: string | null
          planned_end_at?: string | null
          planned_start_at?: string | null
          score_breakdown?: Json
          share_enabled?: boolean | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          venue_id?: string | null
          vibe_tags?: string[]
        }
        Update: {
          anchor_ends_at?: string | null
          anchor_starts_at?: string | null
          anchor_title?: string | null
          budget?: string | null
          city?: string
          confidence_score?: number | null
          created_at?: string
          event_id?: string | null
          generation_version?: string | null
          group_size?: number | null
          id?: string
          metadata?: Json
          mobility?: string | null
          mode?: string
          plan_summary?: string | null
          planned_end_at?: string | null
          planned_start_at?: string | null
          score_breakdown?: Json
          share_enabled?: boolean | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          venue_id?: string | null
          vibe_tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "planned_outings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_outings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "planned_outings_venue_id_fkey"
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
      profile_public_stats: {
        Row: {
          completed_flow_stops: number
          completed_flows: number
          completed_hosted_flows: number
          created_at: string
          event_checkins: number
          event_xp: number
          hosted_crawls: number
          hosted_flow_stops: number
          joined_crawls: number
          passport_level: number
          passport_progress: number
          passport_progress_percent: number
          passport_xp: number
          past_crawls: number
          saved_properties: number
          updated_at: string
          user_id: string
          venue_visits: number
        }
        Insert: {
          completed_flow_stops?: number
          completed_flows?: number
          completed_hosted_flows?: number
          created_at?: string
          event_checkins?: number
          event_xp?: number
          hosted_crawls?: number
          hosted_flow_stops?: number
          joined_crawls?: number
          passport_level?: number
          passport_progress?: number
          passport_progress_percent?: number
          passport_xp?: number
          past_crawls?: number
          saved_properties?: number
          updated_at?: string
          user_id: string
          venue_visits?: number
        }
        Update: {
          completed_flow_stops?: number
          completed_flows?: number
          completed_hosted_flows?: number
          created_at?: string
          event_checkins?: number
          event_xp?: number
          hosted_crawls?: number
          hosted_flow_stops?: number
          joined_crawls?: number
          passport_level?: number
          passport_progress?: number
          passport_progress_percent?: number
          passport_xp?: number
          past_crawls?: number
          saved_properties?: number
          updated_at?: string
          user_id?: string
          venue_visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_public_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_range: string | null
          avatar_url: string | null
          bio: string | null
          crawl_type: string | null
          created_at: string | null
          creator_headline: string | null
          creator_mode_enabled: boolean
          creator_onboarding_completed_at: string | null
          days_out: string[] | null
          deleted_at: string | null
          frequency: string | null
          full_name: string | null
          has_seen_roam_intro: boolean
          home_neighborhood: string | null
          id: string
          instagram_handle: string | null
          intent_level: string | null
          interest_categories: string[] | null
          is_public: boolean | null
          onboarding_path: string | null
          onboarding_path_selected_at: string | null
          personality_style: string | null
          preferred_vibes: string[] | null
          show_checkins: boolean | null
          show_completed_flows: boolean | null
          show_public_exploration_map: boolean
          show_saved_guides: boolean | null
          show_social_groups: boolean | null
          show_xp: boolean | null
          social_comfort: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          age_range?: string | null
          avatar_url?: string | null
          bio?: string | null
          crawl_type?: string | null
          created_at?: string | null
          creator_headline?: string | null
          creator_mode_enabled?: boolean
          creator_onboarding_completed_at?: string | null
          days_out?: string[] | null
          deleted_at?: string | null
          frequency?: string | null
          full_name?: string | null
          has_seen_roam_intro?: boolean
          home_neighborhood?: string | null
          id: string
          instagram_handle?: string | null
          intent_level?: string | null
          interest_categories?: string[] | null
          is_public?: boolean | null
          onboarding_path?: string | null
          onboarding_path_selected_at?: string | null
          personality_style?: string | null
          preferred_vibes?: string[] | null
          show_checkins?: boolean | null
          show_completed_flows?: boolean | null
          show_public_exploration_map?: boolean
          show_saved_guides?: boolean | null
          show_social_groups?: boolean | null
          show_xp?: boolean | null
          social_comfort?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          age_range?: string | null
          avatar_url?: string | null
          bio?: string | null
          crawl_type?: string | null
          created_at?: string | null
          creator_headline?: string | null
          creator_mode_enabled?: boolean
          creator_onboarding_completed_at?: string | null
          days_out?: string[] | null
          deleted_at?: string | null
          frequency?: string | null
          full_name?: string | null
          has_seen_roam_intro?: boolean
          home_neighborhood?: string | null
          id?: string
          instagram_handle?: string | null
          intent_level?: string | null
          interest_categories?: string[] | null
          is_public?: boolean | null
          onboarding_path?: string | null
          onboarding_path_selected_at?: string | null
          personality_style?: string | null
          preferred_vibes?: string[] | null
          show_checkins?: boolean | null
          show_completed_flows?: boolean | null
          show_public_exploration_map?: boolean
          show_saved_guides?: boolean | null
          show_social_groups?: boolean | null
          show_xp?: boolean | null
          social_comfort?: string | null
          updated_at?: string | null
          username?: string | null
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
      property_guide_sections: {
        Row: {
          config: Json
          created_at: string
          guide_id: string
          id: string
          is_visible: boolean
          position: number
          section_key: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          guide_id: string
          id?: string
          is_visible?: boolean
          position?: number
          section_key: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          guide_id?: string
          id?: string
          is_visible?: boolean
          position?: number
          section_key?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_guide_sections_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "property_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      property_guides: {
        Row: {
          brand_id: string | null
          created_at: string
          default_travel_mode: string
          guide_mode: string
          hero_image_url: string | null
          id: string
          powered_by_roam: boolean
          property_id: string
          published_at: string | null
          show_nearby_events: boolean
          show_partner_offers: boolean
          show_property_favorites: boolean
          show_suggested_routes: boolean
          slug: string
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          welcome_description: string | null
          welcome_heading: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          default_travel_mode?: string
          guide_mode?: string
          hero_image_url?: string | null
          id?: string
          powered_by_roam?: boolean
          property_id: string
          published_at?: string | null
          show_nearby_events?: boolean
          show_partner_offers?: boolean
          show_property_favorites?: boolean
          show_suggested_routes?: boolean
          slug: string
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          welcome_description?: string | null
          welcome_heading?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          default_travel_mode?: string
          guide_mode?: string
          hero_image_url?: string | null
          id?: string
          powered_by_roam?: boolean
          property_id?: string
          published_at?: string | null
          show_nearby_events?: boolean
          show_partner_offers?: boolean
          show_property_favorites?: boolean
          show_suggested_routes?: boolean
          slug?: string
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          welcome_description?: string | null
          welcome_heading?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_guides_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "guide_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_guides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_ingestion_items: {
        Row: {
          content_hash: string | null
          created_at: string | null
          discovery_run_id: string | null
          error_message: string | null
          id: string
          raw_html: string | null
          raw_text: string
          source_id: string | null
          source_type: string
          source_url: string | null
          status: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          discovery_run_id?: string | null
          error_message?: string | null
          id?: string
          raw_html?: string | null
          raw_text: string
          source_id?: string | null
          source_type: string
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          discovery_run_id?: string | null
          error_message?: string | null
          id?: string
          raw_html?: string | null
          raw_text?: string
          source_id?: string | null
          source_type?: string
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_ingestion_items_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "event_discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ingestion_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "venue_event_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_ingestion_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "raw_ingestion_items_venue_id_fkey"
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
      reputation_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          minimum_venues_for_ranking: number
          minimum_venues_for_status: number
          plural_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          label: string
          minimum_venues_for_ranking?: number
          minimum_venues_for_status?: number
          plural_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          minimum_venues_for_ranking?: number
          minimum_venues_for_status?: number
          plural_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      social_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      social_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_user_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
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
      venue_bookings: {
        Row: {
          created_at: string | null
          id: string
          provider: string | null
          url: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          provider?: string | null
          url: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          provider?: string | null
          url?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
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
      venue_event_sources: {
        Row: {
          check_frequency: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          last_checked_at: string | null
          notes: string | null
          reliability_score: number | null
          source_label: string | null
          source_type: string
          source_url: string | null
          updated_at: string | null
          venue_id: string
        }
        Insert: {
          check_frequency?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_checked_at?: string | null
          notes?: string | null
          reliability_score?: number | null
          source_label?: string | null
          source_type: string
          source_url?: string | null
          updated_at?: string | null
          venue_id: string
        }
        Update: {
          check_frequency?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_checked_at?: string | null
          notes?: string | null
          reliability_score?: number | null
          source_label?: string | null
          source_type?: string
          source_url?: string | null
          updated_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_event_sources_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_event_sources_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
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
      venue_partnerships: {
        Row: {
          badge_label: string
          created_at: string
          ends_at: string | null
          featured_rank: number | null
          id: string
          is_featured: boolean
          offer_description: string | null
          offer_title: string | null
          partner_since: string | null
          starts_at: string | null
          status: string
          terms: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          badge_label?: string
          created_at?: string
          ends_at?: string | null
          featured_rank?: number | null
          id?: string
          is_featured?: boolean
          offer_description?: string | null
          offer_title?: string | null
          partner_since?: string | null
          starts_at?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          badge_label?: string
          created_at?: string
          ends_at?: string | null
          featured_rank?: number | null
          id?: string
          is_featured?: boolean
          offer_description?: string | null
          offer_title?: string | null
          partner_since?: string | null
          starts_at?: string | null
          status?: string
          terms?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_partnerships_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_partnerships_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_reputation_categories: {
        Row: {
          category_id: string
          created_at: string
          mapping_weight: number
          matched_raw_types: string[]
          matched_type_count: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          mapping_weight: number
          matched_raw_types?: string[]
          matched_type_count?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          mapping_weight?: number
          matched_raw_types?: string[]
          matched_type_count?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_reputation_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "reputation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_reputation_categories_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_reputation_categories_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_type_category_mappings: {
        Row: {
          category_id: string
          created_at: string
          mapping_weight: number
          raw_type: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          mapping_weight?: number
          raw_type: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          mapping_weight?: number
          raw_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_type_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "reputation_categories"
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
      venue_visits: {
        Row: {
          check_in_source: string
          created_at: string
          device_timestamp: string | null
          distance_meters: number | null
          geo_verified: boolean
          id: string
          location_accuracy_meters: number | null
          rating: number
          updated_at: string
          user_id: string
          user_lat: number | null
          user_lon: number | null
          venue_id: string
          visit_date: string | null
          visited_at: string
        }
        Insert: {
          check_in_source?: string
          created_at?: string
          device_timestamp?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          rating: number
          updated_at?: string
          user_id: string
          user_lat?: number | null
          user_lon?: number | null
          venue_id: string
          visit_date?: string | null
          visited_at?: string
        }
        Update: {
          check_in_source?: string
          created_at?: string
          device_timestamp?: string | null
          distance_meters?: number | null
          geo_verified?: boolean
          id?: string
          location_accuracy_meters?: number | null
          rating?: number
          updated_at?: string
          user_id?: string
          user_lat?: number | null
          user_lon?: number | null
          venue_id?: string
          visit_date?: string | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_visits_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_visits_venue_id_fkey"
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
          canonical_city: string | null
          city: string | null
          contact: string[] | null
          cover: string | null
          description: string | null
          duration: number | null
          energy_ramp: number | null
          event_check_frequency: string | null
          event_discovery_status: string | null
          event_likelihood_score: number | null
          event_source_notes: string | null
          events_url: string | null
          hours: Json | null
          id: string
          instagram_handle: string | null
          last_event_check_at: string | null
          last_verified_at: string | null
          lat: number | null
          lon: number | null
          name: string | null
          price: string | null
          profile_status: string | null
          slug: string | null
          tags: string[] | null
          tier: string | null
          time_category: string[] | null
          type: string[] | null
          vibe: string[] | null
          website_url: string | null
        }
        Insert: {
          access_token?: string | null
          address?: string | null
          canonical_city?: string | null
          city?: string | null
          contact?: string[] | null
          cover?: string | null
          description?: string | null
          duration?: number | null
          energy_ramp?: number | null
          event_check_frequency?: string | null
          event_discovery_status?: string | null
          event_likelihood_score?: number | null
          event_source_notes?: string | null
          events_url?: string | null
          hours?: Json | null
          id?: string
          instagram_handle?: string | null
          last_event_check_at?: string | null
          last_verified_at?: string | null
          lat?: number | null
          lon?: number | null
          name?: string | null
          price?: string | null
          profile_status?: string | null
          slug?: string | null
          tags?: string[] | null
          tier?: string | null
          time_category?: string[] | null
          type?: string[] | null
          vibe?: string[] | null
          website_url?: string | null
        }
        Update: {
          access_token?: string | null
          address?: string | null
          canonical_city?: string | null
          city?: string | null
          contact?: string[] | null
          cover?: string | null
          description?: string | null
          duration?: number | null
          energy_ramp?: number | null
          event_check_frequency?: string | null
          event_discovery_status?: string | null
          event_likelihood_score?: number | null
          event_source_notes?: string | null
          events_url?: string | null
          hours?: Json | null
          id?: string
          instagram_handle?: string | null
          last_event_check_at?: string | null
          last_verified_at?: string | null
          lat?: number | null
          lon?: number | null
          name?: string | null
          price?: string | null
          profile_status?: string | null
          slug?: string | null
          tags?: string[] | null
          tier?: string | null
          time_category?: string[] | null
          type?: string[] | null
          vibe?: string[] | null
          website_url?: string | null
        }
        Relationships: []
      }
      venues_staging_raw: {
        Row: {
          access_token: string | null
          address: string | null
          city: string | null
          contact: string | null
          cover: string | null
          description: string | null
          duration: string | null
          energy_ramp: string | null
          hours: string | null
          id: string | null
          instagram_handle: string | null
          lat: string | null
          lon: string | null
          name: string | null
          price: string | null
          slug: string | null
          tags: string[] | null
          tags_normalized: string[] | null
          tier: string | null
          time_category: string[] | null
          time_category_normalized: string[] | null
          type: string[] | null
          type_normalized: string[] | null
          vibe: string[] | null
          vibe_normalized: string[] | null
        }
        Insert: {
          access_token?: string | null
          address?: string | null
          city?: string | null
          contact?: string | null
          cover?: string | null
          description?: string | null
          duration?: string | null
          energy_ramp?: string | null
          hours?: string | null
          id?: string | null
          instagram_handle?: string | null
          lat?: string | null
          lon?: string | null
          name?: string | null
          price?: string | null
          slug?: string | null
          tags?: string[] | null
          tags_normalized?: string[] | null
          tier?: string | null
          time_category?: string[] | null
          time_category_normalized?: string[] | null
          type?: string[] | null
          type_normalized?: string[] | null
          vibe?: string[] | null
          vibe_normalized?: string[] | null
        }
        Update: {
          access_token?: string | null
          address?: string | null
          city?: string | null
          contact?: string | null
          cover?: string | null
          description?: string | null
          duration?: string | null
          energy_ramp?: string | null
          hours?: string | null
          id?: string | null
          instagram_handle?: string | null
          lat?: string | null
          lon?: string | null
          name?: string | null
          price?: string | null
          slug?: string | null
          tags?: string[] | null
          tags_normalized?: string[] | null
          tier?: string | null
          time_category?: string[] | null
          time_category_normalized?: string[] | null
          type?: string[] | null
          type_normalized?: string[] | null
          vibe?: string[] | null
          vibe_normalized?: string[] | null
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
          canonical_city: string | null
          city: string | null
          contact: string[] | null
          cover: string | null
          description: string | null
          duration: number | null
          energy_ramp: number | null
          event_check_frequency: string | null
          event_discovery_status: string | null
          event_likelihood_score: number | null
          event_source_notes: string | null
          events_url: string | null
          hours: Json | null
          id: string
          instagram_handle: string | null
          last_event_check_at: string | null
          last_verified_at: string | null
          lat: number | null
          lon: number | null
          name: string | null
          price: string | null
          profile_status: string | null
          slug: string | null
          tags: string[] | null
          tier: string | null
          time_category: string[] | null
          type: string[] | null
          vibe: string[] | null
          website_url: string | null
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
      rebuild_venue_reputation_categories: { Args: never; Returns: number }
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
      sync_venue_reputation_categories: {
        Args: { target_venue_id: string }
        Returns: undefined
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
      event_arrival_policy:
        | "by_start"
        | "midpoint_deadline"
        | "window"
        | "custom"
      event_arrival_preference:
        | "early"
        | "on_time"
        | "fashionably_late"
        | "late_ok"
      event_destination_coordinates_source: "venue" | "manual"
      event_destination_kind: "venue" | "custom"
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
    Enums: {
      event_arrival_policy: [
        "by_start",
        "midpoint_deadline",
        "window",
        "custom",
      ],
      event_arrival_preference: [
        "early",
        "on_time",
        "fashionably_late",
        "late_ok",
      ],
      event_destination_coordinates_source: ["venue", "manual"],
      event_destination_kind: ["venue", "custom"],
    },
  },
} as const



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

export type PlannedOutingRecord =
  Database['public']['Tables']['planned_outings']['Row']

export type PlannedOutingInsert =
  Database['public']['Tables']['planned_outings']['Insert']

export type PlannedOutingUpdate =
  Database['public']['Tables']['planned_outings']['Update']

export type PlannedOutingStopRecord =
  Database['public']['Tables']['planned_outing_stops']['Row']

export type PlannedOutingStopInsert =
  Database['public']['Tables']['planned_outing_stops']['Insert']

export type PlannedOutingStopUpdate =
  Database['public']['Tables']['planned_outing_stops']['Update']

export type PlannedOutingEventRecord =
  Database['public']['Tables']['planned_outing_events']['Row']

export type PlannedOutingEventInsert =
  Database['public']['Tables']['planned_outing_events']['Insert']

export type PlannedOutingEventUpdate =
  Database['public']['Tables']['planned_outing_events']['Update']

export type PlannedOutingFeedbackRecord =
  Database['public']['Tables']['planned_outing_feedback']['Row']

export type PlannedOutingFeedbackInsert =
  Database['public']['Tables']['planned_outing_feedback']['Insert']

export type PlannedOutingFeedbackUpdate =
  Database['public']['Tables']['planned_outing_feedback']['Update']

export type PlannedOutingStopEventRecord =
  Database['public']['Tables']['planned_outing_stop_events']['Row']

export type PlannedOutingStopEventInsert =
  Database['public']['Tables']['planned_outing_stop_events']['Insert']

export type PlannedOutingStopEventUpdate =
  Database['public']['Tables']['planned_outing_stop_events']['Update']

/* ----------------------- */
/* Event Journey Types     */
/* ----------------------- */

export type EventJourneyRecord =
  Database['public']['Tables']['event_journeys']['Row']

export type EventJourneyInsert =
  Database['public']['Tables']['event_journeys']['Insert']

export type EventJourneyUpdate =
  Database['public']['Tables']['event_journeys']['Update']

export type EventJourneyStopRecord =
  Database['public']['Tables']['event_journey_stops']['Row']

export type EventJourneyStopInsert =
  Database['public']['Tables']['event_journey_stops']['Insert']

export type EventJourneyStopUpdate =
  Database['public']['Tables']['event_journey_stops']['Update']

  /* ----------------------- */
/* Derived Journey Types   */
/* ----------------------- */

export type EventJourneyWithStops = EventJourneyRecord & {
  stops: EventJourneyStopRecord[]
}

export type EventJourneyStopWithVenue = EventJourneyStopRecord & {
  venue: VenueRecord
}