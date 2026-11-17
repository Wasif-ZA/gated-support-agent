import { writeFileSync } from "node:fs";
import { customers, tickets, txns } from "../lib/data.ts";
import { grade, runTicket } from "../lib/agent.ts";
import { liveModel, MODEL, type CallModel, type ModelReply } from "../lib/claude.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY in .env.local first (see .env.example).");
  process.exit(1);
}

const replies: Record<string, ModelReply[]> = {};
let passed = 0;
for (const ticket of tickets) {
  replies[ticket.id] = [];
  const recording: CallModel = async (req) => {
    const reply = await liveModel(req);
    replies[ticket.id].push(reply);
    return reply;
  };
  const customer = customers.find((c) => c.id === ticket.customerId)!;
  const run = await runTicket(ticket, customer, txns, recording);
  const ok = grade(ticket, run);
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${ticket.id} expected ${ticket.expected}, got ${run.outcome}`);
}

const note = `Recorded from ${MODEL} on ${new Date().toISOString()}.`;
writeFileSync("tests/fixtures/replies.json", JSON.stringify({ _note: note, model: MODEL, replies }, null, 1) + "\n");
console.log(`${passed}/${tickets.length} passed. Wrote tests/fixtures/replies.json`);
