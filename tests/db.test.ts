import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { getTickets, getTxns, pool, reset, runAndSave, saveRun } from "../lib/db.ts";
import { replayModel } from "../lib/claude.ts";

const up = await pool.query("select 1").then(() => true, () => false);
const opts = { skip: up ? false : "Postgres is not running (npm run db:up)" };

before(async () => { if (up) await reset(); });
after(() => pool.end());

test("Postgres refuses a single refund over A$100 even if the gate lets it through", opts, async () => {
  const run = { ticketId: "T13", outcome: "resolved" as const, steps: [], reply: "", refunds: [{ transactionId: "tx_111", amountCents: 48000 }] };
  await assert.rejects(saveRun(run, "test"), /refunds_amount_cents_check/);
});

test("re-running a ticket starts from the same state and gives the same outcome", opts, async () => {
  const t01 = (await getTickets()).find((t) => t.id === "T01")!;
  const first = await runAndSave(t01, replayModel, "scripted");
  const second = await runAndSave(t01, replayModel, "scripted");
  assert.equal(first.outcome, "resolved");
  assert.equal(second.outcome, "resolved");
  const { rows } = await pool.query("select count(*)::int as n from refunds where ticket_id = 'T01'");
  assert.equal(rows[0].n, 1);
});

test("a refund on one ticket counts against the same transaction on another", opts, async () => {
  const tx = (await getTxns("T99")).find((t) => t.id === "tx_102")!;
  assert.equal(tx.refundedCents, 2490);
});
