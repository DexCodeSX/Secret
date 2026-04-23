#!/usr/bin/env node

// api.js v2.4.0 — bonsai api proxy
// github.com/DexCodeSX/Secret
// re'd from @bonsai-ai/cli 0.4.13 + @bonsai-ai/claude-code 2.1.112
//
// v2.4: --anon mode strips device/session correlation from outbound headers,
// and rate-limit absorption transparently rotates pooled keys mid-request
// instead of returning 429 on the first limit hit.
//
// lets you hit bonsai models directly via curl/fetch/openai-sdk
// translates openai format <-> anthropic on the fly
// auto-rotates keys when rate limited

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const VER = "2.4.3";
const ROUTER = process.env.BONSAI_ROUTER_URL || "https://go.trybons.ai";
const cfgDir = path.join(os.homedir(), '.bonsai-oss');
const isWin = process.platform === 'win32';
const deviceId = crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex');

// anon mode: strip stable identifiers so bonsai can't correlate sessions/users.
// Set BONSAI_ANON=1 or pass --anon. Costs nothing but breaks bonsai's analytics.
const ANON = process.env.BONSAI_ANON === '1' || process.argv.includes('--anon');
function newId() { return crypto.randomBytes(16).toString('hex'); }
function newDevId() { return ANON ? newId() : deviceId; }
function newSessId() { return ANON ? crypto.randomUUID() : sessionId; }

// seconds until 00:00 UTC — used for Retry-After header on rate-limit responses
function secondsUntilMidnightUtc() {
  let now = new Date();
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor((next - now) / 1000);
}

// retry once on transient upstream 5xx (502/503/504). returns the response or rejects.
async function fetchRetry(url, init, attempts) {
  attempts = attempts || 2;
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      let r = await fetch(url, init);
      if (r.status === 502 || r.status === 503 || r.status === 504) {
        last = r;
        if (i < attempts - 1) { await new Promise(res => setTimeout(res, 500)); continue; }
      }
      return r;
    } catch (e) {
      last = e;
      if (i < attempts - 1) { await new Promise(res => setTimeout(res, 500)); continue; }
      throw e;
    }
  }
  return last;
}

// claude code system prompt — router validates this exists
// captured from @bonsai-ai/claude-code as JSON array, saved on first bon start
let ccSystem = null;
try { ccSystem = JSON.parse(fs.readFileSync(path.join(cfgDir, 'cc_system.json'), 'utf8')); } catch {}
if (!ccSystem) try { let t = fs.readFileSync(path.join(cfgDir, 'cc_system.txt'), 'utf8'); ccSystem = JSON.parse(t); } catch {}

// -- palette --
// muted premium. not rainbow vomit.
const $ = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m', i: '\x1b[3m', u: '\x1b[4m',
  w: '\x1b[38;5;252m',
  fg: '\x1b[38;5;250m',
  sub: '\x1b[38;5;245m',
  mute: '\x1b[38;5;240m',
  fade: '\x1b[38;5;236m',
  grn: '\x1b[38;5;114m',
  blu: '\x1b[38;5;75m',
  gld: '\x1b[38;5;179m',
  red: '\x1b[38;5;167m',
  orn: '\x1b[38;5;215m',
  vio: '\x1b[38;5;141m',
  tea: '\x1b[38;5;116m',
  // gradients
  gr: ['\x1b[38;5;22m','\x1b[38;5;28m','\x1b[38;5;34m','\x1b[38;5;40m','\x1b[38;5;46m','\x1b[38;5;82m','\x1b[38;5;114m'],
};

const S = {
  tl: '\u256D', tr: '\u256E', bl: '\u2570', br: '\u256F',
  h: '\u2500', v: '\u2502',
  dot: '\u25CF', ring: '\u25CB', dia: '\u25C6', tri: '\u25B8',
  arr: '\u2192', chk: '\u2713', x: '\u2717', bolt: '\u26A1',
  bar: '\u2588',
};

// -- ui --

function slen(s) {
  let c = s.replace(/\x1b\[[0-9;]*m/g, ''), w = 0;
  for (let ch of c) w += (ch.codePointAt(0) > 0x1F00) ? 2 : 1;
  return w;
}

function grad(text, colors) {
  let out = '', ci = 0;
  for (let ch of text) { out += colors[ci % colors.length] + ch; if (ch !== ' ') ci++; }
  return out + $.r;
}

function frame(lines, opts = {}) {
  let { title, color, width: minW } = opts;
  color = color || $.mute;
  let inner = Math.max(...lines.map(slen), title ? slen(title) + 5 : 0, (minW||0) - 4, 44);

  let top = title
    ? `${color}${S.tl}${S.h} ${$.b}${$.fg}${title}${$.r} ${color}${S.h.repeat(Math.max(0, inner - slen(title)))}${S.tr}${$.r}`
    : `${color}${S.tl}${S.h.repeat(inner + 2)}${S.tr}${$.r}`;

  let empty = `${color}${S.v}${$.r}${' '.repeat(inner + 2)}${color}${S.v}${$.r}`;
  let bot = `${color}${S.bl}${S.h.repeat(inner + 2)}${S.br}${$.r}`;

  console.log(top);
  console.log(empty);
  for (let l of lines) {
    let gap = inner - slen(l);
    console.log(`${color}${S.v}${$.r} ${l}${' '.repeat(Math.max(0, gap + 1))}${color}${S.v}${$.r}`);
  }
  console.log(empty);
  console.log(bot);
}

function ok(m)   { console.log(`  ${$.grn}${S.chk}${$.r} ${m}`); }
function err(m)  { console.log(`  ${$.red}${S.x}${$.r} ${m}`); }
function info(m) { console.log(`  ${$.blu}${S.tri}${$.r} ${m}`); }
function warn(m) { console.log(`  ${$.orn}!${$.r} ${m}`); }

function maskKey(k) { return (!k || k.length < 12) ? '???' : k.slice(0,8) + '\u00B7\u00B7\u00B7' + k.slice(-4); }
function ts() { return new Date().toLocaleTimeString('en-US', {hour12:false}); }
function fmtN(n) { return n.toLocaleString(); }

// -- config --

function getKey() {
  let env = process.env.BONSAI_API_KEY;
  if (env) return env;
  try { return JSON.parse(fs.readFileSync(path.join(cfgDir, 'apikey.json'), 'utf8')).key; }
  catch { return null; }
}

function getPool() {
  let keys = [];
  let main = getKey();
  if (main) keys.push({ name: 'main', key: main });

  let dir = path.join(cfgDir, 'profiles');
  try {
    if (fs.existsSync(dir)) {
      for (let f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
        let d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (d?.apiKey && !keys.find(k => k.key === d.apiKey))
          keys.push({ name: f.replace('.json',''), key: d.apiKey });
      }
    }
  } catch {}
  return keys;
}

// -- http --

async function fwd(url, opts = {}) {
  if (opts.pipe) {
    // streaming: use fetch and return the body readable stream wrapped as node stream
    let r = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body || undefined,
      signal: AbortSignal.timeout(opts.timeout || 120000),
    });
    // wrap as node-compatible readable with statusCode
    const { Readable } = await import('stream');
    let readable = Readable.fromWeb(r.body);
    readable.statusCode = r.status;
    readable.headers = Object.fromEntries(r.headers);
    return readable;
  }
  // non-streaming: use fetch with retry on transient 5xx
  let r = await fetchRetry(url, {
    method: opts.method || 'GET',
    headers: opts.headers || {},
    body: opts.body || undefined,
    signal: AbortSignal.timeout(opts.timeout || 120000),
  });
  let text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, headers: Object.fromEntries(r.headers), body };
}

// always stream internally, collect text blocks into a single response
// router returns empty content for non-stream requests
async function streamCollect(url, headers, body) {
  let b = { ...body, stream: true };
  let up = await fwd(url, { method: 'POST', headers, body: JSON.stringify(b), pipe: true });
  return new Promise((resolve, reject) => {
    if (up.statusCode >= 400) {
      let err = '';
      up.on('data', c => err += c);
      up.on('end', () => { try { resolve({ status: up.statusCode, body: JSON.parse(err) }); } catch { resolve({ status: up.statusCode, body: { error: err } }); } });
      return;
    }
    let texts = [], model = 'bonsai', usage = {}, id = '';
    let buf = '';
    up.on('data', chunk => {
      buf += chunk.toString();
      let lines = buf.split('\n');
      buf = lines.pop();
      for (let line of lines) {
        line = line.trim();
        if (!line.startsWith('data:')) continue;
        let d = line.slice(5).trim();
        if (d === '[DONE]') continue;
        try {
          let j = JSON.parse(d);
          if (j.type === 'message_start') {
            id = j.message?.id || '';
            model = j.message?.model || model;
          }
          if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') {
            texts.push(j.delta.text);
          }
          if (j.type === 'message_delta' && j.usage) usage = j.usage;
        } catch {}
      }
    });
    up.on('end', () => {
      resolve({
        status: 200,
        body: {
          id: id, type: 'message', role: 'assistant', model,
          content: [{ type: 'text', text: texts.join('') }],
          stop_reason: 'end_turn', stop_sequence: null,
          usage: { input_tokens: usage.input_tokens||0, output_tokens: usage.output_tokens||0 },
        }
      });
    });
    up.on('error', reject);
  });
}

// -- format conversion --

// model alias mapping — codex sends gpt models, we remap to claude
// v2.4.2: codex now ACTUALLY uses openai. before this, gpt-* names got
// silently rewritten to claude-* — codex thought it was using gpt but
// the router executed claude. now we confirmed bonsai router accepts
// real gpt-5/o3/etc (199 of 213 models worked, see MODELS.md), so we
// pass openai names through and only remap codex-internal names that
// the router doesn't know about (gpt-5-codex variants etc) to gpt-5.
const modelMap = {
  // codex-internal aliases -> closest real openai model the router accepts
  'gpt-5.2-codex': 'gpt-5',
  'gpt-5-codex':   'gpt-5',
  'gpt-5.2':       'gpt-5',
  'codex-mini':    'gpt-5-mini',
  // gpt-4.1 variants — router accepts gpt-4 family directly
  'gpt-4.1':       'gpt-4-turbo',
  'gpt-4.1-mini':  'gpt-4o-mini',
  'gpt-4.1-nano':  'gpt-4o-mini',
  // o-series — router accepts o3/o4 directly so these are pass-through;
  // listed here only so the table is exhaustive and someone reading
  // this file knows nothing's being secretly rewritten
  // 'o4-mini' -> o4-mini (pass through)
  // 'o3'      -> o3 (pass through)
  // 'o3-mini' -> o3-mini (pass through)
  // 'o3-pro'  -> o3-pro (pass through)
};

function mapModel(m) { return modelMap[m] || m; }

// openai responses api body -> anthropic messages body
// handles both simple string input and structured input array
function responsesToAnthropic(body) {
  let msgs = [], sys;
  let input = body.input;

  if (typeof input === 'string') {
    // simple string prompt
    msgs.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    // structured input: array of messages or content items
    for (let item of input) {
      if (item.role === 'system' || item.type === 'system') {
        sys = (sys || '') + (item.content || item.text || '');
      } else if (item.role === 'user' || item.role === 'assistant' || item.role === 'developer') {
        let role = item.role === 'developer' ? 'user' : item.role;
        let content = typeof item.content === 'string' ? item.content :
          Array.isArray(item.content) ? item.content.map(c => c.text || c.content || '').join('') :
          JSON.stringify(item.content);
        msgs.push({ role, content });
      } else if (item.type === 'message') {
        let role = item.role === 'developer' ? 'user' : (item.role || 'user');
        let content = typeof item.content === 'string' ? item.content :
          Array.isArray(item.content) ? item.content.map(c => c.text || c.content || '').join('') :
          JSON.stringify(item.content);
        msgs.push({ role, content });
      }
    }
  }

  if (!msgs.length) msgs.push({ role: 'user', content: '' });

  let out = {
    model: mapModel(body.model || 'bonsai'),
    max_tokens: body.max_output_tokens || body.max_tokens || 8192,
    messages: msgs,
    stream: !!body.stream,
  };
  if (sys) out.system = sys;
  if (body.temperature != null) out.temperature = body.temperature;
  if (body.top_p != null) out.top_p = body.top_p;
  return out;
}

// anthropic response -> openai responses api format
function toResponses(body, model) {
  let text = (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return {
    id: 'resp_' + (body.id || Math.random().toString(36).slice(2,14)),
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    model: model || body.model || 'bonsai',
    status: 'completed',
    output: [{
      type: 'message',
      id: 'msg_' + Math.random().toString(36).slice(2,14),
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text }],
    }],
    usage: {
      input_tokens: body.usage?.input_tokens || 0,
      output_tokens: body.usage?.output_tokens || 0,
      total_tokens: (body.usage?.input_tokens || 0) + (body.usage?.output_tokens || 0),
    },
  };
}

// streaming: anthropic SSE chunk -> openai responses SSE events
// codex requires event: lines to match the type field exactly
function convertResponsesChunk(line, model, respId) {
  if (!line.startsWith('data: ')) return null;
  let raw = line.slice(6).trim();
  if (raw === '[DONE]') return null;
  let itemId = 'item_' + respId.slice(5);
  try {
    let evt = JSON.parse(raw);
    if (evt.type === 'message_start') {
      let d1 = { type: 'response.created', response: { id: respId, object: 'response', status: 'in_progress', model, output: [] } };
      let d2 = { type: 'response.in_progress', response: { id: respId, object: 'response', status: 'in_progress', model, output: [] } };
      let d3 = { type: 'response.output_item.added', item: { type: 'message', id: itemId, status: 'in_progress', role: 'assistant', content: [] }, output_index: 0 };
      let d4 = { type: 'response.content_part.added', part: { type: 'output_text', text: '' }, item_id: itemId, output_index: 0, content_index: 0 };
      return `event: response.created\ndata: ${JSON.stringify(d1)}\n\n` +
             `event: response.in_progress\ndata: ${JSON.stringify(d2)}\n\n` +
             `event: response.output_item.added\ndata: ${JSON.stringify(d3)}\n\n` +
             `event: response.content_part.added\ndata: ${JSON.stringify(d4)}\n\n`;
    }
    if (evt.type === 'content_block_delta' && evt.delta?.text) {
      let d = { type: 'response.output_text.delta', delta: evt.delta.text, item_id: itemId, output_index: 0, content_index: 0 };
      return `event: response.output_text.delta\ndata: ${JSON.stringify(d)}\n\n`;
    }
    if (evt.type === 'message_stop') {
      let d1 = { type: 'response.output_text.done', text: '', item_id: itemId, output_index: 0, content_index: 0 };
      let d2 = { type: 'response.content_part.done', part: { type: 'output_text', text: '' }, item_id: itemId, output_index: 0, content_index: 0 };
      let d3 = { type: 'response.output_item.done', item: { type: 'message', id: itemId, status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '' }] }, output_index: 0 };
      let d4 = { type: 'response.completed', response: { id: respId, object: 'response', status: 'completed', model } };
      return `event: response.output_text.done\ndata: ${JSON.stringify(d1)}\n\n` +
             `event: response.content_part.done\ndata: ${JSON.stringify(d2)}\n\n` +
             `event: response.output_item.done\ndata: ${JSON.stringify(d3)}\n\n` +
             `event: response.completed\ndata: ${JSON.stringify(d4)}\n\n`;
    }
  } catch {}
  return null;
}

// openai chat body -> anthropic messages body
function toAnthropic(body) {
  let msgs = [], sys;
  for (let m of (body.messages || [])) {
    if (m.role === 'system') {
      sys = (sys || '') + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
      continue;
    }
    msgs.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    });
  }
  let out = {
    model: mapModel(body.model || 'bonsai'),
    max_tokens: body.max_tokens || body.max_completion_tokens || 8192,
    messages: msgs,
    stream: !!body.stream,
  };
  if (sys) out.system = sys;
  if (body.temperature != null) out.temperature = body.temperature;
  if (body.top_p != null) out.top_p = body.top_p;
  if (body.stop) out.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  return out;
}

// anthropic response -> openai response
function toOpenAI(body, model) {
  let text = (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return {
    id: 'chatcmpl-' + (body.id || Math.random().toString(36).slice(2,14)),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || body.model || 'bonsai',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: body.stop_reason === 'end_turn' ? 'stop' : (body.stop_reason || 'stop'),
    }],
    usage: {
      prompt_tokens: body.usage?.input_tokens || 0,
      completion_tokens: body.usage?.output_tokens || 0,
      total_tokens: (body.usage?.input_tokens || 0) + (body.usage?.output_tokens || 0),
    },
  };
}

// streaming: anthropic SSE chunk -> openai SSE chunk
function convertChunk(line, model, id) {
  if (!line.startsWith('data: ')) return null;
  let raw = line.slice(6).trim();
  if (raw === '[DONE]') return 'data: [DONE]\n\n';
  try {
    let evt = JSON.parse(raw);
    if (evt.type === 'content_block_delta' && evt.delta?.text) {
      return 'data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model,
        choices: [{ index: 0, delta: { content: evt.delta.text }, finish_reason: null }],
      }) + '\n\n';
    }
    if (evt.type === 'message_stop') {
      return 'data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }) + '\n\ndata: [DONE]\n\n';
    }
  } catch {}
  return null;
}

// -- state --

let pool = [];
let poolIdx = 0;
let limited = new Set();
let stats = { reqs: 0, ok: 0, errs: 0, tokIn: 0, tokOut: 0, started: Date.now() };

function activeKey() {
  for (let i = 0; i < pool.length; i++) {
    let idx = (poolIdx + i) % pool.length;
    if (!limited.has(pool[idx].key)) return pool[idx];
  }
  return null;
}

function rotate(badKey) {
  limited.add(badKey);
  poolIdx = (poolIdx + 1) % pool.length;
  let next = activeKey();
  if (next) console.log(`  ${$.orn}${S.bolt}${$.r} ${$.d}rotated${$.r}  ${$.mute}${maskKey(badKey)}${$.r} ${$.d}${S.arr}${$.r} ${$.grn}${maskKey(next.key)}${$.r} ${$.mute}(${next.name})${$.r}`);
  return next;
}

// session id persists across requests like real claude code
const sessionId = crypto.randomUUID();

function hdrs(key) {
  // when anon: per-call session id + neutralized OS/arch so router only sees opaque hashes
  let sid = newSessId();
  let osStr = ANON ? 'Linux' : (process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'MacOS' : 'Linux');
  let archStr = ANON ? 'x64' : process.arch;
  return {
    'content-type': 'application/json',
    'accept': 'application/json',
    'x-api-key': key,
    'authorization': `Bearer ${key}`,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'anthropic-beta': 'claude-code-20250219,context-1m-2025-08-07,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,effort-2025-11-24',
    'user-agent': 'claude-cli/2.1.112 (external, cli)',
    'x-app': 'cli',
    'x-claude-code-session-id': sid,
    'x-stainless-lang': 'js',
    'x-stainless-package-version': '0.80.0',
    'x-stainless-os': osStr,
    'x-stainless-arch': archStr,
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': ANON ? 'v22.0.0' : process.version,
    'x-stainless-retry-count': '0',
    'x-stainless-timeout': '600',
    'accept-language': '*',
    'sec-fetch-mode': 'cors',
  };
}

function isLimitErr(status, body) {
  if (status !== 400 && status !== 429) return false;
  let msg = typeof body === 'string' ? body : (body?.message || body?.error?.message || '');
  return msg.includes('daily token limit');
}

// -- request logging --

function logReq(method, path, status, extra = '') {
  let sc = status < 300 ? `${$.grn}${status}${$.r}` : status < 500 ? `${$.orn}${status}${$.r}` : `${$.red}${status}${$.r}`;
  let mc = method === 'POST' ? $.blu : $.sub;
  console.log(`  ${$.grn}${S.tri}${$.r} ${$.mute}${ts()}${$.r}  ${mc}${method}${$.r} ${$.sub}${path}${$.r}  ${sc}  ${extra}`);
}

// -- server --

function serve(port) {
  let corsH = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  let json = h => ({ ...corsH, 'content-type': 'application/json', ...h });

  let server = http.createServer((req, res) => {
    // preflight
    if (req.method === 'OPTIONS') { res.writeHead(204, corsH); res.end(); return; }

    // GET routes
    if (req.method === 'GET') {
      if (req.url === '/v1/models') {
        stats.reqs++;
        // return known models from Statsig dump + real routing
        let models = [
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', context: '1M', note: 'default' },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', context: '200K' },
          { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'anthropic', context: '200K' },
          { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', context: '200K' },
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', context: '200K' },
          { id: 'glm-4.7', name: 'GLM-4.7', provider: 'zhipu', context: '128K' },
          { id: 'bonsai', name: 'Bonsai Default', provider: 'openrouter', note: 'routes to best available' },
          { id: 'stealth', name: 'Stealth', provider: 'openrouter', note: 'hidden model name' },
        ].map(m => ({ id: m.id, object: 'model', created: 1700000000, owned_by: m.provider || 'bonsai', ...m }));
        res.writeHead(200, json());
        res.end(JSON.stringify({ object: 'list', data: models }));
        return;
      }
      if (req.url === '/health' || req.url === '/v1/health') {
        res.writeHead(200, json());
        res.end(JSON.stringify({ status:'ok', version: VER, uptime: Math.floor((Date.now()-stats.started)/1000), requests: stats.reqs, tokens: { in: stats.tokIn, out: stats.tokOut } }));
        return;
      }
      if (req.url === '/stats') {
        let active = activeKey();
        let poolView = pool.map(k => ({
          name: k.name,
          masked: maskKey(k.key),
          limited: limited.has(k.key),
          active: active && k.key === active.key,
        }));
        res.writeHead(200, json());
        res.end(JSON.stringify({
          ...stats,
          uptime: Math.floor((Date.now() - stats.started) / 1000),
          anon: ANON,
          pool: poolView,
          poolFresh: poolView.filter(p => !p.limited).length,
          poolLimited: poolView.filter(p => p.limited).length,
          version: VER,
        }));
        return;
      }
      if (req.url === '/' || req.url === '') {
        res.writeHead(200, json());
        res.end(JSON.stringify({ service:'bonsai-api', version: VER, endpoints:['/v1/messages','/v1/messages/count_tokens','/v1/chat/completions','/responses','/v1/models','/health','/stats'] }));
        return;
      }
      res.writeHead(404, json()); res.end(JSON.stringify({error:'not found'})); return;
    }

    // POST routes - collect body first
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      let raw = Buffer.concat(chunks).toString();
      let body;
      try { body = JSON.parse(raw); } catch {
        res.writeHead(400, json()); res.end(JSON.stringify({error:'invalid json'})); return;
      }

      stats.reqs++;
      let key = activeKey();
      if (!key) {
        stats.errs++;
        // distinguish "no keys at all" from "all keys exhausted today"
        if (pool.length === 0) {
          res.writeHead(503, json());
          res.end(JSON.stringify({ error: 'no api key — set BONSAI_API_KEY or run: bon login && bon keys' }));
          return;
        }
        let retryAfter = secondsUntilMidnightUtc();
        res.writeHead(429, { ...json(), 'retry-after': String(retryAfter) });
        res.end(JSON.stringify({
          error: 'all keys hit daily limit, resets at 00:00 UTC',
          limited: pool.map(k => k.name),
          retryAfter,
        }));
        logReq(req.method, req.url, 429, `${$.red}all-keys-limited${$.r}  ${$.mute}retry in ${Math.floor(retryAfter/3600)}h${$.r}`);
        return;
      }

      let t0 = Date.now();
      let isStream = !!body.stream;

      // inject claude code fingerprint so router accepts the request
      function wrapBody(b) {
        let wrapped = { ...b };
        if (ccSystem) {
          if (b.system) {
            // append user's system prompt to cc system array
            let userSys = typeof b.system === 'string' ? [{type:'text', text: b.system}] : b.system;
            wrapped.system = [...ccSystem, ...userSys];
          } else {
            wrapped.system = ccSystem;
          }
        }
        if (!wrapped.metadata || ANON) {
          wrapped.metadata = { user_id: JSON.stringify({ device_id: newDevId(), account_uuid: '', session_id: newSessId() }) };
        }
        // skip thinking for proxy — adaptive thinking puts output in thinking blocks not content
        return wrapped;
      }

      try {
        // --- /v1/messages/count_tokens (FREE pre-flight token counter) ---
        // bonsai router exposes this undocumented. counts user content only,
        // returns immediately, NO inference cost. add ~30K for cc_system fingerprint.
        if (req.url === '/v1/messages/count_tokens') {
          let r = await fwd(`${ROUTER}/v1/messages/count_tokens`, {
            method: 'POST',
            headers: hdrs(key.key),
            body: JSON.stringify(body),
          });
          stats.ok++;
          let userTok = r.body?.input_tokens || 0;
          logReq('POST', '/v1/messages/count_tokens', r.status, `${$.gld}${fmtN(userTok)}${$.r} user tok ${$.mute}+~30K fingerprint${$.r}  ${$.mute}${Date.now()-t0}ms${$.r}`);
          res.writeHead(r.status, json());
          res.end(JSON.stringify(r.body));
          return;
        }

        // --- /v1/messages (anthropic native) ---
        if (req.url === '/v1/messages') {
          if (isStream) {
            let up = await fwd(`${ROUTER}/v1/messages?beta=true`, { method:'POST', headers: hdrs(key.key), body: JSON.stringify(wrapBody(body)), pipe: true, timeout: 300000 });
            if (up.statusCode >= 400) {
              let errBuf = '';
              up.on('data', c => errBuf += c);
              up.on('end', () => {
                if (errBuf.includes('daily token limit')) rotate(key.key);
                stats.errs++;
                logReq('POST', '/v1/messages', up.statusCode, `${$.red}error${$.r}`);
                res.writeHead(up.statusCode, json()); res.end(errBuf);
              });
              return;
            }
            // pipe through
            let fwdHeaders = {};
            for (let [k,v] of Object.entries(up.headers)) {
              if (!['transfer-encoding','connection'].includes(k)) fwdHeaders[k] = v;
            }
            res.writeHead(up.statusCode, { ...corsH, ...fwdHeaders });
            up.pipe(res);
            stats.ok++;
            logReq('POST', '/v1/messages', up.statusCode, `${$.d}stream${$.r}  ${$.mute}${Date.now()-t0}ms${$.r}`);
            return;
          }

          // non-stream — internally stream and collect. on limit, try EVERY fresh pooled key before giving up.
          let r = await streamCollect(`${ROUTER}/v1/messages?beta=true`, hdrs(key.key), wrapBody(body));
          let activeNow = key;
          while (isLimitErr(r.status, r.body)) {
            let next = rotate(activeNow.key);
            if (!next) break;
            activeNow = next;
            r = await streamCollect(`${ROUTER}/v1/messages?beta=true`, hdrs(next.key), wrapBody(body));
          }
          if (r.body?.usage) { stats.tokIn += r.body.usage.input_tokens||0; stats.tokOut += r.body.usage.output_tokens||0; }
          stats.ok++;
          let tok = r.body?.usage ? `${$.mute}${fmtN(r.body.usage.input_tokens||0)}${S.arr}${fmtN(r.body.usage.output_tokens||0)}${$.r}` : '';
          let mdl = r.body?.model ? `${$.tea}${r.body.model}${$.r}` : '';
          logReq('POST', '/v1/messages', r.status, `${mdl}  ${tok}  ${$.mute}${Date.now()-t0}ms${$.r}`);
          res.writeHead(r.status, json()); res.end(JSON.stringify(r.body));
          return;
        }

        // --- /v1/chat/completions (openai compat) ---
        if (req.url === '/v1/chat/completions') {
          let aBody = toAnthropic(body);
          let model = body.model || 'bonsai';
          let reqId = 'chatcmpl-' + Math.random().toString(36).slice(2,14);

          if (isStream) {
            let up = await fwd(`${ROUTER}/v1/messages?beta=true`, { method:'POST', headers: hdrs(key.key), body: JSON.stringify(wrapBody(aBody)), pipe: true, timeout: 300000 });
            if (up.statusCode >= 400) {
              let errBuf = '';
              up.on('data', c => errBuf += c);
              up.on('end', () => {
                if (errBuf.includes('daily token limit')) rotate(key.key);
                stats.errs++;
                logReq('POST', '/v1/chat/completions', up.statusCode, `${$.red}error${$.r}`);
                res.writeHead(up.statusCode, json()); res.end(errBuf);
              });
              return;
            }
            res.writeHead(200, { ...corsH, 'content-type':'text/event-stream', 'cache-control':'no-cache', 'connection':'keep-alive' });
            let buf = '';
            up.on('data', chunk => {
              buf += chunk.toString();
              let lines = buf.split('\n');
              buf = lines.pop();
              for (let line of lines) {
                line = line.trim();
                if (!line) { res.write('\n'); continue; }
                // pass through event: lines
                if (line.startsWith('event:')) { res.write(line + '\n'); continue; }
                let converted = convertChunk(line, model, reqId);
                if (converted) res.write(converted);
              }
            });
            up.on('end', () => {
              if (buf.trim()) { let c = convertChunk(buf.trim(), model, reqId); if (c) res.write(c); }
              if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
            });
            stats.ok++;
            logReq('POST', '/v1/chat/completions', 200, `${$.d}stream${$.r}  ${$.vio}${S.arr}oai${$.r}  ${$.mute}${model}${$.r}`);
            return;
          }

          // non-stream — internally stream and collect, retry through whole pool on limit
          let r = await streamCollect(`${ROUTER}/v1/messages?beta=true`, hdrs(key.key), wrapBody(aBody));
          let activeNow = key;
          while (isLimitErr(r.status, r.body)) {
            let next = rotate(activeNow.key);
            if (!next) break;
            activeNow = next;
            r = await streamCollect(`${ROUTER}/v1/messages?beta=true`, hdrs(next.key), wrapBody(aBody));
          }
          if (r.body?.usage) { stats.tokIn += r.body.usage?.input_tokens||0; stats.tokOut += r.body.usage?.output_tokens||0; }
          let oai = r.status < 300 ? toOpenAI(r.body, model) : r.body;
          stats.ok++;
          logReq('POST', '/v1/chat/completions', r.status, `${$.vio}${S.arr}oai${$.r}  ${$.mute}${model}  ${Date.now()-t0}ms${$.r}`);
          res.writeHead(r.status < 300 ? 200 : r.status, json());
          res.end(JSON.stringify(oai));
          return;
        }

        // --- /responses and /v1/responses (openai responses api — codex) ---
        if (req.url === '/responses' || req.url === '/v1/responses') {
          let aBody = responsesToAnthropic(body);
          let model = body.model || 'bonsai';
          let respId = 'resp_' + Math.random().toString(36).slice(2,14);

          if (isStream) {
            let up = await fwd(`${ROUTER}/v1/messages?beta=true`, { method:'POST', headers: hdrs(key.key), body: JSON.stringify(wrapBody(aBody)), pipe: true, timeout: 300000 });
            if (up.statusCode >= 400) {
              let errBuf = '';
              up.on('data', c => errBuf += c);
              up.on('end', () => {
                if (errBuf.includes('daily token limit')) rotate(key.key);
                stats.errs++;
                logReq('POST', req.url, up.statusCode, `${$.red}error${$.r}`);
                res.writeHead(up.statusCode, json()); res.end(errBuf);
              });
              return;
            }
            res.writeHead(200, { ...corsH, 'content-type':'text/event-stream', 'cache-control':'no-cache', 'connection':'keep-alive' });
            let buf = '';
            up.on('data', chunk => {
              buf += chunk.toString();
              let lines = buf.split('\n');
              buf = lines.pop();
              for (let line of lines) {
                line = line.trim();
                if (!line) continue; // don't pass empty lines — convertResponsesChunk adds its own
                if (line.startsWith('event:')) continue; // skip anthropic event lines — we generate our own
                let converted = convertResponsesChunk(line, model, respId);
                if (converted) res.write(converted);
              }
            });
            up.on('end', () => {
              if (buf.trim()) { let c = convertResponsesChunk(buf.trim(), model, respId); if (c) res.write(c); }
              if (!res.writableEnded) res.end();
            });
            stats.ok++;
            logReq('POST', req.url, 200, `${$.d}stream${$.r}  ${$.orn}${S.arr}responses${$.r}  ${$.mute}${model}${$.r}`);
            return;
          }

          // non-stream — full pool retry on limit
          let r = await streamCollect(`${ROUTER}/v1/messages?beta=true`, hdrs(key.key), wrapBody(aBody));
          let activeNow = key;
          while (isLimitErr(r.status, r.body)) {
            let next = rotate(activeNow.key);
            if (!next) break;
            activeNow = next;
            r = await streamCollect(`${ROUTER}/v1/messages?beta=true`, hdrs(next.key), wrapBody(aBody));
          }
          if (r.body?.usage) { stats.tokIn += r.body.usage?.input_tokens||0; stats.tokOut += r.body.usage?.output_tokens||0; }
          let resp = r.status < 300 ? toResponses(r.body, model) : r.body;
          stats.ok++;
          logReq('POST', req.url, r.status, `${$.orn}${S.arr}responses${$.r}  ${$.mute}${model}  ${Date.now()-t0}ms${$.r}`);
          res.writeHead(r.status < 300 ? 200 : r.status, json());
          res.end(JSON.stringify(resp));
          return;
        }

        // --- anything else: blind proxy ---
        let r = await fwd(`${ROUTER}${req.url}`, { method: req.method, headers: hdrs(key.key), body: raw || undefined });
        logReq(req.method, req.url, r.status, `${$.mute}passthrough${$.r}`);
        res.writeHead(r.status, json());
        res.end(typeof r.body === 'string' ? r.body : JSON.stringify(r.body));

      } catch (e) {
        stats.errs++;
        logReq(req.method, req.url, 502, `${$.red}${e.message}${$.r}`);
        res.writeHead(502, json());
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(port, () => dashboard(port));
}

// -- dashboard --

function dashboard(port) {
  let key = activeKey();

  console.log('');
  console.log('');

  frame([
    grad('  \u25C6  B O N S A I   A P I', $.gr),
    `     ${$.mute}proxy server v${VER}${$.r}${ANON ? '   ' + $.vio + '[ANON]' + $.r : ''}`,
    '',
    `  ${$.grn}${S.dot}${$.r}  ${$.sub}listening${$.r}      ${$.w}${$.b}http://localhost:${port}${$.r}`,
    `  ${$.grn}${S.dot}${$.r}  ${$.sub}router${$.r}         ${$.blu}${ROUTER}${$.r}`,
    `  ${$.grn}${S.dot}${$.r}  ${$.sub}key${$.r}            ${key ? `${$.d}${maskKey(key.key)}${$.r}` : `${$.red}none${$.r}`}`,
    pool.length > 1 ? `  ${$.grn}${S.dot}${$.r}  ${$.sub}pool${$.r}           ${$.gld}${pool.length} keys${$.r} ${$.d}(auto-rotate)${$.r}` : null,
    '',
    `  ${$.b}${$.fg}endpoints${$.r}`,
    `  ${$.blu}POST${$.r}  ${$.fg}/v1/messages${$.r}            ${$.mute}anthropic native${$.r}`,
    `  ${$.vio}POST${$.r}  ${$.fg}/v1/chat/completions${$.r}    ${$.mute}openai compat${$.r}`,
    `  ${$.orn}POST${$.r}  ${$.fg}/responses${$.r}                ${$.mute}openai responses (codex)${$.r}`,
    `  ${$.gld}POST${$.r}  ${$.fg}/v1/messages/count_tokens${$.r}  ${$.mute}FREE pre-flight counter${$.r}`,
    `  ${$.sub}GET${$.r}   ${$.fg}/v1/models${$.r}`,
    `  ${$.sub}GET${$.r}   ${$.fg}/health${$.r}  ${$.fg}/stats${$.r}`,
  ].filter(Boolean), { title: 'BONSAI API', color: $.grn });

  console.log('');

  frame([
    `${$.b}${$.fg}curl (openai)${$.r}`,
    `  ${$.d}curl http://localhost:${port}/v1/chat/completions \\${$.r}`,
    `    ${$.d}-H "Content-Type: application/json" \\${$.r}`,
    `    ${$.d}-d '{"model":"bonsai","messages":[{"role":"user","content":"hi"}]}'${$.r}`,
    '',
    `${$.b}${$.fg}curl (anthropic)${$.r}`,
    `  ${$.d}curl http://localhost:${port}/v1/messages \\${$.r}`,
    `    ${$.d}-H "Content-Type: application/json" \\${$.r}`,
    `    ${$.d}-H "anthropic-version: 2023-06-01" \\${$.r}`,
    `    ${$.d}-d '{"model":"bonsai","max_tokens":1024,"messages":[{"role":"user","content":"hi"}]}'${$.r}`,
    '',
    `${$.b}${$.fg}python (openai sdk)${$.r}`,
    `  ${$.d}from openai import OpenAI${$.r}`,
    `  ${$.d}c = OpenAI(base_url="http://localhost:${port}/v1", api_key="x")${$.r}`,
    `  ${$.d}r = c.chat.completions.create(model="bonsai", messages=[{"role":"user","content":"hi"}])${$.r}`,
    '',
    `${$.b}${$.fg}env vars${$.r}`,
    `  ${$.d}${isWin ? 'set' : 'export'} OPENAI_BASE_URL=http://localhost:${port}/v1${$.r}`,
    `  ${$.d}${isWin ? 'set' : 'export'} OPENAI_API_KEY=anything${$.r}`,
  ], { title: 'USAGE', color: $.mute });

  console.log('');
  console.log(`  ${$.mute}requests will appear below${$.r}`);
  console.log('');
}

// -- shutdown --

function showStats() {
  let uptime = Math.floor((Date.now() - stats.started) / 1000);
  let h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60);
  console.log('');
  frame([
    `${$.sub}requests${$.r}    ${$.w}${$.b}${stats.reqs}${$.r}  ${$.mute}(${stats.ok} ok, ${stats.errs} err)${$.r}`,
    `${$.sub}tokens in${$.r}   ${$.gld}${fmtN(stats.tokIn)}${$.r}`,
    `${$.sub}tokens out${$.r}  ${$.gld}${fmtN(stats.tokOut)}${$.r}`,
    `${$.sub}uptime${$.r}      ${$.d}${h}h ${m}m${$.r}`,
    `${$.sub}saved${$.r}       ${$.grn}$${(((stats.tokIn/1e6)*3)+((stats.tokOut/1e6)*15)).toFixed(2)}${$.r} ${$.mute}(est. at direct pricing)${$.r}`,
  ], { title: 'SESSION', color: $.gld });
  console.log('');
}

process.on('SIGINT', () => { showStats(); process.exit(0); });
process.on('SIGTERM', () => { showStats(); process.exit(0); });

// -- main --

async function main() {
  let args = process.argv.slice(2);
  let port = 4000;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-p' || args[i] === '--port') && args[i+1]) { port = parseInt(args[i+1]); i++; }
    else if (/^\d{2,5}$/.test(args[i])) port = parseInt(args[i]);
    else if (args[i] === '-k' || args[i] === '--key') { process.env.BONSAI_API_KEY = args[++i]; }
    else if (args[i] === '-h' || args[i] === '--help') {
      console.log(`
  ${$.b}bonsai api proxy${$.r} ${$.d}v${VER}${$.r}

  ${$.sub}usage:${$.r}  node api.js [port] [options]

  ${$.sub}options:${$.r}
    -p, --port <n>     port  ${$.mute}(default: 4000)${$.r}
    -k, --key <key>    bonsai api key
    -h, --help         this

  ${$.sub}env vars:${$.r}
    BONSAI_API_KEY       api key
    BONSAI_ROUTER_URL    router  ${$.mute}(default: go.trybons.ai)${$.r}

  ${$.sub}auto-loads keys from:${$.r} ~/.bonsai-oss/apikey.json + profiles/
  ${$.sub}auto-rotates on rate limit when multiple keys available${$.r}
`);
      process.exit(0);
    }
  }

  pool = getPool();

  if (!pool.length) {
    console.log('');
    err('no api key found');
    info(`set ${$.blu}BONSAI_API_KEY${$.r} env var`);
    info(`or run ${$.blu}bon login${$.r} + ${$.blu}bon keys${$.r} first`);
    info(`or pass ${$.blu}-k <your-key>${$.r}`);
    console.log('');
    process.exit(1);
  }

  if (!ccSystem) {
    warn('no system prompt cache found — router may reject requests');
    info(`run ${$.blu}bon start${$.r} once to capture it, or it will be captured automatically`);
    // auto-capture on first run: launch cc briefly
    info(`attempting auto-capture...`);
    try {
      const { spawn: sp2, execSync: ex2 } = await import('child_process');
      const tmpPort = 19111 + Math.floor(Math.random() * 1000);
      const captureScript = `const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');const s=http.createServer((q,r)=>{let b=[];q.on('data',c=>b.push(c));q.on('end',()=>{if(q.method==='POST'){try{let j=JSON.parse(Buffer.concat(b));if(j.system){fs.writeFileSync(path.join(os.homedir(),'.bonsai-oss','cc_system.json'),JSON.stringify(j.system));}}catch{}}r.writeHead(200,{'content-type':'application/json'});r.end(JSON.stringify({id:'m',type:'message',role:'assistant',content:[{type:'text',text:'ok'}],model:'t',usage:{input_tokens:1,output_tokens:1}}))});});s.listen(${tmpPort},()=>{});setTimeout(()=>process.exit(0),30000);`;
      const srv = sp2('node', ['-e', captureScript], { stdio: 'pipe' });
      await new Promise(r => setTimeout(r, 2000));
      const k = pool[0]?.key || '';
      try {
        ex2(`npx --yes @bonsai-ai/claude-code@latest --print "hi"`, {
          env: { ...process.env, ANTHROPIC_BASE_URL: `http://localhost:${tmpPort}`, ANTHROPIC_AUTH_TOKEN: k },
          timeout: 30000, stdio: 'pipe',
        });
      } catch {}
      srv.kill();
      await new Promise(r => setTimeout(r, 500));
      try { ccSystem = JSON.parse(fs.readFileSync(path.join(cfgDir, 'cc_system.json'), 'utf8')); } catch {}
      if (ccSystem) {
        ok('system prompt captured');
      } else {
        warn(`auto-capture failed \u2014 run ${$.blu}bon start${$.r} once manually`);
      }
    } catch { warn('auto-capture failed'); }
  }

  // daily limit reset check
  let today = new Date().toISOString().slice(0,10);
  setInterval(() => {
    let d = new Date().toISOString().slice(0,10);
    if (d !== today) { limited.clear(); today = d; console.log(`  ${$.grn}${S.chk}${$.r} ${$.d}daily limits reset${$.r}`); }
  }, 60000);

  serve(port);
}

main();
