import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../server/meter.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { Meter } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const text = (meter, value, now, messageId = "reply") => meter.event({
  type: "timeline", item: { type: "assistant_message", text: value, messageId },
}, now);
const start = meter => meter.event({ type: "turn_started", turnId: "turn" }, 0, 10000);

test("only first-to-last text timing is measured, excluding prefill and completion delay", () => {
  const meter = new Meter();
  start(meter);
  meter.event({ type: "timeline", item: { type: "reasoning", text: "thinking" } }, 1000);
  text(meter, "Hello", 5000);
  text(meter, " world", 7000);
  assert.deepEqual(meter.event({ type: "turn_completed" }, 12000), {
    text: "Hello world", messageId: "reply", turnId: "turn", startedAt: 10000, milliseconds: 2000,
  });
  assert.equal(meter.event({ type: "turn_completed" }, 13000), undefined);
});

test("tool-call commentary and tool runtime are not mixed with the final reply", () => {
  const meter = new Meter();
  start(meter);
  text(meter, "Checking", 1000, "comment");
  text(meter, " now", 2000, "comment");
  meter.event({ type: "timeline", item: { type: "tool_call", callId: "a", status: "running" } }, 3000);
  text(meter, "ignored", 4000);
  meter.event({ type: "timeline", item: { type: "tool_call", callId: "a", status: "completed" } }, 20000);
  text(meter, "Final", 25000, "final");
  text(meter, " answer", 27000, "final");
  assert.equal(meter.event({ type: "turn_completed" }, 30000).milliseconds, 2000);
});

test("last model message is measured instead of accumulating several model calls", () => {
  const meter = new Meter();
  start(meter);
  text(meter, "First", 1000, "one");
  text(meter, " reply", 2000, "one");
  text(meter, "Last", 20000, "two");
  text(meter, " reply", 22000, "two");
  const result = meter.event({ type: "turn_completed" }, 25000);
  assert.equal(result.text, "Last reply");
  assert.equal(result.milliseconds, 2000);
});

test("empty chunks do not start or extend the streaming window", () => {
  const meter = new Meter();
  start(meter);
  text(meter, "", 1000);
  text(meter, "Hello", 5000);
  text(meter, " world", 7000);
  text(meter, "", 9000);
  assert.equal(meter.event({ type: "turn_completed" }, 12000).milliseconds, 2000);
});

test("single buffered chunk cannot establish streaming speed", () => {
  const meter = new Meter();
  start(meter);
  text(meter, "All buffered", 5000);
  assert.equal(meter.event({ type: "turn_completed" }, 6000), undefined);
});

test("missing starts, reconnects and failed turns never publish inferred speed", () => {
  for (const type of ["subscription_restored", "replacement", "turn_failed", "turn_canceled"]) {
    const meter = new Meter();
    start(meter); text(meter, "a", 1000); text(meter, "b", 2000);
    meter.event({ type }, 3000);
    assert.equal(meter.event({ type: "turn_completed" }, 4000), undefined);
  }
  const meter = new Meter();
  text(meter, "a", 1000); text(meter, "b", 2000);
  assert.equal(meter.event({ type: "turn_completed" }, 4000), undefined);
});

test("oversized replies and zero-length timing windows are safely skipped", () => {
  const meter = new Meter();
  start(meter);
  text(meter, "x".repeat(1_000_001), 1000);
  text(meter, "tail", 2000);
  assert.equal(meter.event({ type: "turn_completed" }, 4000), undefined);
  start(meter);
  text(meter, "a", 1000); text(meter, "b", 1000);
  assert.equal(meter.event({ type: "turn_completed" }, 4000), undefined);
});
