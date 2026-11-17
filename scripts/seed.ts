import { getTickets, pool, reset, runAndSave } from "../lib/db.ts";
import { grade } from "../lib/agent.ts";
import { callModel, modelName } from "../lib/claude.ts";

for (let i = 0; ; i++) {
  try {
    await pool.query("select 1");
    break;
  } catch (e) {
    if (i === 30) throw e;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await reset();
let passed = 0;
const tickets = await getTickets();
for (const ticket of tickets) {
  const run = await runAndSave(ticket, callModel, modelName());
  const ok = grade(ticket, run);
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${ticket.id} expected ${ticket.expected}, got ${run.outcome}`);
}
console.log(`${passed}/${tickets.length} passed on ${modelName()}`);
await pool.end();
