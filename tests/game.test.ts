import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { advanceJourney, cameraAt, createJourney, DETOURS, escapePosition, joystickVector, letterPoints, movementVector, movePlayer, OBSTACLE_MESSAGES, pathLength, pathPosition, pathSection, roadAt, ROOMS, ROUTE_SAMPLES, VIEW, WALK_RADIUS, WALK_SPEED, WORLD } from '../src/game.ts';
import type { Direction, Journey, Point } from '../src/game.ts';

function walkTo(roomIndex: number, journey: Journey, target: Point, recorded?: Set<string>, analog = false) {
  for (let frame = 0; frame < 2000; frame += 1) {
    const horizontal = target.x - journey.position.x;
    const vertical = target.y - journey.position.y;
    const distance = Math.hypot(horizontal, vertical);
    if (distance < 0.1 || journey.completed) return;
    const directions: Direction[] = [];
    const remaining: number[] = [];
    if (Math.abs(horizontal) > 0.05) { directions.push(horizontal > 0 ? 'right' : 'left'); remaining.push(Math.abs(horizontal)); }
    if (Math.abs(vertical) > 0.05) { directions.push(vertical > 0 ? 'down' : 'up'); remaining.push(Math.abs(vertical)); }
    const input = analog ? { x: horizontal / distance * 0.5, y: vertical / distance * 0.5 } : directions;
    const elapsed = Math.min(1 / 60, analog ? distance / (WALK_SPEED * 0.5) : Math.min(...remaining) * Math.sqrt(directions.length) / WALK_SPEED);
    if (recorded) for (const point of movePlayer(roomIndex, journey.position, input, elapsed)) recorded.add(`${point.x},${point.y}`);
    assert.ok(advanceJourney(roomIndex, journey, input, elapsed), `stuck in ${roomIndex}: ${JSON.stringify(journey.position)} -> ${JSON.stringify(target)}`);
    assert.ok(roadAt(roomIndex, journey.position));
    const camera = cameraAt(journey.position);
    assert.ok(camera.x >= 0 && camera.y >= 0);
    assert.ok(camera.x + camera.width <= WORLD.width && camera.y + camera.height <= WORLD.height);
  }
  assert.fail(`could not reach ${JSON.stringify(target)}`);
}

function walkPath(roomIndex: number, journey: Journey, points: readonly Point[], recorded?: Set<string>, analog = false) {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2);
    for (let step = 1; step <= steps; step += 1) {
      walkTo(roomIndex, journey, { x: start.x + (end.x - start.x) * step / steps, y: start.y + (end.y - start.y) * step / steps }, recorded, analog);
    }
  }
}

test('direct movement, normalized diagonals, opposing keys, stopping, and collision substeps', () => {
  assert.deepEqual(movementVector(['up', 'down', 'left', 'right']), { x: 0, y: 0 });
  assert.deepEqual(movementVector(['up', 'up']), { x: 0, y: -1 });
  const start = { x: 153, y: 104 };
  const diagonal = movePlayer(0, start, ['right', 'down'], 1 / 60).at(-1)!;
  assert.ok(Math.abs(Math.hypot(diagonal.x - start.x, diagonal.y - start.y) - WALK_SPEED / 60) < 0.000001);
  for (const elapsed of [0, -1, NaN, Infinity]) assert.deepEqual(movePlayer(0, start, ['down'], elapsed), []);
  assert.deepEqual(movePlayer(0, start, [], 1), []);
  assert.deepEqual(movePlayer(0, start, ['up', 'down'], 1), []);
  const delayed = movePlayer(0, start, ['down'], 60);
  assert.ok(pathLength([start, ...delayed]) <= WALK_SPEED * 0.05 + 0.000001);
  assert.ok(delayed.every((point, index) => Math.hypot(point.x - (delayed[index - 1] ?? start).x, point.y - (delayed[index - 1] ?? start).y) <= 1.000001));
  let position = start;
  for (let frame = 0; frame < 150; frame += 1) position = movePlayer(0, position, ['left'], 1 / 60).at(-1) ?? position;
  assert.ok(position.x >= start.x - WALK_RADIUS - 0.000001);
  assert.equal(position.y, start.y);
  const reverse = movePlayer(0, start, ['up'], 0.05).at(-1)!;
  assert.ok(reverse.y < start.y);
  assert.equal(roadAt(0, { x: 0, y: 0 }), null);
  const journey = createJourney(0);
  for (let frame = 0; frame < 100; frame += 1) advanceJourney(0, journey, ['down', 'left'], 1 / 60);
  assert.equal(journey.route, 1, 'holding a direction before a fork must enter it without a new keydown');
  const stopped = JSON.stringify(journey.trace);
  advanceJourney(0, journey, [], 1);
  assert.equal(JSON.stringify(journey.trace), stopped);
});

test('joystick dead zone, linear strength, continuous angles and invalid vectors', () => {
  for (const offset of [{ x: 0, y: 0 }, { x: 0.09, y: 0.12 }, { x: -0.15, y: 0 }]) {
    assert.deepEqual(joystickVector(offset), { x: 0, y: 0 });
  }
  for (const angle of [0, Math.PI / 7, Math.PI / 2, Math.PI, Math.PI * 1.7]) {
    for (const length of [0.2, 0.575, 1, 3]) {
      const vector = joystickVector({ x: Math.cos(angle) * length, y: Math.sin(angle) * length });
      const strength = (Math.min(length, 1) - 0.15) / 0.85;
      assert.ok(Math.abs(vector.x - Math.cos(angle) * strength) < 0.000001);
      assert.ok(Math.abs(vector.y - Math.sin(angle) * strength) < 0.000001);
    }
  }
  assert.deepEqual(movementVector({ x: 0.3, y: -0.4 }), { x: 0.3, y: -0.4 });
  assert.deepEqual(movementVector({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });
  for (const input of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: -Infinity, y: 1 }, { x: Number.MAX_VALUE, y: Number.MAX_VALUE }]) {
    assert.deepEqual(movementVector(input), { x: 0, y: 0 });
    assert.deepEqual(joystickVector(input), { x: 0, y: 0 });
    assert.deepEqual(movePlayer(0, { x: 153, y: 104 }, input, 1 / 60), []);
  }
});

test('analog strength changes speed without changing collision or stop behavior', () => {
  const start = { x: 153, y: 104 };
  const half = movePlayer(0, start, joystickVector({ x: 0, y: 0.575 }), 1 / 60).at(-1)!;
  const full = movePlayer(0, start, { x: 0, y: 1 }, 1 / 60).at(-1)!;
  assert.ok(Math.abs(half.y - start.y - (full.y - start.y) / 2) < 0.000001);
  const diagonal = movePlayer(0, start, { x: 3, y: 4 }, 1 / 60).at(-1)!;
  assert.ok(Math.abs(Math.hypot(diagonal.x - start.x, diagonal.y - start.y) - WALK_SPEED / 60) < 0.000001);
  let position = start;
  for (let frame = 0; frame < 150; frame += 1) position = movePlayer(0, position, { x: -0.5, y: 0 }, 1 / 60).at(-1) ?? position;
  assert.ok(position.x >= start.x - WALK_RADIUS - 0.000001);
  assert.equal(position.y, start.y);
  const journey = createJourney(0);
  advanceJourney(0, journey, { x: 0, y: 0.5 }, 1 / 60);
  const stopped = JSON.stringify(journey);
  assert.equal(advanceJourney(0, journey, { x: 0, y: 0 }, 1), false);
  assert.equal(JSON.stringify(journey), stopped);
});

for (const analog of [false, true]) {
  test(`all four rooms and all twenty dead ends work with ${analog ? 'analog' : 'directional'} input and retain only real trace points`, () => {
    assert.equal(ROOMS.map((room) => room.letter).join(''), 'LOVE');
    assert.equal(DETOURS.flat().length, 20);
    for (const [roomIndex, room] of ROOMS.entries()) {
      const journey = createJourney(roomIndex);
      const recorded = new Set([`${journey.position.x},${journey.position.y}`]);
      let distance = 0;
      for (const branch of DETOURS[roomIndex]) {
        walkPath(roomIndex, journey, pathSection(room.points, distance, branch.at), recorded, analog);
        const before = journey.percent;
        const hadKey = journey.hasKey;
        walkPath(roomIndex, journey, branch.points, recorded, analog);
        assert.equal(journey.percent, before, 'dead-end exploration must not add main-road progress');
        assert.equal(journey.hasKey, hadKey);
        assert.ok(OBSTACLE_MESSAGES[branch.obstacle]);
        const end = pathPosition(branch.points, branch.length);
        const directions: Direction[] = Math.abs(end.dx) > 0.5 ? [end.dx > 0 ? 'right' : 'left'] : [end.dy > 0 ? 'down' : 'up'];
        const input = analog ? { x: end.dx, y: end.dy } : directions;
        const position = { ...journey.position };
        for (let attempt = 0; attempt < 20; attempt += 1) advanceJourney(roomIndex, journey, input, 1);
        assert.ok(Math.hypot(journey.position.x - position.x, journey.position.y - position.y) < 0.1, 'cannot pass a blocked end');
        walkPath(roomIndex, journey, [...branch.points].reverse(), recorded, analog);
        assert.equal(journey.percent, before);
        assert.equal(journey.hasKey, hadKey);
        distance = branch.at;
      }
      walkPath(roomIndex, journey, pathSection(room.points, distance, pathLength(room.points)), recorded, analog);
      assert.equal(journey.completed, true, room.name);
      assert.equal(journey.percent, 100);
      assert.equal(journey.visited.size, ROUTE_SAMPLES[roomIndex].length);
      assert.equal(journey.hasKey, true);
      assert.ok(journey.trace.main.length > 1);
      assert.ok(journey.trace.detours.length >= 5);
      const frame = journey.trace.main.flat();
      for (const point of [...frame, ...journey.trace.detours.flat()]) assert.ok(recorded.has(`${point.x},${point.y}`), 'must not manufacture trace coordinates');
      for (const corner of room.points) assert.ok(frame.some((point) => Math.hypot(point.x - corner.x, point.y - corner.y) <= 8));
      for (const segment of journey.trace.main) {
        for (const coordinates of letterPoints(segment, frame).split(' ')) {
          const [horizontal, vertical] = coordinates.split(',').map(Number);
          assert.ok(horizontal >= 0 && horizontal <= 120 && vertical >= 0 && vertical <= 140);
        }
      }
      assert.ok(VIEW.radius * 2 < pathLength(room.points) / 2);
    }
  });
}

test('walking past a fork along the main-road edge reaches full coverage without skipping the door', () => {
  const journey = createJourney(0);
  walkPath(0, journey, [
    { x: 153, y: 66 }, { x: 146.5, y: 66 }, { x: 146.5, y: 110 },
    { x: 153, y: 110 }, { x: 153, y: 188 }, { x: 280, y: 188 },
  ]);
  assert.equal(journey.percent, 100);
  assert.equal(journey.visited.size, ROUTE_SAMPLES[0].length);
  assert.equal(journey.hasKey, true);
  assert.equal(journey.completed, false, 'full coverage must not bypass the door distance');
  walkTo(0, journey, ROOMS[0].points.at(-1)!);
  assert.equal(journey.completed, true);
});

test('all four rooms can be completed once along either road edge', () => {
  for (const [roomIndex, room] of ROOMS.entries()) {
    for (const offset of [-6.9, -6.5, 6.5, 6.9]) {
      const points: Point[] = [{ ...room.points[0] }];
      for (let index = 1; index < room.points.length; index += 1) {
        const start = room.points[index - 1];
        const end = room.points[index];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const shift = { x: -(end.y - start.y) / length * offset, y: (end.x - start.x) / length * offset };
        points.push({ x: start.x + shift.x, y: start.y + shift.y }, { x: end.x + shift.x, y: end.y + shift.y });
      }
      points.push({ ...room.points.at(-1)! });
      const journey = createJourney(roomIndex);
      walkPath(roomIndex, journey, points);
      const scenario = `${room.id}, offset ${offset}`;
      assert.equal(journey.percent, 100, scenario);
      assert.equal(journey.visited.size, ROUTE_SAMPLES[roomIndex].length, scenario);
      assert.equal(journey.hasKey, true, scenario);
      assert.equal(journey.completed, true, scenario);
    }
  }
});

test('inside turns cover L and V corners without widening key pickup', () => {
  const scenarios = [
    { roomIndex: 0, points: [
      { x: 153, y: 66 }, { x: 153, y: 170 }, { x: 159.9, y: 170 },
      { x: 159.9, y: 181.1 }, { x: 177, y: 181.1 }, { x: 177, y: 188 }, { x: 287, y: 188 },
    ] },
    { roomIndex: 2, points: [
      { x: 122, y: 68 }, { x: 185, y: 170.48 }, { x: 197, y: 177 },
      { x: 209, y: 170.48 }, { x: 272, y: 68 },
    ] },
  ];
  for (const { roomIndex, points } of scenarios) {
    const journey = createJourney(roomIndex);
    walkPath(roomIndex, journey, points);
    assert.equal(journey.percent, 100, ROOMS[roomIndex].name);
    assert.equal(journey.visited.size, ROUTE_SAMPLES[roomIndex].length);
    assert.equal(journey.hasKey, false, 'exploration tolerance must not pick up an out-of-reach key');
    assert.equal(journey.completed, false, 'reaching the door without a key must not complete the room');
  }
});

test('closed loops can be walked in reverse; collecting a key and doubling back cannot skip the rest', () => {
  for (const roomIndex of [1, 3]) {
    const room = ROOMS[roomIndex];
    const journey = createJourney(roomIndex);
    advanceJourney(roomIndex, journey, [], 1);
    assert.equal(journey.completed, false);
    assert.equal(journey.percent, 0);
    const shortRoute = pathSection(room.points, pathLength(room.points) * room.keyAt, pathLength(room.points)).reverse();
    walkPath(roomIndex, journey, shortRoute);
    assert.equal(journey.hasKey, true);
    const progress = journey.percent;
    walkPath(roomIndex, journey, [...shortRoute].reverse());
    assert.equal(journey.hasKey, true);
    assert.ok(journey.percent >= progress && journey.percent < 100);
    assert.equal(journey.completed, false);
    walkPath(roomIndex, journey, [...room.points].reverse());
    assert.equal(journey.completed, true);
    assert.equal(journey.percent, 100);
  }
});

test('escaped buttons remain bounded, including compact layouts; empty dimensions are safe', () => {
  let seed = 17;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const area of [{ width: 244, height: 64 }, { width: 364, height: 64 }, { width: 244, height: 54 }]) {
    const button = { width: 114, height: 44 };
    let previous = { x: 40, y: 8 };
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const escaped = escapePosition(area, button, previous, random);
      assert.ok(escaped.x >= 0 && escaped.y >= 0);
      assert.ok(escaped.x + button.width <= area.width);
      assert.ok(escaped.y + button.height <= area.height);
      assert.ok(Math.hypot(escaped.x - previous.x, escaped.y - previous.y) > 20);
      previous = escaped;
    }
  }
  assert.deepEqual(escapePosition({ width: 10, height: 10 }, { width: 114, height: 44 }, { x: 0, y: 0 }, random), { x: 0, y: 0 });
});

test('the adventure has no early spoilers or obsolete click-to-walk controls', () => {
  for (const filename of ['../src/App.tsx', '../src/game.ts', '../index.html']) {
    assert.doesNotMatch(readFileSync(new URL(filename, import.meta.url), 'utf8'), /求婚|我爱你|心动小镇|心意|表白|嫁给|favorite person|A LITTLE WALK TO LOVE/);
  }
  const board = readFileSync(new URL('../src/GameBoard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(board, /clickScene|enterBranch|returnFromBranch|按住向前走|去那边看看|Space: 'forward'/);
});
