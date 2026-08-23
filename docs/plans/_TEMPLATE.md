# Phase N Micro-Plan — <title>

**Parent:** master plan, Phase N
**Depends on:** <phases that must land first, or "nothing">
**Blocks:** <phases that cannot start until this lands>
**Estimated effort:** <hours or days>
**Risk:** <low / medium / high, and one sentence on why>

## Why this is next

What breaks today, for whom, and what it costs. Written for someone who has not read the audit. If this section is hard to write, the phase may not be worth doing yet.

## Preconditions

Branch, base commit, tree state, environment, anything that must already be true. Include the things that have bitten before.

## Task group A — <name>

State the rule the group follows, then the individual edits. Each task names the file and the line.

### A1. <task>

`path/to/file.ts:LINE`

Current behaviour, intended behaviour, and the change. Show the before and after where the diff is small enough to read.

### A2. Verify, do not assume

Tasks where the plan is uncertain about the current state. Say what to check and what each outcome implies. Never instruct a change to something that has not been read.

## Task group B — <name>

## Verification

Numbered, and checkable by someone who did not do the work. Prefer commands with an expected output over "confirm it works".

1. `<command>` → expected: `<output>`
2. Manual: as `<role>` on `<url>`, `<action>` → expected: `<result>`
3. Confirm untouched behaviour is genuinely untouched — name what must still happen.

## Commits

One per revert boundary, with the message.

1. `<type>: <message>`

## Rollback

How to undo, and anything that cannot be undone.

## Out of scope

What this phase deliberately does not do, and which phase owns it instead. If a genuine bug surfaces while working, record it in the audit rather than fixing it here.

## On completion

Append the work log entry, set this phase to complete in the master plan, confirm the next phase's preconditions.
