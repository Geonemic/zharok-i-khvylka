import { useState } from 'react';
import { Menu } from './ui/Menu';
import { LevelSelect } from './ui/LevelSelect';
import { GameScreen } from './ui/GameScreen';
import { Online } from './ui/Online';

type Screen = { name: 'menu' } | { name: 'select' } | { name: 'game'; levelId: string } | { name: 'online' };

// Посилання-запрошення має вигляд …/?room=КОД — тоді одразу відкриваємо онлайн
const inviteCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';

export function App() {
  const [screen, setScreen] = useState<Screen>(inviteCode ? { name: 'online' } : { name: 'menu' });
  switch (screen.name) {
    case 'menu':
      return <Menu onPlay={() => setScreen({ name: 'select' })} onOnline={() => setScreen({ name: 'online' })} />;
    case 'select':
      return <LevelSelect onBack={() => setScreen({ name: 'menu' })} onPick={(levelId) => setScreen({ name: 'game', levelId })} />;
    case 'game':
      return (
        <GameScreen
          key={screen.levelId}
          levelId={screen.levelId}
          onExit={() => setScreen({ name: 'select' })}
          onNext={(levelId) => setScreen({ name: 'game', levelId })}
        />
      );
    case 'online':
      return <Online invite={inviteCode} onExit={() => { history.replaceState(null, '', location.pathname); setScreen({ name: 'menu' }); }} />;
  }
}
