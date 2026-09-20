import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Button, Card, Icon, Tag } from 'animal-island-ui';
import { chime } from './audio';
import { escapePosition, letterPoints, ROOMS, traceBounds } from './game';
import type { Phase, Point, RoomTrace } from './game';
import { createScenery, drawGirl } from './scenery';

function MemoryLetter({ roomIndex, trace }: { roomIndex: number; trace: RoomTrace }) {
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const room = ROOMS[roomIndex];
  const frame = useMemo(() => trace.main.flat(), [trace]);
  useEffect(() => {
    const context = backgroundRef.current?.getContext('2d');
    if (!context) return;
    const { minX, minY, width, height } = traceBounds(frame);
    const scale = Math.min(90 / width, 110 / height);
    context.imageSmoothingEnabled = false;
    context.setTransform(scale, 0, 0, scale, (120 - width * scale) / 2 - minX * scale, (140 - height * scale) / 2 - minY * scale);
    context.drawImage(createScenery(roomIndex), 0, 0);
  }, [frame, roomIndex]);
  return (
    <div className="memory-letter" style={{ '--delay': `${roomIndex * 0.24}s` } as CSSProperties}>
      <canvas ref={backgroundRef} width={120} height={140} aria-hidden="true" />
      <svg viewBox="0 0 120 140" aria-hidden="true">
        <g className="detour-traces">{trace.detours.map((detour, index) => <polyline key={index} points={letterPoints(detour, frame)} fill="none" stroke="#b3aa91" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} />)}</g>
        {trace.main.map((segment, index) => <polyline key={index} className="main-trace" points={letterPoints(segment, frame)} fill="none" stroke="currentColor" strokeWidth={roomIndex === 3 ? 7 : 11} strokeLinecap="round" strokeLinejoin="round" pathLength={1} />)}
      </svg>
      <span>{room.name}</span>
    </div>
  );
}

function Couple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    drawGirl(context, 37, 50);
    context.fillStyle = '#715c4a';
    context.fillRect(57, 28, 10, 8);
    context.fillStyle = '#e8c69f';
    context.fillRect(57, 33, 8, 7);
    context.fillStyle = '#6f896f';
    context.fillRect(56, 40, 12, 8);
    context.fillStyle = '#f4e6c9';
    context.fillRect(54, 40, 3, 6);
    context.fillRect(52, 44, 5, 2);
    context.fillStyle = '#6b6255';
    context.fillRect(57, 48, 4, 4);
    context.fillRect(64, 48, 4, 4);
    context.fillStyle = '#d19491';
    context.fillRect(45, 14, 4, 4);
    context.fillRect(51, 14, 4, 4);
    context.fillRect(43, 16, 14, 4);
    context.fillRect(45, 20, 10, 3);
    context.fillRect(47, 23, 6, 2);
    context.fillRect(49, 25, 2, 2);
    context.fillStyle = '#a4b889';
    context.fillRect(21, 53, 57, 2);
    context.fillStyle = '#cad6b0';
    context.fillRect(26, 55, 48, 1);
  }, []);
  return <canvas ref={canvasRef} width={100} height={62} className="couple-art" role="img" aria-label="像素小人站在一起，头顶一颗爱心" />;
}

type Props = {
  phase: Phase;
  reducedMotion: boolean;
  traces: readonly RoomTrace[];
  onPhase: (phase: Phase) => void;
  onRestart: () => void;
};

export default function Ending({ phase, reducedMotion, traces, onPhase, onRestart }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [escapes, setEscapes] = useState(0);
  const [position, setPosition] = useState<Point | null>(null);
  const lastEscape = useRef(0);
  const reveal = phase === 'reveal';
  const success = phase === 'success';

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    if (phase !== 'reveal') return;
    chime('love');
    const timer = window.setTimeout(() => onPhase('proposal'), reducedMotion ? 2600 : 8800);
    return () => clearTimeout(timer);
  }, [onPhase, phase, reducedMotion]);

  useEffect(() => {
    const resetPosition = () => setPosition(null);
    const observer = new ResizeObserver(resetPosition);
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener('resize', resetPosition);
    return () => { observer.disconnect(); window.removeEventListener('resize', resetPosition); };
  }, [phase]);

  function dodge(button: HTMLButtonElement) {
    if (performance.now() - lastEscape.current < 280) return;
    const area = stageRef.current;
    if (!area) return;
    lastEscape.current = performance.now();
    const inset = 8;
    const region = { width: area.clientWidth - inset * 2, height: area.clientHeight - inset * 2 };
    const bounds = { width: button.offsetWidth, height: button.offsetHeight };
    const current = { x: button.offsetLeft - inset, y: button.offsetTop - inset };
    const next = escapePosition(region, bounds, current);
    setPosition({ x: next.x + inset, y: next.y + inset });
    setEscapes((count) => count + 1);
    chime('escape');
  }

  function dodgePointer(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    dodge(event.currentTarget);
  }

  return (
    <Card className={`ending-card ${reveal ? 'is-revealing' : 'is-revealed'} ${success ? 'is-success' : ''}`}>
      <div className="ending-flower flower-left" aria-hidden="true"><Icon name="Flower" size={47} /></div>
      <div className="ending-flower flower-right" aria-hidden="true"><Icon name="Flower" size={39} /></div>
      <div className="ending-top">
        <Tag color="warm-peach-pink" variant="soft"><Icon name="Heart" size={14} /> {success ? '我们的故事，未完待续' : reveal ? '原来，每一步都有答案' : '有一句话，想认真对你说'}</Tag>
        <h2 ref={headingRef} tabIndex={-1} className="ending-heading">
          {success ? '余生，请多指教。' : reveal ? '回头看，是我爱你的形状。' : '你愿意嫁给我吗'}
        </h2>
        <p className="ending-description">{success ? '从今天起，每一个四季，我们都一起走。' : reveal ? '那些一起走过的小路，悄悄藏着我的心意。' : '走过春夏秋冬，最想抵达的地方，始终是你身边。'}</p>
      </div>
      <div className="ending-visuals">
        <div className="love-word" role="img" aria-label="刚刚走过的四条路径回放，并组合成 LOVE">
          {ROOMS.map((room, roomIndex) => <MemoryLetter roomIndex={roomIndex} trace={traces[roomIndex]} key={room.id} />)}
        </div>
        {!reveal ? <Couple /> : null}
      </div>
      <div className="ending-bottom">
      {reveal ? (
        <div className="reveal-caption" aria-live="polite"><Icon name="Heart" size={17} /> 正在把走过的四季，拼成一句告白…</div>
      ) : (
        <>
          {success ? (
            <div className="success-content">
              <p>你说“愿意”的这一刻，是我最喜欢的风景。</p>
              <div className="promise-date">{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())} · 我们的幸福起点</div>
              <div className="success-actions">
                <Button type="primary" icon={<Icon name="Camera" size={17} />} onClick={() => onPhase('photos')}>看看我们的照片墙</Button>
                <Button type="text" icon={<Icon name="Refresh" size={17} />} onClick={onRestart}>再一起走一遍</Button>
              </div>
              <div className="confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--index': index, '--x': `${(index * 43) % 100}%`, '--time': `${(index % 7) * 0.25}s` } as CSSProperties} />)}</div>
            </div>
          ) : (
            <div className="proposal-actions">
              <Button className="yes-button" type="primary" size="large" icon={<Icon name="Heart" size={20} />} onClick={() => { chime('yes'); onPhase('success'); }}>愿意</Button>
              <div className="escape-stage" ref={stageRef}>
                <Button
                  className={`no-button ${position ? 'has-escaped' : ''}`}
                  style={position ? { left: position.x, top: position.y, transform: `rotate(${escapes % 2 ? -5 : 5}deg)` } : undefined}
                  aria-describedby="escape-hint"
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') dodge(event.currentTarget); }}
                  onPointerDown={dodgePointer}
                  onClick={(event) => dodge(event.currentTarget)}
                >不愿意</Button>
              </div>
              <p className="escape-hint" id="escape-hint" aria-live="polite">{escapes === 0 ? '有一颗心，正在认真等你的答案。' : escapes < 3 ? '咦，它好像有一点害羞，躲起来了。' : '别急着回答，我会一直在这里等你。'}</p>
              <Button type="text" size="small" onClick={onRestart}>我想再走走</Button>
            </div>
          )}
        </>
      )}
      </div>
    </Card>
  );
}
