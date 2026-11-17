import { test } from "node:test";
import assert from "node:assert/strict";
import { customers, tickets, txns } from "../lib/data.ts";
import { grade, runTicket } from "../lib/agent.ts";
import { replayModel } from "../lib/claude.ts";

test("the eval set holds 30 tickets across all three outcomes", () => {
  const count = (o: string) => tickets.filter((t) => t.expected === o).length;
  assert.equal(tickets.length, 30);
  assert.deepEqual([count("resolved"), count("escalated"), count("refused")], [12, 9, 9]);
});

for (const ticket of tickets) {
  test(`${ticket.id} ${ticket.subject} -> ${ticket.expected}`, async () => {
    const customer = customers.find((c) => c.id === ticket.customerId)!;
    const run = await runTicket(ticket, customer, txns, replayModel);
    assert.equal(run.outcome, ticket.expected);
    assert.ok(grade(ticket, run), `expected rule ${ticket.expectedRule} to block a call`);
    assert.ok(run.refunds.reduce((s, r) => s + r.amountCents, 0) <= 10_000, "refunds on one ticket stay under A$100");
  });
}
