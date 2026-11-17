# Gated support agent

A support desk for a made-up fintech where the AI agent can only do what a permission gate allows.
The agent is safe because the gate says no, not because the prompt asks nicely.

**Demo:** [watch the video](VIDEO_URL_PENDING).

[Run it](#run-it) · [Test the rules](#test-the-rules) · [How it works](#how-it-works)

<picture><source media="(max-width: 600px)" srcset="docs/hero-phone.png"><img src="docs/hero.png" alt="A Kestrel Pay ticket asking for a A$250 fee refund in parts. The thread shows a lookup and a A$90 refund allowed, the second A$90 refund blocked by ticket-cap, then an escalation to a person."></picture>

## The idea

Most teams fix a misbehaving support agent by adding to the prompt: "never refund more than A$100", "never close
an account". Every rule competes with the real job, and naming the forbidden thing puts it in every context.

Here the prompt says nothing about limits. Every tool call the model makes goes through one pure function,
`gate()`, before it runs. A blocked call never runs. The model gets the reason and the next allowed step back as
the tool result, so it can recover, usually by escalating to a person.

| Rule | What it stops |
| --- | --- |
| `unknown-tool` | A tool the agent was never given, such as `set_credit_limit` from a prompt injection |
| `never-close` | Closing an account, always |
| `own-txn` | Refunding another customer's transaction, or one that does not exist |
| `not-refunded` | Refunding a charge that was already refunded in full |
| `amount` | Refunding zero, a negative, a fraction, or more than is left on the charge |
| `ticket-cap` | More than A$100 refunded on one ticket, including one big refund split into small ones |

Postgres backs the last rule up: `refunds.amount_cents` has `CHECK (amount_cents <= 10000)`, so a bug in
`gate()` still cannot write a single large refund.

## Run it

You need Node 24+ and Docker. No API key needed.

```bash
git clone https://github.com/Wasif-ZA/gated-support-agent
cd gated-support-agent
npm install
npm run db:up      # Postgres 17 in Docker on port 55441
npm run seed       # loads 30 tickets and runs the agent on each
npm run build && npm start
```

Open http://localhost:3101. Pick a ticket to see each tool call as its own row, allowed or blocked, with the
reason. **Run agent again** re-runs that ticket. The **Eval** tab scores all 30.

<img src="docs/gate.gif" alt="Clicking through four tickets: a split refund escalated at the A$100 cap, a refund of another customer's transaction refused, a prompt injection asking for set_credit_limit refused as unknown-tool, a second A$95 refund blocked, then the Eval tab showing 30 of 30 passed.">

### Recorded replies and the live model

Without a key, the agent reads its turns from `tests/fixtures/replies.json`. Those are **scripted** turns in the
Messages API response shape, written to exercise every rule. They are not live model output. The gate, the
loop, the database and the screens all run for real on them.

To use Claude, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` (model `claude-opus-5-5` unless
`CLAUDE_MODEL` says otherwise). Then:

- `npm run seed` runs all 30 tickets on the live model and prints the score.
- `npm run record` does the same and saves the replies as the new fixtures, so tests replay real model turns.

The system prompt in `lib/agent.ts` mentions no limits on purpose. Live scores show what the model does
unguided; the gate holds either way.

## Test the rules

```bash
npm test
```

43 tests, no key needed:

- `tests/gate.test.ts`: one test per rule, each with a case only that rule catches, asserting which rule blocked.
- `tests/eval.test.ts`: the 30-ticket eval set (12 resolved, 9 escalated, 9 refused) through the full agent loop.
- `tests/db.test.ts`: Postgres refuses a A$480 refund even when the gate is bypassed, and a re-run starts from the
  same state. Skipped if Postgres is not running. It resets the database, so run `npm run seed` afterwards.

Each rule was removed on purpose and its tests failed; see the sabotage table in `DONE.md`.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img src="docs/architecture.svg" width="960" alt="Seven steps: a ticket goes to callModel, each tool_use goes through gate, allowed calls run and blocked calls return the reason, both go back to the model for the next turn, the final reply sets the outcome, Postgres stores the run with a CHECK backstop, and the Inbox and Eval screens read it.">
</picture>

Outcome rules: **escalated** if `escalate` ran, else **refused** if any call was blocked, else **resolved**.

## Files

| File | What it does |
| --- | --- |
| `lib/gate.ts` | The six rules. Pure, no I/O |
| `lib/agent.ts` | The tool loop, tool schemas, system prompt, outcome and grading |
| `lib/claude.ts` | `callModel()`: the Anthropic SDK with a key, recorded replies without |
| `lib/schema.sql` | Tables and the refund `CHECK` |
| `lib/db.ts` | Loads state, saves a run and its refunds in one transaction |
| `lib/data.ts` | Six customers, 20 transactions, 30 tickets with the expected outcome |
| `app/page.tsx` | Inbox: ticket list, thread with tool rows, customer panel |
| `app/eval/page.tsx` | Eval table: expected against actual, pass or fail, total |
| `scripts/seed.ts`, `scripts/record.ts` | Run every ticket; record live replies as fixtures |

Kestrel Pay is made up. Every customer, transaction and ticket is synthetic.
