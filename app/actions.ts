"use server";

import { revalidatePath } from "next/cache";
import { getTickets, runAndSave } from "../lib/db.ts";
import { callModel, modelName } from "../lib/claude.ts";

export async function rerun(ticketId: string) {
  const ticket = (await getTickets()).find((t) => t.id === ticketId);
  if (!ticket) throw new Error(`Unknown ticket ${ticketId}`);
  await runAndSave(ticket, callModel, modelName());
  revalidatePath("/");
  revalidatePath("/eval");
}
