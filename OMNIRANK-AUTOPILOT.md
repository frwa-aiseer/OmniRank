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

> Run OMNIRANK-AUTOPILOT from the current main branch. Follow AGENTS.md and omnirank-prompts-v2.json. Start at the first incomplete phase. Execute phases sequentially without waiting for me between passing phases. Before each phase, inspect only the real dependency schema/types/routes named by that phase, build a private acceptance checklist, then implement the full vertical slice DB → authorization → types → service/repository → API → UI → behavioral tests. Self-audit the runtime contract before committing. Run focused tests, then lint/test/build once per phase. Remove temporary scripts. Commit and push each passing phase separately. Continue automatically to the next phase. Stop only for a hard blocker that cannot be safely resolved or mocked. Missing third-party credentials are not a hard blocker: implement the adapter, deterministic mocks and contract tests, record live verification pending, and continue. Do not start Beta features.

---

## Autonomous algorithm

For each phase in `omnirank-prompts-v2.json`:

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

9. **Continue**
   - if PASS or only EXTERNAL-LIVE-PENDING → immediately start next phase
   - if HARD-BLOCKER → stop and report exactly one blocker with evidence

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

WordPress, GSC, GA4, Stripe, Inngest and live AI providers may lack credentials during implementation.

That must not stop Alpha code completion.

For each missing external credential:
1. implement real adapter/interface
2. validate required env vars
3. add deterministic mock/fixture
4. add contract/integration tests
5. keep production path disabled until credentials exist
6. record the exact live check pending

Never fabricate a successful external connection.

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
- External-live-pending checks
- Hard blockers
- Path to `docs/ALPHA-READINESS.md` if P13 completed

Do not output a long implementation narrative.
