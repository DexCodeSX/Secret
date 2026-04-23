<p align="center">
  <img src="og-image.png" alt="bonsai.js — free frontier coding models" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.5.2-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-blue?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/platform-windows%20%7C%20linux%20%7C%20macos%20%7C%20termux-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/license-MIT-orange?style=for-the-badge" />
</p>

<h1 align="center">
  bonsai.js
</h1>

<p align="center">
  <strong>Reverse engineered <a href="https://trybons.ai">Bonsai AI</a> CLI — enjoy your free AI models.</strong>
</p>

<p align="center">
  <em>Open source replacement for <code>@bonsai-ai/cli</code> with OpenAI-compatible API proxy, Statsig exploit, auto key rotation, credential decryption, and premium terminal UI.</em>
</p>

<p align="center">
  <a href="#install"><img src="https://img.shields.io/badge/-%E2%96%B6%20install-2ea44f?style=for-the-badge" alt="install" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/-%E2%9A%A1%20quickstart-1f6feb?style=for-the-badge" alt="quickstart" /></a>
  <a href="#commands"><img src="https://img.shields.io/badge/-%E2%97%86%20commands-555?style=for-the-badge" alt="commands" /></a>
  <a href="#plugging-other-tools-in-new-in-v240"><img src="https://img.shields.io/badge/-%E2%97%88%20agents-9333ea?style=for-the-badge" alt="agents" /></a>
  <a href="MODELS.md"><img src="https://img.shields.io/badge/-%E2%9C%A6%20199%20models-0891b2?style=for-the-badge" alt="models" /></a>
  <a href="trybons/"><img src="https://img.shields.io/badge/-%F0%9F%96%A5%20web%20ui-0ea5e9?style=for-the-badge" alt="ui" /></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/-%E2%98%85%20changelog-f59e0b?style=for-the-badge" alt="changelog" /></a>
  <a href="FINDINGS.md"><img src="https://img.shields.io/badge/-%E2%98%A0%20findings-dc2626?style=for-the-badge" alt="findings" /></a>
</p>

---

<details>
<summary><b>📜 Latest changes (v2.4.0) — click to expand</b></summary>

- **`--anon` mode** — strip device_id/session_id from outbound, bonsai cant link sessions
- **`bon agents`** — auto-detect cline/cursor/aider/etc, print exact env vars
- **`bon dash`** — live ANSI dashboard, sparkline of req/s, pool state
- **smart rate-limit absorption** — loop through whole pool before 429
- cc UA bumped 2.1.92 → 2.1.112 (router was rejecting old)
- 503 vs 429 split with proper Retry-After header
- UI v3: braille spinners, pill badges, NO_COLOR support
- `bon cc` and `bon codex` direct shortcuts (skip picker)
- full codex flag docs

[full history → CHANGELOG.md](CHANGELOG.md)

</details>

<details>
<summary><b>🕵️ How bonsai spies (RE'd) — click to expand</b></summary>

when u run the official `bonsai start`, it injects 5 hooks into Claude Code:
- `SessionStart` — tarballs ur whole working dir + `git bundle` of all branches
- `UserPromptSubmit` — fires on **every prompt**, ships diff + transcript + raw prompt
- `Stop` / `StopFailure` / `PostToolUseFailure` — final exfil

upload runs in a **detached background process** (survives ctrl+c). 5 minute window. POSTs to `api.trybons.ai/snapshots/upload`.

`bon` (this repo) bypasses all of it by just not passing `--settings` when it launches claude code. hooks never register.

[full chain w/ line numbers → FINDINGS.md](FINDINGS.md)

</details>

---

## What is this?

[Bonsai AI](https://trybons.ai) (Boolean, Inc.) gives you **free access to Claude, GPT, Gemini, and more** in exchange for your coding data. Their CLI routes requests through a proxy and collects your prompts, completions, and working directory snapshots.

**bonsai.js** is a fully reverse-engineered replacement that:

- Uses the same auth flow (WorkOS device code)
- Manages the same API keys
- Launches the same Claude Code / Codex tools
- **Decrypts** their encrypted config, **blocks** snapshot uploads, **tracks** your limits
- **Auto-rotates keys** when you hit the daily token limit
- **Exposes an OpenAI-compatible API** — use Bonsai models from curl, Python, any SDK
- **Dumps Statsig feature flags** — reveals real rate limits, model names, provider routing

## What's new in v2.4.0

- **`--anon` mode** — strips every stable identifier the Bonsai router uses to correlate sessions. Per-request random `device_id`, `session_id`, `x-claude-code-session-id`, neutralized OS/arch headers. Bonsai's analytics see opaque hashes instead of "user X on Windows machine ABC". Pass `--anon` to `bon api` or set `BONSAI_ANON=1`. Costs nothing, breaks their tracking.
- **`bon agents`** — auto-detects every AI coding tool installed on your machine (Claude Code, Codex, Cline, Cursor, Continue, Roo Code, Aider, OpenCode, Bonsai forks) and prints the exact env-var or settings snippet to wire it through `api.js`. One command, zero guessing.
- **`bon dash`** — live ANSI dashboard polling `api.js /stats` every 1s. Shows version, uptime, request count + ok/err split, token totals, full pool state with active-key indicator, fresh/limited counts, and a 30-second req/s sparkline. Refresh-in-place, `Ctrl+C` to exit.
- **Smarter rate-limit absorption** — when Cline / Cursor / any client hits a key that's exhausted, `api.js` now loops through every fresh pooled key transparently within the same request. The client only sees `429` if **every** key is dead. No more "1 key limit kills my whole session" surprises.
- **`/stats` exposes pool view** — the JSON now includes `pool[]` (with active/limited/masked-key per entry), `poolFresh`, `poolLimited`, `anon` flag, and `version`. `bon dash` consumes this; you can too.

## What was new in v2.3.0

- **Codex flags fully documented** — `bon --help` now has a dedicated `CODEX FLAGS` section covering all 9 subcommands (`exec`, `resume`, `fork`, `apply`, `review`, `mcp`, `plugin`, `cloud`, `sandbox`) and every option (`-c key=val`, `-s sandbox`, `--full-auto`, `--search`, `-p profile`, `-i image`, etc.). No more guessing.
- **`bon cc` and `bon codex`** — direct shortcuts that skip the `bon start` picker. Forward all flags through. `bon cc --resume` and `bon codex exec "fix bug"` work exactly like the underlying tool.
- **Smarter 503 / 429 in api.js** — used to return a single useless 503 for everything. Now it splits cleanly: `503` only when no key is set (with the actual fix instruction), `429` with `Retry-After` header + structured body when all keys hit the daily cap. Includes seconds-until-reset so SDKs can back off properly.
- **Transient upstream 5xx auto-retry** — api.js now retries once after 500 ms on `502/503/504` from `go.trybons.ai`. The router blips occasionally; this absorbs them.
- **`@bonsai-ai/claude-code` bumped to 2.1.112** — npm shipped 20 patch versions since v2.2.0 (was 2.1.92). Router was starting to reject the stale `cc_version` fingerprint. UA in `api.js` and `bench`/`fingerprint` headers all updated.
- **UI v3 — premium aesthetic** — refined cool palette (cooler greens, warmer accents, gold highlights), braille spinner frames (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`), pill-style status badges with rounded ends, animated banner with tagline, dim-edge frames, `divider()` and `kv()` helpers, NO_COLOR / TERM=dumb support so log files stay clean.
- **Steal hint upgrade** — `bon steal` now walks you through the prereq (`npm i -g @bonsai-ai/cli && bonsai login`) when nothing's installed instead of failing silently.

## What was new in v2.2.0

- **Interactive self-update** — `bon update` now detects your platform (Termux, Linux, macOS, Windows CMD, PowerShell) and prompts `Update now? [Y/n]` to auto-install the latest version
- **`bon bench`** — benchmark all 6 models side by side: response time, tok/s, token counts, ranked table with winner. Supports `--parallel`, `--verbose`, `--prompt="..."`
- **`bon fingerprint`** — shows everything the router sees about you: device hash, external IP, session info, headers, system prompt hash, local storage contents

## What was new in v2.1.0

- **Codex support** — `bon start` option 2 now auto-launches `api.js` proxy in the background and routes Codex through it. The `/responses` endpoint translates OpenAI Responses API to Anthropic messages — Codex works out of the box
- **Router bypass fully cracked** — reverse-engineered the exact request fingerprint `go.trybons.ai` validates: Claude Code system prompt (JSON array with billing header), metadata with `device_id`, `?beta=true` query param, and full SDK headers (user-agent, anthropic-beta, x-stainless-*)
- **All models work** — `claude-opus-4-6` (1M context, default), `claude-sonnet-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-sonnet-4-20250514`, `glm-4.7` — confirmed working through the proxy
- **`bon models`** — new command listing all supported models with routing info and context windows
- **System prompt auto-capture** — `api.js` automatically captures the Claude Code system prompt on first run (spawns a brief CC session, intercepts the prompt, saves to `cc_system.json`)
- **`streamCollect()` fix** — router returns empty content on non-stream requests; api.js now internally always streams and collects chunks, so both stream and non-stream responses work perfectly
- **`fetch()` over `https.request()`** — discovered the router rejects HTTP/1.1 (`https.request`) but accepts HTTP/2 (`fetch`/undici). All proxy requests now use `fetch()`
- **Full Claude Code flags passthrough** — `bon start` now documents and passes all `@anthropic-ai/claude-code` flags (40+): `--model`, `--print`, `--permission-mode`, `--system-prompt`, `--effort`, `--worktree`, `--mcp-config`, `--chrome`, `--remote`, and more
- **Update notification** — background version check with proper semver comparison (no false alerts)
- **PowerShell installer** — native `install.ps1` for PowerShell 5.1+ (no `&&` or `curl` alias issues)
- **`api.js` — API proxy server** with OpenAI + Anthropic format support, streaming, auto key rotation
- **`bon statsig` — Statsig exploit** dumps internal config, rate limits, real model names behind "stealth" display
- **Premium UI overhaul** — muted teal/gold/violet palette, gradient banner, unicode-only, no emoji clutter
- **RE updated to `@bonsai-ai/cli@0.4.13`** — new snapshot hooks (StopFailure, PostToolUseFailure), 8 data collection types

## Install

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/DexCodeSX/Secret/main/install.ps1 | iex
```

### Windows (CMD)

```cmd
curl -sL https://raw.githubusercontent.com/DexCodeSX/Secret/main/install.bat -o install.bat && install.bat
```

Or download `install.bat` and double-click it.

### Linux / macOS / WSL

```bash
curl -sL https://raw.githubusercontent.com/DexCodeSX/Secret/main/install.sh | bash
```

### Termux (Android)

```bash
pkg install nodejs curl -y
curl -sL https://raw.githubusercontent.com/DexCodeSX/Secret/main/install.sh | bash
```

### Manual

```bash
curl -sL https://raw.githubusercontent.com/DexCodeSX/Secret/main/bonsai.js -o bonsai.js
node bonsai.js --help
```

## Quick Start

```bash
bon login              # authenticate with Bonsai
bon start              # launch Claude Code
bon start --resume     # resume last session
bon start --continue   # continue last conversation
```

## API Proxy (new in v2.0.0, major upgrade in v2.1.0)

`api.js` turns Bonsai into a local API you can hit from anything — curl, Python, OpenAI SDK, Aider, anything that speaks OpenAI or Anthropic format.

**v2.1.0 breakthrough:** We cracked the full router fingerprint. `api.js` now injects the Claude Code system prompt, metadata, and SDK headers automatically — every request looks indistinguishable from a real Claude Code session.

```bash
bon api                # launch proxy on port 4000
# or
node api.js            # standalone
node api.js -p 8080    # custom port
```

### Supported Models

All models work through the proxy. The router appears to route everything through OpenRouter regardless of model param.

| Model ID | Context | Note |
|----------|---------|------|
| `claude-opus-4-6` | 1M tokens | Default, most capable |
| `claude-sonnet-4-6` | 200K | Fast, good quality |
| `claude-opus-4-5` | 200K | Previous gen Opus |
| `claude-sonnet-4-5` | 200K | Previous gen Sonnet |
| `claude-sonnet-4-20250514` | 200K | Dated Sonnet build |
| `glm-4.7` | 128K | Chinese model (8 providers) |

```bash
bon models             # list all supported models
```

### Endpoints

| Method | Path | Format |
|--------|------|--------|
| `POST` | `/v1/messages` | Anthropic native (passthrough) |
| `POST` | `/v1/chat/completions` | OpenAI compatible (auto-translated) |
| `POST` | `/responses` | OpenAI Responses API (Codex) |
| `GET` | `/v1/models` | Model list with metadata |
| `GET` | `/health` | Health check |
| `GET` | `/stats` | Session statistics |

### Usage examples

**curl (OpenAI format):**
```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-4-6","messages":[{"role":"user","content":"hi"}]}'
```

**curl (Anthropic format):**
```bash
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-opus-4-6","max_tokens":1024,"messages":[{"role":"user","content":"hi"}]}'
```

**curl (streaming):**
```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-4-6","messages":[{"role":"user","content":"hi"}],"stream":true}'
```

**Python (OpenAI SDK):**
```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:4000/v1", api_key="anything")
r = client.chat.completions.create(
    model="claude-opus-4-6",
    messages=[{"role": "user", "content": "hello"}]
)
print(r.choices[0].message.content)
```

**Python (Anthropic SDK):**
```python
import anthropic
client = anthropic.Anthropic(base_url="http://localhost:4000", api_key="anything")
r = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "hello"}]
)
print(r.content[0].text)
```

**Environment variables (use with any tool):**
```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
export OPENAI_API_KEY=anything
```

### Features

- Anthropic <-> OpenAI format translation on the fly
- SSE streaming support for both formats
- Auto key rotation when daily limit is hit (multi-account)
- System prompt auto-injection (Claude Code fingerprint)
- `streamCollect()` — internally streams, returns assembled response for non-stream requests
- Uses `fetch()` (HTTP/2) — required by router, `https.request` is rejected
- Auto-capture of Claude Code system prompt on first run
- Session stats on shutdown (requests, tokens, estimated savings)
- Daily limit auto-clear at midnight UTC

## Commands

| Command | Description |
|---------|-------------|
| `bon login` | Authenticate via WorkOS device code flow |
| `bon logout` | Clear stored credentials |
| `bon start` | Launch Claude Code, Codex, or custom tool (picker) |
| `bon cc` | **New in 2.3.0** — direct Claude Code launch, skip picker |
| `bon codex` | **New in 2.3.0** — direct Codex launch, skip picker |
| `bon resume` | Resume last Claude Code session |
| `bon continue` | Continue last conversation |
| `bon keys` | API key management (list/create/delete/reveal/import) |
| `bon test` | Test all API endpoints with status badges |
| `bon info` | Show account, config, and consent status |
| `bon whoami` | Quick identity check |
| `bon activity` | View usage activity with token breakdown |
| `bon limits` | Today's token usage + time until daily reset |
| `bon stats` | Full analytics: cost savings, model breakdown, daily chart |
| `bon health` | Service status check with response times |
| `bon proxy [port]` | Local proxy server with streaming + token tracking |
| `bon proxy --rotate` | Proxy with auto key rotation on limit hit |
| `bon api` | Launch API proxy server (api.js). Add `--anon` for surveillance-stripping mode. |
| `bon agents` | **New 2.4.0** — Detect & configure Cline/Cursor/Aider/Continue/Roo/etc. |
| `bon dash` | **New 2.4.0** — Live dashboard for running api.js (req/s sparkline, pool state) |
| `bon models` | List all supported models with routing info |
| `bon bench` | Benchmark all models (speed, tok/s, ranked table) |
| `bon fingerprint` | What the router sees about you |
| `bon pool` | View key pool status (fresh vs limited) |
| `bon rotate` | Launch Claude Code with auto key rotation |
| `bon multi` | Multi-account profile management |
| `bon steal` | Decrypt & import official CLI credentials |
| `bon snoop` | Explain Bonsai's data collection (updated for 0.4.13) |
| `bon statsig` | Exploit Statsig to dump internal configs |
| `bon config` | View / edit settings |
| `bon troubleshoot` | Fix common errors (404, outdated, limits) |
| `bon update` | Check for bonsai.js and package updates |
| `bon dump` | Full infrastructure intelligence dump |

## Flags

### Bonsai flags

| Flag | Description |
|------|-------------|
| `--resume` | Resume last Claude Code session |
| `--continue` | Continue last conversation |
| `--debug` | Verbose output |
| `--version` | Show version |
| `--help` | Show help |

### Claude Code flags (passed through via `bon start`)

All `@anthropic-ai/claude-code` flags work with `bon start`. Examples:

```bash
bon start --model opus                     # use specific model
bon start --print "explain this code"      # non-interactive, print & exit
bon start --effort max                     # max effort (Opus only)
bon start --permission-mode auto           # auto-approve actions
bon start --system-prompt "you are a..."   # custom system prompt
bon start --worktree feature-x             # isolated git worktree
bon start --mcp-config servers.json        # load MCP servers
bon start --chrome                         # enable Chrome integration
bon start --verbose --debug                # full debug output
bon start --max-turns 10 --print "task"    # limit turns in headless mode
```

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode, print & exit |
| `--model <model>` | Set model (sonnet, opus, full ID) |
| `--fallback-model <model>` | Fallback when overloaded |
| `--effort <level>` | low / medium / high / max |
| `--system-prompt <text>` | Replace system prompt |
| `--append-system-prompt <text>` | Append to system prompt |
| `--permission-mode <mode>` | default / plan / auto / bypassPermissions |
| `--dangerously-skip-permissions` | Skip all permission checks |
| `--allowedTools <tools...>` | Allow tools without prompting |
| `--disallowedTools <tools...>` | Block tools entirely |
| `--output-format <fmt>` | text / json / stream-json |
| `--json-schema <schema>` | Structured JSON output |
| `--verbose` | Full turn-by-turn output |
| `--name <name>` | Session display name |
| `--max-turns <n>` | Limit agentic turns |
| `--max-budget-usd <n>` | Max spend in dollars |
| `-w, --worktree [name]` | Isolated git worktree |
| `--add-dir <dirs...>` | Additional working dirs |
| `--mcp-config <configs...>` | Load MCP servers |
| `--agent <agent>` | Use specific agent |
| `--chrome` | Enable Chrome integration |
| `--remote <task>` | Create web session on claude.ai |
| `--bare` | Minimal mode, fastest startup |
| `--settings <file>` | Load settings JSON |

### Codex flags (passed through via `bon codex` or `bon start` option 2)

All `@bonsai-ai/codex` (= `@openai/codex`) flags work. Use `bon codex <subcommand> [flags]` for a fast path; the api.js proxy handles `/responses` translation transparently.

```bash
bon codex                                  # interactive TUI
bon codex exec "refactor api.js"           # one-shot, non-interactive
bon codex --model gpt-5.2-codex            # picks model (mapped via api.js)
bon codex --full-auto                      # sandboxed auto-execution
bon codex -s workspace-write               # sandbox policy
bon codex resume --last                    # resume most recent session
bon codex fork                             # fork a session (picker)
bon codex apply                            # git apply latest agent diff
bon codex --search "best react patterns"   # enable native web_search tool
bon codex -p my-profile -c model="o3"      # use config profile + override
```

| Flag | Description |
|------|-------------|
| `exec, e` | Run non-interactively |
| `resume [id]` | Resume session (`--last` for most recent) |
| `fork [id]` | Fork a previous session |
| `apply, a` | Apply latest agent diff to working tree |
| `review` | Run code review on current repo |
| `mcp` | Manage external MCP servers |
| `plugin` | Manage Codex plugins |
| `cloud` | Browse Codex Cloud tasks |
| `-c, --config <key=val>` | Override config (TOML, dotted path) |
| `--enable <feature>` | Enable feature flag (repeatable) |
| `--disable <feature>` | Disable feature flag (repeatable) |
| `-p, --profile <name>` | Profile from `~/.codex/config.toml` |
| `--ignore-user-config` | Skip config.toml (auth still loads) |
| `-m, --model <model>` | Set model |
| `--oss` | Use open-source provider |
| `--local-provider <lmstudio\|ollama>` | Local provider (with `--oss`) |
| `-s, --sandbox <mode>` | `read-only` / `workspace-write` / `danger-full-access` |
| `--full-auto` | Sandboxed automatic execution |
| `-a, --ask-for-approval <policy>` | `untrusted` / `on-failure` / `on-request` / `never` |
| `--dangerously-bypass-approvals-and-sandbox` | No prompts, no sandbox |
| `-C, --cd <dir>` | Working root directory |
| `--add-dir <dir>` | Additional writable directory |
| `--skip-git-repo-check` | Allow running outside a git repo |
| `--ephemeral` | Don't persist session files |
| `-i, --image <file>...` | Attach image(s) to initial prompt |
| `--search` | Enable native web_search tool |
| `--no-alt-screen` | Inline mode (preserves scrollback) |
| `--remote <ws://...>` | Connect TUI to remote app server |
| `--output-schema <file>` | JSON schema for final response |

## Plugging Other Tools In (new in v2.4.0)

`bon agents` auto-detects what's installed and prints the exact config snippet. Below is the cheat sheet for the supported tools — they all consume the OpenAI-compatible endpoint at `http://localhost:4000/v1`.

```bash
bon api              # start the proxy first
# or
bon api --anon       # start proxy with anonymized fingerprint to bonsai
bon agents           # see what's installed, get setup instructions
bon dash             # live monitor (in another terminal)
```

| Tool | How to point it at bon |
|---|---|
| **Claude Code** (Anthropic) | `ANTHROPIC_BASE_URL=http://localhost:4000`<br>`ANTHROPIC_AUTH_TOKEN=anything` |
| **Codex** (OpenAI) | `OPENAI_BASE_URL=http://localhost:4000/v1`<br>`OPENAI_API_KEY=anything` |
| **Cline** (VS Code) | Settings → API Provider: **OpenAI Compatible**<br>Base URL: `http://localhost:4000/v1`<br>Model: `claude-opus-4-6` |
| **Cursor** | Settings → Models → Add Custom (OpenAI-Compatible)<br>URL: `http://localhost:4000/v1`<br>Model: `claude-opus-4-6` |
| **Continue** (VS Code) | `~/.continue/config.json`:<br>`{"models":[{"title":"bon","provider":"openai","model":"claude-opus-4-6","apiBase":"http://localhost:4000/v1","apiKey":"anything"}]}` |
| **Roo Code** (VS Code) | Settings → API Provider: **OpenAI Compatible**<br>URL: `http://localhost:4000/v1` |
| **Aider** | `OPENAI_API_BASE=http://localhost:4000/v1`<br>`OPENAI_API_KEY=anything`<br>`aider --model openai/claude-opus-4-6` |
| **OpenCode** | `OPENAI_BASE_URL=http://localhost:4000/v1`<br>`OPENAI_API_KEY=anything` |

All of them respect the `429 + Retry-After` response now, and all of them benefit from auto-rotation when you have multiple keys in `bon multi`.

## Statsig Exploit (new in v2.0.0)

Bonsai uses Statsig for feature flags and ships their client SDK key in the CLI bundle. We exploit this to dump their full internal configuration.

```bash
bon statsig
```

### What we found

| Config | Value |
|--------|-------|
| Daily token limit | **20,000,000 tokens** |
| Hourly token limit | **40,000,000 tokens** |
| Provider | **OpenRouter** (not direct Anthropic) |
| Models behind "stealth" | Claude Sonnet 4.5, Claude Sonnet 4.6, Claude Opus 4.5, Claude Opus 4.6 |
| GLM-4.7 routing | 8 providers (Google, DeepInfra, Nebius, Novita, Lambda, Hyperbolic, Kluster, Inference.net) |
| Snapshot max size | **1024 MB** |

The router (`go.trybons.ai`) proxies to **OpenRouter**, not directly to Anthropic. Your requests go: `bonsai.js -> go.trybons.ai -> OpenRouter -> Anthropic/Google/etc`.

## Key Rotation (bypass daily limit)

Bonsai has a daily token limit per account. When you hit it, you're locked out until 00:00 UTC.

**Solution: auto key rotation.** Save multiple Bonsai accounts as profiles, then rotate between them automatically.

```bash
# 1. log in with your first account and save it
bon login
bon multi              # choose "Save current", name it "acc1"

# 2. log out, log in with second account, save it
bon logout
bon login              # use different email
bon multi              # save as "acc2"

# 3. repeat for more accounts, then:
bon pool               # see all keys and their status
bon rotate             # launch Claude Code with auto-switch on limit
bon proxy --rotate     # or run a proxy that rotates keys
bon api                # api.js also auto-rotates with pooled keys
```

When key #1 hits the limit, it automatically switches to key #2 and keeps going.

## How It Works

```
                                                    ┌──────────────┐
┌──────────────┐     ┌──────────────────┐           │  OpenRouter   │
│  bon start   │ --> │  Claude Code      │ -------> │  (real       │
│              │     │  (bonsai fork)    │           │   provider)  │
└──────────────┘     └──────────────────┘           └──────────────┘
                                                           ^
                                                           |
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  bon api     │ --> │  api.js proxy     │ --> │  go.trybons.ai   │
│  curl/python │     │  :4000            │     │  (router proxy)  │
│  openai sdk  │     │  oai <-> anthro   │     │  validates:      │
│  any tool    │     │  + system prompt  │     │  system prompt   │
└──────────────┘     │  + SDK headers    │     │  headers, meta   │
                     │  + streamCollect  │     │  HTTP/2, ?beta   │
                     └──────────────────┘     └──────────────────┘
```

**Router validation chain:** `api.js` injects the captured Claude Code system prompt (billing header + full prompt as JSON array), metadata with `device_id`, SDK fingerprint headers (user-agent, anthropic-beta, x-stainless-*), and `?beta=true` query param. Uses `fetch()` for HTTP/2 compliance. Internally streams all requests and collects chunks for non-stream callers.

## What We Cracked

| Item | Details |
|------|---------|
| Config encryption | AES-256-CBC with `scryptSync("bonsai-cli", "salt", 32)` + PBKDF2 |
| Auth flow | WorkOS Device Code OAuth (client `client_01K2ZG07ZTYR0FQNERK3PS2CB0`) |
| **Router fingerprint** | System prompt (JSON array with billing header) + metadata + `?beta=true` + full SDK headers |
| **System prompt format** | JSON array: `[{billing header}, {prompt part 1}, {prompt part 2}]` (~27KB) |
| **Required headers** | `user-agent`, `anthropic-beta` (6 flags), `x-stainless-*` (7 headers), `x-app`, `x-claude-code-session-id` |
| **HTTP/2 required** | Router rejects `https.request()` (HTTP/1.1), accepts `fetch()` (HTTP/2/undici) |
| **Stream-only responses** | Router returns `content:[]` on non-stream; must use `stream:true` internally |
| Router version check | Reads `cc_version=2.1.112` from `x-anthropic-billing-header` (bumped in v2.3.0) |
| Daily limits | 20M tokens/day, 40M tokens/hour (via Statsig) — resets at 00:00 UTC |
| Real provider | OpenRouter, not direct Anthropic — all models return `"model":"stealth"` |
| Snapshot mechanism | 5 hooks: SessionStart, UserPromptSubmit, Stop, StopFailure, PostToolUseFailure |
| Data collection | 8 types: working_directory, git_bundle, diff, prompt, transcript, subagent_transcripts, tarball, snapshot |
| Statsig config | Fully exploitable via leaked client SDK key |
| Supported clients | @anthropic-ai/claude-code, @bonsai-ai/claude-code, @bonsai-ai/codex, @mariozechner/pi-coding-agent |

## Leaked Keys

```
Statsig (web):   client-iipeckyRMmjuabUsf0oqp88IgKZsIZyPAPj0CNVJgtM
Statsig (CLI):   client-yHi9oHzSCwrVz3W62PaedcrxeGnL7o2PjNJDByGkIsn
WorkOS Client:   client_01K2ZG07ZTYR0FQNERK3PS2CB0
Segment:         N2VehZC46evia2S5CiI8EE4m7JY04QVc
Cloudflare:      30139b275891425c8cee99b8155240cd
Datadog:         pubb28ba93eb59013963476c6dd6c190040
```

## Infrastructure

| Service | URL | Stack |
|---------|-----|-------|
| Marketing | trybons.ai | Next.js + Vercel |
| App | app.trybons.ai | Vite + React |
| API | api.trybons.ai | FastAPI + Fly.io |
| Router | go.trybons.ai | Proxy -> OpenRouter |
| Auth | auth.trybons.ai | WorkOS |
| Staging | api-staging.trybons.ai | DNS unreachable |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BONSAI_OAUTH_CLIENT_ID` | Override WorkOS client ID |
| `BONSAI_BASE_URL` | Override backend URL (default: api.trybons.ai) |
| `BONSAI_ROUTER_URL` | Override router URL (default: go.trybons.ai) |
| `STATSIG_CLIENT_KEY` | Override Statsig client key |
| `BONSAI_API_KEY` | API key for api.js proxy |

## Troubleshooting

### "CLI version outdated"
The Bonsai router checks `cc_version` from Claude Code's billing header. Current version: `2.1.112` (bumped in v2.3.0). We inject this via the system prompt's billing header. Run `bon update` to check.

### "exceeded daily token limit"
Resets at **00:00 UTC**. Check `bon limits` for usage. Use `bon rotate` for auto key rotation or `bon multi` to switch accounts manually. api.js also auto-rotates if you have multiple keys.

### "Bad Request" from api.js
The router validates a specific fingerprint. Make sure `cc_system.json` exists in `~/.bonsai-oss/` (auto-captured on first `bon api` run). If missing, delete and re-run `bon api` to trigger auto-capture.

### "404 Not Found" on Codex
Codex uses the `/responses` endpoint which the Bonsai router doesn't support. Both `bon start` option 2 *and* the new `bon codex` shortcut auto-launch `api.js` as a background proxy that translates `/responses` to `/v1/messages`. If you still get 404s, make sure `api.js` is next to `bonsai.js` (the installer handles this).

### "503" or "all keys rate limited" from api.js
v2.3.0 made this much clearer:
- `503` only fires when no key is set at all → run `bon login && bon keys`.
- `429` (with `Retry-After` header + `retryAfter` in body) means every key in your pool hit today's daily cap. Add another account with `bon multi`, or wait for the seconds reported.
- Transient `502/503/504` from the upstream router auto-retry once now, so this should be much rarer.

### "Invalid Bonsai API key"
Create a new key with `bon keys` or import from official CLI with `bon steal`.

### Typos
bonsai.js auto-corrects common typos: `loign` -> `login`, `strat` -> `start`, etc.

## Privacy

bonsai.js blocks some of Bonsai's data collection:

- **No snapshot hooks** — we don't pass `--settings` with upload commands
- **No Statsig tracking** — no feature flag telemetry
- **No Segment analytics** — no event tracking
- **`--anon` mode (v2.4.0)** — randomizes `device_id`, `session_id`, `x-claude-code-session-id` per request, and neutralizes OS/arch headers. Bonsai's router can't correlate your requests across time, sessions, or machines.

```bash
bon api --anon              # start proxy in anonymized mode
BONSAI_ANON=1 node api.js   # equivalent
```

**Caveat:** Bonsai's router still sees your prompt + response content (this is unavoidable — they validate the request body). `--anon` only blocks the *correlation* fingerprint, not the content. If your prompts are sensitive, don't send them to a proxy you don't control. Free models still cost something; pay attention to what.

## Credits

Reverse engineered from `@bonsai-ai/cli@0.4.13`, `@bonsai-ai/claude-code@2.1.112`, and `@bonsai-ai/codex@0.105.1`. Router fingerprint discovered via traffic capture analysis. All information from publicly available npm packages and client-side network traffic.

---

<p align="center">
  <strong>Bonsai AI reverse engineered. Enjoy your free models.</strong><br>
  <em>Bonsai AI is a product of Boolean, Inc.</em>
</p>
