---
name: plan-step
description: Implement one step of the expense-tracker build plan, verify it, and commit. Use as /plan-step <N>.
disable-model-invocation: true
---

Implement step $ARGUMENTS of the plan in `~/.claude/plans/pasted-content-id-b9f2-read-spec-md-wise-umbrella.md`.

1. Read the plan's "Key design decisions", "Data model", and step $ARGUMENTS. Do only that step — don't start later steps.
2. Implement it, putting tests next to the code as the plan's "Test organization" section describes.
3. Verify: `npm test`, `npm run typecheck`, `npm run lint`, plus anything the step's *Verify* line names (`npm run build`, `npm run test:e2e` once Playwright exists). Fix failures before continuing.
4. Commit only `expense-tracker/` paths (the git root is the parent dir) with the message `Step $ARGUMENTS: <step title>`.
5. Reply tersely: what was added, any design tradeoff made, and the check results. Then stop.
