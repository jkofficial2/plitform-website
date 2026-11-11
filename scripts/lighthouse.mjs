import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

await mkdir('reports', { recursive: true });
const servers = [];
async function ensureServer(port, live) {
  try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return; } catch { /* Start our own static preview. */ }
  servers.push(spawn(process.execPath, ['scripts/serve.mjs', '--port', String(port), ...(live ? ['--live'] : [])], { stdio: 'ignore' }));
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return; } catch { /* Not ready yet. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Static server ${port} did not start`);
}
function command(args) {
  return new Promise((resolveCommand, reject) => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...(existsSync(chrome) ? { CHROME_PATH: chrome } : {}) } });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveCommand() : reject(new Error(`Lighthouse exited with ${code}`)));
  });
}
const entries = [
  { mode: 'demo', slug: 'home', path: '/', port: 4321 },
  ...[['home', '/'], ['catalog', '/produktsiya/'], ['road', '/produktsiya/dorozhnye-plity/'], ['floor', '/produktsiya/plity-perekrytiy/'], ['custom', '/produktsiya/plity-po-spetsifikatsii/'], ['contacts', '/kontakty/']].map(([slug, path]) => ({ mode: 'live', slug, path, port: 4322 })),
];
const summary = [];
try {
  await ensureServer(4321, false);
  await ensureServer(4322, true);
  for (const entry of entries) {
    const name = `lighthouse-${entry.mode}-${entry.slug}`;
    console.log(`Mobile Lighthouse: ${entry.mode} ${entry.path}`);
    await command([resolve('node_modules/lighthouse/cli/index.js'), `http://127.0.0.1:${entry.port}${entry.path}`, '--chrome-flags=--headless --disable-gpu --no-first-run', '--only-categories=performance,accessibility,best-practices,seo', '--output=json', '--output=html', `--output-path=${resolve('reports', name)}`, '--quiet']);
    const report = JSON.parse(await readFile(`reports/${name}.report.json`, 'utf8'));
    if (report.runtimeError) throw new Error(JSON.stringify(report.runtimeError));
    const scores = Object.fromEntries(Object.entries(report.categories).map(([key, category]) => [key, Math.round(category.score * 100)]));
    const metrics = Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift'].map(key => [key, report.audits[key].numericValue]));
    const failures = Object.values(report.audits).filter(audit => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'informative' && audit.scoreDisplayMode !== 'notApplicable').map(audit => ({ id: audit.id, title: audit.title, score: audit.score, displayValue: audit.displayValue }));
    const result = { ...entry, scores, metrics, failures, lighthouseVersion: report.lighthouseVersion, fetchTime: report.fetchTime, report: `reports/${name}.report.html` };
    summary.push(result);
    console.log(JSON.stringify({ path: entry.path, mode: entry.mode, scores, metrics }));
  }
  await writeFile('reports/lighthouse-summary.json', JSON.stringify(summary, null, 2));
} finally {
  for (const server of servers) server.kill();
}
