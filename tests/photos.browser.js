export async function verifyPhotoWall(page, baseUrl = 'http://localhost:5173/') {
  const assert = (await import('node:assert/strict')).default;
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(new URL('../public/img/', import.meta.url))).filter((file) => file.endsWith('.jpg')).sort();
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto(baseUrl);
  await page.waitForSelector('.start-button');
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.includes('/img/')).length), 0, 'photos are not requested from the start menu');
  await page.click('.start-button');
  await page.waitForSelector('.game-canvas');
  await page.waitForFunction(() => !document.querySelector('.music-toggle').disabled);
  if (await page.evaluate(() => document.querySelector('.music-toggle').getAttribute('aria-pressed') === 'true')) await page.click('.music-toggle');

  await page.waitForFunction((count) => performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.includes('/img/')).length === count, files.length, { timeout: 60000 });
  const photoUrls = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.includes('/img/')).map((entry) => entry.name));
  assert.deepEqual(photoUrls.map((url) => new URL(url).pathname.split('/').at(-1)).sort(), files);
  assert.equal(await page.evaluate(() => document.querySelector('.photo-wall')), null, 'preloading does not reveal the photo wall');
  await page.cdp('Network.enable');
  await page.cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  try {
    const cached = await page.evaluate((urls) => Promise.all(urls.map((src) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = src;
    }))), photoUrls);
    assert.ok(cached.every(Boolean), 'all photos can be loaded from cache before reaching the ending, even offline');
  } finally {
    await page.cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.cdp('Network.disable');
  }

  for (let roomIndex = 0; roomIndex < 4; roomIndex += 1) {
    const completed = await page.evaluate(async (index) => {
      const { ROOMS, createJourney, advanceJourney } = await import(new URL('src/game.ts', location.href).href);
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
      return journey.completed;
    }, roomIndex);
    assert.equal(completed, true, `Room ${roomIndex}`);
    if (roomIndex < 3) {
      await page.waitForSelector('.room-complete-message');
      await page.click(`text="${['去夏日池畔', '去秋日果园', '去冬日暖屋'][roomIndex]}"`);
      await page.waitForFunction((index) => document.querySelector('.scene-coordinates')?.textContent.includes(String(index + 2).padStart(2, '0')), roomIndex);
    }
  }

  await page.waitForSelector('.yes-button');
  await page.click('.yes-button');
  await page.waitForSelector('.is-success');
  assert.equal(await page.evaluate(() => document.querySelector('.ending-heading').textContent), '余生，请多指教。');
  assert.equal(await page.evaluate(() => document.querySelector('.photo-wall')), null);
  const love = await page.evaluate(() => document.querySelector('.love-word').innerHTML);

  async function checkLayout(selectors, width, height) {
    const clipped = await page.evaluate((targets) => targets.filter((selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return bounds.width <= 0 || bounds.height <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > innerWidth + 1 || bounds.bottom > innerHeight + 1;
    }), selectors);
    assert.deepEqual(clipped, [], `${width}×${height}: clipped elements`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
  }

  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 600], [390, 844], [375, 667], [320, 568], [844, 390], [667, 375]]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await checkLayout(['.is-success', '.ending-heading', '.love-word', '.couple-art', '.success-actions'], width, height);
    await page.click('text="看看我们的照片墙"');
    await page.waitForSelector('.photo-wall');
    await checkLayout(['.photo-wall', '#photo-wall-title', '.photo-back', '.photo-wall-scroll'], width, height);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'photo-wall-title');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.photo-grid')).gridTemplateColumns.split(' ').length), width <= 480 ? 1 : width <= 760 ? 2 : 3);
    assert.equal(await page.evaluate(() => document.querySelector('.photo-wall-scroll').scrollWidth <= document.querySelector('.photo-wall-scroll').clientWidth), true, `${width}×${height}: no horizontal scrolling`);
    assert.equal(await page.evaluate(() => {
      const board = document.querySelector('.photo-wall-scroll').getBoundingClientRect();
      const photos = [...document.querySelectorAll('.photo-memory')];
      return photos.every((photo) => {
        const bounds = photo.getBoundingClientRect();
        return bounds.left >= board.left && bounds.right <= board.right;
      }) && photos.filter((photo) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(photo).transform).b) > 0.01).length >= photos.length - 1;
    }), true, `${width}×${height}: tilted photos stay inside the board`);
    await page.focus('.photo-open >> nth=0');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.photo-preview');
    await checkLayout(['.photo-preview', '.photo-preview [id$="-title"]', '.photo-preview img', '.photo-preview button'], width, height);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.photo-preview > div')).clipPath), 'none');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.photo-preview', { state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('photo-open')), true);
    await page.click('.photo-back');
    await page.waitForSelector('.is-success');
    assert.equal(await page.evaluate(() => document.querySelector('.love-word').innerHTML), love);
  }

  await page.click('text="看看我们的照片墙"');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.photo-open img')].map((image) => new URL(image.src).pathname.split('/').at(-1)).sort()), files);
  for (let index = 0; index < files.length; index += 1) {
    await page.evaluate((photoIndex) => document.querySelectorAll('.photo-open')[photoIndex].scrollIntoView({ block: 'center' }), index);
    await page.waitForFunction((photoIndex) => {
      const image = document.querySelectorAll('.photo-open img')[photoIndex];
      return image.complete && image.naturalWidth > 0;
    }, index);
  }
  await page.click('button[aria-label="重新开始"]');
  await page.click('text="留在这里"');
  await page.waitForSelector('.photo-wall');
  await page.click('.photo-back');
  await page.click('text="再一起走一遍"');
  await page.click('text="重新出发"');
  await page.waitForSelector('.game-canvas');
  assert.equal(await page.evaluate(() => document.querySelector('.photo-wall')), null);
  assert.equal(await page.evaluate(() => document.querySelector('.scene-coordinates').textContent), '01 / 04');
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  await page.cdp('Emulation.setEmulatedMedia', { features: [] });
  console.log('PASS: start-triggered preload, offline photo cache, four rooms → yes → existing ending → photo wall → preview/back/restart, 7 images, keyboard, reduced motion, 9 viewports');
}
