import { ROOMS, WORLD, createJourney, advanceJourney, traceBounds } from '/src/game.ts';
import { createScenery, drawScene } from '/src/scenery.ts';

const canvas = document.querySelector('#art');
const context = canvas.getContext('2d');
const status = document.querySelector('#status');
const colors = { paper: '#f6f2e7', ink: '#294b40', soft: '#718072', rose: '#b56a73', pink: '#ead1cd', line: '#d9dece', green: '#dee6d5', gold: '#ddba7c' };
const sans = '"PingFang SC", "Microsoft YaHei", sans-serif';
const serif = '"Songti SC", "Noto Serif CJK SC", serif';
const story = await fetch('./story.json').then(response => response.json());
const journeys = await fetch('./assets/journeys.json').then(response => response.json());
const totalDuration = story.reduce((duration, scene) => duration + scene.duration, 0);
const images = {};
await Promise.all(['start', 'desktop', 'mobile', 'proposal', 'success', 'photos-private', ...ROOMS.map((_, index) => `season-${index}`)].map(async name => {
  const image = new Image();
  image.src = `./assets/${name}.png`;
  await image.decode();
  images[name] = image;
}));
await document.fonts.ready;

function box(left, top, width, height, fill, radius = 24, stroke = null) {
  context.beginPath();
  context.roundRect(left, top, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) { context.strokeStyle = stroke; context.lineWidth = 2; context.stroke(); }
}

function text(content, left, top, size = 32, color = colors.ink, weight = 500, family = sans, align = 'left') {
  context.font = `${weight} ${size}px ${family}`;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = 'top';
  context.fillText(content, left, top);
}

function lines(content, left, top, size = 86, color = colors.ink, leading = 112, family = serif, align = 'left') {
  content.forEach((line, index) => text(line, left, top + index * leading, size, color, 700, family, align));
}

function pill(content, left, top, fill = colors.green, color = colors.ink, size = 24) {
  context.font = `600 ${size}px ${sans}`;
  const width = context.measureText(content).width + 38;
  box(left, top, width, size + 26, fill, 14);
  text(content, left + 19, top + 10, size, color, 600);
  return width;
}

function heart(left, top, scale = 7, color = colors.rose) {
  context.fillStyle = color;
  ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'].forEach((row, rowIndex) => {
    [...row].forEach((pixel, columnIndex) => {
      if (pixel === '1') context.fillRect(left + columnIndex * scale, top + rowIndex * scale, scale, scale);
    });
  });
}

const paperCache = new Map();
function base(height, section, page = null) {
  if (canvas.height !== height) canvas.height = height;
  context.resetTransform();
  context.globalAlpha = 1;
  if (!paperCache.has(height)) {
    const paper = document.createElement('canvas');
    paper.width = 1080;
    paper.height = height;
    const painter = paper.getContext('2d');
    painter.fillStyle = colors.paper;
    painter.fillRect(0, 0, 1080, height);
    painter.fillStyle = '#6572590a';
    for (let top = 0; top < height; top += 9) {
      for (let left = 0; left < 1080; left += 9) painter.fillRect(left + (top % 17), top, 1, 1);
    }
    painter.strokeStyle = colors.line;
    painter.lineWidth = 2;
    painter.strokeRect(32, 32, 1016, height - 64);
    paperCache.set(height, paper);
  }
  context.drawImage(paperCache.get(height), 0, 0);
  heart(72, 76, 4);
  text('四季小径', 119, 67, 30, colors.ink, 650);
  text(section, 1008, 76, 20, colors.soft, 550, sans, 'right');
  context.fillStyle = colors.line;
  context.fillRect(72, 129, 936, 2);
  text('A LITTLE WALK TO LOVE', 72, height - 84, 18, colors.soft, 500);
  if (page) text(`${String(page).padStart(2, '0')} / 06`, 1008, height - 88, 22, colors.soft, 600, sans, 'right');
}

function picture(image, left, top, width, height, { crop = null, contain = false, radius = 20 } = {}) {
  context.save();
  context.beginPath();
  context.roundRect(left, top, width, height, radius);
  context.clip();
  context.fillStyle = '#f9f7ed';
  context.fillRect(left, top, width, height);
  context.imageSmoothingEnabled = !image.pixel;
  const source = crop || [0, 0, image.width, image.height];
  const ratio = contain ? Math.min(width / source[2], height / source[3]) : Math.max(width / source[2], height / source[3]);
  const drawWidth = source[2] * ratio;
  const drawHeight = source[3] * ratio;
  context.drawImage(image, ...source, left + (width - drawWidth) / 2, top + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function frame(image, left, top, width, height, options = {}) {
  context.save();
  context.shadowColor = '#374a331b';
  context.shadowBlur = 28;
  context.shadowOffsetY = 15;
  box(left, top, width, height, '#fffdf7', 28, colors.line);
  context.restore();
  picture(image, left + 10, top + 10, width - 20, height - 20, options);
}

const sceneCanvas = document.createElement('canvas');
sceneCanvas.width = WORLD.width;
sceneCanvas.height = WORLD.height;
sceneCanvas.pixel = true;
const sceneContext = sceneCanvas.getContext('2d');
const backgrounds = ROOMS.map((_, index) => createScenery(index));
const animationStates = ROOMS.map((room, roomIndex) => {
  const journey = createJourney(roomIndex);
  const states = [structuredClone(journey)];
  let count = 0;
  for (let pointIndex = 1; pointIndex < room.points.length; pointIndex += 1) {
    const start = room.points[pointIndex - 1];
    const end = room.points[pointIndex];
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2);
    for (let step = 1; step <= steps && !journey.completed; step += 1) {
      const target = { x: start.x + (end.x - start.x) * step / steps, y: start.y + (end.y - start.y) * step / steps };
      while (Math.hypot(target.x - journey.position.x, target.y - journey.position.y) > 2.5 && !journey.completed) {
        if (count++ > 2000) throw new Error(`Animation path blocked in ${room.name}`);
        const horizontal = target.x - journey.position.x;
        const vertical = target.y - journey.position.y;
        const direction = Math.abs(horizontal) > Math.abs(vertical) ? (horizontal > 0 ? 'right' : 'left') : (vertical > 0 ? 'down' : 'up');
        if (!advanceJourney(roomIndex, journey, [direction], 0.05)) throw new Error(`Animation cannot advance in ${room.name}`);
        states.push(structuredClone(journey));
      }
    }
  }
  if (!journey.completed || journey.percent !== 100 || !journey.hasKey) throw new Error(`Invalid journey ${room.name}`);
  return states;
});

function gameplay(roomIndex, progress, clock, left, top, width, height) {
  const states = animationStates[roomIndex];
  const index = Math.min(states.length - 1, Math.floor(Math.max(0, progress) * (states.length - 1)));
  drawScene(sceneContext, backgrounds[roomIndex], roomIndex, states[index], clock * 1000, true);
  frame(sceneCanvas, left, top, width, height, { contain: true });
}

function seasonGrid(top, height = 290, clock = null) {
  ROOMS.forEach((room, index) => {
    const left = 72 + index % 2 * 478;
    const rowTop = top + Math.floor(index / 2) * (height + 100);
    if (clock === null) {
      images[`season-${index}`].pixel = true;
      frame(images[`season-${index}`], left, rowTop, 458, height, { contain: true });
    } else gameplay(index, 0.12 + (clock * 0.065 + index * 0.18) % 0.78, clock, left, rowTop, 458, height);
    text(room.name, left + 4, rowTop + height + 16, 28, colors.ink, 650);
    text(room.season, left + 452, rowTop + height + 24, 16, colors.soft, 500, sans, 'right');
  });
}

function love(left, top, width, height, fraction = 1, withNames = true) {
  const cell = width / 4;
  journeys.forEach((journey, index) => {
    const points = journey.trace.main.flat();
    const bounds = traceBounds(points);
    const scale = Math.min((cell - 44) / bounds.width, (height - (withNames ? 66 : 30)) / bounds.height);
    const offsetLeft = left + index * cell + (cell - bounds.width * scale) / 2;
    const offsetTop = top + (height - (withNames ? 54 : 0) - bounds.height * scale) / 2;
    box(left + index * cell + 5, top, cell - 10, height, ['#e6eddd', '#dfeceb', '#efe2cd', '#e5e5ef'][index], 22);
    context.save();
    context.beginPath();
    context.rect(left + index * cell, top, cell, height);
    context.clip();
    const shown = Math.max(0, Math.min(1, fraction * 4 - index));
    context.beginPath();
    const count = Math.max(1, Math.floor(points.length * shown));
    points.slice(0, count).forEach((point, pointIndex) => {
      const horizontal = offsetLeft + (point.x - bounds.minX) * scale;
      const vertical = offsetTop + (point.y - bounds.minY) * scale;
      if (pointIndex === 0) context.moveTo(horizontal, vertical); else context.lineTo(horizontal, vertical);
    });
    context.strokeStyle = colors.rose;
    context.lineWidth = index === 3 ? 11 : 15;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
    context.restore();
    if (withNames) text(ROOMS[index].name, left + index * cell + cell / 2, top + height - 42, 22, colors.soft, 550, sans, 'center');
  });
}

function ui(imageName, left, top, width, height, crop = [105, 65, 985, 750]) {
  frame(images[imageName], left, top, width, height, { crop, contain: true });
}

function renderPoster(index) {
  base(1440, ['一份可玩的心意', '故事的开场', '四个独立房间', '慢慢走，也没关系', '以下含结局剧透', '故事，未完待续'][index], index + 1);
  if (index === 0) {
    pill('送给喜欢的 TA', 72, 184, colors.pink, colors.rose);
    lines(['我把求婚', '藏进了小游戏'], 72, 277, 104, colors.ink, 130);
    text('走过春夏秋冬，回头才发现是 LOVE。', 77, 557, 33, colors.soft);
    seasonGrid(654, 214);
    pill('像素风', 72, 1280);
    pill('四季探索', 212, 1280);
    pill('结尾有惊喜', 401, 1280, colors.pink, colors.rose);
    heart(883, 1255, 10);
  } else if (index === 1) {
    lines(['先别告诉 TA', '这是一场告白'], 72, 210, 96, colors.ink, 122);
    text('开场只是一次，慢悠悠的森林冒险。', 77, 484, 32, colors.soft);
    frame(images.start, 72, 574, 936, 555, { crop: [215, 218, 770, 455], contain: true });
    pill('没有倒计时', 91, 1180);
    pill('没有失败惩罚', 373, 1180);
    pill('不用急着通关', 680, 1180);
    text('把惊喜，留到故事最后。', 540, 1280, 34, colors.rose, 600, serif, 'center');
  } else if (index === 2) {
    lines(['陪你，把四季', '走成一段故事'], 72, 210, 94, colors.ink, 116);
    text('花园、池畔、果园、暖屋，每一章都是新风景。', 77, 475, 29, colors.soft);
    seasonGrid(571, 258);
    text('亲手移动小人，收藏每一扇门后的风景。', 540, 1320, 28, colors.soft, 500, sans, 'center');
  } else if (index === 3) {
    lines(['走错也没关系', '慢慢回来就好'], 72, 210, 94, colors.ink, 116);
    text('岔路没有失败惩罚，也不会弄丢已经捡到的钥匙。', 77, 475, 28, colors.soft);
    gameplay(0, 0.5, 3, 72, 575, 936, 520);
    ['沿路探索', '捡起钥匙', '走进花门'].forEach((label, index) => {
      const left = 91 + index * 320;
      pill(String(index + 1).padStart(2, '0'), left, 1170, colors.pink, colors.rose);
      text(label, left + 82, 1180, 29, colors.ink, 650);
    });
    text('主路探索完整 + 拿到钥匙，花门才会打开。', 540, 1290, 28, colors.soft, 500, sans, 'center');
  } else if (index === 4) {
    pill('结局剧透提醒', 72, 184, colors.pink, colors.rose);
    lines(['回头看，', '是我爱你的形状'], 72, 282, 96, colors.ink, 123);
    text('刚刚亲手走过的路，最后拼成了——', 77, 562, 33, colors.soft);
    love(72, 710, 936, 344);
    text('不是凭空出现的答案，', 540, 1145, 36, colors.ink, 600, serif, 'center');
    text('是你一步一步，走出来的心意。', 540, 1204, 36, colors.rose, 700, serif, 'center');
  } else {
    lines(['你愿意', '嫁给我吗？'], 72, 206, 104, colors.ink, 124);
    heart(879, 264, 10);
    text('把最想说的话，认真放在故事的结尾。', 77, 489, 31, colors.soft);
    ui('proposal', 72, 567, 565, 602);
    frame(images['photos-private'], 663, 567, 345, 400, { crop: [140, 78, 920, 650], contain: true });
    text('愿意之后', 682, 1002, 30, colors.ink, 650);
    text('还有我们的照片墙', 682, 1053, 24, colors.soft);
    text('私人照片已隐藏', 682, 1100, 21, colors.rose);
    box(72, 1222, 936, 94, colors.green, 22);
    text('四季小径 · 一份可以亲手走完的礼物', 540, 1250, 33, colors.ink, 650, serif, 'center');
  }
  return canvas.toDataURL('image/png');
}

function renderVideoFrame(time) {
  let elapsed = 0;
  const scene = story.find(item => {
    if (time < elapsed + item.duration) return true;
    elapsed += item.duration;
    return false;
  }) || story.at(-1);
  const localTime = Math.max(0, time - elapsed);
  const progress = Math.min(1, localTime / scene.duration);
  base(1920, '一份可以亲手走完的心意');
  const rise = 22 * (1 - Math.min(1, localTime / 0.5)) ** 3;
  context.save();
  context.translate(0, rise);
  if (scene.id === 'hook') {
    pill('我给喜欢的人，做了一个游戏', 72, 212, colors.pink, colors.rose);
    lines(['我把求婚', '藏进了小游戏'], 72, 324, 107, colors.ink, 140);
    text('四季小径 / A STROLL THROUGH THE SEASONS', 77, 646, 25, colors.soft);
    seasonGrid(748, 230, time);
    pill('像素风', 72, 1467);
    pill('四季探索', 225, 1467);
    pill('结尾有惊喜', 437, 1467, colors.pink, colors.rose);
    heart(890, 1440, 9 + Math.sin(time * 3) * 0.5);
  } else if (scene.id === 'start') {
    pill('01 / 先把惊喜藏起来', 72, 212);
    lines(['开场，不说告白', '只邀请你探险'], 72, 323, 96, colors.ink, 127);
    frame(images.start, 72, 658, 936, 600, { crop: [215, 218, 770, 455], contain: true });
    text('没有倒计时，没有失败惩罚。', 540, 1343, 38, colors.ink, 550, serif, 'center');
    text('慢慢走，故事才刚刚开始。', 540, 1405, 32, colors.soft, 500, sans, 'center');
  } else if (scene.id === 'seasons') {
    const roomIndex = Math.min(3, Math.floor(progress * 4));
    const roomProgress = progress * 4 % 1;
    pill('02 / 穿过四个季节', 72, 212);
    lines(['每一扇门后', '都是新的风景'], 72, 323, 99, colors.ink, 127);
    gameplay(roomIndex, 0.12 + roomProgress * 0.7, time, 72, 660, 936, 548);
    text(ROOMS[roomIndex].name, 540, 1256, 66, colors.ink, 650, serif, 'center');
    text(ROOMS[roomIndex].season, 540, 1346, 26, colors.soft, 550, sans, 'center');
    ROOMS.forEach((room, index) => pill(['春', '夏', '秋', '冬'][index], 232 + index * 155, 1444, index === roomIndex ? colors.ink : colors.green, index === roomIndex ? colors.paper : colors.soft, 26));
  } else if (scene.id === 'walk') {
    pill('03 / 路过的风景都算数', 72, 212);
    lines(['走错也没关系', '慢慢回来就好'], 72, 323, 96, colors.ink, 127);
    gameplay(0, 0.27 + progress * 0.61, time, 72, 660, 936, 548);
    ['沿路探索', '捡起钥匙', '走进花门'].forEach((label, index) => {
      pill(String(index + 1), 113 + index * 324, 1280, colors.pink, colors.rose, 26);
      text(label, 181 + index * 324, 1293, 31, colors.ink, 600);
    });
    text('主路走完整，带着钥匙，去往下一章。', 540, 1430, 33, colors.soft, 500, sans, 'center');
    text('游戏演示 · 画面节选', 540, 1490, 20, colors.soft, 500, sans, 'center');
  } else if (scene.id === 'lookback' || scene.id === 'love') {
    pill('04 / 从这里开始，有一点剧透', 72, 212, colors.pink, colors.rose);
    lines(scene.id === 'lookback' ? ['直到最后', '回头看，才发现'] : ['原来每一步', '都在写：我爱你'], 72, 329, 99, colors.ink, 130);
    love(72, 755, 936, 400, scene.id === 'lookback' ? progress : 1);
    text('亲手走过的四条小路', 540, 1260, 35, colors.soft, 500, sans, 'center');
    text('拼成了同一个答案。', 540, 1335, 48, colors.rose, 700, serif, 'center');
    if (scene.id === 'love') heart(512, 1460, 7 + Math.sin(time * 3) * 0.5);
  } else if (scene.id === 'proposal') {
    pill('05 / 有句话，想认真对你说', 72, 212, colors.pink, colors.rose);
    lines(['你愿意', '嫁给我吗？'], 72, 323, 110, colors.ink, 139);
    heart(873, 377, 10);
    ui('proposal', 110, 657, 860, 805);
    text('走过春夏秋冬，最想抵达的是你身边。', 540, 1515, 31, colors.soft, 500, sans, 'center');
  } else if (scene.id === 'success') {
    pill('06 / 我们的故事，未完待续', 72, 212);
    lines(['余生，', '请多指教。'], 72, 323, 112, colors.ink, 138);
    ui('success', 72, 660, 936, 498, [118, 82, 966, 700]);
    frame(images['photos-private'], 72, 1210, 458, 295, { crop: [140, 78, 920, 650], contain: true });
    text('还有我们的', 580, 1250, 36, colors.ink, 600, serif);
    text('照片墙', 580, 1308, 61, colors.rose, 700, serif);
    text('私人照片已隐藏', 580, 1404, 24, colors.soft);
  } else {
    pill('把喜欢，做成一份礼物', 72, 212, colors.pink, colors.rose);
    lines(['四季小径', '送 TA 一场小冒险'], 72, 323, 97, colors.ink, 128);
    frame(images.mobile, 661, 655, 300, 650, { contain: true });
    gameplay(0, 0.4 + progress * 0.12, time, 72, 726, 554, 337);
    text('电脑 / 手机', 80, 1120, 49, colors.ink, 650, serif);
    text('打开网页，就能开始', 80, 1195, 32, colors.soft);
    box(72, 1370, 936, 133, colors.green, 24);
    text('如果是你，会把哪句话藏在终点？', 540, 1414, 37, colors.ink, 650, serif, 'center');
    text('UI: Animal Island UI · guokaigdg · CC BY-NC 4.0', 540, 1562, 19, colors.soft, 500, sans, 'center');
  }
  context.restore();
  box(72, 1630, 936, 144, '#e8e6db', 24);
  const subtitleSize = 33;
  const subtitleTop = 1630 + (144 - scene.subtitle.length * 48) / 2;
  scene.subtitle.forEach((line, index) => text(line, 540, subtitleTop + index * 48, subtitleSize, colors.ink, 600, sans, 'center'));
  context.fillStyle = colors.line;
  context.fillRect(72, 1800, 936, 3);
  context.fillStyle = colors.rose;
  context.fillRect(72, 1800, 936 * Math.min(1, time / totalDuration), 3);
  text('游戏画面演示 · 合成配音', 1008, 1836, 18, colors.soft, 500, sans, 'right');
}

async function record() {
  const recordButton = document.querySelector('#record');
  recordButton.disabled = true;
  const audio = new AudioContext({ sampleRate: 48000 });
  await audio.resume();
  const destination = audio.createMediaStreamDestination();
  const mix = audio.createGain();
  mix.gain.value = 1;
  mix.connect(destination);
  const voices = await Promise.all(story.map(async scene => audio.decodeAudioData(await fetch(`./audio/${scene.id}.wav`).then(response => response.arrayBuffer()))));
  voices.forEach((buffer, index) => {
    if (buffer.duration > story[index].duration - 0.45) throw new Error(`Voice exceeds scene: ${story[index].id}`);
  });
  renderVideoFrame(0);
  const stream = canvas.captureStream(30);
  destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
  const mimeType = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser cannot export H.264 MP4. Use an up-to-date Chromium on macOS.');
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 });
  const chunks = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const completed = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = event => reject(event.error || new Error('MediaRecorder failed'));
  });
  recorder.start(1000);
  const startTime = audio.currentTime + 0.2;
  let offset = 0;
  story.forEach((scene, index) => {
    const voice = audio.createBufferSource();
    voice.buffer = voices[index];
    voice.connect(mix);
    voice.start(startTime + offset + 0.35);
    offset += scene.duration;
  });
  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 0, 440, 523.25, 659.25, 587.33, 523.25, 440, 392, 0];
  for (let noteIndex = 0; noteIndex * 0.43 < totalDuration; noteIndex += 1) {
    const frequency = melody[noteIndex % melody.length];
    if (!frequency) continue;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const start = startTime + noteIndex * 0.43;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.018 * Math.min(1, (totalDuration - noteIndex * 0.43) / 2), start + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
    oscillator.connect(envelope);
    envelope.connect(mix);
    oscillator.start(start);
    oscillator.stop(start + 0.85);
  }
  await new Promise(resolve => {
    const tick = () => {
      const current = Math.max(0, audio.currentTime - startTime);
      renderVideoFrame(Math.min(current, totalDuration - 0.001));
      status.textContent = `生成中 ${Math.min(totalDuration, current).toFixed(1)} / ${totalDuration.toFixed(1)} 秒`;
      if (current < totalDuration) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await completed;
  stream.getTracks().forEach(track => track.stop());
  await audio.close();
  const blob = new Blob(chunks, { type: 'video/mp4' });
  if (blob.size < 1000000) throw new Error('Encoded video is unexpectedly small');
  window.production.videoBlob = blob;
  window.production.videoURL = URL.createObjectURL(blob);
  window.production.recorded = true;
  document.querySelector('#download').hidden = false;
  status.textContent = `完成 · ${totalDuration.toFixed(1)} 秒 · ${(blob.size / 1048576).toFixed(1)} MB`;
  recordButton.disabled = false;
}

window.production = { ready: true, recorded: false, totalDuration, story, renderPoster, renderVideoFrame, animationStates: animationStates.map(states => states.length) };
let posterIndex = 0;
document.querySelector('#poster').onclick = () => renderPoster(posterIndex++ % 6);
document.querySelector('#record').onclick = () => record().catch(error => { status.textContent = error.message; window.production.error = error.message; console.error(error); });
document.querySelector('#download').onclick = () => {
  const anchor = document.createElement('a');
  anchor.href = window.production.videoURL;
  anchor.download = '四季小径-小红书介绍.mp4';
  anchor.click();
};
document.querySelector('#record').disabled = false;
renderPoster(0);
status.textContent = `已就绪 · 6 张图文 / ${totalDuration.toFixed(1)} 秒竖屏视频`;
