import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const compile = source => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString("base64");
const meterUrl = compile(await readFile(new URL("../server/meter.ts", import.meta.url), "utf8"));
const usageUrl = compile(await readFile(new URL("../server/pi-usage.ts", import.meta.url), "utf8"));
const trackerSource = (await readFile(new URL("../server/tracker.ts", import.meta.url), "utf8"))
  .replace('from "./meter"', `from "${meterUrl}"`)
  .replace('from "./pi-usage"', `from "${usageUrl}"`);
const { Tracker } = await import(compile(trackerSource));

test("tracker joins live text timing with native visible tokens and emits one row", async () => {
  const dir = await mkdtemp(join(tmpdir(), "paseo-stream-test-"));
  const file = join(dir, "session.jsonl");
  const rows = [];
  let callback, resolveRow;
  const row = new Promise(resolve => resolveRow = resolve);
  const unsubscribe = Object.assign(() => {}, { ready: Promise.resolve() });
  const agent = { id: "agent", provider: "pi", persistence: { nativeHandle: file } };
  const paseo = { agents: {
    async list() { return { subscription: {
      subscribe(c) { c.snapshot({ entries: [{ agent }] }); }, async release() {},
    } }; },
    ref() { return { timeline: {
      subscribe(c) { callback = c; return unsubscribe; },
      async append(value) { rows.push(value); resolveRow(value); },
    } }; },
  } };
  const tracker = new Tracker();
  const originalNow = performance.now;
  let now = 0;
  performance.now = () => now;
  try {
    await tracker.start(paseo);
    const began = Date.now();
    callback({ event: { type: "turn_started", turnId: "one" } });
    now = 5000; callback({ event: { type: "timeline", item: { type: "assistant_message", text: "Hello", messageId: "message" } } });
    now = 7000; callback({ event: { type: "timeline", item: { type: "assistant_message", text: " world", messageId: "message" } } });
    await writeFile(file, JSON.stringify({ type: "message", timestamp: new Date().toISOString(), message: {
      role: "assistant", timestamp: began, stopReason: "stop", content: [{ type: "text", text: "Hello world" }],
      usage: { output: 115, reasoning: 17 },
    } }) + "\n");
    now = 9000; callback({ event: { type: "turn_completed", turnId: "one" } });
    callback({ event: { type: "turn_completed", turnId: "one" } });
    let timeout;
    try { await Promise.race([row, new Promise((_, reject) => timeout = setTimeout(() => reject(new Error("No row")), 2000))]); }
    finally { clearTimeout(timeout); }
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "output-speed-one");
    assert.deepEqual(rows[0].data, { tokens: 98, reasoningTokens: 17, milliseconds: 2000, timing: "text-stream-itl" });
  } finally {
    performance.now = originalNow;
    await tracker.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("unsupported providers do not receive guessed token speeds", async () => {
  let calls = 0;
  const tracker = new Tracker();
  try {
    await tracker.start({ agents: {
      async list() { return { subscription: {
        subscribe(c) { c.snapshot({ entries: [{ agent: { id: "a", provider: "codex" } }] }); }, async release() {},
      } }; },
      ref() { calls++; },
    } });
    assert.equal(calls, 0);
  } finally { await tracker.stop(); }
});

test("new streaming labels subtract the first token; older row formats keep their original calculation", async () => {
  const source = (await readFile(new URL("../shared/speed.ts", import.meta.url), "utf8"))
    .replace('import { defineRpc } from "@getpaseo/plugin";', "const defineRpc = x => x;")
    .replace('import { z } from "zod";', `import { z } from "${new URL("../node_modules/zod/index.js", import.meta.url).href}";`);
  const { formatSpeed } = await import(compile(source));
  assert.equal(formatSpeed({ tokens: 85, milliseconds: 2000, timing: "text-stream-itl" }), "42 tok/s");
  assert.equal(formatSpeed({ tokens: 98, milliseconds: 2000, timing: "text-stream-itl" }), "49 tok/s");
  assert.equal(formatSpeed({ tokens: 84, milliseconds: 2000, timing: "turn-runtime" }), "42 tok/s");
});
