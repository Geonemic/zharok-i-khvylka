import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN, findLevel } from '@zh/levels';
import { GameEngine, type LevelResult, type NetStatus } from '../game/engine';
import { isTyping } from '../game/input';
import { translate, useLang } from '../i18n';
import { saveResult } from '../progress';
import type { RoomClient, RoomView } from '../net/room';
import { GameChat } from './Chat';
import { Star } from './common';

const fmtTime = (ticks: number) => { const s = Math.floor(ticks / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function nextLevelId(id: string): string | null {
  const all = CAMPAIGN.flatMap((c) => c.levels.map((l) => l.id));
  const i = all.indexOf(id);
  return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
}

// online — гра з другом через кімнату; без нього — удвох на одній клавіатурі
export interface OnlineProps { room: RoomClient; view: RoomView; epoch: number }

export function GameScreen({ levelId, onExit, onNext, online }: { levelId: string; onExit: () => void; onNext: (id: string) => void; online?: OnlineProps }) {
  const { t, lang } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ r: LevelResult; improved: boolean } | null>(null);
  const [gray, setGray] = useState(false);
  const [net, setNet] = useState<NetStatus>({ waiting: false, desync: false });

  useEffect(() => {
    const data = findLevel(levelId);
    if (!data) return;
    const link = online ? { room: online.room, epoch: online.epoch, onStatus: setNet } : null;
    const engine = new GameEngine(canvasRef.current!, data, (k) => translate(lang, k), (r) => {
      const { improved } = saveResult(levelId, r);
      setResult({ r, improved });
    }, link);
    engineRef.current = engine;
    engine.start();
    if (import.meta.env.DEV) Object.assign(window, { __engine: engine }); // лише для налагодження з консолі
    return () => engine.stop();
  }, [levelId]); // мова змінюється окремо (нижче), без перезапуску рівня

  useEffect(() => { engineRef.current?.setTr((k) => translate(lang, k)); }, [lang]);
  useEffect(() => { engineRef.current?.setPaused(paused || !!result); }, [paused, result]);

  // онлайн перезапуск і перехід далі робить сервер, щоб обидва почали одночасно
  const restart = () => {
    if (online) { online.room.send({ t: 'start' }); return; }
    engineRef.current?.restart(); setResult(null); setPaused(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e)) return;
      if (e.code === 'Escape' && !result) setPaused((p) => !p);
      if (e.code === 'KeyR') restart();
      if (e.code === 'KeyG') setGray((g) => !g); // перевірка читабельності в градаціях сірого
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const next = nextLevelId(levelId);
  const me = online?.view.players.find((p) => p.slot === online.view.you);
  return (
    <div className="screen game">
      <canvas ref={canvasRef} className="game-canvas" style={{ filter: gray ? 'grayscale(1)' : undefined }} />
      {online && (
        <>
          <div className="net-badge">
            {me && <span className={me.hero ? 'water' : 'fire'}>{t('game.youAre', { hero: t(`hero.${me.hero}`) })}</span>}
            {online.view.ping !== null && <span className="muted"> · {t('game.ping', { ms: online.view.ping })}</span>}
          </div>
          {net.waiting && !result && <div className="net-banner">{t('game.waiting')}</div>}
          {net.desync && <div className="net-banner warn">{t('game.desync')}</div>}
          <GameChat client={online.room} view={online.view} />
        </>
      )}
      {paused && !result && (
        <div className="overlay">
          <div className="panel">
            <h2>{t(online ? 'game.menu' : 'pause.title')}</h2>
            <button className="btn primary" onClick={() => setPaused(false)} autoFocus>{t('pause.resume')}</button>
            <button className="btn" onClick={restart}>{t('pause.restart')}</button>
            <button className="btn ghost" onClick={onExit}>{t(online ? 'game.toLobby' : 'pause.exit')}</button>
          </div>
        </div>
      )}
      {result && (
        <div className="overlay">
          <div className="panel results">
            <h2 className="title small">{t('results.title')}</h2>
            <div className="result-stars">
              {[0, 1, 2].map((k) => (
                <span key={k} className={`slot s${k}`}>
                  <Star kind="empty" size={k === 1 ? 76 : 60} />
                  {k < result.r.stars && <Star kind="gold" size={k === 1 ? 76 : 60} className="pop" />}
                </span>
              ))}
            </div>
            <div className="slot diamond">
              <Star kind="empty" size={48} />
              {result.r.diamond && <Star kind="diamond" size={48} className="pop" />}
            </div>
            <p className={result.r.diamond ? 'dia-got' : 'dia-hint'}>{t(result.r.diamond ? 'results.diamondGot' : 'results.diamondHint')}</p>
            <p className="result-time">{t('results.time')} {fmtTime(result.r.time)}{result.improved && <span className="best"> · {t('results.newBest')}</span>}</p>
            <div className="row">
              <button className="btn" onClick={restart}>{t('results.again')}</button>
              {next && <button className="btn primary" onClick={() => onNext(next)} autoFocus>{t('results.next')}</button>}
              <button className="btn ghost" onClick={onExit}>{t(online ? 'game.toLobby' : 'results.menu')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
