import { useEffect, useState } from 'react';
import { CAMPAIGN } from '@zh/levels';
import { MAX_NAME, ROOM_CODE_CHARS, ROOM_CODE_LEN } from '@zh/protocol';
import { useLang } from '../i18n';
import { RoomClient, newRoomCode, useRoom, type RoomView } from '../net/room';
import { ChatPanel } from './Chat';
import { GameScreen } from './GameScreen';
import { LangSwitch } from './common';

const loadName = () => { try { return localStorage.getItem('zh-name') ?? ''; } catch { return ''; } };
const saveName = (n: string) => { try { localStorage.setItem('zh-name', n); } catch { /* лише на цю сесію */ } };

// Онлайн: вхід (ім'я, створити чи приєднатися) → лобі з чатом → гра
export function Online({ invite, onExit }: { invite: string; onExit: () => void }) {
  const [client, setClient] = useState<RoomClient | null>(null);
  const view = useRoom(client);
  useEffect(() => () => client?.close(), [client]);
  const leave = () => setClient(null);

  if (!client || !view || view.status === 'closed') {
    const error = view ? view.error ?? 'closed' : null;
    return <Entry invite={invite} error={error} onBack={onExit} onConnect={(code, name, mode) => setClient(new RoomClient(code, name, mode))} />;
  }
  if (view.status === 'connecting') return <Connecting onBack={leave} />;
  if (view.game) {
    return (
      <GameScreen
        key={view.game.epoch}
        levelId={view.game.level}
        online={{ room: client, view, epoch: view.game.epoch }}
        onExit={() => client.send({ t: 'lobby' })}
        onNext={(id) => client.send({ t: 'start', level: id })}
      />
    );
  }
  return <Lobby client={client} view={view} onLeave={leave} />;
}

function Connecting({ onBack }: { onBack: () => void }) {
  const { t } = useLang();
  return (
    <div className="screen online">
      <div className="topbar"><button className="btn ghost" onClick={onBack}>{t('select.back')}</button><LangSwitch /></div>
      <p className="subtitle">{t('online.connecting')}</p>
    </div>
  );
}

function Entry({ invite, error, onBack, onConnect }: {
  invite: string; error: string | null; onBack: () => void; onConnect: (code: string, name: string, mode: 'create' | 'join') => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(invite);
  const [warn, setWarn] = useState<string | null>(null);
  const go = (mode: 'create' | 'join') => {
    const n = name.trim();
    if (!n) { setWarn('bad'); return; }
    saveName(n);
    onConnect(mode === 'create' ? newRoomCode() : code, n, mode);
  };
  const shown = warn ?? error;
  return (
    <div className="screen online">
      <div className="topbar"><button className="btn ghost" onClick={onBack}>{t('select.back')}</button><LangSwitch /></div>
      <h1 className="title small">{t('online.title')}</h1>
      <div className="panel-box entry">
        <label>{t('online.name')}
          <input value={name} maxLength={MAX_NAME} placeholder={t('online.namePh')} autoFocus={!name}
            onChange={(e) => { setName(e.target.value); setWarn(null); }} />
        </label>
        {!invite && <button className="btn primary" onClick={() => go('create')}>{t('online.create')}</button>}
        <p className="muted">{t('online.or')}</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); go('join'); }}>
          <input className="code-input" value={code} placeholder={t('online.code')} maxLength={ROOM_CODE_LEN}
            onChange={(e) => setCode([...e.target.value.toUpperCase()].filter((c) => ROOM_CODE_CHARS.includes(c)).join(''))} />
          <button className={`btn ${invite ? 'primary' : ''}`} type="submit" disabled={code.length !== ROOM_CODE_LEN} autoFocus={!!invite && !!name}>{t('online.join')}</button>
        </form>
        {shown && <p className="error">{t(`online.err.${shown}`)}</p>}
      </div>
    </div>
  );
}

function HeroBadge({ hero }: { hero: 0 | 1 }) {
  return <span className={`hero-badge ${hero ? 'water' : 'fire'}`}>{hero ? '💧' : '🔥'}</span>;
}

function Lobby({ client, view, onLeave }: { client: RoomClient; view: RoomView; onLeave: () => void }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?room=${view.code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* браузер не дозволив — код видно й так */ }
  };
  const both = view.players.length === 2;
  return (
    <div className="screen online lobby">
      <div className="topbar"><button className="btn ghost" onClick={onLeave}>{t('lobby.leave')}</button><LangSwitch /></div>
      <div className="lobby-grid">
        <section className="panel-box">
          <p className="muted">{t('lobby.room')}</p>
          <div className="room-code">{view.code}</div>
          <button className="btn" onClick={copy}>{copied ? t('lobby.copied') : t('lobby.copy')}</button>
          <p className="muted small">{t('lobby.invite')}</p>
          <div className="players">
            {view.players.map((p) => (
              <div key={p.slot} className="player">
                <HeroBadge hero={p.hero} />
                <span><b>{p.name}</b>{p.slot === view.you && <span className="muted"> ({t('lobby.you')})</span>}<br /><span className="muted small">{t(`hero.${p.hero}`)}</span></span>
              </div>
            ))}
            {!both && <div className="player empty">{t('lobby.waiting')}</div>}
          </div>
          {view.partnerLeft && <p className="error">{t('lobby.partnerLeft')}</p>}
          <button className="btn" onClick={() => client.send({ t: 'swap' })}>⇄ {t('lobby.swap')}</button>
          <label className="level-pick">{t('lobby.level')}
            <select value={view.level} onChange={(e) => client.send({ t: 'level', id: e.target.value })}>
              {CAMPAIGN.map((c) => (
                <optgroup key={c.id} label={t(`country.${c.id}`)}>
                  {c.levels.map((l) => <option key={l.id} value={l.id}>{t(`level.${l.id}`)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={!both} onClick={() => client.send({ t: 'start' })}>{t('lobby.start')}</button>
          {view.ping !== null && <p className="muted small">{t('lobby.ping', { ms: view.ping })}</p>}
        </section>
        <ChatPanel client={client} view={view} />
      </div>
    </div>
  );
}
