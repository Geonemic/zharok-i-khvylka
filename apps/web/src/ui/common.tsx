import { useEffect, useRef } from 'react';
import { drawZharok, drawKhvylka, type Pose } from '../render/characters';
import { drawGlow, GLOW } from '../render/draw';
import { LANGS, useLang } from '../i18n';

const STAR_D = (() => {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? 4.8 : 10; d += `${i ? 'L' : 'M'}${(Math.cos(a) * q).toFixed(2)} ${(Math.sin(a) * q).toFixed(2)}`; }
  return d + 'Z';
})();

export function Star({ kind, size = 18, className }: { kind: 'gold' | 'empty' | 'diamond'; size?: number; className?: string }) {
  const [f, s] = { gold: ['#ffd23f', '#7a4a08'], empty: ['#272148', '#4a4380'], diamond: ['#9fe6ff', '#2a4a8a'] }[kind];
  return (
    <svg className={className} viewBox="-12 -12 24 24" width={size} height={size} aria-hidden>
      <path d={STAR_D} fill={f} stroke={s} strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang">
      {LANGS.map((l) => (
        <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}

// Живі герої в меню: дихають, моргають, поглядають одне на одного
export function HeroesPreview({ size = 240 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!, dpr = Math.min(devicePixelRatio || 1, 2);
    const w = size * 2, h = size;
    c.width = w * dpr; c.height = h * dpr;
    let raf = 0;
    const blink = [0, 0], nextBlink = [90, 160];
    let tick = 0;
    const frame = (now: number) => {
      const t = now / 1000;
      tick++;
      for (const i of [0, 1]) {
        if (--nextBlink[i] <= 0) { nextBlink[i] = 120 + Math.random() * 200; blink[i] = 10; }
        if (blink[i] > 0) blink[i]--;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const k = h / 70;
      const look = Math.sin(t * 0.6) > 0.2;
      for (const i of [0, 1]) {
        const x = w / 2 + (i ? 1 : -1) * w * 0.17, y = h * 0.88, hop = Math.max(0, Math.sin(t * 1.5 + i * 1.8)) ** 8;
        g.globalCompositeOperation = 'lighter';
        drawGlow(g, i ? GLOW.water : GLOW.fire, x, y - h * 0.32, h * 0.55, i ? 0.25 : 0.35);
        g.globalCompositeOperation = 'source-over';
        g.save(); g.translate(x, y - hop * h * 0.12); g.scale(k, k);
        g.translate(0, Math.sin(t * 3.2 + i * 1.4) * 1.1);
        const pose: Pose = {
          vx: 0, vy: hop > 0.05 ? -3 : 0, grounded: hop < 0.05, facing: i ? -1 : 1, linkDir: look ? (i ? -1 : 1) : 0,
          blink: blink[i] > 0 ? Math.sin((Math.PI * blink[i]) / 10) : 0, runPhase: 0, happy: look,
        };
        if (i) drawKhvylka(g, pose, t); else drawZharok(g, pose, t);
        g.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return <canvas ref={ref} className="heroes" style={{ width: size * 2, height: size }} aria-hidden />;
}
