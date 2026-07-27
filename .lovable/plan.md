## Goal

Record who did what and when on:
- Schedule changes (appointments: create, reschedule, status change, delete)
- Inbound Instagram/Facebook activity (scheduling requests created from Meta webhooks; agent replies via conversations/messages)
- Call handling (see note — no calls table exists yet; covered by a generic "channel" field so voice calls slot in later)

Every entry captures: business, actor (user or webhook/system), what changed, entity affected, and timestamp.

## What gets built

### 1. New table `audit_logs` (per business)
Fields (domain-specific only):
- business_id — which workspace
- actor_user_id — signed-in user who acted (null for webhook/system)
- actor_type — user / webhook / system
- actor_label — human-readable ("Meta webhook", "System", or full name via join)
- action — created / updated / rescheduled / status_changed / deleted / message_received / message_sent / request_created / request_assigned
- entity_type — appointment / scheduling_request / conversation / message
- entity_id
- channel — instagram / facebook / call / internal (nullable)
- summary — short human line ("Rescheduled from 10:00 → 11:00")
- changes — JSON of old/new values for changed columns (nullable)
- metadata — JSON (webhook event id, IP hash, etc., nullable)

Access rules (plain English):
- Any workspace member can view their business's audit log
- Only owners and admins can delete entries (retention/cleanup)
- Inserts happen through database triggers only — nobody writes directly from the client

### 2. Database triggers (server-side, tamper-resistant)
- `appointments` AFTER INSERT/UPDATE/DELETE → writes an entry; captures `auth.uid()` as actor when present, otherwise marks as system. Diffs `starts_at/ends_at/status/staff_id/customer_id/notes/service_id` and builds a readable summary.
- `scheduling_requests` AFTER INSERT/UPDATE → entries for "request_created" (actor = webhook when auth.uid() is null) and "request_assigned"/"request_status_changed" on updates.
- `messages` AFTER INSERT → "message_received" (webhook) or "message_sent" (actor = agent) depending on direction column.

Triggers use SECURITY DEFINER with hardened search_path so RLS on `audit_logs` blocks direct writes but trigger writes succeed.

### 3. UI: `/workspaces/$businessId/audit`
- Table view: When • Who • Action • Entity (link) • Channel • Summary
- Filters: date range, actor (user/webhook/system), entity type, channel, free-text search on summary
- Click a row → drawer showing the raw `changes` diff and `metadata`
- Link added to workspace dashboard card next to "team members →"

### 4. Retention control (light)
- Owners/admins can bulk-delete entries older than a selected date from the viewer (uses the delete policy above). No auto-purge yet.

## Technical section

- Migration: create `audit_logs` (with `business_id` FK to `businesses ON DELETE CASCADE`, `actor_user_id` FK to `auth.users ON DELETE SET NULL`), GRANTs (SELECT+DELETE to `authenticated`, ALL to `service_role`), enable RLS.
  - SELECT policy: `is_business_member(auth.uid(), business_id)`
  - DELETE policy: `has_business_role(auth.uid(), business_id, ARRAY['owner','admin'])`
  - No INSERT/UPDATE policy — writes only via SECURITY DEFINER trigger functions.
- Indexes: `(business_id, created_at DESC)`, `(business_id, entity_type, entity_id)`, `(business_id, actor_user_id)`.
- Trigger helper `public.log_audit(...)` (SECURITY DEFINER) that inserts one row; the per-table triggers call it with the right payload. Meta webhook route already runs unauthenticated → `auth.uid()` is null there, so trigger falls back to `actor_type='webhook'` and takes `actor_label` from a `SET LOCAL app.actor_label` GUC if the webhook sets one (best-effort; defaults to "Meta webhook").
- Fetch layer: authenticated server function `listAuditEntries({ businessId, filters, cursor })` using `requireSupabaseAuth`; RLS enforces membership. Paginated (50/page, keyset by `created_at,id`).
- UI route: `src/routes/_authenticated/workspaces/$businessId/audit.tsx`, TanStack Query `useSuspenseQuery`, filters persisted per user via existing localStorage pattern.

## Out of scope (call out to user if needed)
- No calls table yet, so no call-specific triggers. The `channel` column and `message_received` action are ready to accept voice once a calls/messages integration lands.
- No email export or SIEM forwarding.
- No auto-purge/scheduled retention job — manual delete only.
