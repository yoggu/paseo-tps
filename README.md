# Paseo TPS

Shows a small `42 tok/s` line below each measurable Pi response in [Paseo](https://paseo.sh). Measures **visible text streaming speed**, not a session average or whole-turn throughput.

## Install

Requires **Paseo 0.11.1 or newer on both app and daemon**, with plugins enabled in **Settings → Plugins**. Plugins run as trusted, unsandboxed code; review the source before enabling them.

```sh
paseo plugin install git:yoggu/paseo-tps
```

Alternatively, enter `git:yoggu/paseo-tps` in Settings → Plugins. Install on the daemon that runs your agents. No separate npm install or build is required: Paseo supplies the runtime libraries.

Use a **native Pi agent** with a configured model provider. The plugin needs Pi's session JSONL file and an explicit per-response reasoning-token count, including zero. No additional API key or plugin configuration is needed.

The installation ID remains `paseo-session-speed` for compatibility:

```sh
paseo plugin update paseo-session-speed
paseo plugin logs paseo-session-speed
paseo plugin remove paseo-session-speed
```

## Measurement

```text
visible tokens = output tokens − reasoning tokens
tok/s = round((visible tokens − 1) / first-to-last text-chunk seconds)
```

Actual counts come from the matching native Pi assistant record. Pi defines reasoning as part of output; it is subtracted, not counted twice. Only the final visible answer is measured. Initial waiting, hidden reasoning and earlier tool/model calls are excluded.

This is a **client-observed approximation**. A chunk can contain several tokens; the conventional inverse-ITL formula assumes one token in the first chunk. Neither provider-side generation timing nor hidden-reasoning generation speed is claimed.

Unsupported providers, missing counts, unmatched session records, single-chunk buffered output, canceled/failed turns and interrupted observations produce **no row**, rather than a guess. Old timeline rows keep their original calculation. Rows survive reconnects, but not a daemon restart.

## Privacy

Reads at most the last 2 MB of the Pi session file reported by Paseo. Response text is compared temporarily in memory and is not written to plugin storage. Only token counts and elapsed time are appended to the agent timeline. The plugin does not read API credentials or make external network requests. With a remote daemon, Paseo delivers these measurements to its connected clients.

See [SECURITY.md](SECURITY.md) for the trust model and dependency limitations.

## Development

Use **Node.js 24+** and npm:

```sh
git clone https://github.com/yoggu/paseo-tps.git
cd paseo-tps
npm ci --ignore-scripts
npm run typecheck
npm test
paseo plugin install "$PWD"
```

After local changes: `paseo plugin reload paseo-session-speed`. Never restart the daemon just to reload this plugin.

## License

[MIT](LICENSE).
