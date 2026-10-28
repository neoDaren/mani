import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteTx, listAccounts, listTx, type Tx } from '../db';
import { formatMoney } from '../lib/format';
import { MONTHS_GEN } from '../lib/periods';
import { TxEditor } from '../components/TxEditor';
import { TxRow } from '../components/TxRow';
import { Sheet, useToast } from '../components/ui';

function dayTitle(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Сегодня';
  if (same(d, y)) return 'Вчера';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export function History() {
  const toast = useToast();
  const [accountId, setAccountId] = useState<number | undefined>();
  const [limit, setLimit] = useState(200);
  const [editing, setEditing] = useState<Tx | null>(null);

  const data = useLiveQuery(async () => ({
    accounts: await listAccounts(true),
    rows: await listTx({ accountId }),
  }), [accountId]);

  const groups: { key: string; ms: number; items: Tx[]; expense: number }[] = [];
  for (const t of (data?.rows ?? []).slice(0, limit)) {
    const key = new Date(t.occurredAt).toDateString();
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, ms: t.occurredAt, items: [], expense: 0 }; groups.push(g); }
    g.items.push(t);
    if (t.type === 'expense') g.expense += t.amount;
  }
  const accById = (id: number) => data?.accounts.find((a) => a.id === id);

  return (
    <div className="screen">
      <h1 className="title">История</h1>
      <select className="select input" value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}>
        <option value="">Все счета</option>
        {data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archivedAt ? ' (архив)' : ''}</option>)}
      </select>

      {data && data.rows.length === 0 && <div className="empty">Операций пока нет.</div>}

      {groups.map((g) => (
        <div key={g.key}>
          <div className="day-head">
            <span>{dayTitle(g.ms)}</span>
            {g.expense > 0 && <span className="num">−{formatMoney(g.expense)}</span>}
          </div>
          <div className="list">
            {g.items.map((t) => (
              <TxRow key={t.id} t={t} account={accountId ? undefined : accById(t.accountId)} onClick={() => setEditing(t)} />
            ))}
          </div>
        </div>
      ))}

      {data && data.rows.length > limit && (
        <button className="btn secondary" onClick={() => setLimit(limit + 200)}>Показать ещё</button>
      )}
      <p className="hint">Нажмите на операцию, чтобы изменить сумму, тип, категорию, счёт или дату, либо удалить её.</p>

      {editing && editing.type !== 'adjustment' && (
        <TxEditor
          title="Изменить операцию"
          initial={{
            id: editing.id, type: editing.type, amount: editing.amount, category: editing.category,
            note: editing.note, accountId: editing.accountId, occurredAt: editing.occurredAt,
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {editing && editing.type === 'adjustment' && (
        <Sheet title="Корректировка остатка" onClose={() => setEditing(null)}>
          <div className="card">
            <div className="mid num">{editing.amount > 0 ? '+' : '−'}{formatMoney(Math.abs(editing.amount))}</div>
            <div className="muted small">{accById(editing.accountId)?.name} · создана сверкой остатка, в статистику не входит</div>
          </div>
          <button className="btn danger" onClick={async () => {
            await deleteTx(editing.id!);
            toast('Корректировка удалена');
            setEditing(null);
          }}>Удалить корректировку</button>
        </Sheet>
      )}
    </div>
  );
}
