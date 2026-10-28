import { useLang } from '../i18n';
import { HeroesPreview, LangSwitch } from './common';

function Keys({ keys }: { keys: string[] }) {
  return <>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</>;
}

export function Menu({ onPlay, onOnline }: { onPlay: () => void; onOnline: () => void }) {
  const { t } = useLang();
  return (
    <div className="screen menu">
      <div className="topbar"><span /><LangSwitch /></div>
      <h1 className="title">{t('app.title')}</h1>
      <p className="subtitle">{t('app.subtitle')}</p>
      <HeroesPreview size={170} />
      <div className="menu-buttons">
        <button className="btn primary" onClick={onPlay} autoFocus>{t('menu.playLocal')}</button>
        <button className="btn" onClick={onOnline}>{t('menu.online')}</button>
      </div>
      <section className="controls">
        <h2>{t('controls.title')}</h2>
        <div className="controls-grid">
          <b className="fire">{t('controls.zharok')}</b><span><Keys keys={['A', 'D']} /> {t('controls.move')} · <Keys keys={['W']} /> {t('controls.jump')} · <Keys keys={['S']} /> {t('controls.link')}</span>
          <b className="water">{t('controls.khvylka')}</b><span><Keys keys={['←', '→']} /> {t('controls.move')} · <Keys keys={['↑']} /> {t('controls.jump')} · <Keys keys={['↓']} /> {t('controls.link')}</span>
          <b /><span><Keys keys={['Esc']} /> {t('controls.pause')} · <Keys keys={['R']} /> {t('controls.restart')}</span>
          <b /><span>{t('controls.online')}</span>
        </div>
      </section>
    </div>
  );
}
