#!/usr/bin/env node
// Local store dashboard: fetches current numbers from each store, appends a daily
// snapshot to dashboard/data/history.json, and writes dashboard/data/dashboard.html.
//
// Usage: npm run dashboard            (collect + open)
//        npm run dashboard -- --no-open
//
// Sources:
//   Firefox  - AMO public API (exact average daily users, weekly downloads, ratings)
//   Chrome   - public store page (user count is ROUNDED by Google). For exact weekly
//              users, export the Users CSV from the Chrome dashboard into
//              dashboard/data/chrome-csv/ - it takes precedence for those dates.
//   Edge     - set edgeStoreUrl in dashboard/data/config.json once the listing exists.
//   GitHub   - which store secrets are configured (names only, via `gh secret list`).
//
// dashboard/data/ is git-ignored: history and your task list stay on this machine.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');
const CSV_DIR = path.join(DATA, 'chrome-csv');
const REPO = 'smadgulkar/research-extension';
const CHROME_URL = 'https://chromewebstore.google.com/detail/research-assistant/idkghcjlmgaiodkjgfcfijjkdcoakanl';
const AMO_API = 'https://addons.mozilla.org/api/v5/addons/addon/research-assistant/';
const AMO_URL = 'https://addons.mozilla.org/en-US/firefox/addon/research-assistant/';
const today = new Date().toISOString().slice(0, 10);

const readJson = async (file, fallback) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback);
const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'research-assistant-dashboard', 'Accept-Language': 'en-US' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Store HTML -> flat text with " | " separators collapsed, for robust regexes.
function pageText(html) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' | ')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(\s*\|\s*)+/g, ' | ');
}

const num = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')));

async function collectChrome() {
  const t = pageText(await fetchText(CHROME_URL));
  const users = t.match(/\|\s*([\d,]+)\+?\s+users?\s*\|/i);
  const rating = t.match(/\|\s*(\d(?:\.\d)?)\s*\|\s*\(\s*\|\s*([\d,]+)\s+ratings?\s*\|\s*\)/i);
  const version = t.match(/\|\s*Version\s*\|\s*([\d.]+)\s*\|/i);
  const updated = t.match(/\|\s*Updated\s*\|\s*([A-Z][a-z]+ \d{1,2}, \d{4})\s*\|/);
  if (!users && !version) throw new Error('Store page layout not recognised (no users/version found)');
  return {
    usersShown: num(users?.[1]),
    rating: rating ? Number(rating[1]) : null,
    ratingCount: rating ? num(rating[2]) : 0,
    version: version?.[1] ?? null,
    updated: updated?.[1] ?? null,
  };
}

async function collectFirefox() {
  const d = JSON.parse(await fetchText(AMO_API));
  return {
    users: d.average_daily_users,
    weeklyDownloads: d.weekly_downloads,
    rating: d.ratings?.count ? d.ratings.average : null,
    ratingCount: d.ratings?.count ?? 0,
    version: d.current_version?.version ?? null,
    status: d.status,
    screenshots: (d.previews || []).length,
    updated: d.last_updated?.slice(0, 10) ?? null,
  };
}

async function collectEdge(config) {
  if (!config.edgeStoreUrl) return { listed: false };
  const t = pageText(await fetchText(config.edgeStoreUrl));
  const users = t.match(/\|\s*([\d,]+)\+?\s+users?\s*\|/i);
  const version = t.match(/Version\s*\|?\s*([\d.]+)/i);
  return { listed: true, usersShown: num(users?.[1]), version: version?.[1] ?? null };
}

function collectSecrets() {
  try {
    const out = execFileSync('gh', ['secret', 'list', '--repo', REPO, '--json', 'name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out).map((s) => s.name);
  } catch {
    return null; // gh missing or not logged in
  }
}

// Tolerant parser for the Chrome dashboard "Users" CSV export: finds a date column
// and the weekly-users column by header name. Returns { 'YYYY-MM-DD': users }.
function parseChromeCsv(text) {
  const rows = text.trim().split(/\r?\n/).map((line) => {
    const cells = []; let cur = ''; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  });
  const header = rows[0].map((h) => h.toLowerCase());
  const dateCol = header.findIndex((h) => h.includes('date') || h === 'day' || h === 'week');
  let usersCol = header.findIndex((h) => /user/.test(h) && !/region|language|os|version|enabled|disabled/.test(h));
  if (usersCol === -1) usersCol = header.length > 1 ? 1 : -1;
  if (dateCol === -1 || usersCol === -1) return {};
  const out = {};
  for (const r of rows.slice(1)) {
    const d = new Date(r[dateCol]);
    const v = num(r[usersCol]);
    if (!isNaN(d) && Number.isFinite(v)) out[d.toISOString().slice(0, 10)] = v;
  }
  return out;
}

async function readChromeCsvs() {
  if (!existsSync(CSV_DIR)) return { points: {}, files: [] };
  const files = (await readdir(CSV_DIR)).filter((f) => f.toLowerCase().endsWith('.csv'));
  const points = {};
  for (const f of files) Object.assign(points, parseChromeCsv(await readFile(path.join(CSV_DIR, f), 'utf8')));
  return { points, files };
}

const DEFAULT_TASKS = [
  { id: 'release-201', title: 'Release 2.0.1 (new icon, rating prompt, UI fixes)', auto: 'Done when both stores show version 2.0.1 or later',
    steps: ['Wait until the Chrome listing review clears (new icon visible on the store page)', 'Run: npm run release -- patch', 'Watch https://github.com/smadgulkar/research-extension/actions'] },
  { id: 'edge-listing', title: 'Create the Microsoft Edge listing', auto: 'Done when edgeStoreUrl is set in dashboard/data/config.json',
    steps: ['Do this from home, not the work computer', 'Register (free): https://partner.microsoft.com/dashboard/microsoftedge', 'Create new extension, upload research-assistant-chrome-<version>.zip from the latest GitHub Release', 'Reuse STORE_LISTING.md text, the 5 screenshots, the privacy answers from Chrome, privacy URL https://github.com/smadgulkar/research-extension/blob/main/PRIVACY.md', 'When live, put its store URL in dashboard/data/config.json as edgeStoreUrl'] },
  { id: 'edge-secrets', title: 'Add Edge publishing secrets', auto: 'Done when EDGE_CLIENT_ID, EDGE_API_KEY and EDGE_PRODUCT_ID exist in GitHub',
    steps: ['Partner Center -> Microsoft Edge -> Publish API -> Enable -> Create API credentials', 'Add EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID at https://github.com/smadgulkar/research-extension/settings/secrets/actions', 'Calendar reminder for the API key expiry date'] },
  { id: 'amo-screenshots', title: 'Firefox listing screenshots', auto: 'Done when the AMO listing has screenshots',
    steps: ['https://addons.mozilla.org/developers/addons -> Research Assistant -> Edit Product Page -> upload docs/screenshots/*.png'] },
  { id: 'bing', title: 'Submit site to Bing Webmaster Tools (feeds ChatGPT search)', manual: true,
    steps: ['https://www.bing.com/webmasters -> add https://smadgulkar.github.io/research-extension/', 'Submit sitemap: https://smadgulkar.github.io/research-extension/sitemap.xml'] },
  { id: 'gsc', title: 'Submit site to Google Search Console', manual: true,
    steps: ['https://search.google.com/search-console -> URL prefix https://smadgulkar.github.io/research-extension/', 'Submit sitemap.xml'] },
  { id: 'alternativeto', title: 'Finish the AlternativeTo listing', manual: true,
    steps: ['Use the draft text from the Claude session (name, description, alternatives: Glasp, Merlin, Readwise Reader, Sider)'] },
  { id: 'landing-check', title: 'Check the landing page loads (off the work network)', manual: true,
    steps: ['Open https://smadgulkar.github.io/research-extension/ on your phone'] },
];

const versionAtLeast = (v, min) => {
  if (!v) return false;
  const a = v.split('.').map(Number); const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
  return true;
};

function autoStatus(task, snap, secrets, config) {
  switch (task.id) {
    case 'release-201': return versionAtLeast(snap.chrome?.version, '2.0.1') && versionAtLeast(snap.firefox?.version, '2.0.1');
    case 'edge-listing': return Boolean(config.edgeStoreUrl);
    case 'edge-secrets': return secrets ? ['EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID'].every((s) => secrets.includes(s)) : null;
    case 'amo-screenshots': return snap.firefox ? snap.firefox.screenshots > 0 : null;
    default: return null;
  }
}

async function main() {
  await mkdir(CSV_DIR, { recursive: true });
  const config = await readJson(path.join(DATA, 'config.json'), { edgeStoreUrl: '' });
  if (!existsSync(path.join(DATA, 'config.json'))) await writeJson(path.join(DATA, 'config.json'), config);
  let tasks = await readJson(path.join(DATA, 'tasks.json'), null);
  if (!tasks) {
    tasks = DEFAULT_TASKS.map((t) => ({ ...t, done: false }));
    await writeJson(path.join(DATA, 'tasks.json'), tasks);
  }

  const errors = {};
  const attempt = async (name, fn) => { try { return await fn(); } catch (e) { errors[name] = e.message; return null; } };
  const [chrome, firefox, edge] = await Promise.all([
    attempt('chrome', collectChrome),
    attempt('firefox', collectFirefox),
    attempt('edge', () => collectEdge(config)),
  ]);
  const secrets = collectSecrets();
  const csv = await readChromeCsvs();

  const history = await readJson(path.join(DATA, 'history.json'), []);
  const snap = { date: today, takenAt: new Date().toISOString(), chrome, firefox, edge };
  const prev = history.filter((h) => h.date !== today);
  // Keep the last good value for a store if today's fetch failed.
  const last = prev[prev.length - 1];
  if (!chrome && last?.chrome) snap.chrome = { ...last.chrome, stale: last.date };
  if (!firefox && last?.firefox) snap.firefox = { ...last.firefox, stale: last.date };
  const newHistory = [...prev, snap].sort((a, b) => a.date.localeCompare(b.date));
  await writeJson(path.join(DATA, 'history.json'), newHistory);

  const taskView = tasks.map((t) => {
    const auto = autoStatus(t, snap, secrets, config);
    return { ...t, done: auto === null ? Boolean(t.done) : auto, autoChecked: auto !== null };
  });

  const model = {
    generatedAt: new Date().toISOString(),
    latest: snap, history: newHistory, chromeCsv: csv.points, chromeCsvFiles: csv.files,
    secrets, errors, tasks: taskView,
    links: { chrome: CHROME_URL, firefox: AMO_URL, edge: config.edgeStoreUrl || null },
  };
  const template = await readFile(path.join(HERE, 'template.html'), 'utf8');
  const html = template.replace('/*__DATA__*/null', JSON.stringify(model).replace(/</g, '\\u003c'));
  const out = path.join(DATA, 'dashboard.html');
  await writeFile(out, html);

  const fmt = (v) => (v == null ? 'n/a' : v);
  console.log(`Chrome : ${fmt(snap.chrome?.usersShown)} users (store page, rounded)${Object.keys(csv.points).length ? `, ${Object.keys(csv.points).length} exact points from CSV` : ''} | v${fmt(snap.chrome?.version)}`);
  console.log(`Firefox: ${fmt(snap.firefox?.users)} daily users | ${fmt(snap.firefox?.weeklyDownloads)} downloads/wk | v${fmt(snap.firefox?.version)}`);
  console.log(`Edge   : ${snap.edge?.listed ? `${fmt(snap.edge.usersShown)} users` : 'not listed yet'}`);
  for (const [k, v] of Object.entries(errors)) console.log(`! ${k}: ${v}`);
  console.log(`Open tasks: ${taskView.filter((t) => !t.done).length}`);
  console.log(`Dashboard: ${out}`);
  if (!process.argv.includes('--no-open')) {
    exec(process.platform === 'win32' ? `start "" "${out}"` : process.platform === 'darwin' ? `open "${out}"` : `xdg-open "${out}"`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
