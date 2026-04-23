#!/usr/bin/env node

// bonsai.js v2.4.0 — 23/04/2026
// github.com/DexCodeSX/Secret
// re'd from @bonsai-ai/cli 0.4.13

import { createInterface } from 'readline';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import crypto from 'crypto';

const VERSION = "2.5.8";
const REPO = "DexCodeSX/Secret";
const REPO_RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const isWin = process.platform === 'win32';
const isTerm = process.env.TERMUX_VERSION != null;
const noColor = process.env.NO_COLOR != null || process.env.TERM === 'dumb';

// -- config --
const cfg = {
  workos: { clientId: process.env.BONSAI_OAUTH_CLIENT_ID || "client_01K2ZG07ZTYR0FQNERK3PS2CB0", apiUrl: "https://api.workos.com" },
  backend: process.env.BONSAI_BASE_URL || "https://api.trybons.ai",
  router: process.env.BONSAI_ROUTER_URL || "https://go.trybons.ai",
  staging: { backend: "https://api-staging.trybons.ai", app: "https://app-staging.trybons.ai" },
  statsig: { web: "client-iipeckyRMmjuabUsf0oqp88IgKZsIZyPAPj0CNVJgtM", cli: process.env.STATSIG_CLIENT_KEY || "client-yHi9oHzSCwrVz3W62PaedcrxeGnL7o2PjNJDByGkIsn" },
  configDir: path.join(os.homedir(), '.bonsai-oss'),
  tokenFile: 'auth.json',
  keyFile: 'apikey.json',
  settingsFile: 'settings.json',
  knownVersions: { cli: "0.4.13", codex: "0.105.1", claudeCode: "2.1.112" }
};

// -- ui v3 --
// muted premium palette. cooler, slightly more refined than v2.
// honors NO_COLOR / TERM=dumb so log files don't get garbled.

function _ansi(code) { return noColor ? '' : code; }

const c = {
  reset: _ansi('\x1b[0m'),
  bold: _ansi('\x1b[1m'),
  dim: _ansi('\x1b[2m'),
  italic: _ansi('\x1b[3m'),
  under: _ansi('\x1b[4m'),
  red: _ansi('\x1b[38;5;174m'),
  green: _ansi('\x1b[38;5;115m'),
  yellow: _ansi('\x1b[38;5;180m'),
  blue: _ansi('\x1b[38;5;111m'),
  cyan: _ansi('\x1b[38;5;116m'),
  magenta: _ansi('\x1b[38;5;146m'),
  orange: _ansi('\x1b[38;5;215m'),
  pink: _ansi('\x1b[38;5;218m'),
  gold: _ansi('\x1b[38;5;179m'),
  teal: _ansi('\x1b[38;5;109m'),
  gray: _ansi('\x1b[38;5;245m'),
  white: _ansi('\x1b[38;5;252m'),
  fg: _ansi('\x1b[38;5;250m'),
  sub: _ansi('\x1b[38;5;245m'),
  mute: _ansi('\x1b[38;5;240m'),
  fade: _ansi('\x1b[38;5;236m'),
  bg: {
    dark: _ansi('\x1b[48;5;235m'),
    accent: _ansi('\x1b[48;5;236m'),
    green: _ansi('\x1b[48;5;22m'),
    red: _ansi('\x1b[48;5;52m'),
    blue: _ansi('\x1b[48;5;24m'),
    yellow: _ansi('\x1b[48;5;94m'),
  },
  // green->teal sweep (banner)
  gr: ['\x1b[38;5;28m','\x1b[38;5;34m','\x1b[38;5;78m','\x1b[38;5;79m','\x1b[38;5;115m','\x1b[38;5;116m','\x1b[38;5;109m'].map(_ansi),
  // gold sweep (highlights / version bumps)
  grAlt: ['\x1b[38;5;94m','\x1b[38;5;136m','\x1b[38;5;172m','\x1b[38;5;179m','\x1b[38;5;215m','\x1b[38;5;221m'].map(_ansi),
};

const S = {
  topL: '\u256D', topR: '\u256E', botL: '\u2570', botR: '\u256F',
  h: '\u2500', v: '\u2502', dot: '\u25CF', ring: '\u25CB', dia: '\u25C6',
  arr: '\u2192', chk: '\u2713', cross: '\u2717', tri: '\u25B8',
  warn: '!', star: '\u2605', bolt: '\u26A1', key: '\u25C6',
  tree: '\u25C6', lock: '\u25C6', unlock: '\u25C7', eye: '\u25CE',
  chart: '\u25A0', globe: '\u25C8', shield: '\u25C6', rocket: '\u25B8',
  bar: { full: '\u2588', high: '\u2593', mid: '\u2592', low: '\u2591', empty: ' ' },
  // new in v3: heavy box drawing, pill caps, smooth braille spinners
  hH: '\u2501', vH: '\u2503',
  sm: '\u00b7', pillL: '\u2590', pillR: '\u258c', arrH: '\u279c',
  spin: ['\u280b','\u2819','\u2839','\u2838','\u283c','\u2834','\u2826','\u2827','\u2807','\u280f'],
  spinPulse: ['\u2802','\u2806','\u2807','\u280f','\u281f','\u283f','\u287f','\u28ff','\u287f','\u283f','\u281f','\u280f','\u2807','\u2806','\u2802','\u2800'],
};

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ''); }
function visWidth(s) {
  let clean = stripAnsi(s), w = 0;
  for (let ch of clean) w += (ch.codePointAt(0) > 0x1F00) ? 2 : 1;
  return w;
}
function pad(s, n) { return s + ' '.repeat(Math.max(0, n - visWidth(s))); }

function gradText(text, colors) {
  let out = '', ci = 0;
  for (let ch of text) { out += colors[ci % colors.length] + ch; if (ch !== ' ') ci++; }
  return out + c.reset;
}

function box(lines, opts = {}) {
  let title = opts.title || '';
  let accent = opts.color || c.mute;
  let contentW = Math.max(...lines.map(l => visWidth(l)));
  let titleW = visWidth(title) + 5;
  let minW = Math.max(contentW + 4, titleW + 4, opts.width || 0);

  let top = title
    ? `${accent}${S.topL}${S.h} ${c.bold}${c.fg}${title}${c.reset} ${accent}${S.h.repeat(Math.max(0, minW - titleW))}${S.topR}${c.reset}`
    : `${accent}${S.topL}${S.h.repeat(minW - 2)}${S.topR}${c.reset}`;

  let empty = `${accent}${S.v}${c.reset}${' '.repeat(minW - 2)}${accent}${S.v}${c.reset}`;
  let bot = `${accent}${S.botL}${S.h.repeat(minW - 2)}${S.botR}${c.reset}`;

  console.log(top);
  console.log(empty);
  for (let line of lines) {
    let gap = minW - visWidth(line) - 4;
    console.log(`${accent}${S.v}${c.reset} ${line}${' '.repeat(Math.max(0, gap))} ${accent}${S.v}${c.reset}`);
  }
  console.log(empty);
  console.log(bot);
}

function banner() {
  let w = 56;
  let title = '\u25C6  B O N S A I';
  let tag   = 'reverse engineered \u00B7 free models \u00B7 zero telemetry';
  let vRaw  = `v${VERSION}  github.com/${REPO}`;
  let vline = `${c.gold}v${VERSION}${c.reset}  ${c.dim}github.com/${REPO}${c.reset}`;

  let topRule = `${c.fade}${S.topL}${S.h.repeat(w)}${S.topR}${c.reset}`;
  let botRule = `${c.fade}${S.botL}${S.h.repeat(w)}${S.botR}${c.reset}`;
  let blank   = `${c.fade}${S.v}${c.reset}${' '.repeat(w)}${c.fade}${S.v}${c.reset}`;
  let row = (text, raw) => {
    let g = w - visWidth(raw);
    return `${c.fade}${S.v}${c.reset}${' '.repeat(4)}${text}${' '.repeat(Math.max(0, g - 4))}${c.fade}${S.v}${c.reset}`;
  };

  console.log('');
  console.log(topRule);
  console.log(blank);
  console.log(row(gradText(title, c.gr), title));
  console.log(row(`${c.sub}${tag}${c.reset}`, tag));
  console.log(row(vline, vRaw));
  console.log(blank);
  console.log(botRule);
  console.log('');
}

function spinner(msg, frames) {
  frames = frames || S.spin;
  // non-tty: print once, no \r animation, keeps log files readable
  if (!process.stdout.isTTY || noColor) {
    console.log(`  ${c.sub}${msg}...${c.reset}`);
    return { stop: (final) => { if (final) console.log(final); } };
  }
  let i = 0;
  let id = setInterval(() => {
    let f = frames[i++ % frames.length];
    process.stdout.write(`\r  ${c.green}${f}${c.reset}  ${c.sub}${msg}${c.reset}   `);
  }, 80);
  return { stop: (final) => { clearInterval(id); process.stdout.write(`\r${' '.repeat(visWidth(msg) + 12)}\r`); if (final) console.log(final); } };
}

// pill-style status badge with rounded ends
function pill(label, color, fg) {
  color = color || c.green; fg = fg || c.white;
  return `${color}${S.pillL}${c.bg.dark}${fg}${c.bold} ${label} ${c.reset}${color}${S.pillR}${c.reset}`;
}

// dim rule with optional small label
function divider(label, width) {
  width = width || 60;
  if (!label) return `${c.fade}${S.h.repeat(width)}${c.reset}`;
  let lw = visWidth(label);
  let pad = Math.max(0, width - lw - 4);
  return `${c.fade}${S.h.repeat(2)}${c.reset} ${c.sub}${c.bold}${label}${c.reset} ${c.fade}${S.h.repeat(pad)}${c.reset}`;
}

// aligned key/value row
function kv(k, v, kw) {
  kw = kw || 12;
  return `  ${c.dim}${k.padEnd(kw)}${c.reset}  ${v}`;
}

function progressBar(current, total, width = 30) {
  let pct = Math.min(1, current / total);
  let filled = Math.round(pct * width);
  let bar = `${c.green}${S.bar.full.repeat(filled)}${c.mute}${S.bar.low.repeat(width - filled)}${c.reset}`;
  return `${bar} ${c.bold}${Math.round(pct * 100)}%${c.reset}`;
}

function log(msg) { console.log(msg); }
function success(msg) { console.log(`  ${c.green}${S.chk}${c.reset}  ${msg}`); }
function fail(msg)    { console.error(`  ${c.red}${S.cross}${c.reset}  ${msg}`); }
function info(msg)    { console.log(`  ${c.blue}${S.tri}${c.reset}  ${msg}`); }
function warn(msg)    { console.log(`  ${c.orange}${S.warn}${c.reset}  ${msg}`); }
function note(msg)    { console.log(`  ${c.mute}${S.sm}${c.reset}  ${c.sub}${msg}${c.reset}`); }

function statusBadge(ok, label) {
  return ok ? pill(label, c.green) : pill(label, c.red);
}

// -- storage --
function ensureDir() { if (!fs.existsSync(cfg.configDir)) fs.mkdirSync(cfg.configDir, { recursive: true }); }
function saveJson(file, data) { ensureDir(); fs.writeFileSync(path.join(cfg.configDir, file), JSON.stringify(data, null, 2)); }
function loadJson(file) { try { return JSON.parse(fs.readFileSync(path.join(cfg.configDir, file), 'utf8')); } catch { return null; } }
function saveSetting(k, v) { let s = loadJson(cfg.settingsFile) || {}; s[k] = v; saveJson(cfg.settingsFile, s); }
function getSetting(k) { return (loadJson(cfg.settingsFile) || {})[k]; }

function ask(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(`  ${c.cyan}?${c.reset} ${q}`, a => { rl.close(); r(a.trim()); }));
}

async function askYN(question) {
  let a = await ask(`${question} ${c.dim}[Y/n]${c.reset} `);
  return !a || a.toLowerCase() === 'y' || a.toLowerCase() === 'yes';
}

async function pick(question, options) {
  log(`\n  ${c.bold}${question}${c.reset}\n`);
  options.forEach((o, i) => {
    let num = `${c.cyan}${c.bold}[${i + 1}]${c.reset}`;
    log(`    ${num} ${o}`);
  });
  while (true) {
    let a = await ask(`Select ${c.dim}[1-${options.length}]${c.reset}: `);
    let n = parseInt(a);
    if (n >= 1 && n <= options.length) return { choice: options[n - 1], index: n - 1 };
    fail("invalid choice, try again");
  }
}

function maskKey(k) { return (!k || k.length < 12) ? (k || '???') : k.substring(0, 8) + '...' + k.substring(k.length - 4); }
function relTime(ts) { let d = Date.now() - new Date(ts).getTime(); let m = Math.floor(d/60000); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`; }
function fmtNum(n) { return n.toLocaleString(); }

// -- http --
function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    let u = new URL(url);
    let mod = u.protocol === 'https:' ? https : http;
    let r = mod.request(u, { method: opts.method || 'GET', headers: opts.headers || {}, timeout: opts.timeout || 30000 }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location)
        return req(res.headers.location, opts).then(resolve).catch(reject);
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { let body = Buffer.concat(chunks).toString(); try { body = JSON.parse(body); } catch {} resolve({ status: res.statusCode, headers: res.headers, body }); });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (opts.body) r.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    r.end();
  });
}

function reqStream(url, opts = {}) {
  return new Promise((resolve, reject) => {
    let u = new URL(url);
    let mod = u.protocol === 'https:' ? https : http;
    let r = mod.request(u, { method: opts.method || 'GET', headers: opts.headers || {} }, res => resolve(res));
    r.on('error', reject);
    if (opts.body) r.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    r.end();
  });
}

// -- updates --
async function checkSelfUpdate(silent = false) {
  try {
    let res = await req(`${REPO_RAW}/bonsai.js`, { timeout: 5000 });
    let remote = typeof res.body === 'string' ? res.body : '';
    let match = remote.match(/VERSION\s*=\s*"([^"]+)"/);
    let newer = (a, b) => { let [a1,a2,a3] = a.split('.').map(Number), [b1,b2,b3] = b.split('.').map(Number); return a1>b1 || (a1===b1 && a2>b2) || (a1===b1 && a2===b2 && a3>b3); };
    if (match && newer(match[1], VERSION)) {
      if (silent) {
        // background check: compact one-liner alert
        log('');
        log(`  ${c.yellow}${S.bolt}${c.reset} ${c.bold}${c.yellow}v${match[1]} available${c.reset} ${c.mute}(you have v${VERSION})${c.reset}  ${c.dim}${S.arr} ${c.cyan}bon update${c.reset}`);
      } else {
        log('');
        box([
          `${c.yellow}${S.bolt} Update available!${c.reset}`,
          ``,
          `  Current: ${c.red}v${VERSION}${c.reset}`,
          `  Latest:  ${c.green}v${match[1]}${c.reset}`,
          ``,
          `  ${c.dim}platform: ${c.cyan}${detectPlatform()}${c.reset}`,
        ], { title: 'UPDATE', color: c.yellow, width: 58 });
        log('');
        let yes = await askYN(`${c.bold}Update to v${match[1]} now?${c.reset}`);
        if (yes) await performSelfUpdate();
        else { info('skipped. run ' + c.cyan + 'bon update' + c.reset + ' when ready.'); }
      }
      return { available: true, current: VERSION, latest: match[1] };
    }
    return { available: false };
  } catch { return { available: false }; }
}

function detectPlatform() {
  if (isTerm) return 'termux';
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') {
    // PSModulePath is set by PowerShell, not by CMD
    if (process.env.PSModulePath) return 'powershell';
    return 'cmd';
  }
  return 'linux';
}

// detect how bon was installed: 'npm' (>= v2.5.8) or 'script' (legacy curl|bash)
function detectInstallMethod() {
  let scriptPath = process.argv[1] || '';
  let lower = scriptPath.toLowerCase().replace(/\\/g, '/');
  if (lower.includes('node_modules/@dexcodesx/bon')) return 'npm';
  if (lower.includes('/.bonsai-oss/bonsai.js') || lower.includes('/.bonsai-oss/bin/')) return 'script';
  return 'unknown';
}

async function performSelfUpdate() {
  let how = detectInstallMethod();
  log('');
  if (how === 'script') {
    box([
      `${c.gold}${S.bolt}${c.reset} ${c.bold}you're on the OLD install method (curl|bash)${c.reset}`,
      ``,
      `  v2.5.8+ ships via ${c.cyan}npm${c.reset}. one cmd, cross-platform updates.`,
      ``,
      `  ${c.bold}migrate now:${c.reset}`,
      `    ${c.cyan}npm i -g @dexcodesx/bon${c.reset}`,
      ``,
      `  then optionally remove the old wrapper:`,
      `    ${c.dim}rm -rf ~/.bonsai-oss/bin ~/.bonsai-oss/bonsai.js ~/.bonsai-oss/api.js${c.reset}`,
      ``,
      `  ${c.dim}your auth + keys + profiles in ~/.bonsai-oss/ stay intact.${c.reset}`,
    ], { title: 'NPM MIGRATION', color: c.gold, width: 64 });
    log('');
    let yes = await askYN(`${c.bold}run ${c.cyan}npm i -g @dexcodesx/bon${c.reset}${c.bold} now?${c.reset}`);
    if (yes) {
      try {
        execSync('npm i -g @dexcodesx/bon', { stdio: 'inherit', shell: true, timeout: 180000 });
        success('npm install complete. restart terminal + run `bon --version` to verify.');
      } catch (e) { fail(`npm install failed: ${e.message}`); info(`try with sudo or check npm config.`); }
    }
  } else {
    info(`installed via ${c.cyan}${how === 'npm' ? 'npm' : 'unknown method'}${c.reset}`);
    let cmd = 'npm i -g @dexcodesx/bon';
    info(`running: ${c.dim}${cmd}${c.reset}`);
    try {
      execSync(cmd, { stdio: 'inherit', shell: true, timeout: 180000 });
      success(`${c.bold}updated!${c.reset} run \`bon --version\` to verify.`);
    } catch (e) { fail(`update failed: ${e.message}`); info(`try: ${c.cyan}${cmd}${c.reset}`); }
  }
}

// shown once per machine — see ~/.bonsai-oss/.npm_migration_seen marker
function showMigrationNoticeOnce() {
  if (detectInstallMethod() !== 'script') return;
  let flagFile = path.join(cfg.configDir, '.npm_migration_seen');
  if (fs.existsSync(flagFile)) return;
  log('');
  box([
    `${c.gold}${S.bolt}${c.reset} ${c.bold}heads up — bon now ships via npm${c.reset}`,
    ``,
    `  you installed via the old curl|bash script.`,
    `  v2.5.8+ uses ${c.cyan}npm${c.reset} for one-cmd cross-platform updates.`,
    ``,
    `  ${c.bold}migrate when you have a sec:${c.reset}`,
    `    ${c.cyan}npm i -g @dexcodesx/bon${c.reset}`,
    `    ${c.cyan}bon --version${c.reset}    ${c.dim}# verify, then optionally:${c.reset}`,
    `    ${c.dim}rm -rf ~/.bonsai-oss/bin ~/.bonsai-oss/bonsai.js ~/.bonsai-oss/api.js${c.reset}`,
    ``,
    `  ${c.mute}or just run ${c.cyan}bon update${c.mute} and confirm Y.${c.reset}`,
    `  ${c.mute}your data in ~/.bonsai-oss/ stays. this notice shows once.${c.reset}`,
  ], { title: 'NPM MIGRATION', color: c.gold, width: 68 });
  log('');
  try { fs.writeFileSync(flagFile, new Date().toISOString()); } catch {}
}

async function checkBonsaiUpdates() {
  let results = {};
  try {
    let r = await req('https://registry.npmjs.org/@bonsai-ai/cli/latest', { timeout: 5000 });
    results.cli = { version: r.body?.version, changed: r.body?.version !== cfg.knownVersions.cli };
  } catch { results.cli = { error: true }; }
  try {
    let r = await req('https://registry.npmjs.org/@bonsai-ai/codex/latest', { timeout: 5000 });
    results.codex = { version: r.body?.version, changed: r.body?.version !== cfg.knownVersions.codex };
  } catch { results.codex = { error: true }; }
  try {
    let r = await req('https://registry.npmjs.org/@bonsai-ai/claude-code/latest', { timeout: 5000 });
    results.claudeCode = { version: r.body?.version, changed: r.body?.version !== cfg.knownVersions.claudeCode };
  } catch { results.claudeCode = { error: true }; }
  return results;
}

// -- auth --
async function deviceAuth() {
  let res = await req(`${cfg.workos.apiUrl}/user_management/authorize/device`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.workos.clientId, scope: 'openid email profile' })
  });
  return res.body;
}

async function pollAuth(deviceCode) {
  let res = await req(`${cfg.workos.apiUrl}/user_management/authenticate`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode, client_id: cfg.workos.clientId }).toString()
  });
  return res.body;
}

async function refreshToken(token) {
  let res = await req(`${cfg.workos.apiUrl}/user_management/authenticate`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token, client_id: cfg.workos.clientId }).toString()
  });
  return res.body;
}

function getToken() { let a = loadJson(cfg.tokenFile); return a?.access_token || null; }
async function ensureToken() {
  let auth = loadJson(cfg.tokenFile);
  if (!auth) return null;
  if (auth.saved_at && Date.now() - auth.saved_at > 82800000) {
    try {
      let fresh = await refreshToken(auth.refresh_token);
      if (fresh.access_token) { fresh.saved_at = Date.now(); saveJson(cfg.tokenFile, fresh); return fresh.access_token; }
    } catch { return null; }
  }
  return auth.access_token;
}

// -- api --
async function createApiKey(name) {
  let token = await ensureToken(); if (!token) throw new Error("not authed");
  return (await req(`${cfg.backend}/keys/`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })).body;
}
async function listApiKeys() {
  let token = await ensureToken(); if (!token) throw new Error("not authed");
  return (await req(`${cfg.backend}/keys/`, { headers: { 'Authorization': `Bearer ${token}` } })).body;
}
async function deleteApiKey(id) {
  let token = await ensureToken(); if (!token) throw new Error("not authed");
  return (await req(`${cfg.backend}/keys/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })).body;
}
function getStoredKey() { return loadJson(cfg.keyFile)?.key || null; }
async function getUser() {
  let token = await ensureToken(); if (!token) return null;
  return (await req(`${cfg.backend}/auth/user`, { headers: { 'Authorization': `Bearer ${token}` } })).body;
}
async function getActivity(page = 1, size = 20) {
  let token = await ensureToken(); if (!token) return null;
  return (await req(`${cfg.backend}/billing/activity?page=${page}&page_size=${size}`, { headers: { 'Authorization': `Bearer ${token}` } })).body;
}
async function getConsentStatus() {
  let token = await ensureToken(); if (!token) return null;
  return (await req(`${cfg.backend}/consent/status`, { headers: { 'Authorization': `Bearer ${token}` } })).body;
}

// -- decrypt official config --
function decryptBonsaiConfig(filePath) {
  let encKey = crypto.scryptSync("bonsai-cli", "salt", 32).toString("hex").slice(0, 32);
  let raw = fs.readFileSync(filePath);
  let iv = raw.slice(0, 16);
  let derived = crypto.pbkdf2Sync(encKey, iv.toString(), 10000, 32, "sha512");
  let decipher = crypto.createDecipheriv("aes-256-cbc", derived, iv);
  return JSON.parse(Buffer.concat([decipher.update(raw.slice(17)), decipher.final()]).toString());
}

// -- launchers --
function getRouter() { return getSetting('router') || cfg.router; }

function launchClaude(apiKey, extra = []) {
  let router = getRouter();
  let pkg = '@bonsai-ai/claude-code@latest';
  info(`package: ${c.cyan}${pkg}${c.reset}`);
  info(`router: ${c.cyan}${router}${c.reset}`);
  info(`key: ${c.dim}${maskKey(apiKey)}${c.reset}`);
  if (extra.length) info(`flags: ${c.dim}${extra.join(' ')}${c.reset}`);
  log('');

  let env = { ...process.env, ANTHROPIC_BASE_URL: router, ANTHROPIC_AUTH_TOKEN: apiKey };
  let cmd = ['npx', '--yes', pkg, ...extra].join(' ');
  let child = spawn(cmd, [], { stdio: 'inherit', env, shell: true, windowsHide: false });
  child.on('exit', code => process.exit(code || 0));
}

function launchCodex(apiKey, extra = []) {
  info(`package: ${c.cyan}@bonsai-ai/codex@latest${c.reset}`);

  // v2.4.2: codex now actually uses OpenAI models (not silently mapped to claude).
  // we force model="gpt-5" by default. user can override with --model in extra.
  // api.js v2.4.2 strips the old gpt-*->claude-* redirect — pass-through to openai.
  let userPickedModel = extra.some(a => a === '-m' || a === '--model' || a.startsWith('--model='));
  let defaultModel = 'gpt-5';

  // codex uses /responses endpoint which the router doesn't support.
  // start api.js in background, point codex at localhost proxy.
  let apiPath = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'api.js');
  if (isWin && apiPath.startsWith('/')) apiPath = apiPath.slice(1); // fix /C: -> C:
  let proxyPort = 14088;

  if (fs.existsSync(apiPath)) {
    info(`starting api.js proxy on :${proxyPort} ${c.dim}(codex needs /responses)${c.reset}`);
    let proxy = spawn('node', [apiPath, '-p', String(proxyPort)], {
      stdio: 'ignore', env: { ...process.env, BONSAI_API_KEY: apiKey },
      detached: true, windowsHide: true,
    });
    proxy.unref();
    execSync(isWin ? `ping -n 2 127.0.0.1 >nul` : 'sleep 1');
    process.on('exit', () => { try { process.kill(proxy.pid); } catch {} });

    let base = `http://localhost:${proxyPort}`;
    let env = { ...process.env, BONSAI_API_KEY: apiKey, OPENAI_API_KEY: 'bonsai', OPENAI_BASE_URL: `${base}/v1` };
    let baseArgs = [
      '-c', 'model_provider="bonsai"',
      '-c', 'model_providers.bonsai.name="Bonsai"',
      '-c', `model_providers.bonsai.base_url="${base}"`,
      '-c', 'model_providers.bonsai.env_key="OPENAI_API_KEY"',
    ];
    if (!userPickedModel) baseArgs.push('-c', `model="${defaultModel}"`);

    let cmd = ['npx', '--yes', '@bonsai-ai/codex@latest', ...baseArgs, ...extra].join(' ');
    info(`router: ${c.cyan}${base}${c.reset} ${c.dim}(via api.js proxy)${c.reset}`);
    info(`model name: ${c.cyan}${userPickedModel ? '(user override)' : defaultModel}${c.reset}`);
    note(`bonsai router ignores model selection — all reqs serve ${c.gold}claude-opus-4.7${c.reset}${c.mute} (statsig fixed_routing_model)${c.reset}`);
    let child = spawn(cmd, [], { stdio: 'inherit', env, shell: true, windowsHide: false });
    child.on('exit', code => { try { process.kill(proxy.pid); } catch {} process.exit(code || 0); });
  } else {
    warn("api.js not found — codex may get 404 on /responses");
    let env = { ...process.env, BONSAI_API_KEY: apiKey, OPENAI_API_KEY: apiKey, OPENAI_BASE_URL: `${cfg.router}/v1` };
    let baseArgs = [
      '-c', 'model_provider="bonsai"',
      '-c', 'model_providers.bonsai.name="Bonsai"',
      '-c', `model_providers.bonsai.base_url="${cfg.router}"`,
      '-c', 'model_providers.bonsai.env_key="BONSAI_API_KEY"',
    ];
    if (!userPickedModel) baseArgs.push('-c', `model="${defaultModel}"`);
    let cmd = ['npx', '--yes', '@bonsai-ai/codex@latest', ...baseArgs, ...extra].join(' ');
    let child = spawn(cmd, [], { stdio: 'inherit', env, shell: true, windowsHide: false });
    child.on('exit', code => process.exit(code || 0));
  }
}

function launchGeneric(apiKey, command) {
  let env = { ...process.env, ANTHROPIC_BASE_URL: cfg.router, ANTHROPIC_AUTH_TOKEN: apiKey, ANTHROPIC_API_KEY: apiKey, OPENAI_BASE_URL: `${cfg.router}/v1`, OPENAI_API_KEY: apiKey, BONSAI_API_KEY: apiKey };
  let child = spawn(command, [], { stdio: 'inherit', env, shell: true, windowsHide: false });
  child.on('exit', code => process.exit(code || 0));
}

// -- key pool --
function loadPool() {
  let dir = path.join(cfg.configDir, 'profiles');
  if (!fs.existsSync(dir)) return [];
  let keys = [];
  try {
    let files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (let f of files) {
      let d = loadJson(`profiles/${f}`);
      if (d?.apiKey) keys.push({ name: f.replace('.json',''), key: d.apiKey, email: d?.email || '?', limited: false });
    }
  } catch {}
  let current = getStoredKey();
  if (current && !keys.find(k => k.key === current)) keys.unshift({ name: 'current', key: current, email: '(active)', limited: false });
  return keys;
}

function poolFile() { return path.join(cfg.configDir, 'pool-state.json'); }
function loadPoolState() { try { return JSON.parse(fs.readFileSync(poolFile(), 'utf8')); } catch { return { limited: {}, index: 0 }; } }
function savePoolState(s) { ensureDir(); fs.writeFileSync(poolFile(), JSON.stringify(s, null, 2)); }

function markKeyLimited(key) {
  let s = loadPoolState();
  s.limited[key] = new Date().toISOString().substring(0, 10);
  savePoolState(s);
}

function getNextKey(pool) {
  let s = loadPoolState();
  let today = new Date().toISOString().substring(0, 10);
  // clear yesterday's limits
  for (let k of Object.keys(s.limited)) { if (s.limited[k] < today) delete s.limited[k]; }
  savePoolState(s);
  // find first non-limited key
  for (let i = 0; i < pool.length; i++) {
    let idx = (s.index + i) % pool.length;
    if (!s.limited[pool[idx].key]) {
      s.index = idx;
      savePoolState(s);
      return pool[idx];
    }
  }
  return null;
}

function rotateToNext(pool, currentKey) {
  markKeyLimited(currentKey);
  let s = loadPoolState();
  s.index = (s.index + 1) % pool.length;
  savePoolState(s);
  return getNextKey(pool);
}

// -- proxy --
function startProxy(apiKey, port = 8787, rotate = false) {
  let pool = rotate ? loadPool() : [];
  let activeKey = apiKey;
  let reqCount = 0, totalIn = 0, totalOut = 0, rotations = 0;

  if (rotate && pool.length < 2) {
    warn("rotate needs 2+ profiles in pool");
    info(`add profiles: ${c.cyan}bon multi${c.reset} ${S.arr} Save current`);
    if (pool.length === 0) { fail("no keys in pool"); return; }
  }

  function buildHeaders(incoming, key) {
    let fwdH = {};
    for (let [k,v] of Object.entries(incoming.headers)) {
      if (!['host','connection','transfer-encoding','keep-alive'].includes(k)) fwdH[k] = v;
    }
    fwdH['host'] = new URL(getRouter()).host;
    fwdH['x-api-key'] = key;
    fwdH['authorization'] = `Bearer ${key}`;
    return fwdH;
  }

  let server = http.createServer(async (incoming, outgoing) => {
    if (incoming.method === 'OPTIONS') {
      outgoing.writeHead(204, { 'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-max-age':'86400' });
      outgoing.end(); return;
    }
    let chunks = [];
    incoming.on('data', ch => chunks.push(ch));
    incoming.on('end', async () => {
      let body = Buffer.concat(chunks).toString();
      let router = getRouter();
      let targetUrl = `${router}${incoming.url}`;
      reqCount++;
      let isStream = false;
      try { isStream = JSON.parse(body).stream === true; } catch {}
      console.log(`${c.dim}[#${reqCount}] ${incoming.method} ${incoming.url} stream=${isStream} key=${maskKey(activeKey)}${c.reset}`);

      async function tryRequest(key) {
        let fwdH = buildHeaders(incoming, key);
        if (isStream) {
          let up = await reqStream(targetUrl, { method: incoming.method, headers: fwdH, body: body || undefined });
          // for streaming, buffer first chunk to check for limit error
          return new Promise((resolve, reject) => {
            let firstChunks = [];
            let gotData = false;
            up.on('data', chunk => {
              if (!gotData) {
                gotData = true;
                let text = chunk.toString();
                if (text.includes('exceeded') && text.includes('daily token limit')) {
                  resolve({ limited: true, status: up.statusCode });
                  up.destroy();
                  return;
                }
              }
              firstChunks.push(chunk);
            });
            up.on('end', () => resolve({ limited: false, stream: false, chunks: firstChunks, status: up.statusCode, headers: up.headers }));
            up.on('error', reject);
            // if streaming response is ok, pipe it
            if (up.statusCode < 400) {
              let rh = { ...up.headers }; rh['access-control-allow-origin'] = '*';
              outgoing.writeHead(up.statusCode, rh);
              up.pipe(outgoing);
              resolve({ limited: false, piped: true });
            }
          });
        } else {
          let up = await req(targetUrl, { method: incoming.method, headers: fwdH, body: body || undefined });
          let msg = typeof up.body === 'string' ? up.body : (up.body?.message || up.body?.error?.message || '');
          if (up.status === 400 && msg.includes('daily token limit')) return { limited: true, status: 400 };
          return { limited: false, response: up };
        }
      }

      try {
        let result = await tryRequest(activeKey);

        // auto-rotate on limit hit
        if (result.limited && rotate && pool.length > 1) {
          let next = rotateToNext(pool, activeKey);
          if (next) {
            rotations++;
            console.log(`${c.yellow}${S.bolt} [#${reqCount}] KEY LIMITED! Rotating: ${maskKey(activeKey)} ${S.arr} ${maskKey(next.key)} (${next.name})${c.reset}`);
            activeKey = next.key;
            result = await tryRequest(activeKey);
          }
        }

        if (result.limited) {
          console.log(`${c.red}[#${reqCount}] ALL KEYS LIMITED${c.reset}`);
          outgoing.writeHead(400, { 'content-type':'application/json','access-control-allow-origin':'*' });
          outgoing.end(JSON.stringify({ error: "All keys in pool hit daily limit. Add more profiles: bon multi" }));
          return;
        }

        if (result.piped) return;

        if (result.chunks) {
          outgoing.writeHead(result.status, { ...result.headers, 'access-control-allow-origin':'*' });
          for (let ch of result.chunks) outgoing.write(ch);
          outgoing.end();
          return;
        }

        if (result.response) {
          let up = result.response;
          let rb = typeof up.body === 'string' ? up.body : JSON.stringify(up.body);
          if (up.body?.usage) {
            let u = up.body.usage, ti = u.input_tokens||u.prompt_tokens||0, to2 = u.output_tokens||u.completion_tokens||0;
            totalIn += ti; totalOut += to2;
            console.log(`${c.yellow}[#${reqCount}] tokens: ${ti}${S.arr}${to2} (session: ${totalIn}${S.arr}${totalOut})${c.reset}`);
          }
          if (up.body?.model) console.log(`${c.cyan}[#${reqCount}] model: ${up.body.model}${c.reset}`);
          outgoing.writeHead(up.status, { 'content-type': up.headers['content-type']||'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*' });
          outgoing.end(rb);
        }
      } catch (e) {
        console.error(`${c.red}[#${reqCount}] ${e.message}${c.reset}`);
        outgoing.writeHead(502); outgoing.end(JSON.stringify({error:e.message}));
      }
    });
  });

  server.listen(port, () => {
    let lines = [
      `${c.green}${S.chk} Proxy running on port ${c.bold}${port}${c.reset}`,
      ``,
    ];
    if (rotate) {
      lines.push(`${c.bold}${c.yellow}${S.bolt} AUTO-ROTATE ENABLED${c.reset}`);
      lines.push(`${c.dim}Keys in pool: ${c.cyan}${pool.length}${c.reset}`);
      pool.forEach((k, i) => {
        let s = loadPoolState();
        let today = new Date().toISOString().substring(0, 10);
        let lim = s.limited[k.key] === today;
        let active = k.key === activeKey;
        lines.push(`  ${active ? c.green+S.arr : ' '} ${c.cyan}${k.name.padEnd(12)}${c.reset} ${maskKey(k.key)} ${lim ? c.red+'LIMITED'+c.reset : c.green+'FRESH'+c.reset}`);
      });
      lines.push(``);
    }
    lines.push(`${c.bold}Claude Code:${c.reset}`);
    lines.push(`  ${isWin?'set':'export'} ANTHROPIC_BASE_URL=http://localhost:${port}`);
    lines.push(`  ${isWin?'set':'export'} ANTHROPIC_AUTH_TOKEN=anything`);
    lines.push(``);
    lines.push(`${c.bold}OpenAI tools:${c.reset}`);
    lines.push(`  ${isWin?'set':'export'} OPENAI_BASE_URL=http://localhost:${port}/v1`);
    lines.push(`  ${isWin?'set':'export'} OPENAI_API_KEY=anything`);
    lines.push(``);
    lines.push(`${c.dim}Streaming ${S.chk} | Token tracking ${S.chk} | CORS ${S.chk}${rotate ? ` | Rotate ${S.chk}` : ''}${c.reset}`);
    lines.push(`${c.dim}Forwarding to ${getRouter()}${c.reset}`);
    box(lines, { title: `${S.globe} PROXY${rotate ? ' + ROTATE' : ''}`, color: rotate ? c.yellow : c.green });
  });
}

// -- commands --

async function cmdLogin() {
  banner();
  box([`${c.bold}Login${c.reset} ${c.dim}via WorkOS Device Code Flow${c.reset}`], { title: `${S.lock} AUTH`, color: c.cyan });
  log('');

  let sp = spinner('starting device auth...');
  let device = await deviceAuth();
  sp.stop();

  if (!device.verification_uri_complete) { fail("failed to start device auth"); console.log(device); return; }

  box([
    `Open this URL in your browser:`,
    ``,
    `  ${c.cyan}${c.bold}${c.under}${device.verification_uri_complete}${c.reset}`,
    ``,
    `  Code: ${c.yellow}${c.bold}${device.user_code}${c.reset}`,
  ], { title: 'VERIFY', color: c.yellow, width: 58 });

  try {
    let cmd = isWin ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    execSync(`${cmd} "${device.verification_uri_complete}"`, { stdio: 'ignore' });
  } catch {}

  log('');
  let sp2 = spinner('waiting for browser auth...');
  let interval = device.interval || 5;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, interval * 1000));
    try {
      let result = await pollAuth(device.device_code);
      if (result.access_token) {
        result.saved_at = Date.now();
        saveJson(cfg.tokenFile, result);
        sp2.stop(`  ${c.green}${S.chk}${c.reset} ${c.bold}logged in!${c.reset}`);
        let user = await getUser();
        if (user?.email) info(`${user.email}`);
        return;
      }
      if (result.error === 'expired_token') { sp2.stop(); fail("auth timed out"); return; }
    } catch {}
  }
  sp2.stop(); fail("timed out");
}

async function cmdLogout() {
  try { fs.unlinkSync(path.join(cfg.configDir, cfg.tokenFile)); } catch {}
  try { fs.unlinkSync(path.join(cfg.configDir, cfg.keyFile)); } catch {}
  success("logged out");
}

async function cmdStart() {
  banner();
  let token = await ensureToken();
  if (!token) { fail("not logged in"); info(`run: ${c.cyan}bon login${c.reset}`); return; }

  let key = getStoredKey();
  if (!key) {
    info("no api key found, creating one...");
    let result = await createApiKey(`bon-${Date.now()}`);
    if (result?.key) { saveJson(cfg.keyFile, { key: result.key, name: 'auto', created: new Date().toISOString() }); key = result.key; success("key created"); }
    else { fail("failed to create key"); return; }
  }

  let { choice, index } = await pick("Choose your weapon:", [
    `${S.rocket} Claude Code ${c.dim}(@bonsai-ai/claude-code)${c.reset}`,
    `${S.bolt} Codex ${c.dim}(@bonsai-ai/codex)${c.reset}`,
    `${S.shield} Custom command ${c.dim}(inject bonsai env)${c.reset}`,
    `${S.key} Show env vars ${c.dim}(manual setup)${c.reset}`,
  ]);

  let extra = process.argv.slice(3);

  log('');
  if (index === 0) {
    launchClaude(key, extra);
  } else if (index === 1) {
    info("routing through api.js proxy (translates /responses for codex)");
    log('');
    launchCodex(key, extra);
  } else if (index === 2) {
    let cmd = await ask("Command to run: ");
    if (cmd) launchGeneric(key, cmd);
  } else {
    let envName = isWin ? 'set' : 'export';
    box([
      `${c.bold}CMD / Bash:${c.reset}`,
      `  ${envName} ANTHROPIC_BASE_URL=${cfg.router}`,
      `  ${envName} ANTHROPIC_AUTH_TOKEN=${key}`,
      ``,
      isWin ? `${c.bold}PowerShell:${c.reset}` : null,
      isWin ? `  $env:ANTHROPIC_BASE_URL="${cfg.router}"` : null,
      isWin ? `  $env:ANTHROPIC_AUTH_TOKEN="${key}"` : null,
      isWin ? `` : null,
      `${c.bold}OpenAI tools:${c.reset}`,
      `  ${envName} OPENAI_BASE_URL=${cfg.router}/v1`,
      `  ${envName} OPENAI_API_KEY=${key}`,
    ].filter(Boolean), { title: `${S.key} ENV VARS`, color: c.green, width: 58 });
  }
}

async function cmdKeys() {
  let token = await ensureToken();
  if (!token) { fail("not logged in"); return; }

  let { index } = await pick("API Key Management:", [
    `${S.eye} List keys`,
    `${c.green}+${c.reset} Create key`,
    `${c.red}x${c.reset} Delete key`,
    `${S.unlock} Reveal stored key`,
    `${S.key} Import existing key`,
  ]);

  if (index === 0) {
    let sp = spinner('fetching keys...');
    let keys = await listApiKeys();
    sp.stop();
    if (keys?.keys?.length) {
      let lines = keys.keys.map(k => `  ${c.cyan}${(k.name||'unnamed').padEnd(20)}${c.reset} ${c.dim}${k.key_preview||k.id}${c.reset} ${c.gray}${k.created_at ? relTime(k.created_at) : ''}${c.reset}`);
      box([`${c.bold}${keys.keys.length} API Keys${c.reset}`, '', ...lines], { title: `${S.key} KEYS`, color: c.cyan, width: 62 });
    } else { info("no keys found"); }
  }

  if (index === 1) {
    let name = await ask("Key name: ") || `bon-${Date.now()}`;
    let sp = spinner('creating...');
    let result = await createApiKey(name);
    sp.stop();
    if (result?.key) {
      saveJson(cfg.keyFile, { key: result.key, name, created: new Date().toISOString() });
      box([`${c.green}${c.bold}${result.key}${c.reset}`,``,`${c.yellow}${S.warn} Save this key! You won't see it again.${c.reset}`], { title: 'NEW KEY', color: c.green, width: 62 });
    } else { fail("failed to create key"); console.log(result); }
  }

  if (index === 2) {
    let keys = await listApiKeys();
    if (!keys?.keys?.length) { info("no keys"); return; }
    let names = keys.keys.map(k => `${k.name || 'unnamed'} (${k.key_preview || k.id})`);
    let { index: di } = await pick("Delete which key?", names);
    await deleteApiKey(keys.keys[di].id);
    success("deleted");
  }

  if (index === 3) {
    let k = loadJson(cfg.keyFile);
    if (k?.key) {
      box([
        `${c.bold}Key:${c.reset} ${c.green}${k.key}${c.reset}`,
        `${c.dim}Name: ${k.name || 'unknown'}${c.reset}`,
        ``,
        `${c.bold}Base URLs:${c.reset}`,
        `  Anthropic: ${c.cyan}${cfg.router}${c.reset}`,
        `  OpenAI:    ${c.cyan}${cfg.router}/v1${c.reset}`,
      ], { title: `${S.unlock} STORED KEY`, color: c.green, width: 62 });
    } else { fail("no stored key"); }
  }

  if (index === 4) {
    let key = await ask("Paste API key: ");
    if (key) {
      let name = await ask("Name (optional): ") || 'imported';
      saveJson(cfg.keyFile, { key, name, created: new Date().toISOString() });
      success(`stored as '${name}'`);
    }
  }
}

async function cmdTest() {
  banner();
  let key = getStoredKey();
  if (!key) { key = await ask("API key: "); if (!key) return; }
  info(`key: ${maskKey(key)}`);

  let tests = [
    { name: 'Models', url: `${cfg.router}/v1/models`, method: 'GET', headers: { 'Authorization': `Bearer ${key}` } },
    { name: 'Anthropic /v1/messages', url: `${cfg.router}/v1/messages`, method: 'POST', headers: { 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01' }, body: JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:50,messages:[{role:'user',content:'Say "hello"'}]}) },
    { name: 'OpenAI /v1/chat/completions', url: `${cfg.router}/v1/chat/completions`, method: 'POST', headers: { 'Content-Type':'application/json','Authorization':`Bearer ${key}` }, body: JSON.stringify({model:'gpt-4',max_tokens:50,messages:[{role:'user',content:'Say "hello"'}]}) },
    { name: 'Responses /v1/responses', url: `${cfg.router}/v1/responses`, method: 'POST', headers: { 'Content-Type':'application/json','Authorization':`Bearer ${key}` }, body: JSON.stringify({model:'gpt-4',input:'Say "hello"'}) },
    { name: 'Health', url: `${cfg.router}/health`, method: 'GET', headers: {} },
  ];

  log('');
  for (let t of tests) {
    let sp = spinner(t.name);
    try {
      let r = await req(t.url, { method: t.method, headers: t.headers, body: t.body, timeout: 15000 });
      let badge = r.status < 300 ? statusBadge(true, r.status) : r.status === 400 ? statusBadge(false, r.status) : `${c.gray}${r.status}${c.reset}`;
      let extra = '';
      if (r.body?.data) extra = ` ${c.dim}models: ${r.body.data.map(m=>m.id).join(', ')}${c.reset}`;
      if (r.body?.content) extra = ` ${c.green}${r.body.content[0]?.text || ''}${c.reset}`;
      if (r.body?.choices) extra = ` ${c.green}${r.body.choices[0]?.message?.content || ''}${c.reset}`;
      if (r.body?.message) extra = ` ${c.yellow}${r.body.message.substring(0, 60)}${c.reset}`;
      sp.stop(`  ${badge} ${c.bold}${t.name}${c.reset}${extra}`);
    } catch (e) {
      sp.stop(`  ${statusBadge(false, 'ERR')} ${c.bold}${t.name}${c.reset} ${c.red}${e.message}${c.reset}`);
    }
  }
  log('');
}

async function cmdInfo() {
  banner();
  let token = await ensureToken();
  if (!token) { fail("not logged in"); return; }

  let user = await getUser();
  let key = getStoredKey();
  let auth = loadJson(cfg.tokenFile);
  let consent = await getConsentStatus();

  let userLines = user ? [
    `${c.dim}email${c.reset}     ${c.white}${user.email || '?'}${c.reset}`,
    `${c.dim}name${c.reset}      ${c.white}${user.first_name || ''} ${user.last_name || ''}${c.reset}`,
    `${c.dim}id${c.reset}        ${c.dim}${user.id || '?'}${c.reset}`,
  ] : [`${c.dim}could not fetch user info${c.reset}`];

  box([
    ...userLines,
    ``,
    `${c.dim}key${c.reset}       ${key ? maskKey(key) : `${c.red}none${c.reset}`}`,
    `${c.dim}token${c.reset}     ${auth?.saved_at ? relTime(auth.saved_at) : 'unknown'}`,
    `${c.dim}consent${c.reset}   ${consent?.needs_review ? `${c.yellow}needs review${c.reset}` : `${c.green}ok${c.reset}`}`,
    ``,
    `${c.dim}router${c.reset}    ${c.cyan}${cfg.router}${c.reset}`,
    `${c.dim}backend${c.reset}   ${c.cyan}${cfg.backend}${c.reset}`,
    `${c.dim}config${c.reset}    ${c.dim}${cfg.configDir}${c.reset}`,
  ], { title: `${S.tree} INFO`, color: c.green, width: 58 });
}

async function cmdActivity() {
  let token = await ensureToken();
  if (!token) { fail("not logged in"); return; }

  let page = parseInt(process.argv[3]) || 1;
  let sp = spinner('fetching activity...');
  let data = await getActivity(page);
  sp.stop();

  if (!data?.items?.length) { info("no activity found"); return; }

  let totalIn = 0, totalOut = 0, totalCache = 0;
  let lines = data.items.map(a => {
    let inp = a.input_tokens||0, cache = a.cache_read_tokens||0, out = a.output_tokens||0;
    totalIn += inp; totalOut += out; totalCache += cache;
    let model = a.model_display_name || 'stealth';
    let time = new Date(a.timestamp).toLocaleTimeString();
    return `${c.dim}${time}${c.reset}  ${c.cyan}${model.padEnd(10)}${c.reset}  ${c.yellow}${fmtNum(inp).padStart(8)}${c.reset} in  ${c.green}${S.arr}${c.reset}  ${c.yellow}${fmtNum(out).padStart(6)}${c.reset} out`;
  });

  box([
    ...lines,
    ``,
    `${c.bold}Total:${c.reset} ${fmtNum(totalIn)} in (${fmtNum(totalCache)} cached) ${S.arr} ${fmtNum(totalOut)} out`,
  ], { title: `${S.chart} ACTIVITY (page ${page})`, color: c.cyan, width: 70 });

  if (data.total_pages && page < data.total_pages) info(`next: ${c.cyan}bon activity ${page + 1}${c.reset}`);
}

async function cmdLimits() {
  let token = await ensureToken();
  if (!token) { fail("not logged in"); return; }

  let sp = spinner('calculating today\'s usage...');
  let today = new Date().toISOString().substring(0, 10);
  let todayIn = 0, todayOut = 0, todayCache = 0, todayReqs = 0, page = 1, done = false;
  while (!done && page <= 100) {
    let data = await getActivity(page, 100);
    if (!data?.items?.length) break;
    for (let item of data.items) {
      if (item.timestamp?.substring(0, 10) === today) {
        todayIn += item.input_tokens||0; todayOut += item.output_tokens||0; todayCache += item.cache_read_tokens||0; todayReqs++;
      } else if (item.timestamp?.substring(0, 10) < today) { done = true; break; }
    }
    if (!done && data.total_pages && page < data.total_pages) page++; else break;
  }
  sp.stop();

  let now = new Date();
  let reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  let hrsLeft = Math.floor((reset - now) / 3600000);
  let minsLeft = Math.floor(((reset - now) % 3600000) / 60000);

  box([
    `${c.bold}Today${c.reset} ${c.dim}(${today})${c.reset}`,
    ``,
    `  Requests     ${c.cyan}${c.bold}${todayReqs}${c.reset}`,
    `  Input        ${c.yellow}${fmtNum(todayIn)}${c.reset} tokens`,
    `  Output       ${c.yellow}${fmtNum(todayOut)}${c.reset} tokens`,
    `  Cached       ${c.green}${fmtNum(todayCache)}${c.reset} tokens`,
    ``,
    `  Resets in    ${c.cyan}${c.bold}${hrsLeft}h ${minsLeft}m${c.reset} ${c.dim}(00:00 UTC)${c.reset}`,
    ``,
    todayIn > 5000000 ? `  ${c.red}${S.warn} Over 5M input tokens - limit likely reached${c.reset}` :
    todayIn > 1000000 ? `  ${c.yellow}${S.warn} Over 1M input tokens - approaching limit${c.reset}` :
    `  ${c.green}${S.chk} Usage looks healthy${c.reset}`,
  ], { title: `${S.chart} DAILY LIMITS`, color: c.yellow, width: 55 });
}

async function cmdStats() {
  let token = await ensureToken();
  if (!token) { fail("not logged in"); return; }

  let sp = spinner('fetching all activity...');
  let all = [], page = 1;
  while (page <= 50) {
    let data = await getActivity(page, 100);
    if (!data?.items?.length) break;
    all.push(...data.items);
    if (!data.total_pages || page >= data.total_pages) break;
    page++;
  }
  sp.stop();

  if (!all.length) { info("no data"); return; }

  let totalIn = 0, totalOut = 0, totalCache = 0, models = {}, days = {};
  all.forEach(a => {
    totalIn += a.input_tokens||0; totalOut += a.output_tokens||0; totalCache += a.cache_read_tokens||0;
    let m = a.model_display_name||'stealth'; models[m] = (models[m]||0)+1;
    let d = a.timestamp?.substring(0,10); if (d) { if (!days[d]) days[d]={r:0,i:0,o:0}; days[d].r++; days[d].i+=a.input_tokens||0; days[d].o+=a.output_tokens||0; }
  });

  let cost = ((totalIn/1e6)*3) + ((totalOut/1e6)*15);

  let modelLines = Object.entries(models).sort((a,b)=>b[1]-a[1]).map(([m,ct]) => {
    let pct = Math.round(ct/all.length*100);
    let bar = `${c.green}${S.bar.full.repeat(Math.max(1,Math.round(pct/4)))}${c.reset}`;
    return `  ${c.cyan}${m.padEnd(12)}${c.reset} ${String(ct).padStart(5)} ${c.dim}(${pct}%)${c.reset} ${bar}`;
  });

  let dayKeys = Object.keys(days).sort().slice(-10);
  let maxR = Math.max(...dayKeys.map(d => days[d].r));
  let dayLines = dayKeys.map(d => {
    let bar = `${c.green}${S.bar.full.repeat(Math.max(1, Math.round(days[d].r/maxR*20)))}${c.reset}`;
    return `  ${c.dim}${d}${c.reset} ${bar} ${days[d].r} reqs`;
  });

  box([
    `${c.dim}Total requests${c.reset}  ${c.cyan}${c.bold}${all.length}${c.reset}`,
    `${c.dim}Input tokens${c.reset}    ${c.yellow}${fmtNum(totalIn)}${c.reset}`,
    `${c.dim}Output tokens${c.reset}   ${c.yellow}${fmtNum(totalOut)}${c.reset}`,
    `${c.dim}Cache hit${c.reset}       ${c.green}${totalIn?Math.round(totalCache/totalIn*100):0}%${c.reset}`,
    `${c.dim}Estimated cost${c.reset}  ${c.green}$${cost.toFixed(2)}${c.reset} ${c.dim}(if paid direct)${c.reset}`,
    `${c.dim}You saved${c.reset}       ${c.green}${c.bold}$${cost.toFixed(2)}${c.reset}`,
    ``,
    `${c.bold}Models:${c.reset}`,
    ...modelLines,
    ``,
    `${c.bold}Daily Activity:${c.reset}`,
    ...dayLines,
  ], { title: `${S.chart} STATS`, color: c.magenta, width: 58 });
}

async function cmdHealth() {
  let checks = [
    { name: 'Router', url: `${cfg.router}/health` },
    { name: 'Models', url: `${cfg.router}/v1/models` },
    { name: 'Backend', url: `${cfg.backend}/consent/status`, headers: { 'Authorization': `Bearer ${getToken() || 'x'}` } },
    { name: 'WorkOS', url: `${cfg.workos.apiUrl}/health` },
  ];
  log('');
  for (let ch of checks) {
    let sp = spinner(ch.name);
    let start = Date.now();
    try {
      let r = await req(ch.url, { headers: ch.headers || {}, timeout: 10000 });
      let ms = Date.now() - start;
      let ok2 = r.status < 400;
      sp.stop(`  ${ok2 ? statusBadge(true,'UP') : statusBadge(false,r.status)} ${ch.name.padEnd(12)} ${c.dim}${ms}ms${c.reset}`);
    } catch (e) {
      sp.stop(`  ${statusBadge(false,'DOWN')} ${ch.name.padEnd(12)} ${c.red}${e.message}${c.reset}`);
    }
  }
  log('');
}

async function cmdUpdate() {
  banner();
  log('');
  let sp = spinner('checking for updates...');
  let [self, pkgs] = await Promise.all([checkSelfUpdate(true), checkBonsaiUpdates()]);
  sp.stop();

  let lines = [];
  lines.push(`${c.bold}bonsai.js${c.reset}          ${self.available ? `${c.red}v${VERSION}${c.reset} ${S.arr} ${c.green}v${self.latest}${c.reset} ${c.yellow}UPDATE!${c.reset}` : `${c.green}v${VERSION}${c.reset} ${c.dim}(latest)${c.reset}`}`);
  lines.push(`${c.bold}@bonsai-ai/cli${c.reset}     ${pkgs.cli?.changed ? `${c.yellow}${pkgs.cli.version}${c.reset} (was ${cfg.knownVersions.cli})` : `${c.green}${pkgs.cli?.version||'?'}${c.reset}`}`);
  lines.push(`${c.bold}@bonsai-ai/codex${c.reset}   ${pkgs.codex?.changed ? `${c.yellow}${pkgs.codex.version}${c.reset}` : `${c.green}${pkgs.codex?.version||'?'}${c.reset}`}`);
  lines.push(`${c.bold}@bonsai-ai/cc${c.reset}      ${pkgs.claudeCode?.changed ? `${c.yellow}${pkgs.claudeCode.version}${c.reset}` : `${c.green}${pkgs.claudeCode?.version||'?'}${c.reset}`}`);

  box(lines, { title: `${S.bolt} UPDATES`, color: self.available ? c.yellow : c.green, width: 58 });

  if (self.available) {
    log('');
    let platform = detectPlatform();
    info(`platform: ${c.cyan}${c.bold}${platform}${c.reset}`);
    log('');
    let yes = await askYN(`${c.bold}Update to v${self.latest} now?${c.reset}`);
    if (yes) {
      await performSelfUpdate();
    } else {
      info('skipped. download manually:');
      info(`  ${c.cyan}${c.under}https://github.com/${REPO}${c.reset}`);
    }
  }
}

async function cmdSteal() {
  banner();
  let paths = [];
  if (isWin) { let ad = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'); paths.push(path.join(ad, 'bonsai-cli-nodejs', 'Config', 'config.json'), path.join(ad, 'bonsai-cli-nodejs', 'config.json')); }
  else if (process.platform === 'darwin') paths.push(path.join(os.homedir(), 'Library', 'Preferences', 'bonsai-cli-nodejs', 'config.json'));
  else paths.push(path.join(os.homedir(), '.config', 'bonsai-cli-nodejs', 'config.json'));

  let found = false;
  for (let p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      let data = decryptBonsaiConfig(p);
      let lines = Object.entries(data).map(([k,v]) => {
        let val = typeof v === 'string' ? (k.includes('oken') || k.includes('ey') ? `${c.green}${v}${c.reset}` : `${c.dim}${v}${c.reset}`) : JSON.stringify(v);
        return `${c.cyan}${k.padEnd(18)}${c.reset} ${val}`;
      });
      box([`${c.green}${S.chk} Decrypted${c.reset} ${c.dim}${p}${c.reset}`, '', ...lines], { title: `${S.unlock} OFFICIAL CLI`, color: c.green, width: 70 });
      if (data.accessToken && !loadJson(cfg.tokenFile)) { saveJson(cfg.tokenFile, { access_token: data.accessToken, refresh_token: data.refreshToken, saved_at: Date.now() }); success("imported auth"); }
      if (data.apiKey && !loadJson(cfg.keyFile)) { saveJson(cfg.keyFile, { key: data.apiKey, name: 'from-official', created: new Date().toISOString() }); success("imported key"); }
      found = true;
    } catch (e) { if (process.env.DEBUG) console.error(e); }
  }
  if (!found) {
    info("no official bonsai CLI config found on this machine");
    info(`you don't have it installed. to use 'bon steal':`);
    info(`  1. ${c.cyan}npm i -g @bonsai-ai/cli${c.reset}`);
    info(`  2. ${c.cyan}bonsai login${c.reset}    (sign into the official CLI)`);
    info(`  3. ${c.cyan}bon steal${c.reset}       (then we decrypt + import)`);
    info(`or just use ${c.cyan}bon login${c.reset} directly to sign in here.`);
  }
}

async function cmdProxy() {
  let key = getStoredKey();
  if (!key) { key = await ask("API key: "); if (!key) return; }
  let rotate = process.argv.includes('--rotate');
  let portArg = process.argv.find(a => /^\d{2,5}$/.test(a));
  startProxy(key, parseInt(portArg) || 8787, rotate);
}

async function cmdPool() {
  let pool = loadPool();
  let state = loadPoolState();
  let today = new Date().toISOString().substring(0, 10);

  if (!pool.length) {
    fail("no keys in pool");
    info(`add profiles: ${c.cyan}bon multi${c.reset} ${S.arr} Save current`);
    return;
  }

  let lines = pool.map((k, i) => {
    let lim = state.limited[k.key] === today;
    let active = i === state.index;
    let status = lim ? `${c.red}${S.cross} LIMITED${c.reset}` : `${c.green}${S.chk} FRESH${c.reset}`;
    let arrow = active ? `${c.green}${S.arr}${c.reset}` : ' ';
    return `${arrow} ${c.cyan}${k.name.padEnd(14)}${c.reset} ${c.dim}${maskKey(k.key)}${c.reset}  ${k.email.padEnd(20)}  ${status}`;
  });

  let fresh = pool.filter(k => state.limited[k.key] !== today).length;
  let limited = pool.length - fresh;

  box([
    ...lines,
    ``,
    `${c.bold}Total:${c.reset} ${pool.length}  ${c.green}Fresh: ${fresh}${c.reset}  ${c.red}Limited: ${limited}${c.reset}`,
    ``,
    `${c.dim}Use ${c.cyan}bon proxy --rotate${c.reset}${c.dim} to auto-rotate on limit${c.reset}`,
    `${c.dim}Use ${c.cyan}bon rotate${c.reset}${c.dim} to launch Claude with auto-switch${c.reset}`,
  ], { title: `${S.bolt} KEY POOL`, color: c.yellow });
}

async function cmdRotate() {
  banner();
  let pool = loadPool();
  if (pool.length < 2) {
    fail(`need 2+ profiles for rotation (have ${pool.length})`);
    info(`save profiles: ${c.cyan}bon multi${c.reset}`);
    return;
  }

  let active = getNextKey(pool);
  if (!active) {
    fail("all keys in pool are limited today");
    let now = new Date();
    let reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    let h = Math.floor((reset - now) / 3600000), m = Math.floor(((reset - now) % 3600000) / 60000);
    info(`resets in ${c.cyan}${h}h ${m}m${c.reset}`);
    return;
  }

  box([
    `${c.bold}${c.yellow}${S.bolt} AUTO-ROTATE MODE${c.reset}`,
    ``,
    `Keys in pool: ${c.cyan}${c.bold}${pool.length}${c.reset}`,
    `Active key:   ${c.green}${active.name}${c.reset} ${c.dim}${maskKey(active.key)}${c.reset}`,
    ``,
    `${c.dim}If this key hits the limit, will auto-switch to next.${c.reset}`,
  ], { title: `${S.bolt} ROTATE`, color: c.yellow });

  log('');
  let extra = process.argv.slice(3);
  let router = getRouter();
  let pkg = '@bonsai-ai/claude-code@latest';
  info(`package: ${c.cyan}${pkg}${c.reset}`);
  info(`router: ${c.cyan}${router}${c.reset}`);
  info(`key: ${c.dim}${maskKey(active.key)}${c.reset} ${c.dim}(${active.name})${c.reset}`);
  if (extra.length) info(`flags: ${c.dim}${extra.join(' ')}${c.reset}`);
  log('');

  function launchWithKey(entry, flags) {
    let env = { ...process.env, ANTHROPIC_BASE_URL: router, ANTHROPIC_AUTH_TOKEN: entry.key };
    let cmd = ['npx', '--yes', pkg, ...flags].join(' ');
    let child = spawn(cmd, [], { stdio: ['inherit', 'inherit', 'pipe'], env, shell: true, windowsHide: false });
    let stderrBuf = '';
    child.stderr.on('data', d => {
      let text = d.toString();
      stderrBuf += text;
      process.stderr.write(d);
      if (text.includes('daily token limit') || stderrBuf.includes('daily token limit')) {
        child.kill();
        markKeyLimited(entry.key);
        let next = getNextKey(pool);
        if (next) {
          log('');
          warn(`${c.yellow}${S.bolt} Key ${maskKey(entry.key)} hit limit!${c.reset}`);
          success(`switching to ${c.cyan}${next.name}${c.reset} ${c.dim}${maskKey(next.key)}${c.reset}`);
          log('');
          launchWithKey(next, flags);
        } else {
          fail("all keys in pool exhausted");
          process.exit(1);
        }
      }
    });
    child.on('exit', (code, signal) => { if (!signal) process.exit(code || 0); });
  }

  launchWithKey(active, extra);
}

async function cmdMulti() {
  let dir = path.join(cfg.configDir, 'profiles');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let profiles = []; try { profiles = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch {}
  let { index } = await pick("Multi-Account:", ['List profiles', 'Save current', 'Switch profile', 'Delete profile']);
  if (index === 0) {
    if (!profiles.length) { info("no profiles"); return; }
    let lines = profiles.map(p => { let d = loadJson(`profiles/${p}`); return `  ${c.cyan}${p.replace('.json','')}${c.reset}  ${d?.email||'?'}`; });
    box(lines, { title: 'PROFILES', color: c.cyan });
  }
  if (index === 1) { let name = await ask("Profile name: "); if (!name) return; let auth = loadJson(cfg.tokenFile); let k = loadJson(cfg.keyFile); let u = await getUser(); saveJson(`profiles/${name}.json`, { email: u?.email, auth, apiKey: k?.key }); success(`saved '${name}'`); }
  if (index === 2) { if (!profiles.length) return; let { index: pi } = await pick("Switch to:", profiles.map(p=>p.replace('.json',''))); let d = loadJson(`profiles/${profiles[pi]}`); if (d?.auth) saveJson(cfg.tokenFile, d.auth); if (d?.apiKey) saveJson(cfg.keyFile, { key: d.apiKey, name: profiles[pi].replace('.json','') }); success(`switched`); }
  if (index === 3) { if (!profiles.length) return; let { index: di } = await pick("Delete:", profiles.map(p=>p.replace('.json',''))); fs.unlinkSync(path.join(dir, profiles[di])); success("deleted"); }
}

async function cmdTroubleshoot() {
  banner();
  box([
    `${c.bold}${c.yellow}Common Issues & Fixes${c.reset}`,
    ``,
    `${c.red}${S.cross} "CLI version outdated"${c.reset}`,
    `  ${c.dim}The router checks cc_version from Claude Code's billing header.${c.reset}`,
    `  ${c.green}${S.chk} Fix: bon uses @bonsai-ai/claude-code (their fork), not upstream.${c.reset}`,
    `  ${c.green}${S.chk} If persists, run: ${c.cyan}bon update${c.reset}`,
    ``,
    `${c.red}${S.cross} "exceeded daily token limit"${c.reset}`,
    `  ${c.dim}Bonsai has a daily token cap per account. Resets at 00:00 UTC.${c.reset}`,
    `  ${c.green}${S.chk} Check: ${c.cyan}bon limits${c.reset}`,
    `  ${c.green}${S.chk} Use another account: ${c.cyan}bon multi${c.reset}`,
    ``,
    `${c.red}${S.cross} "404 Not Found" on /v1/chat/completions or /v1/responses${c.reset}`,
    `  ${c.dim}Bonsai router only supports /v1/messages (Anthropic format).${c.reset}`,
    `  ${c.dim}OpenAI endpoints are NOT available. Codex may not work.${c.reset}`,
    `  ${c.green}${S.chk} Use Claude Code instead of Codex${c.reset}`,
    ``,
    `${c.red}${S.cross} "Invalid Bonsai API key"${c.reset}`,
    `  ${c.green}${S.chk} Create a new key: ${c.cyan}bon keys${c.reset}`,
    `  ${c.green}${S.chk} Or steal from official CLI: ${c.cyan}bon steal${c.reset}`,
    ``,
    `${c.red}${S.cross} "Bad Request" when testing API directly${c.reset}`,
    `  ${c.dim}The router only accepts requests from the Claude Code SDK.${c.reset}`,
    `  ${c.dim}Direct curl/fetch won't work - must go through Claude Code.${c.reset}`,
    `  ${c.green}${S.chk} Use: ${c.cyan}bon start${c.reset} to launch properly`,
    ``,
    `${c.red}${S.cross} Environment variables not working${c.reset}`,
    `  ${c.dim}Make sure you set BOTH:${c.reset}`,
    `  ${c.cyan}ANTHROPIC_BASE_URL${c.reset} = ${cfg.router}`,
    `  ${c.cyan}ANTHROPIC_AUTH_TOKEN${c.reset} = your-api-key`,
    `  ${c.green}${S.chk} Easiest: just use ${c.cyan}bon start${c.reset} (auto-sets everything)`,
  ], { title: `${S.shield} TROUBLESHOOT`, color: c.yellow, width: 68 });
}

async function cmdSnoop() {
  box([
    `${c.bold}What Bonsai Collects (0.4.13):${c.reset}`,
    `  ${c.red}1.${c.reset} Every prompt you send`,
    `  ${c.red}2.${c.reset} Every AI response (full transcript)`,
    `  ${c.red}3.${c.reset} Sub-agent transcripts ${c.dim}(new in 0.4.13)${c.reset}`,
    `  ${c.red}4.${c.reset} Working directory tarball (.tar.gz)`,
    `  ${c.red}5.${c.reset} Full git bundle (all branches)`,
    `  ${c.red}6.${c.reset} Git diffs per session`,
    `  ${c.red}7.${c.reset} Remote URL, branch, base commit`,
    `  ${c.red}8.${c.reset} Session metadata & Statsig telemetry`,
    ``,
    `${c.bold}Hook Events:${c.reset}`,
    `  ${c.dim}SessionStart, UserPromptSubmit, Stop,${c.reset}`,
    `  ${c.dim}StopFailure, PostToolUseFailure${c.reset}`,
    ``,
    `${c.bold}What bon.js Blocks:${c.reset}`,
    `  ${c.green}${S.chk}${c.reset} No snapshot hooks (no --settings)`,
    `  ${c.green}${S.chk}${c.reset} No working directory uploads`,
    `  ${c.green}${S.chk}${c.reset} No git bundle/diff exfiltration`,
    `  ${c.green}${S.chk}${c.reset} No sub-agent transcript capture`,
    `  ${c.green}${S.chk}${c.reset} No Statsig/Segment tracking`,
    ``,
    `${c.orange}${S.warn} They still see prompts via the proxy router.${c.reset}`,
    `${c.dim}Trade: free models for your coding data.${c.reset}`,
  ], { title: `${S.eye} DATA COLLECTION`, color: c.red, width: 55 });
}

async function cmdStatsig() {
  banner();
  let sp = spinner('exploiting statsig...');
  try {
    let r = await req('https://statsigapi.net/v1/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'statsig-api-key': cfg.statsig.cli },
      body: JSON.stringify({ user: { userID: `probe-${Date.now()}` }, statsigMetadata: { sdkType: 'js-client', sdkVersion: '5.0.0' } }),
      timeout: 15000,
    });
    sp.stop();
    if (r.status !== 200) { fail(`statsig returned ${r.status}`); return; }

    let d = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
    let configs = d.dynamic_configs || {};
    let params = d.param_stores || {};

    // extract the good stuff
    let limits = null, models = [], routing = null, routeMode = null, fixedModel = null;
    let snapEnabled = null, snapLimit = null;

    for (let [k,v] of Object.entries(configs)) {
      let val = v.value;
      if (!val) continue;
      if (val.total_tokens_daily_limit_in_thousand) limits = val;
      if (val.model && typeof val.model === 'string') models.push({ model: val.model, display: val.display_name || '?', provider: '-' });
      if (val.model && typeof val.model === 'object') models.push({ model: val.model.model, display: val.display_name || '?', provider: val.model.provider || '-', reasoning: val.model.reasoning_enabled, effort: val.model.reasoning_effort });
      if (val.models && Array.isArray(val.models)) val.models.forEach(m => models.push({ model: m.model, display: '?', provider: m.provider }));
      // provider routing map
      let s = JSON.stringify(val);
      if (s.includes('fp8') || s.includes('deepinfra')) routing = val;
    }

    for (let store of Object.values(params)) {
      if (!store || typeof store !== 'object') continue;
      for (let [pk,pv] of Object.entries(store)) {
        if (pv?.name === 'routing_mode') routeMode = pv.value;
        if (pv?.name === 'cli_snapshot_enabled' && pv.config_name) {
          let cfg2 = configs[pv.config_name];
          if (cfg2) snapEnabled = cfg2.value?.enabled;
        }
        if (pv?.name === 'cli_snapshot_size_limit' && pv.config_name) {
          let cfg2 = configs[pv.config_name];
          if (cfg2) snapLimit = cfg2.value?.value;
        }
      }
    }

    // display
    if (limits) {
      box([
        `${c.bold}Daily${c.reset}     ${c.yellow}${(limits.total_tokens_daily_limit_in_thousand * 1000).toLocaleString()}${c.reset} tokens ${c.dim}(${limits.total_tokens_daily_limit_in_thousand/1000}M)${c.reset}`,
        `${c.bold}Hourly${c.reset}    ${c.yellow}${(limits.total_tokens_hourly_limit_in_thousand * 1000).toLocaleString()}${c.reset} tokens ${c.dim}(${limits.total_tokens_hourly_limit_in_thousand/1000}M)${c.reset}`,
      ], { title: 'RATE LIMITS', color: c.yellow, width: 55 });
      log('');
    }

    if (models.length) {
      let modelLines = models.map(m => {
        let prov = m.provider !== '-' ? `${c.blue}${m.provider}${c.reset}` : '';
        let reason = m.reasoning ? ` ${c.green}reasoning=${m.effort||'on'}${c.reset}` : '';
        let disp = m.display && m.display !== '?' ? ` ${c.dim}display="${m.display}"${c.reset}` : '';
        return `  ${c.cyan}${(m.model||'?').padEnd(36)}${c.reset} ${prov}${reason}${disp}`;
      });
      box(modelLines, { title: 'MODELS (REAL)', color: c.cyan, width: 62 });
      log('');
    }

    if (routing) {
      let routeLines = Object.entries(routing).map(([model, providers]) =>
        `  ${c.cyan}${model.padEnd(28)}${c.reset} ${c.dim}${S.arr}${c.reset} ${c.sub}${providers.join(', ')}${c.reset}`
      );
      box(routeLines, { title: 'PROVIDER ROUTING', color: c.blue, width: 70 });
      log('');
    }

    box([
      `${c.dim}routing_mode${c.reset}            ${c.bold}${routeMode || '?'}${c.reset}`,
      `${c.dim}snapshot_enabled${c.reset}         ${snapEnabled ? `${c.red}true${c.reset}` : `${c.green}false${c.reset}`}`,
      `${c.dim}snapshot_size_limit${c.reset}      ${snapLimit ? `${c.yellow}${snapLimit} MB${c.reset}` : '?'}`,
      `${c.dim}feature_gates${c.reset}            ${c.sub}${Object.keys(d.feature_gates||{}).length}${c.reset}`,
      `${c.dim}dynamic_configs${c.reset}          ${c.sub}${Object.keys(configs).length}${c.reset}`,
    ], { title: 'CONFIG', color: c.magenta, width: 55 });

  } catch (e) {
    sp.stop();
    fail(`statsig exploit failed: ${e.message}`);
  }
}

async function cmdModels() {
  // updated 2026-04-23: tested 213 models from litellm catalog, 199 worked.
  // grouped highlights below. for full list see MODELS.md in repo.
  let highlights = [
    // claude
    ['claude-opus-4-7',           'Claude Opus 4.7',     'newest',        c.green,   'NEW'],
    ['claude-opus-4-6',           'Claude Opus 4.6',     '1M ctx [1m]',   c.green,   'default'],
    ['claude-opus-4-6-fast',      'Claude Opus 4.6 Fast','quicker',       c.green,   ''],
    ['claude-sonnet-4-5',         'Claude Sonnet 4.5',   'fast',          c.cyan,    ''],
    ['claude-haiku-4-5',          'Claude Haiku 4.5',    'cheapest tier', c.cyan,    'NEW'],
    // openai
    ['gpt-5',                     'GPT-5',               'OpenAI',        c.magenta, ''],
    ['o3',                        'o3',                  'reasoning',     c.magenta, ''],
    ['gpt-oss-120b',              'GPT-OSS 120B',        'open source',   c.magenta, ''],
    // google
    ['gemini-2.5-flash',          'Gemini 2.5 Flash',    'Google',        c.blue,    ''],
    ['gemini-pro-latest',         'Gemini Pro latest',   'Google',        c.blue,    ''],
    ['gemini-3.1-flash-live-preview', 'Gemini 3.1 Flash', 'live preview', c.blue,    'NEW'],
    // chinese / open
    ['z-ai/glm-4.7',              'GLM-4.7',             'Z-AI, 8 prov',  c.magenta, ''],
    ['minimax/MiniMax-M2.1',      'MiniMax M2.1',        '7 providers',   c.gold,    ''],
    ['kimi-k2-thinking-251104',   'Kimi K2 thinking',    'Moonshot',      c.gold,    ''],
    ['deepseek-v3-2-251201',      'DeepSeek V3.2',       'DeepSeek',      c.teal,    ''],
    ['together_ai/Qwen/Qwen3.5-397B-A17B', 'Qwen 3.5 397B', 'Alibaba',    c.teal,    ''],
    ['together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1', 'Mixtral 8x7B', 'Mistral', c.orange, ''],
    ['command-r-plus',            'Command R+',          'Cohere',        c.orange,  ''],
  ];

  log('');
  let lines = highlights.map(([id, name, ctx, col, tag]) => {
    let badge = tag === 'default' ? `${c.green}${S.star}${c.reset}` : tag === 'NEW' ? `${c.gold}${S.bolt}${c.reset}` : `${c.cyan}${S.dia}${c.reset}`;
    let tagStr = tag ? `  ${c.mute}${tag}${c.reset}` : '';
    return `  ${badge} ${col}${c.bold}${id.padEnd(40)}${c.reset} ${c.dim}${name.padEnd(20)}${c.reset} ${c.sub}${ctx}${c.reset}${tagStr}`;
  });
  box(lines, { title: 'TOP MODELS (highlights)', color: c.cyan, width: 86 });

  log('');
  box([
    `${c.sub}provider${c.reset}       ${c.bold}OpenRouter${c.reset} ${c.mute}(go.trybons.ai proxies to openrouter)${c.reset}`,
    `${c.sub}daily limit${c.reset}    ${c.yellow}20M tokens${c.reset} ${c.mute}per account${c.reset}`,
    `${c.sub}hourly limit${c.reset}   ${c.yellow}40M tokens${c.reset}`,
    `${c.sub}display name${c.reset}   ${c.dim}"stealth"${c.reset} ${c.mute}(real model hidden in response)${c.reset}`,
    `${c.sub}default model${c.reset}  ${c.green}claude-opus-4-6${c.reset} ${c.mute}(1M context window)${c.reset}`,
  ], { title: 'ROUTING INFO', color: c.yellow });

  log('');
  log(`  ${c.bold}${c.fg}usage${c.reset}`);
  log(`  ${c.cyan}bon start --model claude-opus-4-7${c.reset}                ${c.mute}cli${c.reset}`);
  log(`  ${c.cyan}{"model":"claude-opus-4-7[1m]","messages":[...]}${c.reset}  ${c.mute}api.js (1M ctx)${c.reset}`);
  log(`  ${c.cyan}c.chat.completions.create(model="gpt-5")${c.reset}        ${c.mute}python${c.reset}`);
  log('');
  log(`  ${c.bold}${c.red}IMPORTANT — model selection is a lie${c.reset}`);
  log(`  ${c.fg}bonsai router ignores the ${c.cyan}model${c.fg} field entirely.${c.reset}`);
  log(`  ${c.fg}every request → ${c.gold}claude-opus-4.7${c.fg} (reasoning high)${c.reset}`);
  log(`  ${c.mute}source: statsig ${c.dim}routing_mode:"fixed"${c.mute} + ${c.dim}fixed_routing_model${c.reset}`);
  log('');
  log(`  ${c.bold}${c.gold}199 of 213 model names accepted by router${c.reset} ${c.mute}(but all serve claude underneath)${c.reset}`);
  log(`  ${c.mute}full names list: ${c.cyan}https://github.com/${REPO}/blob/main/MODELS.md${c.reset}`);
  log('');
}

async function cmdBench() {
  banner();
  let key = getStoredKey();
  if (!key) { fail('no api key. run ' + c.cyan + 'bon keys' + c.reset + ' first.'); return; }

  let prompt = process.argv.find(a => a.startsWith('--prompt='))?.split('=').slice(1).join('=')
    || 'Explain quantum entanglement in exactly 3 sentences.';
  let parallel = process.argv.includes('--parallel');
  let verbose = process.argv.includes('--verbose');

  let models = ['claude-opus-4-6','claude-sonnet-4-6','claude-opus-4-5','claude-sonnet-4-5','claude-sonnet-4-20250514','glm-4.7'];

  log('');
  info(`prompt: ${c.dim}"${prompt}"${c.reset}`);
  info(`models: ${c.cyan}${models.length}${c.reset}  mode: ${parallel ? c.yellow + 'parallel' + c.reset : c.dim + 'sequential' + c.reset}`);
  log('');

  // load system prompt for router validation
  let ccSystem = null;
  try { ccSystem = JSON.parse(fs.readFileSync(path.join(cfg.configDir, 'cc_system.json'), 'utf8')); } catch {}
  if (!ccSystem) { warn('no system prompt cache — bench may fail. run ' + c.cyan + 'bon start' + c.reset + ' once first.'); }
  let benchDeviceId = crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex');
  let benchSessionId = crypto.randomUUID();

  async function benchOne(model) {
    let t0 = Date.now();
    try {
      let reqBody = {
        model, max_tokens: 300, stream: true,
        messages: [{ role: 'user', content: prompt }],
        metadata: { user_id: JSON.stringify({ device_id: benchDeviceId, account_uuid: '', session_id: benchSessionId }) },
      };
      if (ccSystem) reqBody.system = ccSystem;
      // use fetch (router requires HTTP/2) with full SDK fingerprint
      let r = await fetch(`${cfg.router}/v1/messages?beta=true`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'authorization': `Bearer ${key}`,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'anthropic-beta': 'claude-code-20250219,context-1m-2025-08-07,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,effort-2025-11-24',
          'user-agent': 'claude-cli/2.1.112 (external, cli)',
          'x-app': 'cli',
          'x-claude-code-session-id': benchSessionId,
          'x-stainless-lang': 'js',
          'x-stainless-package-version': '0.80.0',
          'x-stainless-os': process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'MacOS' : 'Linux',
          'x-stainless-arch': process.arch,
          'x-stainless-runtime': 'node',
          'x-stainless-runtime-version': process.version,
          'x-stainless-retry-count': '0',
          'accept-language': '*',
          'sec-fetch-mode': 'cors',
        },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(60000),
      });
      if (r.status >= 400) {
        let err = await r.text();
        return { model, ms: Date.now()-t0, text:'', inTok:0, outTok:0, tokPerSec:0, ok:false, status:r.status, error: err.slice(0,80) };
      }
      // collect stream
      let texts = [], usage = {}, rModel = model;
      let buf = '';
      let reader = r.body.getReader();
      let dec = new TextDecoder();
      while (true) {
        let { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let lines = buf.split('\n');
        buf = lines.pop();
        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith('data:')) continue;
          let d = line.slice(5).trim();
          if (d === '[DONE]') continue;
          try {
            let j = JSON.parse(d);
            if (j.type === 'message_start') rModel = j.message?.model || model;
            if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') texts.push(j.delta.text);
            if (j.type === 'message_delta' && j.usage) usage = j.usage;
          } catch {}
        }
      }
      let ms = Date.now() - t0;
      let outTok = usage.output_tokens || texts.join('').length / 4;
      let tokPerSec = outTok / (ms / 1000);
      return { model, ms, text: texts.join(''), inTok: usage.input_tokens||0, outTok: Math.round(outTok), tokPerSec, ok: true, status: 200, error: null, rModel };
    } catch (e) {
      return { model, ms: Date.now()-t0, text:'', inTok:0, outTok:0, tokPerSec:0, ok:false, status:0, error: e.message?.slice(0,80) };
    }
  }

  let results;
  if (parallel) {
    let sp = spinner('benchmarking all models in parallel...');
    results = await Promise.all(models.map(m => benchOne(m)));
    sp.stop();
  } else {
    results = [];
    for (let m of models) {
      let sp = spinner(`benchmarking ${m}...`);
      let r = await benchOne(m);
      sp.stop(r.ok
        ? `  ${statusBadge(true,'OK')} ${c.bold}${m}${c.reset} ${c.dim}${(r.ms/1000).toFixed(1)}s  ${Math.round(r.tokPerSec)} tok/s${c.reset}`
        : `  ${statusBadge(false, String(r.status||'ERR'))} ${c.bold}${m}${c.reset} ${c.red}${r.error||'failed'}${c.reset}`);
      results.push(r);
    }
  }

  let sorted = results.filter(r => r.ok).sort((a,b) => a.ms - b.ms);
  let failed = results.filter(r => !r.ok);

  log('');
  let tableLines = sorted.map((r, i) => {
    let rank = i === 0 ? `${c.green}${S.star}${c.reset}` : `${c.dim}${i+1}${c.reset}`;
    let time = `${(r.ms/1000).toFixed(1)}s`;
    let tps = `${Math.round(r.tokPerSec)}`;
    let tok = `${c.dim}${r.inTok}${S.arr}${r.outTok}${c.reset}`;
    let rm = r.rModel && r.rModel !== r.model ? ` ${c.mute}(${S.arr}${r.rModel})${c.reset}` : '';
    return `  ${rank}  ${c.cyan}${r.model.padEnd(28)}${c.reset} ${c.bold}${time.padStart(6)}${c.reset}  ${c.yellow}${tps.padStart(5)} tok/s${c.reset}  ${tok}${rm}`;
  });

  if (failed.length) {
    tableLines.push('');
    for (let r of failed) {
      tableLines.push(`  ${c.red}${S.cross} ${r.model.padEnd(28)}${c.reset} ${c.red}${r.error || `HTTP ${r.status}`}${c.reset}`);
    }
  }

  if (sorted.length) {
    tableLines.push('');
    tableLines.push(`  ${c.bold}${c.green}${S.star} Fastest:${c.reset} ${c.green}${c.bold}${sorted[0].model}${c.reset} ${c.dim}(${(sorted[0].ms/1000).toFixed(1)}s, ${Math.round(sorted[0].tokPerSec)} tok/s)${c.reset}`);
    if (sorted.length > 1) {
      let slowest = sorted[sorted.length - 1];
      tableLines.push(`  ${c.dim}  Slowest: ${slowest.model} (${(slowest.ms/1000).toFixed(1)}s)${c.reset}`);
    }
  }

  box(tableLines, { title: `${S.bolt} BENCHMARK`, color: c.yellow, width: 74 });

  if (verbose && sorted.length) {
    log('');
    for (let r of sorted) {
      box([`${c.fg}${r.text}${c.reset}`], { title: r.model, color: c.cyan, width: 74 });
      log('');
    }
  }

  log('');
  log(`  ${c.mute}flags: --parallel  --verbose  --prompt="your prompt"${c.reset}`);
  log('');
}

async function cmdFingerprint() {
  banner();
  let key = getStoredKey();
  let auth = loadJson(cfg.tokenFile);
  let hostname = os.hostname();
  let username = os.userInfo().username;
  let platform = detectPlatform();

  let deviceRaw = `${hostname}:${username}:${os.homedir()}:${os.platform()}:${os.arch()}`;
  let deviceHash = crypto.createHash('sha256').update(deviceRaw).digest('hex').substring(0, 16);
  let sessionHash = auth?.access_token
    ? crypto.createHash('sha256').update(auth.access_token).digest('hex').substring(0, 12)
    : 'none';
  let tokenAge = auth?.saved_at ? relTime(auth.saved_at) : (auth ? 'unknown' : 'no token');

  // external IP
  let externalIp = '?';
  try {
    let r = await req('https://api.ipify.org?format=json', { timeout: 5000 });
    externalIp = r.body?.ip || '?';
  } catch {}

  // local config files
  let configFiles = [];
  try { configFiles = fs.readdirSync(cfg.configDir); } catch {}

  // system prompt hash
  let sysPromptHash = 'not captured';
  try {
    let sp = fs.readFileSync(path.join(cfg.configDir, 'cc_system.json'), 'utf8');
    sysPromptHash = crypto.createHash('sha256').update(sp).digest('hex').substring(0, 16);
  } catch {}

  log('');
  box([
    `${c.bold}${c.fg}Device${c.reset}`,
    `  ${c.dim}fingerprint${c.reset}  ${c.cyan}${c.bold}${deviceHash}${c.reset}`,
    `  ${c.dim}hostname${c.reset}     ${c.fg}${hostname}${c.reset}`,
    `  ${c.dim}user${c.reset}         ${c.fg}${username}${c.reset}`,
    `  ${c.dim}platform${c.reset}     ${c.fg}${platform} ${c.mute}(${os.platform()} ${os.arch()})${c.reset}`,
    `  ${c.dim}node${c.reset}         ${c.fg}${process.version}${c.reset}`,
    ``,
    `${c.bold}${c.fg}Network${c.reset}`,
    `  ${c.dim}external ip${c.reset}  ${c.yellow}${externalIp}${c.reset}`,
    `  ${c.dim}router${c.reset}       ${c.cyan}${cfg.router}${c.reset}`,
    `  ${c.dim}backend${c.reset}      ${c.dim}${cfg.backend}${c.reset}`,
    ``,
    `${c.bold}${c.fg}Session${c.reset}`,
    `  ${c.dim}token age${c.reset}    ${c.fg}${tokenAge}${c.reset}`,
    `  ${c.dim}session${c.reset}      ${c.dim}${sessionHash}${c.reset}`,
    `  ${c.dim}api key${c.reset}      ${key ? c.green + maskKey(key) + c.reset : c.red + 'none' + c.reset}`,
    `  ${c.dim}account${c.reset}      ${c.fg}${auth?.email || '?'}${c.reset}`,
    ``,
    `${c.bold}${c.fg}Router Sees${c.reset}`,
    `  ${c.dim}x-api-key${c.reset}        ${key ? maskKey(key) : 'none'}`,
    `  ${c.dim}anthropic-ver${c.reset}    2023-06-01`,
    `  ${c.dim}user-agent${c.reset}       claude-cli/2.1.112 (external, cli)`,
    `  ${c.dim}anthropic-beta${c.reset}   6 feature flags`,
    `  ${c.dim}x-stainless-*${c.reset}    7 fingerprint headers`,
    `  ${c.dim}system prompt${c.reset}    ${sysPromptHash} ${c.mute}(sha256 prefix)${c.reset}`,
    `  ${c.dim}metadata${c.reset}         device_id: ${deviceHash.substring(0,8)}...`,
    ``,
    `${c.bold}${c.fg}Local Storage${c.reset}  ${c.mute}${cfg.configDir}${c.reset}`,
    ...configFiles.map(f => {
      let fp = path.join(cfg.configDir, f);
      let isDir = false; try { isDir = fs.statSync(fp).isDirectory(); } catch {}
      return `  ${isDir ? c.cyan + S.dia : c.dim + S.tri} ${f}${c.reset}`;
    }),
  ], { title: `${S.eye || S.dia} FINGERPRINT`, color: c.magenta, width: 62 });
  log('');
  log(`  ${c.mute}this is what bonsai's router can see about your machine.${c.reset}`);
  log(`  ${c.mute}your prompts + responses are also visible to the proxy.${c.reset}`);
  log('');
}

async function cmdApi() {
  let portArg = process.argv.find(a => /^\d{2,5}$/.test(a));
  let port = parseInt(portArg) || 4000;
  let apiPath = path.join(path.dirname(process.argv[1] || ''), 'api.js');
  if (!fs.existsSync(apiPath)) {
    fail("api.js not found");
    info(`download it: ${c.cyan}curl -sL ${REPO_RAW}/api.js -o api.js${c.reset}`);
    return;
  }
  let args = ['--', apiPath, String(port)];
  if (process.argv.includes('--key') || process.argv.includes('-k')) {
    let ki = process.argv.indexOf('--key'); if (ki < 0) ki = process.argv.indexOf('-k');
    if (process.argv[ki+1]) args.push('-k', process.argv[ki+1]);
  }
  if (process.argv.includes('--anon')) args.push('--anon');
  let child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: false });
  child.on('exit', code => process.exit(code || 0));
}

async function cmdDump() {
  banner();
  let sections = [
    { t: 'INFRASTRUCTURE', c: c.cyan, l: [`Marketing     ${c.cyan}trybons.ai${c.reset} (Next.js/Vercel)`,`App           ${c.cyan}app.trybons.ai${c.reset} (Vite/React)`,`API           ${c.cyan}api.trybons.ai${c.reset} (FastAPI/Fly.io)`,`Router        ${c.cyan}go.trybons.ai${c.reset}`,`Auth          ${c.cyan}auth.trybons.ai${c.reset} (WorkOS)`,`Staging       ${c.dim}api-staging / app-staging${c.reset}`] },
    { t: 'ENDPOINTS', c: c.green, l: [`${c.green}POST${c.reset} /v1/messages       ${c.green}works${c.reset} (Anthropic)`,`${c.green}POST${c.reset} /v1/chat/completions  ${c.green}works${c.reset} (via api.js proxy)`,`${c.red}POST${c.reset} /v1/responses      ${c.red}404${c.reset}`,`${c.green}GET${c.reset}  /v1/models         ${c.green}works${c.reset}`,`${c.green}GET${c.reset}  /health            ${c.green}works${c.reset}`] },
    { t: 'RATE LIMITS', c: c.yellow, l: [`Daily token cap  ${c.yellow}20M tokens/day${c.reset} (from Statsig)`,`Hourly cap       ${c.yellow}40M tokens/hour${c.reset}`,`Reset            ${c.cyan}00:00 UTC${c.reset}`,`Enforcement      HTTP 400 on exceed`] },
    { t: 'LEAKED KEYS', c: c.red, l: [`Segment    ${c.dim}N2VehZC46evia2S5CiI8EE4m7JY04QVc${c.reset}`,`Statsig    ${c.dim}${cfg.statsig.web}${c.reset}`,`Statsig CLI${c.dim} ${cfg.statsig.cli}${c.reset}`,`WorkOS     ${c.dim}${cfg.workos.clientId}${c.reset}`,`Cloudflare ${c.dim}30139b275891425c8cee99b8155240cd${c.reset}`,`Datadog    ${c.dim}pubb28ba93eb59013963476c6dd6c190040${c.reset}`] },
    { t: 'ENCRYPTION', c: c.magenta, l: [`Cipher  aes-256-cbc`,`Key     scryptSync("bonsai-cli","salt",32)`,`Schema  {accessToken, refreshToken, expiresAt, apiKey}`,`Status  ${c.green}cracked${c.reset} (bon steal)`] },
    { t: 'DATA COLLECTION (0.4.13)', c: c.orange, l: [`Hooks   SessionStart, UserPromptSubmit, Stop, StopFailure, PostToolUseFailure`,`Upload  tarball, transcript, subagent transcripts, git bundle, diff, prompt`,`Snap    ${c.dim}server-controlled size limit via Statsig ParameterStore${c.reset}`,`Dest    POST /snapshots/upload (detached child process)`,`Bypass  ${c.green}bon skips --settings flag${c.reset}`] },
  ];
  for (let s of sections) { box(s.l, { title: s.t, color: s.c, width: 60 }); log(''); }
}


async function cmdCc() {
  // direct claude-code launch, skip the picker. fast path.
  let token = await ensureToken();
  if (!token) { fail("not logged in"); info(`run: ${c.cyan}bon login${c.reset}`); return; }
  let key = getStoredKey();
  if (!key) { fail("no api key"); info(`run: ${c.cyan}bon keys${c.reset}`); return; }
  launchClaude(key, process.argv.slice(3));
}

async function cmdCodex() {
  // direct codex launch, skip the picker. routes via api.js proxy.
  let token = await ensureToken();
  if (!token) { fail("not logged in"); info(`run: ${c.cyan}bon login${c.reset}`); return; }
  let key = getStoredKey();
  if (!key) { fail("no api key"); info(`run: ${c.cyan}bon keys${c.reset}`); return; }
  info("routing through api.js proxy (translates /responses for codex)");
  log('');
  launchCodex(key, process.argv.slice(3));
}


async function cmdAgents() {
  banner();
  let key = getStoredKey();
  let port = parseInt(process.argv.find(a => /^\d{2,5}$/.test(a))) || 4000;
  let base = `http://localhost:${port}`;

  // detect what's installed by probing npm + filesystem hints
  let detected = {};
  // silence stderr at process level (no shell redirect needed → cross-platform)
  // win → cmd.exe under shell:true treats `2>/dev/null` as missing path → noise.
  // node's stdio: ['ignore','ignore','ignore'] discards everything cleanly on every OS.
  function check(cmd) {
    try { execSync(`${cmd} --version`, { stdio: ['ignore', 'ignore', 'ignore'], timeout: 3000 }); return true; }
    catch { return false; }
  }
  // npm ls cache — call it once, parse once, look up many times
  let _npmCache = null;
  function checkNpm(pkg) {
    if (_npmCache === null) {
      try {
        let out = execSync('npm ls -g --depth=0 --json', { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
        _npmCache = JSON.parse(out)?.dependencies || {};
      } catch { _npmCache = {}; }
    }
    return !!_npmCache[pkg];
  }
  function checkVscodeExt(id) {
    let dirs = [
      path.join(os.homedir(), '.vscode', 'extensions'),
      path.join(os.homedir(), '.cursor', 'extensions'),
      path.join(os.homedir(), '.windsurf', 'extensions'),
    ];
    for (let d of dirs) {
      try { if (fs.readdirSync(d).some(f => f.toLowerCase().startsWith(id.toLowerCase()))) return true; } catch {}
    }
    return false;
  }

  let sp = spinner('detecting installed agents...');
  detected['claude-code']     = checkNpm('@anthropic-ai/claude-code') || check('claude');
  detected['bonsai-cc']       = checkNpm('@bonsai-ai/claude-code');
  detected['codex']           = checkNpm('@openai/codex') || check('codex');
  detected['bonsai-codex']    = checkNpm('@bonsai-ai/codex');
  detected['cline']           = checkVscodeExt('saoudrizwan.claude-dev');
  detected['cursor']          = check('cursor') || fs.existsSync(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor'));
  detected['continue']        = checkVscodeExt('continue.continue');
  detected['roo-code']        = checkVscodeExt('rooveterinaryinc.roo-cline');
  detected['aider']           = check('aider');
  detected['opencode']        = checkNpm('@opencode-ai/cli') || check('opencode');
  detected['gh-copilot']      = check('gh') && (() => {
    try {
      let out = execSync('gh extension list', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
      return out.includes('copilot');
    } catch { return false; }
  })();
  sp.stop();

  let envName = isWin ? 'set' : 'export';
  let agents = [
    { id: 'claude-code',  name: 'Claude Code (Anthropic)', d: detected['claude-code'],
      cfg: `${envName} ANTHROPIC_BASE_URL=${base}\n   ${envName} ANTHROPIC_AUTH_TOKEN=anything\n   claude` },
    { id: 'bonsai-cc',    name: 'Claude Code (Bonsai fork)', d: detected['bonsai-cc'],
      cfg: `bon cc      ${c.dim}# already wired${c.reset}` },
    { id: 'codex',        name: 'Codex (OpenAI)', d: detected['codex'],
      cfg: `${envName} OPENAI_BASE_URL=${base}/v1\n   ${envName} OPENAI_API_KEY=anything\n   codex` },
    { id: 'bonsai-codex', name: 'Codex (Bonsai fork)', d: detected['bonsai-codex'],
      cfg: `bon codex   ${c.dim}# already wired${c.reset}` },
    { id: 'cline',        name: 'Cline (VS Code)', d: detected['cline'],
      cfg: `Settings -> Cline -> API Provider: ${c.cyan}OpenAI Compatible${c.reset}\n     Base URL: ${c.cyan}${base}/v1${c.reset}\n     API Key: ${c.cyan}anything${c.reset}\n     Model: ${c.cyan}claude-opus-4-6${c.reset}` },
    { id: 'cursor',       name: 'Cursor', d: detected['cursor'],
      cfg: `Settings -> Models -> Add Custom -> OpenAI-Compatible\n     Base URL: ${c.cyan}${base}/v1${c.reset}   Key: ${c.cyan}anything${c.reset}\n     Add model: ${c.cyan}claude-opus-4-6${c.reset}` },
    { id: 'continue',     name: 'Continue (VS Code)', d: detected['continue'],
      cfg: `Add to ~/.continue/config.json:\n     {"models":[{"title":"bon","provider":"openai","model":"claude-opus-4-6","apiBase":"${base}/v1","apiKey":"anything"}]}` },
    { id: 'roo-code',     name: 'Roo Code (VS Code)', d: detected['roo-code'],
      cfg: `Settings -> API Provider: ${c.cyan}OpenAI Compatible${c.reset}\n     URL: ${c.cyan}${base}/v1${c.reset}   Key: ${c.cyan}anything${c.reset}` },
    { id: 'aider',        name: 'Aider', d: detected['aider'],
      cfg: `${envName} OPENAI_API_BASE=${base}/v1\n   ${envName} OPENAI_API_KEY=anything\n   aider --model openai/claude-opus-4-6` },
    { id: 'opencode',     name: 'OpenCode', d: detected['opencode'],
      cfg: `${envName} OPENAI_BASE_URL=${base}/v1\n   ${envName} OPENAI_API_KEY=anything\n   opencode` },
  ];

  let installed = agents.filter(a => a.d);
  let avail = agents.filter(a => !a.d);

  log('');
  if (installed.length) {
    let lines = [];
    for (let a of installed) {
      lines.push(`${c.green}${S.dot}${c.reset} ${c.bold}${a.name}${c.reset}`);
      for (let cfgLine of a.cfg.split('\n')) lines.push(`   ${cfgLine}`);
      lines.push('');
    }
    box(lines, { title: `${S.bolt} INSTALLED (${installed.length})`, color: c.green, width: 76 });
  } else {
    info('no AI coding agents detected on this machine');
  }

  log('');
  if (avail.length) {
    box(
      avail.map(a => `  ${c.dim}${S.ring}${c.reset} ${c.dim}${a.name}${c.reset}`),
      { title: 'AVAILABLE (not installed)', color: c.mute, width: 76 }
    );
  }

  log('');
  log(`  ${c.mute}before connecting any agent, start the proxy:  ${c.cyan}bon api${c.reset}${c.mute}  (or ${c.cyan}bon api --anon${c.mute})${c.reset}`);
  log(`  ${c.mute}then run the snippet for your tool above. all of them work.${c.reset}`);
  log('');
}

async function cmdDash() {
  // live dashboard polling api.js /stats every 1s. ANSI cursor redraw.
  let port = parseInt(process.argv.find(a => /^\d{2,5}$/.test(a))) || 4000;
  let base = `http://localhost:${port}`;

  // probe once first
  try { await req(`${base}/health`, { timeout: 1500 }); }
  catch { fail(`api.js not reachable on ${base}`); info(`start it: ${c.cyan}bon api${c.reset} ${c.dim}(or ${c.cyan}bon api -p ${port}${c.dim})${c.reset}`); return; }

  let history = []; // last 30 snapshots
  let stop = false;
  process.on('SIGINT', () => { stop = true; process.stdout.write('\x1b[?25h\n'); process.exit(0); });

  process.stdout.write('\x1b[?25l'); // hide cursor
  console.clear();

  function fmtTime(s) { let h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return h>0 ? `${h}h${m}m` : m>0 ? `${m}m${sec}s` : `${sec}s`; }

  function render(s) {
    let out = [];
    let title = '\u25C6  B O N S A I   D A S H';
    out.push('');
    out.push('  ' + gradText(title, c.gr));
    out.push(`  ${c.mute}polling ${base} every 1s · ${c.dim}ctrl+c to quit${c.reset}`);
    out.push('');
    out.push(divider('PROXY', 76));
    out.push(kv('version',  `${c.green}v${s.version || '?'}${c.reset}${s.anon ? '   ' + c.magenta + '[ANON]' + c.reset : ''}`));
    out.push(kv('uptime',   `${c.fg}${fmtTime(s.uptime || 0)}${c.reset}`));
    out.push(kv('requests', `${c.cyan}${c.bold}${s.reqs || 0}${c.reset}  ${c.green}${s.ok || 0} ok${c.reset}  ${c.red}${s.errs || 0} err${c.reset}`));
    out.push(kv('tokens',   `${c.gold}${(s.tokIn || 0).toLocaleString()}${c.reset} in  ${c.dim}${S.arr}${c.reset}  ${c.gold}${(s.tokOut || 0).toLocaleString()}${c.reset} out`));
    out.push('');
    out.push(divider('POOL', 76));
    if (!s.pool || !s.pool.length) {
      out.push(`  ${c.dim}no pooled keys (set BONSAI_API_KEY or save profiles via ${c.cyan}bon multi${c.reset}${c.dim})${c.reset}`);
    } else {
      out.push(kv('total', `${c.cyan}${c.bold}${s.pool.length}${c.reset}  ${c.green}${s.poolFresh} fresh${c.reset}  ${c.red}${s.poolLimited} limited${c.reset}`));
      out.push('');
      for (let k of s.pool) {
        let dot = k.active ? `${c.green}${S.dot}${c.reset}` : `${c.mute}${S.ring}${c.reset}`;
        let status = k.limited ? pill('LIMITED', c.red) : pill('FRESH', c.green);
        out.push(`  ${dot} ${c.cyan}${k.name.padEnd(14)}${c.reset} ${c.dim}${k.masked}${c.reset}  ${status}`);
      }
    }
    out.push('');
    out.push(divider('THROUGHPUT (last 30s)', 76));
    if (history.length < 2) {
      out.push(`  ${c.dim}gathering data...${c.reset}`);
    } else {
      // tiny sparkline of req/s
      let rps = [];
      for (let i = 1; i < history.length; i++) {
        rps.push(Math.max(0, history[i].reqs - history[i-1].reqs));
      }
      let max = Math.max(1, ...rps);
      let bars = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
      let spark = rps.map(r => bars[Math.min(7, Math.floor(r / max * 7))]).join('');
      out.push(`  ${c.green}${spark}${c.reset}  ${c.dim}max ${max} req/s${c.reset}`);
    }
    out.push('');

    // redraw — move to top, clear screen below
    process.stdout.write('\x1b[H\x1b[J');
    process.stdout.write(out.join('\n') + '\n');
  }

  while (!stop) {
    try {
      let r = await req(`${base}/stats`, { timeout: 1500 });
      let s = r.body || {};
      history.push({ t: Date.now(), reqs: s.reqs || 0 });
      if (history.length > 30) history.shift();
      render(s);
    } catch (e) {
      console.clear();
      fail(`api.js gone: ${e.message}`);
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  process.stdout.write('\x1b[?25h'); // show cursor
}

// known trybons/ file list — used by cmdUi() update + missing-file recovery
const UI_FILES = [
  'VERSION', 'package.json', 'server.js', 'README.md',
  'views/landing.ejs', 'views/login.ejs',
  'views/partials/head.ejs', 'views/partials/foot.ejs',
  'views/partials/nav.ejs', 'views/partials/sidebar.ejs',
  'views/partials/profile-menu.ejs',
  'views/dashboard/index.ejs', 'views/dashboard/keys.ejs',
  'views/dashboard/activity.ejs', 'views/dashboard/models.ejs',
  'views/dashboard/settings.ejs',
  'views/docs/index.ejs', 'views/docs/page.ejs',
];

async function pullUiFiles(uiPath) {
  // download each file from raw.githubusercontent.com into uiPath
  let ok = 0, fail = 0;
  for (let f of UI_FILES) {
    try {
      let r = await req(`${REPO_RAW}/trybons/${f}`, { timeout: 10000 });
      if (r.status !== 200) { fail++; continue; }
      let dest = path.join(uiPath, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2));
      ok++;
    } catch { fail++; }
  }
  return { ok, fail };
}

async function cmdUi() {
  // launch trybons UI (express + ejs + htmx + tailwind, zero build)
  let port = parseInt(process.argv.find(a => /^\d{2,5}$/.test(a))) || 3000;
  let uiPath = path.join(path.dirname(process.argv[1] || ''), 'trybons');
  let force = process.argv.includes('--update');
  let skipCheck = process.argv.includes('--no-update');

  // missing folder entirely → offer to install (no git clone needed)
  if (!fs.existsSync(path.join(uiPath, 'server.js'))) {
    log('');
    box([
      `${c.gold}${S.bolt}${c.reset} ${c.bold}trybons UI is not installed yet${c.reset}`,
      ``,
      `  the web dashboard is a separate folder (${UI_FILES.length} files)`,
      `  ${c.dim}stack: express + ejs + htmx + tailwind, no build step${c.reset}`,
    ], { title: 'INSTALL UI', color: c.gold, width: 56 });
    log('');
    let yes = await askYN(`${c.bold}install it now?${c.reset} ${c.dim}(downloads from github, ~50KB)${c.reset}`);
    if (!yes) {
      info(`skipped. run ${c.cyan}bon ui${c.reset} again when ready.`);
      return;
    }
    let sp = spinner('downloading trybons UI files...');
    let r = await pullUiFiles(uiPath);
    sp.stop();
    if (r.fail > 0) { fail(`${r.ok} ok, ${r.fail} failed — try again`); return; }
    success(`installed ${r.ok} files into ${c.cyan}${uiPath}${c.reset}`);
  }

  // version check (unless --no-update)
  if (!skipCheck) {
    let localVer = '0.0.0';
    try { localVer = fs.readFileSync(path.join(uiPath, 'VERSION'), 'utf8').trim(); } catch {}
    try {
      let r = await req(`${REPO_RAW}/trybons/VERSION`, { timeout: 4000 });
      let remoteVer = (typeof r.body === 'string' ? r.body : '').trim();
      let newer = (a, b) => {
        let pa = a.split('.').map(Number), pb = b.split('.').map(Number);
        return pa[0]>pb[0] || (pa[0]===pb[0] && pa[1]>pb[1]) || (pa[0]===pb[0] && pa[1]===pb[1] && (pa[2]||0)>(pb[2]||0));
      };
      if (remoteVer && (force || newer(remoteVer, localVer))) {
        log('');
        box([
          `${c.gold}${S.bolt}${c.reset} ${c.bold}UPDATED UI available${c.reset}`,
          ``,
          `  current:  ${c.dim}v${localVer}${c.reset}`,
          `  latest:   ${c.green}v${remoteVer}${c.reset}`,
          ``,
          `  ${c.mute}pulls all ${UI_FILES.length} files from github${c.reset}`,
        ], { title: 'TRYBONS UI', color: c.gold, width: 56 });
        log('');
        let yes = await askYN(`${c.bold}update to v${remoteVer} now?${c.reset}`);
        if (yes) {
          let sp = spinner('downloading...');
          let r2 = await pullUiFiles(uiPath);
          sp.stop();
          if (r2.fail > 0) warn(`${r2.ok}/${UI_FILES.length} ok, ${r2.fail} failed`);
          else success(`updated to v${remoteVer}`);
        } else {
          note(`skipped. run ${c.cyan}bon ui --update${c.reset}${c.mute} to force later${c.reset}`);
        }
      }
    } catch {} // silent fail on version check, don't block launch
  }

  // ensure deps installed
  if (!fs.existsSync(path.join(uiPath, 'node_modules'))) {
    info(`installing trybons UI deps (express + ejs)...`);
    try { execSync('npm install --silent', { cwd: uiPath, stdio: 'inherit' }); }
    catch { fail('npm install failed in trybons/'); return; }
  }

  info(`launching trybons UI on ${c.cyan}http://localhost:${port}${c.reset}`);
  let env = { ...process.env, PORT: String(port) };
  let child = spawn(process.execPath, [path.join(uiPath, 'server.js')], { stdio: 'inherit', env });
  child.on('exit', code => process.exit(code || 0));
}

async function cmdCount() {
  // free pre-flight token counter using bonsai router's undocumented endpoint.
  // bon count "your prompt"   OR   echo "your prompt" | bon count
  let key = getStoredKey();
  if (!key) { fail("no api key. run: " + c.cyan + "bon login && bon keys" + c.reset); return; }

  let text = process.argv.slice(3).join(' ').trim();
  if (!text && !process.stdin.isTTY) {
    text = await new Promise(r => {
      let buf = ''; process.stdin.on('data', d => buf += d);
      process.stdin.on('end', () => r(buf.trim()));
    });
  }
  if (!text) {
    fail("no input");
    info(`usage: ${c.cyan}bon count "your prompt here"${c.reset}`);
    info(`   or: ${c.cyan}cat file.txt | bon count${c.reset}`);
    return;
  }

  let model = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || 'claude-opus-4-6';
  let body = { model, messages: [{ role: 'user', content: text }] };

  let sp = spinner('counting...');
  try {
    let r = await req(`${cfg.router}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'authorization': `Bearer ${key}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      timeout: 10000,
    });
    sp.stop();

    let userTok = r.body?.input_tokens || 0;
    let fingerprint = 30000; // approx, cc_system.json
    let total = userTok + fingerprint;
    // pricing from models.dev catalog (approx per 1M input tokens)
    let prices = {
      'claude-opus-4-6': 15, 'claude-opus-4-7': 15, 'claude-opus-4-5': 15,
      'claude-sonnet-4-6': 3, 'claude-sonnet-4-5': 3,
      'claude-haiku-4-5': 0.8,
      'gpt-5': 1.25, 'gpt-5-mini': 0.25,
      'o3': 2.5,
    };
    let priceIn = prices[model] || 3;
    let costUsd = (total / 1e6) * priceIn;

    box([
      kv('input', `${c.gold}${c.bold}${fmtNum(userTok)}${c.reset} tokens ${c.dim}(your prompt)${c.reset}`),
      kv('+ fingerprint', `${c.dim}~${fmtNum(fingerprint)} tokens (cc_system, every request)${c.reset}`),
      kv('= total', `${c.gold}${c.bold}${fmtNum(total)}${c.reset} tokens per request`),
      ``,
      kv('model', `${c.cyan}${model}${c.reset}`),
      kv('cost est', `${c.green}$${costUsd.toFixed(4)}${c.reset} ${c.dim}(at $${priceIn}/M, if you paid)${c.reset}`),
      kv('your save', `${c.green}$${costUsd.toFixed(4)}${c.reset} ${c.dim}(bonsai is free)${c.reset}`),
      ``,
      `${c.mute}router endpoint: ${c.dim}/v1/messages/count_tokens${c.reset}${c.mute} (free, no inference)${c.reset}`,
    ], { title: `${S.chart} TOKEN COUNT`, color: c.gold, width: 64 });
  } catch (e) {
    sp.stop(); fail(`count failed: ${e.message}`);
  }
}

// -- whoami --
async function cmdWhoami() {
  let token = await ensureToken();
  if (!token) { fail("not logged in"); return; }
  let user = await getUser();
  let key = getStoredKey();
  if (user?.email) log(`  ${c.green}${S.chk}${c.reset} ${c.bold}${user.email}${c.reset} ${key ? c.dim + maskKey(key) + c.reset : ''}`);
  else fail("could not fetch user");
}

// -- config --
async function cmdConfig() {
  let { index } = await pick("Config:", [
    `${S.eye} Show current config`,
    `${c.cyan}${S.arr}${c.reset} Set router URL`,
    `${c.red}${S.cross}${c.reset} Reset to defaults`,
  ]);
  if (index === 0) {
    let s = loadJson(cfg.settingsFile) || {};
    let lines = [
      `${c.dim}router${c.reset}     ${c.cyan}${s.router || cfg.router}${c.reset} ${!s.router ? c.dim+'(default)'+c.reset : ''}`,
      `${c.dim}backend${c.reset}    ${c.cyan}${s.backend || cfg.backend}${c.reset} ${!s.backend ? c.dim+'(default)'+c.reset : ''}`,
      `${c.dim}config${c.reset}     ${c.dim}${cfg.configDir}${c.reset}`,
      `${c.dim}debug${c.reset}      ${c.dim}${process.env.DEBUG ? 'on' : 'off'}${c.reset} ${c.dim}(set DEBUG=1)${c.reset}`,
    ];
    box(lines, { title: 'CONFIG', color: c.cyan });
  }
  if (index === 1) {
    let url = await ask("Router URL: ");
    if (url) { saveSetting('router', url); cfg.router = url; success(`router set to ${url}`); }
  }
  if (index === 2) {
    let s = loadJson(cfg.settingsFile) || {};
    delete s.router; delete s.backend;
    saveJson(cfg.settingsFile, s);
    success("reset to defaults");
  }
}

// -- typo map --
const TYPOS = {
  'loign':'login', 'logn':'login', 'lgin':'login', 'lgoin':'login',
  'lgout':'logout', 'logut':'logout',
  'strat':'start', 'satrt':'start', 'sart':'start',
  'kyes':'keys', 'kets':'keys',
  'tset':'test', 'tets':'test',
  'udpate':'update', 'upate':'update', 'upadte':'update',
  'heatlh':'health', 'helath':'health',
  'troubeshoot':'troubleshoot', 'troubleshot':'troubleshoot',
  'activty':'activity', 'acitivity':'activity',
  'staeal':'steal', 'stael':'steal',
  'mutli':'multi', 'mluti':'multi',
  'bnech':'bench', 'benhc':'bench', 'becnh':'bench', 'bnch':'bench',
  'fingerpint':'fingerprint', 'fingerprit':'fingerprint', 'finerprint':'fingerprint', 'fingerrpint':'fingerprint',
  'resmue':'resume', 'reusme':'resume',
  'agnts':'agents', 'agetns':'agents', 'agets':'agents',
  'dahs':'dash', 'dsah':'dash', 'dashbord':'dash', 'dsh':'dash',
};

// -- main --
async function main() {
  let cmd = process.argv[2];
  let extra = process.argv.slice(3);

  // flags as commands: bon --resume, bon --continue, bon --debug
  if (cmd === '--resume' || cmd === 'resume') {
    let token = await ensureToken();
    if (!token) { fail("not logged in"); return; }
    let key = getStoredKey();
    if (!key) { fail("no api key"); return; }
    launchClaude(key, ['--resume', ...extra]);
    return;
  }
  if (cmd === '--continue' || cmd === 'continue') {
    let token = await ensureToken();
    if (!token) { fail("not logged in"); return; }
    let key = getStoredKey();
    if (!key) { fail("no api key"); return; }
    launchClaude(key, ['--continue', ...extra]);
    return;
  }

  // --debug enables DEBUG env for verbose output
  if (cmd === '--debug') {
    process.env.DEBUG = '1';
    cmd = extra.shift();
    extra = process.argv.slice(4);
  }

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    banner();
    let cmds = [
      ['login', 'Authenticate with Bonsai'],
      ['logout', 'Clear stored credentials'],
      ['start', `Launch Claude Code / Codex (picker)`],
      ['cc', `Direct: Claude Code (skip picker)`],
      ['codex', `Direct: Codex (skip picker, via api.js)`],
      ['resume', `Resume last Claude Code session`],
      ['continue', `Continue last conversation`],
      ['keys', 'Manage API keys'],
      ['test', 'Test API endpoints'],
      ['info', 'Show account & config'],
      ['whoami', 'Quick identity check'],
      ['activity', 'View usage activity'],
      ['limits', 'Today\'s usage & daily limit'],
      ['stats', 'Usage analytics & cost savings'],
      ['health', 'Service status check'],
      ['proxy', 'Local proxy server (--rotate)'],
      ['models', 'Show available AI models'],
      ['bench', 'Benchmark all models (speed + quality)'],
      ['fingerprint', 'What the router sees about you'],
      ['api', 'API proxy (OpenAI + Anthropic compat)'],
      ['agents', 'Detect & configure Cline/Cursor/Aider/etc.'],
      ['dash', 'Live dashboard for running api.js'],
      ['count', 'Count tokens in a prompt (free, pre-flight)'],
      ['ui', 'Launch trybons web dashboard (Express+EJS+HTMX, zero build)'],
      ['pool', 'View key pool status'],
      ['rotate', 'Launch with auto key rotation'],
      ['multi', 'Multi-account profiles'],
      ['steal', 'Import from official CLI (decrypts)'],
      ['snoop', 'Data collection info'],
      ['config', 'View / edit settings'],
      ['troubleshoot', 'Fix common errors'],
      ['update', 'Check for updates'],
      ['statsig', 'Live Statsig exploit (models, limits)'],
      ['dump', 'Full infrastructure intel'],
    ];

    let lines = cmds.map(([name, desc]) => `  ${c.cyan}${c.bold}${name.padEnd(15)}${c.reset}${desc}`);
    box(lines, { title: 'COMMANDS', color: c.cyan });

    log('');
    box([
      `${c.cyan}--resume${c.reset}              Resume last session`,
      `${c.cyan}--continue${c.reset}            Continue last conversation`,
      `${c.cyan}--version${c.reset}             Show version`,
      `${c.cyan}--help${c.reset}                Show this help`,
      `${c.cyan}--debug${c.reset}               Verbose output`,
      `${c.cyan}--anon${c.reset}                Anonymize fingerprint to bonsai router (use with bon api)`,
    ], { title: 'BON FLAGS', color: c.yellow });

    log('');
    box([
      `${c.mute}passed through to Claude Code via ${c.cyan}bon start <flags>${c.reset}`,
      ``,
      `${c.sub}mode${c.reset}`,
      `  ${c.cyan}-p, --print${c.reset}                    Non-interactive, print & exit`,
      `  ${c.cyan}-r, --resume ${c.dim}[id]${c.reset}              Resume session by ID or picker`,
      `  ${c.cyan}-c, --continue${c.reset}                 Continue last conversation`,
      ``,
      `${c.sub}model${c.reset}`,
      `  ${c.cyan}--model ${c.dim}<model>${c.reset}                Set model (sonnet, opus, etc.)`,
      `  ${c.cyan}--fallback-model ${c.dim}<model>${c.reset}       Fallback when overloaded`,
      `  ${c.cyan}--effort ${c.dim}<low|med|high|max>${c.reset}    Effort level`,
      ``,
      `${c.sub}prompt${c.reset}`,
      `  ${c.cyan}--system-prompt ${c.dim}<text>${c.reset}         Replace system prompt`,
      `  ${c.cyan}--system-prompt-file ${c.dim}<path>${c.reset}    Replace from file`,
      `  ${c.cyan}--append-system-prompt ${c.dim}<text>${c.reset}  Append to system prompt`,
      ``,
      `${c.sub}permissions${c.reset}`,
      `  ${c.cyan}--permission-mode ${c.dim}<mode>${c.reset}       default/plan/auto/bypassPermissions`,
      `  ${c.cyan}--dangerously-skip-permissions${c.reset}  Skip all permission checks`,
      `  ${c.cyan}--allowedTools ${c.dim}<tools...>${c.reset}      Allow tools without prompting`,
      `  ${c.cyan}--disallowedTools ${c.dim}<tools...>${c.reset}   Block tools entirely`,
      ``,
      `${c.sub}output${c.reset}`,
      `  ${c.cyan}--output-format ${c.dim}<fmt>${c.reset}          text/json/stream-json`,
      `  ${c.cyan}--input-format ${c.dim}<fmt>${c.reset}           text/stream-json`,
      `  ${c.cyan}--json-schema ${c.dim}<schema>${c.reset}         Structured JSON output`,
      `  ${c.cyan}--verbose${c.reset}                      Full turn-by-turn output`,
      ``,
      `${c.sub}session${c.reset}`,
      `  ${c.cyan}--name ${c.dim}<name>${c.reset}                  Session display name`,
      `  ${c.cyan}--max-turns ${c.dim}<n>${c.reset}                Limit agentic turns`,
      `  ${c.cyan}--max-budget-usd ${c.dim}<n>${c.reset}           Max spend (dollars)`,
      `  ${c.cyan}--fork-session${c.reset}                 Fork instead of reuse`,
      ``,
      `${c.sub}worktree${c.reset}`,
      `  ${c.cyan}-w, --worktree ${c.dim}[name]${c.reset}         Isolated git worktree`,
      `  ${c.cyan}--add-dir ${c.dim}<dirs...>${c.reset}            Additional working dirs`,
      `  ${c.cyan}--tmux${c.reset}                         Tmux session for worktree`,
      ``,
      `${c.sub}mcp & plugins${c.reset}`,
      `  ${c.cyan}--mcp-config ${c.dim}<configs...>${c.reset}      Load MCP servers`,
      `  ${c.cyan}--plugin-dir ${c.dim}<path>${c.reset}            Load plugins from dir`,
      `  ${c.cyan}--agent ${c.dim}<agent>${c.reset}                Use specific agent`,
      ``,
      `${c.sub}other${c.reset}`,
      `  ${c.cyan}--chrome${c.reset}                       Enable Chrome integration`,
      `  ${c.cyan}--remote ${c.dim}<task>${c.reset}                Create web session on claude.ai`,
      `  ${c.cyan}--bare${c.reset}                         Minimal mode, fastest startup`,
      `  ${c.cyan}--settings ${c.dim}<file>${c.reset}              Load settings JSON`,
    ], { title: 'CLAUDE CODE FLAGS', color: c.magenta });

    log('');
    box([
      `${c.mute}passed through to Codex via ${c.cyan}bon codex <flags>${c.reset}`,
      `${c.mute}or ${c.cyan}bon start${c.reset}${c.mute} option 2${c.reset}`,
      ``,
      `${c.sub}subcommands${c.reset}`,
      `  ${c.cyan}exec, e${c.reset}                       Run non-interactive (alias: e)`,
      `  ${c.cyan}resume ${c.dim}[id]${c.reset}                  Resume session (--last for most recent)`,
      `  ${c.cyan}fork ${c.dim}[id]${c.reset}                    Fork a previous session`,
      `  ${c.cyan}apply, a${c.reset}                      Apply latest agent diff to working tree`,
      `  ${c.cyan}review${c.reset}                        Run code review on current repo`,
      `  ${c.cyan}mcp${c.reset}                           Manage external MCP servers`,
      `  ${c.cyan}plugin${c.reset}                        Manage Codex plugins`,
      `  ${c.cyan}cloud${c.reset}                         Browse Codex Cloud tasks`,
      `  ${c.cyan}sandbox${c.reset}                       Run command in Codex sandbox`,
      ``,
      `${c.sub}config${c.reset}`,
      `  ${c.cyan}-c, --config ${c.dim}key=value${c.reset}        Override config (TOML, dotted path)`,
      `  ${c.cyan}--enable ${c.dim}<feature>${c.reset}            Enable feature flag (repeatable)`,
      `  ${c.cyan}--disable ${c.dim}<feature>${c.reset}           Disable feature flag (repeatable)`,
      `  ${c.cyan}-p, --profile ${c.dim}<name>${c.reset}          Profile from ~/.codex/config.toml`,
      `  ${c.cyan}--ignore-user-config${c.reset}           Skip config.toml (auth still loads)`,
      ``,
      `${c.sub}model${c.reset}`,
      `  ${c.cyan}-m, --model ${c.dim}<model>${c.reset}            Set model`,
      `  ${c.cyan}--oss${c.reset}                          Use open-source provider`,
      `  ${c.cyan}--local-provider ${c.dim}<lmstudio|ollama>${c.reset}  Local provider (with --oss)`,
      ``,
      `${c.sub}sandbox${c.reset}`,
      `  ${c.cyan}-s, --sandbox ${c.dim}<mode>${c.reset}          read-only / workspace-write / danger-full-access`,
      `  ${c.cyan}--full-auto${c.reset}                    Sandboxed automatic execution`,
      `  ${c.cyan}-a, --ask-for-approval ${c.dim}<policy>${c.reset}  untrusted/on-failure/on-request/never`,
      `  ${c.cyan}--dangerously-bypass-approvals-and-sandbox${c.reset}  No prompts, no sandbox`,
      ``,
      `${c.sub}workspace${c.reset}`,
      `  ${c.cyan}-C, --cd ${c.dim}<dir>${c.reset}                Working root directory`,
      `  ${c.cyan}--add-dir ${c.dim}<dir>${c.reset}               Additional writable directory`,
      `  ${c.cyan}--skip-git-repo-check${c.reset}          Allow running outside a git repo`,
      `  ${c.cyan}--ephemeral${c.reset}                    Don't persist session files`,
      ``,
      `${c.sub}other${c.reset}`,
      `  ${c.cyan}-i, --image ${c.dim}<file>...${c.reset}         Attach image(s) to initial prompt`,
      `  ${c.cyan}--search${c.reset}                       Enable native web_search tool`,
      `  ${c.cyan}--no-alt-screen${c.reset}                Inline mode (preserves scrollback)`,
      `  ${c.cyan}--remote ${c.dim}<ws://...>${c.reset}           Connect TUI to remote app server`,
      `  ${c.cyan}--output-schema ${c.dim}<file>${c.reset}        JSON schema for final response`,
    ], { title: 'CODEX FLAGS', color: c.orange });

    log(`\n  ${c.dim}Usage: ${c.cyan}bon ${c.reset}${c.dim}<command> [flags]${c.reset}`);
    log(`  ${c.dim}Example: ${c.cyan}bon start --model opus --verbose${c.reset}`);
    log(`  ${c.dim}Docs: ${c.under}https://github.com/${REPO}${c.reset}\n`);
    await checkSelfUpdate(true).catch(() => {});
    return;
  }

  if (cmd === '--version' || cmd === '-v') { log(`${c.bold}${c.green}bonsai.js${c.reset} ${c.dim}v${VERSION}${c.reset}`); return; }

  // typo correction
  if (TYPOS[cmd]) {
    let fixed = TYPOS[cmd];
    warn(`did you mean ${c.cyan}${c.bold}${fixed}${c.reset}?`);
    cmd = fixed;
  }

  // one-time migration notice for users who installed via curl|bash (v2.5.8+ uses npm)
  showMigrationNoticeOnce();

  // background update check — runs while command executes, prints after
  let updateP = null;
  if (!['update','dump','help','--help','-h','troubleshoot','whoami','config'].includes(cmd)) {
    updateP = checkSelfUpdate(true).catch(() => {});
  }

  try {
    switch (cmd) {
      case 'login': await cmdLogin(); break;
      case 'logout': await cmdLogout(); break;
      case 'start': await cmdStart(); break;
      case 'cc': case 'claude': await cmdCc(); break;
      case 'codex': await cmdCodex(); break;
      case 'agents': case 'tools': await cmdAgents(); break;
      case 'dash': case 'dashboard': await cmdDash(); break;
      case 'count': case 'tokens': await cmdCount(); break;
      case 'ui': case 'web': case 'dashboard-ui': await cmdUi(); break;
      case 'keys': await cmdKeys(); break;
      case 'test': await cmdTest(); break;
      case 'info': await cmdInfo(); break;
      case 'whoami': await cmdWhoami(); break;
      case 'config': await cmdConfig(); break;
      case 'activity': await cmdActivity(); break;
      case 'limits': await cmdLimits(); break;
      case 'stats': await cmdStats(); break;
      case 'health': await cmdHealth(); break;
      case 'proxy': await cmdProxy(); break;
      case 'models': await cmdModels(); break;
      case 'bench': await cmdBench(); break;
      case 'fingerprint': await cmdFingerprint(); break;
      case 'api': await cmdApi(); break;
      case 'pool': await cmdPool(); break;
      case 'rotate': await cmdRotate(); break;
      case 'multi': await cmdMulti(); break;
      case 'steal': await cmdSteal(); break;
      case 'snoop': await cmdSnoop(); break;
      case 'troubleshoot': case 'fix': await cmdTroubleshoot(); break;
      case 'update': await cmdUpdate(); break;
      case 'statsig': await cmdStatsig(); break;
      case 'dump': await cmdDump(); break;
      default:
        fail(`unknown command: ${cmd}`);
        info(`run ${c.cyan}bon --help${c.reset} to see all commands`);
    }
  } catch (e) {
    fail(e.message);
    if (process.env.DEBUG) console.error(e);
  }
}

main();
