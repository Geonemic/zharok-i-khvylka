import { parseLevel, type LevelData } from './format';
import ua1 from '../data/ua-1.json';
import it1 from '../data/it-1.json';
import fr1 from '../data/fr-1.json';

export * from './format';

// Кампанія: країни в порядку маршруту (див. docs/design.md, розділ 2). Поки готова лише частина рівнів.
export interface CampaignCountry {
  id: string;
  levels: LevelData[];
  planned: number;
}

export const CAMPAIGN: CampaignCountry[] = [
  { id: 'ua', levels: [parseLevel(ua1)], planned: 3 },
  { id: 'it', levels: [parseLevel(it1)], planned: 3 },
  { id: 'fr', levels: [parseLevel(fr1)], planned: 3 },
];

export function findLevel(id: string): LevelData | undefined {
  for (const c of CAMPAIGN) for (const l of c.levels) if (l.id === id) return l;
  return undefined;
}
