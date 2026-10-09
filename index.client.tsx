import type { PluginClientContext } from "@getpaseo/plugin/client";
import { OutputSpeed } from "./client/output-speed";
import { measurementSchema, observe } from "./shared/speed";

export default function contribute(client: PluginClientContext) {
  const remove = client.addTimelineRenderer({
    kind: "output-speed",
    version: 1,
    schema: measurementSchema,
    Component: OutputSpeed,
  });
  void client.rpc(observe, {}).catch(error => console.error("Output-speed observation failed", error));
  return () => remove();
}
