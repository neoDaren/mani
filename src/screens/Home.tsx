import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { balances, db, getStats, listAccounts, listCategories, listTx, type Tx } from '../db';
import { backupDue } from '../lib/backupReminder';
import { formatMoney } from '../lib/format';
import { periodRange } from '../lib/periods';
import { parseRequest, parseTransfer } from '../lib/request';
import { IconGear } from '../components/icons';
import { TransferEditor, type TransferValue } from '../components/TransferEditor';
import { TxEditor, type EditorValue } from '../components/TxEditor';
import { TxRow } from '../components/TxRow';
import { useToast } from '../components/ui';

export function Home({ goAccounts, goHistory, goSettings }: { goAccounts: () => void; goHistory: () => void; goSettings: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [editor, setEditor] = useState<{ value: EditorValue; title: string } | null>(null);
  const [transfer, setTransfer] = useState<TransferValue | null>(null);

  const data = useLiveQuery(async () => {
    const accounts = await listAccounts();
    const bal = await balances();
    return {
      accounts,
      bal,
      total: accounts.reduce((s, a) => s + (bal.get(a.id!) ?? 0), 0),
      today: await getStats(...periodRange('day')),
      month: await getStats(...periodRange('month')),
      recent: (await listTx()).slice(0, 5),
      categories: await listCategories(),
      txCount: await db.transactions.count(),
    };
  }, []);

  const defaultAccount = data?.accounts.find((a) => a.isDefault) ?? data?.accounts[0];

  const parse = () => {
    if (!data || !text.trim()) return;
    const accounts = data.accounts.map((a) => ({ id: a.id!, name: a.name, kind: a.kind, isDefault: a.isDefault }));
    const tr = parseTransfer(text, { accounts });
    if (tr) {
      setTransfer({ ...tr, amount: tr.amount || null });
      return;
    }
    const d = parseRequest(text, { accounts, categories: data.categories });
    if (d.unknownAccount) toast(`Счёт «${d.unknownAccount}» не найден`);
    setEditor({ title: d.amount ? 'Проверьте' : 'Введите сумму', value: { ...d, amount: d.amount || null } });
  };

  const manual = () =>
    setEditor({
      title: 'Новая операция',
      value: { type: 'expense', amount: null, category: 'Другое', note: '', accountId: defaultAccount?.id ?? null, occurredAt: Date.now() },
    });

  const edit = (t: Tx) => {
    if (t.type === 'adjustment') return goHistory();
    if (t.type === 'transfer') {
      return setTransfer({ id: t.id, from: t.accountId, to: t.toAccountId ?? null, amount: t.amount, occurredAt: t.occurredAt, note: t.note });
    }
    setEditor({
      title: 'Изменить',
      value: { id: t.id, type: t.type, amount: t.amount, category: t.category, note: t.note, accountId: t.accountId, occurredAt: t.occurredAt },
    });
  };

  return (
    <div className="screen">
      <div className="row head">
        <h1 className="title">Мани</h1>
        <button className="icon-btn" aria-label="Настройки" onClick={goSettings}><IconGear /></button>
      </div>

      {data && backupDue(data.txCount) && (
        <button className="banner" onClick={goSettings}>Сохраните резервную копию ›</button>
      )}

      <div className="card">
        <textarea
          className="input"
          rows={2}
          placeholder="такси 50 тысяч"
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
      </div>

      <div className="card">
        <div className="muted small">Сегодня</div>
        <div className="big num expense">{formatMoney(data?.today.expense ?? 0)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <div className="muted small">Расходы за месяц</div>
            <div className="num">{formatMoney(data?.month.expense ?? 0)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted small">Доходы</div>
            <div className="num income">{formatMoney(data?.month.income ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="section-head">
        <span>Счета</span>
        <span className="num">{formatMoney(data?.total ?? 0)}</span>
      </div>
      <div className="list">
        {data?.accounts.map((a) => (
          <button className="item" key={a.id} onClick={goAccounts}>
            <span className="main"><div className="name">{a.name}</div></span>
            <span className={`num ${(data.bal.get(a.id!) ?? 0) < 0 ? 'expense' : ''}`}>{formatMoney(data.bal.get(a.id!) ?? 0)}</span>
          </button>
        ))}
      </div>

      {data && data.recent.length > 0 && (
        <>
          <div className="section-head">
            <span>Последние</span>
            <button className="btn link" onClick={goHistory}>Все</button>
          </div>
          <div className="list">
            {data.recent.map((t) => (
              <TxRow key={t.id} t={t} onClick={() => edit(t)} nameOf={(id) => data.accounts.find((a) => a.id === id)?.name} />
            ))}
          </div>
        </>
      )}

      {editor && (
        <TxEditor initial={editor.value} title={editor.title} onClose={() => setEditor(null)} onSaved={() => setText('')} />
      )}
      {transfer && <TransferEditor initial={transfer} onClose={() => { setTransfer(null); setText(''); }} />}
    </div>
  );
}
