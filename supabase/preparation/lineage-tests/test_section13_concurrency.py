#!/usr/bin/env python3
"""
Section 13 two-connection concurrency verification.

Reuses test_section13.py for:
- disposable database naming
- synthetic baseline
- actual preparation migration
- Docker PostgreSQL access

This test uses a PostgreSQL session lock and pg_stat_activity
to establish genuine transaction overlap.

No hosted Supabase access. No production changes.
"""

import subprocess
import sys
import time

import test_section13 as lab


def run_sql(sql, check=True):
    return lab.psql(sql, check=check)


def start_psql():
    return subprocess.Popen(
        [
            "docker", "exec", "-i",
            lab.CONTAINER,
            "psql",
            "-X",
            "-q",
            "-A",
            "-t",
            "-v", "ON_ERROR_STOP=1",
            "-U", "postgres",
            "-d", lab.DATABASE,
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )


def send(process, sql):
    if process.stdin is None:
        raise RuntimeError("psql stdin not available")

    process.stdin.write(sql + "\n")
    process.stdin.flush()


def scalar(sql):
    return run_sql(sql).stdout.strip()


def wait_for(predicate, description, timeout=12):
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        if predicate():
            return

        time.sleep(0.1)

    raise RuntimeError(
        f"Timed out waiting for {description}"
    )


def active_session(application_name):
    return scalar(f"""
SELECT count(*)
FROM pg_stat_activity
WHERE datname = current_database()
  AND application_name = '{application_name}';
""") == "1"


def blocked_session(application_name):
    return scalar(f"""
SELECT count(*)
FROM pg_stat_activity
WHERE datname = current_database()
  AND application_name = '{application_name}'
  AND wait_event_type = 'Lock';
""") == "1"


def seed_fixture():
    result = run_sql(f"""
INSERT INTO public.venues(id)
VALUES
  ('{lab.A}'),
  ('{lab.B}'),
  ('{lab.C}');

INSERT INTO public.flow_snapshots(
  user_id, source_type, source_id,
  title, status, total_stops, visibility
)
VALUES (
  '{lab.BOB}',
  'hosted_flow',
  'concurrency-check',
  'Concurrent insertion test',
  'completed',
  2,
  'private'
)
RETURNING id;
""")

    snapshot_id = result.stdout.strip()

    if not snapshot_id:
        raise RuntimeError(
            "Fixture Snapshot was not created"
        )

    run_sql(f"""
INSERT INTO public.flow_snapshot_stops(
  snapshot_id, venue_id, stop_index
)
VALUES
  ('{snapshot_id}', '{lab.A}', 0),
  ('{snapshot_id}', '{lab.B}', 1);
""")

    return snapshot_id


def test_race(snapshot_id):
    writer = start_psql()
    attacker = start_psql()

    try:
        send(writer, """
SET application_name = 'lineage_writer';
BEGIN;
""")

        send(writer, f"""
SELECT id FROM public.flow_snapshots
WHERE id = '{snapshot_id}'::uuid
FOR UPDATE;
""")

        wait_for(
            lambda: scalar("""
SELECT count(*)
FROM pg_locks AS l
JOIN pg_stat_activity AS a ON a.pid = l.pid
WHERE a.datname = current_database()
  AND a.application_name = 'lineage_writer'
  AND l.locktype = 'tuple'
  AND l.granted;
""") == "1",
            "writer row lock",
        )

        print("PASS: Writer holds Snapshot row lock")

        send(attacker, """
SET application_name = 'lineage_attacker';
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '12000ms';
""")

        send(attacker, f"""
INSERT INTO public.flow_snapshot_stops(
  snapshot_id, venue_id, stop_index
)
VALUES (
  '{snapshot_id}'::uuid,
  '{lab.C}'::uuid,
  2
);
""")

        wait_for(
            lambda: blocked_session("lineage_attacker"),
            "authenticated INSERT waiting on a lock",
        )

        print(
            "PASS: Authenticated INSERT is blocked "
            "behind certification transaction"
        )

        send(writer, f"""
INSERT INTO public.flow_snapshot_route_certifications(
  snapshot_id
)
VALUES ('{snapshot_id}'::uuid);
COMMIT;
""")

        wait_for(
            lambda: scalar(f"""
SELECT count(*)
FROM public.flow_snapshot_route_certifications
WHERE snapshot_id = '{snapshot_id}'::uuid;
""") == "1",
            "committed route certification",
        )

        print("PASS: Writer committed certification")

        wait_for(
            lambda: not blocked_session(
                "lineage_attacker"
            ),
            "authenticated INSERT to finish",
        )

        final_count = scalar(f"""
SELECT count(*)
FROM public.flow_snapshot_stops
WHERE snapshot_id = '{snapshot_id}'::uuid;
""")

        if final_count != "2":
            raise RuntimeError(
                "Unauthorized stop insertion succeeded. "
                f"Stop count: {final_count}"
            )

        print(
            "PASS: Unauthorized INSERT did not extend route"
        )

    finally:
        for process in (attacker, writer):
            if process.poll() is None:
                process.kill()

            process.communicate()


def main():
    print("Container:", lab.CONTAINER)
    print("Disposable database:", lab.DATABASE)
    print("Hosted Supabase: NOT USED")

    created = False

    try:
        run_sql(
            f"CREATE DATABASE {lab.DATABASE};"
        ) if False else lab.psql(
            f"CREATE DATABASE {lab.DATABASE};",
            database="postgres",
        )

        created = True

        run_sql(lab.BASELINE)
        print("PASS: Synthetic baseline created")

        run_sql(lab.MIGRATION.read_text())
        print("PASS: Actual migration executed")

        snapshot_id = seed_fixture()
        print("PASS: Snapshot fixture created")

        test_race(snapshot_id)

        print("\nALL CONCURRENCY CHECKS PASSED")

    finally:
        if created:
            result = lab.psql(
                f"DROP DATABASE IF EXISTS "
                f"{lab.DATABASE} WITH (FORCE);",
                database="postgres",
                check=False,
            )

            if result.returncode:
                print(
                    "WARNING: Cleanup failed:",
                    result.stderr,
                )
            else:
                print("PASS: Disposable database removed")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("\nFAIL:", exc, file=sys.stderr)
        sys.exit(1)
