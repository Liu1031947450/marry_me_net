export async function verifyJoystick(page, baseUrl = 'http://localhost:5173/') {
  const assert = (await import('node:assert/strict')).default;
  let touching = false;
  let geometry;

  async function touch(type, touchPoints = []) {
    await page.cdp('Input.dispatchTouchEvent', { type, touchPoints });
    touching = touchPoints.length > 0;
  }

  async function measure() {
    return page.evaluate(() => {
      const bounds = document.querySelector('.joystick').getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, radius: (bounds.width - document.querySelector('.joystick-thumb').offsetWidth) / 2 };
    });
  }

  function point(horizontal, vertical, id = 1) {
    return { x: geometry.x + horizontal * geometry.radius, y: geometry.y + vertical * geometry.radius, id };
  }

  async function sample(frames = 12) {
    return page.evaluate((count) => new Promise((resolve) => {
      const tick = () => {
        if (count-- > 0) requestAnimationFrame(tick);
        else resolve({ ...window.joystickProbe.position, time: performance.now() });
      };
      requestAnimationFrame(tick);
    }), frames);
  }

  async function expectStill(label) {
    const before = await sample(2);
    const after = await sample();
    assert.deepEqual([after.x, after.y], [before.x, before.y], label);
  }

  async function expectStopped(label) {
    await sample(2);
    const state = await page.evaluate(() => {
      const joystick = document.querySelector('.joystick');
      const transform = new DOMMatrixReadOnly(getComputedStyle(joystick.querySelector('.joystick-thumb')).transform);
      return { active: joystick.classList.contains('joystick-active'), horizontal: transform.m41, vertical: transform.m42 };
    });
    assert.deepEqual(state, { active: false, horizontal: 0, vertical: 0 }, `${label}: joystick must recenter`);
    await expectStill(label);
  }

  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.start-button');
  await page.evaluate(() => {
    const createGradient = CanvasRenderingContext2D.prototype.createRadialGradient;
    const probe = { position: null, pointerId: null };
    const recordPointer = (event) => {
      if (event.target.closest('.joystick')) probe.pointerId = event.pointerId;
    };
    CanvasRenderingContext2D.prototype.createRadialGradient = function (...args) {
      if (this.canvas.classList.contains('game-canvas')) probe.position = { x: args[0], y: args[1] };
      return createGradient.apply(this, args);
    };
    document.addEventListener('pointerdown', recordPointer);
    window.joystickProbe = probe;
    probe.restore = () => {
      CanvasRenderingContext2D.prototype.createRadialGradient = createGradient;
      document.removeEventListener('pointerdown', recordPointer);
      delete window.joystickProbe;
    };
  });

  try {
    await page.click('.start-button');
    await page.waitForSelector('.joystick');
    await page.waitForFunction(() => window.joystickProbe.position && !document.querySelector('.music-toggle').disabled);
    if (await page.evaluate(() => document.querySelector('.music-toggle').getAttribute('aria-pressed') === 'true')) await page.click('.music-toggle');
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
    geometry = await measure();
    const initial = await sample(1);

    async function restart() {
      if (touching) await touch('touchCancel');
      await page.click('button[aria-label="重新开始"]');
      await page.click('text="重新出发"');
      await page.waitForFunction((start) => window.joystickProbe.position.x === start.x && window.joystickProbe.position.y === start.y, initial);
      geometry = await measure();
      await expectStopped('restart clears all movement');
    }

    await touch('touchStart', [point(0, 0)]);
    await touch('touchMove', [point(0, 0.1)]);
    await expectStill('the center dead zone must not move the character');
    await touch('touchEnd');
    await expectStopped('release recenters the joystick');

    const speeds = [];
    for (const strength of [0.575, 1]) {
      await touch('touchStart', [point(0, 0)]);
      await touch('touchMove', [point(0, strength)]);
      const before = await sample(2);
      const after = await sample(14);
      speeds.push((after.y - before.y) / (after.time - before.time));
      await touch('touchEnd');
      await expectStopped('no movement after lifting the finger');
    }
    assert.ok(speeds[0] > 0 && speeds[1] > speeds[0] * 1.6 && speeds[1] < speeds[0] * 2.4, `half/full speed: ${speeds}`);

    await touch('touchStart', [point(0, 0)]);
    const beforeTurn = await sample(1);
    await touch('touchMove', [point(0.8, 0.6)]);
    const right = await sample(3);
    assert.ok(right.x > beforeTurn.x && right.y > beforeTurn.y, 'diagonal drag changes both axes');
    await touch('touchMove', [point(-0.8, 0.6)]);
    const left = await sample(3);
    assert.ok(left.x < right.x && left.y > right.y, 'one continuous touch can reverse direction');
    await touch('touchMove', [point(0, 3)]);
    const outside = await sample(3);
    assert.ok(outside.y > left.y, 'dragging beyond the base keeps moving');
    assert.equal(await page.evaluate(() => document.querySelector('.joystick').hasPointerCapture(window.joystickProbe.pointerId)), true);
    const offset = await page.evaluate(() => {
      const transform = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.joystick-thumb')).transform);
      return Math.hypot(transform.m41, transform.m42);
    });
    assert.ok(Math.abs(offset - geometry.radius) < 0.01, 'thumb stays within the base');
    await touch('touchCancel');
    await expectStopped('touch cancellation stops immediately');

    await restart();
    const primary = point(0, 1);
    const secondary = point(0, -1, 2);
    await touch('touchStart', [primary]);
    const beforeSecond = await sample(2);
    await touch('touchStart', [primary, secondary]);
    const afterSecond = await sample(4);
    assert.ok(afterSecond.y > beforeSecond.y, 'second finger cannot reverse the first');
    await touch('touchEnd', [secondary]);
    const afterSecondRelease = await sample(4);
    assert.ok(afterSecondRelease.y > afterSecond.y, 'releasing a second finger cannot stop the first');
    await touch('touchStart', [primary, secondary]);
    await touch('touchEnd', [primary]);
    await expectStopped('remaining finger cannot take over after primary release');
    await touch('touchMove', [point(0, 1, 2)]);
    await expectStopped('remaining finger must press again before moving');
    await touch('touchEnd');

    await touch('touchStart', [point(0, 0)]);
    await touch('touchMove', [point(0, 1)]);
    await sample(2);
    await page.evaluate(() => document.querySelector('.joystick').releasePointerCapture(window.joystickProbe.pointerId));
    await touch('touchMove', [point(0, 2)]);
    await expectStopped('lost pointer capture clears input');
    await touch('touchEnd');

    for (const eventName of ['blur', 'visibilitychange']) {
      await touch('touchStart', [point(0, 1)]);
      await sample(2);
      await page.evaluate((name) => (name === 'blur' ? window : document).dispatchEvent(new Event(name)), eventName);
      await expectStopped(`${eventName} clears input`);
      await touch('touchMove', [point(0, 1.1)]);
      await expectStopped(`${eventName} cannot resume a stale touch`);
      await touch('touchEnd');
    }

    await restart();
    await touch('touchStart', [point(0, 1)]);
    await page.click('button[aria-label="玩法说明"]');
    await page.waitForSelector('.help-step');
    assert.equal(await page.evaluate(() => document.querySelector('.joystick').getAttribute('aria-disabled')), 'true');
    await expectStopped('help pauses joystick movement');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.help-step', { state: 'hidden' });
    await touch('touchMove', [point(0, 1)]);
    await expectStopped('closing help requires a fresh press');
    await touch('touchEnd');

    await touch('touchStart', [point(0, 1)]);
    await page.click('button[aria-label="重新开始"]');
    await page.waitForSelector('text="留在这里"');
    await expectStopped('restart confirmation pauses movement');
    await page.click('text="重新出发"');
    await page.waitForFunction((start) => window.joystickProbe.position.y === start.y, initial);
    await touch('touchMove', [point(0, 1)]);
    await expectStopped('new game cannot inherit the old touch');
    await touch('touchEnd');

    await page.keyboard.down('s');
    try {
      await touch('touchStart', [point(0, 0)]);
      await expectStill('held joystick has priority even in the dead zone');
      const before = await sample(1);
      await touch('touchEnd');
      const after = await sample(4);
      assert.ok(after.y > before.y, 'keyboard resumes after releasing the joystick');
    } finally {
      await page.keyboard.up('s');
    }
    await expectStopped('releasing keyboard also stops movement');

    await touch('touchStart', [point(0, 1)]);
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await expectStopped('rotating the viewport clears input');
    await touch('touchMove', [point(0, 1)]);
    await expectStopped('rotation cannot resume a stale touch');
    await touch('touchEnd');

    for (const [width, height] of [[320, 568], [390, 844], [667, 375], [844, 390]]) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      const layout = await page.evaluate(() => {
        const selectors = ['.site-header', '.game-canvas', '.joystick', '.joystick-thumb', '.trail-notice', '.room-status'];
        const clipped = selectors.filter((selector) => {
          const bounds = document.querySelector(selector).getBoundingClientRect();
          return bounds.width <= 0 || bounds.height <= 0 || bounds.left < 0 || bounds.top < 0 || bounds.right > innerWidth + 1 || bounds.bottom > innerHeight + 1;
        });
        const scene = document.querySelector('.game-canvas').getBoundingClientRect();
        const stick = document.querySelector('.joystick').getBoundingClientRect();
        const controls = document.querySelector('.game-controls').getBoundingClientRect();
        return { clipped, size: stick.width, rightInset: controls.right - stick.right, overlaps: stick.left < scene.right && stick.right > scene.left && stick.top < scene.bottom && stick.bottom > scene.top, scrolls: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
      });
      assert.deepEqual(layout.clipped, [], `${width}×${height}: controls are visible`);
      assert.equal(layout.size, height < 500 ? 96 : 112);
      assert.ok(Math.abs(layout.rightInset) < 1, `${width}×${height}: joystick stays on the right-hand side`);
      assert.equal(layout.overlaps, false, `${width}×${height}: joystick must not cover the map`);
      assert.equal(layout.scrolls, false, `${width}×${height}: no page scrolling`);
      await page.focus('[data-direction="down"]');
      assert.equal(await page.evaluate(() => {
        const bounds = document.querySelector('.direction-pad').getBoundingClientRect();
        return bounds.width > 100 && bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight;
      }), true, `${width}×${height}: keyboard focus exposes direction buttons`);
      await page.focus('.game-canvas');
    }
    const accessibility = await page.cdp('Accessibility.getFullAXTree');
    for (const label of ['向上走', '向下走', '向左走', '向右走']) {
      assert.ok(accessibility.nodes.some((node) => !node.ignored && node.role?.value === 'button' && node.name?.value === label), `${label} remains available to screen readers`);
    }

    await restart();
    await touch('touchStart', [point(0, 1)]);
    await page.waitForFunction(() => window.joystickProbe.position.y >= 187.5, undefined, { polling: 16 });
    await touch('touchMove', [point(1, 0)]);
    await page.waitForSelector('.room-complete-message');
    await expectStopped('completing a room clears the held joystick');
    await page.click('text="去夏日池畔"');
    await page.waitForFunction(() => document.querySelector('.scene-coordinates').textContent.includes('02'));
    await touch('touchMove', [point(0, 1)]);
    await expectStopped('the next room cannot inherit the held finger');
    await touch('touchEnd');
    await restart();

    await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.joystick')).display), 'none');
    await page.focus('.game-canvas');
    for (const key of ['s', 'ArrowDown']) {
      const before = await sample(1);
      await page.keyboard.down(key);
      try {
        const after = await sample(4);
        assert.ok(after.y > before.y, `${key} still moves on desktop`);
      } finally {
        await page.keyboard.up(key);
      }
      await expectStill(`${key} release stops movement`);
    }
    const button = await page.evaluate(() => {
      const bounds = document.querySelector('[data-direction="down"]').getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    });
    await page.mouse.move(button.x, button.y);
    const beforeMouse = await sample(1);
    await page.mouse.down();
    try {
      const afterMouse = await sample(4);
      assert.ok(afterMouse.y > beforeMouse.y, 'desktop direction button still supports holding the mouse');
    } finally {
      await page.mouse.up();
    }
    await expectStill('mouse release stops movement');
    console.log('PASS: analog strength, continuous turns, capture, cancel, multitouch, lifecycle resets, pause/restart/room completion, 4 touch viewports, accessible buttons, desktop keyboard/mouse');
  } finally {
    if (touching) await touch('touchCancel');
    await page.evaluate(() => window.joystickProbe?.restore());
    await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.cdp('Emulation.clearDeviceMetricsOverride');
  }
}
