# Micro-plans

One file per phase of the remediation master plan, named `phase-NN-slug.md`.

## The loop

1. **Write the micro-plan.** Break the phase into tasks small enough that each one names the file and the line it touches. If a task cannot be described that precisely, it has not been thought through yet.
2. **Get it approved.** Before any code is written. This is the cheap moment to disagree about scope.
3. **Build it.** Follow the plan. If the plan turns out to be wrong mid-flight, stop and say so rather than quietly improvising — the divergence is worth a conversation.
4. **Verify it.** Against the criteria the plan wrote down in advance, not criteria invented afterwards to fit what was built.
5. **Append to [../WORKLOG.md](../WORKLOG.md).** What changed, how it was verified, what was deferred, what risk remains.
6. **Tick the phase off in the master plan**, and confirm the next phase's preconditions still hold.

## Rules

**Plans are not edited after the work starts.** If reality diverged, the work log records the divergence. A plan that has been quietly retrofitted to match what happened is worthless as a record and slightly worse than no plan at all.

**Every plan states what is out of scope.** Most of the cost of a phase is the work that leaks into it. Naming the boundary in advance makes it possible to say "that is Phase 6" without relitigating.

**Every plan states how it rolls back.** Usually a `git revert` of a named commit. If a phase cannot be rolled back — a destructive migration, for instance — that fact belongs at the top of the plan in bold, not discovered afterwards.

**Commits are split along revert lines.** If the risky part of a phase should be revertable without losing the safe part, they are separate commits.

Start from [_TEMPLATE.md](_TEMPLATE.md).

## Index

| Phase | Plan | Status |
|---|---|---|
| 0 | [Audit refresh and emergency copy fix](phase-00-audit-refresh.md) | Complete |
| 1 | [Authorization foundation](phase-01-authorization-foundation.md) | Complete |
| 2 | [Guard retrofit](phase-02-guard-retrofit.md) | Complete |
| 3 | [Capability-based RBAC](phase-03-rbac.md) | Complete |
| 4 | [Runtime validation with zod](phase-04-validation.md) | Complete |
