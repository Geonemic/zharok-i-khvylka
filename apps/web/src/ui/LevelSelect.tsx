import { CAMPAIGN } from '@zh/levels';
import { useLang } from '../i18n';
import { loadProgress } from '../progress';
import { LangSwitch, Star } from './common';

// Вибір рівня. Пізніше його замінить меню-планета (етап 4).
export function LevelSelect({ onBack, onPick }: { onBack: () => void; onPick: (id: string) => void }) {
  const { t } = useLang();
  const progress = loadProgress();
  return (
    <div className="screen select">
      <div className="topbar"><button className="btn ghost" onClick={onBack}>{t('select.back')}</button><LangSwitch /></div>
      {CAMPAIGN.map((country) => {
        let prevDone = true;
        return (
          <section key={country.id} className="country">
            <h2>{t(`country.${country.id}`)}</h2>
            <div className="cards">
              {Array.from({ length: country.planned }, (_, i) => {
                const lvl = country.levels[i], id = lvl?.id ?? `${country.id}-${i + 1}`, best = progress[id];
                const open = !!lvl && prevDone;
                prevDone = !!best;
                return (
                  <button key={id} className={`card ${open ? '' : 'locked'}`} disabled={!open} onClick={() => onPick(id)}>
                    <span className="num">{i + 1}</span>
                    <span className="name">{t(`level.${id}`)}</span>
                    <span className="stars">
                      {[0, 1, 2].map((k) => <Star key={k} kind={best && k < best.stars ? 'gold' : 'empty'} />)}
                      <Star kind={best?.diamond ? 'diamond' : 'empty'} size={15} />
                    </span>
                    <span className="hint">{!lvl ? t('select.soon') : open ? `▶ ${t('select.play')}` : `🔒 ${t('select.locked')}`}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
