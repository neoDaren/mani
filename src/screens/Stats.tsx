import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getSeries, getStats, listAccounts, listCategories } from '../db';
import { formatMoney } from '../lib/format';
import { PERIOD_LABELS, periodBuckets, periodRange, periodTitle, type Period } from '../lib/periods';
import { BarChart, Donut, type Slice } from '../components/charts';

const PERIODS: Period[] = ['day', 'week', 'month', 'year'];
const MAX_SLICES = 6;

export function Stats() {
  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);
  const [accountId, setAccountId] = useState<number | undefined>();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [selected, setSelected] = useState<number | null>(null);
  const range = periodRange(period, new Date(), offset);
  const buckets = periodBuckets(period, range);

  const data = useLiveQuery(async () => ({
    accounts: await listAccounts(true),
    stats: await getStats(range[0], range[1], accountId),
    series: await getSeries(buckets.map((b) => b.range), kind, accountId),
    categories: await listCategories(),
  }), [period, offset, accountId, kind]);

  const s = data?.stats;
  const balance = (s?.income ?? 0) - (s?.expense ?? 0);
  const rows = (kind === 'expense' ? s?.byCategory : s?.incomeByCategory) ?? [];
  const kindTotal = kind === 'expense' ? (s?.expense ?? 0) : (s?.income ?? 0);

  // Цвет идёт за категорией, а не за местом в рейтинге: показанные категории красятся
  // по порядку из списка категорий — так цвета не повторяются и не скачут при смене сумм
  const order = data?.categories[kind] ?? [];
  const shown = (rows.length <= MAX_SLICES ? rows : rows.slice(0, MAX_SLICES - 1))
    .map((r) => r.category)
    .sort((x, y) => (order.indexOf(x) + 1 || 999) - (order.indexOf(y) + 1 || 999));
  const slotOf = (cat: string) => shown.indexOf(cat) + 1;
  const slices: Slice[] = rows.length <= MAX_SLICES
    ? rows.map((r) => ({ label: r.category, value: r.total, slot: slotOf(r.category) }))
    : [
        ...rows.slice(0, MAX_SLICES - 1).map((r) => ({ label: r.category, value: r.total, slot: slotOf(r.category) })),
        { label: 'Остальное', value: rows.slice(MAX_SLICES - 1).reduce((x, r) => x + r.total, 0), slot: 0 },
      ];
  const sliceIndex = (cat: string) => {
    const i = slices.findIndex((x) => x.label === cat);
    return i >= 0 ? i : slices.length - 1;
  };

  const resetSel = () => setSelected(null);

  return (
    <div className="screen">
      <h1 className="title">Статистика</h1>
      <div className="seg">
        {PERIODS.map((p) => (
          <button key={p} className={p === period ? 'on' : ''} onClick={() => { setPeriod(p); setOffset(0); resetSel(); }}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="period-nav">
        <button aria-label="Предыдущий период" onClick={() => { setOffset(offset - 1); resetSel(); }}>‹</button>
        <span className="t">{periodTitle(period, range)}</span>
        <button aria-label="Следующий период" disabled={offset >= 0} onClick={() => { setOffset(offset + 1); resetSel(); }}>›</button>
      </div>

      <select className="select input" style={{ marginBottom: 12 }} value={accountId ?? ''}
        onChange={(e) => { setAccountId(e.target.value ? Number(e.target.value) : undefined); resetSel(); }}>
        <option value="">Все счета</option>
        {data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archivedAt ? ' (архив)' : ''}</option>)}
      </select>

      <div className="card totals">
        <button className={`total ${kind === 'expense' ? 'on' : ''}`} onClick={() => { setKind('expense'); resetSel(); }}>
          <div className="muted small">Расходы</div>
          <div className="mid num expense">{formatMoney(s?.expense ?? 0)}</div>
        </button>
        <button className={`total ${kind === 'income' ? 'on' : ''}`} onClick={() => { setKind('income'); resetSel(); }}>
          <div className="muted small">Доходы</div>
          <div className="mid num income">{formatMoney(s?.income ?? 0)}</div>
        </button>
        <div className="total diff">
          <div className="muted small">Разница</div>
          <div className={`num ${balance < 0 ? 'expense' : ''}`}>{balance > 0 ? '+' : ''}{formatMoney(balance)}</div>
        </div>
      </div>

      {data && (
        <div className="card">
          <div className="card-title">
            {kind === 'expense' ? 'Расходы' : 'Доходы'} {period === 'year' ? 'по месяцам' : period === 'day' ? 'по времени' : 'по дням'}
          </div>
          <BarChart
            key={`${period}-${offset}-${kind}`}
            values={data.series}
            labels={buckets.map((b) => b.label)}
            fullLabels={buckets.map((b) => b.full)}
            kind={kind}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">За этот период {kind === 'expense' ? 'расходов' : 'доходов'} нет</div>
      ) : (
        <div className="card">
          <div className="card-title">По категориям</div>
          <Donut slices={slices} total={kindTotal} selected={selected} onSelect={setSelected} />
          <div className="legend">
            {rows.map((c) => {
              const i = sliceIndex(c.category);
              const slot = slices[i]?.label === c.category ? slices[i].slot : 0;
              const share = kindTotal ? c.total / kindTotal : 0;
              return (
                <button key={c.category} className={`legend-row ${selected !== null && selected !== i ? 'dim' : ''}`}
                  onClick={() => setSelected(selected === i ? null : i)}>
                  <span className={`dot s${slot}`} />
                  <span className="legend-name">{c.category}</span>
                  <span className="num">{formatMoney(c.total)}</span>
                  <span className="muted small pct">{Math.round(share * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
