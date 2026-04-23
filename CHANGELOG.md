# changelog

all dates UTC. format: keep it simple.

## v2.5.1 — 2026-04-23

**`bon ui` now self-updates.** when launched, checks `trybons/VERSION` against github, prompts Y/N if newer.

new behavior:
- on launch: `GET raw.githubusercontent.com/.../trybons/VERSION` (4s timeout, silent fail)
- if remote semver > local: shows nice update box, asks `Y/n`
- on Y: re-downloads all 15 trybons/ files into place, prints `updated to vX.Y.Z`
- on n: keeps current, hints `bon ui --update` for forced pull
- if `trybons/` folder missing entirely: offers to download it from scratch
- `--no-update` flag skips the check (for offline / slow connections)
- `--update` flag forces pull even if versions match

manifest:
- ships with `trybons/VERSION` file (semver, currently `1.0.1`)
- bonsai.js has hardcoded `UI_FILES` list (15 paths)
- bumping `trybons/VERSION` triggers update prompts on next `bon ui` for all users

## v2.5.0 — 2026-04-23

new: **trybons/ web UI** — open source dashboard clone of `app.trybons.ai` runs locally, shares session w/ bon CLI.

stack:
- express 4 + ejs 3 (server + templates)
- htmx 2 (interactivity, ~14 KB instead of react's 200+ KB)
- tailwind via CDN (no compile step)
- WorkOS device code auth (same as `bon login`, shares `~/.bonsai-oss/`)
- zero native deps — works on termux, linux, mac, windows

new command:
- `bon ui`         — auto-installs trybons/ deps + boots on :3000, opens browser
- `bon ui 8080`    — custom port

pages:
- `/` landing — hero w/ 12 model family tiles, feature grid, footer
- `/login` — WorkOS device code w/ htmx polling
- `/dashboard` — overview, today's stats, usage bar, recent activity
- `/dashboard/keys` — list 22 keys, create modal, revoke confirm
- `/dashboard/activity` — paginated request history
- `/dashboard/models` — all 199 models grouped by family, click-to-copy
- `/dashboard/settings` — account info, stored key reveal, integration snippets

design:
- dark theme, emerald-accent gradient, glass morphism, animated banner
- DOM diff via htmx swap (no SPA, no client state)
- font: Inter + JetBrains Mono via google fonts
- ~5 MB total node_modules (just express + ejs)
- starts in ~1s on termux

## v2.4.3 — 2026-04-23

found undocumented bonsai router endpoint while probing every standard LLM API path. exposed it.

new:
- **`bon count "your prompt"`** — pre-flight token counter. uses bonsai router's hidden `/v1/messages/count_tokens` endpoint (no inference, no daily-cap deduction, returns instantly). shows: user tokens + ~30K cc_system fingerprint = total per-request cost. plus $/M estimate for the chosen model.
  - reads stdin too: `cat file.txt | bon count`
  - `--model=<name>` to estimate against any model
- api.js gained `POST /v1/messages/count_tokens` passthrough for SDK use
- api.js dashboard now lists the count_tokens endpoint

probe results (what bonsai router actually exposes):
- `GET /health` — `{"status":"ok"}`
- `GET /v1/models` — returns just `bonsai` (hides real catalog)
- `POST /v1/messages` + `?beta=true` — chat (needs cc_system fingerprint)
- `POST /v1/messages/count_tokens` — **FREE token counter (NEW in v2.4.3 docs)**
- everything else 404: no embeddings, audio, images, batches, assistants, fine-tuning, admin, swagger, metrics. clean prod surface.

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
