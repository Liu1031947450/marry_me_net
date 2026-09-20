import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function capture(page, baseUrl) {
  const assets = new URL('./assets/', import.meta.url);
  await mkdir(assets, { recursive: true });
  const screenshot = (name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, assets)) });
  const saveCanvas = async (name) => {
    const data = await page.evaluate(() => document.querySelector('.game-canvas').toDataURL('image/png').split(',')[1]);
    await writeFile(new URL(`${name}.png`, assets), Buffer.from(data, 'base64'));
  };
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1200, height: 820, deviceScaleFactor: 1, mobile: false });
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto(baseUrl);
  await page.waitForSelector('.start-button');
  await screenshot('start');
  await page.click('.start-button');
  await page.waitForSelector('.game-canvas');
  await page.waitForFunction(() => !document.querySelector('.music-toggle').disabled);
  if (await page.evaluate(() => document.querySelector('.music-toggle').getAttribute('aria-pressed') === 'true')) await page.click('.music-toggle');
  const journeys = [];
  for (let roomIndex = 0; roomIndex < 4; roomIndex += 1) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await saveCanvas(`season-${roomIndex}`);
    if (roomIndex === 0) {
      await screenshot('desktop');
      await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
      await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await screenshot('mobile');
      await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1200, height: 820, deviceScaleFactor: 1, mobile: false });
      await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    const journey = await page.evaluate(async (index) => {
      const { ROOMS, createJourney, advanceJourney } = await import('/src/game.ts');
      const journey = createJourney(index);
      const points = ROOMS[index].points;
      let clicks = 0;
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        const start = points[pointIndex - 1];
        const end = points[pointIndex];
        const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2);
        for (let step = 1; step <= steps && !journey.completed; step += 1) {
          const target = { x: start.x + (end.x - start.x) * step / steps, y: start.y + (end.y - start.y) * step / steps };
          while (Math.hypot(target.x - journey.position.x, target.y - journey.position.y) > 2.5 && !journey.completed) {
            if (clicks++ > 2000) throw new Error(`Cannot finish room ${index}`);
            const horizontal = target.x - journey.position.x;
            const vertical = target.y - journey.position.y;
            const direction = Math.abs(horizontal) > Math.abs(vertical) ? (horizontal > 0 ? 'right' : 'left') : (vertical > 0 ? 'down' : 'up');
            document.querySelector(`[data-direction="${direction}"]`).click();
            if (!advanceJourney(index, journey, [direction], 0.05)) throw new Error(`Blocked in room ${index}`);
          }
        }
      }
      return { completed: journey.completed, percent: journey.percent, hasKey: journey.hasKey, trace: journey.trace };
    }, roomIndex);
    assert.equal(journey.completed, true, `Room ${roomIndex}`);
    assert.equal(journey.percent, 100);
    assert.equal(journey.hasKey, true);
    journeys.push(journey);
    console.log(`Captured and completed season ${roomIndex + 1}`);
    if (roomIndex < 3) {
      await page.waitForSelector('.room-complete-message');
      await page.click(`text="${['去夏日池畔', '去秋日果园', '去冬日暖屋'][roomIndex]}"`);
      await page.waitForFunction((index) => document.querySelector('.scene-coordinates')?.textContent.includes(String(index + 2).padStart(2, '0')), roomIndex);
    }
  }
  await writeFile(new URL('journeys.json', assets), JSON.stringify(journeys));
  await page.waitForSelector('.yes-button');
  await screenshot('proposal');
  await page.click('.yes-button');
  await page.waitForSelector('.is-success');
  await page.evaluate(() => { document.querySelector('.promise-date').textContent = '纪念日期 · 演示画面'; });
  await screenshot('success');
  await page.click('text="看看我们的照片墙"');
  await page.waitForSelector('.photo-wall');
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.photo-open{position:relative;background:repeating-linear-gradient(45deg,#c6cebc,#c6cebc 16px,#dce1d1 16px,#dce1d1 32px)!important}.photo-open img{visibility:hidden!important}.photo-open::after{content:"私人照片 · 已隐藏";position:absolute;inset:0;display:grid;place-items:center;color:#57684e;font-size:17px;font-weight:700}.photo-memory figcaption{visibility:hidden}';
    document.head.append(style);
  });
  await screenshot('photos-private');
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  await page.cdp('Emulation.setEmulatedMedia', { features: [] });
  console.log('PASS: 4 completed rooms, actual UI screenshots, no personal photos or dates exported');
}
