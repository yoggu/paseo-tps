export type StreamSample = {
  text: string;
  messageId?: string;
  turnId?: string;
  startedAt: number;
  milliseconds: number;
};

type Event = {
  type: string;
  turnId?: string;
  item?: { type: string; text?: string; messageId?: string; callId?: string; status?: string };
};

export class Meter {
  private active = false;
  private turnId?: string;
  private startedAt = 0;
  private tools = new Set<string>();
  private text = "";
  private messageId?: string;
  private first = 0;
  private last = 0;
  private chunks = 0;
  private oversized = false;

  private resetText() {
    this.text = "";
    this.messageId = undefined;
    this.chunks = 0;
    this.oversized = false;
  }

  invalidate() {
    this.active = false;
    this.tools.clear();
    this.resetText();
  }

  event(event: Event, now: number, wallNow = Date.now()): StreamSample | undefined {
    if (["replacement", "subscription_restored", "error", "turn_failed", "turn_canceled"].includes(event.type)) {
      this.invalidate();
      return;
    }
    if (event.type === "turn_started") {
      this.invalidate();
      this.active = true;
      this.turnId = event.turnId;
      this.startedAt = wallNow;
      return;
    }
    if (!this.active) return;
    if (event.type === "timeline" && event.item) {
      const item = event.item;
      if (item.type === "tool_call" && item.callId) {
        if (item.status === "running") {
          this.tools.add(item.callId);
          this.resetText();
        } else {
          this.tools.delete(item.callId);
        }
      } else if (item.type === "assistant_message" && item.text && !this.tools.size) {
        if (this.messageId && item.messageId && this.messageId !== item.messageId) this.resetText();
        if (this.oversized) return;
        if (!this.chunks) this.first = now;
        this.messageId ??= item.messageId;
        this.text += item.text;
        this.last = now;
        this.chunks++;
        if (this.text.length > 1_000_000) {
          this.resetText();
          this.oversized = true;
        }
      }
    }
    if (event.type === "turn_completed") {
      const sample = this.chunks >= 2 && this.last > this.first && !this.tools.size ? {
        text: this.text,
        messageId: this.messageId,
        turnId: this.turnId,
        startedAt: this.startedAt,
        milliseconds: this.last - this.first,
      } : undefined;
      this.invalidate();
      return sample;
    }
  }
}
