# OmniRank Required Credentials Before Autopilot

Do not start OR-R00 or any later implementation phase until this credential gate passes.

## Secret-handling rules

- Never commit secrets to Git.
- Never print, echo, log, snapshot, or place secret values in prompts.
- Configure secrets only in local/server environment variables or approved provider secret stores.
- Prefer TEST/STAGING/SANDBOX credentials for billable or destructive integrations.
- Record only PASS/FAIL and non-secret identifiers in reports.

## Required credential groups

### 1. Supabase
Required:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ACCESS_TOKEN
- SUPABASE_PROJECT_REF
- SUPABASE_DB_PASSWORD or equivalent authenticated migration connection

Live preflight:
- authenticate to the target project
- inspect schema
- run a safe read
- verify migration deployment capability

### 2. Cloudflare / R2 / AI Gateway
Required:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN
- R2_BUCKET_NAME
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_ENDPOINT
- CLOUDFLARE_AI_GATEWAY_ID

Live preflight:
- R2 test object write/read/delete
- AI Gateway configuration lookup or safe test route

### 3. WordPress staging/test site
Required:
- WORDPRESS_BASE_URL
- WORDPRESS_USERNAME
- WORDPRESS_APPLICATION_PASSWORD

Live preflight:
- authenticated read
- create/update a staging draft
- remove the test draft if safe

### 4. Google Search Console + GA4
Required:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REFRESH_TOKEN
- GSC_SITE_URL
- GA4_PROPERTY_ID

OAuth scopes must allow Search Console read and Analytics read access.

Live preflight:
- access configured GSC property
- access configured GA4 property
- fetch a small safe date window

### 5. Stripe TEST mode
Required:
- STRIPE_SECRET_KEY
- STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET

Live preflight:
- confirm TEST mode
- perform a safe API read/create test object
- verify webhook signature path

### 6. Inngest
Required:
- INNGEST_EVENT_KEY
- INNGEST_SIGNING_KEY

Live preflight:
- send one test event
- verify request/signature handling

### 7. Live AI routing
Required:
- at least one primary AI provider credential
- a separately testable fallback route/provider credential
- Cloudflare AI Gateway configuration when used
- user-approved maximum live test budget

Live preflight:
- primary route returns valid structured output
- controlled fallback returns valid structured output
- usage/cost event can be recorded

### 8. Resend / email
Required when automation notifications are part of Alpha:
- RESEND_API_KEY
- RESEND_FROM_EMAIL

Live preflight:
- verified sender
- safe test delivery/API call

## Pass rule

Mocks remain required for deterministic automated tests, but mocks do not count as completion of a required live integration.

If any required credential group is missing, invalid, insufficiently scoped, or cannot pass its live preflight, stop before the dependent phase and report the exact non-secret requirement that failed.
