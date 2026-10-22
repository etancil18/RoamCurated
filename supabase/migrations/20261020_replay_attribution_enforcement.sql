
-- Forward-only Snapshot Replay attribution enforcement.
--
-- PREPARATION ONLY.
-- DO NOT APPLY TO PRODUCTION YET.
--
-- Prerequisites:
-- 1. creator_replay_checkin_attestations table exists.
-- 2. Trusted server-only Replay attestation writes work.
-- 3. Trusted progress and venue-visit writers have been
--    validated as compatible with the coordinated revocation
--    of direct authenticated evidence writes.
-- 4. Recovery and rollback procedures are approved.
--
-- Historical Replay events are not changed or deleted.
-- Core Flow completion is not modified.

-- ==========================================================
-- Stop attribution
-- ==========================================================

CREATE OR REPLACE FUNCTION public.record_creator_replay_stop(
  p_session_id uuid,
  p_stop_index integer
)
RETURNS TABLE(
  attributed boolean,
  event_id uuid,
  creator_user_id uuid,
  replay_user_id uuid,
  snapshot_id uuid,
  session_id uuid,
  stop_index integer,
  venue_id uuid,
  occurred_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_authenticated_user_id uuid;

  v_snapshot_id uuid;
  v_creator_user_id uuid;

  v_snapshot_owner_id uuid;
  v_snapshot_source_type text;
  v_snapshot_visibility text;
  v_snapshot_replayable boolean;
  v_snapshot_status text;

  v_venue_id uuid;
  v_checked_in_at timestamptz;

  v_event_id uuid;
  v_event_occurred_at timestamptz;

  v_rows_inserted integer;
begin
  -- Authentication.

  v_authenticated_user_id := auth.uid();

  if v_authenticated_user_id is null then
    raise exception
      'Authentication required.'
      using errcode = '42501';
  end if;

  if p_session_id is null then
    raise exception
      'Replay session ID is required.'
      using errcode = '22023';
  end if;

  if (
    p_stop_index is null
    or p_stop_index < 0
  ) then
    raise exception
      'Replay stop index is invalid.'
      using errcode = '22023';
  end if;

  -- Resolve authenticated Replay provenance.

  select
    fs.id,
    afs.source_creator_user_id,
    fs.user_id,
    fs.source_type,
    fs.visibility,
    fs.replayable,
    fs.status
  into
    v_snapshot_id,
    v_creator_user_id,
    v_snapshot_owner_id,
    v_snapshot_source_type,
    v_snapshot_visibility,
    v_snapshot_replayable,
    v_snapshot_status
  from public.active_flow_sessions as afs
  join public.flow_snapshots as fs
    on fs.id::text = afs.source_id::text
  where afs.id = p_session_id
    and afs.user_id = v_authenticated_user_id
    and afs.source = 'flow_snapshot'
  limit 1;

  if v_snapshot_id is null then
    raise exception
      'Canonical replay session was not found.'
      using errcode = 'P0001';
  end if;

  -- Roam Relay remains an intentional zero-credit no-op.

  if v_snapshot_source_type = 'roam_relay' then
    return query
    select
      false,
      null::uuid,
      null::uuid,
      v_authenticated_user_id,
      v_snapshot_id,
      p_session_id,
      p_stop_index,
      null::uuid,
      null::timestamptz;

    return;
  end if;

  -- Creator identity consistency.

  if (
    v_creator_user_id is null
    or v_snapshot_owner_id is null
    or v_creator_user_id <> v_snapshot_owner_id
  ) then
    raise exception
      'Replay creator attribution is inconsistent.'
      using errcode = 'P0001';
  end if;

  -- Self-replay remains a zero-credit no-op.

  if v_creator_user_id = v_authenticated_user_id then
    return query
    select
      false,
      null::uuid,
      v_creator_user_id,
      v_authenticated_user_id,
      v_snapshot_id,
      p_session_id,
      p_stop_index,
      null::uuid,
      null::timestamptz;

    return;
  end if;

  -- Source eligibility.

  if v_snapshot_visibility <> 'public' then
    raise exception
      'Replay snapshot is not public.'
      using errcode = 'P0001';
  end if;

  if v_snapshot_replayable is not true then
    raise exception
      'Replay is not enabled for this snapshot.'
      using errcode = 'P0001';
  end if;

  if v_snapshot_status <> 'completed' then
    raise exception
      'Replay source snapshot is not completed.'
      using errcode = 'P0001';
  end if;

  -- Resolve immutable snapshot stop.

  select
    fss.venue_id
  into
    v_venue_id
  from public.flow_snapshot_stops as fss
  where fss.snapshot_id = v_snapshot_id
    and fss.stop_index = p_stop_index
  limit 1;

  if v_venue_id is null then
    raise exception
      'Canonical snapshot stop was not found.'
      using errcode = 'P0001';
  end if;

  -- --------------------------------------------------------
  -- SECURITY ENFORCEMENT:
  --
  -- Require the exact immutable snapshot stop, executable
  -- Flow stop, progress row and venue visit to be joined
  -- through protected server-created attestation evidence.
  --
  -- Text venue IDs are explicitly compared against UUID
  -- venue IDs using ::text.
  --
  -- No attestation means no new creator credit.
  -- --------------------------------------------------------

  select
    afp.checked_in_at
  into
    v_checked_in_at
  from public.active_flow_progress as afp
  join public.creator_replay_checkin_attestations as att
    on att.progress_id = afp.id
    and att.session_id = afp.session_id
    and att.replay_user_id = afp.user_id
    and att.flow_stop_id = afp.flow_stop_id
    and att.stop_index = afp.stop_index
    and att.venue_id = afp.venue_id
    and att.verified_at = afp.checked_in_at
  join public.flow_snapshot_stops as fss
    on fss.id = att.snapshot_stop_id
    and fss.snapshot_id = att.snapshot_id
    and fss.stop_index = att.stop_index
    and fss.venue_id::text = att.venue_id
  join public.active_flow_stops as afs
    on afs.id = att.flow_stop_id
    and afs.session_id = att.session_id
    and afs.position = att.stop_index
    and afs.venue_id = att.venue_id
  join public.venue_visits as vv
    on vv.id = att.venue_visit_id
    and vv.user_id = att.replay_user_id
    and vv.venue_id::text = att.venue_id
    and vv.geo_verified = true
    and vv.check_in_source = 'active_flow'
  where afp.session_id = p_session_id
    and afp.user_id = v_authenticated_user_id
    and afp.stop_index = p_stop_index
    and afp.venue_id = v_venue_id::text
    and afp.geo_verified = true
    and att.snapshot_id = v_snapshot_id
  order by afp.checked_in_at asc
  limit 1;

  if v_checked_in_at is null then
    raise exception
      'Trusted replay stop evidence was not found.'
      using errcode = 'P0001';
  end if;

  -- Original idempotent attribution INSERT.

  insert into public.creator_replay_events (
    creator_user_id,
    replay_user_id,
    snapshot_id,
    session_id,
    event_type,
    stop_index,
    venue_id,
    occurred_at
  )
  values (
    v_creator_user_id,
    v_authenticated_user_id,
    v_snapshot_id,
    p_session_id,
    'replay_stop_completed',
    p_stop_index,
    v_venue_id,
    v_checked_in_at
  )
  on conflict (
    creator_user_id,
    replay_user_id,
    snapshot_id,
    stop_index
  )
  where event_type = 'replay_stop_completed'
  do nothing
  returning
    id,
    creator_replay_events.occurred_at
  into
    v_event_id,
    v_event_occurred_at;

  get diagnostics
    v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select
      cre.id,
      cre.occurred_at
    into
      v_event_id,
      v_event_occurred_at
    from public.creator_replay_events as cre
    where cre.creator_user_id = v_creator_user_id
      and cre.replay_user_id = v_authenticated_user_id
      and cre.snapshot_id = v_snapshot_id
      and cre.event_type = 'replay_stop_completed'
      and cre.stop_index = p_stop_index
    limit 1;
  end if;

  return query
  select
    v_rows_inserted > 0,
    v_event_id,
    v_creator_user_id,
    v_authenticated_user_id,
    v_snapshot_id,
    p_session_id,
    p_stop_index,
    v_venue_id,
    v_event_occurred_at;
end;
$function$;


-- ==========================================================
-- Full-flow attribution
-- ==========================================================

CREATE OR REPLACE FUNCTION public.record_creator_replay_completion(
  p_session_id uuid
)
RETURNS TABLE(
  attributed boolean,
  event_id uuid,
  creator_user_id uuid,
  replay_user_id uuid,
  snapshot_id uuid,
  session_id uuid,
  occurred_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_authenticated_user_id uuid;

  v_snapshot_id uuid;
  v_creator_user_id uuid;

  v_snapshot_owner_id uuid;
  v_snapshot_source_type text;
  v_snapshot_visibility text;
  v_snapshot_replayable boolean;
  v_snapshot_status text;

  v_session_status text;
  v_completed_at timestamptz;

  v_snapshot_stop_count integer;

  v_event_id uuid;
  v_event_occurred_at timestamptz;

  v_rows_inserted integer;
begin
  -- Authentication.

  v_authenticated_user_id := auth.uid();

  if v_authenticated_user_id is null then
    raise exception
      'Authentication required.'
      using errcode = '42501';
  end if;

  if p_session_id is null then
    raise exception
      'Replay session ID is required.'
      using errcode = '22023';
  end if;

  -- Resolve canonical session and source snapshot.

  select
    fs.id,
    afs.source_creator_user_id,
    fs.user_id,
    fs.source_type,
    fs.visibility,
    fs.replayable,
    fs.status,
    afs.status,
    afs.completed_at
  into
    v_snapshot_id,
    v_creator_user_id,
    v_snapshot_owner_id,
    v_snapshot_source_type,
    v_snapshot_visibility,
    v_snapshot_replayable,
    v_snapshot_status,
    v_session_status,
    v_completed_at
  from public.active_flow_sessions as afs
  join public.flow_snapshots as fs
    on fs.id::text = afs.source_id::text
  where afs.id = p_session_id
    and afs.user_id = v_authenticated_user_id
    and afs.source = 'flow_snapshot'
  limit 1;

  if v_snapshot_id is null then
    raise exception
      'Canonical replay session was not found.'
      using errcode = 'P0001';
  end if;

  -- Preserve Roam Relay zero-credit behavior.

  if v_snapshot_source_type = 'roam_relay' then
    return query
    select
      false,
      null::uuid,
      null::uuid,
      v_authenticated_user_id,
      v_snapshot_id,
      p_session_id,
      null::timestamptz;

    return;
  end if;

  -- Preserve creator identity consistency.

  if (
    v_creator_user_id is null
    or v_snapshot_owner_id is null
    or v_creator_user_id <> v_snapshot_owner_id
  ) then
    raise exception
      'Replay creator attribution is inconsistent.'
      using errcode = 'P0001';
  end if;

  -- Preserve self-replay zero-credit behavior.

  if v_creator_user_id = v_authenticated_user_id then
    return query
    select
      false,
      null::uuid,
      v_creator_user_id,
      v_authenticated_user_id,
      v_snapshot_id,
      p_session_id,
      null::timestamptz;

    return;
  end if;

  -- Source eligibility.

  if v_snapshot_visibility <> 'public' then
    raise exception
      'Replay snapshot is not public.'
      using errcode = 'P0001';
  end if;

  if v_snapshot_replayable is not true then
    raise exception
      'Replay is not enabled for this snapshot.'
      using errcode = 'P0001';
  end if;

  if v_snapshot_status <> 'completed' then
    raise exception
      'Replay source snapshot is not completed.'
      using errcode = 'P0001';
  end if;

  -- Session must already be canonically completed.

  if v_session_status <> 'completed' then
    raise exception
      'Replay session has not been completed.'
      using errcode = 'P0001';
  end if;

  if v_completed_at is null then
    raise exception
      'Replay session completion timestamp is missing.'
      using errcode = 'P0001';
  end if;

  -- Canonical replay route must have at least two stops.

  select
    count(*)::integer
  into
    v_snapshot_stop_count
  from public.flow_snapshot_stops as fss
  where fss.snapshot_id = v_snapshot_id;

  if v_snapshot_stop_count < 2 then
    raise exception
      'Replay snapshot does not contain enough canonical stops.'
      using errcode = 'P0001';
  end if;

  -- --------------------------------------------------------
  -- Existing verified-progress requirement.
  --
  -- Explicit ::text comparison handles the actual schema:
  -- snapshot venue UUID, progress venue text.
  -- --------------------------------------------------------

  if exists (
    select 1
    from public.flow_snapshot_stops as required_stop
    where required_stop.snapshot_id = v_snapshot_id
      and not exists (
        select 1
        from public.active_flow_progress as completed_progress
        where completed_progress.session_id = p_session_id
          and completed_progress.user_id =
            v_authenticated_user_id
          and completed_progress.stop_index =
            required_stop.stop_index
          and completed_progress.venue_id =
            required_stop.venue_id::text
          and completed_progress.geo_verified = true
      )
  ) then
    raise exception
      'Verified replay progress is incomplete.'
      using errcode = 'P0001';
  end if;

  -- Preserve rejection of noncanonical progress.

  if exists (
    select 1
    from public.active_flow_progress as progress
    where progress.session_id = p_session_id
      and progress.user_id = v_authenticated_user_id
      and not exists (
        select 1
        from public.flow_snapshot_stops as canonical_stop
        where canonical_stop.snapshot_id = v_snapshot_id
          and canonical_stop.stop_index =
            progress.stop_index
          and canonical_stop.venue_id::text =
            progress.venue_id
      )
  ) then
    raise exception
      'Replay session contains non-canonical route progress.'
      using errcode = 'P0001';
  end if;

  -- --------------------------------------------------------
  -- SECURITY ENFORCEMENT:
  --
  -- Every immutable snapshot stop must have matching
  -- protected attestation evidence.
  --
  -- All identity relationships must resolve together.
  -- A missing or mismatched attestation prevents new
  -- full-flow creator attribution.
  -- --------------------------------------------------------

  if exists (
    select 1
    from public.flow_snapshot_stops as required_stop
    where required_stop.snapshot_id = v_snapshot_id
      and not exists (
        select 1
        from public.creator_replay_checkin_attestations as att
        join public.active_flow_progress as afp
          on afp.id = att.progress_id
          and afp.session_id = att.session_id
          and afp.user_id = att.replay_user_id
          and afp.flow_stop_id = att.flow_stop_id
          and afp.stop_index = att.stop_index
          and afp.venue_id = att.venue_id
          and afp.checked_in_at = att.verified_at
          and afp.geo_verified = true
        join public.active_flow_stops as afs
          on afs.id = att.flow_stop_id
          and afs.session_id = att.session_id
          and afs.position = att.stop_index
          and afs.venue_id = att.venue_id
        join public.venue_visits as vv
          on vv.id = att.venue_visit_id
          and vv.user_id = att.replay_user_id
          and vv.venue_id::text = att.venue_id
          and vv.geo_verified = true
          and vv.check_in_source = 'active_flow'
        where att.session_id = p_session_id
          and att.replay_user_id = v_authenticated_user_id
          and att.snapshot_id = v_snapshot_id
          and att.snapshot_stop_id = required_stop.id
          and att.stop_index = required_stop.stop_index
          and att.venue_id = required_stop.venue_id::text
      )
  ) then
    raise exception
      'Trusted replay completion evidence is incomplete.'
      using errcode = 'P0001';
  end if;

  -- Original idempotent full-flow attribution INSERT.

  insert into public.creator_replay_events (
    creator_user_id,
    replay_user_id,
    snapshot_id,
    session_id,
    event_type,
    stop_index,
    venue_id,
    occurred_at
  )
  values (
    v_creator_user_id,
    v_authenticated_user_id,
    v_snapshot_id,
    p_session_id,
    'replay_flow_completed',
    null,
    null,
    v_completed_at
  )
  on conflict (
    creator_user_id,
    replay_user_id,
    snapshot_id
  )
  where event_type = 'replay_flow_completed'
  do nothing
  returning
    id,
    creator_replay_events.occurred_at
  into
    v_event_id,
    v_event_occurred_at;

  get diagnostics
    v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select
      cre.id,
      cre.occurred_at
    into
      v_event_id,
      v_event_occurred_at
    from public.creator_replay_events as cre
    where cre.creator_user_id = v_creator_user_id
      and cre.replay_user_id = v_authenticated_user_id
      and cre.snapshot_id = v_snapshot_id
      and cre.event_type = 'replay_flow_completed'
    limit 1;
  end if;

  return query
  select
    v_rows_inserted > 0,
    v_event_id,
    v_creator_user_id,
    v_authenticated_user_id,
    v_snapshot_id,
    p_session_id,
    v_event_occurred_at;
end;
$function$;
