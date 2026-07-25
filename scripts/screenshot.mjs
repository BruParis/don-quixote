import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] ?? '/tmp/claude-1000/-home-brnprs-don-quixote/f5624109-5234-4c3a-b89b-cac4a4d561a0/scratchpad/shots';
const URL = 'http://localhost:5199/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb']
});
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 640 });

// unlock everything so all maps are reachable
await page.goto(URL);
await page.evaluate(() => {
  localStorage.setItem(
    'dq-progress',
    JSON.stringify({
      completedTriggers: ['sobrina', 'barbero', 'cura', 'moza', 'ventero', 'sancho', 'molino'],
      scores: {},
      showTranslations: true
    })
  );
});
await page.goto(URL, { waitUntil: 'networkidle0' });
await sleep(1500);
await page.screenshot({ path: `${OUT}/worldmap.png` });

const maps = [
  ['ep1', 'village', 'default'],
  ['ep1', 'house', 'entry'],
  ['ep2', 'inn_exterior', 'default'],
  ['ep2', 'inn_interior', 'entry'],
  ['ep3', 'windmills', 'default']
];

for (const [episodeId, mapId, spawn] of maps) {
  await page.evaluate(
    (episodeId, mapId, spawn) => {
      const game = window.game;
      const active = game.scene.getScenes(true)[0];
      active.scene.start('Episode', { episodeId, mapId, spawn });
    },
    episodeId,
    mapId,
    spawn
  );
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/${mapId}.png` });
}

const errors = await page.evaluate(() => window.__errors ?? []);
console.log('console errors:', JSON.stringify(errors));
await browser.close();
console.log('done');
