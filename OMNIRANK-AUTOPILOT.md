# OmniRank Alpha Autopilot

## Purpose

This is the one-command implementation workflow for the remaining OmniRank Alpha work.

It exists to prevent the repeated cycle of:
prompt → partial implementation → audit → repair prompt → audit → repair prompt.

The autonomous runner must use:
- AGENTS.md
- omnirank-prompts-v2.json
- current repository
- current deployed Supabase schema when available

The original omnirank-prompts.json remains the product-history roadmap. The v2 pack is the execution contract.

---

## Start command for Antigravity

Use this exact instruction:

> Run OMNIRANK-AUTOPILOT from the current main branch. Follow AGENTS.md, docs/FREE-ALPHA-STACK.md, docs/CREDENTIALS-REQUIRED.md and omnirank-prompts-v2.json. Start immediately with the first incomplete phase using the free-first Alpha stack. Do NOT require all future credentials up front. Check only phase-specific credentials immediately before the phase that needs them: existing Supabase for P07, OpenRouter before P08, local WordPress Playground for P10, Google OAuth/GSC/GA4 before P11, and Stripe TEST/Sandbox before P12 billing acceptance. Do not require Cloudflare, R2, AI Gateway, Inngest, WPVibe, Resend or direct OpenAI/Anthropic/Gemini API accounts for Alpha. Before each phase, inspect the real dependency schema/types/routes, build a private acceptance checklist, implement the full vertical slice DB → authorization → types → service/repository → API → UI → behavioral tests → concrete Alpha integration verification, self-audit, run focused tests, then lint/test/build once, remove temporary scripts, commit/push, and continue automatically. Stop only when the NEXT phase lacks a credential it truly requires or another hard blocker occurs. Do not start Beta features.

---

## Autonomous algorithm

## Phase-gated credential checks

Do not run one global credential gate.

- OR-R00 and OR-P07C: proceed with the existing Supabase project.
- Before OR-P08: require OPENROUTER_API_KEY and OPENROUTER_ALPHA_BUDGET_USD.
- OR-P10: use local WordPress via @wp-playground/cli; no hosted WordPress credential is required.
- Before OR-P11: require Google OAuth client credentials plus GSC/GA4 property access.
- Before OR-P12 billing acceptance: require Stripe TEST/Sandbox keys/webhook secret.
- OR-P12 automation: use Supabase Queues/Cron; do not require Inngest.
- Resend/Cloudflare/direct provider credentials are not Alpha prerequisites.

If the next phase-specific credential is missing, stop at that boundary and report only that requirement.

For each phase in `omnirank-prompts-v2.json` after credential preflight passes:

1. **Locate phase**
   - Find the first phase without a passing phase commit / completion evidence.
   - Respect dependencies.

2. **Preflight**
   - Read the phase only.
   - Read real schema migrations/types/routes used by the phase.
   - If database is available, inspect actual schema for changed/query-relevant tables.
   - Never guess table or column names.
   - Build a private matrix: requirement → implementation file → test.

3. **Implement complete vertical slice**
   - database / migration / RLS / RPC
   - TypeScript types
   - repository/service
   - authenticated API
   - UI controls
   - runtime mapping
   - tests

4. **Runtime-contract audit before tests**
   Verify:
   - every SELECT column exists
   - every INSERT/UPDATE uses real DB field names
   - camelCase ↔ snake_case mappings are explicit
   - every UI button has a real handler
   - every handler reaches a real authenticated route
   - every route reaches the intended repository/service/RPC
   - errors fail closed
   - tenant references are validated
   - retries are idempotent where necessary
   - no fake facts/sources/metrics/IDs
   - no provider names leak outside OmniRouter where prohibited

5. **Test**
   - run focused changed-feature tests
   - fix failures
   - then run once:
     - `bun run lint`
     - `bun run test`
     - `bun run build`

6. **Self-audit**
   - Re-read every phase acceptance item.
   - Mark each PASS / EXTERNAL-LIVE-PENDING / HARD-BLOCKER.
   - PASS is forbidden if a known acceptance item is incomplete.
   - Static string tests are not sufficient for runtime/security behavior.

7. **Cleanup**
   - remove temporary fix scripts
   - remove scratch files
   - remove stale commented-out scaffolding
   - retain useful docs/tests

8. **Commit**
   - one phase-specific commit
   - push to main
   - record SHA and test count

9. **Live acceptance**
   - Run the real test/staging integration path for any external service required by the phase.
   - Mocks supplement the suite but cannot replace the live acceptance check.
   - Do not mark PASS while a required live check is pending.

10. **Continue**
   - if PASS → immediately start next phase
   - if a credential/live check or another HARD-BLOCKER fails → stop and report the blocker with evidence

---

## Database deployment rule

Do not silently rewrite deployed migration history.

For a migration that has not yet been deployed:
- it may be edited cleanly during its phase before deployment.

For a migration already deployed:
- create a new forward migration.

If the runner has explicit authorization and a configured authenticated Supabase deployment path, it may deploy the current phase migration after code PASS and run live verification.

Otherwise:
- mark `SUPABASE_DEPLOYMENT_PENDING`
- continue development to the next phase
- do not pretend live DB verification occurred.

---

## External integration rule

Use the concrete free-first Alpha implementation from `docs/FREE-ALPHA-STACK.md`.

1. Do not add a paid service merely because it appeared in an older architecture draft.
2. Keep provider interfaces portable so later production adapters can be added without rewriting business logic.
3. Validate the real Alpha implementation for the phase: Supabase, OpenRouter, local WordPress, Google APIs or Stripe Sandbox as applicable.
4. Never print, commit or log secrets.
5. If a required phase-specific live check fails, stop at that phase boundary.
6. Do not mark a feature complete if only an interface/mock exists while its selected Alpha implementation is untested.

---

## Checkpoints

To reduce manual review time, use only these consolidated audit checkpoints unless a hard blocker occurs:

### Checkpoint A — after OR-P07C
Research engine is code-complete and migration 00013 is ready/live-verified if authorized.

### Checkpoint B — after OR-P10
The complete content production loop exists:
Opportunity → Research → Brief → AI Draft → Quality/Approval → WordPress adapter.

### Checkpoint C — after OR-P13
Full Alpha acceptance.

Do not request a human audit after every ordinary phase.

---

## Final required output

After the autonomous run, return only:

- Completed phases
- Commit SHA per phase
- Test count per phase
- Supabase migrations created/deployed
- Phase-specific credential checks encountered
- Free-first Alpha integration verification per integration-dependent phase
- Hard blockers
- Path to `docs/ALPHA-READINESS.md` if P13 completed

Do not output a long implementation narrative.
