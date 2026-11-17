# Repair accounts, purchases and billing

## Audit result

Both test and live catalogs correctly charge **$49, $99 and $199 per month**, with a **14-day trial requiring a card** and quantity fixed to one. Readiness checks now pass, but accepting live payments still requires publishing the latest site, identity/business verification and provider approval.

The app has real accounts, workspaces, scheduling and checkout. Its main gaps are duplicate purchase paths, unreliable subscription updates, missing billing-management controls, unsafe membership changes, incomplete onboarding and reports that treat subscription status as proof of payment. Several advertised phone, SMS and calendar capabilities have no implementation in this repository.

The detailed investigation is saved in `docs/accounts-payments-audit.md`, including evidence, current behavior, uncertainties and the preview test checklist.

## Defaults to review

Because the business questions were skipped, use these conservative defaults:

- Retain **one subscription per paying owner account per environment**, not a new per-business billing model. Members use workspaces under their owner's coverage. Existing paid accounts are never charged or migrated silently. Conflicting existing subscriptions are flagged for review rather than canceled automatically.
- Keep paid upgrades **immediate and prorated**. Trial changes charge nothing immediately and preserve the original trial end. Schedule downgrades at the next renewal, with the current plan available until then.
- Allow one introductory trial per billing owner. Returning customers can subscribe without receiving another introductory trial.
- Cancellation preserves already-paid access until the paid-through date; trial cancellation prevents the first charge. Payment recovery follows the provider's retry lifecycle, with a visible warning. Refunds do not silently trigger destructive data deletion.
- Owners alone may grant ownership, transfer ownership or delete a business. Admins manage ordinary staff but cannot alter owner memberships. A business must retain an owner.
- Preserve the existing scheduling access while adding enforceable billing checks for **approved, implemented paid capabilities**. Do not invent call quotas, staff/location limits, connect unapproved services, or start charging for features that do not work.
- Account deletion requires explicit confirmation and resolution of billing/sole-owned businesses. Do not invent retention periods or automatically delete other members' business data.

## Implementation

### 1. Protect account and workspace changes

- Prevent admins promoting themselves or others to owner, and protect the last owner across direct writes and invitation paths.
- Fix invitation resend's incorrect returned-value assignment; do not reopen accepted invitations to grant changed privileges.
- Enforce matching business ownership for appointment staff, service and customer references, including direct writes and assistant booking tools.
- Make concurrent appointment writes safe while retaining existing timezone behavior, half-open intervals and back-to-back bookings.

### 2. Make checkout and plan changes consistent

- Replace duplicated price definitions with one validated catalog contract. Validate the configured price, active status, USD monthly recurrence, trial and quantity before opening checkout.
- Initiate purchases for the authenticated account on the server, store the account/transaction association and prevent concurrent or repeated new subscriptions.
- Route existing subscribers from every purchase entry point to the correct plan-change or payment-recovery action.
- Show quoted charge and timing before confirmation; reconcile provider-approved changes before announcing the new plan.
- Implement returning-customer checkout without another trial, and scheduled downgrades only through supported provider behavior. Unsupported cases receive a clear non-destructive message rather than an incorrect charge.

### 3. Repair payment updates and renewal records

- Validate the environment before signature verification. Use generated privileged access only after successful verification.
- Add durable notification IDs, occurrence times and processing state; make subscription/history updates atomic, retryable and resistant to duplicate or out-of-order delivery.
- Recover updates received before subscription creation; quarantine missing mappings instead of acknowledging lost updates.
- Persist actual trial dates, next billing, paid-through dates, successful/failed transactions and relevant financial history.
- Handle already configured transaction completion and payment failure notifications. Do not delete or replace either existing notification destination.
- Add authorized account refresh and reconciliation plus a secured scheduled reconciliation path. Refund synchronization must use available provider data; unavailable refund notification configuration remains an explicit external limitation.

### 4. Complete account and billing journeys

- Add authenticated billing management for payment methods, invoices and cancellation, opening the provider portal in a new tab.
- Display current plan, pending plan change, actual trial dates, next charge, cancellation and payment-recovery state consistently.
- Refetch after billing changes and expire stale displayed access without depending on an unpublished subscription live-update stream.
- Unify email and Google post-signup onboarding and preserve selected plan/destination safely.
- Add password recovery, account settings and a guarded account-deletion workflow consistent with the ownership and billing safeguards above.

### 5. Align delivery and reporting with reality

- Separate shipped scheduling features from unconnected phone answering, SMS, calendar sync, autonomous social replies and knowledge-base features. Do not represent unimplemented features as included working services.
- Resolve incoming social messages through a tenant-owned recipient mapping, rejecting unknown recipients instead of assigning every message to a default business.
- Add a privacy-safe, owner-enabled public schedule if retaining the public-schedule offer; do not expose customer names, notes or contacts.
- Define trial start as a verified provider trial, paid conversion as a completed positive-value payment, and success screens as pending until verified.
- Separate test/live reports; retain historical conversion after cancellation. Centralize OAuth attribution completion, use a bounded attribution window and reject fabricated visit associations.
- Add a shared entitlement boundary for shipped paid features; exact call/staff/location allowances and external integrations stay blocked until supplied, rather than guessing.

## Technical implementation

- Keep TanStack server functions for app actions and signed public server routes for payment callbacks. Runtime must remain Worker-compatible.
- Apply migrations through Lovable Cloud with explicit grants, row-level policies and regression tests. Preserve membership helpers as SECURITY DEFINER with their fixed search path.
- Keep billing environment isolation on every read and mutation. Never accept a browser-supplied account identifier as proof of billing ownership.
- Use a transactional notification processor, a shared subscription selector/lifecycle helper and server-owned checkout associations. Record account authorization independently of commercial entitlements.
- Inspect existing data before constraints or uniqueness changes; stop and report inconsistent data rather than deleting or modifying customer records to force a migration through.
- Add tests for prices/trials, duplicate checkout, proration/timing, environment isolation, event replay/order/failures, role escalation, last-owner safety, concurrent bookings, tenant references and report correctness.

## Verification and preview testing

1. Run the new focused unit and database tests and check the latest preview build result.
2. Walk authenticated onboarding, plan display, billing portal and recovery in a real account; verify changes read back through the app.
3. **Manually complete preview checkout** with `4242 4242 4242 4242`, CVC `123`, any cardholder name and a valid future expiry. Preview charges are fake; this card must not be used on the live site.
4. Verify each plan's trial dates, selected plan and reports after refresh; repeated purchase attempts must not create duplicate subscriptions.
5. Check trial upgrade has no immediate charge and keeps its end date; paid upgrade shows the prorated charge; downgrade keeps the old plan until renewal.
6. Test billing portal card update, invoice access and trial cancellation. Use decline card `4000 0000 0000 0002` for recovery errors. Renewal-failure testing uses `4000 0027 6000 3184` and an explicitly authorized test-only billing-date adjustment.
7. Exercise replay/out-of-order events, renewal/cancellation, role protections and concurrent bookings with isolated fixtures; do not change live subscriptions to test them.
8. Save a concise preview checklist and report which flows passed, which require manual card entry and which remain externally blocked.

## External limitations

- Live checkout approval cannot be fixed in application code. The Payments panel currently requires publication followed by verification and review; do not publish or change live billing without explicit approval.
- Browser automation cannot enter the sealed payment form. Card submission is manual; opening checkout and post-payment app state can be checked automatically.
- Phone/SMS/calendar systems, staffing commitments, sending-domain verification, retention policies and exact paid limits are not established by this audit. No credentials, provider contracts or approvals will be fabricated. These gaps remain named and blocked where implementation depends on them.
- Hosted signup and password settings were not returned by the available project-information read; they remain unverified until an authoritative settings read succeeds.