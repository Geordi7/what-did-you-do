import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('..', import.meta.url));
const label = process.argv[2] ?? 'measurement';
const server = spawn(process.execPath, [project + '/node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'], { cwd: project, stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:5186')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Benchmark server did not start');
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const size of [20000, 60000]) {
    const page = await browser.newPage();
    await page.addInitScript(size => {
      localStorage.clear();
      const days = {};
      for (let offset = 0; offset < size; offset++) {
        const date = new Date(2026, 9, 18 - offset);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        days[key] = offset % 9 + 1;
      }
      localStorage.setItem('achievement-calendars', JSON.stringify({ version: 5, theme: 'light', calendars: [{ id: 'benchmark', name: 'Benchmark', days, activityValue: 1, color: '#40c463', updatedAt: '2026-10-18T00:00:00.000Z' }] }));
    }, size);
    await page.goto('http://127.0.0.1:5186');
    await page.waitForFunction(() => window.__store !== undefined && document.querySelectorAll('.cell').length === 182);
    for (const range of ['28d', '26w']) {
      await page.evaluate(range => { window.__store.setChartRange(range); window.__store.incrementDay('benchmark', '2026-10-18'); }, range);
      const session = await page.context().newCDPSession(page);
      await session.send('HeapProfiler.collectGarbage');
      await session.send('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      const times = await page.evaluate(() => {
        const times = [];
        for (let i = 0; i < 12; i++) {
          const start = performance.now();
          window.__store.incrementDay('benchmark', '2026-10-18');
          times.push(performance.now() - start);
        }
        return times.sort((a, b) => a - b);
      });
      const { profile } = await session.send('HeapProfiler.stopSampling');
      const allocated = profile.samples.reduce((sum, sample) => sum + sample.size, 0);
      results.push({ size, range, mutations: times.length, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.ceil(times.length * 0.95) - 1], sampledAllocatedBytes: allocated });
      await session.detach();
    }
    await page.close();
  }
  await writeFile(`/private/tmp/zed-0005-${label}-performance.json`, JSON.stringify({ label, measuredAt: new Date().toISOString(), environment: 'Local Chromium, Vite dev server, one calendar; twelve synchronous mutations after one warmup; CDP allocation sampling at 32 KiB including collected objects', results }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
