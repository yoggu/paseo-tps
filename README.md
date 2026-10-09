# Paseo output speed

A compact “42 tok/s” row below a completed Pi answer. Version 0.4.0 measures visible text streaming, not whole-turn latency.

```sh
npm install
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-session-speed
```

Requires Paseo app/daemon >=0.11.1 with plugins enabled. The runtime ID remains `paseo-session-speed`; source changes require `paseo plugin reload paseo-session-speed`.

Formula: `(outputTokens - reasoningTokens - 1) / firstToLastTextSeconds`. Token counts are taken from the exact native Pi assistant record, not estimated from character counts or session aggregates. Streaming timestamps come from live Paseo text chunks. One token in the first chunk is assumed, as in the conventional inverse-ITL formula. See [NVIDIA AIPerf's definitions](https://docs.nvidia.com/aiperf/reference/ai-perf-metrics-reference).

Native reasoning counts are read from a bounded tail of the session JSONL path reported by Paseo's persistence handle. The response must match exactly, belong to the current turn, contain no tool-call output and explicitly report its reasoning count. Missing data is skipped. This currently supports native Pi only.

See [OVERVIEW.md](OVERVIEW.md) for privacy and measurement limitations. Old rows keep their original formula; new rows carry `timing: "text-stream-itl"`.
