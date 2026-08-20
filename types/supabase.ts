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
          source_creator_user_id: string | null
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
          source_creator_user_id?: string | null
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
          source_creator_user_id?: string | null
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
      competition_entries: {
        Row: {
          approved_at: string | null
          competition_id: string
          contender_slot: number
          created_at: string
          disqualified_at: string | null
          id: string
          source_flow_session_id: string | null
          source_type: string
          source_visit_date: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
          venue_ids: string[]
          withdrawn_at: string | null
        }
        Insert: {
          approved_at?: string | null
          competition_id: string
          contender_slot: number
          created_at?: string
          disqualified_at?: string | null
          id?: string
          source_flow_session_id?: string | null
          source_type: string
          source_visit_date?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          venue_ids: string[]
          withdrawn_at?: string | null
        }
        Update: {
          approved_at?: string | null
          competition_id?: string
          contender_slot?: number
          created_at?: string
          disqualified_at?: string | null
          id?: string
          source_flow_session_id?: string | null
          source_type?: string
          source_visit_date?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          venue_ids?: string[]
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_entries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_entries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_entry_attribution_events: {
        Row: {
          competition_entry_id: string
          competition_id: string
          competitor_user_id: string
          created_at: string
          event_type: string
          explorer_user_id: string
          flow_session_id: string
          id: string
          occurred_at: string
          stop_index: number | null
          venue_id: string | null
        }
        Insert: {
          competition_entry_id: string
          competition_id: string
          competitor_user_id: string
          created_at?: string
          event_type: string
          explorer_user_id: string
          flow_session_id: string
          id?: string
          occurred_at?: string
          stop_index?: number | null
          venue_id?: string | null
        }
        Update: {
          competition_entry_id?: string
          competition_id?: string
          competitor_user_id?: string
          created_at?: string
          event_type?: string
          explorer_user_id?: string
          flow_session_id?: string
          id?: string
          occurred_at?: string
          stop_index?: number | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_entry_attribution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_entry_attribution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_entry_attribution_events_entry_fk"
            columns: ["competition_id", "competition_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
          {
            foreignKeyName: "competition_entry_attribution_events_flow_bridge_fk"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "competition_flow_sessions"
            referencedColumns: ["flow_session_id"]
          },
        ]
      }
      competition_entry_ratings: {
        Row: {
          competition_id: string
          created_at: string
          entry_id: string
          id: string
          overall_rating: number
          participation_id: string
          updated_at: string
          user_id: string
          would_repeat: boolean | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          entry_id: string
          id?: string
          overall_rating: number
          participation_id: string
          updated_at?: string
          user_id: string
          would_repeat?: boolean | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          overall_rating?: number
          participation_id?: string
          updated_at?: string
          user_id?: string
          would_repeat?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_entry_ratings_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_entry_ratings_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_entry_ratings_participation_fkey"
            columns: [
              "competition_id",
              "entry_id",
              "user_id",
              "participation_id",
            ]
            isOneToOne: false
            referencedRelation: "competition_participations"
            referencedColumns: [
              "competition_id",
              "competition_entry_id",
              "user_id",
              "id",
            ]
          },
        ]
      }
      competition_entry_score_snapshots: {
        Row: {
          algorithm_version: string
          average_rating: number | null
          calculated_at: string
          comparative_score: number | null
          competition_id: string
          completed_participant_count: number
          completion_rate: number | null
          completion_score: number | null
          confidence_score: number
          created_at: string
          cross_completer_count: number
          entry_id: string
          experience_score: number | null
          final_score: number
          head_to_head_eligible_count: number
          head_to_head_preference_count: number
          head_to_head_preference_rate: number | null
          id: string
          participation_count: number
          qualified_participant_count: number
          rating_count: number
          repeat_score: number | null
          replay_count: number | null
          replay_rate: number | null
          save_count: number | null
          save_rate: number | null
          snapshot_type: string
          would_repeat_count: number
          would_repeat_rate: number | null
          would_repeat_response_count: number
        }
        Insert: {
          algorithm_version: string
          average_rating?: number | null
          calculated_at?: string
          comparative_score?: number | null
          competition_id: string
          completed_participant_count?: number
          completion_rate?: number | null
          completion_score?: number | null
          confidence_score?: number
          created_at?: string
          cross_completer_count?: number
          entry_id: string
          experience_score?: number | null
          final_score: number
          head_to_head_eligible_count?: number
          head_to_head_preference_count?: number
          head_to_head_preference_rate?: number | null
          id?: string
          participation_count?: number
          qualified_participant_count?: number
          rating_count?: number
          repeat_score?: number | null
          replay_count?: number | null
          replay_rate?: number | null
          save_count?: number | null
          save_rate?: number | null
          snapshot_type?: string
          would_repeat_count?: number
          would_repeat_rate?: number | null
          would_repeat_response_count?: number
        }
        Update: {
          algorithm_version?: string
          average_rating?: number | null
          calculated_at?: string
          comparative_score?: number | null
          competition_id?: string
          completed_participant_count?: number
          completion_rate?: number | null
          completion_score?: number | null
          confidence_score?: number
          created_at?: string
          cross_completer_count?: number
          entry_id?: string
          experience_score?: number | null
          final_score?: number
          head_to_head_eligible_count?: number
          head_to_head_preference_count?: number
          head_to_head_preference_rate?: number | null
          id?: string
          participation_count?: number
          qualified_participant_count?: number
          rating_count?: number
          repeat_score?: number | null
          replay_count?: number | null
          replay_rate?: number | null
          save_count?: number | null
          save_rate?: number | null
          snapshot_type?: string
          would_repeat_count?: number
          would_repeat_rate?: number | null
          would_repeat_response_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_score_snapshots_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_score_snapshots_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_score_snapshots_entry_competition_fkey"
            columns: ["competition_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
        ]
      }
      competition_flow_sessions: {
        Row: {
          competition_entry_id: string
          competition_id: string
          created_at: string
          flow_session_id: string
          id: string
          user_id: string
        }
        Insert: {
          competition_entry_id: string
          competition_id: string
          created_at?: string
          flow_session_id: string
          id?: string
          user_id: string
        }
        Update: {
          competition_entry_id?: string
          competition_id?: string
          created_at?: string
          flow_session_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_flow_sessions_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_flow_sessions_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_flow_sessions_entry_competition_fkey"
            columns: ["competition_id", "competition_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
          {
            foreignKeyName: "competition_flow_sessions_flow_user_fkey"
            columns: ["flow_session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      competition_head_to_head_preferences: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          preferred_entry_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          preferred_entry_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          preferred_entry_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_h2h_preferences_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_h2h_preferences_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_h2h_preferences_entry_competition_fkey"
            columns: ["competition_id", "preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
        ]
      }
      competition_participations: {
        Row: {
          competition_entry_id: string
          competition_id: string
          completed_at: string | null
          completion_ratio: number | null
          created_at: string
          flow_session_id: string | null
          id: string
          qualified: boolean
          started_at: string
          total_stop_count: number
          updated_at: string
          user_id: string
          verified_stop_count: number
        }
        Insert: {
          competition_entry_id: string
          competition_id: string
          completed_at?: string | null
          completion_ratio?: number | null
          created_at?: string
          flow_session_id?: string | null
          id?: string
          qualified?: boolean
          started_at?: string
          total_stop_count: number
          updated_at?: string
          user_id: string
          verified_stop_count?: number
        }
        Update: {
          competition_entry_id?: string
          competition_id?: string
          completed_at?: string | null
          completion_ratio?: number | null
          created_at?: string
          flow_session_id?: string | null
          id?: string
          qualified?: boolean
          started_at?: string
          total_stop_count?: number
          updated_at?: string
          user_id?: string
          verified_stop_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_participations_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participations_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_participations_entry_competition_fkey"
            columns: ["competition_id", "competition_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
          {
            foreignKeyName: "competition_participations_flow_user_fkey"
            columns: ["flow_session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      competition_relay_entries: {
        Row: {
          competition_id: string
          contender_slot: number
          created_at: string
          id: string
          relay_artifact_id: string | null
          relay_team_id: string
          scoring_eligible_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          competition_id: string
          contender_slot: number
          created_at?: string
          id?: string
          relay_artifact_id?: string | null
          relay_team_id: string
          scoring_eligible_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          contender_slot?: number
          created_at?: string
          id?: string
          relay_artifact_id?: string | null
          relay_team_id?: string
          scoring_eligible_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_relay_team_fk"
            columns: ["relay_team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_relay_team_fk"
            columns: ["relay_team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_relay_team_fk"
            columns: ["relay_team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_entry_ratings: {
        Row: {
          competition_id: string
          competition_relay_entry_id: string
          created_at: string
          id: string
          rating: number
          replay_user_id: string
        }
        Insert: {
          competition_id: string
          competition_relay_entry_id: string
          created_at?: string
          id?: string
          rating: number
          replay_user_id: string
        }
        Update: {
          competition_id?: string
          competition_relay_entry_id?: string
          created_at?: string
          id?: string
          rating?: number
          replay_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entry_ratings_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_entry_ratings_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
        ]
      }
      competition_relay_entry_score_snapshots: {
        Row: {
          average_rating: number | null
          comparative_confidence: number
          competition_id: string
          competition_relay_entry_id: string
          contender_slot: number
          created_at: string
          cross_completer_count: number
          evidence_score: number
          execution_confidence: number
          final_score: number
          head_to_head_losses: number
          head_to_head_preference_rate: number | null
          head_to_head_sample_count: number
          head_to_head_score: number
          head_to_head_weight: number
          head_to_head_wins: number
          id: string
          overall_confidence: number
          qualified_completion_count: number
          qualified_completion_score: number
          qualified_completion_weight: number
          qualified_starter_count: number
          rating_confidence: number
          rating_count: number
          rating_score: number
          rating_weight: number
          relay_artifact_id: string
          route_completion_rate: number | null
          route_completion_rate_score: number
          route_completion_rate_weight: number
          snapshot_at: string
        }
        Insert: {
          average_rating?: number | null
          comparative_confidence: number
          competition_id: string
          competition_relay_entry_id: string
          contender_slot: number
          created_at?: string
          cross_completer_count: number
          evidence_score: number
          execution_confidence: number
          final_score: number
          head_to_head_losses: number
          head_to_head_preference_rate?: number | null
          head_to_head_sample_count: number
          head_to_head_score: number
          head_to_head_weight: number
          head_to_head_wins: number
          id?: string
          overall_confidence: number
          qualified_completion_count: number
          qualified_completion_score: number
          qualified_completion_weight: number
          qualified_starter_count: number
          rating_confidence: number
          rating_count: number
          rating_score: number
          rating_weight: number
          relay_artifact_id: string
          route_completion_rate?: number | null
          route_completion_rate_score: number
          route_completion_rate_weight: number
          snapshot_at?: string
        }
        Update: {
          average_rating?: number | null
          comparative_confidence?: number
          competition_id?: string
          competition_relay_entry_id?: string
          contender_slot?: number
          created_at?: string
          cross_completer_count?: number
          evidence_score?: number
          execution_confidence?: number
          final_score?: number
          head_to_head_losses?: number
          head_to_head_preference_rate?: number | null
          head_to_head_sample_count?: number
          head_to_head_score?: number
          head_to_head_weight?: number
          head_to_head_wins?: number
          id?: string
          overall_confidence?: number
          qualified_completion_count?: number
          qualified_completion_score?: number
          qualified_completion_weight?: number
          qualified_starter_count?: number
          rating_confidence?: number
          rating_count?: number
          rating_score?: number
          rating_weight?: number
          relay_artifact_id?: string
          route_completion_rate?: number | null
          route_completion_rate_score?: number
          route_completion_rate_weight?: number
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_score_snapshots_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_score_snapshots_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: true
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
        ]
      }
      competition_relay_execution_events: {
        Row: {
          competition_id: string
          competition_relay_entry_id: string
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          relay_artifact_id: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
          stop_index: number | null
          venue_id: string | null
        }
        Insert: {
          competition_id: string
          competition_relay_entry_id: string
          created_at?: string
          event_type: string
          id?: string
          occurred_at: string
          relay_artifact_id: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
          stop_index?: number | null
          venue_id?: string | null
        }
        Update: {
          competition_id?: string
          competition_relay_entry_id?: string
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          relay_artifact_id?: string
          replay_user_id?: string
          session_id?: string
          snapshot_id?: string
          stop_index?: number | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_venue_fk"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_venue_fk"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_head_to_head_preferences: {
        Row: {
          competition_id: string
          created_at: string
          entry_a_id: string
          entry_b_id: string
          id: string
          preferred_entry_id: string
          voter_user_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          entry_a_id: string
          entry_b_id: string
          id?: string
          preferred_entry_id: string
          voter_user_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          entry_a_id?: string
          entry_b_id?: string
          id?: string
          preferred_entry_id?: string
          voter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_h2h_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_a_fk"
            columns: ["entry_a_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_entry_b_fk"
            columns: ["entry_b_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_h2h_preferred_fk"
            columns: ["preferred_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
        ]
      }
      competition_relay_replay_attribution_conflicts: {
        Row: {
          candidate_count: number
          details: Json
          first_observed_at: string
          id: string
          last_observed_at: string
          reason: string
          replay_user_id: string
          session_id: string
          snapshot_id: string | null
        }
        Insert: {
          candidate_count?: number
          details?: Json
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          reason: string
          replay_user_id: string
          session_id: string
          snapshot_id?: string | null
        }
        Update: {
          candidate_count?: number
          details?: Json
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          reason?: string
          replay_user_id?: string
          session_id?: string
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_replay_conflicts_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_conflicts_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_replay_sessions: {
        Row: {
          attributed_at: string
          competition_id: string
          competition_relay_entry_id: string
          created_at: string
          id: string
          relay_artifact_id: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
        }
        Insert: {
          attributed_at?: string
          competition_id: string
          competition_relay_entry_id: string
          created_at?: string
          id?: string
          relay_artifact_id: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
        }
        Update: {
          attributed_at?: string
          competition_id?: string
          competition_relay_entry_id?: string
          created_at?: string
          id?: string
          relay_artifact_id?: string
          replay_user_id?: string
          session_id?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_replay_sessions_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_session_fk"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_scoring_configs: {
        Row: {
          competition_id: string
          created_at: string
          head_to_head_weight: number
          qualified_completion_weight: number
          rating_max: number
          rating_min: number
          rating_weight: number
          route_completion_rate_weight: number
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          head_to_head_weight?: number
          qualified_completion_weight?: number
          rating_max?: number
          rating_min?: number
          rating_weight?: number
          route_completion_rate_weight?: number
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          head_to_head_weight?: number
          qualified_completion_weight?: number
          rating_max?: number
          rating_min?: number
          rating_weight?: number
          route_completion_rate_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_scoring_configs_competition_fk"
            columns: ["competition_id"]
            isOneToOne: true
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_scoring_configs_competition_fk"
            columns: ["competition_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_results: {
        Row: {
          algorithm_version: string | null
          competition_id: string
          created_at: string
          final_evidence_snapshot_id: string | null
          id: string
          result_status: string
          settled_at: string
          settled_by: string | null
          updated_at: string
          winner_entry_id: string | null
          xp_award_status: string
          xp_awarded_at: string | null
        }
        Insert: {
          algorithm_version?: string | null
          competition_id: string
          created_at?: string
          final_evidence_snapshot_id?: string | null
          id?: string
          result_status: string
          settled_at?: string
          settled_by?: string | null
          updated_at?: string
          winner_entry_id?: string | null
          xp_award_status: string
          xp_awarded_at?: string | null
        }
        Update: {
          algorithm_version?: string | null
          competition_id?: string
          created_at?: string
          final_evidence_snapshot_id?: string | null
          id?: string
          result_status?: string
          settled_at?: string
          settled_by?: string | null
          updated_at?: string
          winner_entry_id?: string | null
          xp_award_status?: string
          xp_awarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_results_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_competition_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_results_final_evidence_fkey"
            columns: [
              "competition_id",
              "winner_entry_id",
              "final_evidence_snapshot_id",
            ]
            isOneToOne: false
            referencedRelation: "competition_entry_score_snapshots"
            referencedColumns: ["competition_id", "entry_id", "id"]
          },
          {
            foreignKeyName: "competition_results_winner_competition_fkey"
            columns: ["competition_id", "winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
        ]
      }
      competition_submissions: {
        Row: {
          competition_entry_id: string | null
          competition_id: string
          created_at: string
          flow_session_id: string | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_city: string | null
          route_completed_at: string | null
          route_started_at: string | null
          route_title: string | null
          status: string
          submission_source: string
          submitted_at: string
          updated_at: string
          user_id: string
          venue_ids: string[]
          verified_venue_count: number
          visit_date: string | null
        }
        Insert: {
          competition_entry_id?: string | null
          competition_id: string
          created_at?: string
          flow_session_id?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_city?: string | null
          route_completed_at?: string | null
          route_started_at?: string | null
          route_title?: string | null
          status?: string
          submission_source: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          venue_ids: string[]
          verified_venue_count: number
          visit_date?: string | null
        }
        Update: {
          competition_entry_id?: string | null
          competition_id?: string
          created_at?: string
          flow_session_id?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_city?: string | null
          route_completed_at?: string | null
          route_started_at?: string | null
          route_title?: string | null
          status?: string
          submission_source?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          venue_ids?: string[]
          verified_venue_count?: number
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_submissions_competition_entry_id_fkey"
            columns: ["competition_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_submissions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_submissions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_xp_awards: {
        Row: {
          awarded_at: string
          competition_id: string
          created_at: string
          id: string
          source_type: string
          user_id: string
          winner_entry_id: string
          xp_amount: number
        }
        Insert: {
          awarded_at?: string
          competition_id: string
          created_at?: string
          id?: string
          source_type?: string
          user_id: string
          winner_entry_id: string
          xp_amount: number
        }
        Update: {
          awarded_at?: string
          competition_id?: string
          created_at?: string
          id?: string
          source_type?: string
          user_id?: string
          winner_entry_id?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_xp_awards_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_xp_awards_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_xp_awards_entry_competition_fk"
            columns: ["competition_id", "winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["competition_id", "id"]
          },
        ]
      }
      competitions: {
        Row: {
          anonymous_entries: boolean
          category: string | null
          city: string | null
          competition_type: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          max_entries: number
          minimum_cross_completers: number
          minimum_qualified_participants: number
          relay_entry_mode: string | null
          relay_id: string | null
          relay_reward_mode: string | null
          relay_winner_entry_id: string | null
          result_status: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
          winner_entry_id: string | null
          xp_reward: number
        }
        Insert: {
          anonymous_entries?: boolean
          category?: string | null
          city?: string | null
          competition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          max_entries?: number
          minimum_cross_completers?: number
          minimum_qualified_participants?: number
          relay_entry_mode?: string | null
          relay_id?: string | null
          relay_reward_mode?: string | null
          relay_winner_entry_id?: string | null
          result_status?: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
          winner_entry_id?: string | null
          xp_reward?: number
        }
        Update: {
          anonymous_entries?: boolean
          category?: string | null
          city?: string | null
          competition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          max_entries?: number
          minimum_cross_completers?: number
          minimum_qualified_participants?: number
          relay_entry_mode?: string | null
          relay_id?: string | null
          relay_reward_mode?: string | null
          relay_winner_entry_id?: string | null
          result_status?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          winner_entry_id?: string | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "competitions_relay_id_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_entries"
            referencedColumns: ["id"]
          },
        ]
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
      creator_replay_events: {
        Row: {
          created_at: string
          creator_user_id: string
          event_type: string
          id: string
          occurred_at: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
          stop_index: number | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          creator_user_id: string
          event_type: string
          id?: string
          occurred_at: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
          stop_index?: number | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          creator_user_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          replay_user_id?: string
          session_id?: string
          snapshot_id?: string
          stop_index?: number | null
          venue_id?: string | null
        }
        Relationships: []
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
      flow_snapshot_stops: {
        Row: {
          created_at: string
          id: string
          snapshot_id: string
          stop_index: number
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot_id: string
          stop_index: number
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot_id?: string
          stop_index?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_snapshot_stops_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_snapshot_stops_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "flow_snapshot_stops_venue_id_fkey"
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
          replayable: boolean
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
          replayable?: boolean
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
          replayable?: boolean
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
          competition_win_xp: number
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
          competition_win_xp?: number
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
          competition_win_xp?: number
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
      roam_relay_artifact_slots: {
        Row: {
          artifact_id: string
          checked_in_at: string
          completed_at: string
          contributor_user_id: string
          created_at: string
          flow_session_id: string
          id: string
          relay_slot_id: string
          slot_index: number
          team_slot_id: string
          venue_id: string
        }
        Insert: {
          artifact_id: string
          checked_in_at: string
          completed_at: string
          contributor_user_id: string
          created_at?: string
          flow_session_id: string
          id?: string
          relay_slot_id: string
          slot_index: number
          team_slot_id: string
          venue_id: string
        }
        Update: {
          artifact_id?: string
          checked_in_at?: string
          completed_at?: string
          contributor_user_id?: string
          created_at?: string
          flow_session_id?: string
          id?: string
          relay_slot_id?: string
          slot_index?: number
          team_slot_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_artifact_slots_artifact_fk"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "roam_relay_artifact_slots_artifact_fk"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifact_slots_flow_session_fk"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifact_slots_relay_slot_fk"
            columns: ["relay_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifact_slots_team_slot_fk"
            columns: ["team_slot_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_team_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_artifacts: {
        Row: {
          city: string
          completed_at: string
          contributor_user_ids: string[]
          created_at: string
          id: string
          public_flow_snapshot_id: string | null
          relay_id: string
          team_id: string
          theme: string | null
          title: string
          venue_ids: string[]
        }
        Insert: {
          city: string
          completed_at: string
          contributor_user_ids: string[]
          created_at?: string
          id?: string
          public_flow_snapshot_id?: string | null
          relay_id: string
          team_id: string
          theme?: string | null
          title: string
          venue_ids: string[]
        }
        Update: {
          city?: string
          completed_at?: string
          contributor_user_ids?: string[]
          created_at?: string
          id?: string
          public_flow_snapshot_id?: string | null
          relay_id?: string
          team_id?: string
          theme?: string | null
          title?: string
          venue_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_artifacts_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_team_fk"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_team_fk"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_team_fk"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_attribution_events: {
        Row: {
          contributor_user_id: string
          created_at: string
          event_type: string
          flow_session_id: string
          id: string
          occurred_at: string
          relay_id: string
          relay_slot_id: string
          team_id: string
          team_slot_id: string
          venue_id: string
        }
        Insert: {
          contributor_user_id: string
          created_at?: string
          event_type: string
          flow_session_id: string
          id?: string
          occurred_at: string
          relay_id: string
          relay_slot_id: string
          team_id: string
          team_slot_id: string
          venue_id: string
        }
        Update: {
          contributor_user_id?: string
          created_at?: string
          event_type?: string
          flow_session_id?: string
          id?: string
          occurred_at?: string
          relay_id?: string
          relay_slot_id?: string
          team_id?: string
          team_slot_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_attribution_events_flow_session_fk"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_attribution_events_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_attribution_events_relay_slot_fk"
            columns: ["relay_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_attribution_events_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_attribution_events_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_attribution_events_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_attribution_events_team_slot_fk"
            columns: ["team_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_downstream_attribution_events: {
        Row: {
          artifact_slot_id: string
          contributor_user_id: string
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          relay_artifact_id: string
          relay_id: string
          replay_session_id: string
          replay_user_id: string
          source_progress_id: string | null
          source_snapshot_id: string
          stop_index: number | null
          team_id: string
          venue_id: string | null
        }
        Insert: {
          artifact_slot_id: string
          contributor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          occurred_at: string
          relay_artifact_id: string
          relay_id: string
          replay_session_id: string
          replay_user_id: string
          source_progress_id?: string | null
          source_snapshot_id: string
          stop_index?: number | null
          team_id: string
          venue_id?: string | null
        }
        Update: {
          artifact_slot_id?: string
          contributor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          relay_artifact_id?: string
          relay_id?: string
          replay_session_id?: string
          replay_user_id?: string
          source_progress_id?: string | null
          source_snapshot_id?: string
          stop_index?: number | null
          team_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_downstream_attribution_event_source_progress_id_fkey"
            columns: ["source_progress_id"]
            isOneToOne: false
            referencedRelation: "active_flow_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_event_source_snapshot_id_fkey"
            columns: ["source_snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_artifact_slot_id_fkey"
            columns: ["artifact_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_relay_artifact_id_fkey"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_relay_artifact_id_fkey"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_relay_id_fkey"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_replay_session_id_fkey"
            columns: ["replay_session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_slots: {
        Row: {
          category_constraint: string | null
          created_at: string
          eligible_venue_ids: string[] | null
          exact_venue_id: string | null
          id: string
          label: string
          prompt: string | null
          relay_id: string
          required_geo_verified: boolean
          selection_mode: string
          slot_index: number
          updated_at: string
        }
        Insert: {
          category_constraint?: string | null
          created_at?: string
          eligible_venue_ids?: string[] | null
          exact_venue_id?: string | null
          id?: string
          label: string
          prompt?: string | null
          relay_id: string
          required_geo_verified?: boolean
          selection_mode: string
          slot_index: number
          updated_at?: string
        }
        Update: {
          category_constraint?: string | null
          created_at?: string
          eligible_venue_ids?: string[] | null
          exact_venue_id?: string | null
          id?: string
          label?: string
          prompt?: string | null
          relay_id?: string
          required_geo_verified?: boolean
          selection_mode?: string
          slot_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_slots_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_team_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          member_status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          member_status?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          member_status?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_team_members_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_team_members_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_team_members_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_team_slots: {
        Row: {
          assigned_user_id: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          flow_session_id: string | null
          geo_verified: boolean
          id: string
          relay_slot_id: string
          slot_index: number
          status: string
          team_id: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          flow_session_id?: string | null
          geo_verified?: boolean
          id?: string
          relay_slot_id: string
          slot_index: number
          status?: string
          team_id: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          flow_session_id?: string | null
          geo_verified?: boolean
          id?: string
          relay_slot_id?: string
          slot_index?: number
          status?: string
          team_id?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_team_slots_flow_session_fk"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_team_slots_relay_slot_fk"
            columns: ["relay_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_team_slots_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_team_slots_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_team_slots_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_teams: {
        Row: {
          captain_user_id: string
          completed_at: string | null
          created_at: string
          id: string
          opted_in_at: string | null
          relay_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          captain_user_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          opted_in_at?: string | null
          relay_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          captain_user_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          opted_in_at?: string | null
          relay_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_teams_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relays: {
        Row: {
          city: string
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          execution_mode: string
          id: string
          max_team_size: number
          maximum_team_size: number
          min_team_size: number
          minimum_team_size: number
          partner_campaign_id: string | null
          starts_at: string | null
          status: string
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          execution_mode?: string
          id?: string
          max_team_size?: number
          maximum_team_size?: number
          min_team_size?: number
          minimum_team_size?: number
          partner_campaign_id?: string | null
          starts_at?: string | null
          status?: string
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          execution_mode?: string
          id?: string
          max_team_size?: number
          maximum_team_size?: number
          min_team_size?: number
          minimum_team_size?: number
          partner_campaign_id?: string | null
          starts_at?: string | null
          status?: string
          theme?: string | null
          title?: string
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
      social_group_event_attendee_activity: {
        Row: {
          after_venue_1_at: string | null
          after_venue_1_id: string | null
          after_venue_2_at: string | null
          after_venue_2_id: string | null
          after_window_end: string | null
          attendance_at: string
          attendance_source: string
          before_venue_1_at: string | null
          before_venue_1_id: string | null
          before_venue_2_at: string | null
          before_venue_2_id: string | null
          before_window_start: string | null
          calculated_at: string
          calculation_version: number
          created_at: string
          event_checkin_at: string | null
          event_end: string | null
          event_id: string
          event_start: string | null
          event_timezone: string | null
          event_venue_id: string | null
          event_venue_visit_at: string | null
          had_after_movement: boolean | null
          had_before_and_after_movement: boolean | null
          had_before_movement: boolean | null
          id: string
          is_first_time_group_attendee: boolean
          is_repeat_group_attendee: boolean
          roam_flow_completions: number
          roam_flow_starts: number
          roam_flow_venue_stops: number
          social_group_id: string
          updated_at: string
          user_id: string
          xp_generated: number
        }
        Insert: {
          after_venue_1_at?: string | null
          after_venue_1_id?: string | null
          after_venue_2_at?: string | null
          after_venue_2_id?: string | null
          after_window_end?: string | null
          attendance_at: string
          attendance_source: string
          before_venue_1_at?: string | null
          before_venue_1_id?: string | null
          before_venue_2_at?: string | null
          before_venue_2_id?: string | null
          before_window_start?: string | null
          calculated_at?: string
          calculation_version?: number
          created_at?: string
          event_checkin_at?: string | null
          event_end?: string | null
          event_id: string
          event_start?: string | null
          event_timezone?: string | null
          event_venue_id?: string | null
          event_venue_visit_at?: string | null
          had_after_movement?: boolean | null
          had_before_and_after_movement?: boolean | null
          had_before_movement?: boolean | null
          id?: string
          is_first_time_group_attendee?: boolean
          is_repeat_group_attendee?: boolean
          roam_flow_completions?: number
          roam_flow_starts?: number
          roam_flow_venue_stops?: number
          social_group_id: string
          updated_at?: string
          user_id: string
          xp_generated?: number
        }
        Update: {
          after_venue_1_at?: string | null
          after_venue_1_id?: string | null
          after_venue_2_at?: string | null
          after_venue_2_id?: string | null
          after_window_end?: string | null
          attendance_at?: string
          attendance_source?: string
          before_venue_1_at?: string | null
          before_venue_1_id?: string | null
          before_venue_2_at?: string | null
          before_venue_2_id?: string | null
          before_window_start?: string | null
          calculated_at?: string
          calculation_version?: number
          created_at?: string
          event_checkin_at?: string | null
          event_end?: string | null
          event_id?: string
          event_start?: string | null
          event_timezone?: string | null
          event_venue_id?: string | null
          event_venue_visit_at?: string | null
          had_after_movement?: boolean | null
          had_before_and_after_movement?: boolean | null
          had_before_movement?: boolean | null
          id?: string
          is_first_time_group_attendee?: boolean
          is_repeat_group_attendee?: boolean
          roam_flow_completions?: number
          roam_flow_starts?: number
          roam_flow_venue_stops?: number
          social_group_id?: string
          updated_at?: string
          user_id?: string
          xp_generated?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_group_event_attendee_activity_after_venue_1_id_fkey"
            columns: ["after_venue_1_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_after_venue_1_id_fkey"
            columns: ["after_venue_1_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_after_venue_2_id_fkey"
            columns: ["after_venue_2_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_after_venue_2_id_fkey"
            columns: ["after_venue_2_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_before_venue_1_id_fkey"
            columns: ["before_venue_1_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_before_venue_1_id_fkey"
            columns: ["before_venue_1_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_before_venue_2_id_fkey"
            columns: ["before_venue_2_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_before_venue_2_id_fkey"
            columns: ["before_venue_2_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_event_venue_id_fkey"
            columns: ["event_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_event_venue_id_fkey"
            columns: ["event_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_attendee_activity_social_group_id_fkey"
            columns: ["social_group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      social_group_event_metrics: {
        Row: {
          after_venue_visit_count: number
          after_venue_visitors: number
          after_window_end: string | null
          before_venue_visit_count: number
          before_venue_visitors: number
          before_window_start: string | null
          both_before_and_after: number
          both_checkin_and_venue_visit: number
          calculated_at: string
          calculation_version: number
          created_at: string
          event_end: string | null
          event_id: string
          event_start: string | null
          event_timezone: string | null
          explicit_event_checkins: number
          first_time_group_attendees: number
          flow_completions: number
          flow_starts: number
          flow_venue_stops: number
          id: string
          interested_users: number
          outing_planner_opens: number
          repeat_group_attendees: number
          social_group_id: string
          ticket_clicks: number
          unique_attendees: number
          updated_at: string
          venue_id: string | null
          venue_only_attendees: number
          xp_generated: number
        }
        Insert: {
          after_venue_visit_count?: number
          after_venue_visitors?: number
          after_window_end?: string | null
          before_venue_visit_count?: number
          before_venue_visitors?: number
          before_window_start?: string | null
          both_before_and_after?: number
          both_checkin_and_venue_visit?: number
          calculated_at?: string
          calculation_version?: number
          created_at?: string
          event_end?: string | null
          event_id: string
          event_start?: string | null
          event_timezone?: string | null
          explicit_event_checkins?: number
          first_time_group_attendees?: number
          flow_completions?: number
          flow_starts?: number
          flow_venue_stops?: number
          id?: string
          interested_users?: number
          outing_planner_opens?: number
          repeat_group_attendees?: number
          social_group_id: string
          ticket_clicks?: number
          unique_attendees?: number
          updated_at?: string
          venue_id?: string | null
          venue_only_attendees?: number
          xp_generated?: number
        }
        Update: {
          after_venue_visit_count?: number
          after_venue_visitors?: number
          after_window_end?: string | null
          before_venue_visit_count?: number
          before_venue_visitors?: number
          before_window_start?: string | null
          both_before_and_after?: number
          both_checkin_and_venue_visit?: number
          calculated_at?: string
          calculation_version?: number
          created_at?: string
          event_end?: string | null
          event_id?: string
          event_start?: string | null
          event_timezone?: string | null
          explicit_event_checkins?: number
          first_time_group_attendees?: number
          flow_completions?: number
          flow_starts?: number
          flow_venue_stops?: number
          id?: string
          interested_users?: number
          outing_planner_opens?: number
          repeat_group_attendees?: number
          social_group_id?: string
          ticket_clicks?: number
          unique_attendees?: number
          updated_at?: string
          venue_id?: string | null
          venue_only_attendees?: number
          xp_generated?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_group_event_metrics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_metrics_social_group_id_fkey"
            columns: ["social_group_id"]
            isOneToOne: false
            referencedRelation: "social_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_group_event_metrics_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "social_group_event_metrics_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
          rating: number | null
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
          rating?: number | null
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
          rating?: number | null
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
      competition_relay_confidence: {
        Row: {
          comparative_confidence: number | null
          competition_id: string | null
          competition_relay_entry_id: string | null
          cross_completer_count: number | null
          execution_confidence: number | null
          overall_confidence: number | null
          qualified_completion_count: number | null
          rating_confidence: number | null
          rating_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_cross_completer_counts: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          cross_completer_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_cross_completers: {
        Row: {
          competition_id: string | null
          completed_competition_relay_entry_ids: string[] | null
          completed_contender_count: number | null
          replay_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_execution_funnel_audit: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          first_full_route_completion_at: string | null
          full_route_completer_count: number | null
          latest_full_route_completion_at: string | null
          qualified_starter_count: number | null
          relay_artifact_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_full_route_completer_counts: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          first_full_route_completion_at: string | null
          full_route_completer_count: number | null
          latest_full_route_completion_at: string | null
          relay_artifact_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_full_route_completers: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          completed_session_count: number | null
          first_full_completion_at: string | null
          latest_full_completion_at: string | null
          relay_artifact_id: string | null
          replay_user_id: string | null
          snapshot_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_head_to_head_aggregates: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          head_to_head_losses: number | null
          head_to_head_preference_rate: number | null
          head_to_head_sample_count: number | null
          head_to_head_wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_live_scores: {
        Row: {
          average_rating: number | null
          comparative_confidence: number | null
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          cross_completer_count: number | null
          evidence_score: number | null
          execution_confidence: number | null
          final_score: number | null
          head_to_head_losses: number | null
          head_to_head_preference_rate: number | null
          head_to_head_sample_count: number | null
          head_to_head_score: number | null
          head_to_head_weight: number | null
          head_to_head_wins: number | null
          overall_confidence: number | null
          qualified_completion_count: number | null
          qualified_completion_score: number | null
          qualified_completion_weight: number | null
          rating_confidence: number | null
          rating_count: number | null
          rating_score: number | null
          rating_weight: number | null
          relay_artifact_id: string | null
          route_completion_rate: number | null
          route_completion_rate_score: number | null
          route_completion_rate_weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_qualified_starter_audit: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          first_qualified_starter_at: string | null
          latest_qualified_starter_at: string | null
          qualified_starter_count: number | null
          relay_artifact_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_qualified_starter_counts: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          first_qualified_starter_at: string | null
          latest_qualified_starter_at: string | null
          qualified_starter_count: number | null
          relay_artifact_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_qualified_starters: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          first_qualified_at: string | null
          qualifying_session_count: number | null
          relay_artifact_id: string | null
          replay_user_id: string | null
          snapshot_id: string | null
          verified_stop_event_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_rating_aggregates: {
        Row: {
          average_rating: number | null
          competition_id: string | null
          competition_relay_entry_id: string | null
          rating_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_route_completion_rate_audit: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          first_full_route_completion_at: string | null
          first_qualified_starter_at: string | null
          full_route_completer_count: number | null
          latest_full_route_completion_at: string | null
          latest_qualified_starter_at: string | null
          qualified_starter_count: number | null
          relay_artifact_id: string | null
          route_completion_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_route_completion_rate_states: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          completion_rate_state: string | null
          contender_slot: number | null
          full_route_completer_count: number | null
          qualified_starter_count: number | null
          relay_artifact_id: string | null
          route_completion_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_route_completion_rates: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          first_full_route_completion_at: string | null
          first_qualified_starter_at: string | null
          full_route_completer_count: number | null
          latest_full_route_completion_at: string | null
          latest_qualified_starter_at: string | null
          qualified_starter_count: number | null
          relay_artifact_id: string | null
          route_completion_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_scoring_components: {
        Row: {
          average_rating: number | null
          comparative_confidence: number | null
          competition_id: string | null
          competition_relay_entry_id: string | null
          contender_slot: number | null
          cross_completer_count: number | null
          execution_confidence: number | null
          head_to_head_losses: number | null
          head_to_head_preference_rate: number | null
          head_to_head_sample_count: number | null
          head_to_head_score: number | null
          head_to_head_weight: number | null
          head_to_head_wins: number | null
          overall_confidence: number | null
          qualified_completion_count: number | null
          qualified_completion_score: number | null
          qualified_completion_weight: number | null
          rating_confidence: number | null
          rating_count: number | null
          rating_score: number | null
          rating_weight: number | null
          relay_artifact_id: string | null
          route_completion_rate: number | null
          route_completion_rate_score: number | null
          route_completion_rate_weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
        ]
      }
      competition_relay_scoring_entries: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          competition_relay_id: string | null
          contender_slot: number | null
          public_flow_snapshot_id: string | null
          relay_artifact_id: string | null
          relay_completed_at: string | null
          relay_entry_mode: string | null
          relay_team_id: string | null
          scoring_eligible_at: string | null
          venue_ids: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_entries_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_relay_team_fk"
            columns: ["relay_team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_relay_team_fk"
            columns: ["relay_team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_relay_team_fk"
            columns: ["relay_team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_relay_id_fk"
            columns: ["competition_relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_verified_execution_evidence: {
        Row: {
          competition_id: string | null
          competition_relay_entry_id: string | null
          created_at: string | null
          event_type: string | null
          id: string | null
          occurred_at: string | null
          relay_artifact_id: string | null
          replay_user_id: string | null
          session_id: string | null
          snapshot_id: string | null
          stop_index: number | null
          venue_id: string | null
        }
        Insert: {
          competition_id?: string | null
          competition_relay_entry_id?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string | null
          occurred_at?: string | null
          relay_artifact_id?: string | null
          replay_user_id?: string | null
          session_id?: string | null
          snapshot_id?: string | null
          stop_index?: number | null
          venue_id?: string | null
        }
        Update: {
          competition_id?: string | null
          competition_relay_entry_id?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string | null
          occurred_at?: string | null
          relay_artifact_id?: string | null
          replay_user_id?: string | null
          session_id?: string | null
          snapshot_id?: string | null
          stop_index?: number | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_session_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_venue_fk"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_rsvps_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "competition_relay_execution_events_venue_fk"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_relay_verified_replay_sessions: {
        Row: {
          attributed_at: string | null
          competition_id: string | null
          competition_relay_entry_id: string | null
          relay_artifact_id: string | null
          replay_user_id: string | null
          route_completed: boolean | null
          session_id: string | null
          snapshot_id: string | null
          verified_stop_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_replay_sessions_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_competition_fk"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_winner_xp_audit"
            referencedColumns: ["competition_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_entry_fk"
            columns: ["competition_relay_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_session_fk"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_relay_replay_sessions_snapshot_fk"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "flow_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_replay_attribution_totals: {
        Row: {
          completed_replayed_flows: number | null
          creator_user_id: string | null
          first_replay_attribution_at: string | null
          latest_replay_attribution_at: string | null
          replayed_flow_stops: number | null
          replayed_snapshot_count: number | null
          unique_replay_users: number | null
        }
        Relationships: []
      }
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
      roam_relay_artifact_authorship: {
        Row: {
          artifact_completed_at: string | null
          artifact_id: string | null
          artifact_title: string | null
          checked_in_at: string | null
          city: string | null
          contributor_user_id: string | null
          flow_session_id: string | null
          public_flow_snapshot_id: string | null
          relay_id: string | null
          relay_slot_id: string | null
          slot_completed_at: string | null
          slot_index: number | null
          slot_label: string | null
          slot_prompt: string | null
          team_id: string | null
          venue_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_artifact_slots_flow_session_fk"
            columns: ["flow_session_id"]
            isOneToOne: false
            referencedRelation: "active_flow_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifact_slots_relay_slot_fk"
            columns: ["relay_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_team_fk"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_team_fk"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_artifacts_team_fk"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_downstream_attribution_audit: {
        Row: {
          artifact_slot_id: string | null
          contributor_user_id: string | null
          first_attributed_at: string | null
          latest_attributed_at: string | null
          relay_artifact_id: string | null
          relay_completed_event_count: number | null
          relay_id: string | null
          team_id: string | null
          unique_relay_completers: number | null
          unique_verified_stop_executors: number | null
          verified_stop_event_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_artifact_slot_id_fkey"
            columns: ["artifact_slot_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_relay_artifact_id_fkey"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_relay_artifact_id_fkey"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_relay_id_fkey"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_reconciliation_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_team_transaction_audit"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "roam_relay_downstream_attribution_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_integrity_violations: {
        Row: {
          details: Json | null
          team_id: string | null
          team_slot_id: string | null
          user_id: string | null
          violation_type: string | null
        }
        Relationships: []
      }
      roam_relay_reconciliation_audit: {
        Row: {
          active_slot_count: number | null
          completed_slot_count: number | null
          contains_skipped_slot: boolean | null
          locked_slot_count: number | null
          reconciliation_state: string | null
          relay_id: string | null
          team_id: string | null
          team_status: string | null
          total_slot_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_teams_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_team_transaction_audit: {
        Row: {
          active_slot_count: number | null
          assigned_slot_count: number | null
          captain_user_id: string | null
          completed_slot_count: number | null
          distinct_assigned_user_count: number | null
          invited_member_count: number | null
          joined_member_count: number | null
          relay_id: string | null
          slot_count: number | null
          team_id: string | null
          team_status: string | null
          transaction_state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roam_relay_teams_relay_fk"
            columns: ["relay_id"]
            isOneToOne: false
            referencedRelation: "roam_relays"
            referencedColumns: ["id"]
          },
        ]
      }
      roam_relay_winner_xp_audit: {
        Row: {
          awarded_winner_count: number | null
          canonical_winner_count: number | null
          competition_id: string | null
          competition_status: string | null
          relay_artifact_id: string | null
          relay_reward_mode: string | null
          relay_winner_entry_id: string | null
          result_status: string | null
          reward_state: string | null
          total_awarded_xp: number | null
          xp_reward: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifact_authorship"
            referencedColumns: ["artifact_id"]
          },
          {
            foreignKeyName: "competition_relay_entries_artifact_fk"
            columns: ["relay_artifact_id"]
            isOneToOne: false
            referencedRelation: "roam_relay_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_confidence"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_cross_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_execution_funnel_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_full_route_completer_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_head_to_head_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_live_scores"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_qualified_starter_counts"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_rating_aggregates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_audit"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rate_states"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_route_completion_rates"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_components"
            referencedColumns: ["competition_relay_entry_id"]
          },
          {
            foreignKeyName: "competitions_relay_winner_entry_id_fkey"
            columns: ["relay_winner_entry_id"]
            isOneToOne: false
            referencedRelation: "competition_relay_scoring_entries"
            referencedColumns: ["competition_relay_entry_id"]
          },
        ]
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
      admin_create_roam_relay: {
        Args: { p_definition: Json; p_slots: Json }
        Returns: string
      }
      admin_save_roam_relay: {
        Args: { p_definition: Json; p_relay_id: string; p_slots: Json }
        Returns: string
      }
      anonymize_profile: { Args: { target_user: string }; Returns: undefined }
      assign_roam_relay_team_slot: {
        Args: { p_relay_slot_id: string; p_team_id: string; p_user_id: string }
        Returns: {
          assigned_user_id: string
          changed: boolean
          relay_slot_id: string
          slot_index: number
          slot_status: string
          team_id: string
          team_slot_id: string
        }[]
      }
      assign_roam_relay_team_slots: {
        Args: { p_assignments: Json; p_team_id: string }
        Returns: undefined
      }
      award_roam_relay_competition_winner_xp: {
        Args: { p_competition_id: string }
        Returns: {
          awarded: boolean
          competition_id: string
          relay_winner_entry_id: string
          reward_mode: string
          winner_user_id: string
          xp_amount: number
        }[]
      }
      can_read_roam_relay_team_members: {
        Args: { p_team_id: string }
        Returns: boolean
      }
      competition_allows_identity_reveal: {
        Args: { p_competition_id: string }
        Returns: boolean
      }
      complete_roam_relay_slot: {
        Args: {
          p_flow_session_id: string
          p_team_slot_id: string
          p_venue_id: string
        }
        Returns: {
          assigned_user_id: string
          checked_in_at: string
          completed_at: string
          flow_session_id: string
          geo_verified: boolean
          relay_id: string
          relay_slot_id: string
          slot_index: number
          slot_status: string
          team_id: string
          team_slot_id: string
          venue_id: string
        }[]
      }
      create_roam_relay_definition: {
        Args: {
          p_city?: string
          p_description?: string
          p_ends_at?: string
          p_max_team_size?: number
          p_min_team_size?: number
          p_reward_mode?: string
          p_starts_at?: string
          p_theme?: string
          p_title: string
          p_visibility?: string
          p_xp_reward?: number
        }
        Returns: string
      }
      create_roam_relay_team: {
        Args: { p_relay_id: string }
        Returns: {
          captain_user_id: string
          created: boolean
          relay_id: string
          team_id: string
          team_status: string
        }[]
      }
      decline_roam_relay_team_invitation: {
        Args: { p_team_id: string }
        Returns: {
          changed: boolean
          member_status: string
          team_id: string
          user_id: string
        }[]
      }
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
      finalize_roam_relay_team: {
        Args: { p_team_id: string }
        Returns: {
          active_slot_count: number
          completed_slot_count: number
          fully_completed: boolean
          team_id: string
          team_status: string
          total_slot_count: number
        }[]
      }
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
      get_public_roam_relay_competition_contributors: {
        Args: { p_competition_id: string }
        Returns: {
          checked_in_at: string
          competition_relay_entry_id: string
          completed_at: string
          contender_slot: number
          contributor_user_id: string
          slot_index: number
          slot_label: string
          team_label: string
          venue_id: string
        }[]
      }
      get_public_roam_relay_competition_entries: {
        Args: { p_competition_id: string }
        Returns: {
          competition_relay_entry_id: string
          contender_slot: number
          entry_status: string
          identities_revealed: boolean
          relay_completed_at: string
          replayable_snapshot_id: string
          route_state: Json
          team_label: string
          team_status: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      initialize_roam_relay_team_slots: {
        Args: { p_team_id: string }
        Returns: {
          assigned_user_id: string | null
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          flow_session_id: string | null
          geo_verified: boolean
          id: string
          relay_slot_id: string
          slot_index: number
          status: string
          team_id: string
          updated_at: string
          venue_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "roam_relay_team_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      invite_roam_relay_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: {
          created: boolean
          invited_user_id: string
          member_status: string
          team_id: string
        }[]
      }
      join_crawl: { Args: { input_crawl_id: string }; Returns: undefined }
      join_roam_relay_team: {
        Args: { p_team_id: string }
        Returns: {
          joined: boolean
          member_status: string
          team_id: string
          user_id: string
        }[]
      }
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
      materialize_roam_relay_artifact: {
        Args: { p_team_id: string }
        Returns: {
          artifact_id: string
          created: boolean
          public_flow_snapshot_id: string
        }[]
      }
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
      publish_roam_relay: { Args: { p_relay_id: string }; Returns: string }
      rebuild_venue_reputation_categories: { Args: never; Returns: number }
      reconcile_competition_relay_replay_evidence: {
        Args: { p_replay_user_id: string; p_session_id: string }
        Returns: undefined
      }
      reconcile_roam_relay_downstream_attribution: {
        Args: { p_session_id: string }
        Returns: {
          inserted_relay_completed_events: number
          inserted_verified_stop_events: number
        }[]
      }
      reconcile_roam_relay_team: {
        Args: { p_team_id: string }
        Returns: {
          active_slot_count: number
          completed_slot_count: number
          repaired: boolean
          team_id: string
          team_status: string
          total_slot_count: number
        }[]
      }
      reconcile_roam_relay_team_slot: {
        Args: { p_team_slot_id: string }
        Returns: {
          canonical_evidence_found: boolean
          repaired: boolean
          slot_index: number
          slot_status: string
          team_id: string
          team_slot_id: string
          team_status: string
        }[]
      }
      record_creator_replay_completion: {
        Args: { p_session_id: string }
        Returns: {
          attributed: boolean
          creator_user_id: string
          event_id: string
          occurred_at: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
        }[]
      }
      record_creator_replay_stop: {
        Args: { p_session_id: string; p_stop_index: number }
        Returns: {
          attributed: boolean
          creator_user_id: string
          event_id: string
          occurred_at: string
          replay_user_id: string
          session_id: string
          snapshot_id: string
          stop_index: number
          venue_id: string
        }[]
      }
      refresh_social_group_event_metrics: {
        Args: { target_event_id: string }
        Returns: Json
      }
      relay_authoring_is_venue_admin: { Args: never; Returns: boolean }
      remove_roam_relay_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: undefined
      }
      roam_city_timezone: { Args: { city_value: string }; Returns: string }
      roam_relay_flow_snapshot_identity_embargoed: {
        Args: { p_snapshot_id: string }
        Returns: boolean
      }
      roam_relay_team_identity_embargoed: {
        Args: { p_team_id: string }
        Returns: boolean
      }
      roam_relay_valid_venue_id_array: {
        Args: { p_values: string[] }
        Returns: boolean
      }
      roam_relay_venue_matches_category: {
        Args: { p_category_constraint: string; p_venue_id: string }
        Returns: boolean
      }
      save_roam_relay_template: {
        Args: { p_relay_id: string; p_slots: Json }
        Returns: string
      }
      set_roam_relay_competition_winner_and_award_xp: {
        Args: { p_competition_id: string; p_relay_winner_entry_id: string }
        Returns: {
          awarded: boolean
          competition_id: string
          relay_winner_entry_id: string
          reward_mode: string
          winner_user_id: string
          xp_amount: number
        }[]
      }
      set_roam_relay_team_ready: {
        Args: { p_team_id: string }
        Returns: {
          changed: boolean
          joined_member_count: number
          relay_id: string
          slot_count: number
          team_id: string
          team_status: string
        }[]
      }
      settle_competition_from_snapshots: {
        Args: {
          p_algorithm_version: string
          p_competition_id: string
          p_result_status: string
          p_settled_by: string
          p_snapshot_ids: string[]
          p_winner_entry_id: string
        }
        Returns: {
          competition_id: string
          result_status: string
          settled_at: string
          winner_entry_id: string
          winner_user_id: string
        }[]
      }
      snapshot_roam_relay_competition_scores: {
        Args: { p_competition_id: string }
        Returns: {
          average_rating: number | null
          comparative_confidence: number
          competition_id: string
          competition_relay_entry_id: string
          contender_slot: number
          created_at: string
          cross_completer_count: number
          evidence_score: number
          execution_confidence: number
          final_score: number
          head_to_head_losses: number
          head_to_head_preference_rate: number | null
          head_to_head_sample_count: number
          head_to_head_score: number
          head_to_head_weight: number
          head_to_head_wins: number
          id: string
          overall_confidence: number
          qualified_completion_count: number
          qualified_completion_score: number
          qualified_completion_weight: number
          qualified_starter_count: number
          rating_confidence: number
          rating_count: number
          rating_score: number
          rating_weight: number
          relay_artifact_id: string
          route_completion_rate: number | null
          route_completion_rate_score: number
          route_completion_rate_weight: number
          snapshot_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "competition_relay_entry_score_snapshots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      start_competition_entry_flow: {
        Args: { p_competition_entry_id: string; p_competition_id: string }
        Returns: {
          competition_entry_id: string
          competition_id: string
          created: boolean
          flow_city: string
          flow_completed_at: string
          flow_session_id: string
          flow_started_at: string
          flow_status: string
          flow_title: string
          flow_venue_ids: string[]
          participation_completed_at: string
          participation_id: string
          participation_started_at: string
          qualified: boolean
          total_stop_count: number
          user_id: string
          verified_stop_count: number
        }[]
      }
      start_roam_relay_slot_flow: {
        Args: { p_team_slot_id: string; p_venue_id: string }
        Returns: {
          assigned_user_id: string
          competition_safe_team_slot_id: string
          created: boolean
          flow_city: string
          flow_session_id: string
          flow_source: string
          flow_source_id: string
          flow_started_at: string
          flow_status: string
          flow_title: string
          flow_venue_ids: string[]
          relay_id: string
          relay_slot_id: string
          slot_index: number
          team_id: string
        }[]
      }
      start_roam_relay_team: {
        Args: { p_team_id: string }
        Returns: {
          active_relay_slot_id: string
          active_slot_index: number
          active_team_slot_id: string
          assigned_user_id: string
          opted_in_at: string
          relay_id: string
          started_at: string
          team_id: string
          team_status: string
        }[]
      }
      sync_venue_reputation_categories: {
        Args: { target_venue_id: string }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_roam_relay_definition: {
        Args: {
          p_city: string
          p_description: string
          p_ends_at: string
          p_max_team_size: number
          p_min_team_size: number
          p_relay_id: string
          p_reward_mode: string
          p_starts_at: string
          p_theme: string
          p_title: string
          p_visibility: string
          p_xp_reward: number
        }
        Returns: string
      }
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
      validate_competition_relay_execution_funnel: {
        Args: { p_competition_relay_entry_id: string }
        Returns: boolean
      }
      validate_competition_relay_full_completers_are_starters: {
        Args: { p_competition_relay_entry_id: string }
        Returns: boolean
      }
      validate_competition_relay_full_route_completer_count: {
        Args: { p_competition_relay_entry_id: string }
        Returns: boolean
      }
      validate_competition_relay_qualified_starter_count: {
        Args: { p_competition_relay_entry_id: string }
        Returns: boolean
      }
      validate_competition_relay_route_completion_rate: {
        Args: { p_competition_relay_entry_id: string }
        Returns: boolean
      }
      validate_competition_relay_route_completion_rates: {
        Args: { p_competition_id: string }
        Returns: boolean
      }
      validate_completed_roam_relay_artifact_authorship: {
        Args: { p_artifact_id: string }
        Returns: boolean
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