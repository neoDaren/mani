import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { balances, db, getStats, listAccounts, listCategories, listTx, KIND_ICONS, type Tx } from '../db';
import { backupDue } from '../lib/backupReminder';
import { formatMoney } from '../lib/format';
import { periodRange } from '../lib/periods';
import { parseRequest } from '../lib/request';
import { TxEditor, type EditorValue } from '../components/TxEditor';
import { TxRow } from '../components/TxRow';
import { useToast } from '../components/ui';

const EXAMPLES = ['такси 50 тысяч', 'вчера обед 45к с Humo', 'пришла зарплата 5 млн'];

export function Home({ goAccounts, goHistory, goSettings }: { goAccounts: () => void; goHistory: () => void; goSettings: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [editor, setEditor] = useState<{ value: EditorValue; title: string } | null>(null);

  const data = useLiveQuery(async () => {
    const [today, month] = [periodRange('day'), periodRange('month')];
    const accounts = await listAccounts();
    const bal = await balances();
    return {
      accounts,
      bal,
      total: accounts.reduce((s, a) => s + (bal.get(a.id!) ?? 0), 0),
      today: await getStats(...today),
      month: await getStats(...month),
      recent: (await listTx()).slice(0, 5),
      categories: await listCategories(),
      txCount: await db.transactions.count(),
    };
  }, []);

  const defaultAccount = data?.accounts.find((a) => a.isDefault) ?? data?.accounts[0];

  const parse = () => {
    if (!data || !text.trim()) return;
    const d = parseRequest(text, {
      accounts: data.accounts.map((a) => ({ id: a.id!, name: a.name, kind: a.kind, isDefault: a.isDefault })),
      categories: data.categories,
    });
    if (d.unknownAccount) toast(`Счёт «${d.unknownAccount}» не найден — выбран основной`);
    setEditor({
      title: d.amount ? 'Проверьте и сохраните' : 'Не нашёл сумму — введите её',
      value: { ...d, amount: d.amount || null },
    });
  };

  const manual = () =>
    setEditor({
      title: 'Новая операция',
      value: {
        type: 'expense', amount: null, category: 'Другое', note: '',
        accountId: defaultAccount?.id ?? null, occurredAt: Date.now(),
      },
    });

  const accountName = (id: number) => data?.accounts.find((a) => a.id === id);
  const edit = (t: Tx) => {
    if (t.type === 'adjustment') return goHistory();
    setEditor({
      title: 'Изменить операцию',
      value: { id: t.id, type: t.type, amount: t.amount, category: t.category, note: t.note, accountId: t.accountId, occurredAt: t.occurredAt },
    });
  };

  return (
    <div className="screen">
      <h1 className="title">Мани</h1>

      {data && backupDue(data.txCount) && (
        <button className="card item" style={{ border: 0, marginBottom: 12 }} onClick={goSettings}>
          <span className="ico">💾</span>
          <span className="main">
            <div className="name">Сохраните резервную копию</div>
            <div className="sub">Данные живут только на телефоне — нажмите, чтобы сохранить в «Файлы»</div>
          </span>
        </button>
      )}

      <div className="card">
        <textarea
          className="input"
          rows={2}
          placeholder="Например: такси 50 тысяч"
          value={text}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); parse(); }
          }}
        />
        <div className="btns" style={{ marginTop: 10 }}>
          <button className="btn" disabled={!text.trim()} onClick={parse}>Добавить</button>
          <button className="btn secondary" style={{ flex: '0 0 auto', width: 'auto' }} onClick={manual}>Вручную</button>
        </div>
        <p className="hint">
          🎙 Голос: значок микрофона на клавиатуре. Примеры:{' '}
          {EXAMPLES.map((e, i) => (
            <span key={e}>
              <button className="btn link" style={{ padding: 0, fontSize: 13 }} onClick={() => setText(e)}>«{e}»</button>
              {i < EXAMPLES.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </div>

      <div className="card">
        <div className="row">
          <div>
            <div className="muted small">Расходы сегодня</div>
            <div className="big num expense">{formatMoney(data?.today.expense ?? 0)}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <div className="muted small">Расходы за месяц</div>
            <div className="num">{formatMoney(data?.month.expense ?? 0)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted small">Доходы за месяц</div>
            <div className="num income">{formatMoney(data?.month.income ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="subtitle row">
        <span>Счета · всего {formatMoney(data?.total ?? 0)}</span>
      </div>
      <div className="list">
        {data?.accounts.map((a) => (
          <button className="item" key={a.id} onClick={goAccounts}>
            <span className="ico">{KIND_ICONS[a.kind]}</span>
            <span className="main"><div className="name">{a.name}</div></span>
            <span className="num">{formatMoney(data.bal.get(a.id!) ?? 0)}</span>
          </button>
        ))}
      </div>

      <div className="subtitle row">
        <span>Последние операции</span>
        {data && data.recent.length > 0 && (
          <button className="btn link" style={{ fontSize: 13, textTransform: 'none' }} onClick={goHistory}>Все</button>
        )}
      </div>
      {data && data.recent.length === 0 ? (
        <div className="empty">Пока пусто. Напишите или надиктуйте первую трату.</div>
      ) : (
        <div className="list">
          {data?.recent.map((t) => (
            <TxRow key={t.id} t={t} account={accountName(t.accountId)} onClick={() => edit(t)} />
          ))}
        </div>
      )}

      {editor && (
        <TxEditor
          initial={editor.value}
          title={editor.title}
          onClose={() => setEditor(null)}
          onSaved={() => setText('')}
        />
      )}
    </div>
  );
}
