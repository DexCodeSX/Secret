# changelog

all dates UTC. format: keep it simple.

## v2.4.2 — 2026-04-23

`bon codex` now actually uses OpenAI. before this, codex sent `gpt-5.2-codex` (its internal name) and api.js silently rewrote it to `claude-opus-4-6` — codex thought it was using GPT but the router executed Claude. since we proved bonsai router accepts real `gpt-5` / `o3` / etc (199 of 213 models work, see MODELS.md), the redirect made no sense.

changes:
- api.js modelMap rewritten:
  - `gpt-5.2-codex` → `gpt-5` (real openai)
  - `gpt-5-codex` → `gpt-5`
  - `gpt-5.2` → `gpt-5`
  - `codex-mini` → `gpt-5-mini`
  - `gpt-4.1` → `gpt-4-turbo`
  - `gpt-4.1-mini`/`nano` → `gpt-4o-mini`
  - `o3` / `o3-mini` / `o3-pro` / `o4-mini` — pass through (router takes them directly)
- bonsai.js launchCodex forces `-c model="gpt-5"` by default unless user passed `--model`
- live verified: `gpt-5.2-codex` → returns "openai-confirmed", `o3` and `gpt-5` direct also work

usage:
```
bon codex                          # defaults to gpt-5
bon codex --model o3               # use o3 reasoning
bon codex --model claude-opus-4-7  # if u want claude back, override explicitly
bon codex exec "fix this bug"      # one-shot
```

## v2.4.0 — 2026-04-23

new stuff:
- `--anon` mode for api.js. each request gets fresh random `device_id`, `session_id`, `x-claude-code-session-id`. OS/arch headers go generic. bonsai router still sees prompt+response (cant hide that, they validate it) but they cant link your sessions anymore. opt in: `bon api --anon` or env `BONSAI_ANON=1`
- `bon agents` — checks what u got installed (cline / cursor / aider / continue / roo / opencode / codex / etc) and prints exact env vars or settings to point them at the proxy. one command, no docs lookup
- `bon dash` — live ANSI dashboard. polls `/stats` every 1s. shows uptime, req count, ok/err split, token totals, full pool view (active key + fresh/limited badges), 30s req/s sparkline. ctrl+c to quit
- smarter rate-limit absorption: when a request hits a limited key, api.js loops thru EVERY fresh pooled key inside the same call. client only sees 429 when ALL keys dead. cline/cursor stop crashing on first limit hit
- `/stats` now exposes `pool[]` (name, masked key, limited bool, active bool), `poolFresh`, `poolLimited`, `anon`, `version`. machine readable

fix:
- nothing broken from 2.3.0 reported. just additions

## v2.3.0 — 2026-04-23

new:
- codex flags fully documented in `bon --help`. all 9 subcommands (`exec`, `resume`, `fork`, `apply`, `review`, `mcp`, `plugin`, `cloud`, `sandbox`) and every flag (`-c key=val`, `-s sandbox`, `--full-auto`, `--search`, `-p profile`, `-i image`, etc)
- `bon cc` and `bon codex` direct shortcuts. skip the `bon start` picker. all flags forward straight thru
- 503 vs 429 now actually different things. 503 = no key set. 429 + Retry-After header + structured body = all keys hit daily cap. cline can back off properly now
- transient upstream 5xx auto-retries once after 500ms. router blips dont kill your request anymore
- `@bonsai-ai/claude-code` UA bumped 2.1.92 → 2.1.112. npm shipped 20 patches in 16 days. router was rejecting old fingerprint
- UI v3: braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`), pill-style status badges with rounded ends, refined cool palette, animated banner with tagline, NO_COLOR support so log files dont get ansi garbage

## v2.2.0 — 2026-04-11

new:
- `bon update` interactive self-update. detects platform (termux/linux/macos/cmd/powershell) and runs the right installer with a Y/n prompt
- `bon bench` — benchmark all 6 models side by side. response time, tok/s, ranked table. flags: `--parallel`, `--verbose`, `--prompt="..."`
- `bon fingerprint` — shows everything router can see about ur machine. device hash, external ip, headers, system prompt hash, local storage tree

## v2.1.0 — 2026-04-10

big:
- codex actually works now. `bon start` option 2 auto-launches `api.js` proxy in background, codex talks to local `/responses` endpoint, api.js translates to anthropic
- router fingerprint cracked. exact bytes the router validates: cc system prompt JSON array w/ billing header, metadata w/ `device_id`, `?beta=true` query, full SDK headers (user-agent, anthropic-beta, x-stainless-*)
- all 6 models confirmed working thru the proxy
- `bon models` lists them all
- `api.js` auto-captures cc system prompt on first run (spawns brief CC session, intercepts the prompt, saves to `cc_system.json`)
- `streamCollect()` fix: router returns empty content on non-stream. api.js now always streams internally + collects chunks. both stream + non-stream calls work
- switched all proxy fetches from `https.request` (HTTP/1.1) to `fetch` (HTTP/2). router rejects 1.1
- full claude code flag passthrough (40+ flags) thru `bon start`
- `bon statsig` — exploit statsig to dump models, rate limits, real model names behind "stealth"
- premium UI overhaul. muted teal/gold/violet palette, gradient banner, unicode only

## v2.0.0 — earlier april

- first version of `api.js`. OpenAI + Anthropic format support. streaming. auto key rotation
- statsig exploit (`bon statsig`)
- ui first refresh

## v1.x — march

- initial release
- bon login, bon start, bon keys, bon multi
- `bon steal` decrypts the official `@bonsai-ai/cli` config (`scryptSync("bonsai-cli","salt",32)`)
- `bon snoop` documents what bonsai collects

---

## not in any version (use at own risk)

- pushing to ur prod. dont
- official `bonsai start` will spy. use `bon` instead. always
