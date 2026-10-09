# Security

## Trust and data access

Paseo plugins are trusted, unsandboxed code. This plugin reads a bounded tail of the native Pi session JSONL path reported by Paseo. It temporarily compares visible response text to select the correct per-message usage, then appends only counts and elapsed time to the agent timeline.

There is no plugin-owned external network request, telemetry, credential storage or persistent copy of response text. Paseo transports timeline data between the daemon and its connected clients. Do not share native session logs when reporting a speed issue; report sanitized counts, durations and versions instead.

## Reporting a vulnerability

Do not post credentials, session logs, private diffs or exploit details in a public issue. Use GitHub's private vulnerability reporting if enabled, or contact the maintainer privately. Rotate any exposed credential immediately; deleting it from the latest commit does not remove it from Git history.

## Dependencies and verification

Runtime host libraries are supplied by Paseo. Keep the app and daemon updated; their dependency security is outside this repository's control.

Development installs include Paseo-compatible React Native tooling. At the latest preparation check, `npm audit` reported 20 development-dependency findings (15 high, 5 moderate), while `npm audit --omit=dev` reported zero. Compatible `npm audit fix` did not resolve these; blindly forcing a React Native major upgrade would break the host/tooling alignment. These development dependencies are not bundled into the plugin or installed for normal Git-source use. Use a trusted development checkout, `npm ci --ignore-scripts`, and review future upstream fixes.

Gitleaks scans and manual review found no credentials in the inspected Git history or working tree. A scan is not a proof of absence or a complete security audit. Git history retains author metadata. No history rewrite has been performed.
