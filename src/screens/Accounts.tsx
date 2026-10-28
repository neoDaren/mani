import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { balances, listAccounts, type Account } from '../db';
import { formatMoney } from '../lib/format';
import { AccountEditor } from '../components/AccountEditor';
import { TransferEditor } from '../components/TransferEditor';

export function Accounts() {
  const [open, setOpen] = useState<{ account?: Account } | null>(null);
  const [transfer, setTransfer] = useState(false);
  const data = useLiveQuery(async () => {
    const all = await listAccounts(true);
    const bal = await balances();
    const active = all.filter((a) => a.archivedAt === null);
    return {
      active,
      archived: all.filter((a) => a.archivedAt !== null),
      bal,
      total: active.reduce((s, a) => s + (bal.get(a.id!) ?? 0), 0),
    };
  }, []);

  const row = (a: Account) => (
    <button className="item" key={a.id} onClick={() => setOpen({ account: a })}>
      <span className="main"><div className="name">{a.name}</div></span>
      <span className={`num ${(data?.bal.get(a.id!) ?? 0) < 0 ? 'expense' : ''}`}>
        {formatMoney(data?.bal.get(a.id!) ?? 0)}
      </span>
    </button>
  );

  return (
    <div className="screen">
      <h1 className="title">Счета</h1>
      <div className="card">
        <div className="muted small">Всего</div>
        <div className="big num">{formatMoney(data?.total ?? 0)}</div>
      </div>

      <div className="list">{data?.active.map(row)}</div>
      <div className="btns">
        <button className="btn" onClick={() => setTransfer(true)} disabled={(data?.active.length ?? 0) < 2}>⇄ Перевод</button>
        <button className="btn secondary" onClick={() => setOpen({})}>＋ Счёт</button>
      </div>

      {data && data.archived.length > 0 && (
        <>
          <div className="subtitle">Архив</div>
          <div className="list">{data.archived.map(row)}</div>
        </>
      )}

      {transfer && (
        <TransferEditor
          initial={{ from: data?.active.find((a) => a.isDefault)?.id ?? null, to: null, amount: null, occurredAt: Date.now(), note: '' }}
          onClose={() => setTransfer(false)}
        />
      )}
      {open && (
        <AccountEditor
          account={open.account}
          balance={open.account ? data?.bal.get(open.account.id!) : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
