# OmniRank Free-First Alpha Stack

## Decision

OmniRank Alpha must be completed and tested with the fewest external services possible.

The Alpha target is a fully working core loop, not a paid-production infrastructure rehearsal.

Core loop:
Learn → Discover → Research → Create → Verify → Optimize → Approve → Publish → Measure → Learn → Improve.

The application remains vendor-neutral through abstractions, but Alpha uses the following free-first concrete implementations.

## Alpha stack

| Capability | Alpha implementation | Cost target | Later production option |
|---|---|---:|---|
| Database/Auth/RLS/pgvector | Supabase Free | $0 fixed | Supabase Pro or equivalent |
| File/object storage | Supabase Storage | $0 within free quota | Cloudflare R2 or other object store |
| API/backend during Alpha | Existing local Node/Express server + Supabase Edge Functions only where useful | $0 | Cloudflare Workers / other edge runtime |
| Durable queue | Supabase Queues (pgmq) | $0 within Supabase allocation | Inngest or another workflow service if justified |
| Scheduled jobs | Supabase Cron (pg_cron) | $0 within Supabase allocation | Inngest / managed scheduler if justified |
| Serverless background endpoints | Supabase Edge Functions | $0 within free quota | Cloudflare Workers / other |
| AI routing | OmniRouter abstraction with OpenRouter adapter | Use existing OpenRouter credits/free routes | Direct providers / additional adapters / AI gateway |
| AI development route | OpenRouter free models where suitable | $0 model pricing, rate limited | Cheap paid models |
| AI paid smoke/quality route | OpenRouter pay-as-you-go using user's existing credits | hard budget cap | Direct/aggregated providers |
| WordPress integration test | Local WordPress via @wp-playground/cli | $0 | Real hosted WordPress staging/production |
| Search analytics | Google Search Console API | $0 service, quota-limited | Same |
| Website analytics | GA4 Data API | $0 service, quota-limited | Same |
| Billing | Stripe Sandbox/Test | $0 real-money processing | Stripe live |
| Email notifications | In-app notifications for Alpha; Supabase Auth email for auth testing | $0 | Resend or other transactional email |
| Source control / CI | GitHub / GitHub Actions | existing/free | Same |
| Product analytics | Defer unless needed for Alpha acceptance | $0 | PostHog or equivalent |
| Error monitoring | Local/server logs during Alpha | $0 | Sentry or equivalent |

## Explicitly NOT required for Alpha

Do not require these accounts/services to complete Alpha:
- Cloudflare account
- Cloudflare R2
- Cloudflare AI Gateway
- Inngest
- WPVibe
- Resend
- direct OpenAI API account
- direct Anthropic API account
- direct Gemini API account
- paid SEO databases such as DataForSEO/Ahrefs/Semrush

Their adapter boundaries may exist where architecture requires portability, but Alpha acceptance must run on the concrete free-first stack above.

## OpenRouter policy

OpenRouter is the only live AI integration required for OR-P08 Alpha.

OmniRouter remains provider-neutral internally.

For Alpha:
- one OpenRouter API key;
- free route/model for routine development tasks when suitable;
- fallback may be another model/provider available through the same OpenRouter account;
- low-cost paid routes may use the user's existing OpenRouter credits;
- every call records model/provider/tokens/latency/cost;
- enforce a user-configured total Alpha test budget;
- no feature outside the OpenRouter adapter knows OpenRouter model IDs.

This preserves the ability to add direct OpenAI/Anthropic/Gemini adapters later without changing product features.

## WordPress policy

Do not require paid WordPress hosting or WPVibe for Alpha.

OR-P10 must use local WordPress started programmatically with @wp-playground/cli for reproducible integration/E2E testing.

Test the real WordPress REST API behavior:
- authenticate a dedicated integration user;
- create/update draft;
- upload media;
- schedule/publish;
- retrieve remote/local post ID and URL;
- retry idempotently without duplicate posts;
- update an existing OmniRank-managed post.

Production WordPress credentials are a Beta/production deployment concern, not an Alpha blocker.

## Automation policy

Do not require Inngest for Alpha.

Implement AutomationEngine against an internal workflow abstraction.

The Alpha concrete implementation uses:
- Supabase Queues for durable work;
- Supabase Cron for schedules;
- Supabase Edge Functions/local worker for execution;
- workflow_runs/workflow_steps for application-level state, audit, retries and idempotency.

A future Inngest adapter may be added without changing workflow/business logic.

## Storage policy

Use Supabase Storage for Alpha ingestion and private-file tests.

Keep the existing storage abstraction provider-neutral.

Do not make R2-specific types or URLs canonical data.

A future R2 migration must be an adapter/configuration change rather than a Brand Brain redesign.

## Email policy

Transactional email is not part of the original Alpha success loop.

For Alpha:
- use Supabase Auth's development email path for authentication;
- use in-app notification records/UI for workflow notifications;
- do not require Resend.

Add a transactional-email adapter during Beta/production hardening if needed.

## Credential timing

Do not block the entire roadmap on credentials that are only needed later.

### Already available / phase P07
- Supabase project and deployment access.

### Required immediately before P08
- OPENROUTER_API_KEY
- OPENROUTER_ALPHA_BUDGET_USD

### Required immediately before P11
- Google OAuth client credentials
- a Search Console property the user controls
- a GA4 property the user controls

### Required immediately before P12 billing acceptance
- Stripe TEST/Sandbox keys
- Stripe local webhook secret from Stripe CLI or Sandbox webhook endpoint

No other external credential is mandatory for Alpha.

## Completion rule

Free-first does NOT mean half-implemented.

A phase is complete only when:
- its full vertical feature path works;
- DB/RLS/role boundaries are real;
- UI actions are real;
- runtime mappings match the actual schema;
- behavioral and negative tests pass;
- the concrete Alpha integration is exercised end-to-end;
- no placeholder integration is counted as complete.

A paid production integration may be deferred only when the Alpha stack already provides a real working implementation of the same capability behind the approved abstraction.
