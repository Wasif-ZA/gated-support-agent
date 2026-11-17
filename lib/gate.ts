export type Outcome = "resolved" | "escalated" | "refused";
export type RuleId = "unknown-tool" | "never-close" | "own-txn" | "not-refunded" | "amount" | "ticket-cap";

export type Txn = {
  id: string;
  customerId: string;
  description: string;
  amountCents: number;
  createdAt: string;
  refundedCents: number;
};

export type GateContext = {
  customerId: string;
  txns: Txn[];
  refundedOnTicketCents: number;
};

export type Verdict = { allowed: true } | { allowed: false; rule: RuleId; reason: string };

export const TOOL_NAMES = ["lookup_transactions", "refund", "close_account", "escalate"];
export const TICKET_REFUND_CAP_CENTS = 10_000;

const block = (rule: RuleId, reason: string): Verdict => ({ allowed: false, rule, reason });

export function gate(name: string, input: Record<string, unknown>, ctx: GateContext): Verdict {
  if (!TOOL_NAMES.includes(name)) {
    return block("unknown-tool", `There is no tool called ${name}. Use lookup_transactions, refund or escalate.`);
  }
  if (name === "close_account") {
    return block("never-close", "The agent can never close an account. Call escalate so a person can handle the closure.");
  }
  if (name !== "refund") return { allowed: true };

  const txn = ctx.txns.find((t) => t.id === input.transaction_id);
  if (!txn || txn.customerId !== ctx.customerId) {
    return block("own-txn", "That transaction is not on this customer's account. Call lookup_transactions for the right id.");
  }
  const left = txn.amountCents - txn.refundedCents;
  if (left <= 0) {
    return block("not-refunded", `Transaction ${txn.id} was already refunded in full. Tell the customer nothing is left to refund.`);
  }
  const amount = input.amount_cents;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > left) {
    return block("amount", `A refund on ${txn.id} must be between 1 and ${left} cents.`);
  }
  if (ctx.refundedOnTicketCents + amount > TICKET_REFUND_CAP_CENTS) {
    return block("ticket-cap", "Refunds on one ticket are capped at A$100 in total. Call escalate for anything larger.");
  }
  return { allowed: true };
}
