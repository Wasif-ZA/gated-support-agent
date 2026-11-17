import Link from "next/link";
import { getRuns, getTickets } from "../../lib/db.ts";
import { grade } from "../../lib/agent.ts";

export const dynamic = "force-dynamic";

export default async function Eval() {
  const [tickets, runs] = await Promise.all([getTickets(), getRuns()]);
  const rows = tickets.map((t) => {
    const run = runs.get(t.id);
    const rules = run?.steps.flatMap((s) => (s.rule ? [s.rule] : [])) ?? [];
    return { t, run, rules, pass: run ? grade(t, run) : false };
  });
  const passed = rows.filter((r) => r.pass).length;
  const pct = tickets.length ? (100 * passed) / tickets.length : 0;
  const model = [...runs.values()][0]?.model ?? "none";

  return (
    <main className="eval">
      <div className="crumbs">
        Experiments / <b>gate-eval · {model}</b>
      </div>
      <table>
        <thead>
          <tr>
            <th className="num" />
            <th>Ticket</th>
            <th>Input</th>
            <th>Output</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>Blocked by</th>
            <th>Pass</th>
          </tr>
          <tr className="summary">
            <td />
            <td colSpan={5}>{tickets.length} test tickets</td>
            <td>{rows.filter((r) => r.rules.length).length} blocked</td>
            <td>
              <b>{pct.toFixed(0)}%</b> <span className="muted">{passed}/{tickets.length}</span>
            </td>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ t, run, rules, pass }, i) => (
            <tr key={t.id}>
              <td className="num">{i + 1}</td>
              <td><Link href={`/?t=${t.id}`}>{t.id}</Link></td>
              <td className="clip">{t.body}</td>
              <td className="clip">{run?.reply ?? "not run"}</td>
              <td>
                <span className={`chip ${t.expected}`}>{t.expected}</span>
                {t.expectedRule && <span className="rule">{t.expectedRule}</span>}
              </td>
              <td>{run && <span className={`chip ${run.outcome}`}>{run.outcome}</span>}</td>
              <td className="mono">{rules.join(", ")}</td>
              <td className={pass ? "pass" : "fail"}>
                {pass ? "100%" : "0%"}
                <span className="bar"><span style={{ width: pass ? "100%" : "0%" }} /></span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td colSpan={6}>Total</td>
            <td><b>{passed}/{tickets.length} passed</b></td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}
