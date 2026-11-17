import Link from "next/link";
import { getCustomer, getCustomers, getRuns, getTickets, getTxns } from "../lib/db.ts";
import type { Step } from "../lib/agent.ts";
import type { Outcome } from "../lib/gate.ts";
import { rerun } from "./actions.ts";

export const dynamic = "force-dynamic";

const VIEWS: (Outcome | "all")[] = ["all", "resolved", "escalated", "refused"];
const aud = (cents: number) => `A$${(cents / 100).toFixed(2)}`;

function describe(step: Step) {
  const i = step.input;
  if (step.name === "refund") return `${i.transaction_id}, ${typeof i.amount_cents === "number" ? aud(i.amount_cents) : String(i.amount_cents)}`;
  if (step.name === "lookup_transactions") return "this customer";
  return Object.values(i).map(String).join(", ");
}

function resultText(step: Step) {
  if (!step.allowed) return step.result;
  if (step.name === "lookup_transactions") return `${JSON.parse(step.result).length} transactions returned`;
  if (step.name === "refund") return `Refunded ${aud(step.input.amount_cents as number)} to the customer`;
  return "Handed to a person on the support team";
}

const initials = (name = "") => name.split(" ").map((w) => w[0]).join("");

export default async function Inbox({ searchParams }: { searchParams: Promise<{ t?: string; view?: string }> }) {
  const { t, view = "all" } = await searchParams;
  const [tickets, runs, customers] = await Promise.all([getTickets(), getRuns(), getCustomers()]);
  const shown = tickets.filter((k) => view === "all" || runs.get(k.id)?.outcome === view);
  const ticket = tickets.find((k) => k.id === t) ?? shown[0] ?? tickets[0];
  if (!ticket) return <main className="empty">No tickets. Run <code>npm run seed</code>.</main>;

  const run = runs.get(ticket.id);
  const customer = await getCustomer(ticket.customerId);
  const txns = (await getTxns("")).filter((x) => x.customerId === customer.id);
  const count = (v: string) => (v === "all" ? tickets.length : tickets.filter((k) => runs.get(k.id)?.outcome === v).length);
  const blocked = run?.steps.filter((s) => !s.allowed) ?? [];

  return (
    <main className="inbox">
      <aside className="views">
        <h2>Inbox</h2>
        {VIEWS.map((v) => (
          <Link key={v} href={`/?view=${v}`} className={v === view ? "on" : ""}>
            <span className={`dot ${v}`} />
            {v === "all" ? "All tickets" : v[0].toUpperCase() + v.slice(1)}
            <b>{count(v)}</b>
          </Link>
        ))}
      </aside>

      <section className="list">
        <div className="list-head">{shown.length} tickets</div>
        {shown.map((k) => {
          const r = runs.get(k.id);
          return (
            <Link key={k.id} href={`/?view=${view}&t=${k.id}`} className={`row ${k.id === ticket.id ? "on" : ""}`}>
              <span className="avatar">{initials(customers.get(k.customerId))}</span>
              <span className="row-main">
                <span className="row-top">
                  <b>{k.subject}</b>
                  {r && <span className={`chip ${r.outcome}`}>{r.outcome}</span>}
                </span>
                <span className="preview">{k.id} · {k.body}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="thread">
        <div className="thread-head">
          <h1>{ticket.subject}</h1>
          <form action={rerun.bind(null, ticket.id)}>
            <button type="submit">Run agent again</button>
          </form>
        </div>
        <div className="msgs">
          <div className="bubble customer">
            <span className="who">{customer.name}</span>
            {ticket.body}
          </div>
          {run?.steps.map((s, i) => (
            <div key={i} className={`tool ${s.allowed ? "allowed" : "blocked"}`}>
              <span className="tool-name">{s.name}</span>
              <span className="tool-input">{describe(s)}</span>
              <span className={`verdict ${s.allowed ? "allowed" : "blocked"}`}>{s.allowed ? "allowed" : `blocked: ${s.rule}`}</span>
              <span className="tool-result">{resultText(s)}</span>
            </div>
          ))}
          {run && (
            <div className="bubble agent">
              <span className="who">Agent · {run.model}</span>
              {run.reply || "(no reply)"}
            </div>
          )}
          {run && <div className={`end ${run.outcome}`}>Ticket {run.outcome}</div>}
        </div>
      </section>

      <aside className="side">
        <h3>Customer</h3>
        <dl>
          <dt>Name</dt><dd>{customer.name}</dd>
          <dt>ID</dt><dd>{customer.id}</dd>
          <dt>Email</dt><dd>{customer.email}</dd>
          <dt>Plan</dt><dd>{customer.plan}</dd>
          <dt>Since</dt><dd>{customer.since}</dd>
        </dl>
        <h3>Transactions</h3>
        <ul className="txns">
          {txns.map((x) => (
            <li key={x.id}>
              <span>{x.id} {x.description}</span>
              <span>{aud(x.amountCents)}{x.refundedCents > 0 && <em> refunded {aud(x.refundedCents)}</em>}</span>
            </li>
          ))}
        </ul>
        <h3>Actions on this ticket</h3>
        <ul className="acts">
          {run?.steps.map((s, i) => (
            <li key={i}>
              <span>{s.name}</span>
              <span className={`verdict ${s.allowed ? "allowed" : "blocked"}`}>{s.allowed ? "allowed" : "blocked"}</span>
            </li>
          ))}
          {run?.steps.length === 0 && <li className="muted">No tool calls</li>}
        </ul>
        <h3>Gate policy</h3>
        <ul className="acts">
          <li><span>lookup_transactions</span><span className="verdict allowed">always</span></li>
          <li><span>refund, own account, up to A$100 per ticket</span><span className="verdict allowed">gated</span></li>
          <li><span>close_account</span><span className="verdict blocked">never</span></li>
          <li><span>escalate</span><span className="verdict allowed">always</span></li>
        </ul>
        <h3>Eval</h3>
        <dl>
          <dt>Expected</dt><dd>{ticket.expected}{ticket.expectedRule && ` (${ticket.expectedRule})`}</dd>
          <dt>Actual</dt><dd>{run?.outcome ?? "not run"}{blocked.length > 0 && ` (${blocked.map((s) => s.rule).join(", ")})`}</dd>
          <dt>Case</dt><dd>{ticket.note}</dd>
        </dl>
      </aside>
    </main>
  );
}
