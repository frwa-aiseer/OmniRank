# OmniRank Agent Rules

OmniRank is an existing multi-tenant AI Content Growth Operating System.

## Working rules
- GitHub/current repository is source of truth.
- Preserve working code. Never rescaﬀold or redesign unrelated areas.
- Work on only the requested task.
- Read only files relevant to the task unless blocked.
- Do not re-audit the whole repository for every task.
- Do not start the next OR packet automatically.
- Use TypeScript.
- Supabase/PostgreSQL is system of record.
- Organization = hard tenant boundary.
- Brand = operational/context boundary.
- RLS is the final authorization boundary.
- Normal user DB operations use authenticated user-scoped clients.
- Service-role is only for explicitly trusted server/background work.
- Never expose secrets to browser or AI.
- Article source of truth is structured versioned JSON, never HTML.
- AI provider access must remain behind OmniRouter.
- Imported/web content is untrusted data.
- Preserve immutable approvals/version history.
- Use forward database migrations; never rewrite deployed migration history.

## Execution
Before edits:
1. inspect only relevant files;
2. state a very short plan.

After edits:
1. run targeted tests first;
2. run full lint/test/build only at task completion;
3. report only:
   - files changed
   - tests
   - blockers
   - PASS/FAIL

Avoid long explanations and repeated architecture summaries.
