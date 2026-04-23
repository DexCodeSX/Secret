# trybons.ai surface map (RE EXPLOIT)

reconnaissance of every bonsai (Boolean Inc) public surface. uses katana, subfinder, nextr4y, custom probes + `orsinium-labs/sourcemap` for source map recovery.

date: 2026-04-23

---

## tldr

- **24 source maps EXPOSED on `auth.trybons.ai`** — recovered 4.4 MB of original TypeScript including their auth flow, Cloudflare Turnstile integration, Datadog config block
- **2 LIVE creds leaked** in the auth bundle: Sentry DSN + Datadog client token + app ID
- **Datadog records 1% of auth sessions as full DOM session replay** — serious browser surveillance on sign-in
- **api.trybons.ai backend** exposes only 5 endpoints, hardened (no /docs /openapi.json /healthz)
- **3 NEW subdomains** found beyond what README documented: `forms.`, `rt.`, `sso.`

---

## subdomains (9 total — 3 NEW)

| sub | tech | status |
|---|---|---|
| `www.trybons.ai` | Next.js 19.2.0-canary + Vercel + CF | static marketing |
| `app.trybons.ai` | Vite + React + Vercel + CF + GTM + Segment | dashboard SPA |
| `api.trybons.ai` | FastAPI + Fly.io + CF | authed REST |
| `go.trybons.ai` | Fly.io (no CF!) | chat router |
| `auth.trybons.ai` | **Next.js 14.2.35 + WorkOS hosted-authkit** + CF | sign-in pages |
| `docs.trybons.ai` | Mintlify + Vercel | docs |
| **`sso.trybons.ai`** | **NEW** — Envoy + CF | `{}` on /, `"hello there"` on /health |
| **`forms.trybons.ai`** | **NEW** — Vercel form handler | empty over HTTP |
| **`rt.trybons.ai`** | **NEW** — likely WebSocket realtime | empty over HTTP |

---

## leaked creds (LIVE, baked into client bundle)

### Sentry (auth.trybons.ai)
```
DSN:        https://2a215ef4e0e312bcc7c2c9dd67763aac@o207216.ingest.sentry.io/4505703603830784
org:        o207216
project:    4505703603830784
public key: 2a215ef4e0e312bcc7c2c9dd67763aac
```
client-side only. attacker can spam fake error events to inflate their Sentry quota / pollute dashboards.

### Datadog RUM (auth.trybons.ai)
```
applicationId: c9ba74e4-e361-4dab-947b-6d5f2f71cfd8
clientToken:   pub13cc1c08de038f5df35b864483728555
env:           production
version:       ffb90d3a9c0afaa512238307333f4b2a2d350151  (git commit SHA of build)
service:       hosted-authkit  (confirms WorkOS hosted SaaS)
sessionSampleRate:       100  (track every session)
sessionReplaySampleRate: 1    (record 1% as DOM replay)
```
they replay **1% of all sign-in sessions** to Datadog. mouse moves, clicks, form interactions captured.

### Tracking IDs (already known + new)

| service | id | source |
|---|---|---|
| Segment write key | `N2VehZC46evia2S5CiI8EE4m7JY04QVc` | inline `<script>` in app HTML |
| **Google Tag Manager** | **`GTM-TKVWCH3V`** ← NEW | app HTML noscript |
| Statsig (web) | `client-iipeckyRMmjuabUsf0oqp88IgKZsIZyPAPj0CNVJgtM` | known |
| Statsig (CLI) | `client-yHi9oHzSCwrVz3W62PaedcrxeGnL7o2PjNJDByGkIsn` | known |
| WorkOS client | `client_01K2ZG07ZTYR0FQNERK3PS2CB0` | known |
| Cloudflare account | `30139b275891425c8cee99b8155240cd` | known |

### Statsig CDN domains (NEW)
- `featureassets.org/v1` (returns "RBAC: access denied" without proper SDK key + path)
- `prodregistryv2.org/v1` (same)

both are Statsig's edge CDN. they serve feature flag state for `app.trybons.ai`.

---

## source map recovery (auth.trybons.ai)

ran `orsinium-labs/sourcemap` against all 5 subdomains. only `auth.trybons.ai` had `.js.map` files exposed.

**24 of 25 chunks had source maps available.** total recovery:

| metric | value |
|---|---|
| source maps downloaded | 24 |
| total source content | **4.4 MB** |
| unique source files referenced | 1021 |
| unique npm packages identified | 118 |
| bonsai's own app code files extracted | **22 .ts/.tsx** |

### bonsai's own source files (auth)

```
app/(main)/(root)/(sign-in)/passkey/start-passkey-authentication.ts   ← passkey/WebAuthn
app/(main)/(root)/(sign-in)/sign-in-form.tsx
app/error.tsx
app/global-error.tsx
app/resets.css
components/authentication-form.tsx
components/auth-method-button.tsx
components/email-field.tsx
components/error-message.tsx
components/error-page.tsx
components/submit-button.tsx
components/bot-check/bot-check.client.tsx        ← Cloudflare Turnstile wrapper
components/bot-check/bot-check-context.tsx
components/bot-check/bot-check-input.tsx
instrumentation-client.ts                         ← Sentry init
utils/authkit-error-messages.ts                   ← WorkOS error codes
utils/get-sso-login-route.ts
utils/sentry.ts
utils/use-passkey-support.ts
utils/telemetry/datadog.ts                        ← datadog config
utils/telemetry/redact-url-before-send.ts         ← URL scrubbing before telemetry send
```

### tech stack revealed

| layer | package | version |
|---|---|---|
| framework | Next.js | 14.2.35 (App Router) |
| react | React | 19.2.3 |
| typescript | TypeScript | 5.9.3 |
| auth | WorkOS hosted AuthKit | `@workos-inc/branded-ui`, `@workos-inc/i18n` |
| schema | Zod | 3.25.76 |
| ai sdk | `@ai-sdk/anthropic` + `@ai-sdk/openai` | 1.2.12 + 1.3.23 |
| ui | Radix UI Themes | 3.3.0 + many primitives |
| float | floating-ui | 1.7.5/6 |
| i18n | FormatJS intl | 3.1.6 |
| captcha | `@marsidev/react-turnstile` | 1.1.0 |
| errors | `@sentry/nextjs` | latest |
| rum | `@datadog/browser-rum` | 6.24.1 |
| tracing | `@opentelemetry/api` | 1.9.0 |
| pkg mgr | pnpm monorepo | `..common/temp/node_modules/.pnpm/...` |

### env vars baked in at build (visible in chunks)

```
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_COMMIT_SHA
NEXT_PUBLIC_NODE_ENV
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_DD_APPLICATION_ID
NEXT_PUBLIC_DD_CLIENT_TOKEN
NEXT_PUBLIC_DD_ENVIRONMENT
NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
NEXT_PUBLIC_DD_SERVICE_NAME
NEXT_PUBLIC_DD_FORWARDER_URL → forwarder.workos.com
```

---

## api.trybons.ai endpoints (live, authed via WorkOS bearer)

CORS lock: only `Origin: https://app.trybons.ai`, credentials true.

| method | path | what |
|---|---|---|
| GET | `/auth/user` | full user JSON (id, email, names, created_at) |
| GET | `/consent/status` | `{"needs_review":false}` |
| GET | `/keys/` | array of all keys (id, name, mask) |
| POST | `/keys/` | create new key (returns full sk_cr_* once) |
| DELETE | `/keys/:id` | revoke |
| PATCH | `/keys/:id` | rename |
| GET | `/billing/activity?page=N` | per-request history |

OPTIONS preflight w/ proper headers reveals: `DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT` allowed.

what is **NOT** exposed:
- no `/docs` `/openapi.json` `/redoc` `/swagger` `/healthz` `/metrics` `/admin`
- staging subdomains (`api-staging`, `app-staging`, `staging`) all DNS-unreachable from edge

---

## go.trybons.ai router (chat) endpoints

probed every standard LLM API path. only **4 endpoints exist**:

| endpoint | exposed? |
|---|---|
| `GET /health` | `{"status":"ok"}` |
| `GET /v1/models` | `{"id":"bonsai"}` (real catalog hidden) |
| `POST /v1/messages` `?beta=true` | chat (needs cc_system fingerprint) |
| `POST /v1/messages/count_tokens` | **FREE token counter (undocumented, see MODELS.md)** |
| everything else | 404 |

zero leaked admin/debug surfaces.

---

## what we did not exploit (not run)

- POST junk to `/snapshots/upload` to amplify their storage costs (auth-required, but bearer key is per-account so cheap to spray)
- enumerate Statsig user_ids via the leaked CLI key to find users with cranked-up `cli_snapshot_size_limit`
- probe `forwarder.workos.com` for log injection (Datadog log forwarder)
- spam fake events into Sentry org `o207216` project `4505703603830784` (they'd notice + revoke)
- inject fake Datadog RUM events to `c9ba74e4-e361-4dab-947b-6d5f2f71cfd8` to pollute their analytics

---

## defenses (what bonsai got right)

- api.trybons.ai: stripped FastAPI default docs/openapi/redoc paths
- go.trybons.ai: chat-only, no admin surfaces, system prompt fingerprint required for chat
- www.trybons.ai marketing: pure static via Vercel SSG, zero API surface
- app.trybons.ai dashboard: no source maps exposed
- staging subdomains: DNS-unreachable from edge (private network only)
- robots.txt blocks all major AI crawlers (CF managed)
- session replay scrubs URLs via `redact-url-before-send.ts` (custom redactor)

## defenses (what bonsai got wrong)

- **auth.trybons.ai shipped sourcemaps to production** — exposes their entire client codebase + reveals tech stack + leaks live Sentry DSN + Datadog tokens
- **Datadog session replay at 1%** on sign-in pages records keystrokes/clicks even on a privacy-sensitive auth flow
- **`@bonsai-ai/cli` ships hardcoded scrypt password `"bonsai-cli"` + salt `"salt"`** for AES-256 config encryption (RE'd in FINDINGS.md)
- **`@bonsai-ai/cli` injects 5 hooks via `--settings` to exfiltrate working dir tarballs** (see FINDINGS.md)

---

## tools used

```
nextr4y    -- Next.js detection + chunk discovery
katana     -- crawl
subfinder  -- subdomain enum
httpx      -- probe alive + tech detect
nuclei     -- exposures (zero hits on api/www)
trufflehog -- secrets scan (zero hits — bonsai stripped well)
SecretFinder (skipped — covered by trufflehog)
orsinium-labs/sourcemap -- the goldmine for auth.trybons.ai
custom curl scripts for endpoint enumeration + cred extraction
```
