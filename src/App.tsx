import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Icon, Modal, Progress, Tag } from 'animal-island-ui';
import type { IconName } from 'animal-island-ui';
import { setSound } from './audio';
import GameBoard from './GameBoard';
import Ending from './Ending';
import PhotoWall, { preloadPhotos } from './PhotoWall';
import { ROOMS } from './game';
import type { Phase, RoomTrace } from './game';

const seasonIcons: IconName[] = ['Flower', 'Sun', 'Apple', 'Snowflake'];
const chapterNames = ['第一章', '第二章', '第三章', '第四章'];
const helpSteps = [
  { icon: 'Compass', title: '想往哪走，就朝哪个方向', text: '电脑用 WASD 或方向键，组合按键可以斜走。手机拖动摇杆自由转向，轻推慢走、推满快走，松手就停；小路里随时能回头。' },
  { icon: 'Key', title: '带上钥匙，收藏沿途风景', text: '靠近金色钥匙会自动拾取。把小院里的主路探索完整，再走进花门。回头不会丢钥匙，也不会减少进度。' },
  { icon: 'Map', title: '岔路也值得去看看', text: '朝岔路的方向直接走进去，不需要点击选路。遇到倒木、石堆、栅栏或断桥，沿原路回来就好。没有失败惩罚。' },
] as const;

export default function App() {
  const [roomIndex, setRoomIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('menu');
  const [progress, setProgress] = useState(0);
  const [hasKey, setHasKey] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpStep, setHelpStep] = useState(0);
  const [restartOpen, setRestartOpen] = useState(false);
  const [sound, setSoundState] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const [soundError, setSoundError] = useState('');
  const soundHandled = useRef(false);
  const [run, setRun] = useState(0);
  const [traces, setTraces] = useState<RoomTrace[]>([]);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const room = ROOMS[roomIndex];
  const isEnding = phase === 'reveal' || phase === 'proposal' || phase === 'success';
  const completed = isEnding ? 4 : roomIndex + (phase === 'room-complete' ? 1 : 0);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => { preference.removeEventListener('change', update); void setSound(false); };
  }, []);

  const updateProgress = useCallback((percent: number, collected: boolean) => {
    setProgress(percent);
    setHasKey(collected);
  }, []);
  const completeRoom = useCallback((trace: RoomTrace) => {
    setTraces((recorded) => [...recorded, trace]);
    setPhase(roomIndex === 3 ? 'reveal' : 'room-complete');
  }, [roomIndex]);

  function nextRoom() {
    setRoomIndex((index) => index + 1);
    setProgress(0);
    setHasKey(false);
    setPhase('playing');
  }

  function restart() {
    setRoomIndex(0);
    setProgress(0);
    setHasKey(false);
    setTraces([]);
    setPhase('playing');
    setRestartOpen(false);
    setRun((value) => value + 1);
  }

  async function changeSound(requested: boolean) {
    soundHandled.current = true;
    setSoundBusy(true);
    const enabled = await setSound(requested);
    setSoundState(enabled);
    setSoundError(requested && !enabled ? '当前浏览器暂时无法开启声音，不影响继续游戏。' : '');
    setSoundBusy(false);
  }

  function startGame() {
    if (!soundHandled.current) void changeSound(true);
    setPhase('playing');
    preloadPhotos();
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (roomIndex > 0 || progress > 0) setRestartOpen(true); }} aria-label="四季小径首页">
          <span className="brand-mark" aria-hidden="true"><Icon name="Leaf" size={23} /></span>
          <span><h1>四季小径</h1><small>A STROLL THROUGH THE SEASONS</small></span>
        </a>
        <div className="header-actions">
          <Button size="small" className="music-toggle" aria-pressed={sound} aria-label={sound ? '关闭音乐' : '开启音乐'} icon={<Icon name={sound ? 'Music' : 'Headphones'} size={18} />} onClick={() => void changeSound(!sound)} disabled={soundBusy}><span className="action-label">{sound ? '音乐已开启' : '开启音乐'}</span></Button>
          <Button type="text" size="small" aria-label="玩法说明" icon={<Icon name="Book" size={18} />} onClick={() => { setHelpStep(0); setHelpOpen(true); }}><span className="action-label">玩法说明</span></Button>
          {phase !== 'menu' ? <Button type="text" size="small" aria-label="重新开始" icon={<Icon name="Refresh" size={18} />} onClick={() => setRestartOpen(true)}><span className="action-label">重新开始</span></Button> : null}
        </div>
      </header>

      {soundError ? <p className="sound-error" role="status">{soundError}</p> : null}

      <main>
        {phase === 'menu' ? (
          <Card className="start-menu" aria-labelledby="start-title">
            <div className="start-seasons" aria-hidden="true">
              {seasonIcons.map((icon, index) => <span key={icon} className={`season-icon season-icon-${index}`}><Icon name={icon} size={26} /></span>)}
            </div>
            <h2 id="start-title">沿着小径，去看看四季</h2>
            <p className="start-description">穿过晨雾，捡起钥匙。<br />下一扇门后，会是什么风景呢？</p>
            <Button className="start-button" type="primary" size="large" icon={<Icon name="Play" size={18} />} onClick={startGame} autoFocus>开始游戏</Button>
            <p className="start-instructions">WASD / 方向键移动 · 手机拖动摇杆</p>
            <p className="start-music-note"><Icon name="Music" size={14} />开始后有音乐陪伴，可在右上角随时关闭</p>
          </Card>
        ) : phase === 'photos' ? (
          <PhotoWall onBack={() => setPhase('success')} />
        ) : isEnding ? (
          <Ending phase={phase} reducedMotion={reducedMotion} traces={traces} onPhase={setPhase} onRestart={() => setRestartOpen(true)} />
        ) : (
          <div className="game-layout">
            <Card className="game-card">
              <div className="game-card-heading">
                <div className="chapter-title"><Tag color="app-green" variant="soft" size="small">{chapterNames[roomIndex]}</Tag><h2>{room.name}</h2><span className="chapter-english">{room.season}</span></div>
                <span className="weather-note"><Icon name={seasonIcons[roomIndex]} size={18} />{['微风，花正开', '晴天，风很甜', '丰收，刚刚好', '初雪，心很暖'][roomIndex]}</span>
              </div>
              <GameBoard key={`${run}-${roomIndex}`} roomIndex={roomIndex} active={phase === 'playing' && !helpOpen && !restartOpen} reducedMotion={reducedMotion} onProgress={updateProgress} onComplete={completeRoom} />
              <div className="room-status"><span className={hasKey ? 'key-collected' : ''}><Icon name={hasKey ? 'Check' : 'Key'} size={15} />{hasKey ? '钥匙已收集' : '寻找金色钥匙'}</span><span>小径探索 <strong>{progress}%</strong></span></div>
              <div className="sr-only" role="status" aria-live="polite">{hasKey ? `${room.name}的钥匙已收集，请继续沿小路走向花门。` : `正在探索${room.name}。`}</div>
            </Card>

            <aside className="journey-sidebar" aria-label="四季旅程">
              <Card className="journey-card">
                <div className="sidebar-heading"><h2><Icon name="Map" size={18} /> 四季旅行册</h2><span>{completed}<small> / 4</small></span></div>
                <ol className="season-list">
                  {ROOMS.map((season, index) => {
                    const done = index < completed;
                    const current = index === roomIndex;
                    return <li key={season.id} className={`${current ? 'season-current' : ''} ${done ? 'season-done' : ''}`} aria-label={`${season.name}，${done ? '已完成' : current ? '探索中' : '未抵达'}`} aria-current={current ? 'step' : undefined}>
                      <span className={`season-icon season-icon-${index}`}><Icon name={seasonIcons[index]} size={23} /></span>
                      <div className="season-copy"><strong><span className="season-long">{season.name}</span><span className="season-short">{['春', '夏', '秋', '冬'][index]}</span></strong><small>{done ? '这片风景，已打卡' : current ? '正在探索这一片小院' : ['去池畔吹吹风', '苹果已经成熟啦', '去暖屋里歇歇脚'][index - 1]}</small></div>
                      <span className="season-state">{done ? <Icon name="Check" size={16} /> : current ? <span className="live-dot" /> : <Icon name="Lock" size={13} />}</span>
                    </li>;
                  })}
                </ol>
                <div className="journey-progress"><div><span>小院探索进度</span><span>{completed} / 4</span></div><Progress percent={completed * 25} size="small" variant="forest-grove" showInfo={false} aria-label="已完成房间进度" /></div>
                <p className="journey-note">每一扇门后，都是新风景。</p>
              </Card>
            </aside>
          </div>
        )}

      </main>

      <Modal className="viewport-modal" open={helpOpen} variant="game" title="小小冒险指南" width={460} typewriter={false} onClose={() => setHelpOpen(false)} footer={<>
        {helpStep > 0 ? <Button onClick={() => setHelpStep((step) => step - 1)}>上一步</Button> : <Button onClick={() => setHelpOpen(false)}>先去逛逛</Button>}
        <Button type="primary" onClick={() => helpStep < helpSteps.length - 1 ? setHelpStep((step) => step + 1) : setHelpOpen(false)}>{helpStep < helpSteps.length - 1 ? '下一步' : '出发吧'}</Button>
      </>}>
        <div className="help-step" aria-live="polite">
          <span className="help-step-index"><Icon name={helpSteps[helpStep].icon} size={24} /> {helpStep + 1} / {helpSteps.length}</span>
          <h3>{helpSteps[helpStep].title}</h3>
          <p>{helpSteps[helpStep].text}</p>
        </div>
      </Modal>

      <Modal className="viewport-modal" open={phase === 'room-complete'} variant="game" title={`${room.name}，已收藏`} width={430} typewriter={false} maskClosable={false} footer={<Button type="primary" icon={<Icon name="Leaf" size={18} />} onClick={nextRoom}>{`去${ROOMS[Math.min(roomIndex + 1, 3)].name}`}</Button>}>
        <div className="room-complete-message"><span><Icon name={seasonIcons[roomIndex]} size={46} /></span><p>{room.message}</p><small>旅行册打卡进度：{roomIndex + 1} / 4</small></div>
      </Modal>

      <Modal className="viewport-modal" open={restartOpen} variant="game" title="要重新开始旅行吗？" width={400} typewriter={false} onClose={() => setRestartOpen(false)} footer={<><Button onClick={() => setRestartOpen(false)}>留在这里</Button><Button type="primary" onClick={restart}>重新出发</Button></>}>
        <p>重新出发会清空这次的探索进度，回到春日花园的入口。</p>
      </Modal>
    </div>
  );
}
