import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const source = await readFile(new URL("../server/pi-usage.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { findVisibleUsage, readVisibleUsage } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const sample = { text: "Hello world", startedAt: 10000, milliseconds: 2000 };
const record = (changes = {}) => JSON.stringify({
  type: "message", timestamp: new Date(15000).toISOString(),
  message: { role: "assistant", timestamp: 11000, stopReason: "stop",
    content: [{ type: "text", text: sample.text }], usage: { output: 115, reasoning: 17 }, ...changes },
});

test("actual per-message output excludes the reported hidden reasoning subset", () => {
  assert.deepEqual(findVisibleUsage(record(), sample), { tokens: 98, reasoningTokens: 17 });
});

test("missing or impossible reasoning breakdown is never guessed", () => {
  for (const usage of [{ output: 115 }, { output: 115, reasoning: 116 },
    { output: 115, reasoning: -1 }, { output: 115.5, reasoning: 0 }, { output: 1, reasoning: 0 }]) {
    assert.equal(findVisibleUsage(record({ usage }), sample), undefined);
  }
});

test("zero reasoning is accepted when explicitly reported", () => {
  assert.deepEqual(findVisibleUsage(record({ usage: { output: 115, reasoning: 0 } }), sample),
    { tokens: 115, reasoningTokens: 0 });
});

test("exact streamed text and turn time must match the native message", () => {
  assert.equal(findVisibleUsage(record({ content: [{ type: "text", text: "Different" }] }), sample), undefined);
  assert.equal(findVisibleUsage(record({ timestamp: 1000 }), sample), undefined);
  assert.equal(findVisibleUsage(record().replace(new Date(15000).toISOString(), new Date(9000).toISOString()), sample), undefined);
});

test("messages containing tool-call tokens and canceled output are rejected", () => {
  assert.equal(findVisibleUsage(record({ content: [{ type: "text", text: sample.text }, { type: "toolCall" }] }), sample), undefined);
  assert.equal(findVisibleUsage(record({ stopReason: "toolUse" }), sample), undefined);
  assert.equal(findVisibleUsage(record({ stopReason: "aborted" }), sample), undefined);
});

test("malformed and partially persisted lines do not prevent matching a valid record", () => {
  assert.deepEqual(findVisibleUsage("bad\n" + record() + "\n{", sample), { tokens: 98, reasoningTokens: 17 });
});

test("bounded tail reads handle large native sessions without loading the whole file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "paseo-native-usage-"));
  const file = join(dir, "session.jsonl");
  try {
    await writeFile(file, "x".repeat(2_100_000) + "\n" + record() + "\n");
    assert.deepEqual(await readVisibleUsage(file, sample), { tokens: 98, reasoningTokens: 17 });
    assert.equal(await readVisibleUsage("relative.jsonl", sample), undefined);
    assert.equal(await readVisibleUsage(join(dir, "auth.json"), sample), undefined);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
