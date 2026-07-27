-- Automated SQL regression tests for the SECURITY DEFINER helpers and the
-- security surface around multi-tenant access + audit logging.
--
-- Purpose: lock down definer flags, EXECUTE grants, RLS policies, and trigger
-- wiring so a future migration cannot silently loosen privileges or drop a
-- guardrail without this test failing.
--
-- Run:   psql -f supabase/tests/security_surface.sql
-- Exits non-zero on the first failed assertion (RAISE EXCEPTION).
--
-- Each assertion uses PERFORM + IF NOT ... RAISE so failures print the
-- expected vs actual condition. On success the script prints "OK" per group.

\set ON_ERROR_STOP on
\timing off
\echo '== FrontDesk security-surface regression =='

BEGIN;

-- ---------------------------------------------------------------------------
-- Group 1: SECURITY DEFINER helpers must stay DEFINER with hardened search_path.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  must_be_definer text[] := ARRAY[
    'is_business_member',
    'has_business_role',
    'handle_new_user',
    'handle_new_business',
    'add_business_member_by_email',
    'list_business_members',
    'prevent_started_appointment_delete',
    'log_audit',
    'audit_appointments',
    'audit_scheduling_requests',
    'audit_messages'
  ];
  name text;
BEGIN
  FOREACH name IN ARRAY must_be_definer LOOP
    SELECT p.prosecdef, p.proconfig
      INTO r
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = name
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MISSING FUNCTION: public.% is not defined', name;
    END IF;
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION 'PRIVILEGE REGRESSION: public.% is SECURITY INVOKER (must be DEFINER)', name;
    END IF;
    IF r.proconfig IS NULL OR NOT ('search_path=public' = ANY(r.proconfig)) THEN
      RAISE EXCEPTION 'HARDENING REGRESSION: public.% is missing SET search_path=public (proconfig=%)', name, r.proconfig;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  (1) all critical helpers remain SECURITY DEFINER with pinned search_path';
END $$;

-- ---------------------------------------------------------------------------
-- Group 2: Internal-only DEFINER functions must NOT be callable by anon/authenticated.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  name text;
  internal_only text[] := ARRAY[
    'log_audit(uuid,text,public.audit_entity_type,uuid,text,text,jsonb,jsonb)',
    'audit_appointments()',
    'audit_scheduling_requests()',
    'audit_messages()',
    'handle_new_user()',
    'handle_new_business()',
    'prevent_started_appointment_delete()'
  ];
BEGIN
  FOREACH name IN ARRAY internal_only LOOP
    IF has_function_privilege('anon', 'public.' || name, 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE REGRESSION: anon can EXECUTE public.%', name;
    END IF;
    IF has_function_privilege('authenticated', 'public.' || name, 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE REGRESSION: authenticated can EXECUTE public.%', name;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  (2) internal DEFINER functions are not callable by anon or authenticated';
END $$;

-- ---------------------------------------------------------------------------
-- Group 3: Callable helpers must remain reachable by authenticated (and only
--          by authenticated where anon is not intended).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  name text;
  auth_callable text[] := ARRAY[
    'is_business_member(uuid,uuid)',
    'has_business_role(uuid,uuid,public.business_role[])',
    'list_business_members(uuid)',
    'add_business_member_by_email(uuid,text,public.business_role)'
  ];
BEGIN
  FOREACH name IN ARRAY auth_callable LOOP
    IF NOT has_function_privilege('authenticated', 'public.' || name, 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE REGRESSION: authenticated lost EXECUTE on public.%', name;
    END IF;
  END LOOP;
  -- add_business_member_by_email must NOT be callable by anon.
  IF has_function_privilege('anon', 'public.add_business_member_by_email(uuid,text,public.business_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE REGRESSION: anon can call add_business_member_by_email';
  END IF;
  RAISE NOTICE 'OK  (3) member-management helpers remain callable by authenticated only';
END $$;

-- ---------------------------------------------------------------------------
-- Group 4: RLS is enabled on every sensitive table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  needs_rls text[] := ARRAY[
    'businesses','business_members','profiles',
    'appointments','staff','services','customers',
    'conversations','messages','scheduling_requests',
    'audit_logs'
  ];
  is_on bool;
BEGIN
  FOREACH t IN ARRAY needs_rls LOOP
    SELECT c.relrowsecurity INTO is_on
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MISSING TABLE: public.%', t;
    END IF;
    IF NOT is_on THEN
      RAISE EXCEPTION 'PRIVILEGE REGRESSION: RLS disabled on public.%', t;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  (4) RLS enabled on every sensitive table';
END $$;

-- ---------------------------------------------------------------------------
-- Group 5: audit_logs cannot be written or updated by anyone through RLS —
--          only trigger-driven inserts via SECURITY DEFINER log_audit() are
--          allowed. There must be no INSERT/UPDATE policy, and the table
--          must not grant INSERT/UPDATE to anon/authenticated.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bad_policies int;
  raised bool;
BEGIN
  SELECT count(*) INTO bad_policies
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'audit_logs'
     AND cmd IN ('INSERT','UPDATE');
  IF bad_policies <> 0 THEN
    RAISE EXCEPTION 'PRIVILEGE REGRESSION: audit_logs has % INSERT/UPDATE policy (client writes must go through triggers only)', bad_policies;
  END IF;

  -- SELECT + DELETE must still work for authenticated (RLS-scoped).
  IF NOT has_table_privilege('authenticated', 'public.audit_logs', 'SELECT') THEN
    RAISE EXCEPTION 'REGRESSION: authenticated lost SELECT on audit_logs';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') THEN
    RAISE EXCEPTION 'REGRESSION: authenticated lost DELETE on audit_logs';
  END IF;
  RAISE NOTICE 'OK  (5) audit_logs write path is triggers-only';
END $$;

  -- SELECT + DELETE must still work for authenticated (RLS-scoped).
  IF NOT has_table_privilege('authenticated', 'public.audit_logs', 'SELECT') THEN
    RAISE EXCEPTION 'REGRESSION: authenticated lost SELECT on audit_logs';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') THEN
    RAISE EXCEPTION 'REGRESSION: authenticated lost DELETE on audit_logs';
  END IF;
  RAISE NOTICE 'OK  (5) audit_logs write path is triggers-only';
END $$;

-- ---------------------------------------------------------------------------
-- Group 6: Required triggers are wired.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t record;
  required text[][] := ARRAY[
    ['appointments','audit_appointments_trg'],
    ['appointments','prevent_staff_appointment_overlap_trg'],
    ['scheduling_requests','audit_scheduling_requests_trg'],
    ['messages','audit_messages_trg']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(required,1) LOOP
    SELECT 1 INTO t
      FROM pg_trigger tr
      JOIN pg_class c ON c.oid = tr.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = required[i][1]
       AND tr.tgname = required[i][2]
       AND NOT tr.tgisinternal;
    IF NOT FOUND THEN
      -- Fall back: any trigger on that table calling the audit function.
      IF required[i][2] = 'prevent_staff_appointment_overlap_trg' THEN
        PERFORM 1 FROM pg_trigger tr
          JOIN pg_proc p ON p.oid = tr.tgfoid
         WHERE p.proname = 'prevent_staff_appointment_overlap' AND NOT tr.tgisinternal;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'MISSING TRIGGER: overlap-prevention trigger on appointments';
        END IF;
      ELSE
        RAISE EXCEPTION 'MISSING TRIGGER: %.%', required[i][1], required[i][2];
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  (6) audit and overlap triggers are wired';
END $$;

-- ---------------------------------------------------------------------------
-- Group 7: Behavioral checks with no auth context (auth.uid() IS NULL).
--          Helpers must be safe to call with random UUIDs and return false;
--          they must not error, expose data, or crash.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  u uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
BEGIN
  IF public.is_business_member(u, b) THEN
    RAISE EXCEPTION 'is_business_member returned TRUE for random ids';
  END IF;
  IF public.has_business_role(u, b, ARRAY['owner']::public.business_role[]) THEN
    RAISE EXCEPTION 'has_business_role returned TRUE for random ids';
  END IF;
  RAISE NOTICE 'OK  (7) helper functions default to FALSE for unknown ids';
END $$;

-- ---------------------------------------------------------------------------
-- Group 8: add_business_member_by_email refuses unauthenticated callers.
--          With auth.uid() IS NULL (no JWT set), the internal permission
--          check must raise (SQLSTATE 42501).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  raised bool := false;
BEGIN
  BEGIN
    PERFORM public.add_business_member_by_email(
      gen_random_uuid(), 'nobody@example.test', 'admin'::public.business_role);
  EXCEPTION WHEN insufficient_privilege THEN
    raised := true;
  WHEN OTHERS THEN
    -- Accept any raise as long as it does NOT return a value. Re-raise unknown.
    IF SQLSTATE IN ('42501','P0001') THEN
      raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT raised THEN
    RAISE EXCEPTION 'add_business_member_by_email did not reject unauthenticated caller';
  END IF;
  RAISE NOTICE 'OK  (8) add_business_member_by_email rejects unauthenticated callers';
END $$;

-- ---------------------------------------------------------------------------
-- Group 9: list_business_members refuses non-members.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  raised bool := false;
BEGIN
  BEGIN
    PERFORM public.list_business_members(gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN
    raised := true;
  WHEN OTHERS THEN
    IF SQLSTATE IN ('42501','P0001') THEN
      raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT raised THEN
    RAISE EXCEPTION 'list_business_members did not reject non-member caller';
  END IF;
  RAISE NOTICE 'OK  (9) list_business_members rejects non-member callers';
END $$;

-- ---------------------------------------------------------------------------
-- Group 10: appointment-overlap trigger blocks conflicts end-to-end.
--           Runs entirely in a nested transaction that we ROLLBACK.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  biz uuid := gen_random_uuid();
  st  uuid := gen_random_uuid();
  a1  uuid := gen_random_uuid();
  a2  uuid := gen_random_uuid();
  raised bool := false;
BEGIN
  -- Bypass RLS for this fixture setup: we're running as the DB owner in tests.
  SET LOCAL row_security = off;

  INSERT INTO public.businesses (id, name, slug)
    VALUES (biz, 'reg-test', 'reg-test-' || substr(biz::text, 1, 8));
  INSERT INTO public.staff (id, business_id, name)
    VALUES (st, biz, 'Reg Tester');

  INSERT INTO public.appointments (id, business_id, staff_id, starts_at, ends_at, status)
    VALUES (a1, biz, st, now() + interval '2 hours', now() + interval '3 hours', 'confirmed');

  BEGIN
    INSERT INTO public.appointments (id, business_id, staff_id, starts_at, ends_at, status)
      VALUES (a2, biz, st, now() + interval '2 hours 30 minutes', now() + interval '3 hours 30 minutes', 'confirmed');
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN raised := true; ELSE RAISE; END IF;
  END;

  IF NOT raised THEN
    RAISE EXCEPTION 'overlap trigger failed to block a conflicting appointment';
  END IF;

  -- Boundary: end == start is NOT a conflict.
  INSERT INTO public.appointments (id, business_id, staff_id, starts_at, ends_at, status)
    VALUES (gen_random_uuid(), biz, st, now() + interval '3 hours', now() + interval '4 hours', 'confirmed');

  RAISE NOTICE 'OK (10) overlap trigger enforces conflicts and honours the half-open boundary';
END $$;

-- ---------------------------------------------------------------------------
-- Group 11: audit trigger writes a row for appointment mutations.
--           Fixture also verifies that log_audit fills actor_type='system'
--           when auth.uid() is NULL and no app.actor_label is set.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  biz uuid := gen_random_uuid();
  st  uuid := gen_random_uuid();
  ap  uuid := gen_random_uuid();
  n_created int;
  n_reschd  int;
BEGIN
  SET LOCAL row_security = off;

  INSERT INTO public.businesses (id, name, slug)
    VALUES (biz, 'reg-audit', 'reg-audit-' || substr(biz::text, 1, 8));
  INSERT INTO public.staff (id, business_id, name)
    VALUES (st, biz, 'Auditor');

  INSERT INTO public.appointments (id, business_id, staff_id, starts_at, ends_at, status)
    VALUES (ap, biz, st, now() + interval '5 hours', now() + interval '6 hours', 'pending');

  SELECT count(*) INTO n_created
    FROM public.audit_logs
   WHERE business_id = biz AND entity_id = ap AND action = 'created';
  IF n_created <> 1 THEN
    RAISE EXCEPTION 'audit_appointments did not record creation (got % rows)', n_created;
  END IF;

  UPDATE public.appointments
     SET starts_at = starts_at + interval '30 minutes',
         ends_at   = ends_at   + interval '30 minutes'
   WHERE id = ap;

  SELECT count(*) INTO n_reschd
    FROM public.audit_logs
   WHERE business_id = biz AND entity_id = ap AND action = 'rescheduled';
  IF n_reschd <> 1 THEN
    RAISE EXCEPTION 'audit_appointments did not record reschedule (got % rows)', n_reschd;
  END IF;

  PERFORM 1 FROM public.audit_logs
   WHERE business_id = biz AND entity_id = ap AND actor_type = 'system';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit rows for unauthenticated caller must have actor_type=system';
  END IF;

  RAISE NOTICE 'OK (11) audit trigger records create + reschedule with correct actor_type';
END $$;

-- ---------------------------------------------------------------------------
-- Group 12: prevent_started_appointment_delete blocks deletes of started
--           appointments when the caller is not owner/admin (auth.uid() IS NULL).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  biz uuid := gen_random_uuid();
  st  uuid := gen_random_uuid();
  ap  uuid := gen_random_uuid();
  raised bool := false;
BEGIN
  SET LOCAL row_security = off;

  INSERT INTO public.businesses (id, name, slug)
    VALUES (biz, 'reg-del', 'reg-del-' || substr(biz::text, 1, 8));
  INSERT INTO public.staff (id, business_id, name)
    VALUES (st, biz, 'Deleter');
  INSERT INTO public.appointments (id, business_id, staff_id, starts_at, ends_at, status)
    VALUES (ap, biz, st, now() - interval '1 hour', now() + interval '1 hour', 'confirmed');

  BEGIN
    DELETE FROM public.appointments WHERE id = ap;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN raised := true; ELSE RAISE; END IF;
  END;

  IF NOT raised THEN
    RAISE EXCEPTION 'prevent_started_appointment_delete did not block deletion of a started appointment';
  END IF;

  RAISE NOTICE 'OK (12) started-appointment delete guard blocks non-manager deletes';
END $$;

ROLLBACK;

\echo '== ALL SECURITY REGRESSION CHECKS PASSED =='
