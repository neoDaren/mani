import { useState } from 'react';
import { formatMoney } from '../lib/format';

/** Короткая сумма для подписей оси: 1,2 млн / 350 тыс */
export function shortMoney(n: number): string {
  const d = (x: number) => String(+x.toFixed(1)).replace('.', ',');
  if (n >= 1e9) return `${d(n / 1e9)} млрд`;
  if (n >= 1e6) return `${d(n / 1e6)} млн`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} тыс`;
  return String(Math.round(n));
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Столбики по дням/месяцам периода — одна серия (расходы или доходы).
 * Нажатие на столбик показывает его сумму над графиком.
 */
export function BarChart({ values, labels, fullLabels, kind }: {
  values: number[];
  labels: string[];
  fullLabels: string[];
  kind: 'expense' | 'income';
}) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 340;
  const H = 150;
  const top = 8;
  const bottom = 20;
  const n = values.length;
  const max = niceMax(Math.max(0, ...values));
  const slot = W / n;
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  const plotH = H - top - bottom;
  // Подписи оси X: не чаще, чем помещается
  const every = n <= 12 ? 1 : n <= 16 ? 2 : 5;
  const total = values.reduce((s, v) => s + v, 0);
  const active = sel !== null && sel < n ? sel : null;

  return (
    <div className="chart">
      <div className="chart-readout">
        {active === null ? (
          <><span className="muted small">Всего</span> <b className="num">{formatMoney(total)}</b></>
        ) : (
          <><span className="muted small">{fullLabels[active]}</span> <b className="num">{formatMoney(values[active])}</b></>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${kind === 'expense' ? 'Расходы' : 'Доходы'}, всего ${formatMoney(total)}`}>
        <line x1="0" x2={W} y1={top} y2={top} className="grid" />
        <line x1="0" x2={W} y1={top + plotH / 2} y2={top + plotH / 2} className="grid" />
        <line x1="0" x2={W} y1={top + plotH} y2={top + plotH} className="axis" />
        <text x={W} y={top + 10} textAnchor="end" className="tick">{shortMoney(max)}</text>
        {values.map((v, i) => {
          const h = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
          const x = i * slot + (slot - barW) / 2;
          const y = top + plotH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i} onClick={() => setSel(active === i ? null : i)}>
              {/* Зона нажатия шире столбика */}
              <rect x={i * slot} y={top} width={slot} height={plotH + bottom} fill="transparent" />
              {h > 0 && (
                <path
                  className={`bar-mark ${kind} ${active !== null && active !== i ? 'dim' : ''}`}
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                />
              )}
              {(i % every === 0 || i === active) && (
                <text x={i * slot + slot / 2} y={H - 5} textAnchor="middle" className={`tick ${i === active ? 'on' : ''}`}>
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  /** Номер цвета 1–8 из категориальной палитры; 0 — серый «Остальное» */
  slot: number;
}

/** Кольцевая диаграмма долей (не больше 6 сегментов); в центре — итог или выбранный сегмент */
export function Donut({ slices, total, selected, onSelect }: {
  slices: Slice[];
  total: number;
  selected: number | null;
  onSelect: (i: number | null) => void;
}) {
  const R = 70;
  const stroke = 22;
  const C = 2 * Math.PI * R;
  const gap = slices.length > 1 ? 2 : 0;
  let acc = 0;
  const sel = selected !== null && selected < slices.length ? slices[selected] : null;
  return (
    <svg viewBox="0 0 180 180" className="donut" role="img" aria-label={`Всего ${formatMoney(total)}`}>
      <g transform="rotate(-90 90 90)">
        {slices.map((s, i) => {
          const len = total ? (s.value / total) * C : 0;
          const dash = Math.max(0.5, len - gap);
          const el = (
            <circle
              key={s.label}
              cx="90" cy="90" r={R}
              fill="none"
              strokeWidth={selected === i ? stroke + 6 : stroke}
              className={`slice s${s.slot} ${selected !== null && selected !== i ? 'dim' : ''}`}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc}
              onClick={() => onSelect(selected === i ? null : i)}
            />
          );
          acc += len;
          return el;
        })}
      </g>
      <text x="90" y="84" textAnchor="middle" className="donut-label">{sel ? sel.label : 'Всего'}</text>
      <text x="90" y="104" textAnchor="middle" className="donut-value">{shortMoney(sel ? sel.value : total)}</text>
    </svg>
  );
}
