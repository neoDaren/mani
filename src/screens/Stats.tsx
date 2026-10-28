import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getStats, listAccounts } from '../db';
import { formatMoney } from '../lib/format';
import { PERIOD_LABELS, periodRange, periodTitle, type Period } from '../lib/periods';

const PERIODS: Period[] = ['day', 'week', 'month', 'year'];

export function Stats() {
  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);
  const [accountId, setAccountId] = useState<number | undefined>();
  const range = periodRange(period, new Date(), offset);

  const data = useLiveQuery(async () => ({
    accounts: await listAccounts(true),
    stats: await getStats(range[0], range[1], accountId),
  }), [period, offset, accountId]);

  const s = data?.stats;
  const balance = (s?.income ?? 0) - (s?.expense ?? 0);

  return (
    <div className="screen">
      <h1 className="title">Статистика</h1>
      <div className="seg">
        {PERIODS.map((p) => (
          <button key={p} className={p === period ? 'on' : ''} onClick={() => { setPeriod(p); setOffset(0); }}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="period-nav">
        <button aria-label="Предыдущий период" onClick={() => setOffset(offset - 1)}>‹</button>
        <span className="t">{periodTitle(period, range)}</span>
        <button aria-label="Следующий период" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</button>
      </div>

      <select className="select input" style={{ marginBottom: 12 }} value={accountId ?? ''}
        onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}>
        <option value="">Все счета</option>
        {data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archivedAt ? ' (архив)' : ''}</option>)}
      </select>

      <div className="card">
        <div className="muted small">Расходы</div>
        <div className="big num expense">{formatMoney(s?.expense ?? 0)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <div className="muted small">Доходы</div>
            <div className="num income">{formatMoney(s?.income ?? 0)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted small">Разница</div>
            <div className={`num ${balance < 0 ? 'expense' : ''}`}>{balance > 0 ? '+' : ''}{formatMoney(balance)}</div>
          </div>
        </div>
      </div>

      <div className="subtitle">Расходы по категориям</div>
      {s && s.byCategory.length === 0 ? (
        <div className="empty">За этот период расходов нет.</div>
      ) : (
        <div className="card">
          {s?.byCategory.map((c) => {
            const share = s.expense ? c.total / s.expense : 0;
            return (
              <div key={c.category} style={{ marginBottom: 12 }}>
                <div className="row">
                  <span>{c.category}</span>
                  <span className="num">{formatMoney(c.total)} <span className="muted small">{Math.round(share * 100)}%</span></span>
                </div>
                <div className="bar-bg"><div className="bar" style={{ width: `${Math.max(2, share * 100)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
