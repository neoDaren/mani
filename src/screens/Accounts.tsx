import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { balances, listAccounts, KIND_ICONS, KIND_LABELS, type Account } from '../db';
import { formatMoney } from '../lib/format';
import { AccountEditor } from '../components/AccountEditor';

export function Accounts() {
  const [open, setOpen] = useState<{ account?: Account } | null>(null);
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
      <span className="ico">{KIND_ICONS[a.kind]}</span>
      <span className="main">
        <div className="name">{a.name}</div>
        <div className="sub">{KIND_LABELS[a.kind]}{a.isDefault ? ' · основной' : ''}</div>
      </span>
      <span className={`num ${(data?.bal.get(a.id!) ?? 0) < 0 ? 'expense' : ''}`}>
        {formatMoney(data?.bal.get(a.id!) ?? 0)}
      </span>
    </button>
  );

  return (
    <div className="screen">
      <h1 className="title">Счета</h1>
      <div className="card">
        <div className="muted small">Всего денег</div>
        <div className="big num">{formatMoney(data?.total ?? 0)}</div>
      </div>

      <div className="list">{data?.active.map(row)}</div>
      <button className="btn" onClick={() => setOpen({})}>＋ Добавить счёт</button>
      <p className="hint">
        Счёт — любое место, где лежат деньги: карта, наличные, Payme или Click, вклад. Остаток считается из операций;
        если он разошёлся с банком, откройте счёт и нажмите «Сверить».
      </p>

      {data && data.archived.length > 0 && (
        <>
          <div className="subtitle">Архив</div>
          <div className="list">{data.archived.map(row)}</div>
        </>
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
