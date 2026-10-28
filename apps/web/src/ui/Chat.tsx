import { useEffect, useRef, useState } from 'react';
import { MAX_CHAT } from '@zh/protocol';
import { useLang } from '../i18n';
import type { RoomClient, RoomView } from '../net/room';

function Line({ view, line }: { view: RoomView; line: RoomView['chat'][number] }) {
  const hero = view.players.find((p) => p.slot === line.from)?.hero;
  return <div className="chat-line"><b className={hero === 1 ? 'water' : 'fire'}>{line.name}:</b> {line.text}</div>;
}

function useSend(client: RoomClient) {
  const [text, setText] = useState('');
  const send = () => { const s = text.trim(); if (s) client.send({ t: 'chat', text: s }); setText(''); };
  return { text, setText, send };
}

// Чат у лобі: уся розмова й поле для повідомлення
export function ChatPanel({ client, view }: { client: RoomClient; view: RoomView }) {
  const { t } = useLang();
  const { text, setText, send } = useSend(client);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.scrollTo(0, list.current.scrollHeight); }, [view.chat.length]);
  return (
    <section className="chat panel-box">
      <h3>{t('chat.title')}</h3>
      <div className="chat-list" ref={list}>{view.chat.map((l) => <Line key={l.id} view={view} line={l} />)}</div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} maxLength={MAX_CHAT} placeholder={t('chat.placeholder')} onChange={(e) => setText(e.target.value)} />
        <button className="btn" type="submit">{t('chat.send')}</button>
      </form>
    </section>
  );
}

// Чат поверх гри: свіжі повідомлення видно кілька секунд; Enter — написати, Esc — назад до гри
export function GameChat({ client, view }: { client: RoomClient; view: RoomView }) {
  const { t } = useLang();
  const { text, setText, send } = useSend(client);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && !open) { e.preventDefault(); setOpen(true); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const now = Date.now(), recent = view.chat.filter((l) => open || now - l.at < 10000).slice(open ? -8 : -4);
  return (
    <div className="game-chat">
      {recent.map((l) => <Line key={l.id} view={view} line={l} />)}
      {open ? (
        <form onSubmit={(e) => { e.preventDefault(); send(); setOpen(false); }}>
          <input ref={input} value={text} maxLength={MAX_CHAT} placeholder={t('chat.placeholder')} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.code === 'Escape') { e.stopPropagation(); setOpen(false); } }} onBlur={() => setOpen(false)} />
        </form>
      ) : <div className="chat-hint">{t('chat.hint')}</div>}
    </div>
  );
}
