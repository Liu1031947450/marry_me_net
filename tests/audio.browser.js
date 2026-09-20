export async function verifyStartMenu(page, baseUrl = 'http://localhost:5173/') {
  const assert = (await import('node:assert/strict')).default;

  async function freshGame() {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.start-button');
    assert.equal(await page.evaluate(() => document.querySelector('.game-canvas')), null);
    assert.equal(await page.evaluate(() => document.querySelector('.music-toggle').getAttribute('aria-pressed')), 'false');
    await page.evaluate(() => {
      window.audioProbe = { resumes: 0, context: null, fail: false };
      const resume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = function () {
        window.audioProbe.resumes += 1;
        window.audioProbe.context = this;
        return window.audioProbe.fail ? Promise.reject(new Error('Audio unavailable')) : resume.call(this);
      };
    });
  }

  async function walk() {
    await page.waitForSelector('.game-canvas');
    await page.keyboard.down('s');
    try {
      await page.waitForFunction(() => Number(document.querySelector('.room-status strong').textContent.replace('%', '')) >= 5, undefined, { timeout: 5000 });
    } finally {
      await page.keyboard.up('s');
    }
  }

  async function checkSound(enabled, resumes) {
    await page.waitForFunction((expected) => {
      const button = document.querySelector('.music-toggle');
      return !button.disabled && button.getAttribute('aria-pressed') === String(expected);
    }, enabled, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.audioProbe.resumes), resumes);
    if (enabled) assert.equal(await page.evaluate(() => window.audioProbe.context.state), 'running');
  }

  await freshGame();
  console.log(await page.snapshot());
  await page.keyboard.press('s');
  assert.equal(await page.evaluate(() => document.querySelector('.game-canvas')), null);
  await checkSound(false, 0);
  await page.click('button[aria-label="玩法说明"]');
  await page.keyboard.press('s');
  await checkSound(false, 0);
  await page.keyboard.press('Escape');
  await page.click('.start-button');
  await walk();
  await checkSound(true, 1);
  await page.click('.music-toggle');
  await page.click('button[aria-label="重新开始"]');
  console.log(await page.snapshot());
  await page.click('text="重新出发"');
  await walk();
  await checkSound(false, 1);

  await freshGame();
  await page.click('.music-toggle');
  await checkSound(true, 1);
  await page.click('.music-toggle');
  await page.click('.start-button');
  await walk();
  await checkSound(false, 1);

  await freshGame();
  await page.evaluate(() => { window.audioProbe.fail = true; });
  await page.click('.start-button');
  await walk();
  await checkSound(false, 1);
  await page.waitForSelector('.sound-error');
  await page.keyboard.press('w');
  await checkSound(false, 1);
  await page.evaluate(() => { window.audioProbe.fail = false; });
  await page.click('.music-toggle');
  await checkSound(true, 2);
  await page.waitForSelector('.sound-error', { state: 'hidden' });

  await freshGame();
  await page.focus('.start-button');
  await page.keyboard.press('Enter');
  await walk();
  await checkSound(true, 1);

  await freshGame();
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 600], [390, 844], [375, 667], [320, 568], [844, 390], [667, 375]]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const layout = await page.evaluate(() => {
      const visible = ['.site-header', '.start-menu', '.start-menu h2', '.start-button', '.start-description', '.start-instructions', '.start-music-note'];
      const clipped = visible.filter((selector) => {
        const bounds = document.querySelector(selector).getBoundingClientRect();
        return bounds.width <= 0 || bounds.height <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > innerWidth + 1 || bounds.bottom > innerHeight + 1;
      });
      return { clipped, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight };
    });
    assert.deepEqual(layout.clipped, [], `${width}×${height}`);
    assert.ok(layout.scrollWidth <= width && layout.scrollHeight <= height, `${width}×${height}: scrollbars`);
  }

  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
  await freshGame();
  console.log(await page.snapshot());
  const point = await page.evaluate(() => {
    const bounds = document.querySelector('.start-button').getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  });
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await checkSound(false, 0);
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await checkSound(false, 0);
  assert.equal(await page.evaluate(() => document.querySelector('.game-canvas')), null);
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForSelector('.game-canvas');
  await checkSound(true, 1);
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  console.log('PASS: start menu, mouse/keyboard/touch activation, persistent mute, audio failure/retry, 9 single-screen viewports');
}
