import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Meter } from "./meter";
import type { StreamSample } from "./meter";
import { readVisibleUsage } from "./pi-usage";

type Paseo = PluginHandlerContext["paseo"];
type Agent = Exclude<Parameters<Paseo["agents"]["ref"]>[0], string>;

export class Tracker {
  private meters = new Map<string, Meter>();
  private agents = new Map<string, Agent>();
  private subscriptions = new Map<string, () => void>();
  private lifetime = new AbortController();
  private initialization?: Promise<void>;
  private release?: () => Promise<void>;
  private publishing = new Set<Promise<void>>();

  start(paseo: Paseo) {
    if (!this.initialization) {
      this.initialization = this.initialize(paseo).catch(error => {
        this.initialization = undefined;
        throw error;
      });
    }
    return this.initialization;
  }

  private async initialize(paseo: Paseo) {
    const result = await paseo.agents.list({
      filter: { includeArchived: false },
      subscribe: {},
      signal: this.lifetime.signal,
    });
    this.release = () => result.subscription.release();
    if (this.lifetime.signal.aborted) { await this.release(); return; }
    result.subscription.subscribe({
      snapshot: ({ entries }) => {
        const present = new Set(entries.map(({ agent }) => agent.id));
        for (const id of this.subscriptions.keys()) if (!present.has(id)) this.detach(id);
        for (const { agent } of entries) this.attach(paseo, agent);
      },
      update: message => {
        if (message.type !== "agent_update") return;
        const update = message.payload;
        if (update.kind === "upsert") this.attach(paseo, update.agent);
        else this.detach(update.agentId);
      },
      error: error => {
        for (const meter of this.meters.values()) meter.invalidate();
        console.error("Output-speed agent observation failed", error);
      },
    });
  }

  private detach(agentId: string) {
    this.subscriptions.get(agentId)?.();
    this.subscriptions.delete(agentId);
    this.meters.delete(agentId);
    this.agents.delete(agentId);
  }

  private async publish(paseo: Paseo, agentId: string, sample: StreamSample) {
    let file = this.agents.get(agentId)?.persistence?.nativeHandle;
    if (!file) {
      const handle = paseo.agents.ref(agentId);
      await handle.refresh();
      file = handle.current()?.persistence?.nativeHandle;
    }
    if (!file || this.lifetime.signal.aborted) return;
    // Pi can persist final per-message usage just after the turn completion event.
    for (const wait of [0, 50, 150, 400, 1000]) {
      if (wait) await delay(wait, undefined, { signal: this.lifetime.signal });
      if (this.lifetime.signal.aborted || !this.meters.has(agentId)) return;
      const usage = await readVisibleUsage(file, sample);
      if (!usage) continue;
      await paseo.agents.ref(agentId).timeline.append({
        type: "plugin",
        id: `output-speed-${sample.turnId ?? randomUUID()}`,
        kind: "output-speed",
        version: 1,
        data: { ...usage, milliseconds: sample.milliseconds, timing: "text-stream-itl" },
      });
      return;
    }
  }

  private attach(paseo: Paseo, agent: Agent) {
    if (this.lifetime.signal.aborted || agent.provider.split("/")[0] !== "pi") return;
    this.agents.set(agent.id, agent);
    if (this.subscriptions.has(agent.id)) return;
    const meter = new Meter();
    this.meters.set(agent.id, meter);
    const unsub = paseo.agents.ref(agent.id).timeline.subscribe(({ event }) => {
      const sample = meter.event(event, performance.now());
      if (sample) {
        const pending = this.publish(paseo, agent.id, sample).catch(error => {
          if (!this.lifetime.signal.aborted) console.error("Output-speed measurement failed", agent.id, error?.code ?? error?.name ?? "unknown");
        });
        this.publishing.add(pending);
        void pending.finally(() => this.publishing.delete(pending));
      }
      if (event.type === "error") this.detach(agent.id);
    });
    this.subscriptions.set(agent.id, unsub);
    void unsub.ready.catch(error => {
      meter.invalidate();
      if (this.subscriptions.get(agent.id) === unsub) this.detach(agent.id);
      if (!this.lifetime.signal.aborted) console.error("Output-speed subscription failed", error);
    });
  }

  async stop() {
    this.lifetime.abort();
    for (const id of this.subscriptions.keys()) this.detach(id);
    await this.release?.();
    await Promise.allSettled([...this.publishing]);
  }
}
