import { useEffect, useState } from 'react';
import { ensureSeed } from './db';
import { ToastProvider } from './components/ui';
import { Accounts } from './screens/Accounts';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';

type Tab = 'home' | 'accounts' | 'history' | 'stats' | 'settings';
const TABS: { key: Tab; label: string; ico: string }[] = [
  { key: 'home', label: 'Главная', ico: '🏠' },
  { key: 'accounts', label: 'Счета', ico: '💳' },
  { key: 'history', label: 'История', ico: '🧾' },
  { key: 'stats', label: 'Статистика', ico: '📊' },
  { key: 'settings', label: 'Настройки', ico: '⚙️' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    ensureSeed()
      .then(() => setReady(true))
      .catch((e) => {
        console.error(e);
        setFatal('Не удалось открыть базу на телефоне. Закройте приложение и откройте снова; если не помогло — проверьте свободное место.');
      });
    // Просим iOS не очищать данные автоматически (FR-29)
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  if (fatal) return <div className="screen"><h1 className="title">Мани</h1><p className="error">{fatal}</p></div>;
  if (!ready) return null;

  return (
    <ToastProvider>
      <div className="app">
        {tab === 'home' && <Home goAccounts={() => setTab('accounts')} goHistory={() => setTab('history')} goSettings={() => setTab('settings')} />}
        {tab === 'accounts' && <Accounts />}
        {tab === 'history' && <History />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              <span className="ico">{t.ico}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
