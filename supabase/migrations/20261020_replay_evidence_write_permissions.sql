
-- PREPARATION ONLY. DO NOT EXECUTE.
--
-- Replay evidence write-permission cutover.
--
-- Deployment prerequisites:
-- 1. All legitimate GPS visit/progress writers use trusted
--    server-side credentials.
-- 2. Rating-only updates have been verified.
-- 3. Existing deletion and retry behavior has been verified.
-- 4. Replay attestation and attribution deployment is coordinated.
-- 5. A rollback plan has been prepared.

BEGIN;

-- Remove broad client mutation permissions.
REVOKE INSERT, UPDATE
ON TABLE public.active_flow_progress
FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE
ON TABLE public.venue_visits
FROM PUBLIC, anon, authenticated;

-- Preserve authenticated users' ability to update only
-- their visit rating and modification timestamp.
GRANT UPDATE (rating, updated_at)
ON TABLE public.venue_visits
TO authenticated;

-- Preserve existing read and delete grants at this stage.
-- Do not change RLS ownership policies in this migration.
--
-- Trusted service_role permissions are unchanged.

-- Remove administrative capabilities from ordinary
-- application roles without affecting SELECT, row-level
-- DELETE, or rating-only UPDATE.
REVOKE TRUNCATE, TRIGGER, MAINTAIN
ON TABLE public.active_flow_progress
FROM PUBLIC, anon, authenticated;

REVOKE TRUNCATE, TRIGGER, MAINTAIN
ON TABLE public.venue_visits
FROM PUBLIC, anon, authenticated;

COMMIT;
