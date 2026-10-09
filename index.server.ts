import type { PluginServerContext } from "@getpaseo/plugin/server";
import { Tracker } from "./server/tracker";
import { observe } from "./shared/speed";

export default function contribute(server: PluginServerContext) {
  const tracker = new Tracker();
  server.handle(observe, async (_, { paseo }) => {
    await tracker.start(paseo);
    return {};
  });
  server.before("agent.session_open", async ({ request }, { paseo }) => {
    if (request.purpose === "interactive") await tracker.start(paseo);
  });
  return () => tracker.stop();
}
