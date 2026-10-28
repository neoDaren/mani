import { useEffect, useState, type ReactNode } from 'react';
import { ensureSeed } from './db';
import { IconCard, IconChart, IconHome, IconList } from './components/icons';
import { ToastProvider } from './components/ui';
import { Accounts } from './screens/Accounts';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';

type Tab = 'home' | 'accounts' | 'history' | 'stats';
const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'home', label: 'Главная', icon: <IconHome /> },
  { key: 'accounts', label: 'Счета', icon: <IconCard /> },
  { key: 'history', label: 'История', icon: <IconList /> },
  { key: 'stats', label: 'Статистика', icon: <IconChart /> },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [settings, setSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    ensureSeed()
      .then(() => setReady(true))
      .catch((e) => {
        console.error(e);
        setFatal('Не удалось открыть данные. Закройте приложение и откройте снова.');
      });
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  if (fatal) return <div className="screen"><h1 className="title">Мани</h1><p className="error">{fatal}</p></div>;
  if (!ready) return null;

  const go = (t: Tab) => { setSettings(false); setTab(t); };

  return (
    <ToastProvider>
      <div className="app">
        {settings ? (
          <Settings onBack={() => setSettings(false)} />
        ) : (
          <>
            {tab === 'home' && <Home goAccounts={() => go('accounts')} goHistory={() => go('history')} goSettings={() => setSettings(true)} />}
            {tab === 'accounts' && <Accounts />}
            {tab === 'history' && <History />}
            {tab === 'stats' && <Stats />}
          </>
        )}
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.key} className={!settings && tab === t.key ? 'active' : ''} onClick={() => go(t.key)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
