import { cameraAt, DETOURS, pathLength, pathPosition, ROAD_WIDTH, ROADS, ROOMS, VIEW, WORLD } from './game';
import type { Journey, Point } from './game';

type Painter = CanvasRenderingContext2D;

const palettes = [
  { grass: '#a8c985', fleck: '#b8d694', shade: '#8eb375', leaf: '#77a666', light: '#a8c781', dark: '#537f53', path: '#eddbad', edge: '#c8b585' },
  { grass: '#99c88a', fleck: '#add897', shade: '#80b577', leaf: '#66a270', light: '#9bc981', dark: '#4c805e', path: '#ead8ab', edge: '#bba77d' },
  { grass: '#c2bf7d', fleck: '#d3ce8c', shade: '#aaa56a', leaf: '#c18b56', light: '#e8b878', dark: '#937550', path: '#edd8b0', edge: '#bda07a' },
  { grass: '#e2ebde', fleck: '#f2f5e9', shade: '#c6d7d0', leaf: '#819c91', light: '#cadbd0', dark: '#617e79', path: '#dbcfb3', edge: '#b7b4a2' },
];

function rect(context: Painter, color: string, x: number, y: number, width: number, height: number) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function oval(context: Painter, color: string, x: number, y: number, radiusX: number, radiusY: number) {
  context.fillStyle = color;
  for (let row = -radiusY; row <= radiusY; row += 1) {
    const span = Math.round(radiusX * Math.sqrt(Math.max(0, 1 - (row / radiusY) ** 2)));
    context.fillRect(Math.round(x - span), Math.round(y + row), span * 2, 1);
  }
}

function tree(context: Painter, x: number, y: number, season: number, blossom = false, scale = 1) {
  const palette = palettes[season];
  const colors = blossom && season === 0 ? ['#bd8d8a', '#dda5a1', '#f0c5b5']
    : [palette.dark, palette.leaf, palette.light];
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  oval(context, palette.shade, 1, 0, 17, 5);
  rect(context, '#80684e', -3, -20, 7, 21);
  rect(context, '#a98b60', -1, -18, 2, 16);
  rect(context, '#80684e', -7, -13, 5, 3);
  oval(context, colors[0], 0, -24, 21, 15);
  oval(context, colors[0], -9, -32, 13, 13);
  oval(context, colors[0], 7, -35, 13, 14);
  oval(context, colors[1], -1, -29, 19, 14);
  oval(context, colors[1], -7, -37, 12, 10);
  oval(context, colors[2], -6, -36, 10, 8);
  oval(context, colors[2], 10, -28, 7, 6);
  rect(context, colors[2], -15, -26, 4, 3);
  rect(context, colors[0], -10, -17, 6, 2);
  rect(context, colors[0], 8, -19, 5, 2);
  if (season === 2) {
    for (const [appleX, appleY] of [[-12, -28], [6, -35], [12, -23]]) {
      rect(context, '#b96451', appleX, appleY, 4, 4);
      rect(context, '#e4a078', appleX, appleY, 2, 1);
    }
  }
  if (season === 3) {
    oval(context, '#f7f7e9', -5, -38, 12, 6);
    oval(context, '#edf2e6', 10, -28, 9, 4);
    rect(context, '#f7f7e9', -18, -28, 7, 3);
  }
  context.restore();
}

function flower(context: Painter, x: number, y: number, color: string, tall = false) {
  rect(context, '#6e9559', x, y, 1, tall ? 6 : 3);
  rect(context, '#7d9f5e', x - 2, y + 2, 2, 1);
  rect(context, color, x - 2, y - 2, 5, 2);
  rect(context, color, x - 1, y - 3, 3, 4);
  rect(context, '#f5e3a0', x, y - 1, 1, 1);
}

function fence(context: Painter, x: number, y: number, width: number, snow = false) {
  rect(context, '#a58b60', x, y - 9, width, 3);
  rect(context, '#d0b487', x, y - 10, width, 2);
  rect(context, '#a58b60', x, y - 3, width, 2);
  for (let post = 0; post <= width; post += 14) {
    rect(context, '#957c58', x + post, y - 12, 4, 15);
    rect(context, '#ddc59b', x + post, y - 13, 3, 13);
    if (snow) rect(context, '#fcf9e9', x + post - 1, y - 14, 5, 2);
  }
}

function cottage(context: Painter, x: number, y: number, season: number) {
  const snowy = season === 3;
  const roof = season === 2 ? '#a87050' : '#b87970';
  oval(context, palettes[season].shade, x + 32, y + 53, 40, 8);
  rect(context, '#b0a184', x + 1, y + 45, 65, 10);
  rect(context, '#f0dbab', x + 3, y + 10, 62, 38);
  rect(context, '#d7bd90', x + 57, y + 10, 8, 38);
  for (let beam = 0; beam < 5; beam += 1) rect(context, '#e3c999', x + 5, y + 17 + beam * 7, 50, 1);
  rect(context, '#866d54', x + 43, y - 20, 8, 17);
  rect(context, '#c2a087', x + 42, y - 21, 10, 4);
  for (let row = 0; row < 13; row += 1) {
    rect(context, row % 3 === 0 ? '#946c61' : roof, x + 31 - row * 3, y - 22 + row * 3, 8 + row * 6, 3);
    if (snowy && row < 7) rect(context, '#f5f4e5', x + 31 - row * 3, y - 22 + row * 3, 8 + row * 6, 3);
  }
  rect(context, '#875f53', x - 7, y + 14, 81, 3);
  rect(context, '#e0a28b', x - 5, y + 12, 76, 2);
  rect(context, '#ac8560', x + 27, y + 26, 16, 23);
  rect(context, '#775f49', x + 29, y + 28, 12, 21);
  rect(context, '#e4bb75', x + 37, y + 37, 2, 2);
  for (const windowX of [x + 10, x + 48]) {
    rect(context, '#a38b68', windowX - 2, y + 25, 13, 13);
    rect(context, snowy ? '#f6d98f' : '#a9caca', windowX, y + 27, 9, 9);
    rect(context, '#f6e6bf', windowX + 4, y + 27, 1, 9);
    rect(context, '#f6e6bf', windowX, y + 31, 9, 1);
    rect(context, '#b09067', windowX - 3, y + 38, 15, 2);
  }
  rect(context, '#c5b590', x + 24, y + 50, 23, 3);
  flower(context, x + 7, y + 48, '#d79496');
  flower(context, x + 60, y + 48, '#e2a5b1');
}

function pond(context: Painter, x: number, y: number, width: number, height: number, frozen = false) {
  oval(context, '#87a77f', x, y + 2, width / 2 + 4, height / 2 + 3);
  oval(context, '#bad4b1', x, y, width / 2 + 2, height / 2 + 2);
  oval(context, frozen ? '#accaca' : '#7aaeb2', x, y, width / 2, height / 2);
  oval(context, frozen ? '#c1dcda' : '#95c2bf', x - 2, y - 2, width / 2 - 3, height / 2 - 4);
  rect(context, '#c8e0cc', x - 20, y - 5, 12, 1);
  rect(context, '#b9dcce', x + 5, y + 7, 11, 1);
  if (!frozen) {
    oval(context, '#6e9d6b', x + 13, y - 5, 5, 3);
    flower(context, x + 14, y - 8, '#ebbdab');
    oval(context, '#f4edd1', x - 10, y + 5, 5, 3);
    rect(context, '#f7efd4', x - 8, y - 1, 4, 5);
    rect(context, '#8d7d60', x - 5, y, 1, 1);
    rect(context, '#d6a368', x - 4, y + 2, 3, 1);
  }
  for (const reed of [-1, 1]) {
    rect(context, '#769469', x + reed * width / 2, y - 3, 1, 10);
    rect(context, '#a28763', x + reed * width / 2 - 1, y - 5, 2, 5);
  }
}

function flowerBed(context: Painter, x: number, y: number, columns: number, rows: number, season: number) {
  rect(context, '#b39b6a', x - 3, y - 3, columns * 11 + 4, rows * 10 + 4);
  rect(context, '#98785b', x - 1, y - 1, columns * 11, rows * 10);
  for (let row = 0; row < rows; row += 1) {
    rect(context, '#b18c62', x, y + row * 10 + 7, columns * 11 - 2, 1);
    for (let column = 0; column < columns; column += 1) {
      const plantX = x + column * 11 + 4;
      const plantY = y + row * 10 + 4;
      if (season === 2) {
        oval(context, '#be8247', plantX, plantY, 4, 3);
        rect(context, '#e2a45c', plantX - 2, plantY - 2, 2, 4);
        rect(context, '#7a8c55', plantX, plantY - 4, 1, 2);
      } else if (season === 3) {
        oval(context, '#f3f0df', plantX, plantY, 4, 2);
      } else {
        flower(context, plantX, plantY, ['#e3a1a2', '#ebd495', '#d7b3bc'][(row + column) % 3], true);
      }
    }
  }
}

function drawRoute(context: Painter, points: readonly Point[], color: string | CanvasGradient, width: number) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
}

export function createScenery(roomIndex: number) {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;
  const palette = palettes[roomIndex];
  let seed = 738 + roomIndex * 57;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  rect(context, palette.grass, 0, 0, WORLD.width, WORLD.height);
  for (let patch = 0; patch < 1200; patch += 1) {
    const x = random() * WORLD.width;
    const y = random() * WORLD.height;
    rect(context, patch % 3 === 0 ? palette.shade : palette.fleck, x, y, 1 + random() * 3, 1);
    if (patch % 7 === 0) rect(context, palette.shade, x + 1, y - 2, 1, 2);
  }
  for (let border = 0; border < 16; border += 1) {
    tree(context, border * 34 - 5, 31 + random() * 8, roomIndex, border % 5 === 2, 0.95);
  }
  fence(context, 52, 48, 70, roomIndex === 3);
  fence(context, 322, 46, 84, roomIndex === 3);
  fence(context, 48, 213, 70, roomIndex === 3);
  fence(context, 328, 208, 84, roomIndex === 3);
  cottage(context, 341, 82, roomIndex);
  tree(context, 314, 94, roomIndex, true, 0.85);
  tree(context, 428, 111, roomIndex, false, 0.9);
  tree(context, 71, 77, roomIndex, true, 0.8);
  if (roomIndex === 0) {
    pond(context, 78, 133, 57, 32);
    flowerBed(context, 202, 79, 6, 4, roomIndex);
    flowerBed(context, 348, 166, 5, 3, roomIndex);
    tree(context, 244, 150, roomIndex, true, 0.85);
    flowerBed(context, 65, 180, 4, 2, roomIndex);
  } else if (roomIndex === 1) {
    pond(context, 191, 128, 63, 69);
    flowerBed(context, 65, 141, 3, 3, roomIndex);
    rect(context, '#e4b9a0', 343, 165, 50, 29);
    for (let stripe = 0; stripe < 5; stripe += 1) {
      rect(context, '#f2d6b8', 343 + stripe * 10, 165, 4, 29);
      rect(context, '#f2d6b8', 343, 165 + stripe * 6, 50, 2);
    }
    oval(context, '#ac8259', 367, 178, 7, 5);
    rect(context, '#eed4a7', 363, 174, 8, 3);
    tree(context, 296, 198, roomIndex, false, 0.8);
  } else if (roomIndex === 2) {
    flowerBed(context, 181, 101, 3, 3, roomIndex);
    flowerBed(context, 343, 165, 5, 3, roomIndex);
    tree(context, 89, 157, roomIndex, false, 0.9);
    tree(context, 301, 174, roomIndex, false, 0.85);
    for (let leaf = 0; leaf < 20; leaf += 1) {
      rect(context, '#cf965f', 52 + random() * 62, 185 + random() * 16, 3, 2);
    }
  } else {
    pond(context, 75, 134, 51, 31, true);
    flowerBed(context, 344, 165, 5, 3, roomIndex);
    tree(context, 302, 163, roomIndex, false, 0.7);
    oval(context, '#c3d0c4', 81, 190, 11, 3);
    oval(context, '#f9f5e8', 81, 182, 8, 8);
    oval(context, '#f9f5e8', 81, 171, 6, 6);
    rect(context, '#9d8574', 75, 165, 12, 2);
    rect(context, '#9d8574', 78, 160, 6, 5);
    rect(context, '#b8817b', 76, 176, 11, 2);
    rect(context, '#887969', 79, 170, 1, 1);
    rect(context, '#ca9a6c', 83, 172, 3, 1);
  }
  for (let cluster = 0; cluster < 38; cluster += 1) {
    const x = 36 + random() * 401;
    const y = cluster % 2 ? 225 + random() * 7 : 38 + random() * 7;
    flower(context, x, y, roomIndex === 3 ? '#f5f3df' : ['#f1d6a4', '#d997a0', '#e0bdd2'][cluster % 3]);
  }
  for (let border = 0; border < 6; border += 1) {
    tree(context, 5, 68 + border * 36, roomIndex, border % 3 === 0, 0.86);
    tree(context, 473, 70 + border * 36, roomIndex, border % 4 === 1, 0.92);
  }
  for (let border = 0; border < 15; border += 1) {
    tree(context, border * 37 - 12, 280 + random() * 6, roomIndex, border % 4 === 0, 0.92);
  }
  return canvas;
}

export function drawGirl(context: Painter, x: number, y: number, walking = false, time = 0, facing = 1) {
  const bounce = walking ? Math.round(Math.sin(time / 80)) : 0;
  const step = walking ? Math.round(Math.sin(time / 90) * 2) : 0;
  oval(context, '#84916f88', x, y + 1, 7, 2);
  context.save();
  context.translate(Math.round(x), Math.round(y - bounce));
  context.scale(facing < 0 ? -1 : 1, 1);
  rect(context, '#695044', -5, -21, 10, 13);
  rect(context, '#80604a', -6, -18, 12, 10);
  rect(context, '#9a7555', -4, -21, 7, 4);
  rect(context, '#efc7a0', -3, -17, 7, 7);
  rect(context, '#80604a', -4, -18, 8, 2);
  rect(context, '#80604a', -4, -17, 2, 3);
  rect(context, '#4e5342', 2, -14, 1, 2);
  rect(context, '#dfa698', 2, -12, 2, 1);
  rect(context, '#e7a8a6', -6, -20, 4, 3);
  rect(context, '#f3c4b7', -5, -20, 1, 2);
  rect(context, '#f4e6ce', -4, -10, 8, 4);
  rect(context, '#e8c49d', -6, -8 + step / 2, 2, 4);
  rect(context, '#e8c49d', 4, -8 - step / 2, 2, 4);
  rect(context, '#b97378', -4, -8, 8, 6);
  rect(context, '#d99394', -3, -8, 6, 5);
  rect(context, '#edc6aa', -2, -3, 2, 3 - step / 2);
  rect(context, '#edc6aa', 2, -3, 2, 3 + step / 2);
  rect(context, '#795e4b', -3, step / -2, 3, 2);
  rect(context, '#795e4b', 2, step / 2, 3, 2);
  context.restore();
}

function drawDoor(context: Painter, point: Point, open: boolean) {
  const x = point.x;
  const y = point.y;
  oval(context, '#88977377', x, y + 2, 13, 4);
  rect(context, '#987852', x - 10, y - 28, 20, 29);
  rect(context, '#d4b488', x - 11, y - 29, 22, 3);
  rect(context, '#ead7ac', x - 8, y - 25, 16, 25);
  rect(context, open ? '#8a8770' : '#bfa078', x - 6, y - 24, 12, 24);
  rect(context, open ? '#b1b393' : '#cfb68a', x - 5, y - 23, open ? 5 : 10, 21);
  if (open) {
    rect(context, '#ebdbaf', x + 4, y - 23, 2, 21);
    rect(context, '#fcf0c8', x - 3, y - 16, 4, 4);
  } else {
    rect(context, '#8f7b54', x + 2, y - 12, 2, 3);
  }
  for (const side of [-1, 1]) {
    rect(context, '#6e955d', x + side * 13, y - 25, 3, 23);
    flower(context, x + side * 13, y - 23, '#edb3ac');
    flower(context, x + side * 13, y - 12, '#e7cc9a');
  }
  rect(context, '#779c65', x - 12, y - 31, 26, 3);
  flower(context, x - 4, y - 31, '#efb8ba');
  flower(context, x + 5, y - 31, '#f2d2a7');
}

function drawKey(context: Painter, point: Point, time: number) {
  const x = Math.round(point.x);
  const y = Math.round(point.y - 11 - Math.sin(time / 250) * 2);
  oval(context, '#a7986677', x, point.y, 5, 2);
  rect(context, '#ab8642', x - 6, y - 3, 6, 6);
  rect(context, '#f2d881', x - 5, y - 3, 5, 5);
  rect(context, '#c4a659', x - 4, y - 2, 2, 3);
  rect(context, '#f8df86', x, y - 1, 8, 2);
  rect(context, '#f8df86', x + 4, y, 2, 3);
  rect(context, '#f8df86', x + 7, y, 2, 3);
  rect(context, '#fff4c5', x - 5, y - 3, 3, 1);
}

function drawObstacle(context: Painter, branch: (typeof DETOURS)[number][number], season: number) {
  const end = pathPosition(branch.points, branch.length);
  context.save();
  context.translate(Math.round(end.x + end.dx * 10), Math.round(end.y + end.dy * 10));
  if (Math.abs(end.dx) > 0.5) context.rotate(Math.PI / 2);
  if (branch.obstacle === 'log') {
    oval(context, '#84916f77', 0, 4, 15, 4);
    rect(context, '#8f704f', -14, -5, 27, 9);
    rect(context, '#b69563', -12, -5, 23, 3);
    rect(context, '#755d46', -10, 0, 21, 2);
    rect(context, '#d1b581', -15, -4, 4, 8);
    rect(context, '#987c56', -14, -2, 2, 4);
    rect(context, '#98794f', 4, -9, 3, 6);
    rect(context, '#aac084', 7, -5, 5, 2);
  } else if (branch.obstacle === 'rocks') {
    oval(context, '#8b8d79', -7, 0, 7, 6);
    oval(context, '#a8aa91', -8, -2, 5, 3);
    oval(context, '#838b7c', 5, -3, 8, 7);
    oval(context, '#b8bca5', 4, -5, 5, 4);
    oval(context, '#929884', 11, 4, 5, 4);
    rect(context, season === 3 ? '#f8f7ed' : '#ccd0b8', 1, -10, 5, 2);
  } else if (branch.obstacle === 'fence') {
    fence(context, -15, 5, 28, season === 3);
    rect(context, '#b89b71', -5, -10, 12, 7);
    rect(context, '#e7d5aa', -4, -9, 10, 5);
    rect(context, '#9e8c63', -1, -8, 2, 3);
  } else {
    oval(context, '#98ad93', 0, 1, 18, 9);
    oval(context, season === 3 ? '#bbd3d2' : '#8cbab9', 0, 0, 16, 7);
    rect(context, '#c4dcd0', -10, -3, 10, 1);
    rect(context, '#c4dcd0', 2, 3, 8, 1);
    rect(context, '#a68d65', -6, -9, 3, 6);
    rect(context, '#c1a87d', -2, -9, 8, 4);
    rect(context, '#a68d65', 4, 5, 3, 5);
    rect(context, '#c1a87d', -5, 8, 9, 3);
  }
  context.restore();
}

export function drawScene(
  context: Painter, background: HTMLCanvasElement, roomIndex: number,
  journey: Journey, time: number, walking: boolean, reducedMotion = false,
) {
  context.clearRect(0, 0, WORLD.width, WORLD.height);
  context.imageSmoothingEnabled = false;
  const room = ROOMS[roomIndex];
  const palette = palettes[roomIndex];
  const total = pathLength(room.points);
  const branches = DETOURS[roomIndex];
  const { position, hasKey } = journey;
  const camera = cameraAt(position);
  context.save();
  context.scale(VIEW.zoom, VIEW.zoom);
  context.translate(-camera.x, -camera.y);
  context.drawImage(background, 0, 0);
  const pathGradient = (color: string) => {
    const gradient = context.createRadialGradient(position.x, position.y, 10, position.x, position.y, VIEW.radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, `${color}00`);
    return gradient;
  };
  for (const route of ROADS[roomIndex]) drawRoute(context, route, pathGradient(palette.edge), ROAD_WIDTH);
  for (const route of ROADS[roomIndex]) drawRoute(context, route, pathGradient(palette.path), ROAD_WIDTH - 4);
  for (const [index, track] of journey.footprints.entries()) {
    const distance = Math.hypot(track.x - position.x, track.y - position.y);
    if (distance < VIEW.radius - 5) {
      context.globalAlpha = Math.min(0.6, (VIEW.radius - 5 - distance) / 20);
      rect(context, '#b59b78', track.x + (index % 2 ? 1 : -2), track.y, 2, 2);
      context.globalAlpha = 1;
    }
  }
  for (const branch of branches) {
    const end = branch.points[branch.points.length - 1];
    if (Math.hypot(end.x - position.x, end.y - position.y) < VIEW.radius - 5) drawObstacle(context, branch, roomIndex);
  }
  const door = room.points[room.points.length - 1];
  const key = pathPosition(room.points, total * room.keyAt);
  if (Math.hypot(door.x - position.x, door.y - position.y) < VIEW.radius) drawDoor(context, door, hasKey && journey.percent === 100);
  if (!hasKey && Math.hypot(key.x - position.x, key.y - position.y) < VIEW.radius) drawKey(context, key, reducedMotion ? 0 : time);
  if (Math.hypot(position.x - room.points[0].x, position.y - room.points[0].y) < 24) {
    const start = room.points[0];
    rect(context, '#947a56', start.x - 20, start.y - 15, 1, 16);
    rect(context, '#faf2d7', start.x - 19, start.y - 15, 10, 6);
    rect(context, '#cf9090', start.x - 18, start.y - 13, 3, 2);
  }
  drawGirl(context, position.x, position.y, walking && !reducedMotion, time, journey.facing);
  for (let mote = 0; mote < (roomIndex === 3 ? 20 : 7); mote += 1) {
    const clock = reducedMotion ? 0 : time;
    const x = (43 + mote * 67 + Math.sin(clock / 2400 + mote) * 12) % WORLD.width;
    const y = (56 + mote * 31 + clock / (roomIndex === 3 ? 180 : 750)) % (WORLD.height - 20);
    const color = roomIndex === 3 ? '#fffdf0' : roomIndex === 2 ? '#d7a971' : '#f0e8bc';
    rect(context, color, x, y, 2, roomIndex === 3 ? 2 : 1);
    if (roomIndex === 0 && mote % 2 === 0) rect(context, '#e8b7c0', x + 2, y - 1, 2, 2);
  }
  context.restore();
}
