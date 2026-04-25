# changelog

all dates UTC. format: keep it simple.

## v2.5.17 — 2026-04-25

**fix: `bon dash` and `bon pool` disagreeing on fresh/limited for the same key.**

root cause: `api.js` kept rate-limit state in an in-memory `Set` — lost on restart, never written to disk. `bonsai.js` (the cli) used `~/.bonsai-oss/pool-state.json`. so `bon dash` (polls api.js `/stats`) and `bon pool` (reads disk) reported different states, and an `api.js` restart forgot every limited key — same key hammered to 429 again.

fix: `api.js` now reads/writes the same `pool-state.json` the cli uses. single source of truth across `bon api`, `bon proxy --rotate`, `bon rotate`, `bon pool`, `bon dash`. limits survive restarts, get pruned at 00:00 UTC.

## v2.5.8 — 2026-04-23

**bon now ships via npm.** removes the curl|bash install scripts entirely. cleaner distribution, cross-platform updates with one command.

```bash
npm i -g @dexcodesxs/bon       # install
bon update                    # update (auto runs npm i -g for you)
```

what changed:
- new root `package.json` declares `@dexcodesxs/bon` w/ `bin: { bon: ./bonsai.js }`
- new `release.cjs` script — auto-bumps versions everywhere (package.json + bonsai.js VERSION + api.js VER + trybons/VERSION + og-image SVG version pill), regenerates the OG PNGs, commits, tags, npm publishes, pushes to github. one command: `npm run release` (patch) / `release:minor` / `release:major`
- new `.npmignore` keeps the npm tarball clean (excludes scratch, RE workspaces, install scripts)
- `bonsai.js` `performSelfUpdate()` rewritten — detects install method (npm vs script) and runs the right thing. legacy script users get a clear migration prompt
- `bonsai.js` shows a **one-time migration notice** the first time a curl|bash user runs any command on v2.5.8+. shows path to migrate, reassures their data stays. acknowledges via `~/.bonsai-oss/.npm_migration_seen` marker
- DELETED: `install.bat`, `install.ps1`, `install.sh` — no longer needed
- README install section completely rewritten — npm only, with migration steps for old users

**bumps:**
- bonsai.js 2.5.7 → 2.5.8
- api.js 2.5.7 → 2.5.8
- trybons/VERSION (no bump, UI didn't change)

**publish flow for maintainers:**
```bash
npm login                     # one-time
npm run release               # patch bump + publish + push
npm run release:minor         # minor bump (e.g. 2.5.x → 2.6.0)
npm run release 2.6.0         # explicit version
```

## v2.5.7 — 2026-04-23

**honesty fix — model selection is a lie.**

a user noticed: ran `bon codex` (which passes `model: gpt-5`), asked "what model are you?", got back: *"I'm powered by Claude Opus 4.7 (1M context)"*. that means our v2.4.2 commit message — "bon codex actually uses OpenAI now" — was wrong.

re-pulled statsig and confirmed:
```
routing_mode:        "fixed"
fixed_routing_model: anthropic/claude-opus-4.7 (reasoning high)
```

**the bonsai router ignores the `model` field entirely.** it accepts 199 of 213 names from litellm so cline/cursor/codex don't crash on "model not found", but EVERY single request executes as Claude Opus 4.7 underneath.

what changed:
- `bonsai.js` `cmdCodex()` no longer prints "(real OpenAI, not claude-redirected)" — that was wrong. now prints the truth: "bonsai router ignores model selection — all reqs serve claude-opus-4.7".
- `bonsai.js` `cmdModels` ends with a red `IMPORTANT — model selection is a lie` block linking to statsig source.
- `api.js` modelMap header comment rewritten to admit the truth.
- `MODELS.md` top: big honest disclaimer block.
- `README.md` Supported Models: same disclaimer.

upside (still real): bonsai = **free Claude Opus 4.7 + 1M context + reasoning_high** for everyone. that's a $20-30/M tokens model handed out for free. just don't expect gpt-5's actual capabilities when you ask for gpt-5.

**bumps:**
- bonsai.js 2.5.6 → 2.5.7
- api.js 2.4.3 → 2.5.7

## v2.5.5 — 2026-04-23

mobile UI + multi-account UX cleanup.

**fix: multi-account switch "stuck on Cis ez"**

root cause: if u only have ONE bonsai account (everyone's situation by default), all saved profiles contain the SAME tokens for the same email. clicking "switch" between them reloads the page but renders the same user → looks stuck.

new flow:
- profile dropdown hides "switch to" section if no other-email profiles exist
- shows clear amber warning: "only one account saved. all N profiles use the same email so switching won't change anything"
- new big **"+ add another account"** button at top of dropdown that does the right thing in ONE click:
  1. saves current under email-derived auto-name (e.g. `cisez123_gmail_com`)
  2. clears `~/.bonsai-oss/auth.json` + `apikey.json`
  3. redirects to `/login` for fresh sign-in
- new route: `POST /profiles/add-account`

**mobile UI (responsive)**

- mobile (<lg): sidebar becomes a drawer behind hamburger top-left, brand centered, user avatar top-right
- drawer slides in w/ overlay backdrop, closes when nav link clicked
- all dashboard wrappers: `lg:flex lg:h-screen lg:overflow-hidden` (desktop only)
- stat tiles: `grid-cols-2 lg:grid-cols-4`
- activity table: desktop = grid, mobile (<md) = stacked card layout
- all sidebar items + buttons: `min-h-[44px]` (Apple's tap-target minimum)
- profile dropdown: `max-h-[80vh]` so it fits on phone

verified live at 375×812 (iPhone), 768×1024 (iPad), desktop.

bumps: bonsai.js 2.5.4 → 2.5.5, trybons/VERSION 1.2.1 → 1.3.0

## v2.5.4 — 2026-04-23

lucide stroke icons in sidebar (icon fix).

before: filled material icons. **"models" rendered as a minus-in-circle "no entry" sign**, "activity" was a confusing sparkle pattern.

after: lucide-style stroke icons (the 2026 standard, what shadcn uses):
- overview     → layout-dashboard (4-panel grid)
- api keys     → key (cleaner)
- activity     → ECG pulse waveform
- models       → ✨ sparkles (modern AI convention)
- settings     → gear
- docs         → book-open

all `fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'` for consistency.

bumps: bonsai.js 2.5.3 → 2.5.4, trybons/VERSION 1.2.0 → 1.2.1

## v2.5.3 — 2026-04-23

bug fix + multi-account UI.

**bug fix: docs/models broken when bon ui installed via auto-install**

`bon ui` puts trybons/ next to bonsai.js (e.g. `~/.bonsai-oss/trybons/`). previous code looked for markdown at `../MODELS.md` which doesn't exist there → "MODELS.md not found in repo root". 

new flow:
1. try local sibling repo first (works for dev from git checkout)
2. fall back to local cache (`trybons/.docs-cache/`, 1h TTL)
3. fall back to fetching from `raw.githubusercontent.com/DexCodeSX/Secret/main/`
4. on network fail with no cache → friendly error w/ refresh link

now `/docs/models`, `/dashboard/models`, all docs pages work from any install location. docs always fresh from github (1h cache).

`?refresh=1` query param forces re-fetch (skips cache).

**multi-account dropdown in sidebar (UI mirror of `bon multi`)**

click the user avatar in sidebar → dropdown opens via htmx:
- shows current account
- lists other saved profiles from `~/.bonsai-oss/profiles/*.json`
- "switch" button (htmx swap, no page reload)
- "add another account" link (signs out, redirects to /login)
- "sign out" button

new routes:
- `GET  /profiles` — htmx dropdown fragment
- `POST /profiles/:name/switch` — switch active session
- `POST /profiles/save` — save current as new profile (form on settings)
- `POST /profiles/:name/delete` — revoke profile

settings page got a new **"multi-account profiles"** section showing all saved profiles inline, switch/delete inline, plus a save-current form.

all session swaps update `~/.bonsai-oss/auth.json` + `apikey.json` so `bon` CLI also follows the switch.

bumps:
- `bonsai.js` 2.5.2 → 2.5.3
- `trybons/VERSION` 1.1.0 → 1.2.0

## v2.5.2 — 2026-04-23

three new things:

**1. docs IN the trybons UI** — instead of adopting Fumadocs/Nextra/Docusaurus (all force a 2nd app + Next.js build step + ~150 MB deps), extended the existing trybons server with `/docs` routes that auto-render our 5 markdown files (`README`, `CHANGELOG`, `MODELS`, `FINDINGS`, `TRYBONS_RECON`) using `marked` + tailwind typography. looks identical to fumadocs but stays zero-build.

routes:
- `/docs` — sidebar grid of all docs grouped (guides / reference / recon)
- `/docs/:slug` — rendered markdown w/ left sidebar nav + right TOC + "edit on github" link
- TOC auto-built from h2/h3 in source
- code blocks, tables, blockquotes, all themed dark + emerald
- 4 new files: `views/docs/index.ejs`, `views/docs/page.ejs`
- new dep: `marked` ^15 (only ~80 KB)

**2. OG image generation** — beautiful 1200×630 preview when sharing on twitter/discord/etc. SVG-first design (renders deterministically, no chrome layout quirks), converted via `npx svgexport`. shipped as both:
- `trybons/og-image.svg` — editable source (pure SVG, no html/chrome)
- `og-image.png` — generated 1200×630 (~440 KB)

og meta tags injected into all trybons pages via `views/partials/head.ejs`. README displays it at top.

**3. cleaner install prompt** — when `bon ui` runs and trybons/ is missing, now shows a proper boxed prompt:
```
╭─ INSTALL UI ─────────────────────────────────────╮
│ ⚡ trybons UI is not installed yet               │
│   the web dashboard is a separate folder (17 fil)│
│   stack: express + ejs + htmx + tailwind, no buil│
╰──────────────────────────────────────────────────╯
? install it now? (downloads from github, ~50KB) [Y/n]
```
no `git clone` instructions. better English. 

bumped:
- `bonsai.js` 2.5.1 → 2.5.2
- `trybons/VERSION` 1.0.1 → 1.1.0 (triggers update prompt for existing users)

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
