# trybons UI

open source dashboard clone of `app.trybons.ai`. runs locally. shares session with the `bon` CLI via `~/.bonsai-oss/`.

## stack

| layer | tech | why |
|---|---|---|
| server | express 4 | bulletproof, runs everywhere |
| templates | ejs 3 | server-rendered, no build |
| interactivity | htmx 2 | feels like react, ships ~14 KB instead of 200+ KB |
| styles | tailwind via CDN | no compile step, runs anywhere |
| auth | WorkOS device code | same flow as `bon login`, shared session |
| storage | none | reads `~/.bonsai-oss/auth.json` (created by either tool) |

zero native deps. zero build. tested on win + linux + mac + termux.

## run

```bash
# from this folder
npm install     # express + ejs only (~5 MB)
node server.js  # → http://localhost:3000

# or from anywhere
bon ui          # auto-installs deps + boots
bon ui 8080     # custom port
```

## what it does

- **landing** — public homepage at `/`
- **login** — WorkOS device code flow, htmx polls for completion
- **dashboard** — overview, today's usage bar, recent activity
- **api keys** — list, create, revoke
- **activity** — full request history w/ pagination
- **models** — all 199 working models grouped by family, click to copy
- **settings** — account info, stored key reveal, integration snippets

## platform notes

| platform | works? | notes |
|---|---|---|
| linux | yes | tested ubuntu 22.04 |
| macos | yes | tested 14+ |
| windows | yes | use bash/wsl/cmd/powershell |
| termux (android) | yes | `pkg install nodejs` then `npm i && node server.js`. browser auto-open is skipped. |

## env

| var | default | what |
|---|---|---|
| `PORT` | `3000` | listen port |
| `HOST` | `0.0.0.0` | listen interface |
| `BONSAI_BASE_URL` | `https://api.trybons.ai` | backend |

## files

```
trybons/
├── server.js               # express app (single file)
├── package.json            # express + ejs only
├── views/
│   ├── partials/
│   │   ├── head.ejs        # html head + tailwind cdn + htmx cdn
│   │   ├── foot.ejs        # </body></html>
│   │   ├── nav.ejs         # public nav
│   │   └── sidebar.ejs     # dashboard sidebar
│   ├── landing.ejs         # public homepage
│   ├── login.ejs           # device code flow
│   └── dashboard/
│       ├── index.ejs       # main overview
│       ├── keys.ejs        # api key crud
│       ├── activity.ejs    # request history
│       ├── models.ejs      # 199-model picker
│       └── settings.ejs    # account + integration snippets
└── public/                 # static files (currently empty, all CDN)
```

## why htmx not react

- htmx ships 14 KB, react ships 200+ KB
- no webpack / vite / esbuild / babel / rollup. zero build step
- works on termux out of the box
- forms + dashboards = htmx wins, no state management needed
- if u want react fight us in github issues
