// trybons UI — open source dashboard clone
// reads ~/.bonsai-oss/ for session (shares w/ bon CLI), no local users db.
// stack: express + ejs + htmx + tailwind cdn. zero build step.
// runs on termux + linux + mac + win. node 18+.

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || process.argv[2] || '3000');
const HOST = process.env.HOST || '0.0.0.0';

// --- bonsai backend config (matches bon cfg) ---
const cfg = {
  workos: { clientId: 'client_01K2ZG07ZTYR0FQNERK3PS2CB0', apiUrl: 'https://api.workos.com' },
  backend: 'https://api.trybons.ai',
  router: 'https://go.trybons.ai',
  bonDir: path.join(os.homedir(), '.bonsai-oss'),
};

// --- session shared w/ bon ---
function loadAuth() { try { return JSON.parse(fs.readFileSync(path.join(cfg.bonDir, 'auth.json'), 'utf8')); } catch { return null; } }
function loadKey()  { try { return JSON.parse(fs.readFileSync(path.join(cfg.bonDir, 'apikey.json'), 'utf8')); } catch { return null; } }
function saveAuth(a) { fs.mkdirSync(cfg.bonDir, { recursive: true }); fs.writeFileSync(path.join(cfg.bonDir, 'auth.json'), JSON.stringify(a, null, 2)); }
function saveKey(k)  { fs.mkdirSync(cfg.bonDir, { recursive: true }); fs.writeFileSync(path.join(cfg.bonDir, 'apikey.json'), JSON.stringify(k, null, 2)); }

// --- http helper ---
function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    let u = new URL(url);
    let r = https.request(u, { method: opts.method || 'GET', headers: opts.headers || {}, timeout: opts.timeout || 15000 }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let body = Buffer.concat(chunks).toString();
        try { body = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (opts.body) r.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    r.end();
  });
}

async function ensureToken() {
  let auth = loadAuth();
  if (!auth) return null;
  // refresh if older than 23h
  if (auth.saved_at && Date.now() - auth.saved_at > 82800000 && auth.refresh_token) {
    try {
      let r = await req(`${cfg.workos.apiUrl}/user_management/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refresh_token, client_id: cfg.workos.clientId }).toString(),
      });
      if (r.body?.access_token) { r.body.saved_at = Date.now(); saveAuth(r.body); return r.body.access_token; }
    } catch {}
  }
  return auth.access_token;
}

// --- bonsai api wrappers ---
async function api(path, token, opts = {}) {
  return req(`${cfg.backend}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body,
  });
}
const getUser     = (t) => api('/auth/user', t).then(r => r.body);
const listKeys    = (t) => api('/keys/', t).then(r => r.body);
const createKey   = (t, name) => api('/keys/', t, { method: 'POST', body: { name } }).then(r => r.body);
const deleteKey   = (t, id) => api('/keys/' + id, t, { method: 'DELETE' }).then(r => r.body);
const getActivity = (t, page = 1) => api(`/billing/activity?page=${page}&page_size=30`, t).then(r => r.body);

// --- in-memory device code auth state (per session) ---
const deviceFlows = new Map();   // session_id -> { device_code, verification_uri, user_code, started_at }

// --- express app ---
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public')));

// cookie parser (no deps)
app.use((req, res, next) => {
  req.cookies = {};
  let raw = req.headers.cookie || '';
  raw.split(';').map(s => s.trim()).forEach(s => {
    let [k, ...v] = s.split('='); if (k) req.cookies[k] = decodeURIComponent(v.join('='));
  });
  next();
});

// flash-via-cookie helper (no deps)
function flash(res, msg, type = 'info') { res.cookie('flash', JSON.stringify({ msg, type }), { httpOnly: true, maxAge: 5000 }); }
function readFlash(req, res) {
  let raw = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('flash='));
  if (!raw) return null;
  res.clearCookie('flash');
  try { return JSON.parse(decodeURIComponent(raw.slice(6))); } catch { return null; }
}

// inject locals
app.use(async (req, res, next) => {
  res.locals.flash = readFlash(req, res);
  res.locals.path = req.path;
  res.locals.token = await ensureToken();
  res.locals.user = null;
  if (res.locals.token) {
    try { res.locals.user = await getUser(res.locals.token); } catch {}
  }
  res.locals.loggedIn = !!res.locals.user;
  next();
});

// auth gate
function requireAuth(req, res, next) {
  if (!res.locals.loggedIn) return res.redirect('/login');
  next();
}

// ─── routes ───────────────────────────────────────────────

app.get('/', (req, res) => {
  if (res.locals.loggedIn) return res.redirect('/dashboard');
  res.render('landing');
});

// LOGIN — WorkOS device code flow
app.get('/login', async (req, res) => {
  if (res.locals.loggedIn) return res.redirect('/dashboard');
  // start device flow if not already
  let sid = req.cookies?.sid || Math.random().toString(36).slice(2);
  res.cookie('sid', sid, { httpOnly: true, maxAge: 600000 });
  let flow = deviceFlows.get(sid);
  if (!flow) {
    try {
      let r = await req(`${cfg.workos.apiUrl}/user_management/authorize/device`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: { client_id: cfg.workos.clientId, scope: 'openid email profile' },
      });
      flow = { ...r.body, started_at: Date.now() };
      deviceFlows.set(sid, flow);
    } catch (e) { return res.render('login', { flow: null }); }
  }
  res.render('login', { flow });
});

// HTMX poll endpoint — checks if device code completed
app.get('/login/poll', async (req, res) => {
  let sid = req.cookies?.sid || req.headers.cookie?.match(/sid=([^;]+)/)?.[1];
  let flow = deviceFlows.get(sid);
  if (!flow) return res.send('<div class="text-red-400">session expired, refresh page</div>');
  try {
    let r = await req(`${cfg.workos.apiUrl}/user_management/authenticate`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: flow.device_code, client_id: cfg.workos.clientId }).toString(),
    });
    if (r.body?.access_token) {
      r.body.saved_at = Date.now();
      saveAuth(r.body);
      deviceFlows.delete(sid);
      // htmx redirect
      res.set('HX-Redirect', '/dashboard');
      return res.send('<div class="text-emerald-400">success! redirecting...</div>');
    }
    if (r.body?.error === 'expired_token') {
      deviceFlows.delete(sid);
      return res.send('<div class="text-red-400">code expired, <a href="/login" class="underline">restart</a></div>');
    }
    // still pending
    res.send('<div class="text-zinc-400 text-sm">waiting for browser auth...</div>');
  } catch (e) {
    res.send(`<div class="text-red-400">${e.message}</div>`);
  }
});

app.post('/logout', (req, res) => {
  try { fs.unlinkSync(path.join(cfg.bonDir, 'auth.json')); } catch {}
  try { fs.unlinkSync(path.join(cfg.bonDir, 'apikey.json')); } catch {}
  flash(res, 'logged out', 'info');
  res.redirect('/');
});

// ─── DASHBOARD ───
app.get('/dashboard', requireAuth, async (req, res) => {
  let activity = await getActivity(res.locals.token, 1).catch(() => ({ items: [] }));
  let keys = await listKeys(res.locals.token).catch(() => ({ keys: [] }));

  // today's totals
  let today = new Date().toISOString().slice(0, 10);
  let todayIn = 0, todayOut = 0, todayReqs = 0;
  for (let item of (activity.items || [])) {
    if (item.timestamp?.slice(0, 10) === today) {
      todayIn += item.input_tokens || 0;
      todayOut += item.output_tokens || 0;
      todayReqs++;
    }
  }
  // resets in
  let now = new Date();
  let reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  let resetIn = Math.floor((reset - now) / 60000);

  res.render('dashboard/index', { activity: activity.items || [], keys: keys.keys || [], todayIn, todayOut, todayReqs, resetIn });
});

app.get('/dashboard/keys', requireAuth, async (req, res) => {
  let keys = await listKeys(res.locals.token).catch(() => ({ keys: [] }));
  res.render('dashboard/keys', { keys: keys.keys || [], newKey: null });
});

app.post('/dashboard/keys', requireAuth, async (req, res) => {
  let name = req.body.name?.trim() || `trybons-ui-${Date.now()}`;
  try {
    let result = await createKey(res.locals.token, name);
    if (result?.key) {
      saveKey({ key: result.key, name, created: new Date().toISOString() });
      let keys = await listKeys(res.locals.token).catch(() => ({ keys: [] }));
      res.render('dashboard/keys', { keys: keys.keys || [], newKey: result.key });
    } else { flash(res, 'failed to create key', 'error'); res.redirect('/dashboard/keys'); }
  } catch (e) { flash(res, 'create error: ' + e.message, 'error'); res.redirect('/dashboard/keys'); }
});

app.post('/dashboard/keys/:id/delete', requireAuth, async (req, res) => {
  try {
    await deleteKey(res.locals.token, req.params.id);
    flash(res, 'key revoked', 'info');
  } catch (e) { flash(res, 'delete error: ' + e.message, 'error'); }
  res.redirect('/dashboard/keys');
});

app.get('/dashboard/activity', requireAuth, async (req, res) => {
  let page = parseInt(req.query.page) || 1;
  let activity = await getActivity(res.locals.token, page).catch(() => ({ items: [], total_pages: 1 }));
  res.render('dashboard/activity', { items: activity.items || [], page, totalPages: activity.total_pages || 1 });
});

app.get('/dashboard/models', requireAuth, async (req, res) => {
  // fetches MODELS.md from github (or local sibling, or cache)
  let modelsByFamily = {};
  try {
    let md = await fetchDoc('MODELS.md', req.query.refresh === '1');
    let currentFamily = null;
    for (let line of md.split('\n')) {
      let famMatch = line.match(/^## (.+?) \((\d+)\)$/);
      if (famMatch && !line.includes('failed') && !line.includes('summary')) {
        currentFamily = famMatch[1];
        modelsByFamily[currentFamily] = [];
        continue;
      }
      let modelMatch = line.match(/^- `(.+)`$/);
      if (modelMatch && currentFamily) modelsByFamily[currentFamily].push(modelMatch[1]);
    }
  } catch {}
  res.render('dashboard/models', { modelsByFamily });
});

// ─── multi-account profiles (mirrors `bon multi`) ───
const PROFILES_DIR = path.join(cfg.bonDir, 'profiles');
function listProfiles() {
  if (!fs.existsSync(PROFILES_DIR)) return [];
  try {
    return fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json')).map(f => {
      let name = f.replace('.json', '');
      let data = {};
      try { data = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), 'utf8')); } catch {}
      return { name, email: data.email || '?', hasKey: !!data.apiKey };
    });
  } catch { return []; }
}

// htmx-friendly profile dropdown fragment
app.get('/profiles', requireAuth, async (req, res) => {
  res.render('partials/profile-menu', {
    profiles: listProfiles(),
    user: res.locals.user,
    layout: false,
  });
});

// switch active profile
app.post('/profiles/:name/switch', requireAuth, async (req, res) => {
  let name = req.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
  let p = path.join(PROFILES_DIR, `${name}.json`);
  if (!fs.existsSync(p)) { flash(res, `profile "${name}" not found`, 'error'); return res.redirect('/dashboard'); }
  try {
    let data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data.auth) saveAuth(data.auth);
    if (data.apiKey) saveKey({ key: data.apiKey, name, created: new Date().toISOString() });
    flash(res, `switched to "${name}"`, 'info');
  } catch (e) { flash(res, `switch failed: ${e.message}`, 'error'); }
  res.redirect('/dashboard');
});

// save current as new profile
app.post('/profiles/save', requireAuth, async (req, res) => {
  let name = (req.body.name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!name) { flash(res, 'name required (a-z 0-9 _ - only)', 'error'); return res.redirect('/dashboard/settings'); }
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
  let auth = loadAuth();
  let key = loadKey();
  fs.writeFileSync(path.join(PROFILES_DIR, `${name}.json`), JSON.stringify({
    email: res.locals.user?.email,
    auth, apiKey: key?.key,
  }, null, 2));
  flash(res, `saved profile "${name}"`, 'info');
  res.redirect(req.body._redirect || '/dashboard/settings');
});

// SAVE current + LOGOUT + redirect to login — the proper "add another account" flow
app.post('/profiles/add-account', requireAuth, async (req, res) => {
  // 1. auto-save current under email-derived name (or timestamp if not named)
  let baseName = (res.locals.user?.email || `acc-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  let candidate = baseName;
  let n = 1;
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
  while (fs.existsSync(path.join(PROFILES_DIR, `${candidate}.json`))) {
    n++; candidate = `${baseName}-${n}`;
    if (n > 99) break;
  }
  let auth = loadAuth();
  let key = loadKey();
  fs.writeFileSync(path.join(PROFILES_DIR, `${candidate}.json`), JSON.stringify({
    email: res.locals.user?.email,
    auth, apiKey: key?.key,
  }, null, 2));
  // 2. clear current session
  try { fs.unlinkSync(path.join(cfg.bonDir, 'auth.json')); } catch {}
  try { fs.unlinkSync(path.join(cfg.bonDir, 'apikey.json')); } catch {}
  // 3. send to login
  flash(res, `saved current as "${candidate}", sign in with another account →`, 'info');
  res.redirect('/login');
});

// delete profile
app.post('/profiles/:name/delete', requireAuth, async (req, res) => {
  let name = req.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
  try {
    fs.unlinkSync(path.join(PROFILES_DIR, `${name}.json`));
    flash(res, `deleted profile "${name}"`, 'info');
  } catch (e) { flash(res, `delete failed: ${e.message}`, 'error'); }
  res.redirect('/dashboard/settings');
});

app.get('/dashboard/settings', requireAuth, (req, res) => {
  res.render('dashboard/settings', { storedKey: loadKey(), profiles: listProfiles() });
});

// ─── DOCS — auto-fetch from GitHub raw, cache locally, render via marked ───
// works from any install location (next-to-bon, ~/.bonsai-oss/trybons, etc)
// because we don't depend on a sibling git repo. github is source of truth.
const REPO_RAW = 'https://raw.githubusercontent.com/DexCodeSX/Secret/main';
const DOCS_CACHE = path.join(__dirname, '.docs-cache');
const DOCS_TTL = 3600 * 1000; // 1h
const ALL_DOCS = [
  { slug: 'readme',    file: 'README.md',         title: 'Getting started',         icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', group: 'guides' },
  { slug: 'changelog', file: 'CHANGELOG.md',      title: 'Changelog',               icon: 'M19 14l-7 7m0 0l-7-7m7 7V3', group: 'guides' },
  { slug: 'models',    file: 'MODELS.md',         title: 'Models catalog',          icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', group: 'reference' },
  { slug: 'findings',  file: 'FINDINGS.md',       title: 'Bonsai CLI RE',           icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', group: 'recon' },
  { slug: 'recon',     file: 'TRYBONS_RECON.md',  title: 'trybons.ai surface map',  icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7', group: 'recon' },
];
function discoverDocs() { return ALL_DOCS; }

async function fetchDoc(file, force = false) {
  fs.mkdirSync(DOCS_CACHE, { recursive: true });
  let cached = path.join(DOCS_CACHE, file);
  // try local sibling repo first (if dev-running from git checkout)
  let localSibling = path.join(__dirname, '..', file);
  if (!force && fs.existsSync(localSibling)) return fs.readFileSync(localSibling, 'utf8');
  // try cache
  if (!force && fs.existsSync(cached)) {
    let age = Date.now() - fs.statSync(cached).mtimeMs;
    if (age < DOCS_TTL) return fs.readFileSync(cached, 'utf8');
  }
  // fetch from github
  try {
    let r = await req(`${REPO_RAW}/${file}`, { timeout: 8000 });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    let body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    fs.writeFileSync(cached, body);
    return body;
  } catch (e) {
    // network fail → return stale cache if any
    if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
    throw e;
  }
}

// configure marked: GFM tables, headerIds, strip leading anchor links
marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });

app.get('/docs', (req, res) => {
  let docs = discoverDocs();
  res.render('docs/index', { docs });
});

app.get('/docs/:slug', async (req, res) => {
  let docs = discoverDocs();
  let doc = docs.find(d => d.slug === req.params.slug);
  if (!doc) return res.status(404).render('docs/index', { docs, notFound: req.params.slug });
  let raw = '';
  let stale = false;
  try { raw = await fetchDoc(doc.file, req.query.refresh === '1'); }
  catch (e) { raw = `# Could not load ${doc.file}\n\n_${e.message}_\n\nTry [refresh](?refresh=1) or check your network.`; stale = true; }
  // strip the html badge nav at top of README (keep doc focused)
  raw = raw.replace(/<p align="center">[\s\S]*?<\/p>\s*/g, '');
  let html = marked.parse(raw);
  let toc = [];
  let tocRegex = /<h([23])>([^<]+)<\/h[23]>/g; let m;
  while ((m = tocRegex.exec(html))) {
    let id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    toc.push({ level: parseInt(m[1]), text: m[2], id });
  }
  html = html.replace(/<h([23])>([^<]+)<\/h[23]>/g, (full, lvl, txt) => {
    let id = txt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `<h${lvl} id="${id}"><a href="#${id}" class="anchor">${txt}</a></h${lvl}>`;
  });
  res.render('docs/page', { docs, doc, html, toc, stale });
});

// ─── start ───
app.listen(PORT, HOST, () => {
  let RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m', GRN = '\x1b[38;5;115m', GLD = '\x1b[38;5;179m', CYN = '\x1b[38;5;116m', MUTE = '\x1b[38;5;240m';
  console.log('');
  console.log(`  ${MUTE}╭${'─'.repeat(56)}╮${RESET}`);
  console.log(`  ${MUTE}│${RESET}    ${GRN}◆${RESET}  ${BOLD}T R Y B O N S${RESET}   ${DIM}u i${RESET}                              ${MUTE}│${RESET}`);
  console.log(`  ${MUTE}│${RESET}    ${MUTE}open source dashboard for bonsai${RESET}                  ${MUTE}│${RESET}`);
  console.log(`  ${MUTE}╰${'─'.repeat(56)}╯${RESET}`);
  console.log('');
  console.log(`  ${GRN}●${RESET}  listening    ${BOLD}http://localhost:${PORT}${RESET}`);
  console.log(`  ${GRN}●${RESET}  shares session w/  ${CYN}~/.bonsai-oss/${RESET}`);
  console.log(`  ${MUTE}● ${RESET}${MUTE}stack: express + ejs + htmx + tailwind (no build)${RESET}`);
  console.log('');
  // try to open browser (not on termux/headless)
  if (process.env.TERMUX_VERSION || process.env.SSH_TTY) return;
  let opener = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { import('child_process').then(cp => cp.execSync(`${opener} http://localhost:${PORT}`, { stdio: 'ignore' })); } catch {}
});
