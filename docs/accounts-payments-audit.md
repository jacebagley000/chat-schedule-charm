# Accounts and payments audit

Audit date: October 23, 2026. Read-only source investigation plus current catalog, database policy/function/constraint and payment-onboarding reads. No customer billing was changed.

## Current implementation

- **Catalog:** three flat-rate USD monthly prices: Soloist $49, Professional $99, Multi-Location $199. Both test and live provider catalogs were verified: active, quantity exactly one, 14-day trial requiring a payment method. Homepage duplicates the shared catalog in `src/content/marketing.ts`.
- **Authentication:** email/password and Google signup, browser session, protected account routes, authenticated server functions with bearer middleware, membership-based database access. Hosted email confirmation/password/provider settings were not returned by the project information tool and remain unverified. Ordinary signup creates an account; automatic business provisioning requires business-name metadata, so ordinary signup and business signup differ.
- **Purchase:** homepage, checkout review and post-signup checkout can open new checkouts. Browser utility resolves human-readable price IDs through a server function and opens the provider checkout with email, user ID and success URL. Existing subscriptions are not consistently checked. Browser-supplied user metadata is trusted for billing association.
- **Gateway:** `src/lib/paddle.server.ts` uses the Lovable connector gateway with server-only project and connection credentials. Test/live credentials differ. Provider price IDs differ across environments; external IDs are stable.
- **Plan changes:** authenticated functions read the latest subscription owned by the user and preview/update provider items. Trial changes use `do_not_bill`; all other changes use `prorated_immediately`, including downgrades. Provider catalog confirms the trial configuration; preservation of trial expiry during a change still needs an actual provider-backed test.
- **Billing records:** subscription-created/updated/canceled notifications update `public.subscriptions`. Signature verification precedes writes. Transaction-completed and payment-failed notifications are configured but ignored by the app. Platform payment analytics has a separate notification destination; it is not a replacement for the app destination.
- **Account view:** dashboard and customer portal show the user's current subscription and workspace appointments. Billing belongs to a user, not a business. Portal lacks an authenticated manage-billing link for cards, invoices and cancellation. No complete password recovery, account settings or deletion journey was located.
- **Entitlement:** browser helper and database boolean consider active/trialing/past-due with an unexpired or absent period end usable, plus canceled rows with a future end. Membership—not a purchased plan—currently controls scheduling operations. No paid tier limits or call metering were located.
- **Renewal:** provider owns recurring billing; notification updates are expected to refresh dates/status. There is no durable payment ledger, notification inbox, event ordering or reconciliation job in the inspected app.

## Verified current gaps

### Critical account and tenant protections

1. **Admin-to-owner escalation:** deployed membership INSERT/UPDATE/DELETE policies allow owners and admins to assign/remove owner memberships without last-owner protection. Invitation role assignment needs the same protection. Keep membership helpers SECURITY DEFINER to avoid recursion.
2. **Invitation resend failure:** deployed `resend_business_invitation` assigns returned UUID/token/timestamp into incorrectly typed duplicate variables. Must correct and regression-test resend and accepted-invitation behavior.
3. **Concurrent double booking:** deployed appointment trigger checks existing committed rows without a serialization/exclusion constraint; concurrent writes can both pass. Preserve half-open intervals and ignore canceled/no-show rows.
4. **Tenant-consistent references:** deployed appointment foreign keys independently reference business, customer, service and staff; they do not enforce that all belong to the same business. Booking tools need active staff/service validation too.
5. **Meta tenant mapping:** inbound messages all use a configured default business instead of verified recipient-to-business mapping. Multi-tenant onboarding is unsafe without mapping and isolation.

### Purchase and billing reliability

6. Multiple purchase entry points can create duplicate recurring subscriptions. Latest-row selection can hide a still-valid older subscription.
7. Checkout ownership metadata is browser-controlled; create purchases for the authenticated billing owner on the server with a stored association and concurrency protection.
8. Public price resolution lacks strict plan/environment validation, response checks and ambiguous-match detection.
9. Subscription writes do not check returned database errors; missing user/price mappings are silently acknowledged. Failed synchronization can leave a paying account locked or a canceled account usable.
10. No durable notification IDs/timestamps or atomic state/history updates. Retries, out-of-order creation/update and parallel deliveries can regress status and double-count plan changes.
11. Current database Realtime publication includes appointments and leads, **not subscriptions**. Immediate upgrade confirmation depends on notifications but does not reconcile/refetch confirmed state. UI reports success too early.
12. Webhook environment query is unchecked; invalid values can use live credentials and write incorrectly labeled rows. Signature verification is not bypassed, but isolation and configuration handling need strict validation.
13. Trial start/end and next-billing dates are not persisted distinctly. Missing period ends can produce indefinite access. Scheduled and immediately effective cancellations are conflated.
14. Customer portal cannot manage payment methods, invoices, cancellation or recovery. Past-due status needs clear recovery actions.
15. Completed payment and failed payment notifications are ignored. Refunds are delegated to provider support, but local refund/payment audit and refund-related access behavior are absent.
16. No periodic or manual reconciliation for missed notifications or successful changes not synchronized locally.
17. No substantive billing lifecycle tests; existing analytics tests are not proof of payment correctness.

### Product delivery, onboarding and reporting

18. Paid operations and tier limits are not enforced server/database-side. Billing owner, free functionality and each tier's concrete allowances need owner decisions before enforcement.
19. No telephony answering, call metering, outbound social replies, customer calendar sync, SMS/reminder or knowledge-base implementation was located. External systems may exist and must be confirmed. Twelve UI languages do not prove multilingual voice capability. A dedicated account representative is an operational claim, not a code feature.
20. Advertised public schedule lives behind the authenticated layout; a privacy-safe opt-in public view requires a separate design.
21. Ordinary signup promises a workspace but lacks business-name input/provisioning. Email and Google need a single post-signup onboarding and checkout contract.
22. Password recovery, profile changes and account deletion lack complete user journeys. Deletion needs billing cancellation, ownership/data-retention rules and confirmation safeguards.
23. Success URL can emit conversion without a verified purchase. Payment success should be pending until confirmed and conversion must derive from a verified financial event.
24. Deployed signup conversion function does not filter payment environment. Trial reports use latest subscription status, conflate starts with subscription creation and paying with active/past-due, and lose historical conversion after cancellation.
25. Trial attribution stays in browser storage indefinitely and may attach a historical visit to returning users; Google completion is not centralized on all destinations. Define attribution window and use verified signup/trial/payment timestamps.

## External launch blockers

Readiness now passes all policy and site-content checks. Current onboarding explicitly requires publishing the latest changes, then verification and provider review. Live checkout is not enabled until approval; no application code can remove that requirement. No publication or live billing changes were performed during this audit.

## Decisions needed before the implementation plan

1. Subscription owner: user/account across businesses, each business, or another explicit billing account; who can manage it and what ownership transfers do.
2. Actual product scope and limits: free scheduling or paid core, number of locations/staff, Soloist call enforcement and any external voice/SMS/calendar infrastructure.
3. Downgrade timing and credits; repeat-trial eligibility. Keep already requested immediate prorated paid upgrades and deferred trial-change charges.
4. Expiry/payment-failure/refund access and data retention; owner-versus-admin authority and account deletion/last-owner behavior.

## Proposed implementation sequence (to finalize after answers)

1. Account ownership and tenant safety: role boundaries, invitation resend, relational constraints and concurrent booking guarantees.
2. Shared typed catalog and billing owner model; server-owned checkout and duplicate prevention.
3. Durable notification processing, transactional versioned subscription updates, financial records and reconciliation.
4. Unified entitlement rules enforced at data/action boundaries, precise trial/renewal/cancellation dates, reliable account refresh.
5. Billing portal, account recovery/settings and safe onboarding/deletion according to approved rules.
6. Honest enabled-feature presentation, tenant-mapped integrations and privacy-safe public schedule as approved.
7. Verified attribution and historical conversion reporting separated by environment.
8. Focused unit/database/lifecycle tests and authenticated browser verification; document remaining external setup blockers.

## Preview test plan

- Preview uses test payments: no real charges. Use card `4242 4242 4242 4242`, any cardholder name, a valid future expiry and CVC `123`. Never use this on the published live site; never use a real card in preview.
- Create an email account and confirm its email, and separately test Google signup. Complete business onboarding; check the selected plan survives every step.
- Complete each plan's 14-day trial checkout manually. Confirm plan, trial start/end and next billing appear in the account and reports; refresh the page and verify they persist.
- Repeat checkout clicks and visit alternate purchase links as an existing subscriber: no extra subscription or duplicate trial should result.
- Preview and approve a trial plan change: zero charge now and original trial end preserved. Test a paid upgrade: prorated amount shown before confirmation and confirmed plan reflected immediately. Test downgrade using the selected policy.
- Open manage billing in a new tab: invoices, payment-method update and cancellation. Cancel during trial and verify no first renewal; cancel a paid plan and verify the chosen paid-through policy.
- Use decline card `4000 0000 0000 0002` to check recoverable checkout failure. Use `4000 0027 6000 3184` for a renewal-failure scenario, with an explicitly authorized test-only billing-date adjustment.
- Check tenant roles, last-owner protection, invitation resend, simultaneous bookings, expired access and permitted data reads. Verify no cross-business references.
- Replay existing test notifications and test retry/out-of-order fixtures: one payment/plan event, no regression, consistent records. Provider checkout fields cannot be filled by browser automation; card entry and submission are manual. Browser automation can verify opening checkout and resulting app state.
- Live enablement is a separate publish/verification/review process and must not be described as completed by preview testing.