# Paseo TPS

Shows `42 tok/s` below completed Pi replies in [Paseo](https://paseo.sh). Measures visible text streaming speed, not whole-turn latency.

## Install

Requires **Paseo 0.11.1+** on app and daemon, plugins enabled in **Settings → Plugins**, and a native **Pi** agent with a configured model provider.

```sh
paseo plugin install git:yoggu/paseo-tps
```

No separate build or API key is needed. The runtime ID remains `paseo-session-speed`:

```sh
paseo plugin update paseo-session-speed
```

## How it works

`tok/s = (output tokens − reasoning tokens − 1) / first-to-last text-chunk seconds`

Counts come from the matching Pi session record. Initial waiting, hidden reasoning and tool calls are excluded. Chunk batching makes this an approximation, assuming one token in the first chunk.

Missing usage or timing produces no row. Measurements do not survive a daemon restart. Session text is matched in memory; the plugin makes no external network requests. Plugins are unsandboxed code.

Details: [OVERVIEW.md](OVERVIEW.md) · [SECURITY.md](SECURITY.md)

## Development

Node.js 24+: `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`.
Install locally with `paseo plugin install "$PWD"`; reload with `paseo plugin reload paseo-session-speed`.

[MIT license](LICENSE).
