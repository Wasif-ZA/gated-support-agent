import { test } from "node:test";
import assert from "node:assert/strict";
import { gate, type GateContext, type Txn } from "../lib/gate.ts";

const txn = (id: string, customerId: string, amountCents: number, refundedCents = 0): Txn => ({
  id, customerId, amountCents, refundedCents, description: "test", createdAt: "2026-11-01",
});
const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  customerId: "C01",
  txns: [txn("mine", "C01", 15000), txn("small", "C01", 2000), txn("theirs", "C02", 2000), txn("done", "C01", 2000, 2000)],
  refundedOnTicketCents: 0,
  ...over,
});
const refund = (transaction_id: string, amount_cents: unknown) => ({ transaction_id, amount_cents, reason: "test" });

function blockedBy(v: ReturnType<typeof gate>) {
  return v.allowed ? "allowed" : v.rule;
}

test("lookup and escalate are always allowed", () => {
  assert.equal(blockedBy(gate("lookup_transactions", {}, ctx())), "allowed");
  assert.equal(blockedBy(gate("escalate", { reason: "x" }, ctx())), "allowed");
});

test("a valid refund under the cap is allowed", () => {
  assert.equal(blockedBy(gate("refund", refund("small", 2000), ctx())), "allowed");
  assert.equal(blockedBy(gate("refund", refund("mine", 10000), ctx())), "allowed");
});

test("rule unknown-tool: a tool the agent was never given is blocked", () => {
  assert.equal(blockedBy(gate("set_credit_limit", { limit: 50000 }, ctx())), "unknown-tool");
});

test("rule never-close: close_account is always blocked", () => {
  assert.equal(blockedBy(gate("close_account", { reason: "customer asked" }, ctx())), "never-close");
});

test("rule own-txn: another customer's transaction is blocked", () => {
  assert.equal(blockedBy(gate("refund", refund("theirs", 500), ctx())), "own-txn");
});

test("rule not-refunded: a transaction refunded in full is blocked", () => {
  assert.equal(blockedBy(gate("refund", refund("done", 500), ctx())), "not-refunded");
});

test("rule amount: more than the charge, zero, negative or fractional is blocked", () => {
  assert.equal(blockedBy(gate("refund", refund("small", 3000), ctx())), "amount");
  assert.equal(blockedBy(gate("refund", refund("small", 0), ctx())), "amount");
  assert.equal(blockedBy(gate("refund", refund("small", -500), ctx())), "amount");
  assert.equal(blockedBy(gate("refund", refund("small", 10.5), ctx())), "amount");
  assert.equal(blockedBy(gate("refund", refund("small", "2000"), ctx())), "amount");
});

test("rule ticket-cap: one refund over A$100 is blocked", () => {
  assert.equal(blockedBy(gate("refund", refund("mine", 12000), ctx())), "ticket-cap");
});

test("rule ticket-cap: splitting a big refund into parts is blocked once the total passes A$100", () => {
  assert.equal(blockedBy(gate("refund", refund("mine", 2000), ctx({ refundedOnTicketCents: 9000 }))), "ticket-cap");
});
