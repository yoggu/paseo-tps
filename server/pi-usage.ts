import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { StreamSample } from "./meter";

const MAX_BYTES = 2_000_000;
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function findVisibleUsage(lines: string, sample: StreamSample) {
  let result: { tokens: number; reasoningTokens: number } | undefined;
  for (const line of lines.split("\n")) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const message = entry?.message;
    if (entry?.type !== "message" || message?.role !== "assistant" || !Array.isArray(message.content)) continue;
    if (!Number.isFinite(message.timestamp) || message.timestamp < sample.startedAt - 1000) continue;
    const savedAt = Date.parse(entry.timestamp);
    if (!Number.isFinite(savedAt) || savedAt < sample.startedAt) continue;
    if (message.stopReason !== "stop" && message.stopReason !== "length") continue;
    if (message.content.some((block: { type?: string }) => block?.type === "toolCall")) continue;
    const blocks = message.content.filter((block: { type?: string }) => block?.type === "text");
    if (!blocks.length || blocks.some((block: { text?: unknown }) => typeof block.text !== "string")) continue;
    const text = blocks.map((block: { text: string }) => block.text).join("");
    if (text !== sample.text) continue;
    const output = message.usage?.output;
    const reasoning = message.usage?.reasoning;
    // Pi defines reasoning as a subset of output. Missing breakdown stays unknown.
    if (!integer(output) || !integer(reasoning) || reasoning > output || output - reasoning <= 1) continue;
    result = { tokens: output - reasoning, reasoningTokens: reasoning };
  }
  return result;
}

export async function readVisibleUsage(file: string, sample: StreamSample) {
  if (!isAbsolute(file) || !file.endsWith(".jsonl")) return;
  const handle = await open(file, "r");
  try {
    const { size } = await handle.stat();
    const offset = Math.max(0, size - MAX_BYTES);
    const buffer = Buffer.alloc(Math.min(size, MAX_BYTES));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
    let lines = buffer.subarray(0, bytesRead).toString("utf8");
    if (offset > 0) {
      const newline = lines.indexOf("\n");
      if (newline < 0) return;
      lines = lines.slice(newline + 1);
    }
    return findVisibleUsage(lines, sample);
  } finally {
    await handle.close();
  }
}
