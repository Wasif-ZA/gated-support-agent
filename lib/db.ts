import pg from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Txn } from "./gate.ts";
import { customers, tickets, txns, type Customer, type Ticket } from "./data.ts";
import { runTicket, type Run, type Step } from "./agent.ts";
import type { CallModel } from "./claude.ts";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:55441/postgres",
});

export type SavedRun = { ticketId: string; outcome: Run["outcome"]; steps: Step[]; reply: string; model: string };

export async function reset() {
  await pool.query(readFileSync(join(process.cwd(), "lib/schema.sql"), "utf8"));
  for (const c of customers) {
    await pool.query("insert into customers values ($1, $2, $3, $4, $5)", [c.id, c.name, c.email, c.plan, c.since]);
  }
  for (const t of txns) {
    await pool.query("insert into transactions values ($1, $2, $3, $4, $5, $6)", [
      t.id, t.customerId, t.description, t.amountCents, t.createdAt, t.refundedCents,
    ]);
  }
  for (const t of tickets) {
    await pool.query("insert into tickets values ($1, $2, $3, $4, $5, $6, $7)", [
      t.id, t.customerId, t.subject, t.body, t.expected, t.expectedRule, t.note,
    ]);
  }
}

export async function getTickets(): Promise<Ticket[]> {
  const { rows } = await pool.query("select * from tickets order by id");
  return rows.map((r) => ({
    id: r.id, customerId: r.customer_id, subject: r.subject, body: r.body,
    expected: r.expected, expectedRule: r.expected_rule, note: r.note,
  }));
}

export async function getCustomer(id: string): Promise<Customer> {
  const { rows } = await pool.query("select id, name, email, plan, to_char(since, 'YYYY-MM-DD') as since from customers where id = $1", [id]);
  return rows[0];
}

export async function getCustomers(): Promise<Map<string, string>> {
  const { rows } = await pool.query("select id, name from customers");
  return new Map(rows.map((r) => [r.id, r.name]));
}

// Refunds made by this ticket's earlier run are left out so a re-run starts from the same state.
export async function getTxns(exceptTicketId: string): Promise<Txn[]> {
  const { rows } = await pool.query(
    `select t.id, t.customer_id, t.description, t.amount_cents, to_char(t.created_at, 'YYYY-MM-DD') as created_at,
            t.refunded_before_cents + coalesce(sum(r.amount_cents), 0)::int as refunded_cents
       from transactions t left join refunds r on r.transaction_id = t.id and r.ticket_id <> $1
      group by t.id order by t.created_at desc, t.id`,
    [exceptTicketId],
  );
  return rows.map((r) => ({
    id: r.id, customerId: r.customer_id, description: r.description,
    amountCents: r.amount_cents, createdAt: r.created_at, refundedCents: r.refunded_cents,
  }));
}

export async function getRuns(): Promise<Map<string, SavedRun>> {
  const { rows } = await pool.query("select * from runs");
  return new Map(rows.map((r) => [r.ticket_id, { ticketId: r.ticket_id, outcome: r.outcome, steps: r.steps, reply: r.reply, model: r.model }]));
}

export async function saveRun(run: Run, model: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from refunds where ticket_id = $1", [run.ticketId]);
    for (const r of run.refunds) {
      await client.query("insert into refunds (ticket_id, transaction_id, amount_cents) values ($1, $2, $3)", [
        run.ticketId, r.transactionId, r.amountCents,
      ]);
    }
    await client.query(
      `insert into runs (ticket_id, outcome, steps, reply, model) values ($1, $2, $3, $4, $5)
       on conflict (ticket_id) do update set outcome = $2, steps = $3, reply = $4, model = $5, ran_at = now()`,
      [run.ticketId, run.outcome, JSON.stringify(run.steps), run.reply, model],
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function runAndSave(ticket: Ticket, callModel: CallModel, model: string) {
  const run = await runTicket(ticket, await getCustomer(ticket.customerId), await getTxns(ticket.id), callModel);
  await saveRun(run, model);
  return run;
}
