export type Point = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Phase = 'menu' | 'playing' | 'room-complete' | 'reveal' | 'proposal' | 'success' | 'photos';
export type RoomTrace = { main: Point[][]; detours: Point[][] };

export const WORLD = { width: 480, height: 256 };
export const VIEW = { zoom: 1.6, radius: 50 };
export const ROAD_WIDTH = 20;
export const FOOT_RADIUS = 3;
export const WALK_RADIUS = ROAD_WIDTH / 2 - FOOT_RADIUS;
const ROUTE_COVERAGE_RADIUS = WALK_RADIUS * 2;
export const WALK_SPEED = 62;

export const ROOMS = [
  {
    id: 'spring',
    name: '春日花园',
    season: 'SPRING',
    description: '晨雾里的小径，花香是路标',
    message: '花园探索完成！带上一点花香，去池畔听听风吧。',
    letter: 'L',
    color: '#89a879',
    keyAt: 0.48,
    points: [{ x: 153, y: 66 }, { x: 153, y: 188 }, { x: 287, y: 188 }],
  },
  {
    id: 'summer',
    name: '夏日池畔',
    season: 'SUMMER',
    description: '沿着池畔，听听夏天的声音',
    message: '池畔探索完成！下一站，果园里的苹果正好成熟。',
    letter: 'O',
    color: '#7ea9ac',
    keyAt: 0.51,
    points: [
      { x: 153, y: 67 }, { x: 224, y: 67 }, { x: 248, y: 92 },
      { x: 248, y: 166 }, { x: 224, y: 188 }, { x: 153, y: 188 },
      { x: 130, y: 166 }, { x: 130, y: 92 }, { x: 153, y: 67 },
    ],
  },
  {
    id: 'autumn',
    name: '秋日果园',
    season: 'AUTUMN',
    description: '踩着落叶，去找果园的出口',
    message: '果园探索完成！穿过下一扇门，去暖屋里歇歇脚。',
    letter: 'V',
    color: '#c39a63',
    keyAt: 0.5,
    points: [{ x: 122, y: 68 }, { x: 197, y: 190 }, { x: 272, y: 68 }],
  },
  {
    id: 'winter',
    name: '冬日暖屋',
    season: 'WINTER',
    description: '雪落下来了，暖屋就在前方',
    message: '四季探索完成！现在，回头看看这趟旅行吧。',
    letter: 'E',
    color: '#969db6',
    keyAt: 0.61,
    points: [
      { x: 263, y: 64 }, { x: 131, y: 64 }, { x: 131, y: 190 },
      { x: 263, y: 190 }, { x: 263, y: 166 }, { x: 158, y: 166 },
      { x: 158, y: 139 }, { x: 242, y: 139 }, { x: 242, y: 115 },
      { x: 158, y: 115 }, { x: 158, y: 88 }, { x: 263, y: 88 },
      { x: 263, y: 64 },
    ],
  },
] as const;

export type Room = (typeof ROOMS)[number];

const detourLayouts = [
  [
    { at: 20, turns: [{ x: -43, y: 0 }, { x: -43, y: 18 }], obstacle: 'log' },
    { at: 60, turns: [{ x: 45, y: 0 }, { x: 45, y: -20 }], obstacle: 'rocks' },
    { at: 102, turns: [{ x: -44, y: 0 }, { x: -44, y: -22 }], obstacle: 'water' },
    { at: 160, turns: [{ x: 0, y: 35 }, { x: 37, y: 35 }], obstacle: 'fence' },
    { at: 226, turns: [{ x: 0, y: -35 }, { x: 28, y: -35 }], obstacle: 'log' },
  ],
  [
    { at: 30, turns: [{ x: 0, y: -26 }, { x: 35, y: -26 }], obstacle: 'fence' },
    { at: 140, turns: [{ x: 48, y: 0 }, { x: 48, y: 27 }], obstacle: 'water' },
    { at: 225, turns: [{ x: 0, y: 34 }, { x: -42, y: 34 }], obstacle: 'rocks' },
    { at: 325, turns: [{ x: -22, y: 0 }, { x: -22, y: 28 }], obstacle: 'log' },
    { at: 375, turns: [{ x: -30, y: 0 }, { x: -30, y: -23 }], obstacle: 'fence' },
  ],
  [
    { at: 25, turns: [{ x: -41, y: 0 }, { x: -41, y: 20 }], obstacle: 'rocks' },
    { at: 75, turns: [{ x: -40, y: 0 }, { x: -40, y: 26 }], obstacle: 'fence' },
    { at: 130, turns: [{ x: 0, y: 39 }, { x: -40, y: 39 }], obstacle: 'log' },
    { at: 188, turns: [{ x: 45, y: 0 }, { x: 45, y: 35 }], obstacle: 'water' },
    { at: 250, turns: [{ x: 41, y: 0 }, { x: 41, y: -23 }], obstacle: 'rocks' },
  ],
  [
    { at: 42, turns: [{ x: 0, y: -25 }, { x: -36, y: -25 }], obstacle: 'log' },
    { at: 180, turns: [{ x: -38, y: 0 }, { x: -38, y: -24 }], obstacle: 'rocks' },
    { at: 320, turns: [{ x: 0, y: 35 }, { x: 42, y: 35 }], obstacle: 'fence' },
    { at: 402, turns: [{ x: 45, y: 0 }, { x: 45, y: 25 }], obstacle: 'water' },
    { at: 642, turns: [{ x: 52, y: 0 }, { x: 52, y: -24 }], obstacle: 'log' },
  ],
] as const;

export const OBSTACLE_MESSAGES = {
  log: '一棵倒下的树挡住了去路。小松鼠说：换条路吧！',
  rocks: '前面全是大石头，这双小靴子可翻不过去。',
  fence: '栅栏后是小动物的午睡区，还是不打扰它们啦。',
  water: '小桥还没修好，先别弄湿鞋子，回去试试另一边。',
};

export const DETOURS = detourLayouts.map((layouts, roomIndex) => layouts.map((layout) => {
  const anchor = pathPosition(ROOMS[roomIndex].points, layout.at);
  const points = [{ x: anchor.x, y: anchor.y }, ...layout.turns.map((turn) => ({ x: anchor.x + turn.x, y: anchor.y + turn.y }))];
  return { at: layout.at, points, obstacle: layout.obstacle, length: pathLength(points) };
}));

export const ROADS = ROOMS.map((room, roomIndex) => [room.points, ...DETOURS[roomIndex].map((branch) => branch.points)]);
export const ROUTE_SAMPLES = ROOMS.map((room) => {
  const length = pathLength(room.points);
  const count = Math.ceil(length / 4);
  return Array.from({ length: count + 1 }, (_, index) => pathPosition(room.points, index * length / count));
});

export type Journey = {
  position: Point;
  facing: number;
  route: number;
  visited: Set<number>;
  percent: number;
  hasKey: boolean;
  completed: boolean;
  trace: RoomTrace;
  footprints: Point[];
};

export function createJourney(roomIndex: number): Journey {
  const position = { ...ROOMS[roomIndex].points[0] };
  return { position, facing: 1, route: 0, visited: new Set(), percent: 0, hasKey: false,
    completed: false, trace: { main: [[position]], detours: [] }, footprints: [position] };
}

export function pathLength(points: readonly Point[]): number {
  return points.slice(1).reduce((total, point, index) =>
    total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

export function pathPosition(points: readonly Point[], distance: number) {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    const length = Math.hypot(next.x - previous.x, next.y - previous.y);
    if (remaining < length || index === points.length - 1) {
      const fraction = Math.min(remaining / length, 1);
      return {
        x: previous.x + (next.x - previous.x) * fraction,
        y: previous.y + (next.y - previous.y) * fraction,
        dx: (next.x - previous.x) / length,
        dy: (next.y - previous.y) / length,
        segment: index - 1,
      };
    }
    remaining -= length;
  }
  return { ...points[0], dx: 0, dy: 1, segment: 0 };
}

export function pathSection(points: readonly Point[], startDistance: number, endDistance: number): Point[] {
  const total = pathLength(points);
  const start = Math.max(0, Math.min(total, startDistance));
  const end = Math.max(start, Math.min(total, endDistance));
  const first = pathPosition(points, start);
  const result = [{ x: first.x, y: first.y }];
  let traveled = 0;
  for (let index = 1; index < points.length; index += 1) {
    traveled += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    if (traveled > start && traveled < end) result.push({ ...points[index] });
  }
  if (end > start) {
    const last = pathPosition(points, end);
    result.push({ x: last.x, y: last.y });
  }
  return result;
}

export function cameraAt(position: Point) {
  const width = WORLD.width / VIEW.zoom;
  const height = WORLD.height / VIEW.zoom;
  return {
    x: Math.max(0, Math.min(WORLD.width - width, position.x - width / 2)),
    y: Math.max(0, Math.min(WORLD.height - height, position.y - height / 2)),
    width,
    height,
  };
}

export function closestOnPath(points: readonly Point[], position: Point) {
  let nearest = Infinity;
  let target = { distance: 0, separation: Infinity };
  let traveled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    const deltaX = next.x - previous.x;
    const deltaY = next.y - previous.y;
    const length = Math.hypot(deltaX, deltaY);
    const fraction = Math.max(0, Math.min(1,
      ((position.x - previous.x) * deltaX + (position.y - previous.y) * deltaY) / (length * length)));
    const candidate = traveled + fraction * length;
    const separation = Math.hypot(position.x - previous.x - fraction * deltaX,
      position.y - previous.y - fraction * deltaY);
    if (separation < nearest) {
      nearest = separation;
      target = { distance: candidate, separation };
    }
    traveled += length;
  }
  return target;
}

export function roadAt(roomIndex: number, position: Point) {
  let nearest: { route: number; distance: number; separation: number } | null = null;
  for (const [route, points] of ROADS[roomIndex].entries()) {
    const hit = closestOnPath(points, position);
    if (hit.separation > WALK_RADIUS + 0.000001 || (nearest && hit.separation >= nearest.separation)) continue;
    if (route > 0) {
      const branch = DETOURS[roomIndex][route - 1];
      const end = pathPosition(points, branch.length);
      if ((position.x - end.x) * end.dx + (position.y - end.y) * end.dy > 0.000001) continue;
    }
    nearest = { route, ...hit };
  }
  return nearest;
}

export function movementVector(input: Iterable<Direction> | Point): Point {
  if ('x' in input) {
    const length = Math.hypot(input.x, input.y);
    if (!Number.isFinite(length)) return { x: 0, y: 0 };
    const scale = Math.max(1, length);
    return { x: input.x / scale, y: input.y / scale };
  }
  const pressed = new Set(input);
  const horizontal = Number(pressed.has('right')) - Number(pressed.has('left'));
  const vertical = Number(pressed.has('down')) - Number(pressed.has('up'));
  const length = Math.hypot(horizontal, vertical) || 1;
  return { x: horizontal / length, y: vertical / length };
}

export function joystickVector(offset: Point): Point {
  const vector = movementVector(offset);
  const length = Math.hypot(vector.x, vector.y);
  const deadZone = 0.15;
  if (length <= deadZone) return { x: 0, y: 0 };
  const scale = (length - deadZone) / (1 - deadZone) / length;
  return { x: vector.x * scale, y: vector.y * scale };
}

export function movePlayer(roomIndex: number, start: Point, input: Iterable<Direction> | Point, elapsed: number): Point[] {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return [];
  const vector = movementVector(input);
  if (!vector.x && !vector.y) return [];
  const distance = Math.min(elapsed, 0.05) * WALK_SPEED;
  const steps = Math.ceil(distance);
  const delta = { x: vector.x * distance / steps, y: vector.y * distance / steps };
  const positions: Point[] = [];
  let position = start;
  for (let step = 0; step < steps; step += 1) {
    let next = { x: position.x + delta.x, y: position.y + delta.y };
    if (!roadAt(roomIndex, next)) {
      next = { ...position };
      const horizontal = { x: position.x + delta.x, y: position.y };
      if (delta.x && roadAt(roomIndex, horizontal)) next = horizontal;
      const vertical = { x: next.x, y: next.y + delta.y };
      if (delta.y && roadAt(roomIndex, vertical)) next = vertical;
    }
    if (next.x !== position.x || next.y !== position.y) positions.push(next);
    position = next;
  }
  return positions;
}

function appendPoint(points: Point[], position: Point) {
  const last = points.at(-1);
  const previous = points.at(-2);
  if (last && previous) {
    const before = { x: last.x - previous.x, y: last.y - previous.y };
    const after = { x: position.x - last.x, y: position.y - last.y };
    if (Math.abs(before.x * after.y - before.y * after.x) < 0.000001
      && before.x * after.x + before.y * after.y > 0) {
      points[points.length - 1] = position;
      return;
    }
  }
  points.push(position);
}

export function advanceJourney(roomIndex: number, journey: Journey, input: Iterable<Direction> | Point, elapsed: number) {
  if (journey.completed) return false;
  const positions = movePlayer(roomIndex, journey.position, input, elapsed);
  const room = ROOMS[roomIndex];
  const key = pathPosition(room.points, pathLength(room.points) * room.keyAt);
  const samples = ROUTE_SAMPLES[roomIndex];
  for (const position of positions) {
    const hit = roadAt(roomIndex, position)!;
    const segments = hit.route === 0 ? journey.trace.main : journey.trace.detours;
    if (hit.route !== journey.route) segments.push([]);
    appendPoint(segments[segments.length - 1], position);
    if (position.x !== journey.position.x) journey.facing = Math.sign(position.x - journey.position.x);
    journey.position = position;
    journey.route = hit.route;
    if (hit.route === 0) {
      for (const [index, sample] of samples.entries()) {
        if (!journey.visited.has(index) && Math.hypot(position.x - sample.x, position.y - sample.y) <= ROUTE_COVERAGE_RADIUS) {
          journey.visited.add(index);
        }
      }
      if (Math.hypot(position.x - key.x, position.y - key.y) <= WALK_RADIUS + 1) journey.hasKey = true;
    }
    const lastFootprint = journey.footprints[journey.footprints.length - 1];
    if (Math.hypot(position.x - lastFootprint.x, position.y - lastFootprint.y) >= 5) {
      journey.footprints.push(position);
      if (journey.footprints.length > 80) journey.footprints.shift();
    }
  }
  journey.percent = Math.floor(journey.visited.size / samples.length * 100);
  const door = room.points[room.points.length - 1];
  journey.completed = journey.hasKey && journey.visited.size === samples.length
    && Math.hypot(journey.position.x - door.x, journey.position.y - door.y) <= 6;
  return positions.length > 0;
}

export function traceBounds(points: readonly Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function letterPoints(points: readonly Point[], frame: readonly Point[] = points) {
  const { minX, minY, width, height } = traceBounds(frame);
  const scale = Math.min(90 / (width || 1), 110 / (height || 1));
  return points.map((point) =>
    `${(point.x - minX) * scale + (120 - width * scale) / 2},${(point.y - minY) * scale + (140 - height * scale) / 2}`,
  ).join(' ');
}

export function escapePosition(
  area: { width: number; height: number },
  button: { width: number; height: number },
  previous: Point,
  random = Math.random,
): Point {
  const maxX = Math.max(0, area.width - button.width);
  const maxY = Math.max(0, area.height - button.height);
  const candidates = Array.from({ length: 12 }, () => ({ x: random() * maxX, y: random() * maxY }));
  return candidates.reduce((best, candidate) =>
    Math.hypot(candidate.x - previous.x, candidate.y - previous.y)
      > Math.hypot(best.x - previous.x, best.y - previous.y) ? candidate : best);
}
