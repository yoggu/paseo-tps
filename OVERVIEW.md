# Paseo TPS

Shows a small, muted “42 tok/s” line after each completed, measurable Pi reply. The value is the streaming speed of the final visible answer, not a session average or whole-turn throughput.

For each reply, the plugin reads Pi's actual per-message output and reasoning counts. Pi defines reasoning as a subset of output, so visible text tokens are output minus reasoning. The rate is (visible tokens minus one) divided by the time between the first and last non-empty text chunks. Initial waiting, hidden reasoning and tool execution are not included in that text-stream window. Earlier model calls and tool-call arguments are not added to the final reply's count.

This is a client-observed approximation, not provider-side hardware throughput. Paseo can batch tokens into chunks. The calculation uses the conventional one-token first-chunk assumption; exact first-token timing and chunk token counts are not available. It does not claim generation speed for hidden reasoning.

Requires Paseo app and daemon 0.11.1 or newer, a native Pi provider, and per-message reasoning usage (including an explicit zero). The plugin reads a bounded tail of the native Pi session JSONL file identified by Paseo. It temporarily compares response text to identify the correct usage record. It does not read credentials, persist response text, or send session content externally.

Missing usage or reasoning breakdown, an unmatched native record, single-chunk buffered output, failed/canceled turns and interrupted observations produce no row instead of a guessed value. Other providers are not currently measured because their public token data cannot reliably separate visible text from hidden reasoning.

The value remains right-aligned below the reply. Paseo controls row placement; the built-in copying and timestamp footer is unchanged. Old rows retain their previous calculation. Rows survive timeline refetches and client reconnects, but Paseo's plugin timeline rows do not survive a daemon restart.
