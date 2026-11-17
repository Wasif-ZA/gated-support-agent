import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Block = Anthropic.Beta.BetaContentBlock;
export type ModelReply = { stop_reason: string | null; content: Block[] };
export type ModelRequest = {
  ticketId: string;
  turn: number;
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  messages: Anthropic.Beta.BetaMessageParam[];
};
export type CallModel = (req: ModelRequest) => Promise<ModelReply>;

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const FIXTURES = join(process.cwd(), "tests/fixtures/replies.json");

type Fixtures = { model: string; replies: Record<string, ModelReply[]> };
export const readFixtures = (): Fixtures => JSON.parse(readFileSync(FIXTURES, "utf8"));

export const replayModel: CallModel = async ({ ticketId, turn }) => {
  const reply = readFixtures().replies[ticketId]?.[turn];
  if (!reply) throw new Error(`No recorded reply for ${ticketId} turn ${turn}. Run npm run record with a key.`);
  return reply;
};

export const liveModel: CallModel = async ({ system, tools, messages }) => {
  const res = await new Anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    tools,
    messages,
  });
  return { stop_reason: res.stop_reason, content: res.content };
};

export const callModel: CallModel = (req) => (process.env.ANTHROPIC_API_KEY ? liveModel(req) : replayModel(req));
export const modelName = () => (process.env.ANTHROPIC_API_KEY ? MODEL : readFixtures().model);
