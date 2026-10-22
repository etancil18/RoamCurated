
-- Forward-only Snapshot Replay check-in attestations.
--
-- PREPARATION ONLY: do not execute against production
-- until the server writer, attribution enforcement,
-- compatibility checks, and rollback are coordinated.
--
-- This table is separate from:
--   active_flow_progress
--   creator_collection_checkin_attestations
--   creator_replay_events
--
-- Ordinary authenticated users receive no direct access.

CREATE TABLE public.creator_replay_checkin_attestations (
  id uuid PRIMARY KEY
    DEFAULT gen_random_uuid(),

  session_id uuid NOT NULL
    REFERENCES public.active_flow_sessions(id)
    ON DELETE CASCADE,

  replay_user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  snapshot_id uuid NOT NULL
    REFERENCES public.flow_snapshots(id)
    ON DELETE CASCADE,

  snapshot_stop_id uuid NOT NULL
    REFERENCES public.flow_snapshot_stops(id)
    ON DELETE CASCADE,

  flow_stop_id uuid NOT NULL
    REFERENCES public.active_flow_stops(id)
    ON DELETE CASCADE,

  progress_id uuid NOT NULL,

  venue_visit_id uuid NOT NULL,

  stop_index integer NOT NULL
    CHECK (stop_index >= 0),

  -- Must match the text representation used by
  -- active_flow_progress and active_flow_stops.
  venue_id text NOT NULL
    CHECK (length(btrim(venue_id)) > 0),

  verified_at timestamptz NOT NULL,

  created_at timestamptz NOT NULL
    DEFAULT now(),

  CONSTRAINT replay_attestation_session_stop_unique
    UNIQUE (session_id, flow_stop_id),

  CONSTRAINT replay_attestation_snapshot_position_unique
    UNIQUE (session_id, stop_index),

  CONSTRAINT replay_attestation_progress_unique
    UNIQUE (progress_id),

  CONSTRAINT replay_attestation_venue_visit_unique
    UNIQUE (venue_visit_id)
);

CREATE INDEX replay_attestations_completion_lookup_idx
  ON public.creator_replay_checkin_attestations (
    session_id,
    replay_user_id,
    snapshot_id,
    stop_index
  );

ALTER TABLE public.creator_replay_checkin_attestations
  ENABLE ROW LEVEL SECURITY;

-- There are deliberately no authenticated INSERT,
-- UPDATE, DELETE or SELECT policies.
--
-- Do not add a public SECURITY DEFINER function that
-- allows users to create these attestations.

REVOKE ALL
ON public.creator_replay_checkin_attestations
FROM PUBLIC, anon, authenticated;

GRANT ALL
ON public.creator_replay_checkin_attestations
TO service_role;
