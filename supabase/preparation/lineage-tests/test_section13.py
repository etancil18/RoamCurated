#!/usr/bin/env python3
"""
Roam stop-level lineage: isolated PostgreSQL integration harness.

Run:
  python3 supabase/preparation/lineage-tests/test_section13.py

Safety:
- Uses only the named local Docker PostgreSQL container.
- Creates a randomly named, disposable test database.
- Runs the ACTUAL preparation SQL migration.
- Never connects to hosted Supabase.
- Always attempts to drop its own test database.
- Does not modify the migration or feature flags.
"""

from pathlib import Path
import subprocess
import sys
import uuid

CONTAINER = "supabase_db_roam-lineage-lab"
DATABASE = "roam_lineage_test_" + uuid.uuid4().hex[:12]

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "20261021_flow_stop_creator_lineage_PREPARATION_ONLY.sql"
)

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
CAROL = "33333333-3333-4333-8333-333333333333"
COLLECTION = "55555555-5555-4555-8555-555555555555"

A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
C = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
D = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4"


def psql(sql, database=DATABASE, check=True):
    result = subprocess.run(
        [
            "docker", "exec", "-i", CONTAINER,
            "psql", "-X", "-q", "-A", "-t",
            "-v", "ON_ERROR_STOP=1",
            "-U", "postgres", "-d", database,
        ],
        input=sql,
        text=True,
        capture_output=True,
    )

    if check and result.returncode != 0:
        raise RuntimeError(
            f"PostgreSQL error (exit {result.returncode}):\n"
            + result.stderr[-6000:]
        )

    return result


BASELINE = r"""
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.venues (
  id uuid PRIMARY KEY
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  creator_mode_enabled boolean,
  is_public boolean,
  deleted_at timestamptz
);

CREATE TABLE public.creator_collections (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  title text,
  city text,
  visibility text
);

CREATE TABLE public.creator_collection_venues (
  collection_id uuid NOT NULL
    REFERENCES public.creator_collections(id),
  venue_id uuid NOT NULL
    REFERENCES public.venues(id),
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (collection_id, venue_id)
);

CREATE TABLE public.active_flow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  city text,
  source text,
  source_id uuid,
  source_creator_user_id uuid,
  venue_ids text[] NOT NULL DEFAULT '{}',
  travel_mode text,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX test_one_active_flow_per_user
ON public.active_flow_sessions(user_id)
WHERE status = 'active';

CREATE TABLE public.active_flow_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES public.active_flow_sessions(id)
    ON DELETE CASCADE,
  venue_id text NOT NULL,
  position integer NOT NULL,
  origin text NOT NULL DEFAULT 'original',
  original_stop_id uuid,
  status text NOT NULL DEFAULT 'planned',
  UNIQUE (session_id, position, origin)
);

-- Synthetic equivalent of the verified production
-- runtime-stop materialization trigger.
CREATE FUNCTION public.test_materialize_stops()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.active_flow_stops (
    session_id, venue_id, position, origin, status
  )
  SELECT
    NEW.id,
    v.venue_id,
    (v.ordinality - 1)::integer,
    'original',
    'planned'
  FROM unnest(NEW.venue_ids)
    WITH ORDINALITY AS v(venue_id, ordinality);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_010_materialize_active_flow_stops
AFTER INSERT ON public.active_flow_sessions
FOR EACH ROW
EXECUTE FUNCTION public.test_materialize_stops();

CREATE TABLE public.active_flow_progress (
  session_id uuid NOT NULL
    REFERENCES public.active_flow_sessions(id)
    ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stop_index integer NOT NULL
);

CREATE TABLE public.flow_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  title text,
  city text,
  status text NOT NULL,
  cover_image_url text,
  route_summary text,
  checked_in_count integer NOT NULL DEFAULT 0,
  total_stops integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public',
  replayable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id)
);

CREATE TABLE public.flow_snapshot_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL
    REFERENCES public.flow_snapshots(id)
    ON DELETE CASCADE,
  venue_id uuid NOT NULL
    REFERENCES public.venues(id),
  stop_index integer NOT NULL,
  UNIQUE (snapshot_id, stop_index),
  UNIQUE (snapshot_id, venue_id)
);

-- Deliberately permissive baseline:
-- authenticated users can INSERT Snapshot stops,
-- so Section 13 must enforce immutability independently.
ALTER TABLE public.flow_snapshot_stops
ENABLE ROW LEVEL SECURITY;

CREATE POLICY test_authenticated_stop_insert
ON public.flow_snapshot_stops
FOR INSERT TO authenticated
WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON public.flow_snapshot_stops TO authenticated;
"""


def behavioral_sql():
    return f"""
BEGIN;

INSERT INTO public.venues(id)
VALUES ('{A}'), ('{B}'), ('{C}'), ('{D}');

INSERT INTO public.profiles(
  id, creator_mode_enabled, is_public
)
VALUES ('{ALICE}', true, true);

INSERT INTO public.creator_collections(
  id, user_id, title, city, visibility
)
VALUES (
  '{COLLECTION}', '{ALICE}',
  'Alice Collection', 'atl', 'public'
);

INSERT INTO public.creator_collection_venues(
  collection_id, venue_id, sort_order
)
VALUES
  ('{COLLECTION}', '{A}', 0),
  ('{COLLECTION}', '{B}', 1);

-- Full Collection -> Snapshot -> Replay chain.
DO $$
DECLARE
  v_flow_uuid uuid;
  v_snapshot_uuid uuid;
  v_replay_uuid uuid;
  v_saved_json jsonb;
  v_original_contributions uuid[];
  v_replayed_contributions uuid[];
BEGIN
  v_flow_uuid :=
    public.create_certified_collection_flow(
      '{BOB}'::uuid,
      '{COLLECTION}'::uuid,
      'Alice Collection',
      'atl',
      'walking',
      NULL,
      ARRAY['{A}', '{B}', '{C}']::text[],
      ARRAY['collection', 'collection', 'roam_fill']::text[]
    );

  IF (
    SELECT count(*)
    FROM public.active_flow_stops AS st
    WHERE st.session_id = v_flow_uuid
  ) <> 3 THEN
    RAISE EXCEPTION 'FAIL_RUNTIME_STOP_MATERIALIZATION';
  END IF;

  IF (
    SELECT count(*)
    FROM public.active_flow_stop_contributions AS mapping
    JOIN public.active_flow_stops AS st
      ON st.id = mapping.active_flow_stop_id
    JOIN public.flow_contributions AS contribution
      ON contribution.id = mapping.contribution_id
    WHERE st.session_id = v_flow_uuid
      AND contribution.origin = 'collection'
      AND contribution.creator_user_id = '{ALICE}'::uuid
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL_ALICE_CREATOR_ATTRIBUTION';
  END IF;

  IF (
    SELECT count(*)
    FROM public.active_flow_stop_contributions AS mapping
    JOIN public.active_flow_stops AS st
      ON st.id = mapping.active_flow_stop_id
    JOIN public.flow_contributions AS contribution
      ON contribution.id = mapping.contribution_id
    WHERE st.session_id = v_flow_uuid
      AND contribution.origin = 'platform'
      AND contribution.creator_user_id IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL_PLATFORM_FILL_ATTRIBUTION';
  END IF;

  UPDATE public.active_flow_sessions
  SET status = 'completed'
  WHERE id = v_flow_uuid;

  INSERT INTO public.active_flow_progress(
    session_id, user_id, stop_index
  )
  VALUES
    (v_flow_uuid, '{BOB}', 0),
    (v_flow_uuid, '{BOB}', 1),
    (v_flow_uuid, '{BOB}', 2);

  v_saved_json :=
    public.save_snapshot_with_certified_lineage(
      '{BOB}'::uuid,
      v_flow_uuid,
      ARRAY['{A}', '{B}', '{C}']::text[],
      jsonb_build_object(
        'user_id', '{BOB}',
        'source_type', 'active_flow',
        'source_id', v_flow_uuid::text,
        'status', 'completed',
        'total_stops', 3,
        'checked_in_count', 3,
        'visibility', 'public',
        'cover_image_url', 'https://example.test/image.png'
      )
    );

  v_snapshot_uuid := (v_saved_json ->> 'id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.flow_snapshot_route_certifications AS cert
    WHERE cert.snapshot_id = v_snapshot_uuid
  ) THEN
    RAISE EXCEPTION 'FAIL_NEW_ROUTE_NOT_CERTIFIED';
  END IF;

  IF (
    SELECT count(*)
    FROM public.flow_snapshot_stops AS st
    WHERE st.snapshot_id = v_snapshot_uuid
  ) <> 3 THEN
    RAISE EXCEPTION 'FAIL_SNAPSHOT_STOP_COUNT';
  END IF;

  SELECT array_agg(
    mapping.contribution_id ORDER BY st.stop_index
  )
  INTO v_original_contributions
  FROM public.flow_snapshot_stop_contributions AS mapping
  JOIN public.flow_snapshot_stops AS st
    ON st.id = mapping.snapshot_stop_id
  WHERE st.snapshot_id = v_snapshot_uuid;

  IF cardinality(v_original_contributions) <> 3 THEN
    RAISE EXCEPTION 'FAIL_SNAPSHOT_CONTRIBUTION_COUNT';
  END IF;

  -- Direct route extension must fail.
  BEGIN
    INSERT INTO public.flow_snapshot_stops(
      snapshot_id, venue_id, stop_index
    )
    VALUES (v_snapshot_uuid, '{D}', 3);

    RAISE EXCEPTION 'FAIL_EXTENSION_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL_EXTENSION_ACCEPTED'
       OR SQLERRM NOT LIKE
          '%Certified Snapshot route stops cannot be extended%'
    THEN
      RAISE;
    END IF;
  END;

  -- Direct route deletion must fail.
  BEGIN
    DELETE FROM public.flow_snapshot_stops AS st
    WHERE st.snapshot_id = v_snapshot_uuid;

    RAISE EXCEPTION 'FAIL_DIRECT_STOP_DELETE_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL_DIRECT_STOP_DELETE_ACCEPTED'
       OR SQLERRM NOT LIKE
          '%Saved Snapshot route stops cannot be deleted individually%'
    THEN
      RAISE;
    END IF;
  END;

  -- Certification itself must be immutable.
  BEGIN
    UPDATE public.flow_snapshot_route_certifications AS cert
    SET certified_at = now() + interval '1 day'
    WHERE cert.snapshot_id = v_snapshot_uuid;

    RAISE EXCEPTION 'FAIL_CERTIFICATION_UPDATE_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL_CERTIFICATION_UPDATE_ACCEPTED'
       OR SQLERRM NOT LIKE '%certification is immutable%'
    THEN
      RAISE;
    END IF;
  END;

  -- Existing certified Snapshot resave must preserve its route.
  PERFORM public.save_snapshot_with_certified_lineage(
    '{BOB}'::uuid,
    v_flow_uuid,
    ARRAY['{A}', '{B}', '{C}']::text[],
    jsonb_build_object(
      'user_id', '{BOB}',
      'source_type', 'active_flow',
      'source_id', v_flow_uuid::text,
      'status', 'completed',
      'total_stops', 3,
      'checked_in_count', 3,
      'visibility', 'public'
    )
  );

  IF (
    SELECT count(*)
    FROM public.flow_snapshot_route_certifications AS cert
    WHERE cert.snapshot_id = v_snapshot_uuid
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL_CERTIFICATION_RESAVE';
  END IF;

  -- Production default: Replay must be enabled explicitly.
  IF (
    SELECT snap.replayable
    FROM public.flow_snapshots AS snap
    WHERE snap.id = v_snapshot_uuid
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL_REPLAYABLE_DEFAULT';
  END IF;

  UPDATE public.flow_snapshots AS snap
  SET replayable = true
  WHERE snap.id = v_snapshot_uuid;

  v_replay_uuid :=
    public.create_replay_with_certified_lineage(
      '{CAROL}'::uuid,
      v_snapshot_uuid,
      ARRAY['{A}', '{B}', '{C}']::text[]
    );

  SELECT array_agg(
    mapping.contribution_id ORDER BY st.position
  )
  INTO v_replayed_contributions
  FROM public.active_flow_stop_contributions AS mapping
  JOIN public.active_flow_stops AS st
    ON st.id = mapping.active_flow_stop_id
  WHERE st.session_id = v_replay_uuid;

  IF v_replayed_contributions
     IS DISTINCT FROM v_original_contributions THEN
    RAISE EXCEPTION 'FAIL_REPLAY_CONTRIBUTION_IDENTITY';
  END IF;

  RAISE NOTICE 'PASS: Original creator attribution';
  RAISE NOTICE 'PASS: Uncredited platform-fill attribution';
  RAISE NOTICE 'PASS: New Snapshot certification';
  RAISE NOTICE 'PASS: Certified INSERT rejection';
  RAISE NOTICE 'PASS: Direct stop DELETE rejection';
  RAISE NOTICE 'PASS: Certification UPDATE rejection';
  RAISE NOTICE 'PASS: Certified resave immutability';
  RAISE NOTICE 'PASS: Replayability default';
  RAISE NOTICE 'PASS: Exact Replay contribution inheritance';
END;
$$;

-- A certified Snapshot containing zero contribution mappings.
DO $$
DECLARE
  v_flow_uuid uuid;
  v_snapshot_uuid uuid;
BEGIN
  INSERT INTO public.active_flow_sessions(
    user_id, title, city, source, source_id,
    venue_ids, travel_mode, status
  )
  VALUES (
    '{ALICE}', 'Zero Attribution', 'atl',
    'manual', NULL,
    ARRAY['{A}', '{C}']::text[],
    'walking', 'completed'
  )
  RETURNING id INTO v_flow_uuid;

  v_snapshot_uuid := (
    public.save_snapshot_with_certified_lineage(
      '{ALICE}'::uuid,
      v_flow_uuid,
      ARRAY['{A}', '{C}']::text[],
      jsonb_build_object(
        'user_id', '{ALICE}',
        'source_type', 'active_flow',
        'source_id', v_flow_uuid::text,
        'status', 'completed',
        'total_stops', 2,
        'checked_in_count', 0,
        'visibility', 'private'
      )
    ) ->> 'id'
  )::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.flow_snapshot_route_certifications AS cert
    WHERE cert.snapshot_id = v_snapshot_uuid
  ) THEN
    RAISE EXCEPTION 'FAIL_ZERO_ATTRIBUTION_NOT_CERTIFIED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.flow_snapshot_stop_contributions AS mapping
    JOIN public.flow_snapshot_stops AS st
      ON st.id = mapping.snapshot_stop_id
    WHERE st.snapshot_id = v_snapshot_uuid
  ) THEN
    RAISE EXCEPTION 'FAIL_FAKE_ZERO_ATTRIBUTION';
  END IF;

  BEGIN
    INSERT INTO public.flow_snapshot_stops(
      snapshot_id, venue_id, stop_index
    )
    VALUES (v_snapshot_uuid, '{D}', 2);

    RAISE EXCEPTION 'FAIL_ZERO_ATTRIBUTION_EXTENSION_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'FAIL_ZERO_ATTRIBUTION_EXTENSION_ACCEPTED'
       OR SQLERRM NOT LIKE
          '%Certified Snapshot route stops cannot be extended%'
    THEN
      RAISE;
    END IF;
  END;

  DELETE FROM public.flow_snapshots AS snap
  WHERE snap.id = v_snapshot_uuid;

  IF EXISTS (
    SELECT 1
    FROM public.flow_snapshot_route_certifications AS cert
    WHERE cert.snapshot_id = v_snapshot_uuid
  ) OR EXISTS (
    SELECT 1
    FROM public.flow_snapshot_stops AS st
    WHERE st.snapshot_id = v_snapshot_uuid
  ) THEN
    RAISE EXCEPTION 'FAIL_PARENT_CASCADE';
  END IF;

  RAISE NOTICE 'PASS: Zero-attribution certification';
  RAISE NOTICE 'PASS: Zero-attribution INSERT rejection';
  RAISE NOTICE 'PASS: Parent deletion cascades';
END;
$$;

-- Legacy Snapshot path must remain functional.
DO $$
DECLARE
  v_legacy_uuid uuid;
BEGIN
  INSERT INTO public.flow_snapshots(
    user_id, source_type, source_id,
    title, status, total_stops
  )
  VALUES (
    '{ALICE}', 'hosted_flow', 'legacy-local-only',
    'Legacy Snapshot', 'completed', 2
  )
  RETURNING id INTO v_legacy_uuid;

  INSERT INTO public.flow_snapshot_stops(
    snapshot_id, venue_id, stop_index
  )
  VALUES
    (v_legacy_uuid, '{A}', 0),
    (v_legacy_uuid, '{B}', 1);

  IF EXISTS (
    SELECT 1
    FROM public.flow_snapshot_route_certifications AS cert
    WHERE cert.snapshot_id = v_legacy_uuid
  ) THEN
    RAISE EXCEPTION 'FAIL_LEGACY_AUTO_CERTIFICATION';
  END IF;

  RAISE NOTICE 'PASS: Legacy Snapshot creation';
END;
$$;

COMMIT;
"""


def test_privileges():
    sql = """
SELECT
  has_function_privilege(
    'authenticated',
    'public.create_certified_collection_flow(uuid,uuid,text,text,text,text,text[],text[])',
    'EXECUTE'
  ),
  has_function_privilege(
    'authenticated',
    'public.save_snapshot_with_certified_lineage(uuid,uuid,text[],jsonb)',
    'EXECUTE'
  ),
  has_function_privilege(
    'authenticated',
    'public.create_replay_with_certified_lineage(uuid,uuid,text[])',
    'EXECUTE'
  ),
  has_table_privilege(
    'authenticated',
    'public.flow_snapshot_route_certifications',
    'INSERT'
  ),
  has_function_privilege(
    'service_role',
    'public.save_snapshot_with_certified_lineage(uuid,uuid,text[],jsonb)',
    'EXECUTE'
  ),
  has_table_privilege(
    'service_role',
    'public.flow_snapshot_route_certifications',
    'INSERT'
  );
"""
    output = psql(sql).stdout.strip()

    if output != "f|f|f|f|t|t":
        raise RuntimeError(
            f"Unexpected privilege results: {output}"
        )

    print("PASS: Authenticated cannot invoke lineage RPCs")
    print("PASS: Authenticated cannot insert certifications")
    print("PASS: service_role has required permissions")


def test_authenticated_route_insertion():
    # Look up the known Bob Snapshot as postgres first.
    snapshot_uuid = psql(f"""
SELECT snap.id
FROM public.flow_snapshots AS snap
WHERE snap.user_id = '{BOB}'::uuid
  AND snap.source_type = 'active_flow';
""").stdout.strip()

    if not snapshot_uuid:
        raise RuntimeError("Certified Snapshot not found.")

    # Authenticated has an otherwise-permissive INSERT policy.
    # Section 13 must reject the insertion at the trigger level.
    attempted_insert = f"""
BEGIN;
SET LOCAL ROLE authenticated;
INSERT INTO public.flow_snapshot_stops(
  snapshot_id, venue_id, stop_index
)
VALUES (
  '{snapshot_uuid}'::uuid,
  '{D}'::uuid,
  3
);
COMMIT;
"""

    result = psql(attempted_insert, check=False)

    if result.returncode == 0:
        raise RuntimeError(
            "Authenticated INSERT unexpectedly succeeded."
        )

    expected = "Certified Snapshot route stops cannot be extended"

    if expected not in result.stderr:
        raise RuntimeError(
            "Authenticated INSERT failed for the wrong reason:\n"
            + result.stderr
        )

    remaining = psql(f"""
SELECT count(*)
FROM public.flow_snapshot_stops AS st
WHERE st.snapshot_id = '{snapshot_uuid}'::uuid;
""").stdout.strip()

    if remaining != "3":
        raise RuntimeError(
            f"Unexpected certified stop count: {remaining}"
        )

    print("PASS: Authenticated INSERT blocked by Section 13")
    print("PASS: Certified route unchanged after rejection")


def print_notices(result):
    count = 0
    for line in result.stderr.splitlines():
        if "PASS:" in line:
            message = line.split("PASS:", 1)[1].strip()
            print("PASS:", message)
            count += 1

    if count != 13:
        raise RuntimeError(
            f"Expected 13 behavioral PASS notices, received {count}."
        )


def main():
    if not MIGRATION.is_file():
        raise RuntimeError(
            f"Preparation migration missing: {MIGRATION}"
        )

    migration_sql = MIGRATION.read_text()

    if not migration_sql.rstrip().endswith("COMMIT;"):
        raise RuntimeError(
            "Preparation migration lacks final COMMIT."
        )

    if (
        "CREATE TABLE public.flow_snapshot_route_certifications"
        not in migration_sql
    ):
        raise RuntimeError(
            "Section 13 certification table not found."
        )

    print("Container:", CONTAINER)
    print("Disposable database:", DATABASE)
    print("Preparation migration:", MIGRATION)
    print("Hosted Supabase: NOT USED")

    created = False

    try:
        # CREATE DATABASE cannot be inside the migration
        # transaction; create a unique database explicitly.
        psql(f"CREATE DATABASE {DATABASE};", database="postgres")
        created = True

        print("\n1. Synthetic baseline")
        psql(BASELINE)
        print("PASS: Baseline created")

        print("\n2. Actual preparation migration")
        psql(migration_sql)
        print("PASS: Full migration executed")

        print("\n3. Privilege verification")
        test_privileges()

        print("\n4. Lineage and Section 13 behavior")
        behavioral_result = psql(behavioral_sql())
        print_notices(behavioral_result)

        print("\n5. Actual authenticated-role INSERT")
        test_authenticated_route_insertion()

        print("\nALL EXECUTED CHECKS PASSED")
        print(
            "Scope: isolated synthetic-schema validation."
        )
        print(
            "Not covered: full production schema, "
            "two-connection concurrency."
        )

    finally:
        if created:
            print("\nCleaning up disposable database...")
            cleanup = psql(
                f"DROP DATABASE IF EXISTS {DATABASE} WITH (FORCE);",
                database="postgres",
                check=False,
            )

            if cleanup.returncode:
                print(
                    "WARNING: Automatic cleanup failed.\n"
                    + cleanup.stderr
                )
                print("Database requiring manual review:", DATABASE)
            else:
                print("PASS: Disposable database removed")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("\nFAIL:", error, file=sys.stderr)
        sys.exit(1)
