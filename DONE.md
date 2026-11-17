# DONE: gated-support-agent build, 2026-11-17T21:05+11:00

Built in `projects/gated-support-agent` from `BRIEF.md` in `~/.cache/claude-scratch/lorikeet-devrel-2026-11-18/`.
Committed locally on `main`. No remote, nothing pushed, no API key used, no external services.

## What works (verified on this machine)

| Check | How it was verified | Result |
| --- | --- | --- |
| Gate rules | `npm test`, `tests/gate.test.ts`, each test asserts which rule blocked | 9/9 pass |
| Eval set | `tests/eval.test.ts`: 30 tickets through the full loop on the recorded replies | 30/30, plus a count check (12/9/9) |
| Postgres backstop | `tests/db.test.ts`: insert a A$480 refund past the gate | Refused by `refunds_amount_cents_check` |
| Re-run is repeatable | `tests/db.test.ts`: run T01 twice | Same outcome, one refund row |
| All tests | `npm test` with Postgres up | 43/43 pass |
| Tests catch a broken rule | Each rule removed in turn by `gen/sabotage.py` (scratch), tests rerun, file restored | 7/7 sabotages failed their tests; restored run 0 failures (table below) |
| Type check, lint, build | `tsc --noEmit`, `eslint`, `next build` | Clean, no warnings |
| Seed | `npm run seed` | 30/30 passed on scripted |
| Screens | `next start` on :3101, headless Chrome, `page-check.py` at 390 and 1280 | No overflow; only intended ellipsis on list previews |
| Run agent again | CDP click on T13's button | `runs.ran_at` moved from 10:01:15 to 10:05:06 UTC |
| README preview | Rendered with python-markdown, `page-check.py` at 390 and 1280 | ok, ok |

App code: 848 lines across `lib/`, `app/`, `scripts/` (of which `lib/data.ts` is 196 lines of synthetic data).

## Sabotage table

| Rule removed | Change made | Exit | Tests that failed |
|---|---|---|---|
| `unknown-tool` | `if (!TOOL_NAMES.includes(name)) {` to `if (false) {` | 1 | 2: T25; rule unknown-tool |
| `never-close` | `if (name === "close_account") {` to `if (false) {` | 1 | 4: T14, T18, T26; rule never-close |
| `own-txn` | `if (!txn \|\| txn.customerId !== ctx.customerId) {` to `if (!txn) {` | 1 | 2: T22; rule own-txn |
| `not-refunded` | `if (left <= 0) {` to `if (false) {` | 1 | 3: T23, T28; rule not-refunded |
| `amount` | `amount <= 0 \|\| amount > left)` to `amount <= 0)` | 1 | 3: T24, T30; rule amount |
| `ticket-cap` | the cap `if` to `if (false) {` | 1 | 6: T13, T19, T20, T29; both ticket-cap tests |
| `db-check` | `check (amount_cents > 0 and amount_cents <= 10000)` to `check (amount_cents > 0)` | 1 | 1: the Postgres backstop test |

## Screen against the reference (design gate)

References saved in scratch `ref/`: `ic-wide.png` (Intercom Inbox, from intercom.com/inbox) and `bt-small.png`
(Braintrust experiment table, from braintrust.dev docs).

| Region in the design answers | Reference | This screen |
| --- | --- | --- |
| Ticket list with a status chip per ticket | Intercom middle column: avatar, name, preview, time | Avatar with initials, subject, id and preview, chip resolved / escalated / refused |
| Views with counts | Intercom left column (Your inbox 5, Mentions 2...) | All 30, Resolved 12, Escalated 9, Refused 9, each a filter |
| Thread with each tool call as its own row | Intercom centre: customer bubble left, agent bubble right | Customer bubble left, one bordered row per tool call (name, input, allowed or blocked with rule, result), agent bubble right |
| Side panel: customer record | Intercom right Details: USER DATA key and value rows | CUSTOMER rows (name, id, email, plan, since) and TRANSACTIONS |
| Side panel: actions allowed or blocked | not in Intercom; required by the design answers | ACTIONS ON THIS TICKET and GATE POLICY lists with chips |
| Eval tab: row per test ticket, expected against actual, pass or fail, total | Braintrust: numbered rows, Input / Output / Expected columns, score column with a bar, summary row with the average at the top | Numbered rows, Ticket / Input / Output / Expected / Actual / Blocked by / Pass with a bar; summary row (100% 30/30) at the top and a Total row at the bottom |

Kept out, as the design answers say: sign-in, helpdesk integrations, voice, tenants, settings. Not copied from
Intercom: the composer, the icon rail and the AI Copilot tab.

## Decisions you should know (you defend these)

- **The prompt names no limits.** `SYSTEM` in `lib/agent.ts` says only "if a tool returns an error, do what it
  suggests". That is the point of the demo (Lorikeet's "defence in depth" post calls adding rules to the prompt
  "the trap"). Expect live-model scores below 30/30; the gate holds either way.
- **Blocked calls return the reason as a `tool_result` with `is_error: true`**, phrased as a next step ("Call
  escalate for anything larger"). Same idea as Lorikeet MCP's semantic error messages.
- **Outcome is computed from the steps, not asked of the model**: escalated if `escalate` ran, else refused if
  anything was blocked, else resolved. T29 is "refused" even though A$95 was refunded: one call was blocked.
- **The cap is per ticket, summed** (`refundedOnTicketCents`), so splitting A$190 into two A$95 refunds is blocked.
  Partial refunds of one charge are allowed until the charge is used up (`left = amount - refunded`).
- **The fixtures are scripted**, not recordings. Each one is a Messages API shaped turn written to hit a rule.
  `npm run record` replaces them with real turns. The README says so.
- **Every transaction is loaded into memory** for each run (`ponytail:` comment in `lib/agent.ts`). Fine for 20 rows.
- **The DB test resets the shared database.** Run `npm run seed` after `npm test` to refill the screens.
- **Live calls use the beta endpoint with `fallbacks: "default"`** (server-side refusal fallback), and a
  `stop_reason: "refusal"` counts as escalated. Thinking is on by default on `claude-opus-5-5`; the loop passes
  `response.content` back unchanged.
- **Node 24 runs the `.ts` files directly** (`node --test`, `node scripts/seed.ts`), so no build step for scripts.
  Imports carry `.ts` extensions; `tsconfig` has `allowImportingTsExtensions`.

## Dependencies

All are the confirmed stack (Next.js, TypeScript, Postgres, Claude API), so the 25k-star gate did not apply.
Numbers recorded anyway (gh api, 2026-11-17):

| Package | Repo | Stars | Licence | Last push |
| --- | --- | --- | --- | --- |
| `pg` | brianc/node-postgres | 13,238 | MIT | 2026-10-23 |
| `@anthropic-ai/sdk` | anthropics/anthropic-sdk-typescript | 2,179 | Apache-2.0 | 2026-11-16 |
| `next`, `react`, `typescript`, `eslint` | framework and tooling | | MIT / Apache-2.0 | |

`npm ls vite` is empty.

## Could not verify

- **The live model path.** No key was used. `liveModel()`, `npm run record` and the refusal fallback have only
  been type checked against SDK 1.9.0, never run.
- **How Claude scores unguided.** The 30/30 is on scripted turns; the real number is unknown until he runs
  `npm run seed` with a key.
- **A clean clone on another machine.** Built and run only here (Windows, Git Bash, Docker Desktop).

## Hand-back steps

1. Walk the code with `/teach-me` before linking it: `lib/gate.ts`, then `lib/agent.ts`, then `lib/db.ts`.
2. Copy `.env.example` to `.env.local`, add `ANTHROPIC_API_KEY`, run `npm run seed` once and read the score.
   Optionally `npm run record` and commit the new fixtures.
3. Create the GitHub repo and push:
   `git remote add origin git@github.com:Wasif-ZA/gated-support-agent.git && git push -u origin main`
4. Replace `VIDEO_URL_PENDING` in the README once the video link is public.
