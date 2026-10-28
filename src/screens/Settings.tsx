import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import {
  addCategory, deleteCategory, exportBackup, exportCsv, importBackup, listCategories, renameCategory,
  validateBackup, type Backup,
} from '../db';
import { errorText, Sheet, useToast } from '../components/ui';
import { markBackupDone, lastBackupAt } from '../lib/backupReminder';
import { IconBack } from '../components/icons';

const VERSION = '0.2.1';

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Отдать файл: на iPhone — через меню «Поделиться» (там «Сохранить в Файлы»), иначе — загрузкой */
async function shareFile(content: string, name: string, type: string): Promise<boolean> {
  const file = new File([content], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

function CategoryList({ type }: { type: 'expense' | 'income' }) {
  const toast = useToast();
  const cats = useLiveQuery(listCategories, []);
  const list = cats?.[type] ?? [];
  const [edit, setEdit] = useState<{ name: string; value: string; remove: boolean; moveTo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const open = (name: string) => {
    setError(null);
    const fallback = type === 'expense' ? 'Другое' : 'Прочее';
    const moveTo = name !== fallback && list.includes(fallback) ? fallback : (list.find((c) => c !== name) ?? '');
    setEdit({ name, value: name, remove: false, moveTo });
  };

  return (
    <>
      <div className="chips" style={{ marginBottom: 10 }}>
        {list.map((c) => <button key={c} className="chip" onClick={() => open(c)}>{c}</button>)}
        <button className="chip" onClick={() => { setError(null); setAdding(''); }}>＋ Добавить</button>
      </div>
      {adding !== null && (
        <Sheet title="Новая категория" onClose={() => setAdding(null)}>
          <input className="input field" autoFocus value={adding} placeholder="Например: Кредит"
            onChange={(e) => setAdding(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button className="btn" onClick={async () => {
            try { await addCategory(type, adding); toast('Категория добавлена'); setAdding(null); } catch (e) { setError(errorText(e)); }
          }}>Добавить</button>
        </Sheet>
      )}
      {edit && (
        <Sheet title={edit.name} onClose={() => setEdit(null)}>
          {!edit.remove ? (
            <>
              <div className="label">Название</div>
              <input className="input field" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
              <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>Название поменяется и во всех старых операциях.</p>
              {error && <div className="error">{error}</div>}
              <button className="btn" onClick={async () => {
                try { await renameCategory(type, edit.name, edit.value); toast('Категория переименована'); setEdit(null); } catch (e) { setError(errorText(e)); }
              }}>Сохранить</button>
              <button className="btn danger" style={{ marginTop: 8 }} onClick={() => setEdit({ ...edit, remove: true })}>Удалить категорию</button>
            </>
          ) : (
            <>
              <div className="label">Куда перенести операции этой категории</div>
              <select className="select input field" value={edit.moveTo} onChange={(e) => setEdit({ ...edit, moveTo: e.target.value })}>
                {list.filter((c) => c !== edit.name).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {error && <div className="error">{error}</div>}
              <div className="btns">
                <button className="btn secondary" onClick={() => setEdit({ ...edit, remove: false })}>Отмена</button>
                <button className="btn" style={{ background: 'var(--danger)' }} onClick={async () => {
                  try { await deleteCategory(type, edit.name, edit.moveTo); toast('Категория удалена'); setEdit(null); } catch (e) { setError(errorText(e)); }
                }}>Удалить</button>
              </div>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}

export function Settings({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [last, setLast] = useState<number | null>(lastBackupAt());

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const backup = async () => {
    const data = await exportBackup();
    const ok = await shareFile(JSON.stringify(data), `mani-backup-${stamp()}.json`, 'application/json');
    if (ok) {
      markBackupDone();
      setLast(Date.now());
      toast('Копия сохранена');
    }
  };

  const pick = async (file: File) => {
    try {
      const data = validateBackup(JSON.parse(await file.text()));
      setPending(data);
    } catch (e) {
      toast(e instanceof SyntaxError ? 'Это не файл резервной копии «Мани»' : errorText(e));
    }
  };

  return (
    <div className="screen">
      <button className="back" onClick={onBack}><IconBack /> Главная</button>
      <h1 className="title">Настройки</h1>

      <div className="subtitle">Категории расходов</div>
      <CategoryList type="expense" />
      <div className="subtitle">Категории доходов</div>
      <CategoryList type="income" />

      <div className="subtitle">Резервная копия</div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          Последняя: {last ? new Date(last).toLocaleDateString('ru-RU') : 'не было'}
        </p>
        <div className="btns">
          <button className="btn" onClick={backup}>Сохранить</button>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>Восстановить</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) pick(f);
        }} />
      </div>

      <div className="list">
        <button className="item" onClick={async () => {
          const ok = await shareFile(await exportCsv(), `mani-${stamp()}.csv`, 'text/csv');
          if (ok) toast('Таблица готова');
        }}>
          <span className="ico">📄</span>
          <span className="main"><div className="name">Экспорт в таблицу (CSV)</div></span>
        </button>
        <button className="item" onClick={async () => {
          const ok = await navigator.storage?.persist?.();
          setPersisted(!!ok);
          toast(ok ? 'Хранилище защищено от автоочистки' : 'iOS не разрешила — сохраняйте копии');
        }}>
          <span className="ico">🛡️</span>
          <span className="main">
            <div className="name">Постоянное хранилище</div>
            <div className="sub">{persisted ? 'Включено' : persisted === false ? 'Выключено' : 'Недоступно'}</div>
          </span>
        </button>
      </div>

      <p className="hint" style={{ textAlign: 'center' }}>Мани {VERSION}</p>

      {pending && (
        <Sheet title="Восстановить из копии?" onClose={() => setPending(null)}>
          <div className="card">
            <div>Копия от {new Date(pending.exportedAt).toLocaleString('ru-RU')}</div>
            <div className="muted small">Счетов: {pending.accounts.length}, операций: {pending.transactions.length}</div>
          </div>
          <p className="error">Все текущие данные на телефоне будут заменены данными из копии.</p>
          <div className="btns">
            <button className="btn secondary" onClick={() => setPending(null)}>Отмена</button>
            <button className="btn" onClick={async () => {
              try {
                const r = await importBackup(pending);
                toast(`Восстановлено: ${r.transactions} операций`);
                setPending(null);
              } catch (e) { toast(errorText(e)); }
            }}>Заменить</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
