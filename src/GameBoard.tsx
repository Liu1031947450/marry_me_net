import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Button, Icon } from 'animal-island-ui';
import { advanceJourney, closestOnPath, createJourney, DETOURS, joystickVector, movementVector, OBSTACLE_MESSAGES, ROOMS, WORLD } from './game';
import type { Direction, Journey, Point, RoomTrace } from './game';
import { chime, footstep } from './audio';
import { createScenery, drawScene } from './scenery';

const keyboardDirections: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
const directionLabels = { up: '向上走', down: '向下走', left: '向左走', right: '向右走' };
type Notice = { kind: string; text: string };
const defaultNotice: Notice = { kind: 'walking', text: '沿小路自由探索，走错也能随时回头。' };

type Props = {
  roomIndex: number;
  active: boolean;
  reducedMotion: boolean;
  onProgress: (percent: number, hasKey: boolean) => void;
  onComplete: (trace: RoomTrace) => void;
};

export default function GameBoard({ roomIndex, active, reducedMotion, onProgress, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Map<string, Direction>());
  const joystickRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const joystick = useRef<{ pointerId: number; vector: Point } | null>(null);
  const [joystickOffset, setJoystickOffset] = useState<Point | null>(null);
  const journeyRef = useRef<Journey | null>(null);
  if (!journeyRef.current) journeyRef.current = createJourney(roomIndex);
  const journey = journeyRef.current;
  const notified = useRef(false);
  const reported = useRef('');
  const noticeKey = useRef(defaultNotice.text);
  const [notice, setNotice] = useState(defaultNotice);
  const background = useMemo(() => createScenery(roomIndex), [roomIndex]);
  const room = ROOMS[roomIndex];

  const resetJoystick = useCallback(() => {
    const pointerId = joystick.current?.pointerId;
    joystick.current = null;
    setJoystickOffset(null);
    if (pointerId !== undefined && joystickRef.current?.hasPointerCapture(pointerId)) {
      joystickRef.current.releasePointerCapture(pointerId);
    }
  }, []);

  const stop = useCallback(() => {
    held.current.clear();
    resetJoystick();
  }, [resetJoystick]);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    let frame = 0;
    let previousTime = 0;
    const tick = (time: number) => {
      const elapsed = previousTime ? (time - previousTime) / 1000 : 0;
      previousTime = time;
      const hadKey = journey.hasKey;
      const moving = active && !document.hidden && advanceJourney(roomIndex, journey, joystick.current?.vector ?? held.current.values(), elapsed);
      if (moving) footstep(time);
      if (!hadKey && journey.hasKey) chime('room');
      const progressKey = `${journey.percent}-${journey.hasKey}`;
      if (reported.current !== progressKey) {
        reported.current = progressKey;
        onProgress(journey.percent, journey.hasKey);
      }
      let nextNotice = defaultNotice;
      const branches = DETOURS[roomIndex];
      if (journey.route > 0) {
        const branch = branches[journey.route - 1];
        const hit = closestOnPath(branch.points, journey.position);
        nextNotice = hit.distance >= branch.length - 9
          ? { kind: 'blocked', text: OBSTACLE_MESSAGES[branch.obstacle] }
          : { kind: 'exploring', text: '这条小路通向哪里？走不通就沿原路回来。' };
      } else if (journey.hasKey && journey.percent < 100
        && Math.hypot(journey.position.x - room.points.at(-1)!.x, journey.position.y - room.points.at(-1)!.y) < 14) {
        nextNotice = { kind: 'door', text: '钥匙有啦，还有小路没走过，再逛一逛吧。' };
      } else if (journey.percent === 100 && journey.hasKey) {
        nextNotice = { kind: 'door', text: '风景都收藏好了，走进花门就能出发。' };
      } else if (branches.some((branch) => Math.hypot(journey.position.x - branch.points[0].x, journey.position.y - branch.points[0].y) < 16)) {
        nextNotice = { kind: 'fork', text: '身边有条岔路，朝想去的方向直接走吧。' };
      }
      if (noticeKey.current !== nextNotice.text) {
        noticeKey.current = nextNotice.text;
        setNotice(nextNotice);
      }
      drawScene(context, background, roomIndex, journey, time, moving, reducedMotion);
      if (journey.completed && !notified.current) {
        notified.current = true;
        stop();
        chime('room');
        onComplete(journey.trace);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, background, journey, onComplete, onProgress, reducedMotion, room, roomIndex, stop]);

  useEffect(() => {
    if (!active) { stop(); return; }
    const keyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const control = target?.closest<HTMLElement>('[data-direction]');
      const direction = control && (event.code === 'Space' || event.code === 'Enter')
        ? control.dataset.direction as Direction : keyboardDirections[event.code];
      if (!direction) return;
      event.preventDefault();
      if (event.repeat && !held.current.has(event.code)) return;
      held.current.set(event.code, direction);
    };
    const keyUp = (event: KeyboardEvent) => { held.current.delete(event.code); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', stop);
    window.addEventListener('resize', stop);
    window.visualViewport?.addEventListener('resize', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', stop);
      window.removeEventListener('resize', stop);
      window.visualViewport?.removeEventListener('resize', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [active, stop]);

  function moveJoystick(event: PointerEvent<HTMLDivElement>) {
    if (!active || joystick.current?.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = (bounds.width - (thumbRef.current?.offsetWidth ?? bounds.width)) / 2;
    if (radius <= 0) { resetJoystick(); return; }
    const offset = movementVector({
      x: (event.clientX - bounds.left - bounds.width / 2) / radius,
      y: (event.clientY - bounds.top - bounds.height / 2) / radius,
    });
    joystick.current.vector = joystickVector(offset);
    setJoystickOffset({ x: offset.x * radius, y: offset.y * radius });
  }

  function startJoystick(event: PointerEvent<HTMLDivElement>) {
    if (!active || document.hidden || joystick.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    joystick.current = { pointerId: event.pointerId, vector: { x: 0, y: 0 } };
    moveJoystick(event);
  }

  function endJoystick(event: PointerEvent<HTMLDivElement>) {
    if (joystick.current?.pointerId === event.pointerId) resetJoystick();
  }

  function hold(event: PointerEvent<HTMLButtonElement>, direction: Direction) {
    if (!active) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    held.current.set(`pointer-${event.pointerId}`, direction);
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    held.current.delete(`pointer-${event.pointerId}`);
  }

  return (
    <>
      <div className="scene-slot">
        <div className="scene-shell" data-trail-state={notice.kind}>
          <canvas ref={canvasRef} width={WORLD.width} height={WORLD.height} className="game-canvas" tabIndex={0}
            aria-label={`${room.name}游戏场景。WASD、方向键或触屏摇杆自由移动，可随时转向、后退和进入岔路。`}
            aria-describedby="game-instructions" onPointerDown={(event) => event.currentTarget.focus({ preventScroll: true })}
          >你的浏览器暂不支持画布，请使用支持 Canvas 的浏览器。下方方向控制同样可以操作游戏。</canvas>
          <div className="scene-label"><span className="live-dot" /> {room.description}</div>
          <div className="scene-coordinates" aria-hidden="true">{String(roomIndex + 1).padStart(2, '0')} / 04</div>
        </div>
      </div>
      <div className="game-controls" id="game-instructions">
        <div className="keyboard-guide"><strong>WASD / 方向键</strong><span>自由转向 · 随时回头 · 组合键斜走</span></div>
        <div ref={joystickRef} className={`joystick${joystickOffset ? ' joystick-active' : ''}`} role="group"
          aria-label="移动摇杆" aria-describedby="joystick-instructions" aria-disabled={!active} tabIndex={active ? 0 : -1}
          onPointerDown={startJoystick} onPointerMove={moveJoystick} onPointerUp={endJoystick}
          onPointerCancel={endJoystick} onLostPointerCapture={endJoystick} onContextMenu={(event) => event.preventDefault()}
        >
          <span ref={thumbRef} className="joystick-thumb" aria-hidden="true"
            style={{ transform: `translate(${joystickOffset?.x ?? 0}px, ${joystickOffset?.y ?? 0}px)` }}
          ><Icon name="Compass" size={22} /></span>
        </div>
        <div className="joystick-guide" id="joystick-instructions"><strong>拖动摇杆移动</strong><span>轻推慢走 · 松手停下</span></div>
        <div className="direction-pad" role="group" aria-label="移动方向">
          {(['up', 'left', 'down', 'right'] as const).map((direction) => (
            <Button key={direction} size="small" className={`direction-button direction-${direction}`} data-direction={direction}
              aria-label={directionLabels[direction]} disabled={!active}
              onPointerDown={(event) => hold(event, direction)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
              onClick={(event) => { if (active && !joystick.current && event.detail === 0) advanceJourney(roomIndex, journey, [direction], 0.05); }}
            ><span className={`arrow-icon arrow-${direction}`}><Icon name="Play" size={15} /></span></Button>
          ))}
        </div>
      </div>
      <div className={`trail-notice ${notice.kind === 'blocked' ? 'trail-blocked' : ''}`}>
        <p role="status"><Icon name={notice.kind === 'blocked' ? 'Flag' : 'Compass'} size={15} />{notice.text}</p>
      </div>
    </>
  );
}
