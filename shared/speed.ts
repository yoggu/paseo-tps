import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const observe = defineRpc({
  name: "output-speed.observe",
  input: z.object({}),
  output: z.object({}),
});

export const measurementSchema = z.object({
  tokens: z.number().finite().nonnegative(),
  milliseconds: z.number().finite().positive(),
  timing: z.enum(["turn-runtime", "text-stream-itl"]).optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
});

export function formatSpeed(measurement: z.output<typeof measurementSchema>) {
  const tokens = measurement.timing === "text-stream-itl" ? Math.max(0, measurement.tokens - 1) : measurement.tokens;
  return `${Math.round(tokens * 1000 / measurement.milliseconds)} tok/s`;
}
