# Dedicated trial funnel

## What will change
- Add a new `/admin/trial-funnel` page focused only on the journey from trial-page visit to payment.
- Show each stage’s visitor count, conversion from the previous stage, total conversion from initial visits, and the number and rate lost between stages.
- Include 30, 90, and 365-day views with refresh, loading, empty, and error states.
- Link the dedicated funnel from the existing trial-conversions report so the two reports remain easy to navigate.

## Technical details
- Reuse the existing admin-gated `admin_trial_signup_funnel` report and existing trial tracking events; no new customer data collection is needed.
- Keep the existing trial-conversions page for account-level outcomes and plan details.
- Give the new admin page private search metadata and its own canonical URL.

## Validation
- Confirm the app builds cleanly.
- Open the new page as the signed-in business account and verify counts, conversion rates, drop-offs, date ranges, and navigation.
